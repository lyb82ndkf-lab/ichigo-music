import { segmentLyricPhrase, segmentMixedTokens } from './ktvText.js';

const THEME_GLUE_RE = /^(?:\u306f|\u304c|\u3092|\u306b|\u3078|\u3068|\u3082|\u306e|\u3067|\u3084|\u306d|\u3088|\u306a|\u3055|\u304b|\u304b\u3089|\u307e\u3067|\u3060\u3051|\u3057\u304b|\u3063\u3066|\u306e\u3067|\u306e\u306b|\u3066\u3082|\u3067\u3082)$/u;
const THEME_JP_STOP_RE = /^(?:\u79c1|\u50d5|\u4ffa|\u3042\u306a\u305f|\u541b|\u8ab0\u304b|\u3053\u308c|\u305d\u308c|\u3042\u308c|\u3053\u3053|\u305d\u3053|\u3082\u306e|\u3053\u3068|\u305f\u3081|\u3088\u3046|\u305d\u3046)$/u;
const THEME_BRACKET_RE = /[\u300c\u300e\uff08(\u3010\[]([^\u300d\u300f\uff09)\u3011\]]+)[\u300d\u300f\uff09)\u3011\]]/gu;
const THEME_LATIN_STOP_RE = /^(?:a|an|and|are|as|at|be|but|by|for|from|i|if|in|is|it|me|my|of|on|or|our|so|that|the|their|this|to|up|was|we|with|you|your)$/iu;
const THEME_HANGUL_STOP_RE = /^(?:\uC740|\uB294|\uC774|\uAC00|\uC744|\uB97C|\uC5D0|\uC758|\uB3C4|\uC640|\uACFC|\uB85C|\uC73C\uB85C|\uC5D0\uC11C|\uC5D0\uAC8C|\uADF8\uB9AC\uACE0|\uADF8|\uC800|\uB098|\uB108|\uC6B0\uB9AC|\uAC83|\uC218|\uB354|\uC548|\uBABB|\uC788|\uC5C6)$/u;

function cleanThemeFragment(value, { preserveEnding = false, lexical = false } = {}) {
  const normalized = String(value || '')
    .replace(/[\u300c\u300d\u300e\u300f\uff08\uff09()\u3010\u3011[\]]/gu, '')
    .replace(/^[\s\p{P}\p{S}]+|[\s\p{P}\p{S}]+$/gu, '')
    .replace(/[\s]+/gu, ' ')
    .trim();
  if (preserveEnding) return normalized;
  if (lexical) {
    return normalized
      // Keep a lexical unit such as 大人になって intact, but remove the
      // grammatical tail that would make a background label feel unfinished.
      .replace(/(?<!\u306e)(?:\u3053\u3068|\u3082\u306e|\u3068\u3053\u308d|\u305f\u3081|\u3088\u3046)$/u, '')
      .replace(/(?:\u304b\u3089|\u307e\u3067|\u3060\u3051|\u3057\u304b|\u306e\u3067|\u306e\u306b|\u3066\u3082|\u3067\u3082|\u306e|\u3092|\u306b|\u3078|\u3068|\u3082|\u306f|\u304c|\u3067|\u3084|\u306d|\u3088|\u306a|\u3055|\u304b)$/u, '')
      .trim();
  }
  let result = normalized;
  for (let pass = 0; pass < 3; pass += 1) {
    const next = result
      .replace(/(?:\u3053\u3068|\u3082\u306e|\u3068\u3053\u308d|\u305f\u3081)$/u, '')
      .replace(/(?:\u304b\u3089|\u307e\u3067|\u3060\u3051|\u3057\u304b|\u3063\u3066|\u306e\u3067|\u306e\u306b|\u3066\u3082|\u3067\u3082|\u306e|\u3092|\u306b|\u3078|\u3068|\u3082|\u306f|\u304c|\u3067|\u3084|\u306d|\u3088|\u306a|\u3055|\u304b)$/u, '');
    if (next === result || next.length < 2) break;
    result = next.trim();
  }
  return result;
}

function pushThemeCandidate(list, value, index, bonus = 0, kind = 'phrase', allowStop = false) {
  const text = cleanThemeFragment(value, { preserveEnding: kind === 'bracket' || kind === 'context', lexical: kind === 'lexicalPhrase' });
  if (!text || THEME_GLUE_RE.test(text)) return;
  const compact = text.replace(/\s+/gu, '');
  const stopWord = THEME_LATIN_STOP_RE.test(compact) || THEME_HANGUL_STOP_RE.test(compact) || THEME_JP_STOP_RE.test(compact);
  if (stopWord && !allowStop) return;
  const eastAsian = /[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/u.test(compact);
  const latin = /[A-Za-z0-9]/u.test(compact);
  const minimumLength = kind === 'lexeme' ? 1 : latin ? 2 : eastAsian ? 2 : 1;
  if (compact.length < minimumLength) return;
  const score = bonus
    + (latin ? Math.min(8, compact.length) : Math.min(7, compact.length * 1.15))
    + (/[\u3400-\u9fff]/u.test(compact) ? 2.2 : 0)
    + (/[\u3400-\u9fff]/u.test(compact) && compact.length >= 3 ? 1.1 : 0)
    + (/[A-Z]/u.test(compact) ? 0.35 : 0);
  list.push({ text, index, score, compact, kind, stopWord, sourceLength: compact.length });
}

const kindPriority = { bracket: 6, lexicalPhrase: 5, lexeme: 4, latin: 3, hangul: 3, phrase: 1, context: 0 };

function compareCandidates(a, b) {
  return (kindPriority[b.kind] || 0) - (kindPriority[a.kind] || 0)
    || b.score - a.score
    || a.index - b.index;
}

export function resolveLyricTheme(text = '', tokens = []) {
  const source = String(text || '').trim() || tokens.map(token => token?.text || '').join('');
  const candidates = [];
  const hasSemanticPhrase = /[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/u.test(source);
  for (const match of source.matchAll(THEME_BRACKET_RE)) pushThemeCandidate(candidates, match[1], match.index ?? 0, 5, 'bracket');
  for (const match of source.matchAll(/[A-Za-z0-9]+(?:['\u2019_-][A-Za-z0-9]+)*/gu)) pushThemeCandidate(candidates, match[0], match.index ?? 0, 0, 'latin');
  for (const match of source.matchAll(/[\uac00-\ud7af]+/gu)) pushThemeCandidate(candidates, match[0], match.index ?? 0, 1.5, 'hangul');
  for (const match of source.matchAll(/[\u3400-\u9fff]{2,}/gu)) {
    if (/[\u3040-\u30ff]/u.test(source)) pushThemeCandidate(candidates, match[0], match.index ?? 0, 6.5, 'lexeme');
  }

  const phraseLocale = /[\u3040-\u30ff]/u.test(source) ? 'ja' : /[\u3400-\u9fff]/u.test(source) ? 'zh' : '';
  if (phraseLocale) {
    pushThemeCandidate(candidates, source, 0, 0.5, 'context', true);
    let searchFrom = 0;
    segmentLyricPhrase(source, phraseLocale).forEach((piece) => {
      const offset = source.indexOf(piece, searchFrom);
      const pieceOffset = offset >= 0 ? offset : searchFrom;
      // A CJK phrase segment can contain a Latin run; split that boundary so
      // `你好 hello world` produces three intentional candidates instead of
      // one hybrid label that is hard to place typographically.
      const mixedParts = phraseLocale === 'zh'
        ? piece.match(/(?:[\u3400-\u9fff\u3040-\u30ff]+|[A-Za-z0-9]+(?:['\u2019_-][A-Za-z0-9]+)*|\s+|[^\s])/gu) || [piece]
        : [piece];
      let partOffset = pieceOffset;
      mixedParts.forEach((part) => {
        const partIsSpace = /^\s+$/u.test(part);
        if (!partIsSpace) {
          const partKind = /[A-Za-z0-9]/u.test(part) ? 'latin' : 'lexicalPhrase';
          pushThemeCandidate(candidates, part, partOffset, partKind === 'latin' ? 2.2 : 2.2, partKind);
        }
        partOffset += part.length;
      });
      searchFrom = Math.max(searchFrom, (offset >= 0 ? offset : searchFrom) + piece.length);
    });
  }
  if (!phraseLocale) {
    const words = source.match(/[A-Za-z0-9]+(?:['\u2019_-][A-Za-z0-9]+)*/gu) || [];
    const firstWordIndex = source.search(/[A-Za-z0-9]/u);
    if (words.length > 1) {
      // Latin and mixed-script lines still need a semantic caption. Keeping
      // the complete phrase in its own lane prevents `hello/world` from
      // becoming a meaningless pile of isolated background letters.
      // Preserve a Hangul/CJK prefix in mixed lines; otherwise the caption
      // loses the original script before the theme layer is rendered.
      const contextSource = /[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/u.test(source)
        ? source
        : source.slice(Math.max(0, firstWordIndex));
      pushThemeCandidate(candidates, contextSource, contextSource === source ? 0 : firstWordIndex, 0.2, 'context', true);
    }
  }

  const unique = [];
  const seen = new Set();
  candidates.sort(compareCandidates).forEach(candidate => {
    const key = candidate.compact.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    unique.push(candidate);
  });

  const firstLatin = unique.find(candidate => candidate.kind === 'latin' && !candidate.stopWord);
  const firstHangul = unique.find(candidate => candidate.kind === 'hangul' && !candidate.stopWord);
  const mixedLeadingHero = !phraseLocale && firstHangul && firstLatin && firstHangul.index < firstLatin.index
    ? firstHangul
    : null;
  const hero = unique.find(candidate => candidate.kind === 'bracket' && !candidate.stopWord)
    || unique.find(candidate => candidate.kind === 'lexicalPhrase' && candidate.compact.length >= 2 && !candidate.stopWord)
    || unique.find(candidate => candidate.kind === 'lexeme' && !candidate.stopWord)
    || mixedLeadingHero
    || unique.find(candidate => (candidate.kind === 'latin' || candidate.kind === 'hangul') && !candidate.stopWord)
    || unique[0];
  const support = unique.filter((candidate) => {
    if (candidate === hero || candidate.compact === hero?.compact) return false;
    // Do not paint the same lexical material again as a smaller fragment:
    // `怒らせちゃう` + `怒らせ` creates visual noise without adding meaning.
    const heroKey = hero?.compact || '';
    return !(heroKey.length > 1 && (heroKey.includes(candidate.compact) || candidate.compact.includes(heroKey)))
      && !candidate.stopWord;
  });
  const contextCandidate = unique.find(candidate => candidate.kind === 'context' && candidate.compact.length > 1);
  const contextUnits = contextCandidate?.text
    ? (phraseLocale
      ? segmentLyricPhrase(contextCandidate.text, phraseLocale).map(piece => cleanThemeFragment(piece, { lexical: true }) || piece).filter(Boolean)
      : segmentMixedTokens(contextCandidate.text).map(piece => cleanThemeFragment(piece.text, { preserveEnding: true })).filter(Boolean))
    : [];
  const semanticUnits = [];
  const semanticSeen = new Set();
  contextUnits.forEach((unit) => {
    const textUnit = cleanThemeFragment(unit, { preserveEnding: true });
    const compact = textUnit.replace(/\s+/gu, '');
    const isStop = THEME_GLUE_RE.test(compact)
      || THEME_LATIN_STOP_RE.test(compact)
      || THEME_HANGUL_STOP_RE.test(compact)
      || THEME_JP_STOP_RE.test(compact);
    if (!textUnit || compact.length < 2 || isStop) return;
    const key = compact.toLowerCase();
    if (semanticSeen.has(key)) return;
    semanticSeen.add(key);
    semanticUnits.push(textUnit);
  });
  const contextSupport = semanticUnits.find(unit => {
    const key = unit.replace(/\s+/gu, '').toLowerCase();
    const heroKey = (hero?.compact || '').toLowerCase();
    return key.length > 1 && key !== heroKey && !heroKey.includes(key) && !key.includes(heroKey);
  }) || contextUnits.find(unit => {
    const key = unit.replace(/\s+/gu, '').toLowerCase();
    const heroKey = (hero?.compact || '').toLowerCase();
    return key.length > 1 && key !== heroKey && !heroKey.includes(key) && !key.includes(heroKey);
  }) || '';
  const fallback = cleanThemeFragment(source) || 'LYRIC';
  const primary = hero?.text || fallback;
  const secondary = support[0]?.text || contextSupport;
  const tertiary = support.find(candidate => candidate.compact !== secondary.replace(/\s+/gu, '') && candidate.compact !== primary.replace(/\s+/gu, ''))?.text || '';
  const reservedKeys = new Set([primary, secondary, tertiary].filter(Boolean).map(value => value.replace(/\s+/gu, '').toLowerCase()));
  const decorUnits = [...semanticUnits, secondary, tertiary]
    .map(value => cleanThemeFragment(value, { preserveEnding: true }))
    .filter(Boolean)
    .filter((value, unitIndex, list) => {
      const key = value.replace(/\s+/gu, '').toLowerCase();
      return key.length > 1 && !reservedKeys.has(key)
        && list.findIndex(item => item.replace(/\s+/gu, '').toLowerCase() === key) === unitIndex;
    })
    .slice(0, 6);
  const ghost = decorUnits.find(value => value.replace(/\s+/gu, '').length >= 2) || '';
  const echoUnits = [...[secondary, tertiary], ...semanticUnits]
    .map(value => cleanThemeFragment(value, { preserveEnding: true }))
    .filter(Boolean)
    .filter((value, unitIndex, list) => {
      const key = value.replace(/\s+/gu, '').toLowerCase();
      return key.length > 1
        && key !== primary.replace(/\s+/gu, '').toLowerCase()
        && list.findIndex(item => item.replace(/\s+/gu, '').toLowerCase() === key) === unitIndex;
    })
    .slice(0, 6);
  const context = unique.find(candidate => candidate.kind === 'context'
    && candidate.compact.length > Math.max(primary.replace(/\s+/gu, '').length, 4))?.text || '';
  const hasKana = /[\u3040-\u30ff]/u.test(source);
  const hasHangul = /[\uac00-\ud7af]/u.test(source);
  const hasCjk = /[\u3400-\u9fff]/u.test(source);
  const hasLatin = /[A-Za-z]/u.test(source);
  const scriptCount = [hasKana, hasHangul, hasCjk && !hasKana, hasLatin].filter(Boolean).length;
  const script = scriptCount > 1 ? 'mixed' : hasKana ? 'jp' : hasHangul ? 'ko' : hasCjk ? 'cjk' : hasLatin ? 'latin' : 'mixed';
  return { primary, secondary, tertiary, hero: primary, ghost, context, units: echoUnits, echoes: echoUnits, script, length: [primary, secondary, tertiary].join('').length };
}
