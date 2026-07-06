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

  // Taskbar / System Tray media controls
  onMediaPrev: (callback) => subscribe('media-prev', callback),
  onMediaNext: (callback) => subscribe('media-next', callback),
  onMediaTogglePlay: (callback) => subscribe('media-toggle-play', callback),
  updatePlaybackState: (isPlaying) => ipcRenderer.send('update-playback-state', isPlaying),
  initMediaIcons: (icons) => ipcRenderer.send('init-media-icons', icons),
  
  // Profile Storage IPC
  readProfile: () => ipcRenderer.sendSync('read-profile'),
  writeProfile: (data) => ipcRenderer.sendSync('write-profile', data),
  openExternal: (url) => ipcRenderer.send('open-external', url),
});
