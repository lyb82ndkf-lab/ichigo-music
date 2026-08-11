import React, { useEffect, useMemo, useRef, useState } from 'react';
import { splitGraphemes } from './MonetLyricsEngine';
import { subscribeLyricClock } from '../../utils/lyricClock';

const SCENES = ['poster', 'split', 'stack', 'impact', 'orbit'];
const PV_ACTS = ['intro', 'rise', 'peak', 'outro'];
const PV_PREVIEW_LYRICS = [
  { id: 'pv-preview-0', time: 0, duration: 3.2, text: '文字会呼吸', translation: 'WORDS BREATHE WITH THE BEAT' },
  { id: 'pv-preview-1', time: 3.2, duration: 3.5, text: '切开夜色', translation: 'CUT THROUGH THE NIGHT' },
  { id: 'pv-preview-2', time: 6.7, duration: 3.4, text: '让光落下', translation: 'LET THE LIGHT FALL' },
  { id: 'pv-preview-3', time: 10.1, duration: 3.7, text: '声场正在旋转', translation: 'THE SOUND FIELD TURNS' },
  { id: 'pv-preview-4', time: 13.8, duration: 4.1, text: '这是你的 PV', translation: 'THIS IS YOUR PV' }
];
const AUTO_CHOREOGRAPHIES = [
  ['poster', 'split', 'impact', 'orbit', 'stack'],
  ['poster', 'stack', 'orbit', 'split', 'impact'],
  ['poster', 'orbit', 'split', 'stack', 'impact'],
  ['poster', 'impact', 'split', 'orbit', 'stack'],
  ['poster', 'stack', 'impact', 'split', 'orbit']
];
const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));

// The low-frequency lyric engine index can be one frame behind the media
// clock (especially during a seek or when a line has a very short duration).
// KTV uses a second, visual index derived from the same clock so the line that
// is actually being heard never remains in the bottom "NEXT LINE" slot.
function resolveVisualActiveIndex(lines = [], currentTime = 0, fallback = -1) {
  if (!lines.length) return -1;
  const time = Number.isFinite(Number(currentTime)) ? Number(currentTime) : 0;
  let resolved = -1;
  for (let index = 0; index < lines.length; index += 1) {
    if (Number(lines[index]?.time) <= time + 0.035) resolved = index;
    else break;
  }
  if (resolved >= 0) return resolved;
  return fallback >= 0 && fallback < lines.length ? fallback : 0;
}

function resolveSongAct(index, total) {
  if (total <= 1) return 'intro';
  const progress = index / Math.max(1, total - 1);
  if (progress < 0.16) return 'intro';
  if (progress < 0.52) return 'rise';
  if (progress < 0.83) return 'peak';
  return 'outro';
}

function resolveRenderQuality(config = {}) {
  const requested = config.ktvRenderQuality || 'auto';
  if (requested === 'rich' || requested === 'balanced' || requested === 'efficient') return requested;
  const memory = typeof navigator === 'undefined' ? 0 : Number(navigator.deviceMemory || 0);
  const cores = typeof navigator === 'undefined' ? 0 : Number(navigator.hardwareConcurrency || 0);
  // Desktop machines retain the full stage by default. Only clear low-end
  // signals enter the efficient path, so Auto does not flatten the PV.
  if ((memory > 0 && memory <= 4) || (cores > 0 && cores <= 4)) return 'efficient';
  return 'rich';
}

// These are deliberately opinionated rather than a pile of low-level knobs.
// A text PV needs a coherent art direction across an entire song, so each
// preset owns its palette, typography treatment and overlay language.
const PV_PRESETS = {
  'blue-impact': { label: '蓝色冲击', accent: '#7fd8ff' },
  'kinetic-split': { label: '斩击构成', accent: '#ff5f80' },
  'blue-structure': { label: '蓝色构成', accent: '#4e82ff' },
  'cyber-grunge': { label: '赛博废墟', accent: '#ff4040' },
  geometric: { label: '几何', accent: '#ffd16d' },
  matrix: { label: '黑客帝国', accent: '#57ff9a' },
  'night-city': { label: '夜城监视', accent: '#7cffc8' },
  'emotion-cinema': { label: '情绪电影', accent: '#e6bc8e' },
  'hysteric-night': { label: '歇斯底里', accent: '#ff35c6' },
  'spider-web': { label: '蛛网', accent: '#ff334d' },
  'staggered-text': { label: '错落文字', accent: '#96baff' },
  'calm-villain': { label: '冷静的反派', accent: '#376eff' },
  'girly-clouds': { label: '少女云朵', accent: '#ff9bcb' },
  'sweet-pink': { label: '格子花边', accent: '#ff75b5' },
  'fly-me-to-the-moon': { label: 'Fly Me to the Moon', accent: '#f5de95' },
  'kawaii-pixel': { label: 'Kawaii 像素', accent: '#b9f7ff' },
  'crime-scene': { label: '案发现场', accent: '#ffcd38' },
  haruhikage: { label: '春日影', accent: '#c8e7ff' },
  custom: { label: 'Custom 自定义', accent: '#d9d9ff' },
  // Kept as an internal legacy option for profiles created before the catalog.
  p5: { label: 'P5 赤（旧）', accent: '#ff3c2f' },
  'paper-cut': { label: '剪纸海报（旧）', accent: '#ff784b' }
};

const PRESET_TEXT_EFFECTS = {
  'blue-impact': 'scatter',
  'kinetic-split': 'slash',
  'blue-structure': 'cards',
  'cyber-grunge': 'cards',
  geometric: 'orbit',
  matrix: 'typewriter',
  'night-city': 'terminal',
  'emotion-cinema': 'fade',
  'hysteric-night': 'shatter',
  'spider-web': 'scatter',
  'staggered-text': 'stagger',
  'calm-villain': 'slide',
  'girly-clouds': 'wave',
  'sweet-pink': 'cards',
  'fly-me-to-the-moon': 'float',
  'kawaii-pixel': 'pixel',
  'crime-scene': 'stamp',
  haruhikage: 'petal',
  custom: 'slice',
  p5: 'glitch',
  'paper-cut': 'slash'
};

// Text PVs are compositions, not just one lyric row with a different colour.
// The four card/scatter/outline/terminal arrangements below are the structural
// language behind the template catalogue.
const PRESET_LAYOUTS = {
  'blue-impact': 'impact-scatter',
  'kinetic-split': 'split-hero',
  'blue-structure': 'blue-cards',
  'cyber-grunge': 'grunge-cards',
  geometric: 'orbit-board',
  matrix: 'terminal-board',
  'night-city': 'terminal-board',
  'emotion-cinema': 'cinema-hero',
  'hysteric-night': 'impact-scatter',
  'spider-web': 'orbit-board',
  'staggered-text': 'stagger-board',
  'calm-villain': 'split-hero',
  'girly-clouds': 'cinema-hero',
  'sweet-pink': 'outline-hero',
  'fly-me-to-the-moon': 'cinema-hero',
  'kawaii-pixel': 'blue-cards',
  'crime-scene': 'grunge-cards',
  haruhikage: 'outline-hero',
  custom: 'cinema-hero',
  p5: 'impact-scatter',
  'paper-cut': 'impact-scatter'
};

const PRESET_LINE_OPACITY = {
  'blue-impact': 0.62,
  'kinetic-split': 0.5,
  'blue-structure': 0.5,
  'cyber-grunge': 0.72,
  geometric: 0.66,
  matrix: 0.75,
  'night-city': 0.55,
  'emotion-cinema': 0.26,
  'hysteric-night': 0.8,
  'spider-web': 0.6,
  'staggered-text': 0.54,
  'calm-villain': 0.52,
  'girly-clouds': 0.48,
  'sweet-pink': 0.5,
  'fly-me-to-the-moon': 0.38,
  'kawaii-pixel': 0.58,
  'crime-scene': 0.68,
  haruhikage: 0.45,
  custom: 0.44,
  p5: 0.74,
  'paper-cut': 0.62
};

const CARD_BOARD_PRESETS = new Set(['blue-structure', 'cyber-grunge', 'kawaii-pixel', 'crime-scene']);

function getLineRhythm(line, tokens = []) {
  const visible = tokens.filter(token => String(token?.text || '').trim());
  const compactText = String(line?.text || '').replace(/\s+/g, '');
  const duration = Math.max(0.1, Number(line?.duration) || 0);
  const isLatinPhrase = /^[a-z0-9\s'’.,!?-]+$/i.test(String(line?.text || '').trim());
  if (visible.length <= 3 || compactText.length <= 3) return 'emblem';
  if (isLatinPhrase && visible.length <= 8) return 'ticker';
  if (visible.length >= 15 || compactText.length >= 15 || duration >= 7) return 'quote';
  if (duration > 0.1 && visible.length / duration >= 5.6) return 'rush';
  return 'phrase';
}

function resolveLineRole(line, index, lines = []) {
  const normalize = (value) => String(value || '').replace(/[\s\p{P}]/gu, '').toLowerCase();
  const text = normalize(line?.text);
  if (!text) return 'verse';
  let occurrences = 0;
  for (let cursor = 0; cursor < lines.length; cursor += 1) {
    if (normalize(lines[cursor]?.text) === text) occurrences += 1;
  }
  if (text.length >= 2 && occurrences >= 2) return 'hook';
  if (index > 0 && text.length <= 3) return 'hit';
  return 'verse';
}

// A template is kept for an entire song, while each lyric line still receives
// a distinct shot inside that template's visual language. Lyrics' own length
// and speed also select a shot grammar, preventing the same row layout from
// repeating through an entire verse.
function resolveLineGrammar(config, preset, scene, line, tokens, role = 'verse') {
  const selectedEffect = config?.ktvTextEffect || 'auto';
  const selectedLayout = PRESET_LAYOUTS[preset] || 'cinema-hero';
  const manualEffect = selectedEffect !== 'auto' && selectedEffect !== 'template';
  const rhythm = getLineRhythm(line, tokens);
  let effect = manualEffect ? selectedEffect : (PRESET_TEXT_EFFECTS[preset] || 'slice');
  let layout = selectedLayout;

  if (!manualEffect) {
    if (scene === 'split') effect = preset === 'matrix' || preset === 'night-city' ? 'terminal' : 'slash';
    if (scene === 'impact') effect = preset === 'hysteric-night' ? 'shatter' : preset === 'p5' ? 'glitch' : 'scatter';
    if (scene === 'orbit') effect = preset === 'girly-clouds' || preset === 'haruhikage' ? 'float' : 'orbit';
    if (scene === 'stack') effect = CARD_BOARD_PRESETS.has(preset) ? 'cards' : 'stagger';
    if (rhythm === 'rush' && scene !== 'impact') effect = preset === 'matrix' || preset === 'night-city' ? 'terminal' : 'slice';
    if (role === 'hook') effect = preset === 'emotion-cinema' ? 'fade' : preset === 'matrix' ? 'glitch' : 'stamp';
  }

  if (CARD_BOARD_PRESETS.has(preset)) {
    if (scene === 'split') layout = 'split-hero';
    if (scene === 'stack') layout = 'vertical-columns';
    if (scene === 'impact') layout = 'impact-scatter';
    if (scene === 'orbit') layout = 'orbit-board';
  } else if (scene !== 'impact') {
    if (rhythm === 'emblem') layout = 'emblem-board';
    else if (rhythm === 'ticker') layout = 'ticker-board';
    else if (rhythm === 'quote') layout = 'quote-board';
  }
  if (role === 'hook' && !CARD_BOARD_PRESETS.has(preset)) layout = rhythm === 'quote' ? 'quote-board' : 'outline-hero';
  if (role === 'hook' && CARD_BOARD_PRESETS.has(preset)) layout = 'impact-scatter';
  return { effect, layout, rhythm };
}

function getAdaptiveSlot(index, count, layout) {
  const isImpact = layout === 'impact-scatter';
  const isCardBoard = layout === 'blue-cards' || layout === 'grunge-cards';
  const isVerticalColumns = layout === 'vertical-columns';
  // Character cards need a horizontal editorial rhythm. A square-root grid
  // turns Japanese lyrics into four tall, unrelated columns; instead compose
  // them as a compact 2-3 row collage in the central safe area.
  const columns = isVerticalColumns
    ? Math.max(1, Math.min(5, Math.ceil(count / Math.min(4, Math.max(2, Math.ceil(count / 4))))) )
    : isCardBoard
    ? Math.max(1, Math.min(count, count <= 5 ? count : count <= 10 ? 5 : 6))
    : Math.max(1, Math.min(count, Math.ceil(Math.sqrt(count * (isImpact ? 1.28 : 1.06)))));
  const rows = Math.max(1, Math.ceil(count / columns));
  const column = isVerticalColumns ? Math.floor(index / rows) : index % columns;
  const row = isVerticalColumns ? index % rows : Math.floor(index / columns);
  const horizontalSpan = isVerticalColumns ? (columns <= 2 ? 42 : columns <= 3 ? 56 : 66) : isCardBoard ? (columns <= 3 ? 48 : 64) : 76;
  const verticalSpan = isVerticalColumns ? (rows === 1 ? 0 : Math.min(66, 31 + (rows - 1) * 12)) : isCardBoard ? (rows === 1 ? 0 : Math.min(42, 22 + (rows - 1) * 11)) : 54;
  const x = columns === 1 ? 50 : 50 + ((column / (columns - 1)) - 0.5) * horizontalSpan;
  const y = rows === 1 ? 50 : 50 + ((row / (rows - 1)) - 0.5) * verticalSpan;
  // Deterministic micro-offsets retain a hand-cut frame feel while every card
  // keeps its own non-overlapping cell, including long CJK lines.
  const jitterX = isImpact ? ((index * 17) % 5 - 2) * 2.4 : ((index * 11) % 3 - 1) * (isVerticalColumns ? 0.55 : isCardBoard ? 0.9 : 1.2);
  const jitterY = isImpact ? ((index * 23) % 5 - 2) * 2.1 : ((index * 7) % 3 - 1) * (isVerticalColumns ? 0.6 : isCardBoard ? 0.8 : 1);
  const rotation = (isImpact ? ((index * 13) % 7 - 3) : ((index * 5) % 5 - 2)) * (isImpact ? 2.2 : 1.1);
  const density = count > 18 ? 0.64 : count > 13 ? 0.72 : count > 9 ? 0.82 : count > 6 ? 0.91 : 1;
  return [x + jitterX, y + jitterY, rotation, density * (isImpact ? 1.04 : 1)];
}

// Absolute card compositions have a finite safe grid. Instead of shrinking a
// 30+ character lyric until it collides or becomes unreadable, merge adjacent
// timed glyphs into compact lyric blocks. Each block keeps its first/last
// timing so the KTV sweep remains musically correct.
function condenseCompositionTokens(tokens = [], layout) {
  const isAbsoluteComposition = ['blue-cards', 'grunge-cards', 'impact-scatter', 'vertical-columns'].includes(layout);
  const maxTiles = layout === 'impact-scatter' ? 18 : 15;
  if (!isAbsoluteComposition || tokens.length <= maxTiles) return tokens;
  const groupSize = Math.ceil(tokens.length / maxTiles);
  const groups = [];
  for (let offset = 0; offset < tokens.length; offset += groupSize) {
    const slice = tokens.slice(offset, offset + groupSize);
    groups.push({
      key: `block-${slice.map(token => token.key).join('-')}`,
      text: slice.map(token => token.text).join(''),
      start: slice[0].start,
      end: slice[slice.length - 1].end
    });
  }
  return groups;
}

function lineKey(line, index) {
  return `${line?.id ?? line?.time ?? 'line'}-${index}`;
}

function isWordLike(value) {
  return /[a-z0-9]/i.test(value) && !/[\u3040-\u30ff\u3400-\u9fff]/u.test(value);
}

function getLineEnd(line, nextLine) {
  const start = Number(line?.time) || 0;
  const declared = Number(line?.duration);
  if (Number.isFinite(declared) && declared > 0.06) return start + declared;
  const next = Number(nextLine?.time);
  if (Number.isFinite(next) && next > start + 0.06) return next;
  return start + 4.2;
}

function isSectionStart(index, lines = []) {
  if (index <= 0) return true;
  const previous = lines[index - 1];
  const previousEnd = getLineEnd(previous, lines[index]);
  return (Number(lines[index]?.time) || 0) - previousEnd >= 2.2;
}

// AMLL/TTML words are not guaranteed for every provider.  This keeps the KTV
// sweep useful with plain LRC too, while preserving precise word timings when
// they are available.
function buildTokens(line, nextLine) {
  const start = Number(line?.time) || 0;
  const end = getLineEnd(line, nextLine);
  const fallback = (text) => {
    const units = splitGraphemes(text || '').filter(unit => unit.length > 0);
    const duration = Math.max(0.25, end - start);
    return units.map((text, index) => ({
      text,
      start: start + (duration * index) / Math.max(1, units.length),
      end: start + (duration * (index + 1)) / Math.max(1, units.length)
    }));
  };

  if (!Array.isArray(line?.words) || line.words.length === 0) return fallback(line?.text);

  const tokens = [];
  line.words.forEach((word, wordIndex) => {
    const text = String(word?.text ?? '');
    if (!text) return;
    const wordStart = Number(word?.startSec ?? word?.startTime);
    const wordEnd = Number(word?.endSec ?? word?.endTime);
    const duration = Number(word?.durationSec);
    const safeStart = Number.isFinite(wordStart) ? wordStart : start;
    const safeEnd = Number.isFinite(wordEnd) && wordEnd > safeStart
      ? wordEnd
      : safeStart + Math.max(0.06, Number.isFinite(duration) ? duration : (end - start) / line.words.length);
    const units = isWordLike(text) ? [text] : splitGraphemes(text);
    units.forEach((unit, index) => {
      const from = safeStart + ((safeEnd - safeStart) * index) / units.length;
      const to = safeStart + ((safeEnd - safeStart) * (index + 1)) / units.length;
      tokens.push({ text: unit, start: from, end: Math.max(from + 0.016, to), key: `${wordIndex}-${index}` });
    });
  });
  return tokens.length ? tokens : fallback(line?.text);
}

function resolveChoreographyShot(pool, songKey, cycle, slot) {
  const total = Math.max(1, pool.length);
  const seed = hashText(`${songKey || 'untitled'}:edit:${cycle}`);
  const direction = seed & 1 ? 1 : -1;
  const rotation = (seed >>> 1) % total;
  return pool[(rotation + direction * slot + total * 2) % total];
}

function resolveScene(index, setting, songKey = '', text = '') {
  if (setting && setting !== 'auto' && SCENES.includes(setting)) return setting;
  // Keep an opening frame for orientation, then give every song a stable but
  // evolving edit sequence. Earlier versions looped the same five shots every
  // five lyric rows; a long verse therefore started to feel like a slideshow.
  // Each four-line chapter now rotates/reverses its non-poster shots from the
  // song identity, while remaining deterministic when revisiting a track.
  if (index === 0) return 'poster';
  if (/[\u0021\uFF01\u003F\uFF1F]/u.test(text) || (String(text).trim().length <= 3 && index % 3 === 0)) return 'impact';
  const choreography = AUTO_CHOREOGRAPHIES[hashText(songKey || 'untitled') % AUTO_CHOREOGRAPHIES.length];
  const pool = choreography.filter(scene => scene !== 'poster');
  const phase = Math.max(0, index - 1);
  const cycle = Math.floor(phase / Math.max(1, pool.length));
  const slot = phase % Math.max(1, pool.length);
  let scene = resolveChoreographyShot(pool, songKey, cycle, slot);
  if (phase > 0 && slot === 0) {
    const previous = resolveChoreographyShot(pool, songKey, cycle - 1, pool.length - 1);
    if (scene === previous) scene = pool[(pool.indexOf(scene) + 1) % pool.length];
  }
  return scene;
}

function resolveAccent(config, themeColor, preset, autoTemplate = false) {
  const palette = {
    preset: PV_PRESETS[preset]?.accent || '#7fd8ff',
    theme: themeColor || 'var(--primary)',
    coral: '#ff6b79',
    cyan: '#66e7ff',
    lime: '#d9ff5c',
    paper: '#ffffff'
  };
  const mode = config?.ktvAccent || 'auto';
  if (mode === 'custom') return config?.ktvCustomColor || palette.coral;
  if (mode === 'auto') return autoTemplate && hueFromColor(themeColor) !== null ? palette.theme : palette.preset;
  return palette[mode] || palette.preset;
}

function hashText(value = '') {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function hueFromColor(color) {
  const match = String(color || '').trim().match(/^#([\da-f]{6}|[\da-f]{3})$/i);
  if (!match) return null;
  const source = match[1].length === 3 ? match[1].split('').map(char => char + char).join('') : match[1];
  const rgb = [0, 2, 4].map(offset => Number.parseInt(source.slice(offset, offset + 2), 16) / 255);
  const max = Math.max(...rgb);
  const min = Math.min(...rgb);
  if (max - min < 0.08) return null;
  let hue = 0;
  if (max === rgb[0]) hue = ((rgb[1] - rgb[2]) / (max - min)) % 6;
  else if (max === rgb[1]) hue = (rgb[2] - rgb[0]) / (max - min) + 2;
  else hue = (rgb[0] - rgb[1]) / (max - min) + 4;
  return (hue * 60 + 360) % 360;
}

// Auto mode chooses once from the cover hue and a stable song identity. The
// same track therefore keeps a coherent template instead of cutting through
// unrelated visual styles on every lyric line.
function resolvePreset(config, songKey, themeColor) {
  const requested = config?.ktvPreset || 'auto';
  if (requested !== 'auto' && PV_PRESETS[requested]) return requested;
  const hue = hueFromColor(themeColor);
  const groups = hue === null
    ? ['emotion-cinema', 'staggered-text', 'custom']
    : hue < 24 || hue >= 340
      ? ['cyber-grunge', 'crime-scene', 'hysteric-night']
      : hue < 58
        ? ['fly-me-to-the-moon', 'geometric', 'paper-cut']
        : hue < 155
          ? ['matrix', 'night-city', 'kawaii-pixel']
          : hue < 245
            ? ['blue-impact', 'blue-structure', 'haruhikage']
            : hue < 305
              ? ['staggered-text', 'calm-villain', 'spider-web']
              : ['girly-clouds', 'sweet-pink', 'kinetic-split'];
  return groups[hashText(`${songKey || 'untitled'}:${Math.round(hue ?? -1)}`) % groups.length];
}

function resolveTextEffect(config, preset) {
  const selected = config?.ktvTextEffect || 'auto';
  return selected === 'template' || selected === 'auto' ? (PRESET_TEXT_EFFECTS[preset] || 'slice') : selected;
}

function resolveScript(text = '') {
  const value = String(text);
  if (/[\u3040-\u30ff]/u.test(value)) return 'jp';
  if (/[\u3400-\u9fff]/u.test(value)) return 'cjk';
  if (/[a-z]/i.test(value)) return 'latin';
  return 'mixed';
}

// A lyric line gets a visual cue in addition to its timed glyphs. This gives
// every cut an editorial focal point (hero letter / after-image) rather than
// making the foreground read like a conventional karaoke row.
function resolveKineticCues(tokens = []) {
  const visible = tokens.filter(token => String(token?.text || '').trim());
  if (!visible.length) return { hero: '\u8def', echo: '\u8def', heroLength: 1, echoLength: 1 };
  const punctuation = /[\u002C\u3001\uFF0C\u002E\u3002\u0021\uFF01\u003F\uFF1F\u2026]/u;
  const cueSegments = [];
  let current = [];
  visible.forEach((token, index) => {
    if (punctuation.test(String(token?.text || ''))) {
      if (current.length) cueSegments.push({ start: current[0].index, end: current[current.length - 1].index, tokens: current });
      current = [];
      return;
    }
    current.push({ ...token, index });
  });
  if (current.length) cueSegments.push({ start: current[0].index, end: current[current.length - 1].index, tokens: current });
  const middle = Math.floor((visible.length - 1) * 0.56);
  const matchedSegmentIndex = cueSegments.findIndex(segment => middle >= segment.start && middle <= segment.end);
  const segmentIndex = matchedSegmentIndex >= 0
    ? matchedSegmentIndex
    : cueSegments.reduce((closest, segment, index) => {
      const distance = Math.min(Math.abs(middle - segment.start), Math.abs(middle - segment.end));
      const closestSegment = cueSegments[closest];
      const closestDistance = Math.min(Math.abs(middle - closestSegment.start), Math.abs(middle - closestSegment.end));
      return distance < closestDistance ? index : closest;
    }, 0);
  const segment = cueSegments[segmentIndex] || { tokens: visible.map((token, index) => ({ ...token, index })) };
  const selected = segment.tokens;
  const isCjkSequence = selected.some(token => /[\u3040-\u30ff\u3400-\u9fff]/u.test(String(token.text)));
  const heroSpan = isCjkSequence ? (selected.length >= 9 ? 3 : selected.length >= 5 ? 2 : 1) : 1;
  const localMiddle = Math.floor((selected.length - 1) * 0.56);
  const heroStart = Math.max(0, Math.min(selected.length - heroSpan, localMiddle - Math.floor(heroSpan / 2)));
  const hero = selected.slice(heroStart, heroStart + heroSpan).map(token => token.text).join('') || selected[0]?.text || visible[0].text;
  const echoSpan = isCjkSequence && selected.length >= 8 ? 2 : 1;
  const echoStart = Math.min(selected.length - echoSpan, heroStart + heroSpan + Math.max(0, Math.floor(selected.length / 4)));
  const nextSegment = cueSegments[segmentIndex + 1]?.tokens || selected;
  const echo = (selected.slice(Math.max(0, echoStart), Math.max(0, echoStart) + echoSpan).map(token => token.text).join('') || nextSegment.slice(0, echoSpan).map(token => token.text).join('') || hero);
  return { hero, echo, heroLength: splitGraphemes(hero).length, echoLength: splitGraphemes(echo).length };
}

// A phrase needs a few editorial beats in addition to its word timings. These
// deterministic anchors turn a long string into a small sequence of visual
// hits without adding another animation loop or risking absolute-card overlap.
function resolvePhraseEmphasis(tokens = [], role = 'verse') {
  const count = tokens.length;
  if (!count) return new Set();
  const anchors = role === 'hook' ? [0, 0.28, 0.58, 0.86] : [0.22, 0.56, 0.84];
  const emphasis = new Set();
  anchors.forEach((ratio) => emphasis.add(Math.min(count - 1, Math.max(0, Math.round((count - 1) * ratio)))));
  tokens.forEach((token, index) => {
    if (/[!！?？、,，。…]/u.test(String(token?.text || ''))) emphasis.add(index);
  });
  return emphasis;
}

function KtvLine({ model, fontPx, translationPx, fontStack, showTranslation, presetLabel, register }) {
  const { line, tokens, index, relation, scene, effect, layout, rhythm, act, role, sectionStart } = model;
  const label = sectionStart ? 'NEW CHAPTER' : role === 'hook' ? 'CHORUS / HOOK' : relation === 'active' ? 'NOW SINGING' : relation === 'previous' ? 'MEMORY' : 'NEXT LINE';
  const script = resolveScript(line.text);
  const kineticCue = resolveKineticCues(tokens);
  const displayTokens = condenseCompositionTokens(tokens, layout);
  const phraseEmphasis = resolvePhraseEmphasis(displayTokens, role);
  return (
    <article
      ref={(node) => register(model.key, node)}
      className={`kpv-line kpv-line--${relation} kpv-scene--${scene} kpv-effect--${effect} kpv-layout--${layout} kpv-script--${script}`}
      data-line-key={model.key}
      data-rhythm={rhythm}
      data-act={act}
      data-role={role}
      data-section={sectionStart ? 'start' : 'continue'}
      aria-hidden={relation !== 'active'}
    >
       <div className="kpv-geometry" aria-hidden="true"><i /><i /><i /></div>
       <div className="kpv-burst" aria-hidden="true"><i /><i /><i /><i /></div>
       <div className="kpv-systems" aria-hidden="true"><i>VECTOR / {String(index + 1).padStart(2, '0')}</i><i>LYRIC SIGNAL</i><i>∿ 01 10 01</i></div>
       <div className="kpv-ghost" aria-hidden="true">{line.text}</div>
       <div className="kpv-echoes" aria-hidden="true"><b>{line.text}</b><b>{line.text}</b></div>
      <div className={`kpv-keyframe${kineticCue.heroLength >= 3 ? ' kpv-keyframe--phrase' : kineticCue.heroLength === 2 ? ' kpv-keyframe--pair' : ''}`} aria-hidden="true"><span>KEYFRAME / {String(index + 1).padStart(2, '0')}</span><b>{kineticCue.hero}</b><i>{kineticCue.echo}</i></div>
      <div className="kpv-copy">
        <div className="kpv-phrase-ribbon" aria-hidden="true"><i /><b>PHRASE / {String(index + 1).padStart(2, '0')} · {role.toUpperCase()}</b></div>
        <div className="kpv-caption"><span>{String(index + 1).padStart(2, '0')}</span><b>{label}</b><em>{act.toUpperCase()} / {presetLabel}</em></div>
        <div className="kpv-words" style={{ fontSize: `${fontPx}px`, fontFamily: fontStack, '--kpv-token-count': displayTokens.length }}>
          {displayTokens.map((token, tokenIndex) => {
            const [slotX, slotY, slotRotation, slotScale] = getAdaptiveSlot(tokenIndex, displayTokens.length, layout);
            const blockScale = /[\u3040-\u30ff\u3400-\u9fff]/u.test(token.text)
              ? Math.min(1, 1.5 / Math.max(1, splitGraphemes(token.text).length))
              : 1;
            return (
            <span
              className="kpv-token"
              key={token.key}
              data-start={token.start}
              data-end={token.end}
              data-emphasis={phraseEmphasis.has(tokenIndex) ? 'true' : 'false'}
              style={{
                whiteSpace: token.text === ' ' ? 'pre' : undefined,
                '--kpv-index': tokenIndex,
                '--kpv-stagger': `${(tokenIndex % 2 === 0 ? -1 : 1) * (7 + (tokenIndex % 3) * 4)}px`,
                '--kpv-scatter-x': `${((tokenIndex * 37) % 5 - 2) * 28}px`,
                '--kpv-scatter-y': `${((tokenIndex * 19) % 5 - 2) * 20}px`,
                '--kpv-scatter-r': `${((tokenIndex * 29) % 7 - 3) * 7}deg`,
                '--kpv-slot-x': `${slotX}%`,
               '--kpv-slot-y': `${slotY}%`,
               '--kpv-slot-r': `${slotRotation}deg`,
                '--kpv-slot-scale': slotScale * blockScale,
                '--kpv-count': displayTokens.length
              }}
            >
              <span className="kpv-token-motion">
                <span className="kpv-token-base">{token.text}</span>
                <span className="kpv-token-fill" aria-hidden="true">{token.text}</span>
              </span>
            </span>
          );
          })}
        </div>
        {showTranslation && line.translation && (
          <div className="kpv-translation" style={{ fontSize: `${translationPx}px`, fontFamily: fontStack }}>
            <span className="kpv-translation-base">{line.translation}</span>
            <span className="kpv-translation-fill" aria-hidden="true">{line.translation}</span>
          </div>
        )}
        <div className="kpv-meter" aria-hidden="true"><i /></div>
      </div>
    </article>
  );
}

/**
 * KTV Text PV: a compact kinetic-typography stage. It intentionally updates
 * CSS custom properties from the shared lyric clock instead of storing every
 * 16ms progress sample in React state; rendering stays smooth on long lyrics.
 */
export default function KineticKtvLyrics({
  lyrics = [],
  activeLineIndex = -1,
  engineRef,
  fontPx = 36,
  translationPx = 18,
  fontStack,
  themeColor,
  config = {},
  songKey,
  songTitle = '',
  songArtist = '',
  isPlaying = true,
  coverUrl = ''
}) {
  const lineNodes = useRef(new Map());
  const stageRef = useRef(null);
  const stageProgressRef = useRef(-1);
  const audioPulseRef = useRef({ buffer: null, value: 0, lastSampleAt: 0, lastPainted: -1 });
  const autoPresetRef = useRef({ songKey: null, preset: null, themeColor: null });
  const previewOriginRef = useRef(0);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [clockActiveIndex, setClockActiveIndex] = useState(-1);
  const previewEnabled = config.ktvPreviewEnabled === true;
  const stageLyrics = previewEnabled ? PV_PREVIEW_LYRICS : lyrics;
  useEffect(() => {
    if (previewEnabled || !stageLyrics.length) {
      setClockActiveIndex(-1);
      return undefined;
    }
    const syncVisualIndex = () => {
      const time = (engineRef?.current?.getCurrentTime?.() || 0) + (Number(config.globalOffset) || 0);
      const nextIndex = resolveVisualActiveIndex(stageLyrics, time, activeLineIndex);
      setClockActiveIndex(current => current === nextIndex ? current : nextIndex);
    };
    syncVisualIndex();
    if (!isPlaying) return undefined;
    return subscribeLyricClock(syncVisualIndex);
  }, [activeLineIndex, config.globalOffset, engineRef, isPlaying, previewEnabled, stageLyrics]);
  const resolvedActiveIndex = previewEnabled
    ? previewIndex
    : (clockActiveIndex >= 0 ? clockActiveIndex : activeLineIndex);
  const active = clamp(resolvedActiveIndex, 0, Math.max(0, stageLyrics.length - 1));
  const showPreviousLine = config.ktvShowPreviousLine === true;
  const openingTime = engineRef?.current?.getCurrentTime?.() || 0;
  const showTitleCard = config.ktvShowTitleCard !== false && (previewEnabled || (openingTime < 1.8 && activeLineIndex <= 0));
  const showTranslation = config.ktvShowTranslation !== false && config.showTranslation !== false;
  const motion = clamp(Number(config.ktvMotion ?? 1), 0.35, 1.8);
  const cameraZoom = clamp(Number(config.ktvCameraZoom ?? 0), 0, 1);
  const cameraTilt = clamp(Number(config.ktvCameraTilt ?? 0), -8, 8);
  const cameraShake = clamp(Number(config.ktvCameraShake ?? 0), 0, 1);
  const renderQuality = resolveRenderQuality(config);
  const songTemplate = config.ktvSongTemplates?.[String(songKey)] || '';
  const requestedPreset = PV_PRESETS[songTemplate] ? songTemplate : (config.ktvPreset || 'auto');
  const autoTemplate = requestedPreset === 'auto';
  let preset;
  if (requestedPreset !== 'auto' && PV_PRESETS[requestedPreset]) {
    preset = requestedPreset;
  } else {
    // The cover palette resolves asynchronously. Accept a refined colour only
    // during the opening beat, then lock this exact template for the rest of
    // the song so a late image decode never restyles a running verse.
    const playbackTime = engineRef?.current?.getCurrentTime?.() || 0;
    const canRefineOpening = previewEnabled || (playbackTime < 1.2 && activeLineIndex <= 0);
    const songChanged = autoPresetRef.current.songKey !== songKey || !autoPresetRef.current.preset;
    const colorRefined = autoPresetRef.current.themeColor !== themeColor;
    if (songChanged || (colorRefined && canRefineOpening)) {
      autoPresetRef.current = {
        songKey,
        themeColor,
        preset: resolvePreset({ ...config, ktvPreset: 'auto' }, songKey, themeColor)
      };
    }
    preset = autoPresetRef.current.preset;
  }
  const accent = resolveAccent(config, themeColor, preset, autoTemplate);
  // Auto mode deliberately keeps the template's art direction, then blends
  // its native accent with the cover-derived colour. The result is stable for
  // a whole song but gives two albums in the same template distinct light and
  // beat details instead of a single recoloured background.
  const accentAlt = `color-mix(in hsl, ${accent} 68%, ${PV_PRESETS[preset]?.accent || '#7fd8ff'} 32%)`;
  const lineOpacityBase = PRESET_LINE_OPACITY[preset] || 0.32;

  useEffect(() => {
    if (!previewEnabled) {
      previewOriginRef.current = 0;
      setPreviewIndex(0);
      return undefined;
    }
    const cycle = PV_PREVIEW_LYRICS[PV_PREVIEW_LYRICS.length - 1].time
      + PV_PREVIEW_LYRICS[PV_PREVIEW_LYRICS.length - 1].duration;
    previewOriginRef.current = performance.now();
    setPreviewIndex(0);
    const timer = window.setInterval(() => {
      const elapsed = ((performance.now() - previewOriginRef.current) / 1000) % cycle;
      let next = PV_PREVIEW_LYRICS.length - 1;
      for (let index = PV_PREVIEW_LYRICS.length - 1; index >= 0; index -= 1) {
        if (elapsed >= PV_PREVIEW_LYRICS[index].time) {
          next = index;
          break;
        }
      }
      setPreviewIndex(current => current === next ? current : next);
    }, 180);
    return () => window.clearInterval(timer);
  }, [previewEnabled]);

  const models = useMemo(() => {
    if (!stageLyrics.length) return [];
    const offsets = showPreviousLine ? [-1, 0, 1] : [0, 1];
    return offsets.map(offset => {
      const index = active + offset;
      if (index < 0 || index >= stageLyrics.length) return null;
      const relation = offset === 0 ? 'active' : offset < 0 ? 'previous' : 'next';
      const scene = resolveScene(index, config.ktvComposition || 'auto', previewEnabled ? 'pv-preview' : songKey, stageLyrics[index]?.text);
      const act = resolveSongAct(index, stageLyrics.length);
      const role = resolveLineRole(stageLyrics[index], index, stageLyrics);
      const sectionStart = isSectionStart(index, stageLyrics);
      const tokens = buildTokens(stageLyrics[index], stageLyrics[index + 1]);
      const grammar = resolveLineGrammar(config, preset, scene, stageLyrics[index], tokens, role);
      return {
        key: lineKey(stageLyrics[index], index),
        line: stageLyrics[index],
        tokens,
        index,
        relation,
        scene,
        act,
        role,
        sectionStart,
        ...grammar,
        start: Number(stageLyrics[index].time) || 0,
        end: getLineEnd(stageLyrics[index], stageLyrics[index + 1])
      };
    }).filter(Boolean);
  }, [active, config.ktvComposition, config.ktvTextEffect, lyrics, previewEnabled, preset, showPreviousLine, songKey, stageLyrics]);
  const activeModel = models.find(model => model.relation === 'active');
  const activeScene = activeModel?.scene || 'poster';

  const register = (key, node) => {
    if (!node) {
      lineNodes.current.delete(key);
      return;
    }
    lineNodes.current.set(key, {
      root: node,
      tokens: Array.from(node.querySelectorAll('.kpv-token')),
      meter: node.querySelector('.kpv-meter > i'),
      fills: [],
      states: [],
      meterProgress: -1,
      finished: false,
      initialized: false
    });
  };

  useEffect(() => {
    let lastLyricPaintAt = 0;
    const paintToken = (refs, token, index, fill) => {
      const nextFill = Math.round(fill * 1000) / 10;
      const state = fill >= 0.999 ? 'done' : fill > 0.001 ? 'live' : 'waiting';
      // Completed and queued glyphs are static. During a word sweep only the
      // currently sung token receives a style write, instead of repainting the
      // whole lyric line at 60fps.
      if (refs.fills[index] === nextFill && refs.states[index] === state) return;
      refs.fills[index] = nextFill;
      refs.states[index] = state;
      token.style.setProperty('--kpv-fill', `${nextFill}%`);
      token.style.setProperty('--kpv-fill-ratio', String(Math.round(fill * 1000) / 1000));
      if (token.dataset.state !== state) token.dataset.state = state;
    };

    const updateAudioPulse = (now = performance.now()) => {
      const stage = stageRef.current;
      if (!stage) return;
      if (!isPlaying || config.ktvBeatReactive === false) {
        if (audioPulseRef.current.lastPainted !== 0) {
          audioPulseRef.current.lastPainted = 0;
          audioPulseRef.current.value = 0;
          stage.style.setProperty('--kpv-energy', '0');
          stage.style.setProperty('--kpv-energy-scale', '1');
          stage.style.setProperty('--kpv-lines-opacity', String(lineOpacityBase));
        }
        return;
      }
      const pulse = audioPulseRef.current;
      // The lyric clock can tick at display refresh rate. Sample only the low
      // frequency bins at 12.5fps, then smooth the result; this makes shots
      // respond to kick/snare energy without adding a second render loop.
      const sampleInterval = renderQuality === 'efficient' ? 160 : renderQuality === 'balanced' ? 110 : 80;
      if (now - pulse.lastSampleAt < sampleInterval) return;
      pulse.lastSampleAt = now;
      const analyser = window.ichigoAnalyser;
      if (!analyser?.getByteFrequencyData || !analyser.frequencyBinCount) return;
      if (!pulse.buffer || pulse.buffer.length !== analyser.frequencyBinCount) {
        pulse.buffer = new Uint8Array(analyser.frequencyBinCount);
      }
      analyser.getByteFrequencyData(pulse.buffer);
      const bins = Math.min(40, pulse.buffer.length);
      let total = 0;
      for (let index = 1; index < bins; index += 1) total += pulse.buffer[index];
      const target = clamp((total / Math.max(1, bins - 1) - 18) / 125);
      pulse.value = pulse.value * 0.7 + target * 0.3;
      const painted = Math.round(pulse.value * 100) / 100;
      if (Math.abs(pulse.lastPainted - painted) >= 0.02) {
        pulse.lastPainted = painted;
        stage.style.setProperty('--kpv-energy', String(painted));
        stage.style.setProperty('--kpv-energy-scale', String(1 + painted * 0.025));
        stage.style.setProperty('--kpv-lines-opacity', String(Math.min(0.94, lineOpacityBase + painted * 0.18)));
      }
    };

    const update = (clockNow = performance.now()) => {
      // Hidden windows should not keep sampling the analyser or mutating CSS.
      // The shared lyric clock immediately paints the current frame on return.
      if (document.hidden) return;
      updateAudioPulse(clockNow);
      const time = previewEnabled
        ? Math.max(0, (clockNow - (previewOriginRef.current || clockNow)) / 1000)
        : (engineRef?.current?.getCurrentTime?.() || 0) + (Number(config.globalOffset) || 0);

      // Clip-path word fill remains visually continuous at 30fps, while
      // reducing style writes substantially on long timed lyrics. The shared
      // clock can still tick at display refresh rate for every other mode.
      const lyricPaintInterval = renderQuality === 'efficient' ? 50 : 33;
      const paintNow = clockNow;
      if (paintNow - lastLyricPaintAt < lyricPaintInterval) return;
      lastLyricPaintAt = paintNow;

      models.forEach((model) => {
        const refs = lineNodes.current.get(model.key);
        if (!refs) return;
        const activeLine = model.relation === 'active';
        if (!refs.initialized) {
          refs.initialized = true;
          refs.root.style.setProperty('--kpv-line-opacity', activeLine ? '1' : model.relation === 'previous' ? '.52' : '.28');
          refs.root.dataset.live = 'false';
          refs.tokens.forEach((token, index) => paintToken(refs, token, index, model.relation === 'previous' ? 1 : 0));
        }
        if (!activeLine) return;

        const progress = clamp((time - model.start) / Math.max(0.08, model.end - model.start));
        if (stageRef.current && Math.abs(stageProgressRef.current - progress) >= 0.004) {
          stageProgressRef.current = progress;
          stageRef.current.style.setProperty('--kpv-phrase-progress', String(progress));
          stageRef.current.style.setProperty('--kpv-phrase-reveal', `${Math.round(progress * 1000) / 10}%`);
        }
        const isLive = time >= model.start && time < model.end;
        const liveValue = isLive ? 'true' : 'false';
        if (refs.root.dataset.live !== liveValue) refs.root.dataset.live = liveValue;
        // Once a line has fully landed, freeze its final token state until
        // the active-line boundary changes. This avoids scanning every glyph
        // during instrumental gaps while preserving seek-back correctness.
        if (time >= model.end) {
          if (!refs.finished) {
            refs.tokens.forEach((token, index) => paintToken(refs, token, index, 1));
            if (refs.meter && refs.meterProgress !== 1) {
              refs.meterProgress = 1;
              refs.meter.style.transform = 'scaleX(1)';
            }
            refs.finished = true;
          }
          return;
        }
        refs.finished = false;
        if (refs.meter && Math.abs(refs.meterProgress - progress) >= 0.002) {
          refs.meterProgress = progress;
          refs.meter.style.transform = `scaleX(${progress})`;
        }

        refs.tokens.forEach((token, index) => {
          const start = Number(token.dataset.start);
          const end = Number(token.dataset.end);
          paintToken(refs, token, index, clamp((time - start) / Math.max(0.016, end - start)));
        });
      });
    };

    update();
    if (!previewEnabled) return subscribeLyricClock(update);
    let frameId = 0;
    const previewFrame = (now) => {
      update(now);
      frameId = requestAnimationFrame(previewFrame);
    };
    frameId = requestAnimationFrame(previewFrame);
    return () => cancelAnimationFrame(frameId);
  }, [config.globalOffset, config.ktvBeatReactive, engineRef, isPlaying, lineOpacityBase, models, previewEnabled, renderQuality]);

  if (!stageLyrics.length) return <div className="kpv-stage" />;

  return (
    <section
      ref={stageRef}
      className={`kpv-stage kpv-preset--${preset}${isPlaying || previewEnabled ? '' : ' kpv-stage--paused'}${previewEnabled ? ' kpv-stage--preview' : ''}`}
      data-scene={activeScene}
      data-act={activeModel?.act || 'intro'}
      data-auto-template={autoTemplate ? 'true' : 'false'}
      data-hook={activeModel?.role === 'hook' ? 'true' : 'false'}
      data-section={activeModel?.sectionStart ? 'start' : 'continue'}
      data-quality={renderQuality}
      style={{ '--kpv-accent': accent, '--kpv-accent-alt': accentAlt, '--kpv-motion': motion, '--kpv-energy': 0, '--kpv-energy-scale': 1, '--kpv-lines-opacity': lineOpacityBase, '--kpv-phrase-progress': 0, '--kpv-phrase-reveal': '0%', '--kpv-camera-zoom': 1 + cameraZoom * 0.08, '--kpv-camera-tilt': `${cameraTilt}deg`, '--kpv-camera-shake': cameraShake }}
      aria-label="KTV 文字 PV 歌词"
    >
      <div className={`kpv-camera${cameraShake > 0 ? ' kpv-camera--shake' : ''}`}>
      <div className="kpv-grain" aria-hidden="true" />
      {showTitleCard && <div className="kpv-title-card" aria-hidden="true"><i>ICHIGOMUSIC / TEXT PV</i><b>{previewEnabled ? 'PV TEMPLATE PREVIEW' : (songTitle || 'NOW PLAYING')}</b><span>{previewEnabled ? 'LIVE TYPE COMPOSITOR' : (songArtist || 'ICHIGOMUSIC')}</span></div>}
      {previewEnabled && <div className="kpv-preview-mark" aria-hidden="true">PV TEMPLATE PREVIEW · LIVE TYPE</div>}
      {config.ktvUseCoverTexture !== false && coverUrl && <div className="kpv-coverwash" aria-hidden="true" style={{ backgroundImage: `url("${coverUrl}")` }} />}
      {config.ktvUseCoverTexture !== false && coverUrl && <div key={`cover-cel-${coverUrl}`} className="kpv-cover-cel" aria-hidden="true" style={{ backgroundImage: `url("${coverUrl}")` }}><i /></div>}
      <div key={`field-${activeModel?.key || 'idle'}`} className="kpv-field" aria-hidden="true"><i /><i /><i /><i /><i /><i /></div>
      <div className="kpv-shutter" aria-hidden="true" />
      <div className="kpv-radial-pulse" aria-hidden="true"><i /><i /><i /></div>
      <div className="kpv-sparks" aria-hidden="true"><i /><i /><i /><i /><i /><i /><i /><i /></div>
      <div className="kpv-beat-rig" aria-hidden="true"><i /><i /><i /><i /><i /><i /><i /><i /><i /></div>
      <div className="kpv-frame" aria-hidden="true"><i /><i /><i /><i /></div>
      <div className="kpv-lines" aria-hidden="true" />
      {models.map(model => (
        <KtvLine
          key={model.key}
          model={model}
          fontPx={Math.min(104, fontPx * 1.42)}
          translationPx={Math.min(30, translationPx * 1.08)}
          fontStack={fontStack}
          showTranslation={showTranslation}
          presetLabel={PV_PRESETS[preset].label}
          register={register}
        />
      ))}
      </div>
      <style>{`
        .kpv-stage{position:relative;width:100%;height:100%;overflow:hidden;isolation:isolate;contain:layout paint style;color:#f8f7f2;background:radial-gradient(circle at 82% 18%,color-mix(in srgb,var(--kpv-accent) 20%,transparent),transparent 31%),linear-gradient(118deg,rgba(3,4,11,.87),rgba(12,10,21,.44));font-variant-numeric:tabular-nums}
        .kpv-camera{position:absolute;inset:0;transform:scale(var(--kpv-camera-zoom,1)) rotate(var(--kpv-camera-tilt,0deg));transform-origin:center;will-change:transform,translate;transition:transform .35s cubic-bezier(.2,.82,.2,1)}.kpv-camera--shake{animation:kpv-camera-shake calc(.72s / var(--kpv-motion)) steps(2,end) infinite}.kpv-stage[data-quality="efficient"] .kpv-camera--shake{animation-duration:1.25s}\n        .kpv-stage::before,.kpv-stage::after{content:"";position:absolute;inset:-15%;z-index:0;pointer-events:none;will-change:transform;transform:translate3d(0,0,0)}.kpv-stage::before{opacity:.23;background:linear-gradient(110deg,transparent 37%,color-mix(in srgb,var(--kpv-accent) 38%,transparent) 49%,transparent 61%);animation:kpv-light-sweep 12s ease-in-out infinite}.kpv-stage[data-auto-template="true"]::before{background:linear-gradient(110deg,transparent 30%,color-mix(in srgb,var(--kpv-accent-alt) 46%,transparent) 45%,color-mix(in srgb,var(--kpv-accent) 30%,transparent) 54%,transparent 69%)}.kpv-stage::after{opacity:.2;background:radial-gradient(ellipse at 50% 50%,transparent 44%,rgba(0,0,0,.45) 100%);animation:kpv-vignette-breathe 8s ease-in-out infinite}
        .kpv-grain{position:absolute;inset:0;z-index:0;opacity:.045;pointer-events:none;background-image:radial-gradient(rgba(255,255,255,.95) .55px,transparent .7px);background-size:5px 5px}
        .kpv-title-card{position:absolute;z-index:9;left:clamp(26px,7vw,120px);top:clamp(30px,12vh,140px);display:flex;flex-direction:column;gap:8px;max-width:min(72vw,900px);pointer-events:none;animation:kpv-title-card 2.8s cubic-bezier(.16,.86,.22,1) both}.kpv-title-card i{font:700 10px/1 ui-monospace,monospace;letter-spacing:.2em;color:var(--kpv-accent);font-style:normal}.kpv-title-card b{font:800 clamp(34px,6vw,96px)/.94 "Outfit","Noto Sans SC",sans-serif;letter-spacing:-.055em;text-wrap:balance;text-shadow:0 10px 34px rgba(0,0,0,.35)}.kpv-title-card span{font:600 clamp(11px,1.5vw,17px)/1.2 "Inter","Noto Sans SC",sans-serif;letter-spacing:.16em;opacity:.74}.kpv-preset--emotion-cinema .kpv-title-card b,.kpv-preset--fly-me-to-the-moon .kpv-title-card b{font-family:"Shippori Mincho","Noto Serif SC",serif;font-weight:500}.kpv-stage[data-quality="efficient"] .kpv-title-card{animation-duration:2s}\n        /* Quality tiers only reduce decorative compositing; lyric timings,
           scene choices and readable foreground typography are identical. */
        .kpv-stage[data-quality="balanced"] .kpv-grain{opacity:.025}.kpv-stage[data-quality="balanced"] .kpv-coverwash{filter:blur(18px) saturate(1.12)}.kpv-stage[data-quality="balanced"] .kpv-echoes b{animation-duration:9s}.kpv-stage[data-quality="efficient"] .kpv-grain,.kpv-stage[data-quality="efficient"] .kpv-echoes,.kpv-stage[data-quality="efficient"] .kpv-field i:nth-child(4),.kpv-stage[data-quality="efficient"] .kpv-field i:nth-child(6){display:none}.kpv-stage[data-quality="efficient"]::before{animation-duration:24s;opacity:.14}.kpv-stage[data-quality="efficient"]::after{animation:none}.kpv-stage[data-quality="efficient"] .kpv-coverwash{filter:blur(12px) saturate(1.04);animation:none;opacity:.08!important}.kpv-stage[data-quality="efficient"] .kpv-lines{animation-duration:32s}.kpv-stage[data-quality="efficient"] .kpv-beat-rig{height:12vh!important;opacity:calc(.16 + var(--kpv-energy,0) * .22)!important}.kpv-stage[data-quality="efficient"] .kpv-beat-rig i:nth-child(even){display:none}.kpv-stage[data-quality="efficient"] .kpv-keyframe{mix-blend-mode:normal;filter:none!important}.kpv-stage[data-quality="efficient"] .kpv-token[data-state="live"]{filter:none}.kpv-stage[data-quality="efficient"] .kpv-token-fill{will-change:auto}        .kpv-preview-mark{position:absolute;z-index:8;right:clamp(22px,4vw,62px);bottom:clamp(22px,4vh,48px);padding:7px 10px;border:1px solid color-mix(in srgb,var(--kpv-accent) 55%,transparent);background:color-mix(in srgb,#080914 72%,transparent);font:700 9px/1 ui-monospace,monospace;letter-spacing:.14em;color:var(--kpv-accent);pointer-events:none;animation:kpv-preview-mark 1.8s steps(2,end) infinite}
        .kpv-coverwash{position:absolute;inset:-8%;z-index:0;pointer-events:none;background-position:center;background-size:cover;filter:blur(26px) saturate(1.3) contrast(1.08);opacity:0;transform:scale(1.08);will-change:transform;animation:kpv-cover-drift 24s ease-in-out infinite}.kpv-preset--emotion-cinema .kpv-coverwash,.kpv-preset--fly-me-to-the-moon .kpv-coverwash{opacity:.22;mix-blend-mode:screen}.kpv-preset--night-city .kpv-coverwash,.kpv-preset--cyber-grunge .kpv-coverwash{opacity:.16;mix-blend-mode:luminosity}.kpv-preset--custom .kpv-coverwash{opacity:.13;mix-blend-mode:screen}.kpv-preset--blue-structure .kpv-coverwash{opacity:.07;mix-blend-mode:multiply;filter:blur(34px) saturate(.8)}.kpv-stage[data-auto-template="true"] .kpv-coverwash{opacity:.075;mix-blend-mode:soft-light}
        .kpv-cover-cel{position:absolute;z-index:0;right:clamp(7%,12vw,18%);top:clamp(12%,18vh,24%);width:clamp(126px,20vw,330px);aspect-ratio:1;overflow:hidden;pointer-events:none;--kpv-cover-opacity:0;opacity:var(--kpv-cover-opacity);background-position:center;background-size:cover;clip-path:polygon(12% 0,100% 0,88% 100%,0 100%);box-shadow:14px 18px 0 color-mix(in srgb,var(--kpv-accent) 22%,transparent),0 24px 56px rgba(0,0,0,.28);filter:saturate(1.13) contrast(1.06);transform-origin:center;will-change:transform,opacity;animation:kpv-cover-cel 14s cubic-bezier(.42,.02,.35,1) infinite}.kpv-cover-cel::before{content:"";position:absolute;inset:0;background:linear-gradient(135deg,color-mix(in srgb,var(--kpv-accent) 18%,transparent),transparent 48%,rgba(0,0,0,.25));mix-blend-mode:screen}.kpv-cover-cel i{position:absolute;inset:7%;border:1px solid color-mix(in srgb,var(--kpv-accent) 70%,rgba(255,255,255,.5));transform:rotate(-7deg)}.kpv-stage[data-auto-template="true"] .kpv-cover-cel{--kpv-cover-opacity:.15;mix-blend-mode:soft-light}.kpv-preset--blue-impact .kpv-cover-cel,.kpv-preset--blue-structure .kpv-cover-cel{--kpv-cover-opacity:.26;mix-blend-mode:screen}.kpv-preset--emotion-cinema .kpv-cover-cel,.kpv-preset--fly-me-to-the-moon .kpv-cover-cel,.kpv-preset--haruhikage .kpv-cover-cel{--kpv-cover-opacity:.3;mix-blend-mode:soft-light;border-radius:50%;clip-path:circle(47%)}.kpv-preset--cyber-grunge .kpv-cover-cel,.kpv-preset--crime-scene .kpv-cover-cel{--kpv-cover-opacity:.25;mix-blend-mode:screen;clip-path:polygon(0 0,100% 0,100% 84%,84% 84%,84% 100%,0 100%)}.kpv-preset--sweet-pink .kpv-cover-cel,.kpv-preset--girly-clouds .kpv-cover-cel{--kpv-cover-opacity:.22;border-radius:28px;clip-path:inset(0 round 28px)}.kpv-preset--custom .kpv-cover-cel{--kpv-cover-opacity:.2;mix-blend-mode:screen}.kpv-stage[data-scene="split"] .kpv-cover-cel{left:clamp(7%,10vw,14%);right:auto;top:clamp(18%,25vh,30%);animation-delay:-4s}.kpv-stage[data-scene="stack"] .kpv-cover-cel{right:clamp(6%,8vw,12%);top:clamp(8%,12vh,16%);width:clamp(112px,16vw,250px);animation-delay:-7s}.kpv-stage[data-scene="impact"] .kpv-cover-cel{right:clamp(8%,11vw,17%);top:auto;bottom:clamp(9%,14vh,18%);animation-delay:-9s}.kpv-stage[data-scene="orbit"] .kpv-cover-cel{left:clamp(8%,12vw,18%);right:auto;top:clamp(17%,23vh,28%);border-radius:50%;clip-path:circle(46%);animation-delay:-11s}.kpv-stage[data-quality="efficient"] .kpv-cover-cel{display:none}
        .kpv-field{position:absolute;inset:-10%;z-index:0;overflow:hidden;pointer-events:none;opacity:.52;transform:scale(var(--kpv-energy-scale,1));transform-origin:center;transition:transform .14s ease-out;animation:kpv-field-enter .62s cubic-bezier(.18,.86,.2,1) both}.kpv-field i{position:absolute;display:block;border:1px solid color-mix(in srgb,var(--kpv-accent) 44%,transparent);will-change:transform,opacity}.kpv-field i:nth-child(1){width:clamp(180px,22vw,420px);height:clamp(180px,22vw,420px);left:5%;top:12%;border-radius:50%;animation:kpv-field-orbit 18s linear infinite}.kpv-field i:nth-child(2){width:clamp(80px,9vw,180px);height:clamp(80px,9vw,180px);right:12%;top:21%;border-radius:50%;background:color-mix(in srgb,var(--kpv-accent) 13%,transparent);animation:kpv-field-bob 7s ease-in-out -2s infinite}.kpv-field i:nth-child(3){width:54vw;height:1px;left:-8%;bottom:23%;background:var(--kpv-accent);border:0;opacity:.34;transform:rotate(-14deg);animation:kpv-field-sweep 12s ease-in-out infinite}.kpv-field i:nth-child(4){width:26vw;height:26vw;right:-9%;bottom:-6%;border-radius:50%;border-style:dashed;animation:kpv-field-orbit 26s linear reverse infinite}.kpv-field i:nth-child(5){width:4px;height:4px;left:67%;top:31%;border:0;border-radius:50%;background:var(--kpv-accent);box-shadow:0 0 0 8px color-mix(in srgb,var(--kpv-accent) 13%,transparent),0 0 22px var(--kpv-accent);animation:kpv-field-bob 4.5s ease-in-out infinite}.kpv-field i:nth-child(6){width:34vw;height:14vw;left:34%;top:60%;border-radius:50%;transform:rotate(-23deg);opacity:.42;animation:kpv-field-breathe 9s ease-in-out infinite}.kpv-stage[data-auto-template="true"] .kpv-field i:nth-child(2){border-color:color-mix(in srgb,var(--kpv-accent-alt) 60%,transparent);background:color-mix(in srgb,var(--kpv-accent-alt) 18%,transparent)}.kpv-stage[data-auto-template="true"] .kpv-field i:nth-child(4){border-color:color-mix(in srgb,var(--kpv-accent-alt) 52%,transparent)}.kpv-stage[data-auto-template="true"] .kpv-field i:nth-child(5){background:var(--kpv-accent-alt);box-shadow:0 0 0 8px color-mix(in srgb,var(--kpv-accent-alt) 13%,transparent),0 0 22px var(--kpv-accent-alt)}
        .kpv-stage[data-scene="split"] .kpv-field i:nth-child(1){left:49%;top:-18%;width:4px;height:130%;border:0;background:var(--kpv-accent);opacity:.32;transform:rotate(29deg);animation:kpv-split-beam 5s ease-in-out infinite}.kpv-stage[data-scene="split"] .kpv-field i:nth-child(3){bottom:51%;transform:rotate(-29deg);animation-duration:7s}.kpv-stage[data-scene="stack"] .kpv-field i:nth-child(1),.kpv-stage[data-scene="stack"] .kpv-field i:nth-child(6){left:50%;top:50%;transform:translate(-50%,-50%) rotate(0);animation:kpv-stack-ring 9s ease-in-out infinite}.kpv-stage[data-scene="impact"] .kpv-field i:nth-child(1){left:50%;top:50%;width:120vw;height:1px;border:0;background:var(--kpv-accent);transform:translate(-50%,-50%) rotate(-18deg);animation:kpv-impact-slice 2.8s cubic-bezier(.2,.85,.2,1) infinite}.kpv-stage[data-scene="impact"] .kpv-field i:nth-child(2){right:16%;top:28%;border-radius:0;transform:rotate(45deg);animation:kpv-field-bob 2.2s ease-in-out infinite}.kpv-stage[data-scene="orbit"] .kpv-field i:nth-child(1),.kpv-stage[data-scene="orbit"] .kpv-field i:nth-child(4){left:50%;top:50%;right:auto;bottom:auto;transform:translate(-50%,-50%);animation:kpv-orbit-spin 13s linear infinite}.kpv-stage[data-scene="orbit"] .kpv-field i:nth-child(4){width:min(74vw,950px);height:min(36vw,450px);animation-direction:reverse;animation-duration:19s}
        /* GPU-only beat rig: nine stage lights read the already-smoothed analyser
           variable, so the background evolves with the song without a canvas loop. */
        .kpv-beat-rig{position:absolute;z-index:1;left:7%;right:7%;bottom:12%;height:18vh;display:flex;align-items:flex-end;justify-content:space-between;gap:clamp(7px,1.2vw,20px);pointer-events:none;opacity:.42;mix-blend-mode:screen;transform-origin:50% 100%;transition:opacity .18s linear}.kpv-beat-rig i{--kpv-rig:1;display:block;flex:1;min-width:2px;max-width:18px;height:100%;border:1px solid color-mix(in srgb,var(--kpv-accent) 60%,transparent);background:linear-gradient(to top,color-mix(in srgb,var(--kpv-accent) 42%,transparent),transparent 70%);transform-origin:bottom;transform:scaleY(calc(.08 + var(--kpv-energy,0) * var(--kpv-rig)));transition:transform .12s cubic-bezier(.17,.82,.28,1);will-change:transform}.kpv-beat-rig i:nth-child(1),.kpv-beat-rig i:nth-child(9){--kpv-rig:.42;height:54%}.kpv-beat-rig i:nth-child(2),.kpv-beat-rig i:nth-child(8){--kpv-rig:.68;height:72%}.kpv-beat-rig i:nth-child(3),.kpv-beat-rig i:nth-child(7){--kpv-rig:.93;height:86%}.kpv-beat-rig i:nth-child(4),.kpv-beat-rig i:nth-child(6){--kpv-rig:.78;height:64%}.kpv-beat-rig i:nth-child(5){--kpv-rig:1.18;height:100%;background:linear-gradient(to top,var(--kpv-accent),transparent 78%);box-shadow:0 0 24px color-mix(in srgb,var(--kpv-accent) 55%,transparent)}.kpv-stage[data-auto-template="true"] .kpv-beat-rig i:nth-child(odd){border-color:color-mix(in srgb,var(--kpv-accent-alt) 68%,transparent);background:linear-gradient(to top,color-mix(in srgb,var(--kpv-accent-alt) 54%,transparent),transparent 70%)}.kpv-stage[data-auto-template="true"] .kpv-beat-rig i:nth-child(5){background:linear-gradient(to top,var(--kpv-accent-alt),transparent 78%);box-shadow:0 0 24px color-mix(in srgb,var(--kpv-accent-alt) 55%,transparent)}.kpv-stage[data-scene="poster"] .kpv-beat-rig{left:7%;right:auto;width:18%;bottom:15%;height:34vh;transform:skewY(-10deg)}.kpv-stage[data-scene="poster"] .kpv-beat-rig i{max-width:5px}.kpv-stage[data-scene="split"] .kpv-beat-rig{left:13%;right:13%;bottom:46%;height:9vh;transform:rotate(-20deg)}.kpv-stage[data-scene="stack"] .kpv-beat-rig{left:50%;right:auto;bottom:18%;width:min(52vw,700px);height:12vh;transform:translateX(-50%)}.kpv-stage[data-scene="impact"] .kpv-beat-rig{bottom:8%;height:29vh;opacity:.62;transform:skewX(-18deg)}.kpv-stage[data-scene="orbit"] .kpv-beat-rig{left:50%;right:auto;bottom:13%;width:min(48vw,680px);height:20vh;transform:translateX(-50%) rotate(6deg)}.kpv-preset--emotion-cinema .kpv-beat-rig,.kpv-preset--fly-me-to-the-moon .kpv-beat-rig,.kpv-preset--haruhikage .kpv-beat-rig{opacity:.18;mix-blend-mode:soft-light}.kpv-preset--blue-structure .kpv-beat-rig{bottom:10%;opacity:.26}.kpv-preset--blue-structure .kpv-beat-rig i{border-radius:999px}.kpv-preset--matrix .kpv-beat-rig,.kpv-preset--night-city .kpv-beat-rig{opacity:.64}.kpv-preset--matrix .kpv-beat-rig i,.kpv-preset--night-city .kpv-beat-rig i{max-width:10px;border-radius:0}.kpv-preset--sweet-pink .kpv-beat-rig i{border-radius:999px;background:linear-gradient(to top,rgba(255,255,255,.74),transparent)}.kpv-stage--paused .kpv-beat-rig{opacity:.14}        /* Song acts keep the selected template intact but give a complete song
           an opening, build, peak and release instead of one endless loop. */
        .kpv-stage[data-act="intro"]::before{opacity:.12;animation-duration:18s}.kpv-stage[data-act="intro"] .kpv-field{opacity:.34}.kpv-stage[data-act="intro"] .kpv-beat-rig{opacity:calc(.12 + var(--kpv-energy,0) * .22)}.kpv-stage[data-act="intro"] .kpv-lines{animation-duration:28s}.kpv-stage[data-act="rise"]::before{opacity:.27;animation-duration:10s}.kpv-stage[data-act="rise"] .kpv-field{opacity:.56}.kpv-stage[data-act="rise"] .kpv-beat-rig{opacity:calc(.28 + var(--kpv-energy,0) * .34)}.kpv-stage[data-act="rise"] .kpv-lines{animation-duration:13s}.kpv-stage[data-act="peak"]::before{opacity:.4;animation-duration:6.5s}.kpv-stage[data-act="peak"] .kpv-field{opacity:.68}.kpv-stage[data-act="peak"] .kpv-field i:nth-child(1){animation-duration:8s}.kpv-stage[data-act="peak"] .kpv-beat-rig{opacity:calc(.48 + var(--kpv-energy,0) * .46)}.kpv-stage[data-act="peak"] .kpv-frame{transform:scale(1.015);border-width:2px;transition:transform .45s ease}.kpv-stage[data-act="peak"] .kpv-lines{animation-duration:7s}.kpv-stage[data-act="peak"] .kpv-keyframe{filter:drop-shadow(0 0 24px color-mix(in srgb,var(--kpv-accent) 28%,transparent))}.kpv-stage[data-act="outro"]::before{opacity:.16;animation-duration:20s}.kpv-stage[data-act="outro"]::after{opacity:.36}.kpv-stage[data-act="outro"] .kpv-field{opacity:.38}.kpv-stage[data-act="outro"] .kpv-beat-rig{opacity:calc(.16 + var(--kpv-energy,0) * .2)}.kpv-stage[data-act="outro"] .kpv-lines{animation-duration:24s}.kpv-stage[data-act="outro"] .kpv-echoes{opacity:.28}        /* Repeated chorus lines receive a recognisable hook shot: the current
           template remains intact, while scale, frame and energy briefly peak. */
        .kpv-stage[data-hook="true"]::before{opacity:.48;animation-duration:4.8s}.kpv-stage[data-hook="true"] .kpv-field{opacity:.72}.kpv-stage[data-hook="true"] .kpv-beat-rig{opacity:calc(.52 + var(--kpv-energy,0) * .42)!important;height:26vh}.kpv-stage[data-hook="true"] .kpv-frame{border-width:2px;transform:scale(1.022)}.kpv-stage[data-hook="true"] .kpv-lines{opacity:min(.92,calc(var(--kpv-lines-opacity,.32) + .18));animation-duration:5.4s}.kpv-line--active[data-role="hook"] .kpv-copy{animation:kpv-hook-hit calc(.88s / var(--kpv-motion)) cubic-bezier(.08,.9,.2,1) both}.kpv-line--active[data-role="hook"] .kpv-words{font-weight:900;letter-spacing:-.055em}.kpv-line--active[data-role="hook"] .kpv-ghost{opacity:.68;transform:scale(1.1) rotate(-5deg)}.kpv-line--active[data-role="hook"] .kpv-keyframe{opacity:.72;filter:drop-shadow(0 0 28px color-mix(in srgb,var(--kpv-accent) 42%,transparent))}.kpv-preset--emotion-cinema .kpv-line--active[data-role="hook"] .kpv-copy{border-left-color:#fff1d8}.kpv-preset--sweet-pink .kpv-line--active[data-role="hook"] .kpv-words{letter-spacing:-.1em}.kpv-stage[data-quality="efficient"][data-hook="true"] .kpv-field{opacity:.48}.kpv-stage[data-quality="efficient"][data-hook="true"] .kpv-beat-rig{height:14vh}        .kpv-stage[data-section="start"] .kpv-frame{animation:kpv-chapter-frame .72s cubic-bezier(.14,.88,.2,1) both}.kpv-stage[data-section="start"] .kpv-field{animation-name:kpv-chapter-field}.kpv-line--active[data-section="start"] .kpv-caption span{animation:kpv-chapter-tag .46s cubic-bezier(.1,.9,.2,1) both}.kpv-line--active[data-section="start"] .kpv-copy{animation:kpv-chapter-copy .62s cubic-bezier(.12,.88,.2,1) both}\n        .kpv-frame{position:absolute;inset:clamp(16px,3.4vw,54px);z-index:1;pointer-events:none;border:1px solid color-mix(in srgb,var(--kpv-accent) 36%,rgba(255,255,255,.22));clip-path:polygon(0 0,18% 0,18% 1px,82% 1px,82% 0,100% 0,100% 17%,calc(100% - 1px) 17%,calc(100% - 1px) 83%,100% 83%,100% 100%,82% 100%,82% calc(100% - 1px),18% calc(100% - 1px),18% 100%,0 100%,0 83%,1px 83%,1px 17%,0 17%)}
        .kpv-frame i{position:absolute;width:7px;height:7px;border:1px solid var(--kpv-accent)}.kpv-frame i:nth-child(1){left:-4px;top:-4px}.kpv-frame i:nth-child(2){right:-4px;top:-4px}.kpv-frame i:nth-child(3){right:-4px;bottom:-4px}.kpv-frame i:nth-child(4){left:-4px;bottom:-4px}
        .kpv-lines{position:absolute;inset:-3%;z-index:1;pointer-events:none;opacity:var(--kpv-lines-opacity,.32);background:repeating-linear-gradient(90deg,transparent 0 8.2vw,color-mix(in srgb,var(--kpv-accent) 14%,transparent) 8.2vw calc(8.2vw + 1px));mask-image:linear-gradient(90deg,transparent,black 24%,black 74%,transparent);will-change:transform,opacity;animation:kpv-lines-drift 18s linear infinite}
        .kpv-line{--kpv-line-opacity:0;position:absolute;inset:0;z-index:2;display:grid;place-items:center;padding:clamp(42px,8vw,140px);box-sizing:border-box;opacity:var(--kpv-line-opacity);transition:opacity .32s ease,transform calc(.6s / var(--kpv-motion)) cubic-bezier(.2,.86,.2,1),filter .45s ease;pointer-events:none;will-change:opacity,transform}.kpv-line--active{z-index:4;animation:kpv-line-in calc(.54s / var(--kpv-motion)) cubic-bezier(.18,.86,.2,1) both}.kpv-copy{position:relative;width:min(100%,1120px);transform:scale(var(--kpv-pulse,1));transform-origin:center;will-change:transform}.kpv-line--active .kpv-copy{animation:kpv-copy-hit calc(1.1s / var(--kpv-motion)) cubic-bezier(.2,.85,.25,1) both}.kpv-phrase-ribbon{position:absolute;z-index:1;left:-3%;right:-3%;top:50%;height:clamp(20px,3.8vw,58px);overflow:hidden;opacity:.5;transform:translateY(-50%) skewX(-15deg);pointer-events:none}.kpv-phrase-ribbon i{position:absolute;inset:0;background:linear-gradient(90deg,color-mix(in srgb,var(--kpv-accent) 8%,transparent),color-mix(in srgb,var(--kpv-accent) 62%,transparent),transparent);transform:scaleX(var(--kpv-phrase-progress,0));transform-origin:left;will-change:transform}.kpv-phrase-ribbon b{position:absolute;right:1.5%;top:50%;transform:translateY(-50%) skewX(15deg);font:700 8px/1 ui-monospace,monospace;letter-spacing:.15em;color:color-mix(in srgb,var(--kpv-accent) 72%,transparent);white-space:nowrap}.kpv-line--active[data-role="hook"] .kpv-phrase-ribbon{height:clamp(28px,5vw,74px);opacity:.68}.kpv-words{position:relative;z-index:2;max-width:100%;font-weight:780;line-height:1.08;letter-spacing:-.035em;text-wrap:balance;overflow-wrap:anywhere;text-shadow:0 2px 30px rgba(0,0,0,.25)}
        /* Two real text layers instead of background-clip:text. Electron's
           compositor can otherwise paint a gradient rectangle for CJK glyph
           spans, which is the source of the white blocks in the old stage. */
        .kpv-token{--kpv-fill:0%;--kpv-fill-ratio:0;position:relative;display:inline-block;color:var(--kpv-token-idle,rgba(246,245,239,.28));transition:filter .16s linear;white-space:pre}.kpv-token-base{display:block;color:var(--kpv-token-idle,rgba(246,245,239,.28))}.kpv-token-fill{position:absolute;inset:0;display:block;width:100%;color:var(--kpv-token-live,var(--kpv-accent));clip-path:inset(0 calc(100% - var(--kpv-fill)) 0 0);overflow:hidden;will-change:auto;pointer-events:none}.kpv-line--active .kpv-token-fill{will-change:clip-path}.kpv-token[data-state="live"]{filter:drop-shadow(0 0 7px color-mix(in srgb,var(--kpv-accent) 68%,transparent))}.kpv-token[data-emphasis="true"]::after{content:"";position:absolute;z-index:-1;left:.04em;right:.04em;bottom:-.16em;height:2px;background:var(--kpv-accent);box-shadow:0 0 10px color-mix(in srgb,var(--kpv-accent) 72%,transparent);transform:scaleX(var(--kpv-fill-ratio));transform-origin:left;opacity:.78;will-change:auto}.kpv-line--active .kpv-token[data-emphasis="true"]::after{will-change:transform}.kpv-token[data-emphasis="true"][data-state="live"] .kpv-token-motion{display:block;animation:kpv-phrase-emphasis .38s cubic-bezier(.08,.92,.18,1) both}.kpv-line--active[data-role="hook"] .kpv-token[data-emphasis="true"]::after{height:3px;opacity:1}
        /* Kinetic text treatments. The template chooses one by default, and
           every treatment reacts to the individual token timing/state. */
        .kpv-line--active.kpv-effect--slice .kpv-token{transition:transform .34s cubic-bezier(.15,.82,.22,1),opacity .24s ease}.kpv-line--active.kpv-effect--slice .kpv-token[data-state="waiting"]{opacity:.18;transform:translateY(60%) skewX(-18deg)}.kpv-line--active.kpv-effect--slice .kpv-token[data-state="live"]{animation:kpv-slice-in .32s cubic-bezier(.12,.86,.2,1) both}
        .kpv-line--active.kpv-effect--slash .kpv-token{transition:transform .28s cubic-bezier(.14,.84,.26,1),opacity .22s}.kpv-line--active.kpv-effect--slash .kpv-token:nth-child(odd)[data-state="waiting"]{opacity:0;transform:translate(-38px,22px) skewX(-28deg)}.kpv-line--active.kpv-effect--slash .kpv-token:nth-child(even)[data-state="waiting"]{opacity:0;transform:translate(38px,-22px) skewX(-28deg)}.kpv-line--active.kpv-effect--slash .kpv-token[data-state="live"]{animation:kpv-slash-hit .33s cubic-bezier(.12,.88,.2,1) both}
        .kpv-line--active.kpv-effect--stagger .kpv-token{transition:transform .35s cubic-bezier(.18,.8,.22,1),opacity .2s}.kpv-line--active.kpv-effect--stagger .kpv-token[data-state="waiting"]{opacity:.18;transform:translateY(var(--kpv-stagger))}.kpv-line--active.kpv-effect--stagger .kpv-token[data-state="live"]{animation:kpv-stagger-pop .4s cubic-bezier(.16,.9,.24,1) both}
        .kpv-line--active.kpv-effect--glitch .kpv-token[data-state="waiting"]{opacity:.14}.kpv-line--active.kpv-effect--glitch .kpv-token[data-state="live"]{animation:kpv-glitch .22s steps(2,end) 2;filter:drop-shadow(3px 0 #f25) drop-shadow(-3px 0 #5df)}.kpv-line--active.kpv-effect--glitch .kpv-token[data-state="done"]{text-shadow:1px 0 rgba(255,64,100,.7),-1px 0 rgba(70,220,255,.7)}
        .kpv-line--active.kpv-effect--typewriter .kpv-token{transition:opacity .13s linear,transform .18s ease}.kpv-line--active.kpv-effect--typewriter .kpv-token[data-state="waiting"]{opacity:0;transform:scale(.65)}.kpv-line--active.kpv-effect--typewriter .kpv-token[data-state="live"]{animation:kpv-type-pop .21s steps(2,end) both}.kpv-line--active.kpv-effect--typewriter .kpv-token[data-state="done"]{opacity:1}
        .kpv-line--active.kpv-effect--terminal .kpv-token{transition:opacity .12s linear,transform .16s steps(2,end)}.kpv-line--active.kpv-effect--terminal .kpv-token[data-state="waiting"]{opacity:0;transform:translateX(-.3em)}.kpv-line--active.kpv-effect--terminal .kpv-token[data-state="live"]{animation:kpv-terminal .19s steps(2,end) both}.kpv-line--active.kpv-effect--terminal .kpv-token[data-state="done"]::after{content:"_";position:absolute;right:-.18em;bottom:0;color:var(--kpv-accent);animation:kpv-caret .58s steps(2,end) infinite}
        .kpv-line--active.kpv-effect--scatter .kpv-token{transition:transform .48s cubic-bezier(.13,.83,.2,1),opacity .34s ease}.kpv-line--active.kpv-effect--scatter .kpv-token[data-state="waiting"]{opacity:0;transform:translate(var(--kpv-scatter-x),var(--kpv-scatter-y)) rotate(var(--kpv-scatter-r)) scale(.52)}.kpv-line--active.kpv-effect--scatter .kpv-token[data-state="live"]{animation:kpv-scatter-land .42s cubic-bezier(.12,.93,.22,1) both}
        .kpv-line--active.kpv-effect--orbit .kpv-token{transition:transform .42s cubic-bezier(.1,.8,.2,1),opacity .3s}.kpv-line--active.kpv-effect--orbit .kpv-token[data-state="waiting"]{opacity:0;transform:translate(var(--kpv-scatter-x),calc(var(--kpv-scatter-y) * -1)) rotate(var(--kpv-scatter-r)) scale(.5)}.kpv-line--active.kpv-effect--orbit .kpv-token[data-state="live"]{animation:kpv-orbit-land .55s cubic-bezier(.12,.84,.2,1) both}
        .kpv-line--active.kpv-effect--wave .kpv-token[data-state="waiting"]{opacity:.16;transform:translateY(18px)}.kpv-line--active.kpv-effect--wave .kpv-token[data-state="live"]{animation:kpv-wave .56s cubic-bezier(.18,.86,.2,1) both}.kpv-line--active.kpv-effect--wave .kpv-token[data-state="done"]{animation:kpv-wave-idle 1.45s ease-in-out calc(var(--kpv-index) * -90ms) infinite}
        .kpv-line--active.kpv-effect--shatter .kpv-token{transition:clip-path .32s ease,transform .32s ease,opacity .24s}.kpv-line--active.kpv-effect--shatter .kpv-token[data-state="waiting"]{opacity:0;clip-path:polygon(0 34%,100% 0,72% 100%,16% 72%);transform:scale(.4) rotate(var(--kpv-scatter-r))}.kpv-line--active.kpv-effect--shatter .kpv-token[data-state="live"]{animation:kpv-shatter-in .35s cubic-bezier(.1,.9,.2,1) both}
        .kpv-line--active.kpv-effect--cards .kpv-token{margin:0 .055em;padding:.06em .09em;transition:transform .28s cubic-bezier(.18,.86,.22,1),opacity .2s}.kpv-line--active.kpv-effect--cards .kpv-token::before{content:"";position:absolute;inset:6% 2%;z-index:-1;background:color-mix(in srgb,var(--kpv-accent) 56%,white);box-shadow:3px 3px 0 color-mix(in srgb,var(--kpv-accent) 35%,transparent);transform:scaleX(var(--kpv-fill-ratio));transform-origin:left;will-change:transform}.kpv-line--active.kpv-effect--cards .kpv-token[data-state="waiting"]{opacity:.15;transform:translateY(18px) rotate(var(--kpv-scatter-r))}.kpv-line--active.kpv-effect--cards .kpv-token[data-state="live"]{animation:kpv-card-pop .35s cubic-bezier(.12,.88,.24,1) both}
        .kpv-line--active.kpv-effect--float .kpv-token[data-state="waiting"],.kpv-line--active.kpv-effect--petal .kpv-token[data-state="waiting"]{opacity:0;transform:translateY(28px) rotate(var(--kpv-scatter-r))}.kpv-line--active.kpv-effect--float .kpv-token[data-state="live"],.kpv-line--active.kpv-effect--petal .kpv-token[data-state="live"]{animation:kpv-float-in .55s cubic-bezier(.12,.86,.2,1) both}.kpv-line--active.kpv-effect--float .kpv-token[data-state="done"]{animation:kpv-float-idle 2.4s ease-in-out calc(var(--kpv-index) * -130ms) infinite}.kpv-line--active.kpv-effect--petal .kpv-token[data-state="done"]{animation:kpv-petal-idle 2.8s ease-in-out calc(var(--kpv-index) * -100ms) infinite}
        .kpv-line--active.kpv-effect--pixel .kpv-token{transition:transform .15s steps(2,end),opacity .12s}.kpv-line--active.kpv-effect--pixel .kpv-token[data-state="waiting"]{opacity:0;transform:translate(12px,12px) scale(.7)}.kpv-line--active.kpv-effect--pixel .kpv-token[data-state="live"]{animation:kpv-pixel-in .2s steps(3,end) both}.kpv-line--active.kpv-effect--stamp .kpv-token[data-state="waiting"]{opacity:.08;transform:scale(1.55) rotate(-8deg)}.kpv-line--active.kpv-effect--stamp .kpv-token[data-state="live"]{animation:kpv-stamp .3s cubic-bezier(.1,.9,.2,1) both}
        .kpv-line--active.kpv-effect--fade .kpv-token[data-state="waiting"]{opacity:.1;filter:blur(8px)}.kpv-line--active.kpv-effect--fade .kpv-token[data-state="live"]{animation:kpv-fade-focus .48s ease both}.kpv-line--active.kpv-effect--slide .kpv-token{transition:transform .37s cubic-bezier(.12,.84,.2,1),opacity .3s}.kpv-line--active.kpv-effect--slide .kpv-token[data-state="waiting"]{opacity:0;transform:translateX(calc(var(--kpv-stagger) * 5))}.kpv-line--active.kpv-effect--slide .kpv-token[data-state="live"]{animation:kpv-slide-in .4s cubic-bezier(.1,.86,.2,1) both}
        /* Template-native compositions: card boards, fragmented impact words,
           outline heroes and terminal grids. These deliberately override the
           normal inline lyric layout rather than merely styling the same row. */
        .kpv-line--active.kpv-layout--vertical-columns .kpv-copy{height:min(68vh,720px);width:min(94vw,1180px);padding:0}.kpv-line--active.kpv-layout--vertical-columns .kpv-phrase-ribbon{left:10%;right:10%;top:auto;bottom:1.5%;height:7px;opacity:.74;transform:skewX(-15deg)}.kpv-line--active.kpv-layout--vertical-columns .kpv-phrase-ribbon b{display:none}.kpv-line--active.kpv-layout--vertical-columns .kpv-words{position:relative;width:100%;height:100%;max-width:none;font-size:clamp(42px,7vw,112px)!important;line-height:1;overflow:visible;text-wrap:initial}.kpv-line--active.kpv-layout--vertical-columns .kpv-token{position:absolute;left:var(--kpv-slot-x);top:var(--kpv-slot-y);z-index:2;padding:.14em .18em;font-size:calc(1em * var(--kpv-slot-scale));transform:translate(-50%,-50%) rotate(var(--kpv-slot-r))!important;transition:opacity .18s ease;will-change:opacity}.kpv-line--active.kpv-layout--vertical-columns .kpv-token-motion{position:relative;display:block}.kpv-line--active.kpv-layout--vertical-columns .kpv-token-motion::before{content:"";position:absolute;z-index:-1;inset:-.07em;background:rgba(255,255,255,.18);transform:translate(7px,9px);box-shadow:0 8px 18px rgba(0,0,0,.18)}.kpv-preset--blue-structure .kpv-layout--vertical-columns .kpv-token,.kpv-preset--kawaii-pixel .kpv-layout--vertical-columns .kpv-token{background:#fbfbf8;color:#111;box-shadow:8px 10px 0 rgba(0,35,170,.2),0 15px 28px rgba(0,34,130,.17)}.kpv-preset--blue-structure .kpv-layout--vertical-columns .kpv-token-base,.kpv-preset--kawaii-pixel .kpv-layout--vertical-columns .kpv-token-base{color:#131313}.kpv-preset--blue-structure .kpv-layout--vertical-columns .kpv-token-fill,.kpv-preset--kawaii-pixel .kpv-layout--vertical-columns .kpv-token-fill{color:#1540df}.kpv-preset--cyber-grunge .kpv-layout--vertical-columns .kpv-token,.kpv-preset--crime-scene .kpv-layout--vertical-columns .kpv-token{background:repeating-linear-gradient(0deg,#f2f0e9 0 2px,#d6d2ca 2px 3px);color:#070707;box-shadow:5px 6px 0 rgba(255,255,255,.12),0 14px 28px rgba(0,0,0,.45)}.kpv-preset--cyber-grunge .kpv-layout--vertical-columns .kpv-token-base,.kpv-preset--crime-scene .kpv-layout--vertical-columns .kpv-token-base{color:#070707}.kpv-preset--cyber-grunge .kpv-layout--vertical-columns .kpv-token-fill,.kpv-preset--crime-scene .kpv-layout--vertical-columns .kpv-token-fill{color:#c70019}.kpv-line--active.kpv-layout--vertical-columns .kpv-token[data-state="waiting"]{opacity:.22}.kpv-line--active.kpv-layout--vertical-columns .kpv-token[data-state="live"] .kpv-token-base{animation:kpv-card-face .32s cubic-bezier(.08,.9,.2,1) both}.kpv-line--active.kpv-layout--vertical-columns .kpv-token[data-emphasis="true"]{z-index:3;filter:drop-shadow(0 0 12px color-mix(in srgb,var(--kpv-accent) 48%,transparent))}
        .kpv-line--active.kpv-layout--blue-cards .kpv-copy,.kpv-line--active.kpv-layout--grunge-cards .kpv-copy,.kpv-line--active.kpv-layout--impact-scatter .kpv-copy{height:min(66vh,700px);width:min(96vw,1180px);padding:0}.kpv-line--active.kpv-layout--blue-cards .kpv-phrase-ribbon,.kpv-line--active.kpv-layout--grunge-cards .kpv-phrase-ribbon,.kpv-line--active.kpv-layout--impact-scatter .kpv-phrase-ribbon{left:9%;right:9%;top:89%;height:8px;opacity:.7;transform:skewX(-15deg)}.kpv-line--active.kpv-layout--blue-cards .kpv-phrase-ribbon b,.kpv-line--active.kpv-layout--grunge-cards .kpv-phrase-ribbon b,.kpv-line--active.kpv-layout--impact-scatter .kpv-phrase-ribbon b{display:none}.kpv-line--active.kpv-layout--blue-cards .kpv-words,.kpv-line--active.kpv-layout--grunge-cards .kpv-words,.kpv-line--active.kpv-layout--impact-scatter .kpv-words{position:relative;width:100%;height:100%;max-width:none;font-size:clamp(42px,7.2vw,116px)!important;line-height:1;overflow:visible;text-wrap:initial}
        .kpv-line--active.kpv-layout--blue-cards .kpv-token,.kpv-line--active.kpv-layout--grunge-cards .kpv-token,.kpv-line--active.kpv-layout--impact-scatter .kpv-token{position:absolute;left:var(--kpv-slot-x);top:var(--kpv-slot-y);z-index:2;padding:.14em .19em;font-size:calc(1em * var(--kpv-slot-scale));transform:translate(-50%,-50%) rotate(var(--kpv-slot-r))!important;transition:opacity .18s ease;will-change:opacity}.kpv-line--active.kpv-layout--blue-cards .kpv-token{background:#fbfbf8;color:#111;box-shadow:8px 10px 0 rgba(0,35,170,.2),0 15px 28px rgba(0,34,130,.17)}.kpv-line--active.kpv-layout--blue-cards .kpv-token-base{color:#131313}.kpv-line--active.kpv-layout--blue-cards .kpv-token-fill{color:#1540df}.kpv-line--active.kpv-layout--blue-cards .kpv-words::before,.kpv-line--active.kpv-layout--blue-cards .kpv-words::after{content:"";position:absolute;border-radius:50%;background:#0c39cb;z-index:0;box-shadow:0 0 0 8px rgba(255,255,255,.15)}.kpv-line--active.kpv-layout--blue-cards .kpv-words::before{width:clamp(48px,8vw,126px);height:clamp(48px,8vw,126px);left:5%;top:21%;animation:kpv-board-dot 4s ease-in-out infinite}.kpv-line--active.kpv-layout--blue-cards .kpv-words::after{width:clamp(36px,5vw,76px);height:clamp(36px,5vw,76px);right:8%;bottom:17%;animation:kpv-board-dot 3.2s ease-in-out -1.4s infinite}
        .kpv-line--active.kpv-layout--grunge-cards .kpv-token{background:repeating-linear-gradient(0deg,#f2f0e9 0 2px,#d6d2ca 2px 3px);color:#070707;box-shadow:5px 6px 0 rgba(255,255,255,.12),0 14px 28px rgba(0,0,0,.45)}.kpv-line--active.kpv-layout--grunge-cards .kpv-token-base{color:#070707}.kpv-line--active.kpv-layout--grunge-cards .kpv-token-fill{color:#c70019}.kpv-line--active.kpv-layout--grunge-cards .kpv-words::before{content:"SIGNAL / 00  NOISE  001101  //";position:absolute;left:8%;bottom:4%;font:700 12px ui-monospace,monospace;letter-spacing:.16em;color:rgba(255,255,255,.52);animation:kpv-noise-text 1s steps(2) infinite}.kpv-line--active.kpv-layout--grunge-cards .kpv-token[data-state="waiting"],.kpv-line--active.kpv-layout--blue-cards .kpv-token[data-state="waiting"]{opacity:.22}.kpv-line--active.kpv-layout--grunge-cards .kpv-token[data-state="live"] .kpv-token-base,.kpv-line--active.kpv-layout--blue-cards .kpv-token[data-state="live"] .kpv-token-base{animation:kpv-card-face .32s cubic-bezier(.08,.9,.2,1) both}
        .kpv-line--active.kpv-layout--impact-scatter .kpv-token{padding:.02em;background:transparent;color:#eef0ff;text-shadow:6px 7px 0 rgba(0,0,0,.34);font-weight:900}.kpv-line--active.kpv-layout--impact-scatter .kpv-token-base{color:rgba(238,240,255,.78);-webkit-text-stroke:1px rgba(255,255,255,.85)}.kpv-line--active.kpv-layout--impact-scatter .kpv-token-fill{color:#fff;-webkit-text-stroke:1px #fff}.kpv-line--active.kpv-layout--impact-scatter .kpv-token::before{content:"";position:absolute;z-index:-1;inset:18% -10%;background:#fff;opacity:.17;transform:rotate(45deg) scale(0);transition:transform .26s cubic-bezier(.1,.9,.2,1)}.kpv-line--active.kpv-layout--impact-scatter .kpv-token[data-state="live"]::before{transform:rotate(45deg) scale(1)}.kpv-line--active.kpv-layout--impact-scatter .kpv-token[data-state="waiting"]{opacity:.1}.kpv-line--active.kpv-layout--impact-scatter .kpv-token[data-state="live"] .kpv-token-base{animation:kpv-impact-glyph .35s cubic-bezier(.06,.9,.18,1) both}
        .kpv-line--active.kpv-layout--outline-hero .kpv-copy{width:min(94%,1320px);text-align:center}.kpv-line--active.kpv-layout--outline-hero .kpv-caption,.kpv-line--active.kpv-layout--outline-hero .kpv-meter{margin-left:auto;margin-right:auto;justify-content:center}.kpv-line--active.kpv-layout--outline-hero .kpv-words{font-size:clamp(44px,7.4vw,124px)!important;font-weight:900;letter-spacing:-.09em}.kpv-line--active.kpv-layout--outline-hero .kpv-token-base{color:transparent;-webkit-text-stroke:2px currentColor}.kpv-line--active.kpv-layout--outline-hero .kpv-token-fill{-webkit-text-stroke:2px currentColor}.kpv-line--active.kpv-layout--outline-hero .kpv-token[data-state="live"]{animation:kpv-outline-flash .52s ease both}.kpv-line--active.kpv-layout--outline-hero .kpv-translation{margin-left:auto;margin-right:auto}
        .kpv-line--active.kpv-layout--terminal-board .kpv-copy{width:min(90%,1020px);padding:clamp(18px,4vw,56px);border:1px solid color-mix(in srgb,var(--kpv-accent) 65%,transparent);background:rgba(0,0,0,.16);box-shadow:0 0 0 12px rgba(0,0,0,.08)}.kpv-line--active.kpv-layout--terminal-board .kpv-words{font-family:ui-monospace,Consolas,monospace!important;letter-spacing:.09em}.kpv-line--active.kpv-layout--terminal-board .kpv-token{padding:.05em .08em;border:1px solid transparent}.kpv-line--active.kpv-layout--terminal-board .kpv-token[data-state="live"]{border-color:var(--kpv-accent);box-shadow:0 0 12px color-mix(in srgb,var(--kpv-accent) 55%,transparent)}.kpv-line--active.kpv-layout--terminal-board .kpv-copy::after{content:"LIVE COMPOSITOR / FRAME 60";position:absolute;right:12px;bottom:10px;font:10px ui-monospace,monospace;letter-spacing:.12em;opacity:.55}
        .kpv-line--active.kpv-layout--orbit-board .kpv-words{padding:1.2em 0;text-align:center}.kpv-line--active.kpv-layout--orbit-board .kpv-token{display:inline-block;margin:0 .03em}.kpv-line--active.kpv-layout--orbit-board .kpv-token:nth-child(odd){transform:translateY(-.23em) rotate(-5deg)}.kpv-line--active.kpv-layout--orbit-board .kpv-token:nth-child(even){transform:translateY(.17em) rotate(4deg)}.kpv-line--active.kpv-layout--stagger-board .kpv-words{max-width:78%;line-height:1.32}.kpv-line--active.kpv-layout--stagger-board .kpv-token:nth-child(3n){font-size:1.34em}.kpv-line--active.kpv-layout--stagger-board .kpv-token:nth-child(3n + 1){transform:translateY(-.31em)}.kpv-line--active.kpv-layout--split-hero .kpv-words{max-width:76%;letter-spacing:.08em}.kpv-line--active.kpv-layout--cinema-hero .kpv-words{font-family:"Noto Serif SC","Songti SC",serif!important;font-weight:600;letter-spacing:.04em}
                /* Rhythm boards make a long quotation, short exclamation and fast Latin
           passage read as different shots even inside the same template. */
        .kpv-line--active.kpv-layout--quote-board .kpv-copy{width:min(88%,1160px);padding:clamp(18px,3vw,46px) clamp(24px,5vw,80px);border-left:2px solid var(--kpv-accent);border-right:1px solid color-mix(in srgb,var(--kpv-accent) 45%,transparent);background:linear-gradient(90deg,color-mix(in srgb,var(--kpv-accent) 8%,transparent),transparent 72%)}.kpv-line--active.kpv-layout--quote-board .kpv-words{max-width:100%;font-size:clamp(36px,5.1vw,86px)!important;line-height:1.26;letter-spacing:.035em;text-wrap:balance}.kpv-line--active.kpv-layout--quote-board .kpv-words::before,.kpv-line--active.kpv-layout--quote-board .kpv-words::after{position:absolute;z-index:-1;font:900 clamp(100px,19vw,300px)/.6 Georgia,serif;color:color-mix(in srgb,var(--kpv-accent) 22%,transparent);pointer-events:none}.kpv-line--active.kpv-layout--quote-board .kpv-words::before{content:"“";left:-.28em;top:-.05em}.kpv-line--active.kpv-layout--quote-board .kpv-words::after{content:"”";right:-.18em;bottom:-.18em}.kpv-line--active.kpv-layout--quote-board .kpv-keyframe{--kpv-key-x:84%;--kpv-key-y:20%;--kpv-key-scale:.52;opacity:.34}.kpv-line--active.kpv-layout--quote-board .kpv-translation{max-width:100%;letter-spacing:.12em}.kpv-line--active.kpv-layout--ticker-board .kpv-copy{width:min(94%,1260px);padding:clamp(16px,2.6vw,38px) 0;border-top:1px solid var(--kpv-accent);border-bottom:1px solid color-mix(in srgb,var(--kpv-accent) 62%,transparent);text-align:center}.kpv-line--active.kpv-layout--ticker-board .kpv-words{width:max-content;min-width:100%;max-width:none;font:800 clamp(30px,min(7vw,calc(70vw / max(1,var(--kpv-token-count)))),116px)/1 "Outfit","Inter",sans-serif!important;letter-spacing:.12em;text-transform:uppercase;white-space:nowrap}.kpv-line--active.kpv-layout--ticker-board .kpv-words::before{content:"TYPE / BEAT / TYPE / BEAT / TYPE / BEAT";position:absolute;left:0;right:0;top:-1.8em;overflow:hidden;color:color-mix(in srgb,var(--kpv-accent) 40%,transparent);font:700 10px/1 ui-monospace,monospace;letter-spacing:.35em;white-space:nowrap;animation:kpv-ticker-meta 8s linear infinite}.kpv-line--active.kpv-layout--ticker-board .kpv-keyframe{--kpv-key-x:11%;--kpv-key-y:72%;--kpv-key-scale:.5;opacity:.32}.kpv-line--active.kpv-layout--emblem-board .kpv-copy{width:min(84%,920px);text-align:center}.kpv-line--active.kpv-layout--emblem-board .kpv-caption,.kpv-line--active.kpv-layout--emblem-board .kpv-meter{margin-left:auto;margin-right:auto;justify-content:center}.kpv-line--active.kpv-layout--emblem-board .kpv-words{font-size:clamp(76px,13vw,220px)!important;line-height:.86;letter-spacing:-.09em;font-weight:900}.kpv-line--active.kpv-layout--emblem-board .kpv-token{margin:0 .015em}.kpv-line--active.kpv-layout--emblem-board .kpv-token[data-state="done"]{text-shadow:0 0 34px color-mix(in srgb,var(--kpv-accent) 38%,transparent)}.kpv-line--active.kpv-layout--emblem-board .kpv-keyframe{--kpv-key-x:79%;--kpv-key-y:34%;--kpv-key-scale:.82;opacity:.5}.kpv-line--active.kpv-layout--emblem-board .kpv-translation{margin-left:auto;margin-right:auto}.kpv-line--active[data-rhythm="rush"] .kpv-meter{height:4px;box-shadow:0 0 16px var(--kpv-accent)}.kpv-line--active[data-rhythm="rush"] .kpv-geometry i{animation-duration:2.6s}.kpv-caption{display:flex;align-items:center;gap:10px;margin-bottom:clamp(10px,1.7vh,20px);font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:10px;letter-spacing:.18em;color:color-mix(in srgb,var(--kpv-accent) 70%,white)}.kpv-caption span{display:inline-grid;place-items:center;width:28px;height:16px;border:1px solid color-mix(in srgb,var(--kpv-accent) 60%,transparent);font-size:9px}.kpv-caption b{font-weight:600}.kpv-caption em{margin-left:auto;font-style:normal;opacity:.54;font-size:8px;letter-spacing:.12em}
        .kpv-translation{position:relative;z-index:2;max-width:78%;margin-top:.65em;color:rgba(255,255,255,.75);font-weight:500;line-height:1.42;letter-spacing:.04em;isolation:isolate}.kpv-translation::before{content:"";position:absolute;z-index:-1;left:-.45em;right:-.6em;bottom:-.28em;height:1px;background:color-mix(in srgb,var(--kpv-accent) 48%,transparent);transform:scaleX(var(--kpv-phrase-progress,0));transform-origin:left;will-change:transform}.kpv-translation-base{display:block;color:rgba(255,255,255,.58)}.kpv-translation-fill{position:absolute;inset:0;display:block;color:color-mix(in srgb,var(--kpv-accent) 72%,white);clip-path:inset(0 calc(100% - var(--kpv-phrase-reveal,0%)) 0 0);overflow:hidden;white-space:inherit;will-change:clip-path;text-shadow:0 0 13px color-mix(in srgb,var(--kpv-accent) 36%,transparent)}.kpv-line:not(.kpv-line--active) .kpv-translation-fill{display:none}.kpv-line--active[data-role="hook"] .kpv-translation{font-weight:700;letter-spacing:.08em}.kpv-line--active[data-role="hook"] .kpv-translation::before{height:2px;background:var(--kpv-accent)}.kpv-stage[data-quality="efficient"] .kpv-translation-fill{will-change:auto;text-shadow:none}.kpv-meter{position:relative;z-index:2;width:min(52%,500px);height:2px;margin-top:clamp(22px,4vh,46px);background:rgba(255,255,255,.14);transform-origin:left}.kpv-meter i{display:block;width:100%;height:100%;transform:scaleX(0);transform-origin:left;background:var(--kpv-accent);box-shadow:0 0 12px var(--kpv-accent);will-change:transform}
        .kpv-ghost{position:absolute;z-index:0;max-width:90%;overflow:hidden;color:transparent;-webkit-text-stroke:1px color-mix(in srgb,var(--kpv-accent) 28%,transparent);font-size:clamp(60px,13vw,220px);font-weight:900;letter-spacing:-.09em;line-height:.76;white-space:nowrap;opacity:.46;pointer-events:none;user-select:none}
        .kpv-echoes{position:absolute;inset:0;z-index:0;overflow:hidden;pointer-events:none;opacity:0}.kpv-echoes b{position:absolute;display:block;max-width:76%;overflow:hidden;white-space:nowrap;font:800 clamp(13px,1.65vw,28px)/1 "Zen Kaku Gothic New","Noto Sans JP",sans-serif;letter-spacing:.12em;color:color-mix(in srgb,var(--kpv-accent) 54%,transparent);mix-blend-mode:screen}.kpv-line--active .kpv-echoes{opacity:.5}.kpv-line--active .kpv-echoes b:first-child{right:-6%;top:22%;animation:kpv-echo-forward 5.6s linear infinite}.kpv-line--active .kpv-echoes b:last-child{left:-7%;bottom:20%;opacity:.45;animation:kpv-echo-reverse 6.8s linear infinite}.kpv-scene--poster .kpv-echoes b:first-child{writing-mode:vertical-rl;right:13%;top:18%;height:42%;white-space:normal}.kpv-scene--split .kpv-echoes b:last-child{left:8%;bottom:18%;transform:rotate(-12deg)}.kpv-scene--stack .kpv-echoes b{left:50%!important;top:50%!important;right:auto!important;bottom:auto!important;transform:translate(-50%,-50%) rotate(-6deg) scale(1.55);opacity:.26!important;animation:kpv-echo-pulse 4s ease-in-out infinite!important}.kpv-scene--impact .kpv-echoes b:first-child{top:14%;right:9%;font-size:clamp(18px,2.8vw,48px);transform:rotate(-4deg)}.kpv-scene--orbit .kpv-echoes b{left:50%!important;top:50%!important;right:auto!important;bottom:auto!important;transform:translate(-50%,-50%) rotate(12deg);animation:kpv-echo-orbit 11s linear infinite!important}
        /* A compositional cue is intentionally separate from timed token faces:
           it gives each lyric cut a large focal motif while the KTV fill stays legible. */
        .kpv-keyframe{position:absolute;z-index:1;left:var(--kpv-key-x,50%);top:var(--kpv-key-y,50%);display:grid;place-items:center;width:min(34vw,470px);aspect-ratio:1;transform:translate(-50%,-50%) rotate(var(--kpv-key-rotate,-8deg)) scale(var(--kpv-key-scale,1));pointer-events:none;opacity:0;mix-blend-mode:screen}.kpv-keyframe::before,.kpv-keyframe::after{content:"";position:absolute;inset:12%;border:1px solid color-mix(in srgb,var(--kpv-accent) 42%,transparent);transform:rotate(45deg)}.kpv-keyframe::after{inset:28%;border-style:dashed;animation:kpv-keyframe-orbit 11s linear infinite}.kpv-keyframe span{position:absolute;top:2%;left:5%;font:700 9px/1 ui-monospace,monospace;letter-spacing:.16em;color:color-mix(in srgb,var(--kpv-accent) 70%,transparent)}.kpv-keyframe b{position:relative;z-index:1;font:900 clamp(88px,16vw,278px)/.75 "Outfit","Zen Kaku Gothic New","Noto Sans SC",sans-serif;color:transparent;-webkit-text-stroke:1px color-mix(in srgb,var(--kpv-accent) 54%,transparent);text-shadow:0 0 32px color-mix(in srgb,var(--kpv-accent) 22%,transparent)}.kpv-keyframe i{position:absolute;z-index:2;right:3%;bottom:11%;font:800 clamp(28px,5vw,88px)/1 "Outfit","Zen Kaku Gothic New","Noto Sans SC",sans-serif;font-style:normal;color:var(--kpv-accent);transform:translate(38%,35%)}.kpv-keyframe--pair b{font-size:clamp(76px,13vw,208px);letter-spacing:-.08em}.kpv-keyframe--phrase b{font-size:clamp(56px,9.8vw,154px);letter-spacing:-.1em;line-height:.82}.kpv-keyframe--pair i{font-size:clamp(23px,3.8vw,62px)}.kpv-keyframe--phrase i{font-size:clamp(18px,2.8vw,42px);right:-2%;bottom:7%;transform:translate(32%,35%)}.kpv-line--active .kpv-keyframe{animation:kpv-keyframe-in calc(.72s / var(--kpv-motion)) cubic-bezier(.09,.86,.2,1) both}.kpv-line[data-live="true"] .kpv-keyframe b{animation:kpv-keyframe-breathe 1.8s ease-in-out infinite}.kpv-scene--poster .kpv-keyframe{--kpv-key-x:76%;--kpv-key-y:62%;--kpv-key-rotate:-13deg;--kpv-key-scale:1.08}.kpv-scene--split .kpv-keyframe{--kpv-key-x:21%;--kpv-key-y:65%;--kpv-key-rotate:25deg;--kpv-key-scale:.72}.kpv-scene--stack .kpv-keyframe{width:min(46vw,620px);--kpv-key-rotate:0deg;--kpv-key-scale:1.12;opacity:.2}.kpv-scene--impact .kpv-keyframe{--kpv-key-x:75%;--kpv-key-y:31%;--kpv-key-rotate:35deg;--kpv-key-scale:.78}.kpv-scene--orbit .kpv-keyframe{width:min(42vw,560px);--kpv-key-rotate:12deg;animation-name:kpv-keyframe-orbit-in!important}.kpv-layout--blue-cards .kpv-keyframe,.kpv-layout--grunge-cards .kpv-keyframe{--kpv-key-x:17%;--kpv-key-y:20%;width:min(20vw,270px);--kpv-key-rotate:-10deg;--kpv-key-scale:.76;opacity:.72}.kpv-layout--blue-cards .kpv-keyframe::before,.kpv-layout--grunge-cards .kpv-keyframe::before{border-radius:0;background:color-mix(in srgb,var(--kpv-accent) 8%,transparent)}.kpv-preset--emotion-cinema .kpv-keyframe{mix-blend-mode:soft-light}.kpv-preset--emotion-cinema .kpv-keyframe b,.kpv-preset--fly-me-to-the-moon .kpv-keyframe b,.kpv-preset--haruhikage .kpv-keyframe b{font-family:"Shippori Mincho","Noto Serif SC",serif}.kpv-preset--cyber-grunge .kpv-keyframe,.kpv-preset--crime-scene .kpv-keyframe{mix-blend-mode:screen}.kpv-preset--kawaii-pixel .kpv-keyframe b{font-family:"DotGothic16",monospace;-webkit-text-stroke:2px #5b55b8}.kpv-preset--sweet-pink .kpv-keyframe::before{border-radius:50%;border-width:2px}.kpv-script--cjk .kpv-keyframe b,.kpv-script--cjk .kpv-keyframe i{font-family:"Noto Sans SC","Microsoft YaHei",sans-serif}.kpv-script--jp .kpv-keyframe b,.kpv-script--jp .kpv-keyframe i{font-family:"Zen Kaku Gothic New","Noto Sans JP",sans-serif}.kpv-preset--emotion-cinema .kpv-script--cjk .kpv-keyframe b{font-family:"Ma Shan Zheng","Noto Serif SC",serif;font-weight:400}.kpv-preset--paper-cut .kpv-script--cjk .kpv-keyframe b{font-family:"ZCOOL KuaiLe","Noto Sans SC",sans-serif;font-weight:400}
        .kpv-geometry{position:absolute;inset:0;z-index:0;pointer-events:none}.kpv-geometry i{position:absolute;display:block;border:1px solid color-mix(in srgb,var(--kpv-accent) 44%,transparent);opacity:.74}
        .kpv-burst{position:absolute;inset:0;z-index:1;overflow:hidden;pointer-events:none}.kpv-burst i{position:absolute;display:block;width:24vw;height:2px;background:linear-gradient(90deg,transparent,var(--kpv-accent),transparent);opacity:0;transform-origin:left center}.kpv-burst i:nth-child(1){left:-8%;top:29%;transform:rotate(-11deg)}.kpv-burst i:nth-child(2){right:-11%;top:63%;transform:rotate(18deg)}.kpv-burst i:nth-child(3){left:24%;bottom:8%;transform:rotate(-52deg)}.kpv-burst i:nth-child(4){right:17%;top:8%;transform:rotate(63deg)}.kpv-line[data-live="true"] .kpv-burst i{animation:kpv-streak calc(1.3s / var(--kpv-motion)) cubic-bezier(.12,.75,.25,1) infinite}.kpv-line[data-live="true"] .kpv-burst i:nth-child(2){animation-delay:.18s}.kpv-line[data-live="true"] .kpv-burst i:nth-child(3){animation-delay:.36s}.kpv-line[data-live="true"] .kpv-burst i:nth-child(4){animation-delay:.54s}
        .kpv-line--previous{transform:translateY(-18vh) scale(.76);filter:blur(.15px)}.kpv-line--previous .kpv-copy{width:min(88%,840px)}.kpv-line--previous .kpv-words{font-size:clamp(23px,3.2vw,48px)!important;font-weight:560}.kpv-line--previous .kpv-caption,.kpv-line--previous .kpv-meter{display:none}.kpv-line--previous .kpv-ghost{transform:translateY(-1.2em);opacity:.15}.kpv-line--previous .kpv-token{--kpv-fill:100%!important}
        .kpv-line--next{transform:translateY(22vh) scale(.68);filter:blur(.35px)}.kpv-line--next .kpv-copy{width:min(82%,780px)}.kpv-line--next .kpv-words{font-size:clamp(20px,2.7vw,42px)!important;font-weight:500}.kpv-line--next .kpv-caption,.kpv-line--next .kpv-meter{display:none}.kpv-line--next .kpv-ghost{transform:translateY(1.4em);opacity:.12}
        .kpv-scene--poster .kpv-copy{padding-left:clamp(10px,8vw,116px)}.kpv-scene--poster .kpv-ghost{right:clamp(-18px,-3vw,0px);bottom:20%;transform:rotate(-7deg)}.kpv-scene--poster .kpv-geometry i:nth-child(1){left:11%;top:23%;width:33%;height:48%;border-width:0 0 1px 1px}.kpv-scene--poster .kpv-geometry i:nth-child(2){right:9%;bottom:17%;width:19vw;height:19vw;border-radius:50%}.kpv-scene--poster .kpv-geometry i:nth-child(3){left:0;right:0;top:51%;border-width:1px 0 0;transform:rotate(-6deg)}
        .kpv-scene--split .kpv-copy{width:min(84%,930px);transform:translateX(-12vw) scale(var(--kpv-pulse,1))}.kpv-scene--split .kpv-ghost{left:52%;top:21%;writing-mode:vertical-rl;white-space:normal;max-height:72%;font-size:clamp(76px,14vw,240px);letter-spacing:-.16em}.kpv-scene--split .kpv-geometry i:nth-child(1){left:51%;top:10%;bottom:10%;border-width:0 0 0 1px}.kpv-scene--split .kpv-geometry i:nth-child(2){left:7%;top:24%;width:16%;height:16%;transform:rotate(45deg)}.kpv-scene--split .kpv-geometry i:nth-child(3){right:9%;bottom:12%;width:28%;border-width:1px 0 0}
        .kpv-scene--stack .kpv-copy{text-align:center}.kpv-scene--stack .kpv-caption{justify-content:center}.kpv-scene--stack .kpv-translation{margin-left:auto;margin-right:auto}.kpv-scene--stack .kpv-meter{margin-left:auto;margin-right:auto}.kpv-scene--stack .kpv-ghost{left:50%;top:50%;transform:translate(-50%,-50%) scaleY(1.5);opacity:.25}.kpv-scene--stack .kpv-geometry i:nth-child(1){left:22%;right:22%;top:28%;bottom:28%;transform:rotate(-4deg)}.kpv-scene--stack .kpv-geometry i:nth-child(2){left:16%;right:16%;top:36%;bottom:36%;transform:rotate(4deg)}.kpv-scene--stack .kpv-geometry i:nth-child(3){left:50%;top:11%;height:78%;border-width:0 0 0 1px}
        .kpv-scene--impact .kpv-copy{width:min(94%,1180px)}.kpv-scene--impact .kpv-words{font-weight:900;font-size:clamp(44px,7vw,104px)!important;letter-spacing:-.075em}.kpv-scene--impact .kpv-ghost{left:3%;bottom:9%;transform:scaleY(1.6);opacity:.2}.kpv-scene--impact .kpv-geometry i:nth-child(1){left:0;right:0;top:50%;border-width:2px 0 0;box-shadow:0 0 18px var(--kpv-accent)}.kpv-scene--impact .kpv-geometry i:nth-child(2){left:18%;top:16%;width:64%;height:68%;transform:skewX(-14deg)}.kpv-scene--impact .kpv-geometry i:nth-child(3){right:6%;top:11%;width:14px;height:76%;background:var(--kpv-accent);border:0;opacity:.22}
        .kpv-scene--orbit .kpv-copy{width:min(82%,960px);padding-bottom:5vh}.kpv-scene--orbit .kpv-ghost{left:50%;top:50%;transform:translate(-50%,-50%) rotate(7deg);opacity:.17}.kpv-scene--orbit .kpv-geometry i{border-radius:50%}.kpv-scene--orbit .kpv-geometry i:nth-child(1){width:min(70vw,820px);height:min(30vw,360px);left:50%;top:50%;transform:translate(-50%,-50%) rotate(-22deg)}.kpv-scene--orbit .kpv-geometry i:nth-child(2){width:min(56vw,650px);height:min(22vw,270px);left:48%;top:47%;transform:translate(-50%,-50%) rotate(22deg)}.kpv-scene--orbit .kpv-geometry i:nth-child(3){width:9px;height:9px;left:72%;top:23%;background:var(--kpv-accent);border:0;box-shadow:0 0 18px var(--kpv-accent)}
        /* PixJam-inspired template skins. The composition continues to change
           line-by-line, while the visual identity stays stable for the song. */
        .kpv-preset--blue-impact{--kpv-token-idle:rgba(255,255,255,.34);--kpv-token-live:#fff;background:radial-gradient(circle at 82% 18%,rgba(94,209,255,.38),transparent 30%),linear-gradient(124deg,#10218b 0 58%,#edf3ff 58%);color:#fff}.kpv-preset--blue-impact .kpv-lines{opacity:.62;background:repeating-linear-gradient(90deg,transparent 0 7vw,rgba(255,255,255,.3) 7vw calc(7vw + 1px))}.kpv-preset--blue-impact .kpv-frame{border-color:rgba(255,255,255,.58)}.kpv-preset--blue-impact .kpv-ghost{-webkit-text-stroke-color:rgba(255,255,255,.42)}.kpv-preset--blue-impact .kpv-scene--impact .kpv-words{color:#fff;text-shadow:8px 8px 0 rgba(6,15,78,.46)}
        .kpv-preset--p5{--kpv-token-idle:rgba(255,255,255,.4);--kpv-token-live:#fff;background:linear-gradient(108deg,#050505 0 52%,#e5201e 52% 100%);color:#fff}.kpv-preset--p5 .kpv-frame{border-color:#fff}.kpv-preset--p5 .kpv-lines{opacity:.74;background:repeating-linear-gradient(0deg,transparent 0 6.8vh,rgba(255,255,255,.42) 6.8vh calc(6.8vh + 2px))}.kpv-preset--p5 .kpv-ghost{-webkit-text-stroke-color:rgba(255,255,255,.58);opacity:.38}.kpv-preset--p5 .kpv-words{font-weight:900!important;text-transform:uppercase;text-shadow:5px 5px 0 #0a0a0a}.kpv-preset--p5 .kpv-geometry i:nth-child(3){background:#fff!important;opacity:.4!important}.kpv-preset--p5 .kpv-caption{color:#fff}
        .kpv-preset--kinetic-split{--kpv-token-idle:rgba(16,21,47,.3);--kpv-token-live:#e53758;background:linear-gradient(135deg,#f3eadd 0 47%,#171d3e 47% 100%);color:#10152f}.kpv-preset--kinetic-split .kpv-frame{border-color:rgba(16,21,47,.62)}.kpv-preset--kinetic-split .kpv-lines{opacity:.5;background:repeating-linear-gradient(-40deg,transparent 0 2.2vw,rgba(16,21,47,.16) 2.2vw calc(2.2vw + 1px))}.kpv-preset--kinetic-split .kpv-words{font-weight:860}.kpv-preset--kinetic-split .kpv-translation{color:rgba(16,21,47,.7)}.kpv-preset--kinetic-split .kpv-ghost{-webkit-text-stroke-color:rgba(16,21,47,.32)}.kpv-preset--kinetic-split .kpv-caption{color:#10152f}.kpv-preset--kinetic-split .kpv-scene--split .kpv-geometry i:nth-child(1){border-color:#e53758}
        .kpv-preset--night-city{--kpv-token-idle:rgba(202,255,223,.24);--kpv-token-live:#d8ffe7;background:radial-gradient(circle at 14% 80%,rgba(25,255,175,.18),transparent 31%),repeating-linear-gradient(0deg,rgba(1,14,15,.94) 0 3px,rgba(5,34,33,.95) 3px 6px);color:#caffdf}.kpv-preset--night-city .kpv-frame{border-color:rgba(124,255,200,.65)}.kpv-preset--night-city .kpv-grain{opacity:.13}.kpv-preset--night-city .kpv-lines{opacity:.55;background:repeating-linear-gradient(90deg,transparent 0 5vw,rgba(124,255,200,.25) 5vw calc(5vw + 1px))}.kpv-preset--night-city .kpv-words,.kpv-preset--night-city .kpv-translation{font-family:ui-monospace,SFMono-Regular,Consolas,monospace!important;letter-spacing:.025em}.kpv-preset--night-city .kpv-ghost{-webkit-text-stroke-color:rgba(124,255,200,.38)}.kpv-preset--night-city .kpv-caption{color:#8cffbb}.kpv-preset--night-city .kpv-meter{height:1px}
        .kpv-preset--hysteric-night{--kpv-token-idle:rgba(255,255,255,.28);--kpv-token-live:#fff;background:radial-gradient(circle at 83% 20%,rgba(255,53,198,.66),transparent 22%),linear-gradient(130deg,#180115 0 48%,#ff28ae 48% 53%,#07000a 53%);color:#fff}.kpv-preset--hysteric-night .kpv-frame{border-color:#ffb4eb}.kpv-preset--hysteric-night .kpv-lines{opacity:.8;background:repeating-linear-gradient(0deg,transparent 0 4.3vh,rgba(255,255,255,.35) 4.3vh calc(4.3vh + 1px))}.kpv-preset--hysteric-night .kpv-words{font-weight:900!important;letter-spacing:-.07em;transform:skewX(-5deg)}.kpv-preset--hysteric-night .kpv-token[data-state="live"]{filter:drop-shadow(3px 0 0 #5ad4ff) drop-shadow(-3px 0 0 #ff2456)}.kpv-preset--hysteric-night .kpv-ghost{-webkit-text-stroke-color:rgba(255,187,239,.45)}.kpv-preset--hysteric-night .kpv-geometry i{border-style:dashed}
        .kpv-preset--paper-cut{--kpv-token-idle:rgba(255,255,255,.38);--kpv-token-live:#fff;background:linear-gradient(112deg,#ffdd58 0 30%,#f06b4f 30% 62%,#173861 62%);color:#fff}.kpv-preset--paper-cut .kpv-frame{border-color:#fff;border-width:2px}.kpv-preset--paper-cut .kpv-lines{opacity:.62;background:radial-gradient(rgba(255,255,255,.86) 1px,transparent 1.5px);background-size:12px 12px}.kpv-preset--paper-cut .kpv-words{font-weight:900!important;text-shadow:4px 4px 0 rgba(18,32,65,.38)}.kpv-preset--paper-cut .kpv-ghost{-webkit-text-stroke-color:rgba(255,255,255,.42)}.kpv-preset--paper-cut .kpv-geometry i{border-width:2px}.kpv-preset--paper-cut .kpv-scene--orbit .kpv-geometry i{border-radius:8px;transform:translate(-50%,-50%) rotate(31deg)}
        .kpv-preset--blue-structure{--kpv-token-idle:rgba(219,232,255,.32);--kpv-token-live:#fff;background:linear-gradient(140deg,#07144d 0 36%,#2456c9 36% 72%,#dff1ff 72%);color:#fff}.kpv-preset--blue-structure .kpv-lines{opacity:.72;background:repeating-linear-gradient(90deg,transparent 0 4vw,rgba(190,225,255,.28) 4vw calc(4vw + 1px)),repeating-linear-gradient(0deg,transparent 0 4vw,rgba(190,225,255,.18) 4vw calc(4vw + 1px))}.kpv-preset--blue-structure .kpv-geometry i:nth-child(1){left:10%;top:17%;width:55%;height:66%;transform:skewX(-18deg)}.kpv-preset--blue-structure .kpv-ghost{-webkit-text-stroke-color:rgba(210,235,255,.4)}
        .kpv-preset--cyber-grunge{--kpv-token-idle:rgba(255,194,194,.29);--kpv-token-live:#fff;background:radial-gradient(ellipse at 82% 80%,rgba(255,42,42,.36),transparent 31%),repeating-linear-gradient(-18deg,#0c0c11 0 10px,#161018 10px 12px);color:#fff}.kpv-preset--cyber-grunge .kpv-lines{opacity:.85;background:repeating-linear-gradient(0deg,transparent 0 3.6vh,rgba(255,64,64,.32) 3.6vh calc(3.6vh + 1px))}.kpv-preset--cyber-grunge .kpv-frame{border-color:rgba(255,80,80,.72)}.kpv-preset--cyber-grunge .kpv-geometry i{border-style:dashed}.kpv-preset--cyber-grunge .kpv-ghost{-webkit-text-stroke-color:rgba(255,80,80,.46)}.kpv-preset--cyber-grunge .kpv-line[data-live="true"] .kpv-copy{animation:kpv-jitter .25s steps(2) infinite}
        .kpv-preset--geometric{--kpv-token-idle:rgba(255,255,255,.33);--kpv-token-live:#ffe898;background:conic-gradient(from 210deg at 72% 42%,#3c267f,#153570,#5c2f93,#1f1d4c);color:#fff}.kpv-preset--geometric .kpv-frame{border-width:2px;border-color:#ffd76e}.kpv-preset--geometric .kpv-lines{opacity:.66;background:linear-gradient(60deg,transparent 48%,rgba(255,215,110,.24) 49% 51%,transparent 52%),linear-gradient(-60deg,transparent 48%,rgba(255,215,110,.2) 49% 51%,transparent 52%);background-size:92px 104px}.kpv-preset--geometric .kpv-geometry i{border-color:#ffd76e;transform:rotate(45deg)!important}.kpv-preset--geometric .kpv-ghost{-webkit-text-stroke-color:rgba(255,233,142,.36)}
        .kpv-preset--matrix{--kpv-token-idle:rgba(135,255,172,.24);--kpv-token-live:#d9ffe7;background:radial-gradient(circle at 47% 34%,rgba(60,255,133,.13),transparent 38%),#01110a;color:#a9ffc0}.kpv-preset--matrix .kpv-lines{opacity:.75;background:repeating-linear-gradient(90deg,transparent 0 18px,rgba(78,255,145,.17) 18px 19px),repeating-linear-gradient(0deg,transparent 0 5px,rgba(93,255,151,.09) 5px 6px)}.kpv-preset--matrix .kpv-frame{border-color:rgba(92,255,150,.64)}.kpv-preset--matrix .kpv-words,.kpv-preset--matrix .kpv-translation{font-family:ui-monospace,Consolas,monospace!important}.kpv-preset--matrix .kpv-ghost{-webkit-text-stroke-color:rgba(90,255,148,.34)}.kpv-preset--matrix .kpv-burst i{height:1px}.kpv-preset--matrix .kpv-line[data-live="true"] .kpv-geometry i{animation:kpv-matrix-fall 1.7s linear infinite}
        .kpv-preset--emotion-cinema{--kpv-token-idle:rgba(245,231,218,.32);--kpv-token-live:#fff1d8;background:radial-gradient(ellipse at 30% 30%,rgba(185,116,67,.34),transparent 26%),linear-gradient(145deg,#100b0e,#37211c 52%,#0b101b);color:#fff1e4}.kpv-preset--emotion-cinema .kpv-frame{border-color:rgba(255,220,180,.38)}.kpv-preset--emotion-cinema .kpv-lines{opacity:.26;background:repeating-linear-gradient(0deg,transparent 0 7vh,rgba(255,234,208,.22) 7vh calc(7vh + 1px))}.kpv-preset--emotion-cinema .kpv-words{font-family:"Noto Serif SC","Songti SC",serif!important;font-weight:600!important;letter-spacing:.03em}.kpv-preset--emotion-cinema .kpv-ghost{-webkit-text-stroke-color:rgba(255,216,177,.24)}.kpv-preset--emotion-cinema .kpv-burst{display:none}
        .kpv-preset--spider-web{--kpv-token-idle:rgba(255,230,230,.28);--kpv-token-live:#fff;background:radial-gradient(circle at 50% 50%,#21151d 0 2%,#07090f 46%,#20000b);color:#fff}.kpv-preset--spider-web .kpv-lines{opacity:.6;background:conic-gradient(from 0deg at 50% 50%,transparent 0 9deg,rgba(255,55,77,.34) 9deg 10deg,transparent 10deg 20deg);background-size:100% 100%}.kpv-preset--spider-web .kpv-frame{border-color:rgba(255,65,83,.65)}.kpv-preset--spider-web .kpv-geometry i{left:50%!important;top:50%!important;border-color:#ff5266;border-radius:50%;animation:kpv-web-spin 11s linear infinite}.kpv-preset--spider-web .kpv-geometry i:nth-child(1){width:62vw!important;height:62vw!important;transform:translate(-50%,-50%)!important}.kpv-preset--spider-web .kpv-geometry i:nth-child(2){width:40vw!important;height:40vw!important;transform:translate(-50%,-50%) rotate(30deg)!important}.kpv-preset--spider-web .kpv-geometry i:nth-child(3){width:20vw!important;height:20vw!important;transform:translate(-50%,-50%) rotate(60deg)!important}
        .kpv-preset--staggered-text{--kpv-token-idle:rgba(231,240,255,.28);--kpv-token-live:#fff;background:linear-gradient(118deg,#152156,#5075d8 48%,#e4efff 48%);color:#fff}.kpv-preset--staggered-text .kpv-words{letter-spacing:.12em;max-width:72%;line-height:1.34}.kpv-preset--staggered-text .kpv-token:nth-child(odd){transform:translateY(-.13em)}.kpv-preset--staggered-text .kpv-token:nth-child(3n){transform:translateY(.15em)}.kpv-preset--staggered-text .kpv-lines{opacity:.54;background:repeating-linear-gradient(135deg,transparent 0 4vw,rgba(255,255,255,.2) 4vw calc(4vw + 1px))}.kpv-preset--staggered-text .kpv-geometry i{border-color:#c7dcff}
        .kpv-preset--calm-villain{--kpv-token-idle:rgba(31,48,116,.27);--kpv-token-live:#173fce;background:linear-gradient(135deg,#f5c6d0 0 53%,#d7e8ff 53%);color:#1b2869}.kpv-preset--calm-villain .kpv-frame{border-color:rgba(29,61,177,.54)}.kpv-preset--calm-villain .kpv-lines{opacity:.52;background:radial-gradient(rgba(35,80,200,.3) 1px,transparent 1.5px);background-size:14px 14px}.kpv-preset--calm-villain .kpv-words{font-weight:520!important;letter-spacing:.05em}.kpv-preset--calm-villain .kpv-translation{color:rgba(28,43,104,.72)}.kpv-preset--calm-villain .kpv-ghost{-webkit-text-stroke-color:rgba(30,67,190,.28)}
        .kpv-preset--girly-clouds{--kpv-token-idle:rgba(255,255,255,.34);--kpv-token-live:#fff;background:radial-gradient(ellipse at 18% 80%,rgba(255,174,215,.56),transparent 28%),radial-gradient(ellipse at 75% 18%,rgba(206,168,255,.5),transparent 30%),linear-gradient(135deg,#9b6cbe,#ffa8cf);color:#fff}.kpv-preset--girly-clouds .kpv-frame{border-color:rgba(255,255,255,.74);border-radius:36px}.kpv-preset--girly-clouds .kpv-lines{opacity:.48;background:radial-gradient(ellipse,rgba(255,255,255,.68) 0 38%,transparent 40%);background-size:90px 42px}.kpv-preset--girly-clouds .kpv-geometry i{border-radius:50%;border-color:#fff}.kpv-preset--girly-clouds .kpv-ghost{-webkit-text-stroke-color:rgba(255,255,255,.38)}
        .kpv-preset--sweet-pink{--kpv-token-idle:rgba(255,255,255,.3);--kpv-token-live:#fff;background:linear-gradient(90deg,#ff71ac 0 50%,#ffc4da 50%);color:#fff}.kpv-preset--sweet-pink .kpv-frame{border-color:#fff;border-radius:20px}.kpv-preset--sweet-pink .kpv-lines{opacity:.5;background:repeating-conic-gradient(from 45deg,rgba(255,255,255,.37) 0 25%,transparent 0 50%);background-size:42px 42px}.kpv-preset--sweet-pink .kpv-words{font-weight:860!important;text-shadow:3px 3px 0 rgba(172,33,92,.32)}.kpv-preset--sweet-pink .kpv-geometry i{border-color:#fff;border-radius:16px}
        .kpv-preset--fly-me-to-the-moon{--kpv-token-idle:rgba(246,237,202,.3);--kpv-token-live:#fff7c8;background:radial-gradient(circle at 75% 24%,#f5e19a 0 8%,transparent 8.3%),linear-gradient(145deg,#02050c,#111c3a);color:#fffbe3}.kpv-preset--fly-me-to-the-moon .kpv-frame{border-color:rgba(250,231,159,.65)}.kpv-preset--fly-me-to-the-moon .kpv-lines{opacity:.38;background:radial-gradient(rgba(255,255,225,.8) .8px,transparent 1.4px);background-size:24px 24px}.kpv-preset--fly-me-to-the-moon .kpv-words{font-family:"Noto Serif SC",serif!important;font-weight:500!important;letter-spacing:.06em}.kpv-preset--fly-me-to-the-moon .kpv-geometry i{border-color:#f8eaa9;border-radius:50%}.kpv-preset--fly-me-to-the-moon .kpv-burst{display:none}
        .kpv-preset--kawaii-pixel{--kpv-token-idle:rgba(52,52,111,.3);--kpv-token-live:#5c4bdb;background:linear-gradient(135deg,#bcefff 0 50%,#ffd0e4 50%);color:#32326f}.kpv-preset--kawaii-pixel .kpv-frame{border-color:#5b55b8;border-radius:0;image-rendering:pixelated}.kpv-preset--kawaii-pixel .kpv-lines{opacity:.58;background:repeating-linear-gradient(90deg,transparent 0 16px,rgba(73,78,177,.24) 16px 18px),repeating-linear-gradient(0deg,transparent 0 16px,rgba(73,78,177,.24) 16px 18px)}.kpv-preset--kawaii-pixel .kpv-words{font-weight:900!important;text-shadow:3px 3px 0 rgba(255,255,255,.8)}.kpv-preset--kawaii-pixel .kpv-geometry i{border-color:#5b55b8;border-width:3px}.kpv-preset--kawaii-pixel .kpv-burst i{height:4px;background:#ff8cba}
        .kpv-preset--crime-scene{--kpv-token-idle:rgba(255,229,149,.31);--kpv-token-live:#fff2b0;background:linear-gradient(135deg,#15130d,#1b1b13 52%,#d99b19 52%);color:#fff1b5}.kpv-preset--crime-scene .kpv-frame{border:2px dashed #f5c83c}.kpv-preset--crime-scene .kpv-lines{opacity:.68;background:repeating-linear-gradient(-32deg,transparent 0 4vw,rgba(255,204,56,.28) 4vw calc(4vw + 2px))}.kpv-preset--crime-scene .kpv-words{font-family:ui-monospace,Consolas,monospace!important;font-weight:850!important}.kpv-preset--crime-scene .kpv-geometry i{border-color:#f7c637}.kpv-preset--crime-scene .kpv-ghost{-webkit-text-stroke-color:rgba(255,204,55,.36)}
        .kpv-preset--haruhikage{--kpv-token-idle:rgba(28,65,111,.28);--kpv-token-live:#315fba;background:radial-gradient(circle at 24% 20%,rgba(255,255,255,.86) 0 9%,transparent 9.4%),linear-gradient(135deg,#dff4ff,#a5d4ff);color:#1d467a}.kpv-preset--haruhikage .kpv-frame{border-color:rgba(31,95,172,.45);border-radius:80px}.kpv-preset--haruhikage .kpv-lines{opacity:.45;background:linear-gradient(45deg,transparent 45%,rgba(255,255,255,.68) 46% 54%,transparent 55%);background-size:64px 64px}.kpv-preset--haruhikage .kpv-words{font-family:"Noto Serif SC",serif!important;font-weight:600!important}.kpv-preset--haruhikage .kpv-translation{color:rgba(31,70,118,.68)}.kpv-preset--haruhikage .kpv-geometry i{border-color:#649bdc;border-radius:50%}
        .kpv-preset--custom{--kpv-token-idle:color-mix(in srgb,var(--kpv-accent) 27%,white);--kpv-token-live:var(--kpv-accent);background:radial-gradient(circle at 78% 20%,color-mix(in srgb,var(--kpv-accent) 42%,transparent),transparent 28%),linear-gradient(135deg,#111421,#1a1b36);color:#fff}.kpv-preset--custom .kpv-lines{opacity:.44;background:repeating-linear-gradient(90deg,transparent 0 5vw,color-mix(in srgb,var(--kpv-accent) 18%,transparent) 5vw calc(5vw + 1px))}.kpv-preset--custom .kpv-ghost{-webkit-text-stroke-color:color-mix(in srgb,var(--kpv-accent) 40%,transparent)}
        .kpv-preset--blue-impact .kpv-words,.kpv-preset--blue-structure .kpv-words,.kpv-preset--staggered-text .kpv-words{font-family:"Zen Kaku Gothic New","Noto Sans JP","Noto Sans SC",sans-serif}.kpv-preset--blue-structure .kpv-token{font-family:"Klee One","Noto Sans JP",sans-serif}.kpv-preset--cyber-grunge .kpv-words,.kpv-preset--matrix .kpv-words{font-family:"DotGothic16",ui-monospace,monospace!important}.kpv-preset--emotion-cinema .kpv-words,.kpv-preset--fly-me-to-the-moon .kpv-words,.kpv-preset--haruhikage .kpv-words{font-family:"Shippori Mincho","Noto Serif JP","Noto Serif SC",serif!important}.kpv-preset--girly-clouds .kpv-words,.kpv-preset--sweet-pink .kpv-words{font-family:"Klee One","Noto Sans JP",sans-serif}
        /* Script-aware typography keeps Chinese, Japanese and Latin lyrics
           intentional instead of relying on whichever glyph happens to be in
           a decorative font. */
        .kpv-script--latin .kpv-words{font-family:"Outfit","Inter",sans-serif!important;letter-spacing:.035em}.kpv-script--latin .kpv-translation{font-family:"Inter","Noto Sans SC",sans-serif!important}.kpv-script--cjk .kpv-words{font-family:"Noto Sans SC","Microsoft YaHei",sans-serif!important}.kpv-script--cjk .kpv-translation{font-family:"Noto Sans SC","Microsoft YaHei",sans-serif!important}.kpv-script--jp .kpv-words{font-family:"Zen Kaku Gothic New","Noto Sans JP",sans-serif!important}.kpv-script--jp .kpv-translation{font-family:"Noto Sans JP","Noto Sans SC",sans-serif!important}.kpv-preset--emotion-cinema .kpv-script--cjk .kpv-words{font-family:"Ma Shan Zheng","Noto Serif SC","Songti SC",serif!important;font-weight:400!important;letter-spacing:.08em}.kpv-preset--fly-me-to-the-moon .kpv-script--cjk .kpv-words,.kpv-preset--haruhikage .kpv-script--cjk .kpv-words{font-family:"Noto Serif SC","Songti SC",serif!important}.kpv-preset--paper-cut .kpv-script--cjk .kpv-words{font-family:"ZCOOL KuaiLe","Noto Sans SC",sans-serif!important;font-weight:400!important}.kpv-preset--p5 .kpv-script--latin .kpv-words{font-family:"Rubik Glitch","Outfit",sans-serif!important;font-weight:400!important}.kpv-preset--matrix .kpv-script--latin .kpv-words,.kpv-preset--night-city .kpv-script--latin .kpv-words{font-family:"DotGothic16",ui-monospace,monospace!important;letter-spacing:.08em}
        .kpv-preset--blue-impact .kpv-lines,.kpv-preset--blue-structure .kpv-lines{transform-origin:50% 50%;animation:kpv-grid-turn 22s linear infinite}.kpv-preset--geometric .kpv-lines,.kpv-preset--spider-web .kpv-lines{transform-origin:50% 50%;animation:kpv-grid-turn 15s linear infinite reverse}.kpv-preset--hysteric-night .kpv-lines,.kpv-preset--cyber-grunge .kpv-lines{animation:kpv-grid-warp 9s ease-in-out infinite}.kpv-preset--sweet-pink .kpv-lines{animation:kpv-grid-bob 10s ease-in-out infinite}.kpv-preset--fly-me-to-the-moon::before,.kpv-preset--emotion-cinema::before{animation:kpv-light-orbit 15s linear infinite}
        /* Editorial card boards: position and motion are deliberately split
           across two elements. The outer token owns its stable composition
           cell; the inner face performs the lyric hit. This removes transform
           fights that used to pile later glyphs over the first glyph. */
        .kpv-systems{position:absolute;inset:0;z-index:1;pointer-events:none;font:600 10px/1 ui-monospace,SFMono-Regular,Consolas,monospace;letter-spacing:.18em;color:color-mix(in srgb,var(--kpv-accent) 56%,transparent);opacity:.58}.kpv-systems i{position:absolute;font-style:normal}.kpv-systems i:nth-child(1){left:8%;top:23%}.kpv-systems i:nth-child(2){right:9%;top:20%;writing-mode:vertical-rl}.kpv-systems i:nth-child(3){left:13%;bottom:17%;opacity:.62}
        .kpv-token-motion{position:relative;display:block;transform-origin:center;will-change:auto}.kpv-line--active .kpv-token-motion{will-change:transform,opacity}.kpv-layout--blue-cards .kpv-token-motion,.kpv-layout--grunge-cards .kpv-token-motion,.kpv-layout--impact-scatter .kpv-token-motion{position:relative;display:block}
        .kpv-line--active.kpv-layout--blue-cards .kpv-copy,.kpv-line--active.kpv-layout--grunge-cards .kpv-copy,.kpv-line--active.kpv-layout--impact-scatter .kpv-copy{height:min(57vh,610px);width:min(90vw,1080px)}
        .kpv-line--active.kpv-layout--blue-cards .kpv-words,.kpv-line--active.kpv-layout--grunge-cards .kpv-words,.kpv-line--active.kpv-layout--impact-scatter .kpv-words{font-size:clamp(38px,5.2vw,88px)!important}
        .kpv-line--active.kpv-layout--blue-cards .kpv-token,.kpv-line--active.kpv-layout--grunge-cards .kpv-token,.kpv-line--active.kpv-layout--impact-scatter .kpv-token{transform:translate(-50%,-50%) rotate(var(--kpv-slot-r)) scale(var(--kpv-slot-scale))!important;transform-origin:center}
        .kpv-line--active.kpv-layout--blue-cards .kpv-token{padding:.13em .17em;border:1px solid rgba(20,48,141,.11);box-shadow:0 11px 21px rgba(23,48,108,.16),5px 6px 0 rgba(18,53,177,.13)}
        .kpv-line--active.kpv-layout--grunge-cards .kpv-token{padding:.13em .17em;border:1px solid rgba(255,255,255,.54);box-shadow:0 11px 21px rgba(0,0,0,.37),4px 5px 0 rgba(225,25,46,.28)}
        .kpv-line--active.kpv-layout--blue-cards.kpv-effect--cards .kpv-token,.kpv-line--active.kpv-layout--grunge-cards.kpv-effect--cards .kpv-token{opacity:1;transition:none}.kpv-line--active.kpv-layout--blue-cards.kpv-effect--cards .kpv-token::before,.kpv-line--active.kpv-layout--grunge-cards.kpv-effect--cards .kpv-token::before{content:none}.kpv-line--active.kpv-layout--blue-cards.kpv-effect--cards .kpv-token[data-state="waiting"] .kpv-token-motion,.kpv-line--active.kpv-layout--grunge-cards.kpv-effect--cards .kpv-token[data-state="waiting"] .kpv-token-motion{opacity:.17;transform:translateY(14px) scale(.78);filter:blur(.2px)}.kpv-line--active.kpv-layout--blue-cards.kpv-effect--cards .kpv-token[data-state="live"] .kpv-token-motion,.kpv-line--active.kpv-layout--grunge-cards.kpv-effect--cards .kpv-token[data-state="live"] .kpv-token-motion{animation:kpv-card-face-in .38s cubic-bezier(.08,.94,.2,1) both}.kpv-line--active.kpv-layout--blue-cards.kpv-effect--cards .kpv-token[data-state="done"] .kpv-token-motion,.kpv-line--active.kpv-layout--grunge-cards.kpv-effect--cards .kpv-token[data-state="done"] .kpv-token-motion{opacity:1;transform:none}
        .kpv-line--active.kpv-layout--impact-scatter.kpv-effect--scatter .kpv-token{opacity:1;transition:none}.kpv-line--active.kpv-layout--impact-scatter.kpv-effect--scatter .kpv-token[data-state="waiting"] .kpv-token-motion{opacity:0;transform:translate(var(--kpv-scatter-x),var(--kpv-scatter-y)) rotate(var(--kpv-scatter-r)) scale(.35)}.kpv-line--active.kpv-layout--impact-scatter.kpv-effect--scatter .kpv-token[data-state="live"] .kpv-token-motion{animation:kpv-impact-card-land .44s cubic-bezier(.05,.94,.2,1) both}.kpv-line--active.kpv-layout--impact-scatter.kpv-effect--scatter .kpv-token[data-state="done"] .kpv-token-motion{opacity:1;transform:none}
        .kpv-preset--blue-structure{--kpv-token-idle:rgba(15,34,92,.24);--kpv-token-live:#163fc6;background:radial-gradient(circle at 16% 20%,#103cc9 0 3.2%,transparent 3.4%),radial-gradient(circle at 79% 66%,#163fc6 0 1.55%,transparent 1.75%),repeating-radial-gradient(circle at 50% 50%,transparent 0 9.2%,rgba(29,48,103,.11) 9.35% 9.5%),#f4f1ea;color:#17245c}.kpv-preset--blue-structure .kpv-frame{border-color:rgba(24,61,185,.36)}.kpv-preset--blue-structure .kpv-lines{opacity:.5;background:linear-gradient(90deg,transparent 49.88%,rgba(29,48,103,.12) 50% 50.12%,transparent 50.25%),linear-gradient(0deg,transparent 49.88%,rgba(29,48,103,.1) 50% 50.12%,transparent 50.25%);background-size:17vw 17vw;animation:kpv-grid-turn 24s linear infinite}.kpv-preset--blue-structure .kpv-ghost{color:rgba(24,52,137,.11);-webkit-text-stroke-color:rgba(24,52,137,.18)}.kpv-preset--blue-structure .kpv-caption,.kpv-preset--blue-structure .kpv-translation{color:rgba(18,41,118,.66)}.kpv-preset--blue-structure .kpv-systems{color:rgba(15,47,166,.6)}
        .kpv-preset--blue-structure .kpv-layout--blue-cards .kpv-token{background:#fff;box-shadow:0 14px 26px rgba(27,47,116,.14),6px 7px 0 rgba(36,72,199,.13)}.kpv-preset--blue-structure .kpv-layout--blue-cards .kpv-token-base{color:#101010}.kpv-preset--blue-structure .kpv-layout--blue-cards .kpv-token-fill{color:#1036b6}
        .kpv-preset--blue-structure .kpv-layout--impact-scatter .kpv-token{color:#102c9c;text-shadow:5px 6px 0 rgba(35,75,200,.15)}.kpv-preset--blue-structure .kpv-layout--impact-scatter .kpv-token-base{color:rgba(14,34,105,.45);-webkit-text-stroke:1px rgba(21,58,177,.35)}.kpv-preset--blue-structure .kpv-layout--impact-scatter .kpv-token-fill{color:#103cce;-webkit-text-stroke:1px #103cce}.kpv-preset--blue-structure .kpv-layout--impact-scatter .kpv-token::before{background:#103cce}
        .kpv-preset--cyber-grunge .kpv-systems,.kpv-preset--crime-scene .kpv-systems{color:rgba(255,182,182,.63)}.kpv-preset--cyber-grunge .kpv-layout--grunge-cards .kpv-token{background:repeating-linear-gradient(0deg,#f3f1e9 0 2px,#dbd7ce 2px 3px)}
        .kpv-preset--hysteric-night .kpv-systems{color:rgba(255,205,244,.7)}.kpv-preset--sweet-pink .kpv-systems,.kpv-preset--girly-clouds .kpv-systems{color:rgba(255,255,255,.78)}
        .kpv-stage .kpv-lines{opacity:var(--kpv-lines-opacity,.32)}
        @keyframes kpv-field-enter{from{opacity:0;transform:scale(.93)}to{opacity:.52;transform:scale(var(--kpv-energy-scale,1))}}@keyframes kpv-keyframe-in{0%{opacity:0;filter:blur(10px);transform:translate(-50%,-50%) rotate(calc(var(--kpv-key-rotate,-8deg) - 12deg)) scale(calc(var(--kpv-key-scale,1) * .42))}66%{opacity:.72;filter:none;transform:translate(-50%,-50%) rotate(calc(var(--kpv-key-rotate,-8deg) + 2deg)) scale(calc(var(--kpv-key-scale,1) * 1.12))}100%{opacity:.58;filter:none;transform:translate(-50%,-50%) rotate(var(--kpv-key-rotate,-8deg)) scale(var(--kpv-key-scale,1))}}@keyframes kpv-keyframe-orbit-in{0%{opacity:0;transform:translate(-50%,-50%) rotate(calc(var(--kpv-key-rotate,12deg) - 54deg)) scale(calc(var(--kpv-key-scale,1) * .35))}65%{opacity:.72;transform:translate(-50%,-50%) rotate(calc(var(--kpv-key-rotate,12deg) + 6deg)) scale(calc(var(--kpv-key-scale,1) * 1.14))}100%{opacity:.54;transform:translate(-50%,-50%) rotate(var(--kpv-key-rotate,12deg)) scale(var(--kpv-key-scale,1))}}@keyframes kpv-keyframe-orbit{to{transform:rotate(405deg)}}@keyframes kpv-keyframe-breathe{50%{opacity:.32;transform:scale(1.07)}}@keyframes kpv-preview-mark{50%{opacity:.45}}@keyframes kpv-chapter-frame{0%{opacity:0;transform:scale(.9)}100%{opacity:1;transform:scale(1)}}@keyframes kpv-chapter-field{0%{opacity:0;transform:scale(.86)}100%{opacity:.52;transform:scale(var(--kpv-energy-scale,1))}}@keyframes kpv-chapter-tag{0%{opacity:0;transform:translateX(-24px) scale(.7)}100%{opacity:1;transform:none}}@keyframes kpv-chapter-copy{0%{opacity:0;transform:translateY(26px) scale(.93)}100%{opacity:1;transform:scale(var(--kpv-pulse,1))}}@keyframes kpv-title-card{0%{opacity:0;transform:translateY(20px) scale(.95)}18%{opacity:1;transform:none}68%{opacity:1}100%{opacity:0;transform:translateY(-10px)}}@keyframes kpv-camera-shake{0%,100%{translate:0 0}20%{translate:calc(var(--kpv-camera-shake,0) * -5px) calc(var(--kpv-camera-shake,0) * 3px)}42%{translate:calc(var(--kpv-camera-shake,0) * 4px) calc(var(--kpv-camera-shake,0) * -4px)}65%{translate:calc(var(--kpv-camera-shake,0) * -2px) calc(var(--kpv-camera-shake,0) * -3px)}80%{translate:calc(var(--kpv-camera-shake,0) * 3px) calc(var(--kpv-camera-shake,0) * 2px)}}@keyframes kpv-hook-hit{0%{transform:scale(.76)}58%{transform:scale(1.09)}100%{transform:scale(var(--kpv-pulse,1))}}@keyframes kpv-ticker-meta{from{transform:translateX(24%)}to{transform:translateX(-24%)}}@keyframes kpv-cover-cel{0%,100%{transform:rotate(-7deg) scale(.92)}48%{transform:rotate(8deg) scale(1.08)}68%{transform:rotate(3deg) scale(1.01)}}@keyframes kpv-cover-drift{0%,100%{transform:scale(1.08) translate3d(-1%,-1%,0)}50%{transform:scale(1.18) translate3d(2%,1%,0)}}@keyframes kpv-field-orbit{to{transform:rotate(360deg)}}@keyframes kpv-field-bob{50%{transform:translate3d(0,-26px,0) scale(1.13);opacity:.82}}@keyframes kpv-field-sweep{0%,18%{transform:translateX(-18%) rotate(-14deg);opacity:0}38%{opacity:.52}70%,100%{transform:translateX(92%) rotate(-14deg);opacity:0}}@keyframes kpv-field-breathe{50%{transform:rotate(-23deg);opacity:.15}}@keyframes kpv-split-beam{50%{transform:rotate(29deg) scaleY(1.2);opacity:.68}}@keyframes kpv-stack-ring{50%{transform:translate(-50%,-50%) rotate(21deg) scale(.9);opacity:.2}}@keyframes kpv-impact-slice{0%,20%{opacity:0;transform:translate(-75%,-50%) rotate(-18deg) scaleX(.28)}38%{opacity:.8}70%,100%{opacity:0;transform:translate(42%,-50%) rotate(-18deg) scaleX(1)}}@keyframes kpv-orbit-spin{to{transform:translate(-50%,-50%) rotate(360deg)}}@keyframes kpv-echo-forward{from{transform:translateX(34%)}to{transform:translateX(-44%)}}@keyframes kpv-echo-reverse{from{transform:translateX(-37%)}to{transform:translateX(47%)}}@keyframes kpv-echo-pulse{50%{opacity:.06;letter-spacing:.32em}}@keyframes kpv-echo-orbit{to{transform:translate(-50%,-50%) rotate(372deg) scale(1.13)}}@keyframes kpv-impact-card-land{0%{opacity:0;transform:translate(var(--kpv-scatter-x),var(--kpv-scatter-y)) rotate(var(--kpv-scatter-r)) scale(.25);filter:blur(8px)}67%{opacity:1;transform:translate(-2px,3px) rotate(-2deg) scale(1.13);filter:none}100%{opacity:1;transform:none}}
        @keyframes kpv-card-face-in{0%{opacity:0;transform:translateY(22px) rotate(-9deg) scale(.42)}68%{opacity:1;transform:translateY(-5px) rotate(2deg) scale(1.13)}100%{opacity:1;transform:none}}
        @keyframes kpv-grain{0%{transform:translate(-2%,1%) rotate(8deg)}50%{transform:translate(2%,-1%) rotate(8deg)}100%{transform:translate(-1%,2%) rotate(8deg)}}
        @keyframes kpv-line-in{from{opacity:0;transform:translateY(4vh) scale(.96)}to{opacity:var(--kpv-line-opacity);transform:none}}@keyframes kpv-copy-hit{0%{transform:scale(.88)}68%{transform:scale(calc(var(--kpv-pulse,1) * 1.035))}100%{transform:scale(var(--kpv-pulse,1))}}@keyframes kpv-streak{0%{opacity:0;transform:translateX(-30%) scaleX(.2)}22%{opacity:.8}100%{opacity:0;transform:translateX(220%) scaleX(1)}}@keyframes kpv-jitter{0%{transform:translate(0)}25%{transform:translate(2px,-1px)}50%{transform:translate(-2px,1px)}75%{transform:translate(1px,2px)}100%{transform:translate(0)}}@keyframes kpv-matrix-fall{from{translate:0 -14px}to{translate:0 32px}}@keyframes kpv-web-spin{to{rotate:360deg}}
        @keyframes kpv-slice-in{0%{opacity:0;transform:translateY(70%) skewX(-18deg);clip-path:inset(0 0 100% 0)}65%{opacity:1;transform:translateY(-7%) skewX(4deg)}100%{opacity:1;transform:none;clip-path:inset(0)}}@keyframes kpv-slash-hit{0%{opacity:0;transform:translate(28px,-20px) skewX(-30deg)}70%{opacity:1;transform:translate(-4px,3px) skewX(4deg)}100%{opacity:1;transform:none}}@keyframes kpv-stagger-pop{0%{opacity:.15;transform:translateY(var(--kpv-stagger)) scale(.75)}70%{opacity:1;transform:translateY(calc(var(--kpv-stagger) * -.18)) scale(1.08)}100%{opacity:1;transform:none}}@keyframes kpv-glitch{0%{transform:translate(0)}25%{transform:translate(-4px,2px) skewX(12deg)}50%{transform:translate(4px,-1px) skewX(-9deg)}75%{transform:translate(-2px,1px)}100%{transform:none}}@keyframes kpv-type-pop{0%{opacity:0;transform:scale(.35)}60%{opacity:1;transform:scale(1.18)}100%{opacity:1;transform:none}}@keyframes kpv-terminal{0%{opacity:0;transform:translateX(-.5em);filter:blur(3px)}100%{opacity:1;transform:none;filter:none}}@keyframes kpv-caret{50%{opacity:0}}@keyframes kpv-scatter-land{0%{opacity:0;transform:translate(var(--kpv-scatter-x),var(--kpv-scatter-y)) rotate(var(--kpv-scatter-r)) scale(.5)}72%{opacity:1;transform:translate(-2px,3px) rotate(-2deg) scale(1.08)}100%{opacity:1;transform:none}}@keyframes kpv-orbit-land{0%{opacity:0;transform:translate(var(--kpv-scatter-x),calc(var(--kpv-scatter-y) * -1)) rotate(180deg) scale(.25)}70%{opacity:1;transform:translate(0,-6px) rotate(-8deg) scale(1.08)}100%{opacity:1;transform:none}}@keyframes kpv-wave{0%{opacity:.14;transform:translateY(22px) scale(.8)}58%{opacity:1;transform:translateY(-13px) scale(1.1)}100%{opacity:1;transform:none}}@keyframes kpv-wave-idle{50%{transform:translateY(-.12em)}}@keyframes kpv-shatter-in{0%{opacity:0;clip-path:polygon(0 34%,100% 0,72% 100%,16% 72%);transform:scale(.4) rotate(var(--kpv-scatter-r))}68%{opacity:1;clip-path:polygon(0 0,100% 0,100% 100%,0 100%);transform:scale(1.08) rotate(-3deg)}100%{opacity:1;clip-path:inset(0);transform:none}}@keyframes kpv-card-pop{0%{opacity:0;transform:translateY(20px) rotate(var(--kpv-scatter-r)) scale(.65)}70%{opacity:1;transform:translateY(-4px) rotate(1deg) scale(1.07)}100%{opacity:1;transform:none}}@keyframes kpv-float-in{0%{opacity:0;transform:translateY(30px) rotate(var(--kpv-scatter-r))}70%{opacity:1;transform:translateY(-8px) rotate(-2deg)}100%{opacity:1;transform:none}}@keyframes kpv-float-idle{50%{transform:translateY(-.11em)}}@keyframes kpv-petal-idle{50%{transform:translate(.08em,-.13em) rotate(3deg)}}@keyframes kpv-pixel-in{0%{opacity:0;transform:translate(16px,16px) scale(.5)}50%{opacity:1;transform:translate(-5px,-5px) scale(1.15)}100%{opacity:1;transform:none}}@keyframes kpv-stamp{0%{opacity:0;transform:scale(1.65) rotate(-8deg)}66%{opacity:1;transform:scale(.9) rotate(3deg)}100%{opacity:1;transform:none}}@keyframes kpv-fade-focus{0%{opacity:.1;filter:blur(9px);transform:scale(.9)}100%{opacity:1;filter:none;transform:none}}@keyframes kpv-slide-in{0%{opacity:0;transform:translateX(calc(var(--kpv-stagger) * 5))}72%{opacity:1;transform:translateX(calc(var(--kpv-stagger) * -.2))}100%{opacity:1;transform:none}}
        @keyframes kpv-board-dot{50%{transform:translateY(-15px) scale(1.12)}}@keyframes kpv-card-face{0%{transform:scale(.4) rotate(-14deg)}70%{transform:scale(1.14) rotate(3deg)}100%{transform:none}}@keyframes kpv-noise-text{50%{opacity:.18;translate:19px -4px}}@keyframes kpv-impact-glyph{0%{transform:scale(.3) rotate(-21deg);filter:blur(8px)}65%{transform:scale(1.22) rotate(4deg);filter:none}100%{transform:none}}@keyframes kpv-outline-flash{0%{filter:brightness(.5);transform:scale(.94)}50%{filter:brightness(1.9) drop-shadow(0 0 14px var(--kpv-accent));transform:scale(1.04)}100%{filter:none;transform:none}}
        @keyframes kpv-light-sweep{0%,18%{transform:translate3d(-42%,0,0) rotate(-8deg);opacity:0}32%{opacity:.28}58%,100%{transform:translate3d(42%,0,0) rotate(-8deg);opacity:0}}@keyframes kpv-vignette-breathe{50%{transform:scale(1.08);opacity:.31}}@keyframes kpv-lines-drift{to{transform:translate3d(-4%,0,0)}}@keyframes kpv-grid-turn{0%{transform:rotate(0) scale(1.04)}50%{transform:rotate(2.2deg) scale(1.08)}100%{transform:rotate(0) scale(1.04)}}@keyframes kpv-grid-warp{0%,100%{transform:skewX(0) translateX(0)}50%{transform:skewX(-4deg) translateX(-2%)}}@keyframes kpv-grid-bob{50%{transform:translateY(-2.2%) rotate(.7deg)}}@keyframes kpv-light-orbit{to{transform:rotate(360deg) scale(1.12)}}.kpv-stage--paused *,.kpv-stage--paused::before,.kpv-stage--paused::after{animation-play-state:paused!important}
        @keyframes kpv-phrase-emphasis{0%{transform:scale(.62) translateY(.15em);filter:blur(5px)}62%{transform:scale(1.16) translateY(-.1em);filter:none}100%{transform:none}}
        @media(max-width:760px){.kpv-line{padding:clamp(36px,10vw,70px)}.kpv-line--previous{transform:translateY(-21vh) scale(.78)}.kpv-line--next{transform:translateY(26vh) scale(.72)}.kpv-scene--split .kpv-copy{transform:translateX(-6vw) scale(var(--kpv-pulse,1))}.kpv-scene--split .kpv-ghost{left:62%}.kpv-translation{max-width:95%}.kpv-frame{inset:18px}}
        @media(prefers-reduced-motion:reduce){.kpv-grain{animation:none}.kpv-copy,.kpv-line{transition:none!important}.kpv-token{filter:none!important}}
      `}</style>
      <style>{`
        .kpv-shutter{position:absolute;inset:-20%;z-index:1;pointer-events:none;opacity:.18;background:linear-gradient(112deg,transparent 0 42%,color-mix(in srgb,var(--kpv-accent) 72%,transparent) 47% 53%,transparent 58%);mix-blend-mode:screen;transform:translateX(-62%) rotate(-10deg);animation:kpv-shutter-scan 8s cubic-bezier(.2,.72,.3,1) infinite}.kpv-stage[data-scene="split"] .kpv-shutter{animation-duration:4.6s}.kpv-stage[data-scene="impact"] .kpv-shutter{opacity:.34;animation-duration:2.8s}.kpv-stage[data-quality="efficient"] .kpv-shutter{opacity:.1;animation-duration:14s}
        .kpv-radial-pulse{position:absolute;z-index:1;left:50%;top:50%;width:min(48vw,680px);aspect-ratio:1;transform:translate(-50%,-50%);pointer-events:none;opacity:.18;mix-blend-mode:screen}.kpv-radial-pulse i{position:absolute;inset:0;border:1px solid color-mix(in srgb,var(--kpv-accent) 70%,transparent);border-radius:50%;transform:scale(.25);opacity:0;animation:kpv-radial-pulse 4.8s cubic-bezier(.15,.72,.2,1) infinite}.kpv-radial-pulse i:nth-child(2){animation-delay:-1.6s}.kpv-radial-pulse i:nth-child(3){animation-delay:-3.2s}.kpv-stage[data-act="peak"] .kpv-radial-pulse{opacity:.34}.kpv-stage[data-scene="stack"] .kpv-radial-pulse{width:min(62vw,900px)}.kpv-stage[data-scene="split"] .kpv-radial-pulse{transform:translate(-50%,-50%) rotate(28deg) scaleX(.48)}.kpv-stage[data-quality="efficient"] .kpv-radial-pulse{display:none}
        .kpv-sparks{position:absolute;inset:0;z-index:2;pointer-events:none;opacity:calc(.08 + var(--kpv-energy,0) * .38);mix-blend-mode:screen}.kpv-sparks i{position:absolute;width:3px;height:3px;border-radius:50%;background:var(--kpv-accent);box-shadow:0 0 12px var(--kpv-accent);animation:kpv-spark-rise 3.6s linear infinite}.kpv-sparks i:nth-child(1){left:12%;top:74%;animation-delay:-.5s}.kpv-sparks i:nth-child(2){left:24%;top:82%;animation-delay:-2.2s}.kpv-sparks i:nth-child(3){left:38%;top:68%;animation-delay:-1.4s}.kpv-sparks i:nth-child(4){left:52%;top:78%;animation-delay:-3s}.kpv-sparks i:nth-child(5){left:67%;top:70%;animation-delay:-1.9s}.kpv-sparks i:nth-child(6){left:78%;top:84%;animation-delay:-.9s}.kpv-sparks i:nth-child(7){left:88%;top:62%;animation-delay:-2.7s}.kpv-sparks i:nth-child(8){left:44%;top:52%;animation-delay:-1.1s}.kpv-stage[data-scene="impact"] .kpv-sparks i{animation-duration:1.7s;width:4px;height:4px}.kpv-stage[data-quality="efficient"] .kpv-sparks{display:none}
        .kpv-line--active .kpv-token[data-state="live"] .kpv-token-fill{animation:kpv-token-flash .32s cubic-bezier(.1,.9,.2,1) both}
        @keyframes kpv-shutter-scan{0%,16%{opacity:0;transform:translateX(-72%) rotate(-10deg)}28%{opacity:.3}58%,100%{opacity:0;transform:translateX(72%) rotate(-10deg)}}@keyframes kpv-radial-pulse{0%{opacity:0;transform:scale(.18)}18%{opacity:.74}72%,100%{opacity:0;transform:scale(1.08)}}@keyframes kpv-spark-rise{0%{opacity:0;transform:translate3d(0,18px,0) scale(.4)}20%{opacity:1}100%{opacity:0;transform:translate3d(14px,-110px,0) scale(1.2)}}@keyframes kpv-token-flash{0%{filter:brightness(.8) drop-shadow(0 0 0 transparent)}52%{filter:brightness(1.8) drop-shadow(0 0 18px color-mix(in srgb,var(--kpv-accent) 70%,transparent))}100%{filter:none}}
      `}</style>
    </section>
  );
}
