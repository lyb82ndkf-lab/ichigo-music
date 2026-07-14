// MonetLyricsEngine.js
// 莫奈模式：高性能歌词预测量与布局计算引擎 (无 React 依赖)

let sharedCanvas = null;
let sharedCtx = null;

// 缓存 Map, key: text|fontPx|fontWeight|fontFamily
const measurementsCache = new Map();

function getCanvasContext() {
  if (!sharedCtx) {
    if (typeof document !== 'undefined') {
      sharedCanvas = document.createElement('canvas');
      sharedCtx = sharedCanvas.getContext('2d', { willReadFrequently: true });
    }
  }
  return sharedCtx;
}

/**
 * 用 Intl.Segmenter 按字素（grapheme）拆分文本。
 * 能够正确处理 Emoji 和复合字符，而不会像 split('') 那样截断。
 */
export function splitGraphemes(text) {
  if (!text) return [];
  if (typeof Intl !== 'undefined' && Intl.Segmenter) {
    const segmenter = new Intl.Segmenter('zh-CN', { granularity: 'grapheme' });
    const segments = segmenter.segment(text);
    return Array.from(segments).map(s => s.segment);
  }
  // Fallback
  return Array.from(text);
}

const JAPANESE_SMALL_KANA_RE = /^[\u3041\u3043\u3045\u3047\u3049\u3083\u3085\u3087\u308e\u3063\u30a1\u30a3\u30a5\u30a7\u30a9\u30e3\u30e5\u30e7\u30ee\u30c3\u30fc]$/u;
const LYRIC_PUNCT_RE = /^[\s\u3000,.:!?;\uFF0C\u3002\uFF01\uFF1F\u3001\uFF1A\uFF1B\uFF08\uFF09()\u3010\u3011\[\]\u300C\u300D\u300E\u300F\u300A\u300B\u3008\u3009\u2014\u2013~\uFF5E\u2026\u00B7\u30FB'"\u201C\u201D\u2018\u2019-]+$/u;
const CREDIT_LINE_RE = /^\s*(?:\u4f5c\u8bcd|\u4f5c\u66f2|\u7f16\u66f2|\u8bcd|\u66f2|composer|lyricist|lyrics|arranger)\s*[:\uff1a]/i;
const KNOWN_WORDS = [
  '\u672a\u6765', '\u611f\u60c5', '\u7c89\u96ea', '\u4e2d\u6bd2', '\u540d\u524d',
  '\u5927\u5207', '\u30ca\u30df\u30c0', '\u4e0a\u624b', '\u56f0\u3063\u3066', '\u305d\u308c\u3058\u3083', '\u3058\u3083', '\u3044\u3044\u3058\u3083\u3093'
];

function splitByKnownWords(part) {
  const units = [];
  let i = 0;
  while (i < part.length) {
    const hit = KNOWN_WORDS.find(word => part.startsWith(word, i));
    if (hit) {
      units.push(hit);
      i += hit.length;
      continue;
    }
    units.push(part[i]);
    i += 1;
  }
  return units;
}

function mergeSmallKana(units) {
  const merged = [];
  for (const unit of units) {
    if (merged.length && JAPANESE_SMALL_KANA_RE.test(unit)) merged[merged.length - 1] += unit;
    else merged.push(unit);
  }
  return merged;
}

function collapseKnownWordSequences(units) {
  const out = [];
  for (let i = 0; i < units.length; i += 1) {
    let best = null;
    let bestEnd = i;
    let acc = '';
    for (let j = i; j < Math.min(units.length, i + 6); j += 1) {
      acc += units[j];
      const hit = KNOWN_WORDS.find(word => word === acc);
      if (hit) { best = hit; bestEnd = j; }
    }
    if (best) {
      out.push(best);
      i = bestEnd;
    } else {
      out.push(units[i]);
    }
  }
  return out;
}

function splitLyricUnits(text) {
  if (!text) return [];
  if (CREDIT_LINE_RE.test(text)) return [text];

  let rawUnits = [];
  try {
    const Segmenter = Intl?.Segmenter;
    if (Segmenter) {
      const locale = /[\u3040-\u30ff]/u.test(text) ? 'ja-JP' : 'zh-CN';
      rawUnits = Array.from(new Segmenter(locale, { granularity: 'word' }).segment(text), seg => seg.segment).filter(Boolean);
    }
  } catch {}

  if (!rawUnits.length) rawUnits = splitGraphemes(text);

  const units = [];
  let pendingPrefix = '';
  for (const raw of rawUnits) {
    if (!raw) continue;
    if (LYRIC_PUNCT_RE.test(raw)) {
      if (units.length) units[units.length - 1] += raw;
      else pendingPrefix += raw;
      continue;
    }
    const parts = KNOWN_WORDS.some(word => raw.includes(word)) ? splitByKnownWords(raw) : [raw];
    for (const part of parts) {
      if (LYRIC_PUNCT_RE.test(part)) {
        if (units.length) units[units.length - 1] += part;
      } else {
        units.push(pendingPrefix + part);
        pendingPrefix = '';
      }
    }
  }
  if (pendingPrefix && units.length) units[units.length - 1] += pendingPrefix;
  return collapseKnownWordSequences(mergeSmallKana(units)).filter(Boolean);
}

/**
 * 离线测量文本中每个字素的 X 轴偏移量（相对于 0）
 * @returns {number[]} 偏移量数组，长度 = 字素数 + 1
 */
export function buildGraphemeOffsets(text, fontPx, fontStack, fontWeight = 600) {
  if (!text) return [0];
  const cacheKey = `${text}|${fontPx}|${fontWeight}|${fontStack}`;
  if (measurementsCache.has(cacheKey)) {
    return measurementsCache.get(cacheKey);
  }

  const ctx = getCanvasContext();
  const graphemes = splitGraphemes(text);
  const offsets = [0];

  if (ctx) {
    ctx.font = `${fontWeight} ${fontPx}px ${fontStack}`;
    let currentX = 0;
    for (let i = 0; i < graphemes.length; i++) {
      const g = graphemes[i];
      // measureText 取 width 最准
      const width = ctx.measureText(g).width;
      currentX += width;
      offsets.push(currentX);
    }
    measurementsCache.set(cacheKey, offsets);
    return offsets;
  }

  // Fallback 如果没有 Canvas 环境 (如 SSR)
  let currentX = 0;
  for (let i = 0; i < graphemes.length; i++) {
    currentX += fontPx * 0.6; // 粗略估算
    offsets.push(currentX);
  }
  measurementsCache.set(cacheKey, offsets);
  return offsets;
}

/**
 * 将 YRC 的 duration 均匀分配给词语内的每个字素
 */
export function buildWordGraphemeTimings(wordText, startTime, durationSec) {
  const graphemes = splitGraphemes(wordText);
  const timings = [];
  const timePerGrapheme = durationSec / Math.max(1, graphemes.length);
  
  let current = startTime;
  for (let i = 0; i < graphemes.length; i++) {
    timings.push({
      startTime: current,
      endTime: current + timePerGrapheme
    });
    current += timePerGrapheme;
  }
  return timings;
}

/**
 * 组装显示用 Token (DisplayToken)
 * 将 line.words 和夹杂的普通字符切分为 Token
 */
export function parseDisplayTokens(line) {
  if (!line || !line.text) return [];
  if (!line.words || line.words.length === 0) {
    const graphemes = splitGraphemes(line.text);
    const lineStart = Number(line.time || 0);
    const lineDuration = Math.max(0.4, Number(line.duration || 0) || 5);
    const unitDuration = lineDuration / Math.max(1, graphemes.length);
    let cursor = 0;
    return graphemes.map((text, index) => {
      const startTime = lineStart + index * unitDuration;
      const endTime = startTime + unitDuration;
      const startOffset = cursor;
      cursor += text.length;
      return {
        text,
        startTime,
        endTime,
        durationSec: unitDuration,
        key: `${line.time}-fallback-${index}-${startOffset}`,
        timed: true,
        startOffset,
        endOffset: cursor,
        wordIndex: index,
        graphemeIndex: 0,
        wordText: text,
        graphemeTimings: [{ startTime, endTime }]
      };
    });
  }

  const tokens = [];
  let currentIndex = 0;
  const fullText = line.text;

  for (let i = 0; i < line.words.length; i++) {
    const word = line.words[i];
    const wordStartOffset = fullText.indexOf(word.text, currentIndex);

    if (wordStartOffset > currentIndex) {
      const gapText = fullText.substring(currentIndex, wordStartOffset);
      tokens.push({
        text: gapText,
        startTime: -1,
        endTime: -1,
        key: `${line.time}-gap-${currentIndex}`,
        timed: false,
        startOffset: currentIndex,
        endOffset: wordStartOffset,
        wordIndex: -1,
        graphemeIndex: -1,
        graphemeTimings: []
      });
    }

    const resolvedWordStartOffset = wordStartOffset !== -1 ? wordStartOffset : currentIndex;
    const wordEndOffset = resolvedWordStartOffset + word.text.length;

    // Keep parser word boundaries as the visual animation unit, like folia.
    // The fill mask still uses graphemeTimings, so words can sweep internally,
    // while words such as "??" or mora such as "??" jump as one unit.
    const tokenDuration = word.durationSec || (word.endSec !== undefined ? (word.endSec - word.startSec) : 0.1);
    const tokenEndTime = word.endSec !== undefined ? word.endSec : (word.startSec + tokenDuration);
    const safeTokenDuration = Math.max(0.001, tokenDuration);
    const graphemeTimings = buildWordGraphemeTimings(word.text, word.startSec, safeTokenDuration);
    tokens.push({
      text: word.text,
      startTime: word.startSec,
      endTime: tokenEndTime,
      durationSec: safeTokenDuration,
      key: `${line.time}-word-${i}-${word.startSec}`,
      timed: true,
      startOffset: resolvedWordStartOffset,
      endOffset: wordEndOffset,
      wordIndex: i,
      graphemeIndex: -1,
      wordText: word.text,
      graphemeTimings
    });

    currentIndex = wordEndOffset;
  }

  if (currentIndex < fullText.length) {
    tokens.push({
      text: fullText.substring(currentIndex),
      startTime: -1,
      endTime: -1,
      key: `${line.time}-gap-tail`,
      timed: false,
      startOffset: currentIndex,
      endOffset: fullText.length,
      wordIndex: -1,
      graphemeIndex: -1,
      graphemeTimings: []
    });
  }

  return tokens;
}

/**
 * 测量行的排版尺寸，避免浏览器回流。
 * 纯英文较多时计算不准问题在这里通过 measureText + 实际宽度容差规避。
 */
export function measureLineLayout(line, fontPx, translationFontPx, fontStack, maxWidthPx, fontWeight = 600) {
  const linePaddingY = fontPx * 0.16 + fontPx * 0.34;
  const transPaddingY = translationFontPx * 0.45 + translationFontPx * 0.18;
  const lineLineHeight = fontPx * 1.18;
  const transLineHeight = translationFontPx * 1.28;

  // 如果没有具体文本，默认 1 行
  if (!line.text) {
    return {
      textLineCount: 1,
      visibleTextLineCount: 1,
      textHeightPx: lineLineHeight + linePaddingY,
      translationHeightPx: line.translation ? (transLineHeight + transPaddingY) : 0,
      visualHeightPx: (lineLineHeight + linePaddingY) + (line.translation ? transLineHeight + transPaddingY : 0),
      lineHeightPx: lineLineHeight,
      isTextClipped: false
    };
  }

  const ctx = getCanvasContext();
  let textLineCount = 1;
  let transLineCount = 1;

  if (ctx) {
    // 测主歌词
    ctx.font = `${fontWeight} ${fontPx}px ${fontStack}`;
    const mainWidth = ctx.measureText(line.text).width;
    textLineCount = Math.ceil(mainWidth / maxWidthPx);

    // 测翻译
    if (line.translation) {
      ctx.font = `500 ${translationFontPx}px ${fontStack}`;
      const transWidth = ctx.measureText(line.translation).width;
      transLineCount = Math.ceil(transWidth / maxWidthPx);
    }
  }

  // Monet 模式高度限制：主歌词最多 3 行，翻译最多 2 行。
  const visibleTextLineCount = Math.min(textLineCount, 3);
  const visibleTransLineCount = Math.min(transLineCount, 2);

  const textHeightPx = (visibleTextLineCount * lineLineHeight) + linePaddingY;
  const translationHeightPx = line.translation ? ((visibleTransLineCount * transLineHeight) + transPaddingY) : 0;
  
  return {
    textLineCount,
    visibleTextLineCount,
    textHeightPx,
    translationHeightPx,
    visualHeightPx: textHeightPx + translationHeightPx,
    lineHeightPx: lineLineHeight,
    isTextClipped: textLineCount > 3
  };
}

/**
 * 确定当前时间的行的状态
 */
export function resolveLineStatus(line, index, activeIndex, currentTime) {
  if (index === activeIndex) return 'active';
  // 对于开头没有歌词的地方（activeIndex === -1），如果时间已经超过了行，就是 passed
  if (index < activeIndex || currentTime > (line.time + (line.duration || 5))) return 'passed';
  return 'waiting';
}

/**
 * 提取滑动窗口渲染队列
 */
export function buildVisibleWindow(lines, activeIndex, currentTime, options = { before: 3, after: 3 }) {
  if (!lines || lines.length === 0) return [];

  let start = activeIndex - options.before;
  let end = activeIndex + options.after;

  // 处理边界
  if (activeIndex === -1) {
    start = 0;
    end = options.before + options.after;
  } else {
    // 保证至少渲染这么多个，如果贴近头部，多渲尾部
    if (start < 0) {
      end += Math.abs(start);
      start = 0;
    }
    if (end >= lines.length) {
      const overflow = end - lines.length + 1;
      start = Math.max(0, start - overflow);
      end = lines.length - 1;
    }
  }

  start = Math.max(0, start);
  end = Math.min(lines.length - 1, end);

  const windowEntries = [];
  for (let i = start; i <= end; i++) {
    const line = lines[i];
    windowEntries.push({
      key: `rail-${line.time}-${i}`,
      line,
      index: i,
      offset: i - Math.max(0, activeIndex), // offset=0 的视为核心活跃锚点
      status: resolveLineStatus(line, i, activeIndex, currentTime)
    });
  }

  return windowEntries;
}

/**
 * 计算单个 Token 内字素的高光填充跨度 (Fill Width)
 * 使用时间插值 (Linear Interpolation) 提供最丝滑的非均匀生长
 */
export function computeFillWidth(currentTime, startTime, endTime, graphemeTimings, graphemeOffsets) {
  if (currentTime <= startTime) return 0;
  
  const lastIdx = graphemeOffsets.length - 1;
  const fullWidth = graphemeOffsets[lastIdx];
  
  if (currentTime >= endTime) return fullWidth;

  for (let i = 0; i < graphemeTimings.length; i++) {
    const { startTime: gStart, endTime: gEnd } = graphemeTimings[i];
    
    if (currentTime < gStart) {
      return graphemeOffsets[i];
    }
    if (currentTime <= gEnd) {
      const progress = (currentTime - gStart) / (gEnd - gStart);
      return graphemeOffsets[i] + (graphemeOffsets[i + 1] - graphemeOffsets[i]) * progress;
    }
  }

  return fullWidth;
}
