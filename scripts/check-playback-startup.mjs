import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const appContext = fs.readFileSync(path.join(root, 'src/context/AppContext.jsx'), 'utf8');
const audioPlayer = fs.readFileSync(path.join(root, 'src/components/AudioPlayer.jsx'), 'utf8');
const wordSweep = fs.readFileSync(path.join(root, 'src/components/lyrics/MonetWordSweep.jsx'), 'utf8');
const electronMain = fs.readFileSync(path.join(root, 'main-electron.js'), 'utf8');
const scrobbleModule = fs.readFileSync(path.join(root, 'server/module/scrobble.js'), 'utf8');

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
if (!audioPlayer.includes("src={audioSource || undefined}")) {
  throw new Error('AudioPlayer must not emit an empty src attribute during restored-session startup');
}
if (!audioPlayer.includes("audio?.getAttribute('src') || ''")) {
  throw new Error('AudioPlayer must ignore stale empty-source media error events');
}
if (appContext.includes("audioElement.removeAttribute('src')")) {
  throw new Error('AppContext must not call load() against an empty audio src during source resolution');
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
if (!audioPlayer.includes("api.scrobble(payload)")) {
  throw new Error('playback must submit the official recent-play feedback endpoint');
}
if (!audioPlayer.includes("api.scrobbleV1(payload)")) {
  throw new Error('playback feedback must retain the NCBL fallback endpoint');
}
if (!audioPlayer.includes("reportScrobble(audioRef.current?.currentTime || 0, true)")) {
  throw new Error('pause/end boundaries must submit the accumulated playback duration');
}
if (!audioPlayer.includes('scrobbleRef.current.reported = true;') || audioPlayer.includes('.finally(() => {\n      scrobbleRef.current.inFlight = false;\n      scrobbleRef.current.reported = true;')) {
  throw new Error('failed feedback requests must remain retryable');
}
if (!appContext.includes('fetchRemoteRecentlyPlayed') || !appContext.includes('api.getRecentSongs(100)')) {
  throw new Error('login must reconcile the local recent list with the account recent-play list');
}
if (!scrobbleModule.includes('const startplayData =') || !scrobbleModule.includes('const playData =') || !scrobbleModule.includes("request('/api/feedback/weblog'")) {
  throw new Error('the legacy scrobble module must submit both startplay and play feedback records');
}

console.log('[playback-startup] OK: startup source validation and low-cost word sweep are enabled');
