/**
 * 自定义人物：D1 存储 + 校验 + 解析（服务端专用，Edge 安全）。
 *
 * 存储：wrangler.toml 已绑定 D1（DB，shijian-db）。自定义人物存在
 * custom_characters 表（id 主键，data 存 HistoricalFigure JSON，created_at
 * 排序用）；内置 9 位仍在 lib/characters.ts，不可删改。
 * 无 D1 绑定时（本地未配 wrangler）：GET 只返回内置人物，POST 返回 503，
 * 由路由层处理，本模块不兜底内存存储（内存存储随 isolate 消失，会误导人）。
 */
import { getCharacter, type FigureAnchor, type HistoricalFigure } from '@/lib/characters';
import chunks from '@/lib/rag/chunks.json';

type ChunkRow = { id: string; text: string };

const TABLE_SQL =
  'CREATE TABLE IF NOT EXISTS custom_characters (id TEXT PRIMARY KEY, data TEXT NOT NULL, created_at TEXT NOT NULL)';

export async function ensureCustomTable(db: D1Database): Promise<void> {
  await db.prepare(TABLE_SQL).run();
}

function parseStoredFigure(raw: unknown): HistoricalFigure | null {
  if (typeof raw !== 'string') return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return normalizeCustomFigure(parsed);
  } catch {
    return null;
  }
}

export async function listCustomCharacters(db: D1Database): Promise<HistoricalFigure[]> {
  await ensureCustomTable(db);
  const { results } = await db
    .prepare('SELECT data FROM custom_characters ORDER BY created_at ASC')
    .all<{ data: string }>();
  const out: HistoricalFigure[] = [];
  for (const row of results ?? []) {
    const figure = parseStoredFigure(row?.data);
    if (figure) out.push(figure);
  }
  return out;
}

export async function getCustomCharacter(db: D1Database, id: string): Promise<HistoricalFigure | null> {
  await ensureCustomTable(db);
  const row = await db
    .prepare('SELECT data FROM custom_characters WHERE id = ?')
    .bind(id)
    .first<{ data: string }>();
  if (!row) return null;
  return parseStoredFigure(row.data);
}

export async function saveCustomCharacter(db: D1Database, figure: HistoricalFigure): Promise<void> {
  await ensureCustomTable(db);
  await db
    .prepare('INSERT INTO custom_characters (id, data, created_at) VALUES (?, ?, ?)')
    .bind(figure.id, JSON.stringify(figure), new Date().toISOString())
    .run();
}

/** 解析人物：内置先查 CHARACTER_MAP，再查 D1 自定义表；都没有返回 null。 */
export async function resolveFigure(id: unknown, db: D1Database | null): Promise<HistoricalFigure | null> {
  const builtin = getCharacter(id);
  if (builtin) return builtin;
  if (typeof id !== 'string' || !db) return null;
  return getCustomCharacter(db, id);
}

/** 去掉全部空白与 pdftotext 坏字（与 lib/rag/retrieve.ts 的 normalizeText 一致），用于引文逐字比对。 */
function stripSpaces(text: string): string {
  return text.replace(/[\s\uFFFD\u25B2]+/g, '');
}

function quoteExistsInCorpus(quote: string): boolean {
  const needle = stripSpaces(quote);
  if (!needle) return false;
  for (const chunk of chunks as ChunkRow[]) {
    if (stripSpaces(chunk.text).includes(needle)) return true;
  }
  return false;
}

function toStr(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function toStrArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((v) => toStr(v)).filter((s) => s.length > 0);
}

function normalizeAnchor(value: unknown): FigureAnchor | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const rec = value as Record<string, unknown>;
  const label = toStr(rec.label);
  const source = toStr(rec.source);
  const note = toStr(rec.note);
  if (!label || !source || !note) return null;
  const quote = toStr(rec.quote);
  return quote ? { label, source, note, quote } : { label, source, note };
}

/**
 * 把任意输入规整成 HistoricalFigure（source 固定 custom）；形状不对返回 null。
 * id 由调用方生成或传入（须符合 custom- 前缀，见 validateCustomFigure）。
 */
export function normalizeCustomFigure(input: unknown): HistoricalFigure | null {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) return null;
  const rec = input as Record<string, unknown>;
  const anchorsRaw = Array.isArray(rec.anchors) ? rec.anchors : [];
  const anchors: FigureAnchor[] = [];
  for (const a of anchorsRaw) {
    const anchor = normalizeAnchor(a);
    if (anchor) anchors.push(anchor);
  }
  const figure: HistoricalFigure = {
    id: toStr(rec.id),
    source: 'custom',
    name: toStr(rec.name),
    era: toStr(rec.era),
    lifespan: toStr(rec.lifespan),
    role: toStr(rec.role),
    voice: toStr(rec.voice),
    intro: toStr(rec.intro),
    greeting: toStr(rec.greeting),
    knowledgeCutoff: toStr(rec.knowledgeCutoff),
    cannotKnow: toStrArray(rec.cannotKnow),
    anchors,
    neverCross: toStrArray(rec.neverCross),
    quickQuestions: toStrArray(rec.quickQuestions),
  };
  return figure;
}

function extractYears(text: string): number[] {
  const matches = text.match(/\d{3,4}/g) ?? [];
  return matches.map((m) => Number(m));
}

/** 取生卒里的卒年（最后一个年份数字）；没有年份返回 null。 */
function deathYearOf(lifespan: string): number | null {
  const years = extractYears(lifespan);
  return years.length > 0 ? years[years.length - 1] : null;
}

/**
 * 保存前校验（custom-characters.md 第 6 节）：返回不通过的原因列表，空数组即通过。
 * existingIds 为已有的全部人物 id（内置 + 已存自定义），用于唯一性检查。
 * 注意：系统校验通过 ≠ 事实正确，最终责任在审核人（人工逐条勾选“依据属实”）。
 */
export function validateCustomFigure(figure: HistoricalFigure, existingIds: string[]): string[] {
  const errors: string[] = [];

  if (!figure.name) errors.push('姓名必填');
  if (!figure.era) errors.push('朝代必填');
  if (!figure.lifespan) errors.push('生卒必填');
  if (!figure.role) errors.push('身份必填');
  if (!figure.voice) errors.push('口吻必填');
  if (!figure.intro) errors.push('介绍必填');
  if (!figure.greeting) errors.push('开场白必填');
  if (!figure.knowledgeCutoff) errors.push('知识截止必填');
  if (figure.anchors.length < 2) errors.push('课本锚点至少 2 条');
  if (figure.cannotKnow.length < 1) errors.push('“绝不能知道的事”至少 1 条');
  if (figure.quickQuestions.length < 1 || figure.quickQuestions.length > 3) {
    errors.push('快捷提问 1–3 条');
  }
  if (figure.greeting.length > 100) errors.push('开场白超过 100 字');
  if (figure.neverCross.length < 1) errors.push('“绝不越过的线”至少 1 条');

  if (!/^custom-[a-z0-9-]+$/.test(figure.id)) {
    errors.push('人物 id 须为 custom- 开头的小写字母、数字与连字符');
  } else if (existingIds.includes(figure.id)) {
    errors.push('人物 id 已存在：' + figure.id);
  }

  // 可引原话必须能在教材语料中找到（逐字或去空格后匹配），否则不通过。
  for (const anchor of figure.anchors) {
    if (anchor.quote && !quoteExistsInCorpus(anchor.quote)) {
      errors.push('引文无出处，请删除或改写为转述：' + anchor.quote);
    }
  }

  // 知识截止 = 卒年：生卒里最后一个年份数字必须出现在知识截止里。
  const deathYear = deathYearOf(figure.lifespan);
  if (deathYear === null) {
    errors.push('生卒未给出年份，无法核对知识截止');
  } else if (!figure.knowledgeCutoff.includes(String(deathYear))) {
    errors.push('知识截止须等于卒年（' + deathYear + '）');
  }

  // 锚点里不出现卒年之后的公元年份（公元前人物跳过此项比对）。
  if (deathYear !== null && !figure.lifespan.includes('公元前')) {
    for (const anchor of figure.anchors) {
      for (const year of extractYears(anchor.note)) {
        if (year > deathYear) {
          errors.push('锚点出现卒年之后的年份：' + anchor.label + '（' + year + ' 年）');
        }
      }
    }
  }

  return errors;
}

export function newCustomId(): string {
  return 'custom-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
