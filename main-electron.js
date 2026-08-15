// main-electron.js - Electron main desktop application process
import { app, BrowserWindow, session, ipcMain, Tray, Menu, nativeImage, shell, dialog, clipboard, net as electronNet, protocol } from 'electron';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import net from 'net';
import fs from 'fs';
import http from 'http';
import { createHash } from 'crypto';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import { spawn } from 'child_process';

protocol.registerSchemesAsPrivileged([{
  scheme: 'ichigo-cache',
  privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true }
}]);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow = null;
let desktopLyricsWindow = null;
let desktopLyricsPos = null;
let apiPort = 3000;

let tray = null;
let mediaIcons = null;
let isPlayingState = false;
// Renderer-owned state: members of a listen-together room cannot invoke transport controls from native surfaces.
let playbackControlsLocked = false;
let downloadedUpdatePath = '';
const mainRuntimeLogs = [];
let mainRuntimeSequence = 0;
const cacheDownloadInFlight = new Map();
const cachePruneLastRun = new Map();
const cacheResourcePaths = new Map();
const UPDATE_REPOSITORY = 'lyb82ndkf-lab/ichigo-music';

const mainNativeConsole = {
  log: console.log.bind(console),
  info: console.info.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console)
};

const serializeMainLogValue = (value) => {
  let text;
  if (value instanceof Error) text = value.stack || `${value.name}: ${value.message}`;
  else if (typeof value === 'string') text = value;
  else {
    try { text = JSON.stringify(value); } catch { text = String(value); }
  }
  return String(text)
    .replace(/(MUSIC_U\s*[=:]\s*)[^;\s]+/gi, '$1[REDACTED]')
    .replace(/(cookie|token|authorization)(\s*[=:]\s*)[^;\s]+/gi, '$1$2[REDACTED]')
    .slice(0, 8000);
};

const recordMainRuntimeLog = (level, args) => {
  const entry = {
    id: `main-${++mainRuntimeSequence}`,
    timestamp: Date.now(),
    level: level === 'log' ? 'debug' : level,
    source: 'main',
    message: serializeMainLogValue(args[0] ?? ''),
    details: args.slice(1).map(serializeMainLogValue).join(' '),
    count: 1
  };
  mainRuntimeLogs.push(entry);
  if (mainRuntimeLogs.length > 300) mainRuntimeLogs.splice(0, mainRuntimeLogs.length - 300);
  try {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('main-runtime-log', entry);
  } catch { /* diagnostic delivery must never affect the application */ }
};

for (const level of Object.keys(mainNativeConsole)) {
  console[level] = (...args) => {
    mainNativeConsole[level](...args);
    recordMainRuntimeLog(level, args);
  };
}

// Get coordinates config path
const getPositionConfigPath = () => {
  return path.join(app.getPath('userData'), 'desktop-lyrics-position.json');
};

const getCacheResourceUrl = (filePath, namespace) => {
  const resolvedPath = path.resolve(filePath);
  const token = createHash('sha256').update(resolvedPath).digest('hex');
  cacheResourcePaths.set(token, resolvedPath);
  while (cacheResourcePaths.size > 500) {
    cacheResourcePaths.delete(cacheResourcePaths.keys().next().value);
  }
  return `ichigo-cache://${namespace}/${token}`;
};

const getCoverResourceUrl = (filePath) => getCacheResourceUrl(filePath, 'cover');
const getAudioResourceUrl = (filePath) => getCacheResourceUrl(filePath, 'audio');

// Same-origin HTTP audio proxy for the Web Audio visualizer. createMediaElementSource
// feeds the analyser reliably over standard HTTP + CORS (custom protocols do not).
// Both remote CDN tracks and cached audio files are re-served here so the analyser
// always receives real spectrum data without muting or failing the media element.
let audioProxyServer = null;
let audioProxyPort = 0;
let audioProxyReady = null;

const startAudioProxy = () => {
  if (audioProxyReady) return audioProxyReady;
  audioProxyReady = new Promise((resolve, reject) => {
    audioProxyServer = http.createServer(async (req, res) => {
      try {
        const parsed = new URL(req.url, 'http://127.0.0.1');
        if (parsed.pathname !== '/audio') {
          res.writeHead(404);
          res.end();
          return;
        }
        const remoteUrl = parsed.searchParams.get('url');
        const token = parsed.searchParams.get('token');
        const corsHeaders = {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Accept-Ranges',
          'Accept-Ranges': 'bytes'
        };

        if (remoteUrl && /^https?:\/\//i.test(remoteUrl)) {
          const headers = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' };
          if (req.headers.range) headers.Range = req.headers.range;
          const remote = await electronNet.fetch(remoteUrl, { headers });
          const contentType = remote.headers.get('content-type') || 'application/octet-stream';
          const contentLength = remote.headers.get('content-length');
          const contentRange = remote.headers.get('content-range');
          res.writeHead(remote.status, {
            ...corsHeaders,
            'Content-Type': contentType,
            ...(contentLength ? { 'Content-Length': contentLength } : {}),
            ...(contentRange ? { 'Content-Range': contentRange } : {})
          });
          const reader = remote.body?.getReader?.();
          if (!reader) { res.end(); return; }
          try {
            for (;;) {
              const { done, value } = await reader.read();
              if (done) break;
              res.write(Buffer.from(value));
            }
          } catch {}
          res.end();
          return;
        }

        if (token) {
          const filePath = cacheResourcePaths.get(token);
          if (!filePath || !fs.existsSync(filePath)) {
            res.writeHead(404);
            res.end();
            return;
          }
          const stat = fs.statSync(filePath);
          const range = req.headers.range;
          let start = 0;
          let end = stat.size - 1;
          let status = 200;
          if (range) {
            const m = /bytes=(\d*)-(\d*)/.exec(range);
            if (m && (m[1] || m[2])) {
              if (m[1]) start = parseInt(m[1], 10);
              if (m[2]) end = Math.min(parseInt(m[2], 10), stat.size - 1);
              if (start >= stat.size) {
                res.writeHead(416, { ...corsHeaders, 'Content-Range': `bytes */${stat.size}` });
                res.end();
                return;
              }
              status = 206;
            }
          }
          res.writeHead(status, {
            ...corsHeaders,
            'Content-Type': 'audio/mpeg',
            'Content-Length': String(end - start + 1),
            ...(status === 206 ? { 'Content-Range': `bytes ${start}-${end}/${stat.size}` } : {})
          });
          const stream = fs.createReadStream(filePath, { start, end });
          stream.on('error', () => res.end());
          stream.pipe(res);
          return;
        }

        res.writeHead(400);
        res.end();
      } catch (error) {
        console.warn('Audio proxy request failed:', error);
        res.writeHead(502);
        res.end();
      }
    });
    audioProxyServer.on('error', (error) => {
      audioProxyReady = null;
      reject(error);
    });
    audioProxyServer.listen(0, '127.0.0.1', () => {
      audioProxyPort = audioProxyServer.address().port;
      console.log(`Audio visualizer proxy listening on 127.0.0.1:${audioProxyPort}`);
      resolve(audioProxyPort);
    });
  });
  return audioProxyReady;
};

const getAudioHttpUrl = (src) => {
  if (!src) return null;
  if (/^https?:\/\//i.test(src)) {
    return `http://127.0.0.1:${audioProxyPort}/audio?url=${encodeURIComponent(src)}`;
  }
  const m = /^ichigo-cache:\/\/audio\/([0-9a-f]+)/i.exec(src);
  if (m) {
    return `http://127.0.0.1:${audioProxyPort}/audio?token=${m[1]}`;
  }
  return null;
};

const registerCacheProtocol = () => {
  protocol.handle('ichigo-cache', async (request) => {
    try {
      const url = new URL(request.url);
      const token = url.pathname.replace(/^\//, '');
      const namespace = url.hostname.toLowerCase();

      const filePath = namespace === 'cover' || namespace === 'audio'
        ? cacheResourcePaths.get(token)
        : null;
      if (!filePath) return new Response('Not found', { status: 404 });
      // Cached files keep the exact v1.8.3 serving path (no re-wrap) so
      // playback of cached media is never affected by the CORS decoration.
      return electronNet.fetch(pathToFileURL(filePath).toString());
    } catch (error) {
      console.warn('Failed to serve cached media:', error);
      return new Response('Unable to read cached media', { status: 500 });
    }
  });
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

const githubRequest = async (url) => {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'ICHIGOMusic-Updater'
    }
  });
  if (!response.ok) throw new Error(`GitHub request failed: ${response.status}`);
  return response.json();
};

const getLatestRelease = async () => {
  const release = await githubRequest(`https://api.github.com/repos/${UPDATE_REPOSITORY}/releases/latest`);
  const assets = Array.isArray(release.assets) ? release.assets : [];
  const installer = assets.find(asset => /setup.*\.exe$/i.test(asset.name))
    || assets.find(asset => /\.exe$/i.test(asset.name));
  return {
    version: String(release.tag_name || '').replace(/^v/i, ''),
    tagName: release.tag_name || '',
    name: release.name || '',
    notes: release.body || '',
    publishedAt: release.published_at || '',
    assetName: installer?.name || '',
    assetUrl: installer?.browser_download_url || '',
    assetSize: Number(installer?.size || 0),
    assetDigest: installer?.digest || ''
  };
};

const isAllowedUpdateUrl = (value) => {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && (url.hostname === 'github.com' || url.hostname.endsWith('.githubusercontent.com'));
  } catch {
    return false;
  }
};

const isSafeExternalUrl = (value) => {
  try {
    const url = new URL(String(value || ''));
    return url.protocol === 'https:' || url.protocol === 'http:' || url.protocol === 'mailto:';
  } catch {
    return false;
  }
};

const getDefaultCacheDirectory = () => {
  // The install directory may be read-only when the app is installed under
  // Program Files. Keep user-generated cache data in Electron's writable
  // profile directory instead.
  return path.join(app.getPath('userData'), 'cache');
};

const getLegacyCacheDirectory = () => {
  const baseDir = app.isPackaged ? path.dirname(app.getPath('exe')) : __dirname;
  return path.join(baseDir, 'ichigomusic-cache');
};

const safeCacheDir = (cacheDir) => {
  const dir = String(cacheDir || '').trim();
  return dir || getDefaultCacheDirectory();
};

const ensureDir = async (dir) => {
  await fs.promises.mkdir(dir, { recursive: true });
};

const migrateLegacyCache = async () => {
  const legacyRoot = getLegacyCacheDirectory();
  const targetRoot = getDefaultCacheDirectory();
  if (path.resolve(legacyRoot) === path.resolve(targetRoot) || !fs.existsSync(legacyRoot)) return;

  for (const category of ['audio', 'covers', 'lyrics']) {
    const sourceDir = path.join(legacyRoot, category);
    const targetDir = path.join(targetRoot, category);
    let entries;
    try {
      entries = await fs.promises.readdir(sourceDir, { withFileTypes: true });
    } catch {
      continue;
    }
    await ensureDir(targetDir);
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const sourcePath = path.join(sourceDir, entry.name);
      const targetPath = path.join(targetDir, entry.name);
      try {
        if (fs.existsSync(targetPath)) {
          await fs.promises.unlink(sourcePath).catch(() => {});
          continue;
        }
        await fs.promises.rename(sourcePath, targetPath);
      } catch {
        // A cross-volume move may not support rename; copy atomically instead.
        try {
          const tempPath = `${targetPath}.migrating-${Date.now()}`;
          await fs.promises.copyFile(sourcePath, tempPath);
          await fs.promises.rename(tempPath, targetPath);
          await fs.promises.unlink(sourcePath);
        } catch {}
      }
    }
  }
};

const writeResponseToFile = async (response, tempPath) => {
  if (!response.body) throw new Error('Response body is empty');
  const readable = Readable.fromWeb(response.body);
  const writable = fs.createWriteStream(tempPath, { flags: 'wx' });
  try {
    await pipeline(readable, writable);
  } catch (error) {
    readable.destroy();
    writable.destroy();
    await fs.promises.rm(tempPath, { force: true }).catch(() => {});
    throw error;
  }
};

const inferAudioExtension = (url, contentType = '') => {
  const fromUrl = String(url || '').split('?')[0].match(/\.(mp3|m4a|flac|wav|ogg|aac)$/i)?.[1];
  if (fromUrl) return fromUrl.toLowerCase();
  if (/flac/i.test(contentType)) return 'flac';
  if (/mp4|m4a|aac/i.test(contentType)) return 'm4a';
  if (/ogg/i.test(contentType)) return 'ogg';
  if (/wav/i.test(contentType)) return 'wav';
  return 'mp3';
};

const getAudioCacheBase = (songId, quality) => `${String(songId).replace(/[^\w.-]/g, '_')}_${String(quality || 'default').replace(/[^\w.-]/g, '_')}`;
const AUDIO_CACHE_EXTENSIONS = Object.freeze(['mp3', 'm4a', 'flac', 'wav', 'ogg', 'aac']);

const isFinalAudioCacheEntry = (name, base) => {
  const normalizedName = String(name || '').toLowerCase();
  const normalizedBase = String(base || '').toLowerCase();
  return AUDIO_CACHE_EXTENSIONS.some(ext => normalizedName === `${normalizedBase}.${ext}`);
};

const isPlayableAudioCacheFile = async (filePath) => {
  let handle;
  try {
    const stats = await fs.promises.stat(filePath);
    if (!stats.isFile() || stats.size < 4096) return false;

    handle = await fs.promises.open(filePath, 'r');
    const header = Buffer.alloc(16);
    const { bytesRead } = await handle.read(header, 0, header.length, 0);
    if (bytesRead < 4) return false;

    const ascii4 = header.subarray(0, 4).toString('ascii');
    const isMp3 = header.subarray(0, 3).toString('ascii') === 'ID3'
      || (header[0] === 0xff && (header[1] & 0xe0) === 0xe0);
    const isFlac = ascii4 === 'fLaC';
    const isOgg = ascii4 === 'OggS';
    const isWave = ascii4 === 'RIFF' && header.subarray(8, 12).toString('ascii') === 'WAVE';
    const isMp4 = bytesRead >= 8 && header.subarray(4, 8).toString('ascii') === 'ftyp';
    const isAac = header[0] === 0xff && (header[1] & 0xf6) === 0xf0;
    return isMp3 || isFlac || isOgg || isWave || isMp4 || isAac;
  } catch {
    return false;
  } finally {
    await handle?.close().catch(() => {});
  }
};

const findCachedAudioFile = async (cacheDir, songId, quality) => {
  const audioDir = path.join(safeCacheDir(cacheDir), 'audio');
  try {
    const entries = await fs.promises.readdir(audioDir, { withFileTypes: true });
    const base = getAudioCacheBase(songId, quality);
    const hit = entries.find(entry => entry.isFile() && isFinalAudioCacheEntry(entry.name, base));
    if (!hit) return null;
    const filePath = path.join(audioDir, hit.name);
    if (!(await isPlayableAudioCacheFile(filePath))) {
      console.warn(`[CACHE] Removing invalid audio cache: ${hit.name}`);
      await fs.promises.rm(filePath, { force: true }).catch(() => {});
      return null;
    }
    const now = new Date();
    fs.promises.utimes(filePath, now, now).catch(() => {});
    return filePath;
  } catch {
    return null;
  }
};

const inferImageExtension = (url, contentType = '') => {
  const fromUrl = String(url || '').split('?')[0].match(/\.(jpe?g|png|webp|gif|avif)$/i)?.[1];
  if (fromUrl) return fromUrl.toLowerCase().replace('jpeg', 'jpg');
  if (/png/i.test(contentType)) return 'png';
  if (/webp/i.test(contentType)) return 'webp';
  if (/gif/i.test(contentType)) return 'gif';
  if (/avif/i.test(contentType)) return 'avif';
  return 'jpg';
};

const getCoverCacheBase = (songId) => String(songId).replace(/[^\w.-]/g, '_');

const findCachedCoverFile = async (cacheDir, songId) => {
  const coverDir = path.join(safeCacheDir(cacheDir), 'covers');
  try {
    const entries = await fs.promises.readdir(coverDir, { withFileTypes: true });
    const base = getCoverCacheBase(songId);
    const hit = entries.find(entry => entry.isFile() && entry.name.startsWith(`${base}.`));
    if (!hit) return null;
    const filePath = path.join(coverDir, hit.name);
    const now = new Date();
    fs.promises.utimes(filePath, now, now).catch(() => {});
    return filePath;
  } catch {
    return null;
  }
};

const collectCacheFiles = async (dir) => {
  const results = [];
  async function walk(currentDir) {
    let entries = [];
    try {
      entries = await fs.promises.readdir(currentDir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const entryPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        await walk(entryPath);
      } else if (entry.isFile()) {
        try {
          const stat = await fs.promises.stat(entryPath);
          results.push({ path: entryPath, size: stat.size, atimeMs: stat.atimeMs, mtimeMs: stat.mtimeMs });
        } catch {}
      }
    }
  }
  await walk(dir);
  return results;
};

const pruneCache = async (cacheDir, maxBytes) => {
  const root = safeCacheDir(cacheDir);
  const pruneKey = path.resolve(root);
  const now = Date.now();
  const lastRun = cachePruneLastRun.get(pruneKey) || 0;
  // Cache writes can happen in bursts while preloading the next songs. Avoid
  // walking thousands of files for every single cover/audio write.
  if (now - lastRun < 15000) return { total: 0, removed: 0, throttled: true };
  cachePruneLastRun.set(pruneKey, now);
  const limit = Math.max(128 * 1024 * 1024, Number(maxBytes) || 1024 * 1024 * 1024);
  const files = await collectCacheFiles(root);
  let total = files.reduce((sum, file) => sum + file.size, 0);
  if (total <= limit) return { total, removed: 0 };
  let removed = 0;
  files.sort((a, b) => (a.atimeMs || a.mtimeMs) - (b.atimeMs || b.mtimeMs));
  for (const file of files) {
    if (total <= limit) break;
    try {
      await fs.promises.unlink(file.path);
      total -= file.size;
      removed += 1;
    } catch {}
  }
  return { total, removed };
};

const lyricCachePath = (cacheDir, key) => {
  const safeKey = Buffer.from(String(key || ''), 'utf8').toString('base64url');
  return path.join(safeCacheDir(cacheDir), 'lyrics', `${safeKey}.json`);
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

function updateTrayMenu(isPlaying, controlsLocked = playbackControlsLocked) {
  if (!tray) return;
  
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'ICHIGOMusic',
      enabled: false
    },
    { type: 'separator' },
    {
      label: isPlaying ? '暂停' : '播放',
       enabled: !controlsLocked,
      click: () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('media-toggle-play');
        }
      }
    },
    {
      label: '上一首',
       enabled: !controlsLocked,
      click: () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('media-prev');
        }
      }
    },
    {
      label: '下一首',
       enabled: !controlsLocked,
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

function updateMediaControls(isPlaying, controlsLocked = playbackControlsLocked) {
  playbackControlsLocked = Boolean(controlsLocked);
  updateTrayMenu(isPlaying, playbackControlsLocked);
  
  if (mainWindow && !mainWindow.isDestroyed() && mediaIcons) {
    try {
      const prevImg = nativeImage.createFromDataURL(mediaIcons.prev);
      const playImg = nativeImage.createFromDataURL(isPlaying ? mediaIcons.pause : mediaIcons.play);
      const nextImg = nativeImage.createFromDataURL(mediaIcons.next);
      
      mainWindow.setThumbarButtons([
        {
          tooltip: '上一首',
          enabled: !playbackControlsLocked,
          icon: prevImg,
          click() {
            mainWindow.webContents.send('media-prev');
          }
        },
        {
          tooltip: isPlaying ? '暂停' : '播放',
          enabled: !playbackControlsLocked,
          icon: playImg,
          click() {
            mainWindow.webContents.send('media-toggle-play');
          }
        },
        {
          tooltip: '下一首',
          enabled: !playbackControlsLocked,
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
      // Bind the API to the same IPv4 loopback address used by the port
      // probe. Without an explicit host, an existing IPv6 listener could win
      // the race and the packaged app would open the API documentation page.
      host: '127.0.0.1',
      checkVersion: false,
      staticPath: app.isPackaged ? path.join(__dirname, 'dist') : null
    });
    console.log(`Inline API server started on port ${apiPort}`);
    return true;
  } catch (err) {
    console.error('Failed to start inline NCM API server:', err);
    return false;
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
    backgroundColor: '#00000000',
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

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('desktop-lyrics-visibility-change', true);
  }

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
    show: false,
    backgroundColor: '#050209',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload-electron.cjs')
    }
  });

  // Do not expose Chromium's partially loaded first paint. The inline loader
  // and React boot gate take over once the document is ready to render.
  mainWindow.once('ready-to-show', () => {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.show();
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

  ipcMain.removeHandler('check-for-updates');
  ipcMain.handle('check-for-updates', async () => getLatestRelease());

  ipcMain.removeHandler('download-update');
  ipcMain.handle('download-update', async (_event, { assetName } = {}) => {
    const release = await getLatestRelease();
    if (!release.assetUrl || (assetName && release.assetName !== assetName) || !isAllowedUpdateUrl(release.assetUrl)) {
      throw new Error('未找到可用的 Windows 安装包');
    }
    const tempPath = path.join(app.getPath('temp'), `ICHIGOMusic-${release.version}-setup.exe`);
    const response = await fetch(release.assetUrl, { headers: { 'User-Agent': 'ICHIGOMusic-Updater' } });
    if (!response.ok || !response.body) throw new Error(`下载安装包失败：${response.status}`);
    const total = Number(response.headers.get('content-length') || release.assetSize || 0);
    const reader = response.body.getReader();
    const file = await fs.promises.open(tempPath, 'w');
    let received = 0;
    const hash = createHash('sha256');
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = Buffer.from(value);
        hash.update(chunk);
        await file.write(chunk);
        received += chunk.length;
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('update-download-progress', {
            received,
            total,
            percent: total > 0 ? Math.min(100, Math.round(received / total * 100)) : 0
          });
        }
      }
    } finally {
      await file.close();
    }
    if (total > 0 && received !== total) {
      await fs.promises.rm(tempPath, { force: true }).catch(() => {});
      throw new Error('安装包下载不完整');
    }
    const expectedDigest = String(release.assetDigest || '').replace(/^sha256:/i, '').toLowerCase();
    if (expectedDigest && hash.digest('hex').toLowerCase() !== expectedDigest) {
      await fs.promises.rm(tempPath, { force: true }).catch(() => {});
      throw new Error('安装包完整性校验失败');
    }
    downloadedUpdatePath = tempPath;
    return { downloaded: true, path: tempPath, version: release.version };
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isSafeExternalUrl(url)) shell.openExternal(url).catch(() => {});
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const localPrefix = app.isPackaged ? `http://localhost:${apiPort}` : 'http://localhost:5173';
    if (!url.startsWith(localPrefix)) {
      event.preventDefault();
      if (isSafeExternalUrl(url)) shell.openExternal(url).catch(() => {});
    }
  });

  ipcMain.removeHandler('install-update');
  ipcMain.handle('install-update', async () => {
    if (!downloadedUpdatePath || !fs.existsSync(downloadedUpdatePath)) throw new Error('安装包尚未下载完成');
    const installerPath = downloadedUpdatePath;
    app.isQuitting = true;
    setTimeout(() => {
      const child = spawn(installerPath, [], { detached: true, stdio: 'ignore', windowsHide: false });
      child.unref();
      app.quit();
    }, 250);
    return { started: true };
  });

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

  ipcMain.on('set-playback-controls-locked', (event, locked) => {
    updateMediaControls(isPlayingState, Boolean(locked));
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

  ipcMain.on('open-external', (event, url) => {
    if (isSafeExternalUrl(url)) shell.openExternal(url).catch(() => {});
  });

  ipcMain.removeHandler('read-clipboard-text');
  ipcMain.handle('read-clipboard-text', () => clipboard.readText());

  ipcMain.removeHandler('get-main-runtime-logs');
  ipcMain.handle('get-main-runtime-logs', () => mainRuntimeLogs.slice());
  ipcMain.removeHandler('clear-main-runtime-logs');
  ipcMain.handle('clear-main-runtime-logs', () => {
    mainRuntimeLogs.length = 0;
    mainRuntimeSequence = 0;
    return true;
  });

  ipcMain.removeHandler('get-default-cache-directory');
  ipcMain.handle('get-default-cache-directory', async () => getDefaultCacheDirectory());

  ipcMain.removeHandler('select-cache-directory');
  ipcMain.handle('select-cache-directory', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: '选择 ICHIGOMusic 缓存目录',
      properties: ['openDirectory', 'createDirectory']
    });
    if (result.canceled || !result.filePaths?.[0]) return null;
    return result.filePaths[0];
  });

  ipcMain.removeHandler('get-audio-stream-url');
  ipcMain.handle('get-audio-stream-url', async (_event, url) => {
    if (typeof url !== 'string' || !url) return null;
    await startAudioProxy();
    return getAudioHttpUrl(url);
  });

  ipcMain.removeHandler('get-cached-audio');
  ipcMain.handle('get-cached-audio', async (_event, { songId, quality, cacheDir }) => {
    const filePath = await findCachedAudioFile(cacheDir, songId, quality);
    return filePath ? { url: getAudioResourceUrl(filePath), path: filePath } : null;
  });

  ipcMain.removeHandler('cache-audio');
  ipcMain.handle('cache-audio', async (_event, { songId, quality, url, cacheDir, maxBytes }) => {
    if (!songId || !url || !/^https?:\/\//i.test(String(url))) return null;
    const root = safeCacheDir(cacheDir);
    const requestKey = `audio:${root}:${songId}:${quality || 'default'}`;
    const existingRequest = cacheDownloadInFlight.get(requestKey);
    if (existingRequest) return existingRequest;

    const request = (async () => {
    const audioDir = path.join(root, 'audio');
    await ensureDir(audioDir);

    const existing = await findCachedAudioFile(root, songId, quality);
    if (existing) return { url: getAudioResourceUrl(existing), path: existing, cached: true };

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    if (!response.ok || !response.body) throw new Error(`Audio cache download failed: ${response.status}`);
    const ext = inferAudioExtension(url, response.headers.get('content-type') || '');
    const base = getAudioCacheBase(songId, quality);
    const filePath = path.join(audioDir, `${base}.${ext}`);
    const tempPath = `${filePath}.tmp-${Date.now()}`;
    try {
      await writeResponseToFile(response, tempPath);
      if (!(await isPlayableAudioCacheFile(tempPath))) {
        throw new Error('Audio cache download is not a supported media file');
      }
      await fs.promises.rename(tempPath, filePath);
    } catch (error) {
      await fs.promises.rm(tempPath, { force: true }).catch(() => {});
      throw error;
    }
    await pruneCache(root, Number(maxBytes) || 1024 * 1024 * 1024);
    return { url: getAudioResourceUrl(filePath), path: filePath, cached: true };
    })().finally(() => cacheDownloadInFlight.delete(requestKey));
    cacheDownloadInFlight.set(requestKey, request);
    return request;
  });

  ipcMain.removeHandler('get-cached-cover');
  ipcMain.handle('get-cached-cover', async (_event, { songId, cacheDir }) => {
    const filePath = await findCachedCoverFile(cacheDir, songId);
    return filePath ? { url: getCoverResourceUrl(filePath), path: filePath } : null;
  });

  ipcMain.removeHandler('cache-cover');
  ipcMain.handle('cache-cover', async (_event, { songId, url, cacheDir, maxBytes, forceRefresh = false }) => {
    if (!songId || !url || !/^https?:\/\//i.test(String(url))) return null;
    const root = safeCacheDir(cacheDir);
    const requestKey = `cover:${root}:${songId}`;
    const existingRequest = cacheDownloadInFlight.get(requestKey);
    if (existingRequest) return existingRequest;

    const request = (async () => {
    const coverDir = path.join(root, 'covers');
    await ensureDir(coverDir);
    const existing = !forceRefresh && await findCachedCoverFile(root, songId);
    if (existing) return { url: getCoverResourceUrl(existing), path: existing, cached: true };

    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });
    if (!response.ok || !response.body) throw new Error(`Cover cache download failed: ${response.status}`);
    const ext = inferImageExtension(url, response.headers.get('content-type') || '');
    const filePath = path.join(coverDir, `${getCoverCacheBase(songId)}.${ext}`);
    const tempPath = `${filePath}.tmp-${Date.now()}`;
    await writeResponseToFile(response, tempPath);
    if (forceRefresh) {
      const entries = await fs.promises.readdir(coverDir, { withFileTypes: true }).catch(() => []);
      await Promise.all(entries
        .filter(entry => entry.isFile() && entry.name.startsWith(`${getCoverCacheBase(songId)}.`))
        .map(entry => fs.promises.unlink(path.join(coverDir, entry.name)).catch(() => {})));
    }
    await fs.promises.rename(tempPath, filePath);
    await pruneCache(root, Number(maxBytes) || 1024 * 1024 * 1024);
    return { url: getCoverResourceUrl(filePath), path: filePath, cached: true };
    })().finally(() => cacheDownloadInFlight.delete(requestKey));
    cacheDownloadInFlight.set(requestKey, request);
    return request;
  });

  ipcMain.removeHandler('read-lyric-cache');
  ipcMain.handle('read-lyric-cache', async (_event, { key, cacheDir }) => {
    try {
      const filePath = lyricCachePath(cacheDir, key);
      const text = await fs.promises.readFile(filePath, 'utf8');
      const now = new Date();
      fs.promises.utimes(filePath, now, now).catch(() => {});
      return JSON.parse(text);
    } catch {
      return null;
    }
  });

  ipcMain.removeHandler('write-lyric-cache');
  ipcMain.handle('write-lyric-cache', async (_event, { key, data, cacheDir, maxBytes }) => {
    try {
      const filePath = lyricCachePath(cacheDir, key);
      await ensureDir(path.dirname(filePath));
      await fs.promises.writeFile(filePath, JSON.stringify(data), 'utf8');
      await pruneCache(safeCacheDir(cacheDir), Number(maxBytes) || 1024 * 1024 * 1024);
      return true;
    } catch (err) {
      console.error('Failed to write lyric cache:', err);
      return false;
    }
  });

  ipcMain.removeHandler('get-cache-stats');
  ipcMain.handle('get-cache-stats', async (_event, { cacheDir }) => {
    const root = safeCacheDir(cacheDir);
    const files = await collectCacheFiles(root);
    return {
      dir: root,
      size: files.reduce((sum, file) => sum + file.size, 0),
      files: files.length
    };
  });

  ipcMain.removeHandler('clear-app-cache');
  ipcMain.handle('clear-app-cache', async (_event, { cacheDir }) => {
    const root = safeCacheDir(cacheDir);
    await fs.promises.rm(path.join(root, 'audio'), { recursive: true, force: true });
    await fs.promises.rm(path.join(root, 'lyrics'), { recursive: true, force: true });
    await fs.promises.rm(path.join(root, 'covers'), { recursive: true, force: true });
    await ensureDir(path.join(root, 'audio'));
    await ensureDir(path.join(root, 'lyrics'));
    await ensureDir(path.join(root, 'covers'));
    return true;
  });

  // Load local Vite dev server or production build
  if (app.isPackaged) {
    mainWindow.loadURL(`http://127.0.0.1:${apiPort}`);
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
  registerCacheProtocol();
  startAudioProxy().catch(error => console.warn('Failed to start audio proxy:', error));
  migrateLegacyCache().catch(error => console.warn('Failed to migrate legacy cache:', error));
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
  mainRuntimeLogs.length = 0;
  mainRuntimeSequence = 0;
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
