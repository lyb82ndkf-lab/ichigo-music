const EAST_ASIAN_RE = /[\u3040-\u30ff\u3400-\u9fff]/u;
const JAPANESE_RE = /[\u3040-\u30ff]/u;
const KANJI_RE = /[\u3400-\u9fff]/u;
const KANA_RE = /[\u3040-\u30ff]/u;
const HANGUL_RE = /[\uac00-\ud7af]/u;
const PUNCTUATION_RE = /^[\s\p{P}\p{S}]+$/u;
const PARTICLE_RE = /^(?:\u306f|\u304c|\u3092|\u306b|\u3078|\u3068|\u3082|\u306e|\u3067|\u3084|\u306d|\u3088|\u306a|\u3055|\u304b|\u304b\u3089|\u307e\u3067|\u3088\u308a|\u3060\u3051|\u3057\u304b|\u3063\u3066|\u306e\u3067|\u306e\u306b|\u3066\u3082|\u3067\u3082)$/u;
const NOMINAL_SUFFIX_RE = /^(?:\u3053\u3068|\u3082\u306e|\u3068\u3053\u308d|\u305f\u3081|\u3088\u3046|\u3068\u304d|\u3072\u3068|\u4eba)$/u;
const SENTENCE_END_RE = /[\u3002\uff01\uff1f!?]$/u;
const OPEN_BRACKET_RE = /^[\u300c\u300e\uff08(\u3010\uff3b\[]$/u;
const CLOSE_BRACKET_RE = /^[\u300d\u300f\uff09)\u3011\uff3d\]]$/u;
const LATIN_WORD_CHAR_RE = /[\p{Script=Latin}\p{N}]/u;
const COMBINING_MARK_RE = /^\p{M}$/u;
const INTERNAL_WORD_PUNCTUATION_RE = /^[.'’'_-]$/u;

const segmenters = new Map();

function getSegmenter(locale) {
  if (typeof Intl === 'undefined' || typeof Intl.Segmenter !== 'function') return null;
  if (!segmenters.has(locale)) segmenters.set(locale, new Intl.Segmenter(locale, { granularity: 'word' }));
  return segmenters.get(locale);
}

function graphemeLength(value) {
  return Array.from(String(value || '')).length;
}

function splitGraphemeUnits(value) {
  const text = String(value || '');
  if (typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function') {
    const segmenter = new Intl.Segmenter('und', { granularity: 'grapheme' });
    return Array.from(segmenter.segment(text), item => String(item.segment));
  }
  return Array.from(text);
}

function isLatinWordUnit(value) {
  const unit = String(value || '');
  return LATIN_WORD_CHAR_RE.test(unit) || COMBINING_MARK_RE.test(unit);
}

function isWordLikeUnit(value) {
  const unit = String(value || '');
  return isLatinWordUnit(unit) || HANGUL_RE.test(unit);
}

function isOpeningPunctuation(value) {
  return /^[\u300c\u300e\uff08(\u3010\uff3b\[]$/u.test(String(value || ''));
}

function isClosingPunctuation(value) {
  return /^[\u300d\u300f\uff09)\u3011\uff3d\]]$/u.test(String(value || ''));
}

// Tokenisation for the PV foreground is script-aware rather than blindly
// grapheme-aware. Latin runs stay readable as words (`hello world` becomes
// `hello ` + `world`), while CJK/Kana/Hangul keep their character-level
// rhythm. Punctuation and brackets stay attached to their neighbouring unit,
// so mixed lines do not produce isolated punctuation cards.
export function segmentMixedTokens(text) {
  const units = splitGraphemeUnits(text);
  const result = [];
  let latin = '';
  let hangul = '';
  let pendingPrefix = '';

  const flushLatin = () => {
    if (!latin) return;
    result.push({ text: `${pendingPrefix}${latin}`, kind: 'word' });
    latin = '';
    pendingPrefix = '';
  };

  const flushHangul = () => {
    if (!hangul) return;
    result.push({ text: `${pendingPrefix}${hangul}`, kind: 'word' });
    hangul = '';
    pendingPrefix = '';
  };

  units.forEach((unit, index) => {
    if (!unit) return;
    if (/^\s+$/u.test(unit)) {
      if (latin) flushLatin();
      if (hangul) flushHangul();
      if (result.length) result[result.length - 1].text += unit;
      else pendingPrefix += unit;
      return;
    }

    if (isLatinWordUnit(unit)) {
      if (hangul) flushHangul();
      latin += unit;
      return;
    }

    // Keep a spaced Korean word together, while unspaced CJK/Kana remains
    // character-level for the intended lyric rhythm.
    if (HANGUL_RE.test(unit)) {
      if (latin) flushLatin();
      hangul += unit;
      return;
    }

    // Apostrophes and hyphens inside a Latin word belong to that word only
    // when another Latin/number unit follows them.
    if (INTERNAL_WORD_PUNCTUATION_RE.test(unit) && latin && isLatinWordUnit(units[index + 1])) {
      latin += unit;
      return;
    }

    if (isOpeningPunctuation(unit)) {
      if (latin) flushLatin();
      if (hangul) flushHangul();
      pendingPrefix += unit;
      return;
    }

    if (isClosingPunctuation(unit) || /^[\p{P}\p{S}]$/u.test(unit)) {
      if (latin) flushLatin();
      if (hangul) flushHangul();
      if (result.length && isWordLikeUnit(result[result.length - 1].text.at(-1))) result[result.length - 1].text += unit;
      else pendingPrefix += unit;
      return;
    }

    if (latin) flushLatin();
    if (hangul) flushHangul();
    result.push({ text: `${pendingPrefix}${unit}`, kind: 'grapheme' });
    pendingPrefix = '';
  });

  flushLatin();
  flushHangul();
  if (pendingPrefix) {
    if (result.length) result[result.length - 1].text += pendingPrefix;
    else result.push({ text: pendingPrefix, kind: 'punctuation' });
  }
  return result.filter(token => token.text.length > 0);
}

// Providers disagree about what a "word" is. Some return `hello` as one
// timed unit, while others return `h`, `e`, `l`, `l`, `o`. Rebuild the visual
// units from the original lyric text and project the provider timings onto
// them, so Latin words stay together without losing CJK character timing.
export function mergeTimedMixedTokens(lineText, timedUnits = [], fallbackStart = 0, fallbackEnd = 1) {
  const sourceUnits = segmentMixedTokens(lineText).filter(unit => unit.text.length > 0);
  const spread = () => sourceUnits.map((unit, index) => ({
    ...unit,
    start: fallbackStart + ((fallbackEnd - fallbackStart) * index) / sourceUnits.length,
    end: fallbackStart + ((fallbackEnd - fallbackStart) * (index + 1)) / sourceUnits.length
  }));
  if (!sourceUnits.length) return [];
  if (!timedUnits.length) return spread();

  const timedPoints = [];
  timedUnits.forEach((unit) => {
    const points = Array.from(String(unit.text || ''));
    points.filter(point => !/\s/u.test(point)).forEach(point => timedPoints.push({
      point,
      start: Number.isFinite(Number(unit.start)) ? Number(unit.start) : fallbackStart,
      end: Number.isFinite(Number(unit.end)) ? Number(unit.end) : fallbackEnd
    }));
  });

  const sourceText = Array.from(sourceUnits.map(unit => unit.text).join('')).filter(point => !/\s/u.test(point)).join('');
  const timedText = timedPoints.map(item => item.point).join('');
  if (sourceText !== timedText) return spread();

  let cursor = 0;
  return sourceUnits.map((unit, index) => {
    const length = Array.from(unit.text).filter(point => !/\s/u.test(point)).length;
    const range = timedPoints.slice(cursor, cursor + length);
    cursor += length;
    const start = range.length ? Math.min(...range.map(item => item.start)) : fallbackStart + ((fallbackEnd - fallbackStart) * index) / sourceUnits.length;
    const end = range.length ? Math.max(...range.map(item => item.end)) : start + Math.max(0.016, (fallbackEnd - fallbackStart) / sourceUnits.length);
    return { ...unit, start, end: Math.max(start + 0.016, end) };
  });
}

function fallbackPhraseChunks(value) {
  const units = Array.from(String(value || '')).filter(unit => unit.trim());
  const chunks = [];
  for (let index = 0; index < units.length; index += 4) chunks.push(units.slice(index, index + 4).join(''));
  return chunks;
}

function lastGrapheme(value) {
  return Array.from(String(value || '')).at(-1) || '';
}

function isKana(value) {
  return KANA_RE.test(String(value || ''));
}

function isKanji(value) {
  return KANJI_RE.test(String(value || ''));
}

function isOpeningBracket(value) {
  return OPEN_BRACKET_RE.test(String(value || ''));
}

function isClosingBracket(value) {
  return CLOSE_BRACKET_RE.test(String(value || ''));
}

function mergeJapaneseSegments(raw) {
  const chunks = [];
  let current = '';
  let previous = '';
  let bracketDepth = 0;
  let justClosedBracket = false;

  const flush = () => {
    if (current) chunks.push(current);
    current = '';
    previous = '';
    justClosedBracket = false;
  };

  raw.forEach((part) => {
    if (!part) return;
    const first = Array.from(part)[0] || '';
    const last = lastGrapheme(part);

    if (isOpeningBracket(part)) {
      current += part;
      bracketDepth += 1;
      previous = part;
      return;
    }

    if (bracketDepth > 0) {
      current += part;
      if (isOpeningBracket(part)) bracketDepth += 1;
      if (isClosingBracket(part)) {
        bracketDepth = Math.max(0, bracketDepth - 1);
        if (bracketDepth === 0) justClosedBracket = true;
      }
      previous = part;
      return;
    }

    if (PUNCTUATION_RE.test(part)) {
      current += part;
      if (SENTENCE_END_RE.test(last) || isClosingBracket(part)) flush();
      else previous = part;
      return;
    }

    const previousLast = lastGrapheme(previous || current);
    const followsSokuon = /[\u3063\uff6f]$/u.test(previousLast);
    const followsKana = isKana(previousLast);
    const startsKana = isKana(first);
    const particle = PARTICLE_RE.test(part);
    const nominalSuffix = NOMINAL_SUFFIX_RE.test(part);
    const continuesVerb = startsKana && (isKanji(previousLast) || followsSokuon || followsKana);
    const followsBracket = justClosedBracket && particle;
    const currentSize = graphemeLength(current);
    const partSize = graphemeLength(part);

    // Keep nominal endings with the predicate they complete. This avoids
    // false cuts such as `分かった / こと` and `怒らせちゃう / こと`, while
    // still allowing the next lexical unit to start cleanly.
    if (current && nominalSuffix && currentSize >= 2) {
      current += part;
      previous = part;
      justClosedBracket = false;
      if (SENTENCE_END_RE.test(last)) flush();
      return;
    }
    if (current && !followsBracket && !particle && !nominalSuffix && !continuesVerb && currentSize >= 3) flush();
    if (current && currentSize + partSize > 8 && !particle && !continuesVerb) flush();

    current += part;
    previous = part;
    justClosedBracket = false;

    if (SENTENCE_END_RE.test(last)) flush();
  });

  flush();
  return chunks;
}

export function segmentLyricPhrase(text, localeHint = '') {
  const value = String(text || '').trim();
  if (!value) return [];
  if (graphemeLength(value) <= 7) return [value];

  const locale = JAPANESE_RE.test(value) || localeHint === 'ja' ? 'ja' : 'zh';
  const segmenter = getSegmenter(locale);
  if (!segmenter) return fallbackPhraseChunks(value);

  const raw = Array.from(segmenter.segment(value), item => String(item.segment));
  const chunks = locale === 'ja' ? mergeJapaneseSegments(raw) : raw.reduce((result, part) => {
    if (!result.length) result.push(part);
    else if (PUNCTUATION_RE.test(part) && part.trim()) result.push(part);
    else if (graphemeLength(result.at(-1) || '') >= 7 && part.trim()) result.push(part);
    else result[result.length - 1] = result.at(-1) + part;
    return result;
  }, []);
  return chunks.length ? chunks : [value];
}

export function isEastAsianText(value) {
  return EAST_ASIAN_RE.test(String(value || ''));
}
