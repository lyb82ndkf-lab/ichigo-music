import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const appContext = fs.readFileSync(path.join(root, 'src/context/AppContext.jsx'), 'utf8');
const audioPlayer = fs.readFileSync(path.join(root, 'src/components/AudioPlayer.jsx'), 'utf8');
const wordSweep = fs.readFileSync(path.join(root, 'src/components/lyrics/MonetWordSweep.jsx'), 'utf8');
const electronMain = fs.readFileSync(path.join(root, 'main-electron.js'), 'utf8');

const toggleStart = appContext.indexOf('const togglePlay = useCallback');
const toggleEnd = appContext.indexOf('const playNext = useCallback', toggleStart);
const toggleBlock = appContext.slice(toggleStart, toggleEnd);
const audioCacheLookupStart = electronMain.indexOf('const findCachedAudioFile');
const audioCacheLookupEnd = electronMain.indexOf('const inferImageExtension', audioCacheLookupStart);
const audioCacheLookupBlock = electronMain.slice(audioCacheLookupStart, audioCacheLookupEnd);

if (!toggleBlock.includes('if (!currentSong.url)')) {
  throw new Error('startup playback must resolve a source only when none is persisted');
}
if (toggleBlock.includes('audioElement?.play')) {
  throw new Error('togglePlay must not race React by calling audio.play directly');
}
if (!appContext.includes("if (cfg?.enabled && cfg.audio !== false && window.electronAPI?.getCachedAudio)")) {
  throw new Error('forced URL refresh must still prefer verified disk audio cache');
}
if (!appContext.includes('audioCacheQueueRef') || !appContext.includes('drainAudioCacheQueue')) {
  throw new Error('audio caching/prefetch must be serialized behind initial playback');
}
if (!electronMain.includes('isFinalAudioCacheEntry(entry.name, base)')) {
  throw new Error('audio cache lookup must exclude in-progress .tmp download files');
}
if (audioCacheLookupBlock.includes('entry.name.startsWith(`${base}.`)')) {
  throw new Error('prefix-only audio cache lookup can expose a partial download to Chromium');
}
if (!electronMain.includes('isPlayableAudioCacheFile')) {
  throw new Error('a finalized audio cache file must be validated before playback');
}
if (!audioPlayer.includes('if (currentSong?.url)')) {
  throw new Error('AudioPlayer must commit persisted/resolved source immediately');
}
if (!audioPlayer.includes("error?.name === 'NotSupportedError'") || !audioPlayer.includes("{ forceRefreshUrl: true }")) {
  throw new Error('a persisted source rejected before first play must refresh itself');
}
if (!audioPlayer.includes('HTMLMediaElement.NETWORK_NO_SOURCE')) {
  throw new Error('a missing/partial persisted local source must fall back before play() waits');
}
if (audioPlayer.includes('onCanPlay={() => { if (isPlaying) { setupWebAudio()')) {
  throw new Error('Web Audio must not capture an unverified first source before playback');
}
if (wordSweep.includes('const maskStr = tokenFinished')) {
  throw new Error('word sweep must not rebuild mask gradient strings every frame');
}
if (!wordSweep.includes("el.style.setProperty('--fill-width-px'")) {
  throw new Error('word sweep must use the lightweight fill-width CSS variable');
}

console.log('[playback-startup] OK: startup source validation and low-cost word sweep are enabled');
