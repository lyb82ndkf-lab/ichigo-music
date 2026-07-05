import { parseDisplayTokens } from './MonetLyricsEngine.js';

const CJK_RE = /[\u3400-\u9fff\u3040-\u30ff\uac00-\ud7af]/u;
const CJK_ONLY_RE = /^[\u3400-\u9fff\u3040-\u30ff\uac00-\ud7af]+$/u;
const SPACE_RE = /^\s+$/;
const PUNCT_RE = /^[,.:!?;\uFF0C\u3002\uFF01\uFF1F\u3001\uFF1A\uFF1B\uFF08\uFF09()\u3010\u3011\[\]\u300C\u300D\u300E\u300F\u300A\u300B\u3008\u3009\u2014\u2013~\uFF5E\u2026\u00B7\u30FB'"\u201C\u201D\u2018\u2019-]+$/u;
const JAPANESE_PARTICLE_RE = /^[\u306f\u304c\u3092\u306b\u3067\u3068\u3082\u3078\u3084\u306e\u304b\u306d\u3088\u306a\u305e\u3060\u3067\u3059\u307e\u3059\u305f\u3089\u308c\u308b\u3055\u305b]+$/u;
const CHINESE_SUFFIX_RE = /^[\u7684\u4e86\u7740\u8fc7\u5417\u5462\u5427\u554a\u5440\u54e6\u5566\u5427\u5f97\u5730]$/u;
const CHINESE_PREFIX_RE = /^[\u8fd9\u90a3\u54ea\u4e00\u6bcf\u5404]$/u;
const NEGATIVE_PREFIX_RE = /^[\u4e0d\u6ca1\u65e0\u522b]$/u;

const tokenTextLength = (tokens) => tokens.reduce((sum, token) => sum + (token.text || '').length, 0);
const hasCjk = (text) => CJK_RE.test(text || '');
const CREDIT_LINE_RE = /^\s*(?:\u4f5c\u8bcd|\u4f5c\u66f2|\u7f16\u66f2|\u8bcd|\u66f2|composer|lyricist|lyrics|arranger)\s*[:\uff1a]/i;
const hasWhitespaceBreak = (text) => /\S\s+\S/.test(text || '');

function getWordSegments(text) {
  if (!text) return [];
  try {
    const Segmenter = Intl?.Segmenter;
    if (Segmenter) {
      const locale = /[\u3040-\u30ff]/u.test(text) ? 'ja-JP' : 'zh-CN';
      return Array.from(new Segmenter(locale, { granularity: 'word' }).segment(text), seg => ({
        text: seg.segment,
        isWordLike: seg.isWordLike !== false
      })).filter(seg => seg.text);
    }
  } catch {}
  return (text.match(/[\u3400-\u9fff]+|[\u3040-\u30ff]+|[\uac00-\ud7af]+|[a-zA-Z0-9]+(?:[-'][a-zA-Z0-9]+)*|\s+|./gu) || [text])
    .map(part => ({ text: part, isWordLike: !SPACE_RE.test(part) && !PUNCT_RE.test(part) }));
}

function mergeKnownChinesePhrases(chunks) {
  const out = [];
  for (let i = 0; i < chunks.length; i += 1) {
    const cur = chunks[i];
    const next = chunks[i + 1];
    const next2 = chunks[i + 2];

    // Common lyric phrases and Intl.Segmenter over-splits: ??? / ??? / ????.
    if (cur === '\u6211' && next === '\u7231' && next2 === '\u4f60') {
      out.push(cur + next + next2); i += 2; continue;
    }
    if (cur === '\u8fd9\u4ef6' && next?.startsWith('\u4e8b')) {
      out.push('\u8fd9\u4ef6\u4e8b');
      const tail = next.slice(1);
      if (tail) chunks.splice(i + 1, 1, tail);
      else i += 1;
      continue;
    }
    if ((cur === '\u8fd9' && next === '\u4ef6' && next2 === '\u4e8b') || (cur === '\u8fd9\u4ef6' && next === '\u4e8b')) {
      out.push(cur === '\u8fd9\u4ef6' ? cur + next : cur + next + next2);
      i += cur === '\u8fd9\u4ef6' ? 1 : 2;
      continue;
    }
    if (cur === '\u505a' && next?.startsWith('\u4e0d\u5230')) {
      out.push(cur + next);
      i += 1;
      continue;
    }
    if (cur === '\u505a' && next === '\u4e0d' && next2 === '\u5230') {
      let phrase = cur + next + next2;
      if (chunks[i + 3] && CHINESE_SUFFIX_RE.test(chunks[i + 3])) { phrase += chunks[i + 3]; i += 1; }
      out.push(phrase); i += 2; continue;
    }

    out.push(cur);
  }
  return out;
}

function smoothShortCjkChunks(chunks) {
  const merged = [];
  for (const raw of chunks) {
    if (!raw) continue;
    const part = raw;
    const prev = merged[merged.length - 1];
    if (!prev) {
      merged.push(part);
      continue;
    }

    const prevCjk = CJK_ONLY_RE.test(prev);
    const partCjk = CJK_ONLY_RE.test(part);
    if (!partCjk) {
      if (PUNCT_RE.test(part)) merged[merged.length - 1] = prev + part;
      else merged.push(part);
      continue;
    }

    // Keep Japanese particles attached like folia's layout units: ? + ? -> ??.
    if (/^[\u3040-\u30ff]+$/u.test(part) && (JAPANESE_PARTICLE_RE.test(part) || part.length <= 1) && prevCjk && prev.length <= 4) {
      merged[merged.length - 1] = prev + part;
      continue;
    }

    // Attach Chinese aspect/ending particles to the previous phrase.
    if (CHINESE_SUFFIX_RE.test(part) && prevCjk) {
      merged[merged.length - 1] = prev + part;
      continue;
    }

    // Merge demonstrative / negative prefixes with the following word later if possible.
    if (prevCjk && (CHINESE_PREFIX_RE.test(prev) || NEGATIVE_PREFIX_RE.test(prev)) && part.length <= 3) {
      merged[merged.length - 1] = prev + part;
      continue;
    }

    // Avoid orphan single CJK characters when they are clearly part of a short phrase.
    if (prevCjk && partCjk && prev.length === 1 && part.length <= 2) {
      merged[merged.length - 1] = prev + part;
      continue;
    }

    merged.push(part);
  }
  return mergeKnownChinesePhrases(merged);
}

export function segmentSemanticChunks(text) {
  const clean = String(text || '');
  if (!clean.trim()) return [];
  if (CREDIT_LINE_RE.test(clean)) return [clean];
  if (hasCjk(clean) && hasWhitespaceBreak(clean)) {
    return clean.split(/\s+/).map(part => part.trim()).filter(Boolean);
  }
  const rawSegments = getWordSegments(clean);
  const chunks = [];
  let pendingPrefix = '';
  for (const seg of rawSegments) {
    const part = seg.text;
    if (!part) continue;
    if (SPACE_RE.test(part)) {
      if (chunks.length) chunks[chunks.length - 1] += part;
      continue;
    }
    if (!seg.isWordLike || PUNCT_RE.test(part)) {
      if (chunks.length) chunks[chunks.length - 1] += part;
      else pendingPrefix += part;
      continue;
    }
    chunks.push(pendingPrefix + part);
    pendingPrefix = '';
  }
  if (pendingPrefix && chunks.length) chunks[chunks.length - 1] += pendingPrefix;
  return hasCjk(clean) ? smoothShortCjkChunks(chunks).filter(Boolean) : chunks.filter(Boolean);
}

function rowsFromChunks(tokens, chunks) {
  const rows = [];
  let cursor = 0;
  let charOffsetInToken = 0;

  for (const chunk of chunks) {
    while (cursor < tokens.length && SPACE_RE.test(tokens[cursor]?.text || '')) {
      cursor += 1;
      charOffsetInToken = 0;
    }
    let remaining = chunk.length;
    const row = [];
    while (cursor < tokens.length && remaining > 0) {
      const token = tokens[cursor];
      const tokenText = token.text || '';
      if (SPACE_RE.test(tokenText)) {
        cursor += 1;
        charOffsetInToken = 0;
        continue;
      }
      const available = tokenText.length - charOffsetInToken;
      row.push(token);
      remaining -= Math.max(available, tokenText.length || 1);
      cursor += 1;
      charOffsetInToken = 0;
    }
    if (row.length) rows.push(row);
  }

  while (cursor < tokens.length) {
    if (!rows.length) rows.push([]);
    rows[rows.length - 1].push(tokens[cursor]);
    cursor += 1;
  }
  return rows.filter(row => row.length);
}

function packRows(rows, maxRows = 3) {
  const nonEmpty = rows.filter(row => row.length);
  if (nonEmpty.length <= maxRows) return nonEmpty;
  const total = nonEmpty.reduce((sum, row) => sum + tokenTextLength(row), 0);
  const target = Math.max(2, Math.ceil(total / maxRows));
  const packed = Array.from({ length: maxRows }, () => []);
  let rowIndex = 0;
  let rowLen = 0;
  for (const row of nonEmpty) {
    const len = tokenTextLength(row);
    if (rowIndex < maxRows - 1 && rowLen > 0 && rowLen + len > target) {
      rowIndex += 1;
      rowLen = 0;
    }
    packed[rowIndex].push(...row);
    rowLen += len;
  }
  return packed.filter(row => row.length);
}

function fallbackTimedRows(tokens) {
  const timedTokens = tokens.filter(token => token.timed && token.wordIndex >= 0);
  const totalLength = tokenTextLength(tokens);
  if (timedTokens.length < 6 || totalLength < 7) return [tokens];
  const wordIndexes = [...new Set(timedTokens.map(token => token.wordIndex))];
  if (wordIndexes.length < 2) return [tokens];
  const firstWordIndex = wordIndexes[0];
  const firstWordLength = timedTokens.filter(token => token.wordIndex === firstWordIndex).reduce((sum, token) => sum + (token.text || '').length, 0);
  let splitAfterWord = firstWordIndex;
  if (!(firstWordLength <= 3 && totalLength - firstWordLength >= 4)) {
    const target = totalLength * 0.45;
    let running = 0;
    let bestWord = firstWordIndex;
    let bestDistance = Infinity;
    for (const wordIndex of wordIndexes.slice(0, -1)) {
      running += timedTokens.filter(token => token.wordIndex === wordIndex).reduce((sum, token) => sum + (token.text || '').length, 0);
      const distance = Math.abs(running - target);
      if (distance < bestDistance) { bestDistance = distance; bestWord = wordIndex; }
    }
    splitAfterWord = bestWord;
  }
  const rows = [[], []];
  for (const token of tokens) rows[token.wordIndex >= 0 && token.wordIndex <= splitAfterWord ? 0 : 1].push(token);
  return rows.filter(row => row.length > 0);
}


function preferJapaneseFirstParticleRow(fullText, chunks) {
  if (!/[\u3040-\u30ff]/u.test(fullText) || chunks.length < 3) return chunks;
  const first = chunks[0] || '';
  const rest = chunks.slice(1).join('');
  if (first.length <= 3 && rest.length >= 4) return [first, rest];
  return chunks;
}


export function buildSemanticAnimationTokens(lineOrTokens) {
  const tokens = Array.isArray(lineOrTokens) ? lineOrTokens : parseDisplayTokens(lineOrTokens);
  if (!tokens || tokens.length === 0) return [];
  const fullText = tokens.map(t => t.text || '').join('');
  if (CREDIT_LINE_RE.test(fullText)) {
    const timed = tokens.filter(token => token.timed);
    const startTime = timed.length ? Math.min(...timed.map(t => Number(t.startTime ?? 0))) : 0;
    const endTime = timed.length ? Math.max(...timed.map(t => Number(t.endTime ?? t.startTime ?? 0))) : startTime;
    return [{ text: fullText, key: `credit-${tokens[0]?.key || fullText}`, timed: timed.length > 0, startTime, endTime, durationSec: Math.max(0.001, endTime - startTime), sourceTokens: tokens }];
  }
  const chunks = segmentSemanticChunks(fullText).filter(chunk => chunk.trim());
  if (chunks.length <= 1) return tokens;

  const groups = rowsFromChunks(tokens, chunks).map((group, index) => {
    const timed = group.filter(token => token.timed);
    if (timed.length === 0) {
      return {
        text: group.map(t => t.text || '').join(''),
        key: `semantic-static-${index}-${group[0]?.key || index}`,
        timed: false,
        sourceTokens: group
      };
    }
    const startTime = Math.min(...timed.map(t => Number(t.startTime ?? 0)));
    const endTime = Math.max(...timed.map(t => Number(t.endTime ?? t.startTime ?? 0)));
    return {
      text: group.map(t => t.text || '').join(''),
      key: `semantic-${index}-${group[0]?.key || index}`,
      timed: true,
      startTime,
      endTime,
      durationSec: Math.max(0.001, endTime - startTime),
      wordIndex: index,
      sourceTokens: group
    };
  });
  return groups.filter(group => group.text);
}

export function buildFoliaTokenRows(lineOrTokens, options = {}) {
  const tokens = Array.isArray(lineOrTokens) ? lineOrTokens : parseDisplayTokens(lineOrTokens);
  if (!tokens || tokens.length === 0) return [];
  const fullText = tokens.map(t => t.text || '').join('');
  if (CREDIT_LINE_RE.test(fullText)) return [tokens];
  const chunks = preferJapaneseFirstParticleRow(fullText, segmentSemanticChunks(fullText).filter(chunk => chunk.trim()));
  if (chunks.length > 1) {
    if (fullText.trim().length < (options.minSplitLength || 9)) return [tokens];
    return packRows(rowsFromChunks(tokens, chunks), options.maxRows || 3);
  }
  return fallbackTimedRows(tokens);
}

