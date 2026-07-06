import React, { createContext, useCallback, useContext, useEffect, useMemo, useState, useRef } from 'react';
import { api } from '../utils/api';
import { DEFAULT_PROFILE, deepMerge, loadProfile, saveProfile } from '../utils/settingsProfile';
import { extractWarmColdColors } from '../utils/colorExtractor';

const AppContext = createContext();

export const APP_VERSION = 'v1.2.0';

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
  const [isQueueOpen, setIsQueueOpen] = useState(false);
  const [isClosePromptOpen, setIsClosePromptOpen] = useState(false);

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
  const advancedLyricConfig = profile.immersiveLyrics || DEFAULT_PROFILE.immersiveLyrics;
  const visualizerConfig = profile.visualizer || DEFAULT_PROFILE.visualizer;
  const desktopLyricsConfig = profile.desktopLyrics || DEFAULT_PROFILE.desktopLyrics;
  const audioConfig = profile.audio || DEFAULT_PROFILE.audio;
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

  useEffect(() => {
    if (!currentSong || !currentSong.coverUrl) {
      setExtractedColors({
        warm: '#ff4081',
        cold: '#00b0ff',
        dominant: '#ff4081'
      });
      return;
    }
    
    let isMounted = true;
    extractWarmColdColors(currentSong.coverUrl).then(colors => {
      if (isMounted) {
        setExtractedColors(colors);
      }
    });
    return () => {
      isMounted = false;
    };
  }, [currentSong?.id, currentSong?.coverUrl]);

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
    recentlyPlayed,
    progress,
    currentSong
  };

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

  const persistProgress = useCallback((nextProgress) => {
    const numeric = Number(nextProgress) || 0;
    setProgress(numeric);
    updateProfile({ lastSession: { progress: numeric } });
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
    const listWithoutCurrent = recentlyPlayed.filter(item => item.id !== song.id);
    const newRecent = [song, ...listWithoutCurrent].slice(0, 100);
    setRecentlyPlayed(newRecent);
    updateProfile({ recentlyPlayed: newRecent });
  }, [updateProfile, setRecentlyPlayed]);

  const setVolume = useCallback((nextVolume) => {
    const numeric = Math.max(0, Math.min(1, Number(nextVolume) || 0));
    setVolumeState(numeric);
    updateProfile({ audio: { volume: numeric, muted: numeric === 0 } });
  }, [updateProfile]);

  // Load account status on mount.
  useEffect(() => {
    checkUserLogin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update theme and mode classes on body element
  useEffect(() => {
    document.body.className = '';

    let activeMode = colorMode;
    if (colorMode === 'system') {
      activeMode = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

    document.body.classList.add(`mode-${activeMode}`);
    document.body.classList.add(`layout-${layoutMode}`);

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
  }, [theme, colorMode, customThemeColors, layoutMode]);

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
        fontSize: desktopLyricsConfig.fontSize || 36,
        fontFamily: desktopLyricsConfig.fontFamily || 'Inter',
        fontWeight: desktopLyricsConfig.fontWeight || (desktopLyricsConfig.bold !== false ? 700 : 500),
        boldFirstLine: desktopLyricsConfig.bold !== false,
        desktopColor: desktopLyricsConfig.playedColor || desktopLyricsConfig.color || 'theme',
        alignment: desktopLyricsConfig.alignment || 'center',
        showTranslation: desktopLyricsConfig.showTranslation !== false,
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
  const savePlaybackConfig = useCallback((cfg) => updateProfile({ playback: cfg }), [updateProfile]);
  const saveRenderingConfig = useCallback((cfg) => updateProfile({ rendering: cfg }), [updateProfile]);
  const saveShortcuts = useCallback((cfg) => updateProfile({ shortcuts: cfg }), [updateProfile]);

  const [updateInfo, setUpdateInfo] = useState({ show: false, latestVersion: '' });

  const checkForUpdates = useCallback(async (isManual = false) => {
    try {
      const res = await fetch('https://api.github.com/repos/lyb82ndkf-lab/ichigo-music/releases/latest');
      if (!res.ok) throw new Error('API request failed');
      const data = await res.json();
      const latestTag = data.tag_name;
      if (latestTag && isVersionLessThan(APP_VERSION, latestTag)) {
        setUpdateInfo({ show: true, latestVersion: latestTag });
        return { hasUpdate: true, latestVersion: latestTag };
      } else {
        if (isManual) {
          alert('当前已是最新版本！');
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

  // Check login
  const checkUserLogin = useCallback(async () => {
    try {
      const res = await api.getLoginStatus();
      if (res.data && res.data.profile) {
        setUser(res.data.profile);
        fetchLikedSongs(res.data.profile.userId);
      } else {
        setUser(null);
        setLikedSongIds(new Set());
      }
    } catch (err) {
      console.log('Login check failed:', err);
      setUser(null);
    }
  }, [setUser, fetchLikedSongs]);

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

  // Playback Control logic
  const playSong = useCallback(async (song, newQueue = null, resumeProgress = null) => {
    if (!song) return;
    const { audioQuality, playlist } = stateRef.current;

    try {
      const urlRes = await api.getSongUrls(song.id, audioQuality);
      const songUrl = urlRes.data[0]?.url;

      if (!songUrl) {
        alert('\u65e0\u6cd5\u83b7\u53d6\u8be5\u6b4c\u66f2\u7684\u64ad\u653e\u6e90\uff08\u53ef\u80fd\u662fVIP\u6b4c\u66f2\u6216\u7248\u6743\u9650\u5236\uff09');
        return;
      }

      const songWithUrl = {
        ...song,
        url: songUrl,
        title: song.name || song.title,
        artist: song.ar?.map(a => a.name).join(' / ') || song.artists?.map(a => a.name).join(' / ') || song.artist || '\u672a\u77e5\u6b4c\u624b',
        coverUrl: song.al?.picUrl || song.album?.picUrl || song.coverUrl || 'https://p2.music.126.net/UeTuwE7Cx877Y2gCGIseYg==/109951163026279185.jpg',
        durationMs: song.dt || song.duration || song.durationMs || 0
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
        const idx = newQueue.findIndex(item => item.id === song.id);
        setPlaylistIndexAndPersist(idx);
      } else {
        const existingIdx = playlist.findIndex(item => item.id === song.id);
        if (existingIdx !== -1) {
          setPlaylistIndexAndPersist(existingIdx);
        } else {
          const updatedPlaylist = [...playlist, songWithUrl];
          setPlaylistAndPersist(updatedPlaylist);
          setPlaylistIndexAndPersist(updatedPlaylist.length - 1);
        }
      }
      setCurrentSongAndPersist(songWithUrl);
      setIsPlaying(true);
      addToRecent(songWithUrl);
    } catch (error) {
      console.error('Error starting song playback:', error);
      alert('\u64ad\u653e\u5931\u8d25\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5');
    }
  }, [persistResumeTime, setPlaylistAndPersist, setPlaylistIndexAndPersist, setCurrentSongAndPersist, setIsPlaying, addToRecent]);

  const setAudioQuality = useCallback((quality) => {
    const { currentSong, progress } = stateRef.current;
    updateProfile({ audio: { quality } });
    if (currentSong) {
      playSong(currentSong, null, progress);
    }
  }, [updateProfile, playSong]);

  const togglePlay = useCallback(() => {
    const { currentSong } = stateRef.current;
    if (!currentSong) return;
    setIsPlaying(prev => !prev);
  }, [setIsPlaying]);

  const playNext = useCallback(() => {
    const { playlist, playlistIndex, playMode } = stateRef.current;
    if (playlist.length === 0) return;

    let nextIndex = playlistIndex;
    if (playMode === 'random') {
      nextIndex = Math.floor(Math.random() * playlist.length);
    } else {
      nextIndex = (playlistIndex + 1) % playlist.length;
    }

    const nextSong = playlist[nextIndex];
    if (nextSong) {
      playSong(nextSong);
    }
  }, [playSong]);

  const playPrev = useCallback(() => {
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

  const setPlayModeAndPersist = useCallback((mode) => {
    updateProfile({ playback: { playMode: mode } });
  }, [updateProfile]);

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
    isQueueOpen,
    setIsQueueOpen,

    isClosePromptOpen,
    setIsClosePromptOpen,
    requestAppClose,

    playSong,
    togglePlay,
    playNext,
    playPrev,

    isFirstTimeSetupComplete,

    colorMode,
    setColorMode,
    layoutMode,
    setLayoutMode,
    theme,
    setTheme,
    customThemeColors,
    saveCustomThemeColors,

    navbarConfig,
    saveNavbarConfig,
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
    checkForUpdates
  }), [
    profile, updateProfile, currentView, viewData, historyIndex, viewHistory.length, user, likedSongIds,
    likedPlaylistId, currentSong, playlist, playlistIndex, isPlaying, volume, progress, duration, playMode,
    recentlyPlayed, isQueueOpen, isClosePromptOpen, colorMode, layoutMode, theme, customThemeColors, navbarConfig, lyricStyle,
    visualizerMode, appearanceConfig, coverConfig, backgroundConfig, advancedLyricConfig, visualizerConfig,
    desktopLyricsConfig, audioConfig, playbackConfig, renderingConfig, shortcuts, userPlaylists, audioQuality,
    resumeTime, audioElement, setUser, setCurrentSongAndPersist, setPlaylistAndPersist, setPlaylistIndexAndPersist,
    isFirstTimeSetupComplete, requestAppClose,
    setVolume, persistProgress, persistDuration, setColorMode, setLayoutMode, setTheme, saveCustomThemeColors,
    saveNavbarConfig, saveLyricStyle, saveVisualizerMode, saveAppearanceConfig, saveCoverConfig, saveBackgroundConfig,
    saveAdvancedLyricConfig, saveVisualizerConfig, saveDesktopLyricsConfig, mergeDesktopLyricsConfigFromIpc,
    saveAudioConfig, savePlaybackConfig, saveRenderingConfig, saveShortcuts, persistResumeTime,
    navigateTo, goBack, goForward, checkUserLogin, toggleLike, playSong, togglePlay, playNext, playPrev, setAudioQuality, addToRecent, logout,
    extractedColors, immersiveColor, updateInfo, checkForUpdates
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
