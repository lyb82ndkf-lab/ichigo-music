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
if (DEFAULT_PROFILE.immersiveLyrics?.ktvShowLyricIndex !== false) fail('KTV lyric index must default to hidden');

const kineticKtv = fs.readFileSync(new URL('../src/components/lyrics/KineticKtvLyrics.jsx', import.meta.url), 'utf8');
const immersiveStageSource = fs.readFileSync(new URL('../src/components/lyrics/ImmersiveLyricsStage.jsx', import.meta.url), 'utf8');
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
const filmstripSource = fs.readFileSync(new URL('../src/components/lyrics/FilmStripLyrics.jsx', import.meta.url), 'utf8');
const railSource = fs.readFileSync(new URL('../src/components/lyrics/MonetLyricsRail.jsx', import.meta.url), 'utf8');
const appContextSource = fs.readFileSync(new URL('../src/context/AppContext.jsx', import.meta.url), 'utf8');
const spatialSourceUsesContext = fs.readFileSync(new URL('../src/components/lyrics/SpatialCanvasLyrics.jsx', import.meta.url), 'utf8');
const vinylSourceUsesContext = fs.readFileSync(new URL('../src/components/lyrics/VinylRecordLyrics.jsx', import.meta.url), 'utf8');
const audioOverlaySourceUsesContext = fs.readFileSync(new URL('../src/components/lyrics/MonetAudioOverlay.jsx', import.meta.url), 'utf8');
const floatingDecorSourceUsesContext = fs.readFileSync(new URL('../src/components/lyrics/MonetFloatingDecor.jsx', import.meta.url), 'utf8');

// PV Engine integration checks
for (const marker of [
  'PVEngine',
  'engineInstanceRef',
  'setPlaybackTime',
  'setLyricTimeline',
  'resolvedTemplate',
  'kpv-pixi-stage',
  'subscribeLyricClock'
]) {
  if (!kineticKtv.includes(marker)) fail(`KTV PV engine integration missing ${marker}`);
}

if (!immersiveStageSource.includes("React.lazy(() => import('./KineticKtvLyrics'))")) fail('KTV PV must be loaded on demand');
if (!immersiveStageSource.includes('<React.Suspense fallback=')) fail('KTV PV on-demand loading must preserve an immersive fallback surface');
if (!immersiveStageSource.includes('export function preloadKineticKtvLyrics()')) fail('KTV PV must expose a preload hook for a seamless entry');
if (!immersiveStageSource.includes("return import('./KineticKtvLyrics');")) fail('KTV PV preload hook must warm the same split module');
if (!posterSource.includes("if (animMode === 'talk') preloadKineticKtvLyrics();")) fail('KTV PV must preload when its mode is selected');

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
  ['filmstrip line', filmstripSource, 'const FilmLine = React.memo']
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
if (DEFAULT_PROFILE.immersiveLyrics.ktvShowTitleCard !== true) fail('KTV title card must default to enabled');
if (DEFAULT_PROFILE.immersiveLyrics.ktvShowLyricIndex !== false) fail('KTV lyric index must default to hidden');
if (typeof DEFAULT_PROFILE.immersiveLyrics.ktvSongTemplates !== 'object') fail('KTV song template map must default to an object');
for (const marker of ['KTV_TEMPLATE_GALLERY', 'PV 模板速选', 'ktvPreset: value', '锁定本曲', '恢复自动']) {
  if (!appSource.includes(marker)) fail(`KTV template selector is missing ${marker}`);
}
console.log(`[immersive-config] OK: ${IMMERSIVE_MODE_IDS.length} modes, ${IMMERSIVE_PRESETS.length} presets`);
