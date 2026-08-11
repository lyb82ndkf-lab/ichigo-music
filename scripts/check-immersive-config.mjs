import { DEFAULT_PROFILE } from '../src/utils/settingsProfile.js';
import { IMMERSIVE_MODE_IDS, IMMERSIVE_MODE_PARAMETER_KEYS, normalizeImmersiveMode } from '../src/utils/immersiveModes.js';
import { IMMERSIVE_PRESETS } from '../src/utils/immersivePresets.js';
import fs from 'node:fs';

const fail = (message) => {
  throw new Error(`[immersive-config] ${message}`);
};

if (new Set(IMMERSIVE_MODE_IDS).size !== IMMERSIVE_MODE_IDS.length) fail('mode ids must be unique');
for (const mode of IMMERSIVE_MODE_IDS) {
  const keys = IMMERSIVE_MODE_PARAMETER_KEYS[mode];
  if (!Array.isArray(keys)) fail(`missing parameter metadata for ${mode}`);
  for (const key of keys) {
    if (!(key in DEFAULT_PROFILE.immersiveLyrics)) fail(`${mode}.${key} has no default value`);
  }
}

const presetKeys = new Set(['showGlow', 'fade', 'scale', 'showDecor', 'wordSweepFps', 'backgroundBlur', 'backgroundDarken']);
for (const preset of IMMERSIVE_PRESETS) {
  if (!preset.value || !preset.label || !preset.description) fail('preset metadata is incomplete');
  for (const key of Object.keys(preset.values)) {
    if (!presetKeys.has(key)) fail(`preset ${preset.value} writes unsupported key ${key}`);
  }
}

if (normalizeImmersiveMode('__unknown__') !== 'regular') fail('unknown mode fallback must be regular');
if (DEFAULT_PROFILE.immersiveLyrics?.ktvShowPreviousLine !== false) fail('KTV PV must hide the previous lyric line by default');

const kineticKtv = fs.readFileSync(new URL('../src/components/lyrics/KineticKtvLyrics.jsx', import.meta.url), 'utf8');
const appSource = fs.readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const spatialSource = fs.readFileSync(new URL('../src/components/lyrics/SpatialCanvasLyrics.jsx', import.meta.url), 'utf8');
const vinylSource = fs.readFileSync(new URL('../src/components/lyrics/VinylRecordLyrics.jsx', import.meta.url), 'utf8');
const streamerSource = fs.readFileSync(new URL('../src/components/lyrics/StreamerLyrics.jsx', import.meta.url), 'utf8');
const audioVisualSource = fs.readFileSync(new URL('../src/components/lyrics/ImmersiveAudioVisual.jsx', import.meta.url), 'utf8');
const floatingDecorSource = fs.readFileSync(new URL('../src/components/lyrics/MonetFloatingDecor.jsx', import.meta.url), 'utf8');
const lyricClockSource = fs.readFileSync(new URL('../src/utils/lyricClock.js', import.meta.url), 'utf8');
const wordSweepSource = fs.readFileSync(new URL('../src/components/lyrics/MonetWordSweep.jsx', import.meta.url), 'utf8');
const audioOverlaySource = fs.readFileSync(new URL('../src/components/lyrics/MonetAudioOverlay.jsx', import.meta.url), 'utf8');
const posterSource = fs.readFileSync(new URL('../src/components/lyrics/MonetPosterLayout.jsx', import.meta.url), 'utf8');
const starfieldSource = fs.readFileSync(new URL('../src/components/lyrics/StarfieldLyrics.jsx', import.meta.url), 'utf8');
const filmstripSource = fs.readFileSync(new URL('../src/components/lyrics/FilmStripLyrics.jsx', import.meta.url), 'utf8');
const inkflowSource = fs.readFileSync(new URL('../src/components/lyrics/InkFlowLyrics.jsx', import.meta.url), 'utf8');
const spotlightSource = fs.readFileSync(new URL('../src/components/lyrics/SpotlightLyrics.jsx', import.meta.url), 'utf8');
const railSource = fs.readFileSync(new URL('../src/components/lyrics/MonetLyricsRail.jsx', import.meta.url), 'utf8');
const appContextSource = fs.readFileSync(new URL('../src/context/AppContext.jsx', import.meta.url), 'utf8');
const spatialSourceUsesContext = fs.readFileSync(new URL('../src/components/lyrics/SpatialCanvasLyrics.jsx', import.meta.url), 'utf8');
const vinylSourceUsesContext = fs.readFileSync(new URL('../src/components/lyrics/VinylRecordLyrics.jsx', import.meta.url), 'utf8');
const audioOverlaySourceUsesContext = fs.readFileSync(new URL('../src/components/lyrics/MonetAudioOverlay.jsx', import.meta.url), 'utf8');
const floatingDecorSourceUsesContext = fs.readFileSync(new URL('../src/components/lyrics/MonetFloatingDecor.jsx', import.meta.url), 'utf8');
for (const marker of [
  'resolveLineGrammar',
  'getLineRhythm',
  'resolveLineRole',
  'isSectionStart',
  'resolveScript',
  'resolveKineticCues',
  'condenseCompositionTokens',
  'PV_PREVIEW_LYRICS',
  'kpv-script--',
  'AUTO_CHOREOGRAPHIES',
  'PV_ACTS',
  'resolveSongAct',
  'resolveRenderQuality',
  'autoTemplate',
  'canRefineOpening',
  'ktvSongTemplates',
  'CARD_BOARD_PRESETS',
  'kpv-field',
  'kpv-beat-rig',
  'data-quality',
  'data-hook',
  'kpv-hook-hit',
  'kpv-camera',
  'kpv-camera-shake',
  'kpv-title-card',
  'kpv-chapter-frame',
  'data-auto-template',
  'resolvePhraseEmphasis',
  'kpv-phrase-ribbon',
  'vertical-columns',
  '--kpv-accent-alt',
  'kpv-translation-fill',
  '--kpv-phrase-reveal',
  'scaleX(var(--kpv-fill-ratio))',
  'resolveChoreographyShot',
  'kpv-keyframe--phrase',
  'heroLength',
  'kpv-cover-cel',
  'kpv-cover-opacity',
  'cueSegments',
  'kpv-echoes',
  'kpv-keyframe',
  'kpv-line--active .kpv-token-motion',
  'will-change:auto',
  'kpv-preview-mark',
  'kpv-coverwash',
  'kpv-token-motion',
  'kpv-line--active .kpv-token-fill',
  'will-change:auto;pointer-events:none',
  'kpv-impact-card-land',
  'refs.finished',
  'freeze its final token state',
  'updateAudioPulse',
  'updateAudioPulse(clockNow)',
  'const update = (clockNow = performance.now())',
  'kpv-field-enter',
  'kpv-keyframe-in',
  'kpv-layout--quote-board',
  'kpv-layout--ticker-board',
  'kpv-layout--emblem-board',
  "window.ichigoAnalyser",
  "--kpv-energy-scale",
  "stageRef.current.style.setProperty('--kpv-phrase-progress'"
  ,'resolveVisualActiveIndex'
  ,'clockActiveIndex'
  ,'subscribeLyricClock(syncVisualIndex)'
  ,'showPreviousLine'
  ,'ktvShowPreviousLine'
]) {
  if (!kineticKtv.includes(marker)) fail(`KTV PV expression layer missing ${marker}`);
}
for (const marker of ['lastLyricPaintAt', 'lyricPaintInterval']) {
  if (!kineticKtv.includes(marker)) fail(`KTV PV performance guard missing ${marker}`);
}
for (const marker of ['lastSampleAt', 'idleTimer', 'wakeRef', 'idleCleared', 'playingRef', 'spatialState', 'new Uint8Array(analyser.frequencyBinCount)']) {
  if (!spatialSource.includes(marker)) fail(`spatial performance guard missing ${marker}`);
}
for (const marker of ['lastDrawAt', 'idleTimer', 'wakeRef', 'playingRef', 'vinylState', 'new Float32Array(bufferLength)', 'isDisabled(configRef.current)']) {
  if (!vinylSource.includes(marker)) fail(`vinyl performance guard missing ${marker}`);
}
for (const marker of ['lastPaintAt', 'streamProgress', 'streamState', 'clockNow']) {
  if (!streamerSource.includes(marker)) fail(`streamer performance guard missing ${marker}`);
}
const cloudSource = fs.readFileSync(new URL('../src/components/lyrics/CloudStepLyrics.jsx', import.meta.url), 'utf8');
const tiltSource = fs.readFileSync(new URL('../src/components/lyrics/TiltLyrics.jsx', import.meta.url), 'utf8');
for (const marker of ['cloudState', 'paintProgress']) {
  if (!cloudSource.includes(marker)) fail(`cloudstep token update guard missing ${marker}`);
}
for (const marker of ['lastPaint', 'Math.abs(dist) > 1', 'lastTranslationOpacity']) {
  if (!tiltSource.includes(marker)) fail(`tilt token update guard missing ${marker}`);
}
for (const marker of ['idleTimer', 'playingRef', 'wakeRef', 'schedule(true)', 'visualizerStyle === \'off\'', 'new Uint8Array(analyser.frequencyBinCount)']) {
  if (!audioVisualSource.includes(marker)) fail(`shared audio visual performance guard missing ${marker}`);
}
if (!audioVisualSource.includes('const beamGradient = context.createRadialGradient')) fail('shared audio visual beam gradient should be reused per frame');
if ((audioVisualSource.match(/visualEnergy \+=/g) || []).length !== 1) fail('shared audio visual energy smoothing must run once per sample');
for (const marker of ['idleTimer', 'wakeRef', 'playingRef', 'analyserBuffer', 'document.hidden', 'scheduleIdle']) {
  if (!floatingDecorSource.includes(marker)) fail(`floating decor performance guard missing ${marker}`);
}
for (const marker of ['isDocumentHidden', 'scheduleFrame', 'visibilitychange']) {
  if (!lyricClockSource.includes(marker)) fail(`lyric clock visibility guard missing ${marker}`);
}
for (const marker of ['quantize', 'Quantising to a tenth of a pixel']) {
  if (!wordSweepSource.includes(marker)) fail(`word sweep update quantization missing ${marker}`);
}
for (const marker of ['idleTimer', 'idleCleared', 'configuredVisualizerStyle === \'off\'', 'new Float32Array(currentBufferLength)', 'schedule(true)', 'window.clearTimeout(idleTimer)', 'isPlaying && !document.hidden']) {
  if (!audioOverlaySource.includes(marker)) fail(`audio overlay idle scheduler missing ${marker}`);
}
if (!posterSource.includes('React.memo(MonetPosterLayout)')) fail('poster layout must be memoized against progress-only renders');
for (const [name, source, marker] of [
  ['starfield line', starfieldSource, 'const StarLine = React.memo'],
  ['filmstrip line', filmstripSource, 'const FilmLine = React.memo'],
  ['inkflow line', inkflowSource, 'const InkLine = React.memo'],
  ['spotlight line', spotlightSource, 'const StageLine = React.memo']
]) {
  if (!source.includes(marker)) fail(`${name} should be memoized`);
}
if (!railSource.includes("willChange: status === 'active' ? 'transform, opacity' : 'auto'")) fail('regular lyric rail should promote only the active line');
for (const marker of ['samePlainValue', 'advancedLyricConfigRef', 'rawAdvancedLyricConfig']) {
  if (!appContextSource.includes(marker)) fail(`advanced lyric config identity guard missing ${marker}`);
}
for (const [name, source] of [
  ['spatial', spatialSourceUsesContext],
  ['vinyl', vinylSourceUsesContext],
  ['audio overlay', audioOverlaySourceUsesContext],
  ['floating decor', floatingDecorSourceUsesContext]
]) {
  if (source.includes("from '../../context/AppContext'")) fail(`${name} must receive stable config props instead of subscribing to AppContext`);
}
if (DEFAULT_PROFILE.immersiveLyrics.ktvUseCoverTexture !== true) fail('KTV cover texture must default to enabled');
if (DEFAULT_PROFILE.immersiveLyrics.ktvBeatReactive !== true) fail('KTV beat-reactive camera must default to enabled');
if (DEFAULT_PROFILE.immersiveLyrics.ktvPreviewEnabled !== false) fail('KTV PV preview must default to disabled');
if (DEFAULT_PROFILE.immersiveLyrics.ktvRenderQuality !== 'auto') fail('KTV PV quality must default to automatic');
if (DEFAULT_PROFILE.immersiveLyrics.ktvAccent !== 'auto') fail('KTV PV accent must default to automatic');
if (DEFAULT_PROFILE.immersiveLyrics.ktvShowTitleCard !== true) fail('KTV title card must default to enabled');
for (const key of ['ktvCameraZoom', 'ktvCameraTilt', 'ktvCameraShake']) {
  if (DEFAULT_PROFILE.immersiveLyrics[key] !== 0) fail(`KTV camera ${key} must default to zero`);
}
if (typeof DEFAULT_PROFILE.immersiveLyrics.ktvSongTemplates !== 'object') fail('KTV song template map must default to an object');
for (const marker of ['KTV_TEMPLATE_GALLERY', 'PV 模板速选', 'ktvPreset: value', '锁定本曲', '恢复自动']) {
  if (!appSource.includes(marker)) fail(`KTV template selector is missing ${marker}`);
}
for (const scene of ['poster', 'split', 'stack', 'impact', 'orbit']) {
  if (!kineticKtv.includes(`kpv-scene--${scene}`)) fail(`KTV PV is missing ${scene} scene treatment`);
}
console.log(`[immersive-config] OK: ${IMMERSIVE_MODE_IDS.length} modes, ${IMMERSIVE_PRESETS.length} presets`);
