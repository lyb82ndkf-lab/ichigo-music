const { contextBridge, ipcRenderer } = require('electron');

const subscribe = (channel, callback) => {
  const handler = (_event, data) => callback(data);
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.removeListener(channel, handler);
};

contextBridge.exposeInMainWorld('electronAPI', {
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),
  hide: () => ipcRenderer.send('window-hide'),
  onWindowCloseRequested: (callback) => subscribe('window-close-requested', callback),
  setHardwareAcceleration: (enabled) => ipcRenderer.send('set-hardware-acceleration', enabled),
  
  // Desktop Lyrics IPC
  toggleDesktopLyrics: () => ipcRenderer.send('toggle-desktop-lyrics'),
  sendLyricsUpdate: (data) => ipcRenderer.send('send-lyrics-update', data),
  onLyricsUpdate: (callback) => subscribe('lyrics-update-reply', callback),
  setDesktopLyricsLock: (locked) => ipcRenderer.send('set-desktop-lyrics-lock', locked),
  updateDesktopLyricsConfig: (data) => ipcRenderer.send('update-desktop-lyrics-config', data),
  resizeDesktopLyrics: (size) => ipcRenderer.send('resize-desktop-lyrics', size),
  sendDesktopLyricsConfig: (data) => ipcRenderer.send('send-desktop-lyrics-config', data),
  onDesktopLyricsConfig: (callback) => subscribe('desktop-lyrics-config-reply', callback),
  saveDesktopLyricsPosition: (pos) => ipcRenderer.send('save-desktop-lyrics-position', pos),
  onDesktopLyricsMoved: (callback) => subscribe('desktop-lyrics-moved', callback),
  onDesktopLyricsVisibilityChange: (callback) => subscribe('desktop-lyrics-visibility-change', callback),

  // Island Mini Player IPC
  toggleMiniPlayer: () => ipcRenderer.send('toggle-mini-player'),
  closeMiniPlayer: () => ipcRenderer.send('close-mini-player'),
  restoreMainWindow: () => ipcRenderer.send('restore-main-window'),
  sendMiniPlayerUpdate: (data) => ipcRenderer.send('send-mini-player-update', data),
  onMiniPlayerUpdate: (callback) => subscribe('mini-player-update-reply', callback),
  sendMiniPlayerAction: (action, payload) => ipcRenderer.send('mini-player-action', action, payload),
  onMiniPlayerAction: (callback) => subscribe('mini-player-action-reply', callback),
  saveMiniPlayerPosition: (pos) => ipcRenderer.send('save-mini-player-position', pos),
  onMiniPlayerVisibilityChange: (callback) => subscribe('mini-player-visibility-change', callback),

  // Taskbar / System Tray media controls
  onMediaPrev: (callback) => subscribe('media-prev', callback),
  onMediaNext: (callback) => subscribe('media-next', callback),
  onMediaPlayPause: (callback) => subscribe('media-play-pause', callback),
  onMediaTogglePlay: (callback) => subscribe('media-play-pause', callback),
  setPlaybackControlsLocked: (locked) => ipcRenderer.send('set-playback-controls-locked', locked),
  setGlobalShortcutsEnabled: (enabled) => ipcRenderer.send('set-global-shortcuts-enabled', enabled),
  clearSpecificCache: (data) => ipcRenderer.invoke('clear-specific-cache', data),
  initMediaIcons: (icons) => ipcRenderer.send('init-media-icons', icons),
  
  // Profile Storage IPC
  readProfile: () => ipcRenderer.sendSync('read-profile'),
  writeProfile: (data) => ipcRenderer.sendSync('write-profile', data),
  openExternal: (url) => ipcRenderer.send('open-external', url),
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  downloadUpdate: (data) => ipcRenderer.invoke('download-update', data),
  installUpdate: () => ipcRenderer.invoke('install-update'),
  onUpdateDownloadProgress: (callback) => subscribe('update-download-progress', callback),
  readClipboardText: () => ipcRenderer.invoke('read-clipboard-text'),
  getMainRuntimeLogs: () => ipcRenderer.invoke('get-main-runtime-logs'),
  clearMainRuntimeLogs: () => ipcRenderer.invoke('clear-main-runtime-logs'),
  onMainRuntimeLog: (callback) => subscribe('main-runtime-log', callback),
  getDefaultCacheDirectory: () => ipcRenderer.invoke('get-default-cache-directory'),
  selectCacheDirectory: () => ipcRenderer.invoke('select-cache-directory'),
  getAudioStreamUrl: (url) => ipcRenderer.invoke('get-audio-stream-url', url),
  getCachedAudio: (data) => ipcRenderer.invoke('get-cached-audio', data),
  cacheAudio: (data) => ipcRenderer.invoke('cache-audio', data),
  getCachedCover: (data) => ipcRenderer.invoke('get-cached-cover', data),
  cacheCover: (data) => ipcRenderer.invoke('cache-cover', data),
  readLyricCache: (data) => ipcRenderer.invoke('read-lyric-cache', data),
  writeLyricCache: (data) => ipcRenderer.invoke('write-lyric-cache', data),
  getCacheStats: (data) => ipcRenderer.invoke('get-cache-stats', data),
  clearAppCache: (data) => ipcRenderer.invoke('clear-app-cache', data),
  selectLocalMusicFolder: () => ipcRenderer.invoke('select-local-music-folder'),
  scanLocalMusicFolder: (folderPath) => ipcRenderer.invoke('scan-local-music-folder', folderPath),
  convertFuriganaBatch: (lines) => ipcRenderer.invoke('furigana:convert-batch', lines),
  convertFuriganaText: (text) => ipcRenderer.invoke('furigana:convert-text', text),
  saveLyricFile: (data) => ipcRenderer.invoke('save-lyric-file', data),
});
