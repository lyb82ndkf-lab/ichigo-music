import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const hook = fs.readFileSync(path.join(root, 'src/hooks/useListenTogether.js'), 'utf8');
const app = fs.readFileSync(path.join(root, 'src/App.jsx'), 'utf8');
const context = fs.readFileSync(path.join(root, 'src/context/AppContext.jsx'), 'utf8');
const audio = fs.readFileSync(path.join(root, 'src/components/AudioPlayer.jsx'), 'utf8');
const player = fs.readFileSync(path.join(root, 'src/components/PlayerBar.jsx'), 'utf8');
const modernPlayer = fs.readFileSync(path.join(root, 'src/components/ModernPlayerBar.jsx'), 'utf8');
const main = fs.readFileSync(path.join(root, 'main-electron.js'), 'utf8');
const preload = fs.readFileSync(path.join(root, 'preload-electron.cjs'), 'utf8');
const server = fs.readFileSync(path.resolve(root, '..', 'ichigomusicserver/server/server.js'), 'utf8');

if (!server.includes("type: 'presence'")) {
  throw new Error('listen server must broadcast presence changes to existing room clients');
}
if (!hook.includes("payload.type === 'presence'")) {
  throw new Error('listen client must apply presence updates from the websocket');
}
if (!hook.includes('const result = await listenApi.sendChat')) {
  throw new Error('chat send must reconcile the server response immediately');
}
if (!hook.includes('hostPlaybackVersion') || !hook.includes('remoteApplyTokenRef') || !hook.includes('Never seek backwards during an active PLAY epoch')) {
  throw new Error('listen client must order host transitions and avoid backward follower seeks');
}
if (!server.includes('isStaleHostPlayback') || !server.includes('clientStateVersion')) {
  throw new Error('listen server must reject stale host playback updates');
}
if (!app.includes('const playbackLocked = Boolean(listenState.roomId && !listenState.isHost)') || !app.includes('playbackLocked={playbackLocked}')) {
  throw new Error('app must lock member transport controls');
}
if (!context.includes('listenPlaybackLocked') || !context.includes('remoteSync') || !context.includes('if (stateRef.current.listenPlaybackLocked) return')) {
  throw new Error('context must block local transport, queue selection, and quality changes for members');
}
if (!audio.includes('canControlPlayback = true')) {
  throw new Error('audio end handling must not advance a member queue locally');
}
if (!player.includes('disabled={playbackLocked}') || !player.includes('showQualityMenu && !playbackLocked') || !modernPlayer.includes('disabled={playbackLocked}') || !modernPlayer.includes('showQualityMenu && !playbackLocked')) {
  throw new Error('classic and modern bars must disable transport, queue, mode, seek, and quality controls');
}
if (!main.includes("set-playback-controls-locked") || !main.includes('enabled: !playbackControlsLocked') || !preload.includes('setPlaybackControlsLocked')) {
  throw new Error('native taskbar and tray controls must receive the member lock');
}

console.log('[listen-together] OK: presence, chat reconciliation, and host-only transport controls are wired');
