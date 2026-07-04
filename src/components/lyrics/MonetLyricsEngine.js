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

  // 如果没有 YRC 的 words，降级为单字符 Token 模式（即 LRC）
  // LRC / non-word-synced lines: keep one timed token for the whole line.
  // Splitting fallback lines into one component per grapheme creates dozens of
  // rAF subscribers and mask layers per line; folia-major keeps this path at
  // line-token granularity and only uses grapheme timings inside that token.
  if (!line.isYrc || !line.words || line.words.length === 0) {
    const graphemes = splitGraphemes(line.text);
    const lineDuration = Math.max(0.4, line.duration || 5);
    const sweepDuration = Math.min(lineDuration, Math.max(2, graphemes.length * 0.18 + 0.5));
    const timePerGrapheme = sweepDuration / Math.max(1, graphemes.length);
    const graphemeTimings = graphemes.map((_, idx) => {
      const gStart = line.time + idx * timePerGrapheme;
      return {
        startTime: gStart,
        endTime: gStart + timePerGrapheme
      };
    });

    return [{
      text: line.text,
      startTime: line.time,
      endTime: line.time + sweepDuration,
      key: `${line.time}-fallback-full`,
      timed: true,
      startOffset: 0,
      endOffset: line.text.length,
      graphemeTimings
    }];
  }

  const tokens = [];
  let currentIndex = 0;
  const fullText = line.text;

  for (let i = 0; i < line.words.length; i++) {
    const word = line.words[i];
    // 寻找该 word 在 fullText 中的起止位置
    const wordStartOffset = fullText.indexOf(word.text, currentIndex);
    
    if (wordStartOffset > currentIndex) {
      // 存在中间空格或标点，需要补充为 timed: false 的静态 Token
      const gapText = fullText.substring(currentIndex, wordStartOffset);
      tokens.push({
        text: gapText,
        startTime: -1,
        endTime: -1,
        key: `${line.time}-gap-${currentIndex}`,
        timed: false,
        startOffset: currentIndex,
        endOffset: wordStartOffset,
        graphemeTimings: []
      });
    }

    const wordEndOffset = wordStartOffset !== -1 
      ? wordStartOffset + word.text.length 
      : currentIndex + word.text.length;

    tokens.push({
      text: word.text,
      startTime: word.startSec,
      endTime: word.endSec,
      durationSec: word.durationSec,
      key: `${line.time}-word-${i}`,
      timed: true,
      startOffset: wordStartOffset !== -1 ? wordStartOffset : currentIndex,
      endOffset: wordEndOffset,
      graphemeTimings: buildWordGraphemeTimings(word.text, word.startSec, word.durationSec)
    });

    currentIndex = wordEndOffset;
  }

  // 尾部多余字符
  if (currentIndex < fullText.length) {
    tokens.push({
      text: fullText.substring(currentIndex),
      startTime: -1,
      endTime: -1,
      key: `${line.time}-gap-tail`,
      timed: false,
      startOffset: currentIndex,
      endOffset: fullText.length,
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
