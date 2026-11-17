// scripts/rag-build.mjs
// 用途：读取 data/textbooks/*.pdf，解析后构建 RAG 语料，输出到 lib/rag/chunks.json。
// 确定性：处理过程不依赖时间戳、随机数或外部状态，两次运行生成的 chunks.json 字节完全一致。

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BOOKS = [
  { file: 'gangyao-shang.pdf', code: 'gangyao-shang', book: '《中外历史纲要（上）》' },
  { file: 'gangyao-xia.pdf', code: 'gangyao-xia', book: '《中外历史纲要（下）》' },
  { file: 'xuanxiu-1.pdf', code: 'xuanxiu-1', book: '选必一《国家制度与社会治理》' },
  { file: 'xuanxiu-2.pdf', code: 'xuanxiu-2', book: '选必二《经济与社会生活》' },
  { file: 'xuanxiu-3.pdf', code: 'xuanxiu-3', book: '选必三《文化交流与传播》' },
];

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const TEXTBOOKS_DIR = path.join(ROOT, 'data', 'textbooks');
const OUT_PATH = path.join(ROOT, 'lib', 'rag', 'chunks.json');

function cleanPageText(pageText) {
  return pageText
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter((line) => line.length > 0)
    .join('\n');
}

function detectPrintedPages(pages) {
  const pageHeaderRegex = /第\s*\d+\s*课[\s\S]*?(\d+)\s*$/;
  const footerRegex = /^(\d+)\s*(中外历史纲要|选必|经济与社会生活|国家制度与社会治理|文化交流与传播)/;

  const isTocPage = (pageLines) => {
    const nonEmptyLines = pageLines.filter(line => line.trim().length > 0);
    if (nonEmptyLines.some(line => /目\s+录/.test(line))) {
      return true;
    }
    if (nonEmptyLines.some(line => /^第[一二三四五六七八九十]+单元.*\d+$/.test(line))) {
      return true;
    }
    let tocLineCount = 0;
    for (const line of nonEmptyLines) {
      const hasLesson = /第\s*\d+\s*课/.test(line);
      const hasPageNumberAtEnd = /(\d+)\s*$/.test(line);
      if (hasLesson && hasPageNumberAtEnd) {
        tocLineCount++;
      }
    }
    if (tocLineCount >= 3 && nonEmptyLines.length > 0 && tocLineCount * 3 >= nonEmptyLines.length) {
      return true;
    }
    return false;
  };

  const pageRecords = [];
  for (const page of pages) {
    const pageLines = page.split('\n');
    if (isTocPage(pageLines)) {
      pageRecords.push({ printed: null, isToc: true });
      continue;
    }

    let foundNumber = null;
    for (const line of pageLines) {
      const trimmedLine = line.trim();
      if (!trimmedLine) continue;

      const footerMatch = trimmedLine.match(footerRegex);
      if (footerMatch) {
        foundNumber = parseInt(footerMatch[1], 10);
        break;
      }

      const headerMatch = trimmedLine.match(pageHeaderRegex);
      if (headerMatch) {
        foundNumber = parseInt(headerMatch[1], 10);
        break;
      }
    }
    pageRecords.push({ printed: foundNumber, isToc: false });
  }

  const totalNonTocPages = pageRecords.filter(p => !p.isToc).length;
  const detectedCount = pageRecords.filter(p => !p.isToc && p.printed !== null).length;
  const coverageRate = totalNonTocPages > 0 ? (detectedCount / totalNonTocPages) * 100 : 0;

  let isMonotonic = true;
  let monotonicFailPage = -1;
  let lastPrinted = -Infinity;

  for (let i = 0; i < pageRecords.length; i++) {
    const record = pageRecords[i];
    if (!record.isToc && record.printed !== null) {
      if (record.printed <= lastPrinted) {
        isMonotonic = false;
        monotonicFailPage = i + 1;
        break;
      }
      lastPrinted = record.printed;
    }
  }

  let mode, reason, finalPrinted;
  if (isMonotonic && coverageRate >= 90) {
    mode = 'printed';
    reason = '';
    finalPrinted = pageRecords.map(p => p.printed);
  } else {
    mode = 'pdf';
    if (!isMonotonic) {
      reason = `第${monotonicFailPage}页印制页码不单调`;
    } else {
      reason = `仅${Math.round(coverageRate)}%的页检测到印制页码`;
    }
    finalPrinted = pageRecords.map(() => null);
  }

  return { printed: finalPrinted, mode, reason };
}

function parseUnitTitle(lines, i, unitNames) {
  const line = lines[i].trim();
  const match = line.match(/^第([一二三四五六七八九十]+)单元/);
  if (!match) return null;

  const unitCode = match[0];
  const rest = line.slice(unitCode.length).trim();

  if (rest) {
    return {
      unit: `${unitCode} ${rest}`,
      nextIndex: i + 1
    };
  }

  if (unitNames && unitNames[unitCode]) {
    return {
      unit: unitNames[unitCode],
      nextIndex: i + 1
    };
  }

  let unit = unitCode;
  let nextIndex = i + 1;
  const punct = /[，。；：、？！]/;

  while (nextIndex < lines.length) {
    const nextLine = lines[nextIndex].trim();
    if (!nextLine) break;

    if (
      nextLine.length <= 25 &&
      !punct.test(nextLine) &&
      !/第\s*\d+\s*课/.test(nextLine) &&
      !/第[一二三四五六七八九十]+单元/.test(nextLine) &&
      nextLine !== '附录'
    ) {
      if (nextIndex === i + 1) {
        unit += ' ' + nextLine;
      } else {
        unit += nextLine;
      }
      nextIndex++;
    } else {
      break;
    }
  }

  return {
    unit: unit,
    nextIndex: nextIndex
  };
}

function parseLessonHeading(lines, i) {
  const current = lines[i].trim();
  if (!/^第\s*\d+\s*课$/.test(current)) {
    return null;
  }
  
  const numMatch = lines[i].replace(/\s/g, '').match(/^第(\d+)课$/);
  const lessonNum = numMatch[1];
  
  if (i + 1 >= lines.length) {
    return null;
  }
  
  let lessonName = lines[i + 1].trim();
  if (lessonName === '') {
    return null;
  }
  
  let nextIndex = i + 2;
  
  if (nextIndex < lines.length) {
    const c = lines[nextIndex].trim();
    if (c.length >= 2 && c.length <= 25 &&
        !/[，。；：、？！]/.test(c) &&
        !/^第\s*\d+\s*课$/.test(c) &&
        !/^第[一二三四五六七八九十]+单元/.test(c) &&
        c !== '附录' &&
        !/第\s*\d+\s*课[\s\S]*\d+\s*$/.test(c) &&
        !/^\s*\d+\s+(中外历史纲要|选必|经济与社会生活|国家制度与社会治理|文化交流与传播)/.test(c)) {
      lessonName += c;
      nextIndex += 1;
    }
  }
  
  return {
    lesson: "第" + lessonNum + "课 " + lessonName,
    nextIndex
  };
}

function loadBookPages(bookMeta) {
  const { file, code, book } = bookMeta;
  const pdfPath = path.join(TEXTBOOKS_DIR, file);

  const result = spawnSync('pdftotext', ['-layout', pdfPath, '-'], { encoding: 'utf8' });
  if (result.error || result.status !== 0) {
    const errMsg = result.error?.message || result.stderr || 'unknown error';
    throw new Error(`Failed to extract text for ${book}: ${errMsg}`);
  }

  const rawPages = result.stdout.split('\f');
  const pages = rawPages.map(p => cleanPageText(p));

  const { mode, reason, printed } = detectPrintedPages(pages);

  const lines = [];
  const linePdfPage = [];
  const linePrintedPage = [];
  const unitNames = {};

  const textbookKeywords = ['中外历史纲要', '选必', '经济与社会生活', '国家制度与社会治理', '文化交流与传播'];
  const unitRegex = /(第[一二三四五六七八九十]+单元)\s+(.+)$/;

  for (let i = 0; i < pages.length; i++) {
    const pdfPage = i + 1;
    const pageLines = pages[i].split('\n');

    for (const line of pageLines) {
      lines.push(line);
      linePdfPage.push(pdfPage);
      linePrintedPage.push(mode === 'printed' ? (printed[i] ?? pdfPage) : pdfPage);

      const collapsedLine = line.replace(/\s+/g, ' ').trim();
      if (collapsedLine) {
        const matchNum = collapsedLine.match(/^(\d+)\s+(.+)$/);
        if (matchNum) {
          const rest = matchNum[2];
          if (textbookKeywords.some(kw => rest.includes(kw))) {
            const unitMatch = collapsedLine.match(unitRegex);
            if (unitMatch) {
              const unitKey = unitMatch[1];
              if (!unitNames[unitKey]) {
                unitNames[unitKey] = `${unitMatch[1]} ${unitMatch[2].trim()}`;
              }
            }
          }
        }
      }
    }
  }

  return { lines, linePdfPage, linePrintedPage, mode, reason, unitNames };
}

function extractSections(bookMeta) {
    const { lines, linePdfPage, linePrintedPage, mode, reason, unitNames } = loadBookPages(bookMeta);

    const tocPages = new Set();
    const pageGroups = new Map();
    for (let i = 0; i < lines.length; i++) {
        const pg = linePdfPage[i];
        if (!pageGroups.has(pg)) {
            pageGroups.set(pg, []);
        }
        pageGroups.get(pg).push(lines[i]);
    }
    for (const [pg, groupLines] of pageGroups) {
        let isToc = false;
        for (const l of groupLines) {
            if (/目\s+录/.test(l) || /^第[一二三四五六七八九十]+单元.*\d+$/.test(l)) {
                isToc = true;
                break;
            }
        }
        if (isToc) {
            tocPages.add(pg);
            continue;
        }
        let nonEmptyCount = 0;
        let matchCount = 0;
        for (const l of groupLines) {
            const trimmed = l.trim();
            if (trimmed === "") continue;
            nonEmptyCount++;
            if (/第\s*\d+\s*课/.test(l) && /\d+$/.test(trimmed)) {
                matchCount++;
            }
        }
        if (nonEmptyCount > 0 && matchCount >= 3 && matchCount * 3 >= nonEmptyCount) {
            tocPages.add(pg);
        }
    }

    let currentUnit = "";
    let currentLesson = null;
    let currentLines = [];
    let currentPage = null;
    let currentPdfPage = null;
    const sections = [];
    let i = 0;
    while (i < lines.length) {
        const curPdfPage = linePdfPage[i];
        if (tocPages.has(curPdfPage)) {
            const skipPage = curPdfPage;
            while (i < lines.length && linePdfPage[i] === skipPage) {
                i++;
            }
            continue;
        }
        const unitRes = parseUnitTitle(lines, i, unitNames);
        if (unitRes) {
            if (currentLines.length > 0) {
                sections.push({
                    book: bookMeta.book,
                    unit: currentUnit,
                    lesson: currentLesson,
                    page: currentPage,
                    pdfPage: currentPdfPage,
                    text: currentLines.join("\n")
                });
                currentLines = [];
            }
            currentUnit = unitRes.unit;
            i = unitRes.nextIndex;
            currentLesson = "单元导言";
            currentLines = [];
            currentPage = null;
            currentPdfPage = null;
            continue;
        }
        const lessonRes = parseLessonHeading(lines, i);
        if (lessonRes) {
            if (currentLines.length > 0) {
                sections.push({
                    book: bookMeta.book,
                    unit: currentUnit,
                    lesson: currentLesson,
                    page: currentPage,
                    pdfPage: currentPdfPage,
                    text: currentLines.join("\n")
                });
                currentLines = [];
            }
            currentLesson = lessonRes.lesson;
            i = lessonRes.nextIndex;
            continue;
        }
        if (lines[i].trim() === "附录") {
            if (currentLines.length > 0) {
                sections.push({
                    book: bookMeta.book,
                    unit: currentUnit,
                    lesson: currentLesson,
                    page: currentPage,
                    pdfPage: currentPdfPage,
                    text: currentLines.join("\n")
                });
                currentLines = [];
            }
            currentUnit = "";
            currentLesson = "附录";
            i++;
            continue;
        }
        const lineText = lines[i];
        if (/第\s*\d+\s*课[\s\S]*\d+\s*$/.test(lineText) || /^\s*\d+\s+(中外历史纲要|选必|经济与社会生活|国家制度与社会治理|文化交流与传播)/.test(lineText)) {
            i++;
            continue;
        }
        if (currentLesson === null) {
            i++;
            continue;
        }
        if (currentLines.length === 0) {
            currentPage = linePrintedPage[i];
            currentPdfPage = linePdfPage[i];
        }
        currentLines.push(lineText);
        i++;
    }
    if (currentLines.length > 0) {
        sections.push({
            book: bookMeta.book,
            unit: currentUnit,
            lesson: currentLesson,
            page: currentPage,
            pdfPage: currentPdfPage,
            text: currentLines.join("\n")
        });
    }
    sections.mode = mode;
    sections.reason = reason;
    return sections;
}

function splitSection(section, bookCode, startId) {
  const lines = section.text.split('\n');
  const heads = ['学习聚焦', '史料阅读', '历史纵横', '学习拓展', '史料实证', '问题探究', '思考点'];
  const groups = [];
  let g = [];
  for (const line of lines) {
    const isH = /^[一二三四五六七八九十]+、/.test(line) || /^（[一二三四五六七八九十]+）/.test(line) || heads.includes(line);
    if (isH && g.length) {
      groups.push(g);
      g = [];
    }
    g.push(line);
  }
  if (g.length) groups.push(g);
  const all = [];
  for (const grp of groups) {
    let c = [];
    for (const line of grp) {
      if ([...c, line].join('\n').replace(/\s+/g, '').length > 1000) {
        if (c.length) {
          all.push(c);
          c = [];
        }
        c.push(line);
      } else {
        c.push(line);
      }
    }
    if (c.length) all.push(c);
  }
  let i = 0;
  while (i < all.length) {
    const cur = all[i];
    const curLen = cur.join('\n').replace(/\s+/g, '').length;
    if (curLen < 400) {
      if (i > 0) {
        const prev = all[i - 1];
        const prevMergedLen = [...prev, ...cur].join('\n').replace(/\s+/g, '').length;
        if (prevMergedLen <= 1000) {
          prev.push(...cur);
          all.splice(i, 1);
          continue;
        }
      }
      if (i < all.length - 1) {
        const next = all[i + 1];
        const nextMergedLen = [...cur, ...next].join('\n').replace(/\s+/g, '').length;
        if (nextMergedLen <= 1000) {
          cur.push(...next);
          all.splice(i + 1, 1);
        }
      }
    }
    i++;
  }
  const chunks = [];
  let id = startId;
  for (const c of all) {
    chunks.push({ id: bookCode + '-' + id, book: section.book, unit: section.unit, lesson: section.lesson, page: section.page, text: c.join('\n') });
    id++;
  }
  return { chunks, nextId: id };
}

function main() {
  const allChunks = [];
  let nextId = 1;
  const stats = [];
  let totalSectionChars = 0;
  let totalChunkChars = 0;

  for (const book of BOOKS) {
    const sections = extractSections(book);
    let bookChunkCount = 0;
    for (const section of sections) {
      totalSectionChars += section.text.replace(/\s/g, '').length;
      const result = splitSection(section, book.code, nextId);
      allChunks.push(...result.chunks);
      nextId = result.nextId;
      bookChunkCount += result.chunks.length;
      for (const chunk of result.chunks) {
        totalChunkChars += chunk.text.replace(/\s/g, '').length;
      }
    }
    stats.push({
      book: book.book,
      sections: sections.length,
      chunks: bookChunkCount,
      mode: sections.mode,
      reason: sections.reason
    });
  }

  for (const chunk of allChunks) {
    const len = chunk.text.replace(/\s/g, '').length;
    if (len < 1 || len > 1000) {
      throw new Error(`Chunk text length out of bounds: ${len}`);
    }
  }

  if (totalChunkChars < totalSectionChars * 0.95) {
    throw new Error('Coverage check failed: chunk chars do not meet 95% of section chars');
  }

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(allChunks, null, 2) + "\n", 'utf-8');

  for (const s of stats) {
    const reasonSuffix = s.mode !== 'printed' ? `，原因：${s.reason}` : '';
    console.log(`${s.book}： sections ${s.sections} 个，chunks ${s.chunks} 个，页码模式 ${s.mode}${reasonSuffix}`);
  }
  console.log(`总块数：${allChunks.length}`);
  console.log(`输出文件字节数：${fs.statSync(OUT_PATH).size}`);
}

try {
  main();
} catch (err) {
  console.error(err);
  process.exitCode = 1;
}
