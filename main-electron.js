// main-electron.js - Electron main desktop application process
import { app, BrowserWindow, session, ipcMain, Tray, Menu, nativeImage } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import net from 'net';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow = null;
let desktopLyricsWindow = null;
let desktopLyricsPos = null;
let apiPort = 3000;

let tray = null;
let mediaIcons = null;
let isPlayingState = false;

// Get coordinates config path
const getPositionConfigPath = () => {
  return path.join(app.getPath('userData'), 'desktop-lyrics-position.json');
};

// Performance Config for GPU hardware acceleration
const getPerformanceConfigPath = () => {
  return path.join(app.getPath('userData'), 'app-performance-config.json');
};

const loadPerformanceConfig = () => {
  try {
    const configPath = getPerformanceConfigPath();
    if (fs.existsSync(configPath)) {
      const data = fs.readFileSync(configPath, 'utf8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('Failed to load performance config:', err);
  }
  return null;
};

const savePerformanceConfig = (cfg) => {
  try {
    const configPath = getPerformanceConfigPath();
    fs.writeFileSync(configPath, JSON.stringify(cfg), 'utf8');
  } catch (err) {
    console.error('Failed to save performance config:', err);
  }
};

// Apply Hardware Acceleration settings immediately on startup
const perfConfig = loadPerformanceConfig();
if (perfConfig && perfConfig.hardwareAcceleration === false) {
  console.log('Hardware acceleration disabled by user config.');
  app.disableHardwareAcceleration();
} else {
  console.log('Enabling GPU rendering and rasterization optimizations.');
  app.commandLine.appendSwitch('enable-gpu-rasterization');
  app.commandLine.appendSwitch('enable-oop-rasterization');
  app.commandLine.appendSwitch('force-gpu-rasterization');
  app.commandLine.appendSwitch('ignore-gpu-blocklist');
}

// Load position
const loadDesktopLyricsPosition = () => {
  try {
    const configPath = getPositionConfigPath();
    if (fs.existsSync(configPath)) {
      const data = fs.readFileSync(configPath, 'utf8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('Failed to load desktop lyrics position:', err);
  }
  return null;
};

// Save position
const saveDesktopLyricsPosition = (pos) => {
  try {
    const configPath = getPositionConfigPath();
    fs.writeFileSync(configPath, JSON.stringify(pos), 'utf8');
  } catch (err) {
    console.error('Failed to save desktop lyrics position:', err);
  }
};

// System Tray and Media Controls
function createTray() {
  try {
    const iconPath = path.join(__dirname, 'static', 'ichigo.png');
    const trayIcon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
    
    tray = new Tray(trayIcon);
    tray.setToolTip('ICHIGOMusic');
    
    updateTrayMenu(false);
    
    tray.on('double-click', () => {
      if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.show();
        mainWindow.focus();
      }
    });
  } catch (err) {
    console.error('Failed to create tray:', err);
  }
}

function updateTrayMenu(isPlaying) {
  if (!tray) return;
  
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'ICHIGOMusic',
      enabled: false
    },
    { type: 'separator' },
    {
      label: isPlaying ? '暂停' : '播放',
      click: () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('media-toggle-play');
        }
      }
    },
    {
      label: '上一首',
      click: () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('media-prev');
        }
      }
    },
    {
      label: '下一首',
      click: () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('media-next');
        }
      }
    },
    { type: 'separator' },
    {
      label: '显示主界面',
      click: () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          if (mainWindow.isMinimized()) mainWindow.restore();
          mainWindow.show();
          mainWindow.focus();
        }
      }
    },
    {
      label: '退出',
      click: () => {
        app.isQuitting = true;
        app.quit();
      }
    }
  ]);
  
  tray.setContextMenu(contextMenu);
}

function updateMediaControls(isPlaying) {
  updateTrayMenu(isPlaying);
  
  if (mainWindow && !mainWindow.isDestroyed() && mediaIcons) {
    try {
      const prevImg = nativeImage.createFromDataURL(mediaIcons.prev);
      const playImg = nativeImage.createFromDataURL(isPlaying ? mediaIcons.pause : mediaIcons.play);
      const nextImg = nativeImage.createFromDataURL(mediaIcons.next);
      
      mainWindow.setThumbarButtons([
        {
          tooltip: '上一首',
          icon: prevImg,
          click() {
            mainWindow.webContents.send('media-prev');
          }
        },
        {
          tooltip: isPlaying ? '暂停' : '播放',
          icon: playImg,
          click() {
            mainWindow.webContents.send('media-toggle-play');
          }
        },
        {
          tooltip: '下一首',
          icon: nextImg,
          click() {
            mainWindow.webContents.send('media-next');
          }
        }
      ]);
    } catch (err) {
      console.error('Failed to set thumbar buttons:', err);
    }
  }
}

import { createRequire } from 'module';
const require = createRequire(import.meta.url);

function findOpenPort(startPort) {
  return new Promise((resolve) => {
    function check(port) {
      const server = net.createServer();
      server.once('error', (err) => {
        if (err.code === 'EADDRINUSE' || err.code === 'EACCES') {
          check(port + 1);
        } else {
          resolve(port);
        }
      });
      server.once('listening', () => {
        server.close(() => resolve(port));
      });
      server.listen(port, '127.0.0.1');
    }
    check(startPort);
  });
}

async function startApiServer() {
  console.log('Finding open port for API server...');
  apiPort = await findOpenPort(3000);
  console.log(`Starting inline API server on port ${apiPort}...`);
  try {
    process.env.PORT = String(apiPort);
    process.env.ICHIGO_DESKTOP = 'true';
    const generateConfig = require('./server/generateConfig.js');
    await generateConfig();
    
    const ncmServer = require('./server/server.js');
    await ncmServer.serveNcmApi({
      port: apiPort,
      checkVersion: false,
      staticPath: app.isPackaged ? path.join(__dirname, 'dist') : null
    });
    console.log(`Inline API server started on port ${apiPort}`);
  } catch (err) {
    console.error('Failed to start inline NCM API server:', err);
  }
}

function toggleDesktopLyrics() {
  if (desktopLyricsWindow) {
    if (desktopLyricsWindow.isVisible()) {
      desktopLyricsWindow.hide();
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('desktop-lyrics-visibility-change', false);
      }
    } else {
      desktopLyricsWindow.show();
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('desktop-lyrics-visibility-change', true);
      }
    }
    return;
  }

  if (!desktopLyricsPos) {
    desktopLyricsPos = loadDesktopLyricsPosition();
  }
  desktopLyricsWindow = new BrowserWindow({
    width: 1000,
    height: 150,
    x: desktopLyricsPos ? desktopLyricsPos.x : undefined,
    y: desktopLyricsPos ? desktopLyricsPos.y : undefined,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    resizable: true,
    minWidth: 420,
    minHeight: 90,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload-electron.cjs')
    }
  });

  desktopLyricsWindow.setIgnoreMouseEvents(true, { forward: true });

  if (app.isPackaged) {
    desktopLyricsWindow.loadURL(`http://localhost:${apiPort}/?desktop-lyrics=true`);
  } else {
    desktopLyricsWindow.loadURL('http://localhost:5173/?desktop-lyrics=true');
  }

  // Handle connection failures gracefully
  desktopLyricsWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    if (!app.isPackaged && validatedURL.startsWith('http://localhost:5173')) {
      setTimeout(() => {
        if (desktopLyricsWindow && !desktopLyricsWindow.isDestroyed()) {
          desktopLyricsWindow.loadURL('http://localhost:5173/?desktop-lyrics=true');
        }
      }, 1000);
    }
  });

  // Track window movements to save coordinates
  desktopLyricsWindow.on('moved', () => {
    const bounds = desktopLyricsWindow.getBounds();
    desktopLyricsPos = { x: bounds.x, y: bounds.y };
    saveDesktopLyricsPosition(desktopLyricsPos);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('desktop-lyrics-moved', { x: bounds.x, y: bounds.y });
    }
  });

  // Intercept window close to hide it instead of destroying it
  desktopLyricsWindow.on('close', (e) => {
    if (!app.isQuitting) {
      e.preventDefault();
      desktopLyricsWindow.hide();
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('desktop-lyrics-visibility-change', false);
      }
    }
  });

  desktopLyricsWindow.on('closed', () => {
    desktopLyricsWindow = null;
  });
}

function createWindow() {
  if (!tray) {
    createTray();
  }
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 820,
    minWidth: 1024,
    minHeight: 720,
    title: 'ICHIGOMusic',
    icon: path.join(__dirname, 'static', 'ichigo.png'),
    frame: false,
    backgroundColor: '#050209',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
      preload: path.join(__dirname, 'preload-electron.cjs')
    }
  });

  // Handle IPC window controls
  ipcMain.removeAllListeners('window-minimize');
  ipcMain.removeAllListeners('window-maximize');
  ipcMain.removeAllListeners('window-close');
  
  ipcMain.on('window-minimize', () => mainWindow.minimize());
  ipcMain.on('window-maximize', () => {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  });
  ipcMain.on('window-close', () => {
    app.isQuitting = true;
    mainWindow.close();
  });
  ipcMain.on('window-hide', () => mainWindow.hide());

  // Desktop lyrics IPC
  ipcMain.on('toggle-desktop-lyrics', () => toggleDesktopLyrics());
  
  ipcMain.on('set-hardware-acceleration', (event, enabled) => {
    savePerformanceConfig({ hardwareAcceleration: enabled });
  });
  
  ipcMain.on('set-desktop-lyrics-lock', (event, locked) => {
    if (desktopLyricsWindow && !desktopLyricsWindow.isDestroyed()) {
      desktopLyricsWindow.setIgnoreMouseEvents(locked, { forward: true });
      if (event.sender !== desktopLyricsWindow.webContents) {
        desktopLyricsWindow.webContents.send('desktop-lyrics-config-reply', { locked });
      }
    }
  });

  ipcMain.on('update-desktop-lyrics-config', (event, data) => {
    if (desktopLyricsWindow && !desktopLyricsWindow.isDestroyed()) {
      if (event.sender !== desktopLyricsWindow.webContents) {
        desktopLyricsWindow.webContents.send('desktop-lyrics-config-reply', data);
      }
    }
    if (mainWindow && !mainWindow.isDestroyed() && event.sender !== mainWindow.webContents) {
      mainWindow.webContents.send('desktop-lyrics-config-reply', data);
    }
  });

  ipcMain.on('resize-desktop-lyrics', (event, size) => {
    if (desktopLyricsWindow && !desktopLyricsWindow.isDestroyed()) {
      const bounds = desktopLyricsWindow.getBounds();
      const width = Math.max(420, Math.min(1800, Math.round(size.width || bounds.width)));
      const height = Math.max(90, Math.min(420, Math.round(size.height || bounds.height)));
      desktopLyricsWindow.setBounds({ ...bounds, width, height });
    }
  });
  
  // Forward lyric updates from main window to desktop lyrics window
  ipcMain.on('send-lyrics-update', (event, data) => {
    if (desktopLyricsWindow && !desktopLyricsWindow.isDestroyed()) {
      desktopLyricsWindow.webContents.send('lyrics-update-reply', data);
    }
  });

  // Forward desktop lyrics configuration
  ipcMain.on('send-desktop-lyrics-config', (event, data) => {
    if (desktopLyricsWindow && !desktopLyricsWindow.isDestroyed() && event.sender !== desktopLyricsWindow.webContents) {
      desktopLyricsWindow.webContents.send('desktop-lyrics-config-reply', data);
    }
  });

  // Save desktop lyrics coordinates
  ipcMain.on('save-desktop-lyrics-position', (event, pos) => {
    desktopLyricsPos = pos;
    saveDesktopLyricsPosition(pos);
  });

  ipcMain.on('init-media-icons', (event, icons) => {
    mediaIcons = icons;
    updateMediaControls(isPlayingState);
  });

  ipcMain.on('update-playback-state', (event, isPlaying) => {
    isPlayingState = isPlaying;
    updateMediaControls(isPlaying);
  });

  // Profile Storage IPC
  ipcMain.on('read-profile', (event) => {
    try {
      const p = path.join(app.getPath('userData'), 'ichigomusic-profile.json');
      if (fs.existsSync(p)) {
        event.returnValue = fs.readFileSync(p, 'utf8');
        return;
      }
    } catch (e) {
      console.error('Failed to read profile via IPC:', e);
    }
    event.returnValue = null;
  });

  ipcMain.on('write-profile', (event, data) => {
    try {
      const p = path.join(app.getPath('userData'), 'ichigomusic-profile.json');
      fs.writeFileSync(p, data, 'utf8');
      event.returnValue = true;
    } catch (e) {
      console.error('Failed to write profile via IPC:', e);
      event.returnValue = false;
    }
  });

  // Load local Vite dev server or production build
  if (app.isPackaged) {
    mainWindow.loadURL(`http://localhost:${apiPort}`);
  } else {
    mainWindow.loadURL('http://localhost:5173');
  }
  // Forward console messages to terminal/logs
  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    console.log(`[FRONTEND CONSOLE] [Level:${level}] ${message} (at ${sourceId}:${line})`);
  });
  // Handle connection failures (like dev server still starting) gracefully
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    if (!app.isPackaged && validatedURL.startsWith('http://localhost:5173')) {
      console.log('Failed to load Vite server, retrying in 1000ms...');
      setTimeout(() => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.loadURL('http://localhost:5173');
        }
      }, 1000);
    }
  });

  // Handle window close
  mainWindow.on('close', (e) => {
    if (!app.isQuitting) {
      e.preventDefault();
      mainWindow.webContents.send('window-close-requested');
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    if (desktopLyricsWindow) {
      desktopLyricsWindow.close();
      desktopLyricsWindow = null;
    }
  });

  // Handle session cookie configuration for NetEase API
  session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
    details.requestHeaders['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
    callback({ cancel: false, requestHeaders: details.requestHeaders });
  });
}

app.setAppUserModelId("ICHIGOMusic");
app.name = "ICHIGOMusic";

app.whenReady().then(async () => {
  await startApiServer();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('before-quit', () => {
  app.isQuitting = true;
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
