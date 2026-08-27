import React, { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useState, useRef } from 'react';
import { api } from '../utils/api';
import { DEFAULT_PROFILE, deepMerge, loadProfile, saveProfile } from '../utils/settingsProfile';
import { extractWarmColdColors } from '../utils/colorExtractor';
import { isLegacyFileMediaSource, isLocalMediaSource } from '../utils/audioSource';
import { getPersistentSongCoverUrl, getSongCoverUrl, isLocalCoverUrl, isRemoteCoverUrl } from '../utils/songCover';

import pkg from '../../package.json';

const AppContext = createContext();

export const APP_VERSION = `v${pkg.version || '1.9.2'}`;

const sameSongId = (a, b) => String(a ?? '') === String(b ?? '');

// Profile persistence normalizes/clones nested objects. Keep immutable config
// references stable when only playback progress changes so memoized immersive
// stages do not re-render once per progress write.
const samePlainValue = (a, b) => {
  if (a === b) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i += 1) {
      if (!samePlainValue(a[i], b[i])) return false;
    }
    return true;
  }
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  for (const key of aKeys) {
    if (!Object.prototype.hasOwnProperty.call(b, key) || !samePlainValue(a[key], b[key])) return false;
  }
  return true;
};

export function isVersionLessThan(current, latest) {
  const parse = (v) => v.replace(/^v/, '').split('.').map(Number);
  const c = parse(current);
  const l = parse(latest);
  for (let i = 0; i < Math.max(c.length, l.length); i++) {
    const cNum = c[i] || 0;
    const lNum = l[i] || 0;
    if (cNum < lNum) return true;
    if (cNum > lNum) return false;
  }
  return false;
}

export function AppProvider({ children }) {
  const [profile, setProfile] = useState(() => loadProfile());

  const updateProfile = useCallback((partial) => {
    let nextProfile;
    setProfile(prev => {
      nextProfile = saveProfile(deepMerge(prev, partial || {}));
      return nextProfile;
    });
    return nextProfile;
  }, []);

  // Navigation & Routing States
  // The first route must follow the persisted layout. Modern mode starts on the
  // glass-card ModernHome page; classic mode starts on Discover.
  const initialView = profile.layoutMode === 'modern' ? 'home' : 'discover';
  const [currentView, setCurrentView] = useState(initialView);
  const [viewData, setViewData] = useState(null);
  const [viewHistory, setViewHistory] = useState([{ view: initialView, data: null }]);
  const [historyIndex, setHistoryIndex] = useState(0);

  // User Authentication
  const [user, setUserState] = useState(() => {
    const account = profile.account || DEFAULT_PROFILE.account;
    return account.userId ? {
      userId: account.userId,
      nickname: account.nickname,
      avatarUrl: account.avatarUrl
    } : null;
  });
  const [likedSongIds, setLikedSongIds] = useState(new Set());
  const [likedPlaylistId, setLikedPlaylistId] = useState(null);
  const [userPlaylists, setUserPlaylists] = useState([]);

  // Playback Control States
  const [currentSong, setCurrentSong] = useState(() => profile.lastSession?.currentSong || null);
  const [playlist, setPlaylist] = useState(() => profile.lastSession?.playlist || []);
  const [playlistIndex, setPlaylistIndex] = useState(() => profile.lastSession?.playlistIndex ?? -1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolumeState] = useState(() => Number(profile.audio?.volume ?? 0.8));
  const [progress, setProgress] = useState(() => Number(profile.lastSession?.progress || 0));
  const [duration, setDuration] = useState(() => Number(profile.lastSession?.duration || 0));
  const [resumeTime, setResumeTimeState] = useState(() => profile.lastSession?.resumeTime ?? profile.lastSession?.progress ?? null);
  const [recentlyPlayed, setRecentlyPlayed] = useState(() => profile.recentlyPlayed || []);
  const [isLyricsOpen, setIsLyricsOpen] = useState(false);
  const [isQueueOpen, setIsQueueOpen] = useState(false);
  const [isEqualizerOpen, setIsEqualizerOpen] = useState(false);
  const [isClosePromptOpen, setIsClosePromptOpen] = useState(false);
  const [listenPlaybackLocked, setListenPlaybackLocked] = useState(false);
  // Audio elements ref (shared across components)
  const [audioElement, setAudioElement] = useState(null);

  // Derived customization values from unified profile
  const colorMode = profile.colorMode || DEFAULT_PROFILE.colorMode;
  const layoutMode = profile.layoutMode || DEFAULT_PROFILE.layoutMode;
  const theme = profile.theme || DEFAULT_PROFILE.theme;
  const customThemeColors = profile.customTheme || DEFAULT_PROFILE.customTheme;
  const navbarConfig = profile.navbarItems || DEFAULT_PROFILE.navbarItems;
  const lyricStyle = profile.lyricStyle || DEFAULT_PROFILE.lyricStyle;
  const visualizerMode = profile.visualizer?.mode || DEFAULT_PROFILE.visualizer.mode;
  const appearanceConfig = profile.appearance || DEFAULT_PROFILE.appearance;
  const coverConfig = profile.cover || DEFAULT_PROFILE.cover;
  const backgroundConfig = profile.background || DEFAULT_PROFILE.background;
  const rawAdvancedLyricConfig = profile.immersiveLyrics || DEFAULT_PROFILE.immersiveLyrics;
  const advancedLyricConfigRef = useRef(rawAdvancedLyricConfig);
  if (!samePlainValue(advancedLyricConfigRef.current, rawAdvancedLyricConfig)) {
    advancedLyricConfigRef.current = rawAdvancedLyricConfig;
  }
  const advancedLyricConfig = advancedLyricConfigRef.current;
  const visualizerConfig = profile.visualizer || DEFAULT_PROFILE.visualizer;
  const desktopLyricsConfig = profile.desktopLyrics || DEFAULT_PROFILE.desktopLyrics;
  const audioConfig = profile.audio || DEFAULT_PROFILE.audio;
  const cacheConfig = audioConfig.cache || DEFAULT_PROFILE.audio.cache;
  const playbackConfig = profile.playback || DEFAULT_PROFILE.playback;
  const renderingConfig = profile.rendering || DEFAULT_PROFILE.rendering;
  const shortcuts = profile.shortcuts || DEFAULT_PROFILE.shortcuts;
  const audioQuality = audioConfig.quality || 'exhigh';
  const playMode = playbackConfig.playMode || 'sequence';

  const isFirstTimeSetupComplete = profile.isFirstTimeSetupComplete !== undefined 
    ? profile.isFirstTimeSetupComplete 
    : false;

  // Dynamic warm/cold color extraction
  const [extractedColors, setExtractedColors] = useState({
    warm: '#ff4081',
    cold: '#00b0ff',
    dominant: '#ff4081'
  });

  const currentCoverUrl = getSongCoverUrl(currentSong);

  useEffect(() => {
    if (!currentSong || !currentCoverUrl) {
      setExtractedColors({
        warm: '#ff4081',
        cold: '#00b0ff',
        dominant: '#ff4081'
      });
      return;
    }
    
    let isMounted = true;
    extractWarmColdColors(currentCoverUrl).then(colors => {
      if (isMounted) {
        setExtractedColors(colors);
      }
    });
    return () => {
      isMounted = false;
    };
  }, [currentSong?.id, currentCoverUrl]);

  const immersiveColor = useMemo(() => {
    const pref = advancedLyricConfig?.colorPreference || 'warm';
    if (pref === 'cold') return extractedColors.cold;
    if (pref === 'original') return extractedColors.dominant;
    return extractedColors.warm;
  }, [extractedColors, advancedLyricConfig?.colorPreference]);

  const stateRef = useRef();
  stateRef.current = {
    viewHistory,
    historyIndex,
    user,
    likedSongIds,
    playlist,
    playlistIndex,
    playMode: profile.playback?.playMode || DEFAULT_PROFILE.playback.playMode,
    audioQuality: profile.audio?.quality || 'exhigh',
    cacheConfig: profile.audio?.cache || DEFAULT_PROFILE.audio.cache,
    recentlyPlayed,
    progress,
    currentSong,
    audioElement,
    isPlaying,
    listenPlaybackLocked,
    likedPlaylistId
  };

  const originalPlaylistBackupRef = useRef(null);
  const isFetchingHeartRef = useRef(false);

  const setUser = useCallback((nextUser) => {
    setUserState(nextUser);
    updateProfile({
      account: nextUser ? {
        provider: 'netease',
        userId: nextUser.userId,
        nickname: nextUser.nickname,
        avatarUrl: nextUser.avatarUrl,
        lastLoginAt: new Date().toISOString()
      } : {
        provider: null,
        userId: null,
        nickname: null,
        avatarUrl: null,
        lastLoginAt: null
      }
    });
  }, [updateProfile]);

  const progressPersistRef = useRef({ lastWriteAt: 0, timerId: null, pending: 0 });
  const volumePersistTimerRef = useRef(null);

  useEffect(() => () => {
    if (progressPersistRef.current.timerId) window.clearTimeout(progressPersistRef.current.timerId);
    if (volumePersistTimerRef.current) window.clearTimeout(volumePersistTimerRef.current);
  }, []);

  const persistProgress = useCallback((nextProgress) => {
    const numeric = Number(nextProgress) || 0;
    setProgress(numeric);
    progressPersistRef.current.pending = numeric;
    const now = Date.now();
    const persist = () => {
      const pending = progressPersistRef.current.pending;
      progressPersistRef.current.lastWriteAt = Date.now();
      progressPersistRef.current.timerId = null;
      updateProfile({ lastSession: { progress: pending } });
    };
    if (now - progressPersistRef.current.lastWriteAt > 1200) {
      if (progressPersistRef.current.timerId) {
        window.clearTimeout(progressPersistRef.current.timerId);
        progressPersistRef.current.timerId = null;
      }
      persist();
    } else if (!progressPersistRef.current.timerId) {
      progressPersistRef.current.timerId = window.setTimeout(persist, 1200);
    }
  }, [updateProfile]);

  const persistDuration = useCallback((nextDuration) => {
    const numeric = Number(nextDuration) || 0;
    setDuration(numeric);
    updateProfile({ lastSession: { duration: numeric } });
  }, [updateProfile]);

  const persistResumeTime = useCallback((nextResumeTime) => {
    setResumeTimeState(nextResumeTime);
    updateProfile({ lastSession: { resumeTime: nextResumeTime } });
  }, [updateProfile]);

  const setCurrentSongAndPersist = useCallback((song) => {
    setCurrentSong(song);
    updateProfile({ lastSession: { currentSong: song } });
  }, [updateProfile]);

  const setPlaylistAndPersist = useCallback((list) => {
    const safeList = Array.isArray(list) ? list : [];
    setPlaylist(safeList);
    updateProfile({ lastSession: { playlist: safeList } });
  }, [updateProfile]);

  const setPlaylistIndexAndPersist = useCallback((idx) => {
    const numeric = Number.isFinite(Number(idx)) ? Number(idx) : -1;
    setPlaylistIndex(numeric);
    updateProfile({ lastSession: { playlistIndex: numeric } });
  }, [updateProfile]);

  // Add to recently played list (max 100 items)
  const addToRecent = useCallback((song) => {
    const { recentlyPlayed } = stateRef.current;
    const listWithoutCurrent = (Array.isArray(recentlyPlayed) ? recentlyPlayed : []).filter(item => item && item.id !== song?.id);
    const newRecent = [song, ...listWithoutCurrent].slice(0, 100);
    setRecentlyPlayed(newRecent);
    updateProfile({ recentlyPlayed: newRecent });
  }, [updateProfile, setRecentlyPlayed]);

  const setVolume = useCallback((nextVolume) => {
    const numeric = Math.max(0, Math.min(1, Number(nextVolume) || 0));
    setVolumeState(numeric);
    if (volumePersistTimerRef.current) window.clearTimeout(volumePersistTimerRef.current);
    volumePersistTimerRef.current = window.setTimeout(() => {
      updateProfile({ audio: { volume: numeric, muted: numeric === 0 } });
      volumePersistTimerRef.current = null;
    }, 120);
  }, [updateProfile]);

  // Load account status on mount.
  useEffect(() => {
    checkUserLogin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Apply appearance before the boot gate reveals the React tree.
  useLayoutEffect(() => {
    document.body.className = '';

    let activeMode = colorMode;
    if (colorMode === 'system') {
      activeMode = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

    document.body.classList.add(`mode-${activeMode}`);
    document.body.classList.add(`layout-${layoutMode}`);
    document.body.classList.toggle('reduced-motion', renderingConfig.reducedMotion === true);
    document.body.classList.toggle('surface-flat', appearanceConfig.surfaceStyle === 'flat');

    if (theme === 'custom') {
      document.body.classList.add('theme-custom');
      document.body.style.setProperty('--custom-primary-color', customThemeColors.primary);
      document.body.style.setProperty('--custom-primary-color-hover', adjustColorBrightness(customThemeColors.primary, -15));
      document.body.style.setProperty('--custom-primary-color-glow', `${customThemeColors.primary}59`);
      document.body.style.setProperty('--custom-primary-color-subtle', `${customThemeColors.primary}1a`);
      document.body.style.setProperty('--custom-primary-text', getContrastColor(customThemeColors.primary));
      document.body.style.setProperty('--custom-bg-start', customThemeColors.bgStart || (activeMode === 'light' ? '#f5f5f4' : '#0b0c10'));
      document.body.style.setProperty('--custom-bg-end', customThemeColors.bgEnd || (activeMode === 'light' ? '#ffffff' : '#030406'));
    } else {
      document.body.classList.add(`theme-${theme}`);
      document.body.style.removeProperty('--custom-bg-start');
      document.body.style.removeProperty('--custom-bg-end');
    }
    document.body.dataset.appearanceReady = 'true';
  }, [theme, colorMode, customThemeColors, layoutMode, renderingConfig.reducedMotion, appearanceConfig.surfaceStyle]);

  // System color scheme change listener
  useEffect(() => {
    if (colorMode !== 'system') return undefined;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const listener = (e) => {
      document.body.classList.remove('mode-dark', 'mode-light');
      document.body.classList.add(`mode-${e.matches ? 'dark' : 'light'}`);
    };
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, [colorMode]);

  // Sync settings config to desktop lyrics window
  useEffect(() => {
    if (window.electronAPI?.sendDesktopLyricsConfig) {
      window.electronAPI.sendDesktopLyricsConfig({
        ...desktopLyricsConfig,
        locked: desktopLyricsConfig.locked,
        fontSize: Number(desktopLyricsConfig.fontSize) || 36,
        translationSize: Number(desktopLyricsConfig.translationSize) || 20,
        fontFamily: desktopLyricsConfig.fontFamily || 'Inter',
        fontWeight: Number(desktopLyricsConfig.fontWeight) || 700,
        boldFirstLine: desktopLyricsConfig.bold !== false,
        colorPreset: desktopLyricsConfig.colorPreset || 'strawberry',
        playedColor: desktopLyricsConfig.playedColor || '#ff3366',
        unplayedColor: desktopLyricsConfig.unplayedColor || '#ffffff',
        textStroke: {
          enabled: desktopLyricsConfig.textStroke?.enabled !== false,
          width: Number(desktopLyricsConfig.textStroke?.width ?? 0.6),
          color: desktopLyricsConfig.textStroke?.color || '#000000'
        },
        glow: {
          enabled: desktopLyricsConfig.glow?.enabled === true,
          intensity: Number(desktopLyricsConfig.glow?.intensity ?? 0.6)
        },
        textShadow: {
          enabled: desktopLyricsConfig.textShadow?.enabled !== false,
          blur: Number(desktopLyricsConfig.textShadow?.blur ?? 12),
          color: desktopLyricsConfig.textShadow?.color || '#000000cc'
        },
        desktopColor: desktopLyricsConfig.playedColor || '#ff3366',
        alignment: desktopLyricsConfig.alignment || 'center',
        lineCount: Number(desktopLyricsConfig.lineCount || 3),
        showTranslation: desktopLyricsConfig.showTranslation !== false,
        opacity: Number(desktopLyricsConfig.opacity ?? 1),
        theme,
        customThemeColors
      });
    }
  }, [desktopLyricsConfig, theme, customThemeColors]);

  // Update custom css variables for lyrics
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--lyric-font-size', lyricStyle.fontSize);
    root.style.setProperty('--lyric-font-family', lyricStyle.fontFamily);
    root.style.setProperty('--lyric-color', lyricStyle.color);
    root.style.setProperty('--lyric-active-color', lyricStyle.activeColor);
  }, [lyricStyle]);

  // Save settings helpers
  const setColorMode = useCallback((value) => updateProfile({ colorMode: value }), [updateProfile]);
  const setLayoutMode = useCallback((value) => updateProfile({ layoutMode: value }), [updateProfile]);
  const setTheme = useCallback((value) => updateProfile({ theme: value }), [updateProfile]);
  const saveCustomThemeColors = useCallback((colors) => updateProfile({ customTheme: colors }), [updateProfile]);
  const saveNavbarConfig = useCallback((config) => updateProfile({ navbarItems: config }), [updateProfile]);
  const saveLyricStyle = useCallback((style) => updateProfile({ lyricStyle: style }), [updateProfile]);
  const saveVisualizerMode = useCallback((mode) => updateProfile({ visualizer: { mode, style: profile.visualizer?.style || mode } }), [updateProfile, profile.visualizer?.style]);
  const saveAppearanceConfig = useCallback((cfg) => updateProfile({ appearance: cfg }), [updateProfile]);
  const saveCoverConfig = useCallback((cfg) => updateProfile({ cover: cfg }), [updateProfile]);
  const saveBackgroundConfig = useCallback((cfg) => updateProfile({ background: cfg }), [updateProfile]);
  const saveAdvancedLyricConfig = useCallback((cfg) => updateProfile({ immersiveLyrics: cfg }), [updateProfile]);
  const saveVisualizerConfig = useCallback((cfg) => updateProfile({ visualizer: cfg }), [updateProfile]);
  const saveAudioConfig = useCallback((cfg) => {
    const next = deepMerge(audioConfig, cfg || {});
    updateProfile({ audio: next });
    if (Object.prototype.hasOwnProperty.call(next, 'volume')) setVolumeState(Number(next.volume));
  }, [audioConfig, updateProfile]);
  const saveCacheConfig = useCallback((cfg) => {
    updateProfile({ audio: { cache: cfg } });
  }, [updateProfile]);
  const savePlaybackConfig = useCallback((cfg) => updateProfile({ playback: cfg }), [updateProfile]);
  const saveRenderingConfig = useCallback((cfg) => updateProfile({ rendering: cfg }), [updateProfile]);
  const saveShortcuts = useCallback((cfg) => updateProfile({ shortcuts: cfg }), [updateProfile]);

  const [updateInfo, setUpdateInfo] = useState({ show: false, latestVersion: '', assetName: '', notes: '', downloading: false, downloaded: false, progress: 0, error: '' });

  useEffect(() => {
    const unsubscribe = window.electronAPI?.onUpdateDownloadProgress?.((progress) => {
      setUpdateInfo(prev => ({ ...prev, downloading: true, progress: Number(progress?.percent || 0), error: '' }));
    });
    return () => unsubscribe?.();
  }, []);

  const checkForUpdates = useCallback(async (isManual = false) => {
    try {
      const data = window.electronAPI?.checkForUpdates
        ? await window.electronAPI.checkForUpdates()
        : await fetch('https://api.github.com/repos/lyb82ndkf-lab/ichigo-music/releases/latest').then(res => {
          if (!res.ok) throw new Error('API request failed');
          return res.json().then(release => ({
            version: String(release.tag_name || '').replace(/^v/i, ''),
            tagName: release.tag_name || '',
            notes: release.body || '',
            assets: release.assets || []
          }));
        });
      const latestTag = data.tagName || data.version;
      if (latestTag && isVersionLessThan(APP_VERSION, latestTag)) {
        const browserAsset = data.assetName ? data : {
          ...data,
          assetName: data.assets?.find(asset => /setup.*\.exe$/i.test(asset.name))?.name || data.assets?.find(asset => /\.exe$/i.test(asset.name))?.name || '',
          assetUrl: data.assets?.find(asset => /setup.*\.exe$/i.test(asset.name))?.browser_download_url || ''
        };
        setUpdateInfo({ show: true, latestVersion: latestTag, assetName: browserAsset.assetName || '', assetUrl: browserAsset.assetUrl || '', notes: browserAsset.notes || '', downloading: false, downloaded: false, progress: 0, error: '' });
        return { hasUpdate: true, latestVersion: latestTag, ...browserAsset };
      } else {
        if (isManual) {
          alert('当前已是最新版本！');;
        }
        return { hasUpdate: false, latestVersion: latestTag || APP_VERSION };
      }
    } catch (err) {
      console.error('Failed to check for updates:', err);
      if (isManual) {
        alert('检查更新失败，请稍后重试。');
      }
      return { error: true };
    }
  }, []);

  const downloadUpdate = useCallback(async () => {
    setUpdateInfo(prev => ({ ...prev, downloading: true, progress: 0, error: '' }));
    try {
      if (!window.electronAPI?.downloadUpdate) throw new Error('当前环境不支持应用内更新');
      const result = await window.electronAPI.downloadUpdate({ assetName: updateInfo.assetName });
      setUpdateInfo(prev => ({ ...prev, downloading: false, downloaded: true, progress: 100, error: '' }));
      return result;
    } catch (error) {
      setUpdateInfo(prev => ({ ...prev, downloading: false, error: error.message || '下载安装包失败' }));
      return null;
    }
  }, [updateInfo.assetName]);

  const installUpdate = useCallback(async () => {
    try {
      await window.electronAPI?.installUpdate?.();
    } catch (error) {
      setUpdateInfo(prev => ({ ...prev, error: error.message || '启动安装失败' }));
    }
  }, []);

  useEffect(() => {
    const sessionChecked = sessionStorage.getItem('ichigo_startup_update_checked');
    if (!sessionChecked) {
      sessionStorage.setItem('ichigo_startup_update_checked', 'true');
      setTimeout(() => {
        checkForUpdates(false);
      }, 3000);
    }
  }, [checkForUpdates]);

  const persistDesktopLyricsConfig = useCallback((updater, options = {}) => {
    const { notifyElectron = false } = options;
    let nextConfig = null;
    setProfile(prev => {
      const prevDesktop = prev.desktopLyrics || DEFAULT_PROFILE.desktopLyrics;
      nextConfig = typeof updater === 'function' ? updater(prevDesktop) : updater;
      const nextProfile = saveProfile(deepMerge(prev, { desktopLyrics: nextConfig }));
      if (notifyElectron && window.electronAPI?.setDesktopLyricsLock && nextConfig.locked !== prevDesktop.locked) {
        window.electronAPI.setDesktopLyricsLock(nextConfig.locked);
      }
      return nextProfile;
    });
    return nextConfig;
  }, []);

  const saveDesktopLyricsConfig = useCallback((cfg) => {
    persistDesktopLyricsConfig(cfg, { notifyElectron: true });
  }, [persistDesktopLyricsConfig]);

  const mergeDesktopLyricsConfigFromIpc = useCallback((patch) => {
    persistDesktopLyricsConfig(prev => ({ ...prev, ...patch }), { notifyElectron: false });
  }, [persistDesktopLyricsConfig]);

  // Router functions
  const navigateTo = useCallback((view, data = null) => {
    const { viewHistory, historyIndex } = stateRef.current;
    const newHistory = viewHistory.slice(0, historyIndex + 1);
    newHistory.push({ view, data });
    setViewHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    setCurrentView(view);
    setViewData(data);
  }, []);

  const goBack = useCallback(() => {
    const { viewHistory, historyIndex } = stateRef.current;
    if (historyIndex > 0) {
      const newIdx = historyIndex - 1;
      setHistoryIndex(newIdx);
      setCurrentView(viewHistory[newIdx].view);
      setViewData(viewHistory[newIdx].data);
    }
  }, []);

  const goForward = useCallback(() => {
    const { viewHistory, historyIndex } = stateRef.current;
    if (historyIndex < viewHistory.length - 1) {
      const newIdx = historyIndex + 1;
      setHistoryIndex(newIdx);
      setCurrentView(viewHistory[newIdx].view);
      setViewData(viewHistory[newIdx].data);
    }
  }, []);

  // Fetch user's liked song IDs
  const fetchLikedSongs = useCallback(async (userId) => {
    try {
      const playlistsRes = await api.getUserPlaylists(userId);
      if (playlistsRes.playlist && playlistsRes.playlist.length > 0) {
        setUserPlaylists(playlistsRes.playlist);
        const likedPlaylist = playlistsRes.playlist[0];
        setLikedPlaylistId(likedPlaylist.id);

        const likedIdsRes = await api.getLikedList(userId);
        if (likedIdsRes.ids) {
          setLikedSongIds(new Set(likedIdsRes.ids));
        }
      }
    } catch (err) {
      console.error('Failed to fetch liked songs list:', err);
    }
  }, []);

  // Pull the account's server-side recent-play list after login.  The local
  // `recentlyPlayed` array is only a UI cache; without this reconciliation the
  // desktop player could play successfully while the official account page
  // remained stale.
  const fetchRemoteRecentlyPlayed = useCallback(async () => {
    try {
      const response = await api.getRecentSongs(100);
      const rows = response?.data?.list || response?.list || [];
      const remote = Array.isArray(rows)
        ? rows.map(row => row?.data || row?.song || row?.resource || row).filter(item => item?.id)
        : [];
      if (remote.length === 0) return;
      const local = stateRef.current.recentlyPlayed || [];
      const merged = [];
      const seen = new Set();
      [...remote, ...local].forEach(song => {
        const id = String(song?.id ?? '');
        if (!id || seen.has(id)) return;
        seen.add(id);
        merged.push(song);
      });
      const next = merged.slice(0, 100);
      setRecentlyPlayed(next);
      updateProfile({ recentlyPlayed: next });
    } catch (err) {
      // A logged-out/expired session should not affect local playback history.
      console.debug('Remote recent-play sync skipped:', err?.message || err);
    }
  }, [updateProfile]);

  // Check login
  const checkUserLogin = useCallback(async () => {
    try {
      const res = await api.getLoginStatus();
      if (res.data && res.data.profile) {
        setUser(res.data.profile);
        fetchLikedSongs(res.data.profile.userId);
        fetchRemoteRecentlyPlayed();
      } else {
        setUser(null);
        setLikedSongIds(new Set());
      }
    } catch (err) {
      console.log('Login check failed:', err);
      setUser(null);
    }
  }, [setUser, fetchLikedSongs, fetchRemoteRecentlyPlayed]);

  // Toggle Song Like/Dislike state
  const toggleLike = useCallback(async (songId) => {
    const { user, likedSongIds } = stateRef.current;
    if (!user) {
      alert('请先登录您的网易云账号！');
      navigateTo('settings');
      return;
    }
    const isCurrentlyLiked = likedSongIds.has(songId);
    try {
      await api.likeSong(songId, !isCurrentlyLiked);
      const newLikedIds = new Set(likedSongIds);
      if (isCurrentlyLiked) {
        newLikedIds.delete(songId);
      } else {
        newLikedIds.add(songId);
      }
      setLikedSongIds(newLikedIds);
    } catch (err) {
      console.error('Failed to toggle like:', err);
      alert('操作失败，请重试');
    }
  }, [navigateTo]);

  // Short-lived URL cache to avoid slow API re-fetches when switching songs quickly
  const songUrlCacheRef = useRef(new Map());
  const songUrlInFlightRef = useRef(new Map());
  const coverCacheInFlightRef = useRef(new Map());
  const audioCacheQueueRef = useRef([]);
  const audioCacheWorkerRef = useRef({ timerId: null, running: false, currentKey: '' });
  const playSequenceRef = useRef(0);

  const pruneSongUrlCache = useCallback(() => {
    while (songUrlCacheRef.current.size > 80) {
      const firstKey = songUrlCacheRef.current.keys().next().value;
      songUrlCacheRef.current.delete(firstKey);
    }
  }, []);

  const getCacheLimitBytes = (cfg) => {
    const gb = Math.max(1, Math.min(10, Number(cfg?.maxSizeGb || 1)));
    return gb * 1024 * 1024 * 1024;
  };

  const drainAudioCacheQueue = useCallback((delayMs = 0) => {
    const worker = audioCacheWorkerRef.current;
    if (worker.running || worker.timerId || audioCacheQueueRef.current.length === 0) return;

    worker.timerId = window.setTimeout(async () => {
      worker.timerId = null;

      // Never let speculative cache downloads compete with a media element that
      // is still building its first playable buffer.
      const activeAudio = stateRef.current.audioElement;
      if (stateRef.current.isPlaying && activeAudio && activeAudio.readyState < 3) {
        drainAudioCacheQueue(2500);
        return;
      }

      const job = audioCacheQueueRef.current.shift();
      if (!job) return;
      worker.running = true;
      worker.currentKey = job.key;
      try {
        await window.electronAPI?.cacheAudio?.(job.payload);
      } catch {
        // Cache writes are opportunistic and must never interrupt playback.
      } finally {
        worker.running = false;
        worker.currentKey = '';
        if (audioCacheQueueRef.current.length > 0) {
          drainAudioCacheQueue(1500);
        }
      }
    }, Math.max(0, delayMs));
  }, []);

  useEffect(() => () => {
    const worker = audioCacheWorkerRef.current;
    if (worker.timerId) window.clearTimeout(worker.timerId);
    worker.timerId = null;
    audioCacheQueueRef.current.length = 0;
  }, []);

  const cacheAudioInBackground = useCallback((song, quality, url) => {
    const cfg = stateRef.current.cacheConfig || DEFAULT_PROFILE.audio.cache;
    if (!cfg?.enabled || cfg.audio === false || !url || !/^https?:\/\//i.test(url)) return;
    const key = `${song.id}:${quality || 'default'}:${cfg.directory || 'default'}`;
    const worker = audioCacheWorkerRef.current;
    if (worker.currentKey === key || audioCacheQueueRef.current.some(item => item.key === key)) return;
    audioCacheQueueRef.current.push({
      key,
      payload: {
        songId: song.id,
        quality,
        url,
        cacheDir: cfg.directory || '',
        maxBytes: getCacheLimitBytes(cfg)
      }
    });

    // Give the active <audio> request an uncontested startup window. Look-ahead
    // tracks are then downloaded one at a time instead of opening 4-5 large
    // FLAC transfers at once.
    drainAudioCacheQueue(8000);
  }, [drainAudioCacheQueue]);

  const fetchSongCoverFromDetail = useCallback(async (songId) => {
    if (!songId) return null;
    try {
      const detail = await api.getSongDetails(songId);
      const fullSong = detail?.songs?.[0] || null;
      const coverUrl = getSongCoverUrl(fullSong, true);
      return coverUrl ? { coverUrl, fullSong } : null;
    } catch {
      return null;
    }
  }, []);

  const resolveSongCover = useCallback((song, forceRefresh = false) => {
    const cfg = stateRef.current.cacheConfig || DEFAULT_PROFILE.audio.cache;
    const directCover = song?.coverUrl || '';
    const isLocalCover = isLocalCoverUrl(directCover);
    if (isLocalCover && (!cfg?.enabled || !song?.id || !window.electronAPI?.getCachedCover)) {
      return Promise.resolve({ url: directCover, remoteUrl: song?.originalCoverUrl || '' });
    }

    const knownRemoteCover = getSongCoverUrl(song, true)
      || (isRemoteCoverUrl(directCover) && !/109951163026279185/.test(directCover) ? directCover : '');
    if (!cfg?.enabled || !song?.id || !window.electronAPI?.getCachedCover) {
      return Promise.resolve({ url: knownRemoteCover || directCover, remoteUrl: knownRemoteCover });
    }

    const cacheKey = `${song.id}:${cfg.directory || 'default'}${forceRefresh ? ':refresh' : ''}`;
    const existingRequest = coverCacheInFlightRef.current.get(cacheKey);
    if (existingRequest) return existingRequest;

    const request = (async () => {
      const cached = !forceRefresh && await window.electronAPI.getCachedCover({
        songId: song.id,
        cacheDir: cfg.directory || ''
      }).catch(() => null);
      if (cached?.url) {
        let remoteUrl = knownRemoteCover;
        // Older profiles may contain only a file:// cache URL. Recover the
        // durable album URL once so a later cache miss cannot blank the UI.
        if (!remoteUrl) {
          const detailCover = await fetchSongCoverFromDetail(song.id);
          remoteUrl = detailCover?.coverUrl || '';
        }
        return { url: cached.url, remoteUrl };
      }

      let remoteUrl = knownRemoteCover;
      if (!remoteUrl) {
        const detailCover = await fetchSongCoverFromDetail(song.id);
        remoteUrl = detailCover?.coverUrl || '';
      }
      if (!remoteUrl || !window.electronAPI?.cacheCover) {
        return { url: remoteUrl || directCover, remoteUrl };
      }

      const stored = await window.electronAPI.cacheCover({
        songId: song.id,
        url: remoteUrl,
        cacheDir: cfg.directory || '',
        maxBytes: getCacheLimitBytes(cfg),
        forceRefresh
      }).catch(() => null);
      return { url: stored?.url || remoteUrl, remoteUrl };
    })().finally(() => {
      coverCacheInFlightRef.current.delete(cacheKey);
    });

    coverCacheInFlightRef.current.set(cacheKey, request);
    return request;
  }, [fetchSongCoverFromDetail]);

  const cacheCoverInBackground = useCallback((song) => {
    if (!song?.id) return;
    resolveSongCover(song).then(({ url, remoteUrl }) => {
      if (!url) return;
      // Keep the durable song metadata URL as the primary value. A file://
      // cache URL is an implementation detail and can become invalid while
      // the player is still mounted; CachedCover can use it internally.
      const stableCoverUrl = getPersistentSongCoverUrl(song, { url, remoteUrl });
      if (!stableCoverUrl) return;

      const current = stateRef.current.currentSong;
      if (sameSongId(current?.id, song.id) && (current.coverUrl !== stableCoverUrl || (!current.originalCoverUrl && remoteUrl))) {
        setCurrentSongAndPersist({
          ...current,
          originalCoverUrl: remoteUrl || current.originalCoverUrl || '',
          coverUrl: stableCoverUrl
        });
      }

      const recent = stateRef.current.recentlyPlayed || [];
      let changed = false;
      const nextRecent = recent.map(item => {
        if (!sameSongId(item.id, song.id) || (item.coverUrl === stableCoverUrl && (item.originalCoverUrl || '') === (remoteUrl || ''))) return item;
        changed = true;
        return {
          ...item,
          originalCoverUrl: remoteUrl || item.originalCoverUrl || '',
          coverUrl: stableCoverUrl
        };
      });
      if (changed) {
        setRecentlyPlayed(nextRecent);
        updateProfile({ recentlyPlayed: nextRecent });
      }
    }).catch(() => {});
  }, [resolveSongCover, setCurrentSongAndPersist, updateProfile]);

  const getPlayableSongUrl = useCallback(async (song, quality, forceRefreshUrl = false) => {
    if (!song?.id) return null;
    const requestedQuality = quality || 'exhigh';
    const urlCacheKey = `${song.id}_${requestedQuality}`;
    const now = Date.now();
    const cfg = stateRef.current.cacheConfig || DEFAULT_PROFILE.audio.cache;

    // A verified local cache is always preferable, including when the remote
    // CDN address is being force-refreshed after restoring a previous session.
    // The old branch skipped disk cache on force refresh and made first play
    // wait for the network even though the audio was already available locally.
    if (cfg?.enabled && cfg.audio !== false && window.electronAPI?.getCachedAudio) {
      const cachedAudio = await window.electronAPI.getCachedAudio({
        songId: song.id,
        quality: requestedQuality,
        cacheDir: cfg.directory || ''
      }).catch(() => null);
      if (cachedAudio?.url) {
        songUrlCacheRef.current.set(urlCacheKey, { url: cachedAudio.url, time: now });
        pruneSongUrlCache();
        return cachedAudio.url;
      }
    }

    const cachedEntry = songUrlCacheRef.current.get(urlCacheKey);

    if (!forceRefreshUrl && cachedEntry && now - cachedEntry.time < 15 * 60 * 1000) {
      return cachedEntry.url;
    }

    const localUrlMissing = isLocalMediaSource(song.url) && !cachedEntry;
    if (!forceRefreshUrl && !localUrlMissing && song.url && song.urlCachedAt && now - Number(song.urlCachedAt) < 15 * 60 * 1000
      && (!song.urlQuality || song.urlQuality === requestedQuality)) {
      songUrlCacheRef.current.set(urlCacheKey, { url: song.url, time: Number(song.urlCachedAt) });
      pruneSongUrlCache();
      cacheAudioInBackground(song, requestedQuality, song.url);
      return song.url;
    }

    if (forceRefreshUrl) {
      songUrlCacheRef.current.delete(urlCacheKey);
      songUrlInFlightRef.current.delete(urlCacheKey);
    }

    if (!songUrlInFlightRef.current.has(urlCacheKey)) {
      const qualityCandidates = [...new Set([
        requestedQuality,
        requestedQuality === 'exhigh' ? 'higher' : null,
        'standard',
        'low'
      ].filter(Boolean))];
      const requestPromise = (async () => {
        for (const qualityLevel of qualityCandidates) {
          try {
            const urlRes = await api.getSongUrls(song.id, qualityLevel);
            const songUrl = Array.isArray(urlRes?.data)
              ? urlRes.data.find(item => item?.url)?.url || null
              : urlRes?.data?.url || null;
            if (!songUrl) continue;
            songUrlCacheRef.current.set(urlCacheKey, { url: songUrl, time: Date.now() });
            pruneSongUrlCache();
            cacheAudioInBackground(song, requestedQuality, songUrl);
            return songUrl;
          } catch (error) {
            console.warn(`Failed to resolve ${qualityLevel} playback URL for song ${song.id}:`, error);
          }
        }

        // Fallback 1: Try UNM unblock via song/url/v1?unblock=true
        try {
          const unblockRes = await api.getSongUrls(song.id, 'standard', true);
          const unblockUrl = Array.isArray(unblockRes?.data)
            ? unblockRes.data.find(item => item?.url)?.url || null
            : unblockRes?.data?.url || null;
          if (unblockUrl) {
            appendRuntimeLog('info', '通过智能解灰获取到歌曲音频链接', { songId: song.id }, 'audio');
            songUrlCacheRef.current.set(urlCacheKey, { url: unblockUrl, time: Date.now() });
            pruneSongUrlCache();
            return unblockUrl;
          }
        } catch (unblockErr) {
          console.warn(`Unblock failed for song ${song.id}:`, unblockErr);
        }

        // Fallback 2: Try match endpoint /song/url/match
        try {
          const matchRes = await api.getSongUrlMatch(song.id);
          const matchUrl = matchRes?.data || matchRes?.url || null;
          if (matchUrl && typeof matchUrl === 'string' && matchUrl.startsWith('http')) {
            appendRuntimeLog('info', '通过全网匹配获取到歌曲音频链接', { songId: song.id }, 'audio');
            songUrlCacheRef.current.set(urlCacheKey, { url: matchUrl, time: Date.now() });
            pruneSongUrlCache();
            return matchUrl;
          }
        } catch (matchErr) {
          console.warn(`Match URL failed for song ${song.id}:`, matchErr);
        }

        return null;
      })()
        .finally(() => {
          songUrlInFlightRef.current.delete(urlCacheKey);
        });
      songUrlInFlightRef.current.set(urlCacheKey, requestPromise);
    }

    return songUrlInFlightRef.current.get(urlCacheKey);
  }, [cacheAudioInBackground, pruneSongUrlCache]);

  // Playback Control logic
  const playSong = useCallback(async (song, newQueue = null, resumeProgress = null, options = {}) => {
    if (!song) return;
    if (stateRef.current.listenPlaybackLocked && options?.remoteSync !== true) return;
    const { audioQuality, playlist, audioElement, currentSong } = stateRef.current;
    const forceRefreshUrl = options?.forceRefreshUrl === true;
    const failedSongIds = new Set(options?.failedSongIds || []);
    const playSequence = ++playSequenceRef.current;

    const queueForFallback = Array.isArray(newQueue) && newQueue.length > 0 ? newQueue : playlist;
    const fallbackStartIndex = queueForFallback.findIndex(item => sameSongId(item.id, song.id));
    const playNextAvailableAfterFailure = () => {
      if (!queueForFallback.length || fallbackStartIndex === -1) return false;
      const nextFailedSongIds = new Set(failedSongIds);
      nextFailedSongIds.add(String(song.id));
      for (let offset = 1; offset < queueForFallback.length; offset += 1) {
        const nextIndex = (fallbackStartIndex + offset) % queueForFallback.length;
        const candidate = queueForFallback[nextIndex];
        if (!candidate?.id || nextFailedSongIds.has(String(candidate.id))) continue;
        setPlaylistAndPersist(queueForFallback);
        setPlaylistIndexAndPersist(nextIndex);
        setTimeout(() => {
          playSong(candidate, queueForFallback, null, { failedSongIds: Array.from(nextFailedSongIds) });
        }, 0);
        return true;
      }
      return false;
    };

    const currentUrlCachedAt = Number(currentSong?.urlCachedAt || 0);
    const currentUrlIsFresh = currentSong?.url && currentUrlCachedAt && Date.now() - currentUrlCachedAt < 15 * 60 * 1000;
    const audioCurrentSrc = audioElement?.currentSrc || audioElement?.src || '';
    const shouldReplayCurrentSource = (
      resumeProgress === null &&
      !forceRefreshUrl &&
      sameSongId(currentSong?.id, song?.id) &&
      currentUrlIsFresh &&
      audioElement &&
      audioCurrentSrc === currentSong.url
    );

    if (shouldReplayCurrentSource) {
      if (newQueue) {
        setPlaylistAndPersist(newQueue);
        const idx = newQueue.findIndex(item => sameSongId(item.id, song.id));
        setPlaylistIndexAndPersist(idx);
      }
      persistResumeTime(null);
      try {
        audioElement.currentTime = 0;
        const replayPromise = audioElement.play?.();
        if (replayPromise?.catch) replayPromise.catch(() => {});
      } catch {}
      setIsPlaying(true);
      addToRecent(currentSong);
      return;
    }

    // A persisted queue entry can already have a playable local/remote URL.
    // Start it immediately and refresh that URL in the background (the effect
    // below does this). Previously playNext() cleared the active source and
    // waited for /song/url/v1 before updating the media element, which made
    // cover/lyrics advance while audio appeared frozen after a restart.
    if (!forceRefreshUrl && song.url && !isLegacyFileMediaSource(song.url)) {
      const optimisticSong = {
        ...song,
        title: song.name || song.title,
        artist: song.ar?.map(a => a.name).join(' / ') || song.artists?.map(a => a.name).join(' / ') || song.artist || '未知歌手',
        durationMs: song.dt || song.duration || song.durationMs || 0
      };

      if (resumeProgress !== null) persistResumeTime(resumeProgress);
      else persistResumeTime(null);

      if (newQueue) {
        setPlaylistAndPersist(newQueue);
        setPlaylistIndexAndPersist(newQueue.findIndex(item => sameSongId(item.id, song.id)));
      } else {
        const existingIdx = playlist.findIndex(item => sameSongId(item.id, song.id));
        if (existingIdx !== -1) setPlaylistIndexAndPersist(existingIdx);
      }

      // AudioPlayer owns source replacement. Calling pause() here emits a
      // native pause event before the new currentSong has committed, which
      // can race setIsPlaying(true) and create a play/pause loop.
      setCurrentSongAndPersist(optimisticSong);
      cacheCoverInBackground(optimisticSong);
      setIsPlaying(true);
      addToRecent(optimisticSong);
      return;
    }

    try {
      setIsPlaying(false);
      if (audioElement) {
        try {
          audioElement.pause();
          audioElement.currentTime = 0;
          // Keep the last committed media URL on the element until React has
          // committed the newly resolved one. Calling load() after removing
          // src creates MEDIA_ERR_SRC_NOT_SUPPORTED ("Empty src attribute")
          // on a cold start, and that stale error can win the first-play race.
          // AudioPlayer owns the actual source replacement and its load().
        } catch {}
      }

      const songUrl = await getPlayableSongUrl(song, audioQuality, forceRefreshUrl);
      if (playSequence !== playSequenceRef.current) return;

      if (!songUrl) {
        appendRuntimeLog('warn', '无法获取歌曲播放源（VIP或版权限制），自动尝试播放下一首', {
          songId: song.id,
          songName: song.name || song.title
        }, 'player');
        if (!playNextAvailableAfterFailure()) {
          setIsPlaying(false);
        }
        return;
      }

      // Do not block playback on a secondary album-detail request. The song
      // metadata and audio URL are enough to start immediately; missing cover
      // art is resolved and cached by cacheCoverInBackground below.
      const coverSourceSong = song;
      const coverUrl = getSongCoverUrl(song, true);

      const songWithUrl = {
        ...coverSourceSong,
        url: songUrl,
        title: coverSourceSong.name || coverSourceSong.title,
        artist: coverSourceSong.ar?.map(a => a.name).join(' / ') || coverSourceSong.artists?.map(a => a.name).join(' / ') || coverSourceSong.artist || '\u672a\u77e5\u6b4c\u624b',
        coverUrl: coverUrl || '',
        originalCoverUrl: coverUrl || getSongCoverUrl(coverSourceSong, true),
        durationMs: coverSourceSong.dt || coverSourceSong.duration || coverSourceSong.durationMs || 0,
        urlCachedAt: Date.now(),
        urlQuality: audioQuality
      };

      if (resumeProgress !== null) {
        persistResumeTime(resumeProgress);
      } else {
        // A normal song selection must not inherit a stale resumeTime from the
        // previous track/session; that can seek the new media into an invalid
        // startup state and leave it stuck at 0.00.
        persistResumeTime(null);
      }

      if (newQueue) {
        setPlaylistAndPersist(newQueue);
        const idx = newQueue.findIndex(item => sameSongId(item.id, song.id));
        setPlaylistIndexAndPersist(idx);
      } else {
        const existingIdx = playlist.findIndex(item => sameSongId(item.id, song.id));
        if (existingIdx !== -1) {
          setPlaylistIndexAndPersist(existingIdx);
        } else {
          const updatedPlaylist = [...playlist, songWithUrl];
          setPlaylistAndPersist(updatedPlaylist);
          setPlaylistIndexAndPersist(updatedPlaylist.length - 1);
        }
      }
      setCurrentSongAndPersist(songWithUrl);
      cacheCoverInBackground(songWithUrl);
      setIsPlaying(true);
      addToRecent(songWithUrl);

      // Download a short look-ahead window so next/skip playback can start from disk.
      try {
        const { playlist: currentPlaylist, playlistIndex: currentIdx, playMode: currentMode } = stateRef.current;
        if (currentPlaylist.length > 1) {
          const songIdx = currentPlaylist.findIndex(item => item.id === song.id);
          const baseIdx = songIdx !== -1 ? songIdx : currentIdx;
          const candidates = currentMode === 'random'
            ? (Array.isArray(currentPlaylist) ? currentPlaylist : []).filter(item => item && item.id !== song.id).slice(0, 3)
            : [1, 2, 3].map(offset => currentPlaylist[(baseIdx + offset) % currentPlaylist.length]);
          candidates.filter(Boolean).forEach(nextSong => {
            getPlayableSongUrl(nextSong, audioQuality).then(url => {
              if (url) cacheCoverInBackground(nextSong);
            }).catch(() => {});
          });
        }
      } catch (_) { /* ignore pre-fetch errors */ }
    } catch (error) {
      console.error('Error starting song playback:', error);
      appendRuntimeLog('error', '播放启动失败，自动尝试下一首', {
        songId: song?.id,
        error: error?.message || String(error)
      }, 'player');
      if (!playNextAvailableAfterFailure()) {
        setIsPlaying(false);
      }
    }
  }, [persistResumeTime, setPlaylistAndPersist, setPlaylistIndexAndPersist, setCurrentSongAndPersist, setIsPlaying, addToRecent, getPlayableSongUrl, cacheCoverInBackground]);

  useEffect(() => {
    if (!currentSong?.id || !cacheConfig?.enabled) return;
    // CachedCover resolves file:// URLs locally. Keep currentSong metadata on a
    // durable remote URL so every raw image consumer retains a valid fallback.
    cacheCoverInBackground(currentSong);
  }, [currentSong?.id, cacheConfig?.enabled, cacheConfig?.directory, cacheCoverInBackground]);

  useEffect(() => {
    if (!cacheConfig?.enabled || recentlyPlayed.length === 0) return;
    recentlyPlayed.slice(0, 5).forEach(cacheCoverInBackground);
  }, [cacheConfig?.enabled, cacheConfig?.directory, recentlyPlayed, cacheCoverInBackground]);

  useEffect(() => {
    if (!currentSong?.id) return undefined;
    const quality = audioQuality;
    const cachedAt = Number(currentSong.urlCachedAt || 0);
    const hasFreshUrl = currentSong.url && !isLegacyFileMediaSource(currentSong.url)
      && cachedAt && Date.now() - cachedAt < 15 * 60 * 1000;

    let cancelled = false;
    getPlayableSongUrl(currentSong, quality).then(songUrl => {
      if (cancelled || !songUrl) return;
      const latestSong = stateRef.current.currentSong;
      if (latestSong?.id !== currentSong.id) return;
      if (hasFreshUrl && latestSong.url === songUrl) return;
      setCurrentSongAndPersist({
        ...latestSong,
        url: songUrl,
        urlCachedAt: Date.now()
      });
    }).catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [currentSong?.id, audioQuality, getPlayableSongUrl, pruneSongUrlCache, setCurrentSongAndPersist]);

  const setAudioQuality = useCallback((quality) => {
    if (stateRef.current.listenPlaybackLocked) return;
    const { currentSong, progress } = stateRef.current;
    updateProfile({ audio: { quality } });
    if (currentSong) {
      // A quality change must bypass the previous URL and request the new
      // level from /song/url/v1 instead of reusing the old cached source.
      playSong(currentSong, null, progress, { forceRefreshUrl: true });
    }
  }, [updateProfile, playSong]);

  const togglePlay = useCallback(() => {
    if (stateRef.current.listenPlaybackLocked) return;
    const { currentSong, progress } = stateRef.current;
    if (!currentSong) return;
    if (!isPlaying) {
      // If a persisted source exists, let AudioPlayer try it immediately. Its
      // source is already committed during startup, the background resolver is
      // refreshing stale CDN URLs, and the media-error path can force a refresh.
      // Blocking here on URL age reproduced the long silent first-play delay.
      if (!currentSong.url) {
        playSong(currentSong, null, progress, { forceRefreshUrl: true });
        return;
      }

      // AudioPlayer is the single owner of audio.play(). Setting intent here
      // lets React commit src/crossOrigin first and avoids the startup call
      // being rejected against an empty or half-loaded media element.
      setIsPlaying(true);
      return;
    }
    setIsPlaying(prev => !prev);
  }, [isPlaying, playSong, setIsPlaying]);

  const heartBasePoolRef = useRef([]);

  const fetchHeartRecommendedPool = useCallback(async (seedSong, playlistId) => {
    if (!seedSong?.id) return [];
    const pid = playlistId || stateRef.current.likedPlaylistId || '';
    let recList = [];

    // Tier 1: NetEase Cloud Music official intelligence list
    try {
      if (pid) {
        const res = await api.getIntelligenceList(seedSong.id, pid, seedSong.id);
        if (res?.code === 200 && Array.isArray(res.data) && res.data.length > 0) {
          const list = res.data
            .filter(item => item && (item.recommended || item.id !== seedSong.id))
            .map(item => {
              const s = item.songInfo || item;
              return {
                ...s,
                id: s.id || item.id,
                name: s.name,
                ar: s.ar || s.artists || [{ name: s.artist || '未知艺术家' }],
                al: s.al || s.album || { picUrl: s.picUrl || s.coverUrl },
                coverUrl: s.coverUrl || s.al?.picUrl || s.album?.picUrl || s.picUrl || '',
                isHeartRecommend: true
              };
            });
          if (list.length > 0) {
            recList = list;
          }
        }
      }
    } catch (err) {
      appendRuntimeLog('warn', '心动模式官方接口不可用，尝试相似推荐', { error: err?.message }, 'player');
    }

    // Tier 2: Simi songs + Daily recommend / Personalized newsongs
    if (recList.length < 6) {
      try {
        const simiRes = await api.getSimiSongs(seedSong.id).catch(() => null);
        const simis = (simiRes?.songs || []).map(s => ({
          ...s,
          coverUrl: s.album?.picUrl || s.al?.picUrl || s.coverUrl || '',
          ar: s.artists || s.ar || [{ name: s.artist || '未知艺术家' }],
          al: s.album || s.al || { picUrl: s.coverUrl || '' },
          isHeartRecommend: true
        }));
        recList = [...recList, ...simis];

        if (recList.length < 8) {
          const recRes = await api.getRecommendSongs().catch(() => null);
          const dailySongs = (recRes?.data?.dailySongs || recRes?.recommend || []).map(s => ({
            ...s,
            coverUrl: s.al?.picUrl || s.album?.picUrl || s.coverUrl || '',
            ar: s.artists || s.ar || [{ name: s.artist || '未知艺术家' }],
            al: s.album || s.al || { picUrl: s.coverUrl || '' },
            isHeartRecommend: true
          }));
          recList = [...recList, ...dailySongs];
        }

        if (recList.length < 8) {
          const newRes = await api.getPersonalizedNewsongs(20).catch(() => null);
          const newSongs = (newRes?.result || []).map(item => {
            const s = item.song || item;
            return {
              ...s,
              id: s.id || item.id,
              name: item.name || s.name,
              ar: s.artists || s.ar || [{ name: s.artist || '未知艺术家' }],
              al: s.album || s.al || { picUrl: item.picUrl || '' },
              coverUrl: item.picUrl || s.al?.picUrl || s.album?.picUrl || '',
              isHeartRecommend: true
            };
          });
          recList = [...recList, ...newSongs];
        }
      } catch (err) {
        appendRuntimeLog('warn', '心动推荐拉取失败', { error: err?.message }, 'player');
      }
    }

    // Deduplicate recommendations
    const seen = new Set();
    seen.add(String(seedSong.id));
    return (Array.isArray(recList) ? recList : []).filter(s => {
      const id = String(s?.id || '');
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }, []);

  // Dynamic Smart Radio Queue Builder with Progressive Discovery Pacing
  const buildDynamicSmartRadioQueue = useCallback((seedSong, baseSongs = [], recList = []) => {
    if (!seedSong?.id) return [];

    const cleanBase = (Array.isArray(baseSongs) ? baseSongs : []).filter(s => s && String(s.id) !== String(seedSong.id));
    const cleanRec = (Array.isArray(recList) ? recList : []).filter(s => s && String(s.id) !== String(seedSong.id));
    const shuffledBase = [...cleanBase].sort(() => Math.random() - 0.5);

    const queue = [{ ...seedSong, isHeartRecommend: false }];
    let baseIdx = 0;
    let recIdx = 0;
    let cycle = 0;

    // Dynamic Pacing Schedule:
    // Cycle 0: 3 base familiar tracks -> 1 smart recommendation
    // Cycle 1: 2 base familiar tracks -> 1 smart recommendation
    // Cycle 2: 2 base familiar tracks -> 2 smart recommendations
    // Cycle 3+: 1~2 base familiar tracks -> 2 smart recommendations
    while (baseIdx < shuffledBase.length || recIdx < cleanRec.length) {
      let baseCount = 2;
      let recCount = 1;

      if (cycle === 0) {
        baseCount = 3;
        recCount = 1;
      } else if (cycle === 1) {
        baseCount = 2;
        recCount = 1;
      } else if (cycle === 2) {
        baseCount = 2;
        recCount = 2;
      } else {
        baseCount = Math.random() > 0.4 ? 2 : 1;
        recCount = Math.random() > 0.3 ? 2 : 1;
      }

      // Insert familiar base tracks
      for (let i = 0; i < baseCount && baseIdx < shuffledBase.length; i += 1) {
        queue.push({ ...shuffledBase[baseIdx], isHeartRecommend: false });
        baseIdx += 1;
      }

      // Insert smart recommended discovery tracks
      for (let j = 0; j < recCount && recIdx < cleanRec.length; j += 1) {
        queue.push({ ...cleanRec[recIdx], isHeartRecommend: true });
        recIdx += 1;
      }

      cycle += 1;
    }

    appendRuntimeLog('info', '智能电台/心动模式队列构建完成（动态渐进探索节奏）', {
      total: queue.length,
      baseLikedCount: shuffledBase.length,
      recommendCount: cleanRec.length,
      seedSongName: seedSong.name
    }, 'player');

    return queue;
  }, []);

  const startHeartMode = useCallback((startSong = null, playlistId = null, sourceList = null) => {
    if (stateRef.current.listenPlaybackLocked) return;
    const currentList = (sourceList && sourceList.length > 0)
      ? sourceList
      : (stateRef.current.playlist && stateRef.current.playlist.length > 0 ? stateRef.current.playlist : []);
    if (currentList.length === 0) return;

    // Backup original list
    if (stateRef.current.playMode !== 'heart' || !originalPlaylistBackupRef.current) {
      originalPlaylistBackupRef.current = [...currentList];
    }
    const baseBackup = originalPlaylistBackupRef.current || [...currentList];

    // Pick seed song
    const seed = startSong || baseBackup[Math.floor(Math.random() * baseBackup.length)] || currentList[0];
    if (!seed) return;

    // 1. Immediately create an initial progressive queue starting with seed
    const baseWithoutSeed = (Array.isArray(baseBackup) ? baseBackup : []).filter(s => s && s.id !== seed.id);
    const initialShuffled = [{ ...seed, isHeartRecommend: false }, ...([...baseWithoutSeed].sort(() => Math.random() - 0.5))];

    // 2. Update playMode, playlist and start playback immediately
    updateProfile({ playback: { playMode: 'heart' } });
    setPlaylistAndPersist(initialShuffled);
    setPlaylistIndexAndPersist(0);
    playSong(seed, initialShuffled);

    // 3. Concurrently fetch multi-tier recommendations and rebuild with dynamic pacing
    const pid = playlistId || stateRef.current.likedPlaylistId || '';
    fetchHeartRecommendedPool(seed, pid).then(recList => {
      if (recList.length > 0) {
        const currentPlaying = stateRef.current.currentSong || seed;
        const remainingBase = (Array.isArray(initialShuffled) ? initialShuffled : []).filter(s => s && s.id !== currentPlaying.id);
        const dynamicQueue = buildDynamicSmartRadioQueue(currentPlaying, remainingBase, recList);
        
        setPlaylistAndPersist(dynamicQueue);
        const idx = dynamicQueue.findIndex(s => s.id === currentPlaying.id);
        setPlaylistIndexAndPersist(idx >= 0 ? idx : 0);
      }
    }).catch(err => {
      console.warn('Background smart radio recommendation interleave failed:', err);
    });
  }, [fetchHeartRecommendedPool, buildDynamicSmartRadioQueue, updateProfile, setPlaylistAndPersist, setPlaylistIndexAndPersist, playSong]);

  const setPlayModeAndPersist = useCallback(async (mode) => {
    if (stateRef.current.listenPlaybackLocked) return;
    const prevMode = stateRef.current.playMode;
    updateProfile({ playback: { playMode: mode } });

    // Entering Heart Mode
    if (mode === 'heart' && prevMode !== 'heart') {
      const currentList = stateRef.current.playlist || [];
      const current = stateRef.current.currentSong || currentList[0];
      if (currentList.length > 0 && current) {
        startHeartMode(current, stateRef.current.likedPlaylistId, currentList);
      }
    }
    // Exiting Heart Mode
    else if (prevMode === 'heart' && mode !== 'heart') {
      if (originalPlaylistBackupRef.current && originalPlaylistBackupRef.current.length > 0) {
        const restored = originalPlaylistBackupRef.current;
        const current = stateRef.current.currentSong;
        setPlaylistAndPersist(restored);
        const idx = current ? restored.findIndex(s => s.id === current.id) : 0;
        setPlaylistIndexAndPersist(idx >= 0 ? idx : 0);
        originalPlaylistBackupRef.current = null;
      }
    }
  }, [updateProfile, startHeartMode, setPlaylistAndPersist, setPlaylistIndexAndPersist]);

  const playNext = useCallback(() => {
    if (stateRef.current.listenPlaybackLocked) return;
    const { playlist, playlistIndex, playMode, currentSong } = stateRef.current;
    if (playlist.length === 0) return;

    let nextIndex = playlistIndex;
    if (playMode === 'random') {
      nextIndex = Math.floor(Math.random() * playlist.length);
    } else {
      nextIndex = (playlistIndex + 1) % playlist.length;
    }

    // Auto-fetch and dynamically append more in Heart / Smart Radio Mode when approaching end of queue
    if (playMode === 'heart' && playlistIndex >= playlist.length - 4 && !isFetchingHeartRef.current) {
      isFetchingHeartRef.current = true;
      const lastSong = playlist[playlist.length - 1] || currentSong;
      const basePool = originalPlaylistBackupRef.current || playlist;
      
      fetchHeartRecommendedPool(lastSong, stateRef.current.likedPlaylistId).then(moreRecs => {
        if (moreRecs.length > 0 || basePool.length > 0) {
          const existingIds = new Set(stateRef.current.playlist.map(s => s.id));
          const newRecs = (Array.isArray(moreRecs) ? moreRecs : []).filter(s => s && !existingIds.has(s.id));
          const newBase = (Array.isArray(basePool) ? basePool : []).filter(s => s && !existingIds.has(s.id)).sort(() => Math.random() - 0.5).slice(0, 12);
          
          const appendBatch = [];
          let bIdx = 0;
          let rIdx = 0;
          while (bIdx < newBase.length || rIdx < newRecs.length) {
            // Progressive batch: 1~2 base -> 2 rec
            const bCount = Math.random() > 0.5 ? 2 : 1;
            for (let i = 0; i < bCount && bIdx < newBase.length; i += 1) {
              appendBatch.push({ ...newBase[bIdx], isHeartRecommend: false });
              bIdx += 1;
            }
            for (let j = 0; j < 2 && rIdx < newRecs.length; j += 1) {
              appendBatch.push({ ...newRecs[rIdx], isHeartRecommend: true });
              rIdx += 1;
            }
          }

          if (appendBatch.length > 0) {
            setPlaylistAndPersist([...stateRef.current.playlist, ...appendBatch]);
          }
        }
      }).catch(() => {}).finally(() => {
        isFetchingHeartRef.current = false;
      });
    }
    const nextSong = playlist[nextIndex];
    if (nextSong) {
      playSong(nextSong);
    }
  }, [playSong, fetchHeartRecommendedPool, setPlaylistAndPersist]);

  const playPrev = useCallback(() => {
    if (stateRef.current.listenPlaybackLocked) return;
    const { playlist, playlistIndex, playMode } = stateRef.current;
    if (playlist.length === 0) return;

    let prevIndex = playlistIndex;
    if (playMode === 'random') {
      prevIndex = Math.floor(Math.random() * playlist.length);
    } else {
      prevIndex = playlistIndex - 1;
      if (prevIndex < 0) prevIndex = playlist.length - 1;
    }

    const prevSong = playlist[prevIndex];
    if (prevSong) {
      playSong(prevSong);
    }
  }, [playSong]);

  // Logout action (shared central method)
  const logout = useCallback(async () => {
    if (window.confirm('\u786e\u8ba4\u9000\u51fa\u767b\u5f55\u5417\uff1f')) {
      try {
        await api.logout();
        setUser(null);
        await checkUserLogin();
        alert('\u9000\u51fa\u6210\u529f');
      } catch (err) {
        console.error('Logout error:', err);
      }
    }
  }, [setUser, checkUserLogin]);

  function adjustColorBrightness(hex, percent) {
    if (!hex || !hex.startsWith('#')) return '#ff4081';
    let R = parseInt(hex.substring(1, 3), 16);
    let G = parseInt(hex.substring(3, 5), 16);
    let B = parseInt(hex.substring(5, 7), 16);

    R = parseInt((R * (100 + percent)) / 100);
    G = parseInt((G * (100 + percent)) / 100);
    B = parseInt((B * (100 + percent)) / 100);

    R = Math.min(255, Math.max(0, R));
    G = Math.min(255, Math.max(0, G));
    B = Math.min(255, Math.max(0, B));

    const rHex = R.toString(16).padStart(2, '0');
    const gHex = G.toString(16).padStart(2, '0');
    const bHex = B.toString(16).padStart(2, '0');

    return `#${rHex}${gHex}${bHex}`;
  }

  function getContrastColor(hex) {
    if (!hex || !hex.startsWith('#')) return '#ffffff';
    const r = parseInt(hex.substring(1, 3), 16);
    const g = parseInt(hex.substring(3, 5), 16);
    const b = parseInt(hex.substring(5, 7), 16);
    const yiq = (r * 299 + g * 587 + b * 114) / 1000;
    return yiq >= 155 ? '#111111' : '#ffffff';
  }

  const requestAppClose = useCallback(() => {
    const behavior = profile.appearance?.closeBehavior || DEFAULT_PROFILE.appearance.closeBehavior;
    if (behavior === 'hide') {
      window.electronAPI?.hide?.();
    } else if (behavior === 'close') {
      window.electronAPI?.close?.();
    } else {
      setIsClosePromptOpen(true);
    }
  }, [profile.appearance?.closeBehavior]);

  const contextValue = useMemo(() => ({
    profile,
    updateProfile,

    currentView,
    viewData,
    navigateTo,
    goBack,
    goForward,
    canGoBack: historyIndex > 0,
    canGoForward: historyIndex < viewHistory.length - 1,

    user,
    setUser,
    checkUserLogin,
    logout,
    likedSongIds,
    toggleLike,
    likedPlaylistId,

    currentSong,
    setCurrentSong: setCurrentSongAndPersist,
    playlist,
    setPlaylist: setPlaylistAndPersist,
    playlistIndex,
    setPlaylistIndex: setPlaylistIndexAndPersist,
    isPlaying,
    setIsPlaying,
    volume,
    setVolume,
    progress,
    setProgress: persistProgress,
    duration,
    setDuration: persistDuration,
    playMode,
    setPlayMode: setPlayModeAndPersist,
    recentlyPlayed,
    refreshRecentlyPlayed: fetchRemoteRecentlyPlayed,
    resolveSongCover,
    isLyricsOpen,
    setIsLyricsOpen,
    isQueueOpen,
    setIsQueueOpen,
    isEqualizerOpen,
    setIsEqualizerOpen,
    listenPlaybackLocked,
    setListenPlaybackLocked,
    isClosePromptOpen,
    setIsClosePromptOpen,
    requestAppClose,

    playSong,
    startHeartMode,
    togglePlay,
    playNext,
    playPrev,

    isFirstTimeSetupComplete,

    colorMode,
    setColorMode,
    layoutMode,
    setLayoutMode,
    theme,
    lyricStyle,
    saveLyricStyle,
    visualizerMode,
    saveVisualizerMode,

    appearanceConfig,
    saveAppearanceConfig,
    coverConfig,
    saveCoverConfig,
    backgroundConfig,
    saveBackgroundConfig,
    advancedLyricConfig,
    saveAdvancedLyricConfig,
    visualizerConfig,
    saveVisualizerConfig,
    desktopLyricsConfig,
    saveDesktopLyricsConfig,
    mergeDesktopLyricsConfigFromIpc,

    audioConfig,
    saveAudioConfig,
    cacheConfig,
    saveCacheConfig,
    playbackConfig,
    savePlaybackConfig,
    renderingConfig,
    saveRenderingConfig,
    shortcuts,
    saveShortcuts,

    userPlaylists,
    audioQuality,
    setAudioQuality,
    resumeTime,
    setResumeTime: persistResumeTime,
    audioElement,
    setAudioElement,
    extractedColors,
    immersiveColor,
    updateInfo,
    setUpdateInfo,
    checkForUpdates,
    downloadUpdate,
    installUpdate
  }), [
    profile, updateProfile, currentView, viewData, historyIndex, viewHistory.length, user, likedSongIds,
    likedPlaylistId, currentSong, playlist, playlistIndex, isPlaying, volume, progress, duration, playMode,
    recentlyPlayed, isLyricsOpen, isQueueOpen, isEqualizerOpen, listenPlaybackLocked, setListenPlaybackLocked, isClosePromptOpen, colorMode, layoutMode, theme, customThemeColors, navbarConfig, lyricStyle,
    desktopLyricsConfig, audioConfig, cacheConfig, playbackConfig, renderingConfig, shortcuts, userPlaylists, audioQuality,
    resumeTime, audioElement, setUser, setCurrentSongAndPersist, setPlaylistAndPersist, setPlaylistIndexAndPersist,
    isFirstTimeSetupComplete, requestAppClose,
    setVolume, persistProgress, persistDuration, setColorMode, setLayoutMode, setTheme, saveCustomThemeColors,
    saveNavbarConfig, saveLyricStyle, saveVisualizerMode, saveAppearanceConfig, saveCoverConfig, saveBackgroundConfig,
    saveAdvancedLyricConfig, saveVisualizerConfig, saveDesktopLyricsConfig, mergeDesktopLyricsConfigFromIpc,
    saveAudioConfig, saveCacheConfig, savePlaybackConfig, saveRenderingConfig, saveShortcuts, persistResumeTime,
    navigateTo, goBack, goForward, checkUserLogin, fetchRemoteRecentlyPlayed, toggleLike, playSong, startHeartMode, togglePlay, playNext, playPrev, setAudioQuality, addToRecent, logout,
    resolveSongCover,
    extractedColors, immersiveColor, updateInfo, checkForUpdates, downloadUpdate, installUpdate
  ]);

  return (
    <AppContext.Provider value={contextValue}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  return useContext(AppContext);
}



