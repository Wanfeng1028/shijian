/**
 * 本文件是史鉴 RAG 的 BM25 检索引擎。
 * 数据源为同目录静态 chunks.json（598 块，5 册人教版高中历史教材）。
 * Edge runtime 安全，零外部依赖、不用 Node API。
 */
import chunks from './chunks.json';

type Chunk = {
  id: string;
  book: string;
  unit: string;
  lesson: string;
  page: number;
  text: string;
};

const MIN_SCORE = 13.0; // 最低分数线：按探针校准（课内 top-3 最低 15.02，课外最高 12.28，短问句 top-1 约 14.5）
const TOP_K = 3;
const K1 = 1.2;
const B = 0.75;

// pdftotext 会在字间插空格、抽取有缺字形，"五口通商"的"口"字丢成了 ▲。
// 因此用正则一次去掉全部空白字符、U+FFFD 和 U+25B2。
function normalizeText(text: string): string {
  return text.replace(/[\s\uFFFD\u25B2]+/g, '');
}

function tokenize(text: string): string[] {
  const normalized = normalizeText(text);
  const tokens: string[] = [];
  const matches = normalized.match(/[\u4e00-\u9fff]+|[A-Za-z0-9]+/g) ?? [];
  for (const segment of matches) {
    if (/[\u4e00-\u9fff]/.test(segment)) {
      for (let i = 0; i < segment.length - 1; i++) {
        tokens.push(segment.slice(i, i + 2));
      }
    } else {
      tokens.push(segment.toLowerCase());
    }
  }
  return tokens;
}

export interface SearchIndex {
  postings: Map<string, Array<{ doc: number; tf: number }>>;
  docLengths: number[];
  avgDocLength: number;
  docCount: number;
}

let cachedIndex: SearchIndex | null = null;

export function buildIndex(): SearchIndex {
  const postings: Map<string, Array<{ doc: number; tf: number }>> = new Map();
  const docLengths: number[] = [];

  for (let i = 0; i < chunks.length; i++) {
    const tokens = tokenize(chunks[i].text);
    docLengths[i] = tokens.length;

    const localTf = new Map<string, number>();
    for (const token of tokens) {
      localTf.set(token, (localTf.get(token) ?? 0) + 1);
    }

    for (const [token, tf] of localTf) {
      const list = postings.get(token);
      if (list) {
        list.push({ doc: i, tf });
      } else {
        postings.set(token, [{ doc: i, tf }]);
      }
    }
  }

  const totalTokens = docLengths.reduce((sum, len) => sum + len, 0);
  const avgDocLength = chunks.length > 0 ? totalTokens / chunks.length : 0;

  return {
    postings,
    docLengths,
    avgDocLength,
    docCount: chunks.length,
  };
}

export function getIndex(): SearchIndex {
  // 首次调用建索引并缓存，后续调用复用
  if (cachedIndex === null) {
    cachedIndex = buildIndex();
  }
  return cachedIndex;
}

// BM25 打分部分
// K1 = 1.2, B = 0.75
// IDF: log(1 + (N - df + 0.5) / (df + 0.5))
// TF 部分: (tf * (K1 + 1)) / (tf + K1 * (1 - B + B * (docLen / avgDocLength)))
function searchScores(queryTerms: string[], allowed: Set<number> | null): Array<{ doc: number; score: number }> {
  const index = getIndex();
  const N = index.docCount;
  const scores = new Map<number, number>();

  // 去重查询词，同一词只计算一次
  const uniqueTerms = Array.from(new Set(queryTerms));

  for (const term of uniqueTerms) {
    const postings = index.postings.get(term);
    if (!postings || postings.length === 0) continue;

    const df = postings.length;
    const idf = Math.log(1 + (N - df + 0.5) / (df + 0.5));

    for (const { doc, tf } of postings) {
      if (allowed !== null && !allowed.has(doc)) continue;

      const docLen = index.docLengths[doc];
      const tfPart = (tf * (K1 + 1)) / (tf + K1 * (1 - B + B * (docLen / index.avgDocLength)));
      scores.set(doc, (scores.get(doc) ?? 0) + idf * tfPart);
    }
  }

  return Array.from(scores.entries())
    .filter(([, score]) => score > 0)
    .map(([doc, score]) => ({ doc, score }))
    .sort((a, b) => b.score - a.score);
}

export function formatChunk(chunk: Chunk): string {
  return "【" + chunk.book + "·" + chunk.unit + "·" + chunk.lesson + "，p." + String(chunk.page) + "】\n" + chunk.text;
}

export async function retrieveContext(
  query: string,
  opts: { task?: string; grade?: string; textbook?: string }
): Promise<{
  context: string;
  sources: Array<{ book: string; unit: string; lesson: string; page: string }>;
}> {
  if (query.trim() === "") {
    return { context: "", sources: [] };
  }
  const terms = tokenize(query);
  if (terms.length === 0) {
    return { context: "", sources: [] };
  }
  let results: Array<{ doc: number; score: number }>;
  if (opts.textbook) {
    const allowed = new Set<number>();
    for (let i = 0; i < chunks.length; i++) {
      if (chunks[i].book === opts.textbook) {
        allowed.add(i);
      }
    }
    results = searchScores(terms, allowed);
    if (results.length === 0 || results[0].score < MIN_SCORE) {
      results = searchScores(terms, null);
    }
  } else {
    results = searchScores(terms, null);
  }
  const hits = results.filter((r) => r.score >= MIN_SCORE).slice(0, TOP_K);
  if (hits.length === 0) {
    return { context: "", sources: [] };
  }
  const context = hits.map((r) => formatChunk(chunks[r.doc])).join("\n\n");
  const sources = hits.map((r) => {
    const c = chunks[r.doc];
    return { book: c.book, unit: c.unit, lesson: c.lesson, page: String(c.page) };
  });
  return { context, sources };
}
