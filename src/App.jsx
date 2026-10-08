import React, { Suspense, lazy, useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { AppProvider, useApp, APP_VERSION } from './context/AppContext';
import { AnimatePresence } from 'framer-motion';
import ClosePromptModal from './components/ClosePromptModal';
import UpdatePromptModal from './components/UpdatePromptModal';
import Sidebar from './components/Sidebar';
import PlayerBar from './components/PlayerBar';
import AudioPlayer from './components/AudioPlayer';
import LyricsView from './components/LyricsView';
import MonetFloatingDecor from './components/lyrics/MonetFloatingDecor';
import TopBar from './components/TopBar';
import ErrorBoundary from './components/ErrorBoundary';
import ModernPlayerBar from './components/ModernPlayerBar';
import ModernTopControls from './components/ModernTopControls';
import { shortcutMatches } from './components/ShortcutRow';
import MiniQueuePopover from './components/MiniQueuePopover';
import { useCachedCoverUrl } from './components/CachedCover';

import DesktopLyrics from './views/DesktopLyrics';
import IslandMiniPlayer from './views/IslandMiniPlayer';
import ListenTogether from './views/ListenTogether';
import { useLyricEngine } from './hooks/useLyricEngine';
import { useListenTogether } from './hooks/useListenTogether';
import ListenInvitePrompt from './components/ListenInvitePrompt';
import { IMMERSIVE_MODE_OPTIONS, normalizeImmersiveMode, KTV_TEMPLATE_GALLERY, JIZURA_GALLERY_STYLES } from './utils/immersiveModes';

// Views are route-split so startup only pays for the current screen.
const Discover = lazy(() => import('./views/Discover'));
const Search = lazy(() => import('./views/Search'));
const PlaylistDetail = lazy(() => import('./views/PlaylistDetail'));
const AlbumDetail = lazy(() => import('./views/AlbumDetail'));
const ArtistDetail = lazy(() => import('./views/ArtistDetail'));
const MVPlayer = lazy(() => import('./views/MVPlayer'));
const Leaderboards = lazy(() => import('./views/Leaderboards'));
const MyLiked = lazy(() => import('./views/MyLiked'));
const RecentlyPlayed = lazy(() => import('./views/RecentlyPlayed'));
const Settings = lazy(() => import('./views/Settings'));
const ModernHome = lazy(() => import('./views/ModernHome'));
const LocalMusic = lazy(() => import('./views/LocalMusic'));
import LyricAdjusterModal from './components/LyricAdjusterModal';
import LyricExportModal from './components/LyricExportModal';
import SleepTimerModal from './components/SleepTimerModal';
import EqualizerModal from './components/EqualizerModal';
import AudioMatchModal from './components/AudioMatchModal';
import { Button, IconButton, Switch, Slider, SegmentedControl, SegmentedControlItem } from './components/ui';
import { ChevronLeft, ChevronRight, X, Settings as SettingsIcon, Minus, Square, Dices, RotateCcw, RotateCw, Sparkles } from 'lucide-react';

function SettingSliderRow({ label, value, min, max, step = 1, onChange, unit = '', formatValue, style }) {
  const displayVal = formatValue ? formatValue(value) : `${value}${unit}`;
  return (
    <div className="setting-row-inline" style={style}>
      <span>{label}：{displayVal}</span>
      <div style={{ width: '130px', flexShrink: 0 }}>
        <Slider
          min={min}
          max={max}
          step={step}
          value={[Number(value)]}
          onValueChange={([val]) => onChange(val)}
        />
      </div>
    </div>
  );
}

function SettingSwitchRow({ label, checked, onChange, style }) {
  return (
    <div className="setting-row-inline" style={style}>
      <span>{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function AppContent() {
  const {
    currentView,
    goBack,
    goForward,
    canGoBack,
    canGoForward,
    currentSong,
    progress,
    isPlaying,
    audioElement,
    viewData,
    advancedLyricConfig,
    saveAdvancedLyricConfig,
    desktopLyricsConfig,
    saveDesktopLyricsConfig,
    mergeDesktopLyricsConfigFromIpc,
    layoutMode,
    shortcuts,
    togglePlay,
    playNext,
    playPrev,
    volume,
    setVolume,
    setPlayMode,
    playMode,
    likedSongIds,
    toggleLike,
    isLyricsOpen,
    setIsLyricsOpen,
    isQueueOpen,
    setIsQueueOpen,
    isEqualizerOpen,
    setIsEqualizerOpen,
    isAudioMatchOpen,
    setIsAudioMatchOpen,
    navigateTo,
    cacheConfig,
    colorMode,
    immersiveColor,
    updateInfo,
    setUpdateInfo,
    downloadUpdate,
    installUpdate
  } = useApp();
  const { engineRef, lyrics, activeLineIndex, lyricsSongId } = useLyricEngine(
    currentSong?.id,
    audioElement,
    currentSong,
    advancedLyricConfig?.lyricSources || 'amll,qq,kugou',
    cacheConfig
  );
  // The lyric fetch clears its state in an effect. During that one commit,
  // hide the previous song's stage instead of letting it flash over the new
  // cover while the next lyric payload is loading.
  const currentSongLyrics = currentSong?.id && String(lyricsSongId) === String(currentSong.id) ? lyrics : [];
  const listenState = useListenTogether();
  const playbackLocked = Boolean(listenState.roomId && !listenState.isHost);
  const guardedTogglePlay = useCallback(() => {
    if (!playbackLocked) togglePlay();
  }, [playbackLocked, togglePlay]);
  const guardedPlayNext = useCallback(() => {
    if (!playbackLocked) playNext();
  }, [playbackLocked, playNext]);
  const guardedPlayPrev = useCallback(() => {
    if (!playbackLocked) playPrev();
  }, [playbackLocked, playPrev]);

  // Keep native Windows controls in the same read-only state as the in-app
  // player. Renderer handlers remain guarded as a second line of defense.
  useEffect(() => {
    window.electronAPI?.setPlaybackControlsLocked?.(playbackLocked);
  }, [playbackLocked]);
  const [listenInvite, setListenInvite] = useState(null);
  const lastClipboardInviteRef = useRef('');

  useEffect(() => {
    const parseInvite = (text) => {
      const raw = String(text || '').trim();
      if (!raw || !/listenRoom=/i.test(raw)) return null;
      try {
        const url = new URL(raw);
        const roomId = url.searchParams.get('listenRoom');
        if (!roomId) return null;
        return { roomId, roomToken: url.searchParams.get('roomToken') || '', inviterId: url.searchParams.get('inviterId') || '' };
      } catch {
        const roomId = raw.match(/[?&]listenRoom=([^&\s]+)/i)?.[1];
        if (!roomId) return null;
        return { roomId: decodeURIComponent(roomId), roomToken: raw.match(/[?&]roomToken=([^&\s]+)/i)?.[1] || '', inviterId: raw.match(/[?&]inviterId=([^&\s]+)/i)?.[1] || '' };
      }
    };
    const readClipboard = async () => {
      const text = await (window.electronAPI?.readClipboardText ? window.electronAPI.readClipboardText().catch(() => '') : '');
      const invite = parseInvite(text);
      if (!invite || listenState.roomId === invite.roomId) return;
      const key = `${invite.roomId}:${invite.roomToken}:${invite.inviterId}`;
      if (lastClipboardInviteRef.current === key) return;
      lastClipboardInviteRef.current = key;
      setListenInvite(invite);
    };
    const timer = setInterval(readClipboard, 1200);
    readClipboard();
    return () => clearInterval(timer);
  }, [listenState.roomId]);


  const [isImmersiveSettingsOpen, setIsImmersiveSettingsOpen] = useState(false);
  const [immersiveSettingsTab, setImmersiveSettingsTab] = useState('lyrics');
  const [isLyricAdjusterOpen, setIsLyricAdjusterOpen] = useState(false);
  const [isSleepTimerOpen, setIsSleepTimerOpen] = useState(false);
  const [isLyricExportOpen, setIsLyricExportOpen] = useState(false);
  const [jizuraStatus, setJizuraStatus] = useState({ proposalCount: 1, activeStyle: 'noir', mood: '' });

  useEffect(() => {
    const handleStatusUpdate = (e) => {
      if (e.detail) {
        setJizuraStatus(prev => ({
          ...prev,
          ...e.detail
        }));
      }
    };
    window.addEventListener('jizura-status-update', handleStatusUpdate);
    return () => window.removeEventListener('jizura-status-update', handleStatusUpdate);
  }, []);

  const updateAdvancedLyricConfig = (patch) => {
    saveAdvancedLyricConfig({
      ...advancedLyricConfig,
      ...patch
    });
  };

  const currentLyricsMode = normalizeImmersiveMode(advancedLyricConfig?.lyricsMode);
  const currentKtvSongTemplate = advancedLyricConfig?.ktvSongTemplates?.[String(currentSong?.id)] || '';
  const ktvPresetPool = Array.isArray(advancedLyricConfig?.ktvPresetPool) ? advancedLyricConfig.ktvPresetPool : [];
  const legacyDedicatedBars = ['filmstrip'].includes(currentLyricsMode)
    && advancedLyricConfig?.visualizerStyleByMode?.[currentLyricsMode] === 'bars';
  const currentModeVisualizerStyle = (!legacyDedicatedBars && advancedLyricConfig?.visualizerStyleByMode?.[currentLyricsMode])
    || (advancedLyricConfig?.visualizerStyle && advancedLyricConfig.visualizerStyle !== 'bars'
      ? advancedLyricConfig.visualizerStyle
      : 'mode');
  const updateCurrentModeVisualizerStyle = (visualizerStyle) => {
    updateAdvancedLyricConfig({
      visualizerStyle,
      ...(currentLyricsMode === 'regular' && visualizerStyle === 'wave' ? { ringStyle: 'wave' } : {}),
      visualizerStyleByMode: {
        ...(advancedLyricConfig?.visualizerStyleByMode || {}),
        [currentLyricsMode]: visualizerStyle
      }
    });
  };

  const cachedImmersiveCoverUrl = useCachedCoverUrl(currentSong);
  const immersiveCoverUrl = cachedImmersiveCoverUrl || 'https://p2.music.126.net/UeTuwE7Cx877Y2gCGIseYg==/109951163026279185.jpg';
  const immersiveBgMode = advancedLyricConfig.backgroundMode || 'cover';
  const configuredBgBlur = advancedLyricConfig.backgroundBlur !== undefined ? advancedLyricConfig.backgroundBlur : 32;
  const bgBlur = Math.min(configuredBgBlur, 48);
  const immersiveBgStyle = useMemo(() => ({
    backgroundImage: immersiveBgMode === 'none' ? 'none' : `url(${immersiveCoverUrl})`,
    opacity: immersiveBgMode === 'cover' ? 1 : immersiveBgMode === 'soft' ? 0.55 : 0,
    filter: immersiveBgMode === 'soft'
      ? `blur(${bgBlur * 1.5}px) brightness(0.28) saturate(0.9)`
      : `blur(${bgBlur}px) brightness(0.4) saturate(1.2)`
  }), [immersiveBgMode, immersiveCoverUrl, bgBlur]);

  const routeKeyRef = useRef(`${currentView}:${viewData?.id || ''}`);
  useEffect(() => {
    const routeKey = `${currentView}:${viewData?.id || ''}`;
    if (routeKeyRef.current !== routeKey) {
      routeKeyRef.current = routeKey;
      setIsLyricsOpen(false);
      setIsImmersiveSettingsOpen(false);
    }
  }, [currentView, viewData?.id]);

  // Auto open desktop lyrics if config says show is true
  useEffect(() => {
    if (desktopLyricsConfig?.show) {
      window.electronAPI?.toggleDesktopLyrics?.();
    }
  }, []);

  // Send play/pause and media control icons to main process
  useEffect(() => {
    if (window.electronAPI) {
      const icons = generateMediaBase64Icons();
      window.electronAPI.initMediaIcons?.(icons);
    }
  }, []);

  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.updatePlaybackState?.(isPlaying);
    }
  }, [isPlaying]);

  useEffect(() => {
    if (!window.electronAPI) return;

    const unsubPrev = window.electronAPI.onMediaPrev(() => {
      guardedPlayPrev();
    });

    const unsubNext = window.electronAPI.onMediaNext(() => {
      guardedPlayNext();
    });

    const unsubToggle = window.electronAPI.onMediaTogglePlay(() => {
      guardedTogglePlay();
    });

    return () => {
      unsubPrev();
      unsubNext();
      unsubToggle();
    };
  }, [guardedPlayPrev, guardedPlayNext, guardedTogglePlay]);

  // Heartbeat sync for Desktop Lyrics (runs every 250ms when playing to prevent drift & freeze)
  useEffect(() => {
    if (!audioElement || !window.electronAPI?.sendLyricsUpdate || !desktopLyricsConfig?.show) return;

    const sendUpdate = () => {
      const timeSnapshot = audioElement.currentTime;
      const adjustedSnapshot = timeSnapshot + (advancedLyricConfig.globalOffset || 0);
      
      let effectiveActiveIndex = -1;
      if (lyrics && lyrics.length > 0) {
        for (let i = lyrics.length - 1; i >= 0; i--) {
          if (adjustedSnapshot >= lyrics[i].time) {
            effectiveActiveIndex = i;
            break;
          }
        }
      }

      const mediaClockReady = isPlaying
        && audioElement.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA
        && Number.isFinite(audioElement.duration)
        && audioElement.duration > 0
        && !audioElement.paused;
      window.electronAPI.sendLyricsUpdate({
        isPlaying: mediaClockReady,
        audioTime: adjustedSnapshot,
        systemTime: Date.now(),
        lines: lyrics || [], // Send full lyrics array for scrolling rail
        activeIndex: effectiveActiveIndex,
        globalOffset: 0,
        fullLyricsLength: lyrics ? lyrics.length : 0
      });
    };

    // Send immediate update
    sendUpdate();

    // Set interval for periodic updates
    const intervalId = setInterval(sendUpdate, 250);
    return () => clearInterval(intervalId);
  }, [isPlaying, currentSong, advancedLyricConfig.globalOffset, lyrics, audioElement, desktopLyricsConfig?.show]);
  // Synchronize state and lyrics to Island Mini Player
  useEffect(() => {
    if (!window.electronAPI?.sendMiniPlayerUpdate) return;

    const sendMiniUpdate = () => {
      const isLiked = Boolean(
        currentSong?.id && (
          (likedSongIds instanceof Set && (likedSongIds.has(currentSong.id) || likedSongIds.has(String(currentSong.id)) || likedSongIds.has(Number(currentSong.id))))
          || (Array.isArray(likedSongIds) && (likedSongIds.includes(currentSong.id) || likedSongIds.includes(String(currentSong.id)) || likedSongIds.includes(Number(currentSong.id))))
        )
      );
      const timeSnapshot = audioElement ? (audioElement.currentTime || 0) : progress;
      const adjustedSnapshot = timeSnapshot + (advancedLyricConfig?.globalOffset || 0);

      let effectiveActiveIndex = -1;
      if (lyrics && lyrics.length > 0) {
        for (let i = lyrics.length - 1; i >= 0; i -= 1) {
          if (adjustedSnapshot >= (lyrics[i].time || 0)) {
            effectiveActiveIndex = i;
            break;
          }
        }
      }

      window.electronAPI.sendMiniPlayerUpdate({
        isPlaying,
        currentSong,
        progress: timeSnapshot,
        duration: audioElement?.duration || (Number(currentSong?.durationMs || currentSong?.dt || 0) / 1000) || 0,
        volume,
        isLiked,
        lyrics: lyrics || [],
        activeLineIndex: effectiveActiveIndex,
        immersiveColor,
        colorMode
      });
    };
    sendMiniUpdate();
    const intervalId = setInterval(sendMiniUpdate, 300);
    return () => clearInterval(intervalId);
  }, [isPlaying, currentSong, progress, volume, likedSongIds, lyrics, audioElement, advancedLyricConfig?.globalOffset, immersiveColor, colorMode]);

  // Listen to Mini Player transport actions
  useEffect(() => {
    if (!window.electronAPI?.onMiniPlayerAction) return;

    const cleanup = window.electronAPI.onMiniPlayerAction(({ action, payload } = {}) => {
      if (action === 'toggle-play') {
        guardedTogglePlay();
      } else if (action === 'prev') {
        guardedPlayPrev();
      } else if (action === 'next') {
        guardedPlayNext();
      } else if (action === 'set-volume') {
        setVolume(Number(payload));
      } else if (action === 'toggle-like') {
        if (currentSong?.id) toggleLike(currentSong.id);
      }
    });

    return cleanup;
  }, [guardedTogglePlay, guardedPlayPrev, guardedPlayNext, setVolume, toggleLike, currentSong?.id]);



  // Sync Desktop Lyrics coordinates/config. Register IPC listeners once and always clean them up.
  useEffect(() => {
    const { windowX, windowY } = desktopLyricsConfig || {};
    if (windowX !== null && windowY !== null && windowX !== undefined && windowY !== undefined && window.electronAPI?.saveDesktopLyricsPosition) {
      window.electronAPI.saveDesktopLyricsPosition({ x: Number(windowX), y: Number(windowY) });
    }

    const cleanupFns = [];

    if (window.electronAPI?.onDesktopLyricsMoved) {
      const cleanup = window.electronAPI.onDesktopLyricsMoved((pos) => {
        mergeDesktopLyricsConfigFromIpc({ windowX: pos.x, windowY: pos.y });
        window.electronAPI.saveDesktopLyricsPosition?.(pos);
      });
      if (typeof cleanup === 'function') cleanupFns.push(cleanup);
    }

    if (window.electronAPI?.onDesktopLyricsVisibilityChange) {
      const cleanup = window.electronAPI.onDesktopLyricsVisibilityChange((visible) => {
        mergeDesktopLyricsConfigFromIpc({ show: visible });
      });
      if (typeof cleanup === 'function') cleanupFns.push(cleanup);
    }

    if (window.electronAPI?.onDesktopLyricsConfig) {
      const cleanup = window.electronAPI.onDesktopLyricsConfig((nextConfig) => {
        mergeDesktopLyricsConfigFromIpc(nextConfig || {});
      });
      if (typeof cleanup === 'function') cleanupFns.push(cleanup);
    }

    return () => cleanupFns.forEach((cleanup) => cleanup());
  }, [desktopLyricsConfig, mergeDesktopLyricsConfigFromIpc]);

  const shortcutsRef = useRef();
  shortcutsRef.current = {
    isLyricsOpen,
    shortcuts,
    volume,
    desktopLyricsConfig,
    audioElement,
    currentSong,
    playMode,
    layoutMode,
    playbackLocked
  };

  // Global keyboard shortcuts.
  useEffect(() => {
    const isTypingTarget = (target) => {
      const tag = target?.tagName?.toLowerCase();
      return tag === 'input' || tag === 'textarea' || tag === 'select' || target?.isContentEditable;
    };

    const handleKeyDown = (e) => {
      const {
        isLyricsOpen: currentIsLyricsOpen,
        shortcuts: currentShortcuts,
        volume: currentVolume,
        desktopLyricsConfig: currentDesktopLyricsConfig,
        audioElement: currentAudioElement,
        currentSong: currentCurrentSong,
        playMode: currentPlayMode,
        layoutMode: currentLayoutMode,
        playbackLocked: currentPlaybackLocked
      } = shortcutsRef.current;

      if (e.key === 'Escape' && currentIsLyricsOpen) {
        setIsLyricsOpen(false);
        return;
      }
      if (isTypingTarget(e.target)) return;
      if (currentShortcuts?.enabled === false) return;

      if (shortcutMatches(e, currentShortcuts?.playPause)) { guardedTogglePlay(); e.preventDefault(); }
      else if (shortcutMatches(e, currentShortcuts?.nextTrack)) { guardedPlayNext(); e.preventDefault(); }
      else if (shortcutMatches(e, currentShortcuts?.prevTrack)) { guardedPlayPrev(); e.preventDefault(); }
      else if (shortcutMatches(e, currentShortcuts?.volumeUp)) { setVolume(Math.min(1, currentVolume + 0.05)); e.preventDefault(); }
      else if (shortcutMatches(e, currentShortcuts?.volumeDown)) { setVolume(Math.max(0, currentVolume - 0.05)); e.preventDefault(); }
      else if (shortcutMatches(e, currentShortcuts?.toggleMute)) { setVolume(currentVolume > 0 ? 0 : 0.8); e.preventDefault(); }
      else if (shortcutMatches(e, currentShortcuts?.toggleLyrics)) { setIsLyricsOpen(open => !open); e.preventDefault(); }
      else if (shortcutMatches(e, currentShortcuts?.toggleDesktopLyrics)) {
        window.electronAPI?.toggleDesktopLyrics?.();
        saveDesktopLyricsConfig({ ...currentDesktopLyricsConfig, show: !currentDesktopLyricsConfig.show });
        e.preventDefault();
      }
      else if (shortcutMatches(e, currentShortcuts?.toggleSearch)) { navigateTo('search'); e.preventDefault(); }
      else if (shortcutMatches(e, currentShortcuts?.seekForward)) {
        if (!currentPlaybackLocked && currentAudioElement) currentAudioElement.currentTime = Math.min(currentAudioElement.duration || currentAudioElement.currentTime, currentAudioElement.currentTime + 5);
        e.preventDefault();
      }
      else if (shortcutMatches(e, currentShortcuts?.seekBack)) {
        if (!currentPlaybackLocked && currentAudioElement) currentAudioElement.currentTime = Math.max(0, currentAudioElement.currentTime - 5);
        e.preventDefault();
      }
      else if (shortcutMatches(e, currentShortcuts?.likeTrack)) { if (currentCurrentSong?.id) toggleLike(currentCurrentSong.id); e.preventDefault(); }
      else if (shortcutMatches(e, currentShortcuts?.cyclePlayMode)) {
        const modes = ['sequence', 'random', 'single', 'heart'];
        if (!currentPlaybackLocked) setPlayMode(modes[(modes.indexOf(currentPlayMode) + 1) % modes.length]);
        e.preventDefault();
      }
      else if (shortcutMatches(e, currentShortcuts?.goHome)) { navigateTo(currentLayoutMode === 'modern' ? 'home' : 'discover'); e.preventDefault(); }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    guardedTogglePlay, guardedPlayNext, guardedPlayPrev, setVolume, saveDesktopLyricsConfig, navigateTo, toggleLike, setPlayMode
  ]);

  // Render active view dynamically with stable element reference
  const viewComponent = useMemo(() => {
    switch (currentView) {
      case 'discover':
        return <Discover key="discover" />;
      case 'search':
        return <Search key="search" />;
      case 'playlist-detail':
        return <PlaylistDetail key={`playlist-${viewData?.id || 'none'}`} data={viewData} />;
      case 'album-detail':
        return <AlbumDetail key={`album-${viewData?.id || 'none'}`} data={viewData} />;
      case 'artist-detail':
        return <ArtistDetail key={`artist-${viewData?.id || 'none'}`} data={viewData} />;
      case 'mv-player':
        return <MVPlayer key={`mv-${viewData?.id || 'none'}`} data={viewData} />;
      case 'leaderboards':
        return <Leaderboards key="leaderboards" />;
      case 'liked':
        return <MyLiked key="liked" />;
      case 'recent':
        return <RecentlyPlayed key="recent" />;
      case 'settings':
        return <Settings key="settings" />;
      case 'home':
        return <ModernHome key="home" />;
      case 'local':
        return <LocalMusic key="local" />;
      case 'listen-together':
        return <ListenTogether key="listen-together" listenState={listenState} currentSong={currentSong} lyrics={lyrics} currentTime={progress} />;
      default:
        return layoutMode === 'modern' ? <ModernHome key="home" /> : <Discover key="discover" />;
    }
  }, [currentView, viewData, layoutMode, listenState, currentSong, lyrics, progress]);

  return (
    <div
      className={isLyricsOpen ? 'lyrics-open' : undefined}
      style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
    >
      {layoutMode !== 'modern' && <TopBar />}
      {layoutMode === 'modern' && <ModernTopControls />}
      <div className="app-container" style={{ flex: 1, overflow: 'hidden' }}>
        {/* Background Audio Node */}
        <AudioPlayer canControlPlayback={!playbackLocked} />
        
        {!isLyricsOpen && <>
        {/* Navigation Sidebar */}
        <Sidebar />

        {/* Main Workspace */}
        <main className={`app-main ${currentView === 'listen-together' ? 'listen-route-main' : ''}`}>
          {/* Navigation Controls in Header */}
          <header className="main-header">
            <div className="history-controls" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button 
                onClick={goBack} 
                disabled={!canGoBack}
                className="nav-arrow-btn"
                style={{
                  background: 'var(--glass-bg)',
                  border: '1px solid var(--card-border)',
                  color: canGoBack ? 'var(--text-main)' : 'var(--text-muted)',
                  width: '30px',
                  height: '30px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: canGoBack ? 'pointer' : 'not-allowed',
                  opacity: canGoBack ? 1 : 0.4,
                  transition: 'all 0.2s ease'
                }}
              >
                <ChevronLeft size={16} />
              </button>
              <button 
                onClick={goForward} 
                disabled={!canGoForward}
                className="nav-arrow-btn"
                style={{
                  background: 'var(--glass-bg)',
                  border: '1px solid var(--card-border)',
                  color: canGoForward ? 'var(--text-main)' : 'var(--text-muted)',
                  width: '30px',
                  height: '30px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: canGoForward ? 'pointer' : 'not-allowed',
                  opacity: canGoForward ? 1 : 0.4,
                  transition: 'all 0.2s ease'
                }}
              >
                <ChevronRight size={16} />
              </button>
            </div>
            
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '1px' }}>
              {currentView.toUpperCase().replace('-', ' ')}
            </div>
          </header>
          
          {/* View Component Wrapper */}
          <div className="view-scroll-container" style={{ flex: 1, height: '100%', overflowY: (currentView === 'listen-together' || (layoutMode === 'modern' && (currentView === 'home' || currentView === 'settings' || !currentView))) ? 'hidden' : 'auto' }}>
            <Suspense fallback={<div style={{ height: '100%', display: 'grid', placeItems: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Loading...</div>}>
              {viewComponent}
            </Suspense>
          </div>
        </main>
        </>}

        {isLyricsOpen && <div className="lyrics-immersive-hover-sensor" aria-hidden="true" />}

        {/* Bottom Playback Control Bar
            Keep the bar mounted while immersive lyrics/PV is open. The PV
            overlay temporarily moves it off-screen and the bottom hover
            sensor brings it back; unmounting it here made the sensor a no-op. */}
        {layoutMode !== 'modern' && (
          <PlayerBar
            onToggleLyrics={() => setIsLyricsOpen(!isLyricsOpen)}
            isLyricsOpen={isLyricsOpen}
            lyrics={lyrics}
            playbackLocked={playbackLocked}
          />
        )}
        {layoutMode === 'modern' && <ModernPlayerBar onToggleLyrics={() => setIsLyricsOpen(!isLyricsOpen)} lyrics={lyrics} playbackLocked={playbackLocked} />}


        <ListenInvitePrompt
          invite={listenInvite}
          onDismiss={() => setListenInvite(null)}
          onJoin={async () => {
            const joined = await listenState.joinRoom(listenInvite.roomId, listenInvite.inviterId, listenInvite.roomToken);
            if (joined) navigateTo('listen-together');
            setListenInvite(null);
          }}
        />

        {/* Full Screen Interactive Lyrics Overlay (Monet Mode) */}
        {isLyricsOpen && (
          <div 
            className={`lyrics-overlay lyrics-overlay--${currentLyricsMode}`}
            role="dialog" 
            aria-modal="true" 
            aria-label="沉浸式歌词"
            style={{
              '--primary': immersiveColor || 'var(--primary)',
              '--primary-glow': `${immersiveColor || 'var(--primary)'}59`,
              '--primary-subtle': `${immersiveColor || 'var(--primary)'}1a`
            }}
          >
            {currentLyricsMode !== 'talk' && (
              <>
                <div
                  className="lyrics-overlay-bg"
                  style={immersiveBgStyle}
                />
                <div className="lyrics-overlay-wash" />
              </>
            )}

            {advancedLyricConfig.showDecor === true && currentLyricsMode !== 'talk' && (
              <MonetFloatingDecor isPlaying={isPlaying} currentSong={currentSong} advancedLyricConfig={advancedLyricConfig} />
            )}

            {/* Custom window control buttons for Modern Layout Immersive View */}
            {layoutMode === 'modern' && (
              <div className="desktop-window-controls" style={{ position: 'absolute', top: '14px', right: '16px', zIndex: 1300, display: 'flex', gap: '8px' }}>
                <button className="desktop-window-btn" onClick={() => window.electronAPI?.minimize?.()} title="最小化">
                  <Minus size={16} />
                </button>
                <button className="desktop-window-btn" onClick={() => window.electronAPI?.maximize?.()} title="最大化">
                  <Square size={14} />
                </button>
                <button className="desktop-window-btn close" onClick={() => window.electronAPI?.close?.()} title="关闭">
                  <X size={18} />
                </button>
              </div>
            )}

            <div className="lyrics-overlay-content">
              <ErrorBoundary>
                <LyricsView engineRef={engineRef} lyrics={currentSongLyrics} activeLineIndex={activeLineIndex} coverUrl={immersiveCoverUrl} />
              </ErrorBoundary>
            </div>

            <button
              className="immersive-settings-btn"
              onClick={() => setIsImmersiveSettingsOpen((open) => !open)}
              title="沉浸式歌词设置"
              aria-label="沉浸式歌词设置"
              style={{ right: layoutMode === 'modern' ? '70px' : '64px' }} // shift slightly if custom window controls exist
            >
              <SettingsIcon size={18} />
            </button>

            <button
              className="immersive-close-btn"
              onClick={() => setIsLyricsOpen(false)}
              title="退出沉浸式歌词"
              aria-label="退出沉浸式歌词"
              style={{ right: layoutMode === 'modern' ? '120px' : '16px' }} // shift to avoid overlap with window controls
            >
              <X size={20} />
            </button>
          </div>
        )}

        {isLyricsOpen && isImmersiveSettingsOpen && (
          <div className="immersive-settings-panel immersive-settings-panel-wide" style={{ maxHeight: 'calc(100vh - 160px)', backdropFilter: 'blur(30px)', WebkitBackdropFilter: 'blur(30px)', display: 'flex', flexDirection: 'column', overflow: 'hidden', zIndex: 9999 }}>
                <div className="immersive-settings-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '1px solid var(--divider-color)' }}>
                  <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700 }}>沉浸式歌词设置</h3>
                  <IconButton
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsImmersiveSettingsOpen(false)}
                    label="关闭设置"
                  >
                    <X size={16} />
                  </IconButton>
                </div>
                
                {/* Tab Row */}
                <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--divider-color)', background: 'var(--surface-sunken)' }}>
                  <SegmentedControl
                    value={immersiveSettingsTab}
                    onValueChange={(val) => { if (val) setImmersiveSettingsTab(val); }}
                    size="sm"
                    style={{ width: '100%', display: 'flex' }}
                  >
                    <SegmentedControlItem value="lyrics" style={{ flex: 1 }}>歌词样式</SegmentedControlItem>
                    <SegmentedControlItem value="background" style={{ flex: 1 }}>背景/封面</SegmentedControlItem>
                    <SegmentedControlItem value="visualizer" style={{ flex: 1 }}>音频可视化</SegmentedControlItem>
                  </SegmentedControl>
                </div>

                <div className="immersive-settings-body" style={{ flex: 1, overflowY: 'auto', padding: '16px 18px' }}>
                  {immersiveSettingsTab === 'lyrics' && (
                    <div className="immersive-settings-section" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <label className="setting-row-inline">
                        <span>动画模式</span>
                        <select className="setting-select" value={normalizeImmersiveMode(advancedLyricConfig.lyricsMode)} onChange={(e) => updateAdvancedLyricConfig({ lyricsMode: e.target.value })}>
                          {IMMERSIVE_MODE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                        </select>
                      </label>
                      <label className="setting-row-inline">
                        <span>沉浸式配色</span>
                        <select className="setting-select" value={advancedLyricConfig.colorPreference || 'warm'}
                          onChange={(e) => updateAdvancedLyricConfig({ colorPreference: e.target.value })}>
                          <option value="warm">自适应暖色</option>
                          <option value="cold">自适应冷色</option>
                          <option value="original">专辑原色</option>
                        </select>
                      </label>
                      <label className="setting-row-inline">
                        <span>歌词来源</span>
                        <select className="setting-select" value={advancedLyricConfig.lyricSources || 'amll,qq,kugou'}
                          onChange={(e) => updateAdvancedLyricConfig({ lyricSources: e.target.value })}>
                          <option value="amll,qq,kugou">自动：时长匹配 + 逐字优先</option>
                          <option value="netease">网易云原始歌词</option>
                          <option value="amll">AMLL TTML 逐字</option>
                          <option value="qq">QQ 音乐逐字</option>
                          <option value="kugou">酷狗逐字</option>
                          <option value="qq,kugou">QQ / 酷狗逐字</option>
                        </select>
                      </label>

                      <div style={{ margin: '4px 0 8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <Button
                          type="button"
                          variant="subtle"
                          size="sm"
                          block
                          onClick={() => setIsLyricExportOpen(true)}
                        >
                          📤 导出歌词 (LRC / 双语 / 逐字 / TXT)
                        </Button>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            style={{ flex: 1 }}
                            onClick={() => setIsLyricAdjusterOpen(true)}
                          >
                            ⚡ 歌词微调 / 换源
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setIsSleepTimerOpen(true)}
                          >
                            🌙 睡眠定时
                          </Button>
                        </div>
                      </div>

                      <div className="setting-row-inline">
                        <span>歌词时间偏移：{Number(advancedLyricConfig.globalOffset || 0).toFixed(2)} 秒</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Button 
                            variant="outline" 
                            size="xs"
                            onClick={() => updateAdvancedLyricConfig({ globalOffset: (Number(advancedLyricConfig.globalOffset) || 0) - 0.5 })}
                          >-0.5s</Button>
                          <div style={{ width: '110px' }}>
                            <Slider
                              min={-3}
                              max={3}
                              step={0.05}
                              value={[Number(advancedLyricConfig.globalOffset || 0)]}
                              onValueChange={([val]) => updateAdvancedLyricConfig({ globalOffset: Number(val) })}
                            />
                          </div>
                          <Button 
                            variant="outline" 
                            size="xs"
                            onClick={() => updateAdvancedLyricConfig({ globalOffset: (Number(advancedLyricConfig.globalOffset) || 0) + 0.5 })}
                          >+0.5s</Button>
                        </div>
                      </div>

                      <SettingSwitchRow
                        label="显示歌词翻译"
                        checked={advancedLyricConfig.showTranslation !== false}
                        onChange={(checked) => updateAdvancedLyricConfig({ showTranslation: checked, ktvShowTranslation: checked })}
                      />

                      <SettingSwitchRow
                        label="显示假名注音（ルビ）"
                        checked={advancedLyricConfig.showFurigana !== false}
                        onChange={(checked) => updateAdvancedLyricConfig({ showFurigana: checked })}
                      />

                      {/* ================= PV 歌词 (talk) 专属设置 ================= */}
                      {advancedLyricConfig.lyricsMode === 'talk' && (
                        <>
                          {/* JIZURA おまかせ (Omakase) 分镜重混与控制中心 */}
                          <div style={{
                            background: 'var(--surface-sunken)',
                            border: '1px solid var(--card-border)',
                            borderRadius: 'var(--radius-lg, 12px)',
                            padding: '14px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '10px'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Sparkles size={14} style={{ color: 'var(--primary)' }} />
                                <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)' }}>JIZURA PV 智能重混</span>
                              </div>
                              <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: 'var(--radius-full, 9999px)', background: 'var(--primary-subtle)', color: 'var(--primary)', fontWeight: 600 }}>
                                案 #{jizuraStatus.proposalCount || 1} {jizuraStatus.mood ? `· ${jizuraStatus.mood}` : ''}
                              </span>
                            </div>

                            {/* 一键おまかせ 大按钮 */}
                            <Button
                              type="button"
                              variant="primary"
                              size="md"
                              block
                              onClick={() => {
                                window.dispatchEvent(new CustomEvent('jizura-action', { detail: { action: 'omakase' } }));
                              }}
                            >
                              <Dices size={16} />
                              <span>🎲 おまかせ 一键重混分镜 (快捷键 R)</span>
                            </Button>

                            {/* 方案历史步进 */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                style={{ flex: 1 }}
                                onClick={() => {
                                  window.dispatchEvent(new CustomEvent('jizura-action', { detail: { action: 'undo' } }));
                                }}
                                title="回退到上一个分镜案"
                              >
                                <RotateCcw size={13} />
                                <span>上一案</span>
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                style={{ flex: 1 }}
                                onClick={() => {
                                  window.dispatchEvent(new CustomEvent('jizura-action', { detail: { action: 'redo' } }));
                                }}
                                title="前进到下一个分镜案"
                              >
                                <RotateCw size={13} />
                                <span>下一案</span>
                              </Button>
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '4px' }}>
                            <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)' }}>PV 模板速选</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <select className="setting-select" value={advancedLyricConfig.ktvPreset || 'auto'}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  const nextPatch = { ktvPreset: val };
                                  if (currentSong?.id && advancedLyricConfig?.ktvSongTemplates?.[String(currentSong.id)]) {
                                    nextPatch.ktvSongTemplates = {
                                      ...(advancedLyricConfig.ktvSongTemplates || {}),
                                      [String(currentSong.id)]: val
                                    };
                                  }
                                  updateAdvancedLyricConfig(nextPatch);
                                  window.dispatchEvent(new CustomEvent('jizura-action', { detail: { action: 'setStyle', style: val } }));
                                }}>
                                <option value="auto">自动：智能匹配封面色彩</option>
                                <option value="multi">多选：随机轮播风格池</option>
                                {(Array.isArray(JIZURA_GALLERY_STYLES) ? JIZURA_GALLERY_STYLES : []).map(s => (
                                  <option key={s.key} value={s.key}>{s.name} ({s.en}) · {s.tag}</option>
                                ))}
                              </select>
                            </div>
                          </div>

                          {/* JIZURA 现代视觉卡片列表 */}
                          <div aria-label="PV 模板速选" style={{ maxHeight: '260px', overflowY: 'auto', paddingRight: '4px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            {(Array.isArray(JIZURA_GALLERY_STYLES) ? JIZURA_GALLERY_STYLES : []).map((styleItem) => {
                              const value = styleItem.key;
                              const selected = (advancedLyricConfig.ktvPreset || 'auto') === value || jizuraStatus.activeStyle === value;
                              return (
                                <div
                                  key={value}
                                  onClick={() => {
                                    const nextPatch = { ktvPreset: value };
                                    if (currentSong?.id && advancedLyricConfig?.ktvSongTemplates?.[String(currentSong.id)]) {
                                      nextPatch.ktvSongTemplates = {
                                        ...(advancedLyricConfig.ktvSongTemplates || {}),
                                        [String(currentSong.id)]: value
                                      };
                                    }
                                    updateAdvancedLyricConfig(nextPatch);
                                    window.dispatchEvent(new CustomEvent('jizura-action', { detail: { action: 'setStyle', style: value } }));
                                  }}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '10px',
                                    padding: '8px 12px',
                                    borderRadius: 'var(--radius-md, 8px)',
                                    background: selected ? 'var(--primary-subtle)' : 'var(--glass-bg)',
                                    border: selected ? '1.5px solid var(--primary)' : '1px solid var(--card-border)',
                                    cursor: 'pointer',
                                    transition: 'all 0.15s ease'
                                  }}
                                >
                                  {/* 缩略图色块 */}
                                  <div style={{
                                    width: '60px',
                                    height: '32px',
                                    borderRadius: 'var(--radius-sm, 6px)',
                                    background: styleItem.gradient,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0,
                                    fontSize: '10px',
                                    fontWeight: 700,
                                    color: styleItem.textColor || '#fff'
                                  }}>
                                    {styleItem.en || 'PV'}
                                  </div>

                                  {/* 模板信息与风格标签 */}
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                                      <span style={{ fontSize: '12px', fontWeight: 700, color: selected ? 'var(--primary)' : 'var(--text-main)' }}>
                                        {styleItem.name}
                                      </span>
                                      <span style={{ fontSize: '9px', padding: '1px 5px', borderRadius: '4px', background: 'var(--glass-bg-hover)', color: 'var(--text-muted)' }}>
                                        {styleItem.tag}
                                      </span>
                                    </div>
                                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                      {styleItem.desc}
                                    </div>
                                  </div>

                                  {/* 调色盘预览点与状态 */}
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                                    {Array.isArray(styleItem.palette) && styleItem.palette.slice(0, 3).map((c, i) => (
                                      <span key={i} style={{ width: '8px', height: '8px', borderRadius: '50%', background: c, border: '1px solid var(--card-border)' }} />
                                    ))}
                                    <span style={{
                                      marginLeft: '6px',
                                      fontSize: '10px',
                                      padding: '3px 8px',
                                      borderRadius: 'var(--radius-sm, 6px)',
                                      background: selected ? 'var(--primary)' : 'var(--glass-bg)',
                                      color: selected ? '#fff' : 'var(--text-muted)',
                                      fontWeight: 600
                                    }}>
                                      {selected ? '使用中' : '应用'}
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          {advancedLyricConfig.ktvPreset === 'multi' && (
                            <div style={{ padding: '10px 12px', border: '1px solid var(--card-border)', borderRadius: 'var(--radius-md, 8px)', background: 'var(--surface-sunken)' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', marginBottom: '8px', color: 'var(--text-muted)', fontSize: '11px' }}>
                                <span>选择参与随机切换的模板（至少 2 个）</span>
                                <b style={{ color: ktvPresetPool.length >= 2 ? 'var(--primary)' : '#ffbd69' }}>{ktvPresetPool.length} 个</b>
                              </div>
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '6px 10px', maxHeight: '160px', overflowY: 'auto' }}>
                                {(Array.isArray(JIZURA_GALLERY_STYLES) ? JIZURA_GALLERY_STYLES : []).map((s) => {
                                  const value = s.key;
                                  const label = s.name;
                                  const pool = Array.isArray(ktvPresetPool) ? ktvPresetPool : [];
                                  const checked = pool.includes(value);
                                  return (
                                    <label key={`multi-${value}`} style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0, color: checked ? 'var(--primary)' : 'var(--text-muted)', fontSize: '11px', cursor: 'pointer' }}>
                                      <input type="checkbox" checked={checked} onChange={() => {
                                        const next = checked ? pool.filter(item => item !== value) : [...pool, value];
                                        updateAdvancedLyricConfig({ ktvPresetPool: next });
                                      }} />
                                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
                                    </label>
                                  );
                                })}
                              </div>
                              {ktvPresetPool.length < 2 && <div style={{ marginTop: '6px', color: '#ffbd69', fontSize: '11px' }}>选择两个或更多模板后才会随机切换。</div>}
                            </div>
                          )}

                          {currentSong?.id && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', border: '1px solid var(--card-border)', borderRadius: 'var(--radius-md, 8px)', background: 'var(--surface-sunken)' }}>
                              <span style={{ minWidth: 0, flex: 1, color: currentKtvSongTemplate ? 'var(--primary)' : 'var(--text-muted)', fontSize: '11px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {currentKtvSongTemplate ? `本曲已锁定：${JIZURA_GALLERY_STYLES.find(s => s.key === currentKtvSongTemplate)?.name || KTV_TEMPLATE_GALLERY.find(([value]) => value === currentKtvSongTemplate)?.[1] || currentKtvSongTemplate}` : '本曲跟随全局 / 智能生成风格'}
                              </span>
                              {currentKtvSongTemplate ? (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="xs"
                                  onClick={() => {
                                    const next = { ...(advancedLyricConfig.ktvSongTemplates || {}) };
                                    delete next[String(currentSong.id)];
                                    updateAdvancedLyricConfig({ ktvSongTemplates: next });
                                  }}
                                >
                                  恢复自动
                                </Button>
                              ) : (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="xs"
                                  disabled={(advancedLyricConfig.ktvPreset || 'auto') === 'auto'}
                                  onClick={() => updateAdvancedLyricConfig({ ktvSongTemplates: { ...(advancedLyricConfig.ktvSongTemplates || {}), [String(currentSong.id)]: advancedLyricConfig.ktvPreset } })}
                                >
                                  锁定本曲
                                </Button>
                              )}
                            </div>
                          )}

                          <SettingSwitchRow
                            label="显示歌词译文 (底部半透明胶囊)"
                            checked={advancedLyricConfig.ktvShowTranslation !== false && advancedLyricConfig.showTranslation !== false}
                            onChange={(checked) => updateAdvancedLyricConfig({ ktvShowTranslation: checked, showTranslation: checked })}
                          />

                          <SettingSliderRow
                            label="动画速度"
                            value={advancedLyricConfig.ktvSpeed ?? 2.0}
                            min={0.2}
                            max={4.0}
                            step={0.1}
                            unit="x"
                            formatValue={(v) => `${Number(v).toFixed(1)}x`}
                            onChange={(val) => updateAdvancedLyricConfig({ ktvSpeed: val })}
                          />

                          <SettingSliderRow
                            label="动效强度"
                            value={advancedLyricConfig.ktvMotion ?? 1.0}
                            min={0.1}
                            max={2.0}
                            step={0.1}
                            unit="x"
                            formatValue={(v) => `${Number(v).toFixed(1)}x`}
                            onChange={(val) => updateAdvancedLyricConfig({ ktvMotion: val })}
                          />

                          <SettingSliderRow
                            label="背景不透明度"
                            value={advancedLyricConfig.ktvBgOpacity ?? 1.0}
                            min={0}
                            max={1}
                            step={0.05}
                            formatValue={(v) => `${Math.round(Number(v) * 100)}%`}
                            onChange={(val) => updateAdvancedLyricConfig({ ktvBgOpacity: val })}
                          />

                          <SettingSwitchRow
                            label="显示歌曲开场标题卡"
                            checked={advancedLyricConfig.ktvShowTitleCard !== false}
                            onChange={(checked) => updateAdvancedLyricConfig({ ktvShowTitleCard: checked })}
                          />

                          <SettingSwitchRow
                            label="混合专辑封面光影底图"
                            checked={advancedLyricConfig.ktvUseCoverTexture !== false}
                            onChange={(checked) => updateAdvancedLyricConfig({ ktvUseCoverTexture: checked })}
                          />

                          <SettingSliderRow
                            label="纸质与噪点肌理"
                            value={advancedLyricConfig.jizuraTexture ?? 0.6}
                            min={0}
                            max={1.5}
                            step={0.05}
                            formatValue={(v) => `${Math.round(Number(v) * 100)}%`}
                            onChange={(val) => updateAdvancedLyricConfig({ jizuraTexture: val })}
                          />

                          <SettingSliderRow
                            label="故障与色差强度"
                            value={advancedLyricConfig.jizuraGlitch ?? 0.55}
                            min={0}
                            max={1.5}
                            step={0.05}
                            formatValue={(v) => `${Math.round(Number(v) * 100)}%`}
                            onChange={(val) => updateAdvancedLyricConfig({ jizuraGlitch: val })}
                          />
                        </>
                      )}

                      {/* ================= 常规滚动模式 (regular) 专属设置 ================= */}
                      {advancedLyricConfig.lyricsMode === 'regular' && (
                        <>
                          <SettingSliderRow
                            label="歌词字号"
                            value={advancedLyricConfig.fontSize || 25}
                            min={18}
                            max={52}
                            unit="px"
                            onChange={(val) => updateAdvancedLyricConfig({ fontSize: val })}
                          />
                          <SettingSliderRow
                            label="显示行数"
                            value={advancedLyricConfig.visibleLines || 5}
                            min={1}
                            max={9}
                            step={2}
                            unit=" 行"
                            onChange={(val) => updateAdvancedLyricConfig({ visibleLines: val })}
                          />
                          <div className="setting-row-inline">
                            <span>歌词纵向位置：{advancedLyricConfig.lyricsPositionY ?? 50}% {((advancedLyricConfig.lyricsPositionY ?? 50) === 50) ? '(垂直居中)' : ''}</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0, justifyContent: 'flex-end' }}>
                              <div style={{ flex: 1, maxWidth: '140px' }}>
                                <Slider
                                  min={20}
                                  max={80}
                                  value={[Number(advancedLyricConfig.lyricsPositionY ?? 50)]}
                                  onValueChange={([val]) => updateAdvancedLyricConfig({ lyricsPositionY: Number(val) })}
                                />
                              </div>
                              {(advancedLyricConfig.lyricsPositionY ?? 50) !== 50 && (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="xs"
                                  onClick={() => updateAdvancedLyricConfig({ lyricsPositionY: 50 })}
                                  title="重置为垂直居中(50%)"
                                >
                                  恢复居中
                                </Button>
                              )}
                            </div>
                          </div>
                          <label className="setting-row-inline">
                            <span>顶部标题字体</span>
                            <select className="setting-select" value={advancedLyricConfig.titleFontFamily || 'Outfit'}
                              onChange={(e) => updateAdvancedLyricConfig({ titleFontFamily: e.target.value })}>
                              <option value="Inter">Inter / 思源黑体</option>
                              <option value="Outfit">Outfit 标题字体</option>
                              <option value="Noto Serif SC">思源宋体</option>
                              <option value="Microsoft YaHei">微软雅黑</option>
                              <option value="KaiTi">楷体</option>
                            </select>
                          </label>
                          <label className="setting-row-inline">
                            <span>滚动歌词字体</span>
                            <select className="setting-select" value={advancedLyricConfig.fontFamily || 'Inter'}
                              onChange={(e) => updateAdvancedLyricConfig({ fontFamily: e.target.value })}>
                              <option value="Inter">Inter / 思源黑体</option>
                              <option value="Outfit">Outfit 标题字体</option>
                              <option value="Noto Serif SC">思源宋体</option>
                              <option value="Microsoft YaHei">微软雅黑</option>
                              <option value="KaiTi">楷体</option>
                            </select>
                          </label>
                          <SettingSwitchRow
                            label="歌词辉光效果"
                            checked={advancedLyricConfig.showGlow === true}
                            onChange={(checked) => updateAdvancedLyricConfig({ showGlow: checked })}
                          />
                          <SettingSliderRow
                            label="歌词辉光强度"
                            value={advancedLyricConfig.lyricGlowIntensity ?? 1}
                            min={0}
                            max={2}
                            step={0.1}
                            unit="x"
                            formatValue={(v) => `${Number(v).toFixed(1)}x`}
                            onChange={(val) => updateAdvancedLyricConfig({ lyricGlowIntensity: val })}
                          />
                          <SettingSliderRow
                            label="非活动歌词模糊度"
                            value={advancedLyricConfig.inactiveLyricBlur !== undefined ? advancedLyricConfig.inactiveLyricBlur : 0.4}
                            min={0}
                            max={3.0}
                            step={0.2}
                            formatValue={(v) => Number(v).toFixed(1)}
                            onChange={(val) => updateAdvancedLyricConfig({ inactiveLyricBlur: val })}
                          />
                        </>
                      )}

                      {/* ================= 气泡模式 (streamer) 专属设置 ================= */}
                      {advancedLyricConfig.lyricsMode === 'streamer' && (
                        <>
                          <SettingSliderRow
                            label="歌词字号"
                            value={advancedLyricConfig.fontSize || 25}
                            min={18}
                            max={52}
                            unit="px"
                            onChange={(val) => updateAdvancedLyricConfig({ fontSize: val })}
                          />
                          <label className="setting-row-inline">
                            <span>气泡对齐方式</span>
                            <select className="setting-select" value={advancedLyricConfig.bubbleAlign || 'alternate'}
                              onChange={(e) => updateAdvancedLyricConfig({ bubbleAlign: e.target.value })}>
                              <option value="alternate">交替对话</option>
                              <option value="left">全左对齐</option>
                              <option value="right">全右对齐</option>
                            </select>
                          </label>
                        </>
                      )}

                      {/* ================= 云阶模式 (cloudstep) 专属设置 ================= */}
                      {advancedLyricConfig.lyricsMode === 'cloudstep' && (
                        <>
                          <SettingSliderRow
                            label="歌词字号"
                            value={advancedLyricConfig.fontSize || 25}
                            min={18}
                            max={52}
                            unit="px"
                            onChange={(val) => updateAdvancedLyricConfig({ fontSize: val })}
                          />
                          <SettingSliderRow
                            label="云阶行间距"
                            value={advancedLyricConfig.cloudStepSpacing || 1}
                            min={0.5}
                            max={3}
                            step={0.1}
                            formatValue={(v) => Number(v).toFixed(1)}
                            onChange={(val) => updateAdvancedLyricConfig({ cloudStepSpacing: val })}
                          />
                        </>
                      )}

                      {/* ================= 黑胶光碟 (vinyl) 专属设置 ================= */}
                      {advancedLyricConfig.lyricsMode === 'vinyl' && (
                        <>
                          <SettingSliderRow
                            label="歌词字号"
                            value={advancedLyricConfig.fontSize || 25}
                            min={18}
                            max={52}
                            unit="px"
                            onChange={(val) => updateAdvancedLyricConfig({ fontSize: val })}
                          />
                          <SettingSliderRow
                            label="黑胶倾斜角度"
                            value={advancedLyricConfig.vinylTiltAngle ?? 0}
                            min={0}
                            max={60}
                            step={5}
                            unit="°"
                            onChange={(val) => updateAdvancedLyricConfig({ vinylTiltAngle: val })}
                          />
                          <SettingSliderRow
                            label="黑胶行间距"
                            value={advancedLyricConfig.vinylLineSpacing ?? 0.7}
                            min={0.5}
                            max={2.5}
                            step={0.1}
                            formatValue={(v) => Number(v).toFixed(1)}
                            onChange={(val) => updateAdvancedLyricConfig({ vinylLineSpacing: val })}
                          />
                        </>
                      )}

                      {/* ================= 胶片模式 (filmstrip) 专属设置 ================= */}
                      {advancedLyricConfig.lyricsMode === 'filmstrip' && (
                        <>
                          <SettingSliderRow
                            label="歌词字号"
                            value={advancedLyricConfig.fontSize || 25}
                            min={18}
                            max={52}
                            unit="px"
                            onChange={(val) => updateAdvancedLyricConfig({ fontSize: val })}
                          />
                          <SettingSliderRow
                            label="胶片帧间距"
                            value={advancedLyricConfig.filmFrameGap ?? 18}
                            min={8}
                            max={48}
                            step={2}
                            unit="px"
                            onChange={(val) => updateAdvancedLyricConfig({ filmFrameGap: val })}
                          />
                          <SettingSliderRow
                            label="非当前帧透明度"
                            value={advancedLyricConfig.filmOpacity ?? 0.22}
                            min={0.05}
                            max={0.5}
                            step={0.05}
                            formatValue={(v) => `${Math.round(Number(v) * 100)}%`}
                            onChange={(val) => updateAdvancedLyricConfig({ filmOpacity: val })}
                          />
                          <SettingSliderRow
                            label="当前帧放大"
                            value={advancedLyricConfig.filmActiveScale ?? 1.08}
                            min={1}
                            max={1.2}
                            step={0.01}
                            formatValue={(v) => `${Math.round(Number(v) * 100)}%`}
                            onChange={(val) => updateAdvancedLyricConfig({ filmActiveScale: val })}
                          />
                        </>
                      )}

                      {/* ================= 空间画布 (spatial) 专属设置 ================= */}
                      {advancedLyricConfig.lyricsMode === 'spatial' && (
                        <>
                          <SettingSliderRow
                            label="歌词字号"
                            value={advancedLyricConfig.fontSize || 25}
                            min={18}
                            max={52}
                            unit="px"
                            onChange={(val) => updateAdvancedLyricConfig({ fontSize: val })}
                          />
                        </>
                      )}

                      {/* ================= 背景微粒装饰 ================= */}
                      <SettingSwitchRow
                        label="背景悬浮微粒 (Floating decor)"
                        checked={advancedLyricConfig.showDecor === true}
                        onChange={(checked) => updateAdvancedLyricConfig({ showDecor: checked })}
                      />
                    </div>
                  )}

                  {immersiveSettingsTab === 'background' && (
                    <div className="immersive-settings-section" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <label className="setting-row-inline">
                        <span>背景模式</span>
                        <select className="setting-select" value={advancedLyricConfig.backgroundMode || 'cover'}
                          onChange={(e) => updateAdvancedLyricConfig({ backgroundMode: e.target.value })}>
                          <option value="cover">模糊封面</option>
                          <option value="soft">柔和封面</option>
                          <option value="theme">主题渐变</option>
                          <option value="none">纯净背景</option>
                        </select>
                      </label>
                      <SettingSwitchRow
                        label="显示专辑封面"
                        checked={advancedLyricConfig.showCover !== false}
                        onChange={(checked) => updateAdvancedLyricConfig({ showCover: checked })}
                      />
                      <SettingSliderRow
                        label="背景模糊度"
                        value={advancedLyricConfig.backgroundBlur !== undefined ? advancedLyricConfig.backgroundBlur : 32}
                        min={0}
                        max={60}
                        step={2}
                        unit="px"
                        onChange={(val) => updateAdvancedLyricConfig({ backgroundBlur: val })}
                      />
                    </div>
                  )}

                  {immersiveSettingsTab === 'visualizer' && (
                    <div className="immersive-settings-section" style={{ overflowY: 'auto', maxHeight: '380px', paddingRight: '4px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <label className="setting-row-inline">
                        <span>波形样式</span>
                        <select className="setting-select" value={currentModeVisualizerStyle}
                          onChange={(e) => updateCurrentModeVisualizerStyle(e.target.value)}>
                          <option value="mode">跟随当前模式</option>
                          <option value="bars">底部律动</option>
                          <option value="wave">流动波形</option>
                          <option value="circle">环形脉冲</option>
                          <option value="off">关闭</option>
                        </select>
                      </label>
                      <SettingSwitchRow
                        label="启用音频可视化"
                        checked={advancedLyricConfig.visualizerEnabled !== false}
                        onChange={(checked) => updateAdvancedLyricConfig({ visualizerEnabled: checked })}
                      />
                      <SettingSliderRow
                        label="可视化强度"
                        value={advancedLyricConfig.visualizerIntensity ?? 1}
                        min={0.2}
                        max={2.5}
                        step={0.1}
                        unit="x"
                        formatValue={(v) => `${Number(v).toFixed(1)}x`}
                        onChange={(val) => updateAdvancedLyricConfig({ visualizerIntensity: val })}
                      />
                      <SettingSliderRow
                        label="可视化不透明度"
                        value={advancedLyricConfig.visualizerOpacity ?? 0.82}
                        min={0.1}
                        max={1}
                        step={0.05}
                        formatValue={(v) => `${Math.round(Number(v) * 100)}%`}
                        onChange={(val) => updateAdvancedLyricConfig({ visualizerOpacity: val })}
                      />
                      <SettingSliderRow
                        label="频谱平滑"
                        value={advancedLyricConfig.visualizerSmoothing ?? 0.16}
                        min={0.04}
                        max={0.8}
                        step={0.02}
                        formatValue={(v) => Number(v).toFixed(2)}
                        onChange={(val) => updateAdvancedLyricConfig({ visualizerSmoothing: val })}
                      />
                      <SettingSliderRow
                        label="垂直位置偏移"
                        value={advancedLyricConfig.visualizerOffsetY || 0}
                        min={-300}
                        max={300}
                        step={5}
                        unit="px"
                        onChange={(val) => updateAdvancedLyricConfig({ visualizerOffsetY: val })}
                      />
                      <SettingSliderRow
                        label="缩放/放大系数"
                        value={advancedLyricConfig.visualizerScale || 1.0}
                        min={0.2}
                        max={3.0}
                        step={0.05}
                        unit="x"
                        formatValue={(v) => `${Number(v).toFixed(2)}x`}
                        onChange={(val) => updateAdvancedLyricConfig({ visualizerScale: val })}
                      />

                      {/* ================= 常规滚动模式 (regular) 可视化参数================= */}
                      {advancedLyricConfig.lyricsMode === 'regular' && (
                        <>
                          <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--primary)', marginTop: '8px', marginBottom: '4px', borderBottom: '1px solid var(--divider-color)', paddingBottom: '4px' }}>环形频谱参数 (常规模式)</div>
                          <label className="setting-row-inline">
                            <span>环形样式</span>
                            <select className="setting-select" value={advancedLyricConfig.ringStyle || 'radial'}
                              onChange={(e) => updateAdvancedLyricConfig({ ringStyle: e.target.value })}>
                              <option value="radial">辐射线条</option>
                              <option value="particle">发光粒子</option>
                              <option value="wave">连续波环</option>
                            </select>
                          </label>
                          <SettingSliderRow
                            label="采样精度（线条/粒子数）"
                            value={advancedLyricConfig.ringBarCount ?? 180}
                            min={60}
                            max={360}
                            step={10}
                            onChange={(val) => updateAdvancedLyricConfig({ ringBarCount: val })}
                          />
                          <SettingSliderRow
                            label="最大延伸振幅"
                            value={advancedLyricConfig.ringMaxAmplitude ?? 80}
                            min={20}
                            max={200}
                            step={5}
                            unit="px"
                            onChange={(val) => updateAdvancedLyricConfig({ ringMaxAmplitude: val })}
                          />
                          <SettingSliderRow
                            label="边缘间距偏差"
                            value={advancedLyricConfig.ringInnerOffset ?? 5}
                            min={-50}
                            max={100}
                            step={1}
                            unit="px"
                            onChange={(val) => updateAdvancedLyricConfig({ ringInnerOffset: val })}
                          />
                          <SettingSliderRow
                            label="画笔/粒子线宽"
                            value={advancedLyricConfig.ringLineWidth ?? 2.5}
                            min={1.0}
                            max={8.0}
                            step={0.5}
                            unit="px"
                            formatValue={(v) => `${Number(v).toFixed(1)}px`}
                            onChange={(val) => updateAdvancedLyricConfig({ ringLineWidth: val })}
                          />
                          <label className="setting-row-inline">
                            <span>配色方案</span>
                            <select className="setting-select" value={advancedLyricConfig.ringColorMode || 'adaptive'}
                              onChange={(e) => updateAdvancedLyricConfig({ ringColorMode: e.target.value })}>
                              <option value="adaptive">封面自适应</option>
                              <option value="theme">主题单色</option>
                              <option value="custom">双色渐变</option>
                            </select>
                          </label>
                          {advancedLyricConfig.ringColorMode === 'custom' && (
                            <div className="setting-row-inline">
                              <span>渐变双色</span>
                              <div style={{ display: 'flex', gap: '8px' }}>
                                <input type="color" value={advancedLyricConfig.ringCustomColor1 || '#17f700'} onChange={(e) => updateAdvancedLyricConfig({ ringCustomColor1: e.target.value })} style={{ width: '32px', height: '24px', padding: '0', border: 'none', borderRadius: '4px', cursor: 'pointer' }} />
                                <input type="color" value={advancedLyricConfig.ringCustomColor2 || '#00d4ff'} onChange={(e) => updateAdvancedLyricConfig({ ringCustomColor2: e.target.value })} style={{ width: '32px', height: '24px', padding: '0', border: 'none', borderRadius: '4px', cursor: 'pointer' }} />
                              </div>
                            </div>
                          )}
                          <SettingSliderRow
                            label="自转速度"
                            value={advancedLyricConfig.ringRotationSpeed ?? 15}
                            min={0}
                            max={120}
                            step={5}
                            unit="°/分钟"
                            onChange={(val) => updateAdvancedLyricConfig({ ringRotationSpeed: val })}
                          />
                          <SettingSwitchRow
                            label="随声浪脉冲加速自转"
                            checked={advancedLyricConfig.ringRotationBeatSync === true}
                            onChange={(checked) => updateAdvancedLyricConfig({ ringRotationBeatSync: checked })}
                          />
                          <SettingSliderRow
                            label="发光辉光强度"
                            value={advancedLyricConfig.ringGlowIntensity ?? 0.6}
                            min={0.0}
                            max={1.5}
                            step={0.1}
                            formatValue={(v) => Number(v).toFixed(1)}
                            onChange={(val) => updateAdvancedLyricConfig({ ringGlowIntensity: val })}
                          />
                          <SettingSwitchRow
                            label="发光伴随节奏闪烁"
                            checked={advancedLyricConfig.ringGlowPulse !== false}
                            onChange={(checked) => updateAdvancedLyricConfig({ ringGlowPulse: checked })}
                          />
                        </>
                      )}

                      {/* ================= 气泡模式 (streamer) 可视化参数================= */}
                      {advancedLyricConfig.lyricsMode === 'streamer' && (
                        <>
                          <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--primary)', marginTop: '8px', marginBottom: '4px', borderBottom: '1px solid var(--divider-color)', paddingBottom: '4px' }}>底部流光氛围参数 (气泡模式)</div>
                          <SettingSliderRow
                            label="灯带基础高度"
                            value={advancedLyricConfig.streamerBarHeight ?? 16}
                            min={5}
                            max={80}
                            step={1}
                            unit="px"
                            onChange={(val) => updateAdvancedLyricConfig({ streamerBarHeight: val })}
                          />
                          <SettingSliderRow
                            label="脉冲波动高度"
                            value={advancedLyricConfig.streamerBarMaxHeight ?? 80}
                            min={20}
                            max={250}
                            step={2}
                            unit="px"
                            onChange={(val) => updateAdvancedLyricConfig({ streamerBarMaxHeight: val })}
                          />
                          <SettingSliderRow
                            label="不透明度"
                            value={advancedLyricConfig.streamerBarOpacity ?? 0.75}
                            min={0.2}
                            max={1.0}
                            step={0.05}
                            formatValue={(v) => Number(v).toFixed(2)}
                            onChange={(val) => updateAdvancedLyricConfig({ streamerBarOpacity: val })}
                          />
                          <SettingSliderRow
                            label="辉光扩散半径"
                            value={advancedLyricConfig.streamerBarGlowSpread ?? 20}
                            min={0}
                            max={50}
                            step={2}
                            unit="px"
                            onChange={(val) => updateAdvancedLyricConfig({ streamerBarGlowSpread: val })}
                          />
                          <SettingSliderRow
                            label="流光游动速度"
                            value={advancedLyricConfig.streamerBarFlowSpeed ?? 1.0}
                            min={0.1}
                            max={3.0}
                            step={0.1}
                            unit="x"
                            formatValue={(v) => `${Number(v).toFixed(1)}x`}
                            onChange={(val) => updateAdvancedLyricConfig({ streamerBarFlowSpeed: val })}
                          />
                        </>
                      )}

                      {/* ================= 云阶模式 (cloudstep) 可视化参数================= */}
                      {advancedLyricConfig.lyricsMode === 'cloudstep' && (
                        <>
                          <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--primary)', marginTop: '8px', marginBottom: '4px', borderBottom: '1px solid var(--divider-color)', paddingBottom: '4px' }}>层叠雾波参数 (云阶模式)</div>
                          <SettingSliderRow
                            label="雾化模糊半径"
                            value={advancedLyricConfig.cloudWaveBlur ?? 23}
                            min={5}
                            max={60}
                            step={1}
                            unit="px"
                            onChange={(val) => updateAdvancedLyricConfig({ cloudWaveBlur: val })}
                          />
                          <SettingSliderRow
                            label="最大起伏高度"
                            value={advancedLyricConfig.cloudWaveHeight ?? 30}
                            min={10}
                            max={80}
                            step={2}
                            unit="px"
                            onChange={(val) => updateAdvancedLyricConfig({ cloudWaveHeight: val })}
                          />
                          <SettingSliderRow
                            label="雾波不透明度"
                            value={advancedLyricConfig.cloudWaveOpacity ?? 0.39}
                            min={0.02}
                            max={0.5}
                            step={0.01}
                            formatValue={(v) => Number(v).toFixed(2)}
                            onChange={(val) => updateAdvancedLyricConfig({ cloudWaveOpacity: val })}
                          />
                        </>
                      )}

                      {/* ================= 空间画布 (spatial) 可视化参数================= */}
                      {advancedLyricConfig.lyricsMode === 'spatial' && (
                        <>
                          <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--primary)', marginTop: '8px', marginBottom: '4px', borderBottom: '1px solid var(--divider-color)', paddingBottom: '4px' }}>3D 空间星图参数 (空间模式)</div>
                          <SettingSliderRow
                            label="粒子数量"
                            value={advancedLyricConfig.spatialParticleCount ?? 200}
                            min={50}
                            max={500}
                            step={10}
                            onChange={(val) => updateAdvancedLyricConfig({ spatialParticleCount: val })}
                          />
                          <SettingSliderRow
                            label="虚化模糊系数"
                            value={advancedLyricConfig.spatialDepthBlur ?? 0.5}
                            min={0}
                            max={2.0}
                            step={0.1}
                            formatValue={(v) => Number(v).toFixed(1)}
                            onChange={(val) => updateAdvancedLyricConfig({ spatialDepthBlur: val })}
                          />
                        </>
                      )}

                      {/* ================= 黑胶光碟 (vinyl) 可视化参数================= */}
                      {advancedLyricConfig.lyricsMode === 'vinyl' && (
                        <>
                          <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--primary)', marginTop: '8px', marginBottom: '4px', borderBottom: '1px solid var(--divider-color)', paddingBottom: '4px' }}>唱片刻槽与唱针参数 (黑胶模式)</div>
                          <SettingSliderRow
                            label="盘面频谱刻槽"
                            value={advancedLyricConfig.vinylGrooveCount ?? 12}
                            min={4}
                            max={30}
                            step={1}
                            unit="圈"
                            onChange={(val) => updateAdvancedLyricConfig({ vinylGrooveCount: val })}
                          />
                          <SettingSliderRow
                            label="刻槽基础宽度"
                            value={advancedLyricConfig.vinylGrooveWidth ?? 1.0}
                            min={0.3}
                            max={3.0}
                            step={0.1}
                            formatValue={(v) => Number(v).toFixed(1)}
                            onChange={(val) => updateAdvancedLyricConfig({ vinylGrooveWidth: val })}
                          />
                          <SettingSliderRow
                            label="共鸣最大振幅"
                            value={advancedLyricConfig.vinylGrooveMaxWidth ?? 4.0}
                            min={1.5}
                            max={10.0}
                            step={0.5}
                            formatValue={(v) => Number(v).toFixed(1)}
                            onChange={(val) => updateAdvancedLyricConfig({ vinylGrooveMaxWidth: val })}
                          />
                          <SettingSliderRow
                            label="唱针光晕强度"
                            value={advancedLyricConfig.vinylStylusGlowStrength ?? 0.7}
                            min={0}
                            max={1.5}
                            step={0.1}
                            formatValue={(v) => Number(v).toFixed(1)}
                            onChange={(val) => updateAdvancedLyricConfig({ vinylStylusGlowStrength: val })}
                          />
                          <SettingSliderRow
                            label="唱针光晕大小"
                            value={advancedLyricConfig.vinylStylusGlowSize ?? 20}
                            min={8}
                            max={50}
                            step={1}
                            unit="px"
                            onChange={(val) => updateAdvancedLyricConfig({ vinylStylusGlowSize: val })}
                          />
                          <SettingSwitchRow
                            label="边缘高反光偏"
                            checked={advancedLyricConfig.vinylEdgeReflection !== false}
                            onChange={(checked) => updateAdvancedLyricConfig({ vinylEdgeReflection: checked })}
                          />
                        </>
                      )}

                      {/* ================= 胶片模式 (filmstrip) 可视化参数 ================= */}
                      {advancedLyricConfig.lyricsMode === 'filmstrip' && (
                        <>
                          <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--primary)', marginTop: '8px', marginBottom: '4px', borderBottom: '1px solid var(--divider-color)', paddingBottom: '4px' }}>胶片帧参数</div>
                          <SettingSliderRow
                            label="帧间距"
                            value={advancedLyricConfig.filmFrameGap ?? 18}
                            min={8}
                            max={48}
                            step={2}
                            unit="px"
                            onChange={(val) => updateAdvancedLyricConfig({ filmFrameGap: val })}
                          />
                          <SettingSliderRow
                            label="非当前帧透明度"
                            value={advancedLyricConfig.filmOpacity ?? 0.22}
                            min={0.05}
                            max={0.5}
                            step={0.05}
                            formatValue={(v) => `${Math.round(Number(v) * 100)}%`}
                            onChange={(val) => updateAdvancedLyricConfig({ filmOpacity: val })}
                          />
                          <SettingSliderRow
                            label="当前帧放大"
                            value={advancedLyricConfig.filmActiveScale ?? 1.08}
                            min={1}
                            max={1.2}
                            step={0.01}
                            formatValue={(v) => `${Math.round(Number(v) * 100)}%`}
                            onChange={(val) => updateAdvancedLyricConfig({ filmActiveScale: val })}
                          />
                        </>
                      )}

                      {/* ================= FLOATING DECOR SECTION ================= */}
                      <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--primary)', marginTop: '8px', marginBottom: '4px', borderBottom: '1px solid var(--divider-color)', paddingBottom: '4px' }}>背景悬浮粒子 (Floating Decor)</div>
                      <SettingSwitchRow
                        label="启用背景悬浮粒子"
                        checked={advancedLyricConfig.showDecor === true}
                        onChange={(checked) => updateAdvancedLyricConfig({ showDecor: checked })}
                      />
                      {advancedLyricConfig.showDecor === true && (
                        <>
                          <SettingSliderRow
                            label="浮动粒子数量"
                            value={advancedLyricConfig.decorParticleAmount ?? 40}
                            min={10}
                            max={150}
                            step={5}
                            onChange={(val) => updateAdvancedLyricConfig({ decorParticleAmount: val })}
                          />
                          <SettingSliderRow
                            label="粒子漂游速度"
                            value={advancedLyricConfig.decorSpeed ?? 1.0}
                            min={0.1}
                            max={3.0}
                            step={0.1}
                            unit="x"
                            formatValue={(v) => `${Number(v).toFixed(1)}x`}
                            onChange={(val) => updateAdvancedLyricConfig({ decorSpeed: val })}
                          />
                          <SettingSliderRow
                            label="粒子发光尺寸"
                            value={advancedLyricConfig.decorSize ?? 1.0}
                            min={0.3}
                            max={3.0}
                            step={0.1}
                            unit="x"
                            formatValue={(v) => `${Number(v).toFixed(1)}x`}
                            onChange={(val) => updateAdvancedLyricConfig({ decorSize: val })}
                          />
                          <SettingSliderRow
                            label="基础不透明度"
                            value={advancedLyricConfig.decorOpacity ?? 0.6}
                            min={0.1}
                            max={1.0}
                            step={0.05}
                            formatValue={(v) => Number(v).toFixed(2)}
                            onChange={(val) => updateAdvancedLyricConfig({ decorOpacity: val })}
                          />
                          <SettingSwitchRow
                            label="随音乐节奏闪烁"
                            checked={advancedLyricConfig.decorTwinkle === true}
                            onChange={(checked) => updateAdvancedLyricConfig({ decorTwinkle: checked })}
                          />
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
        {layoutMode === 'modern' && (
          <MiniQueuePopover isOpen={isQueueOpen} onClose={() => setIsQueueOpen(false)} />
        )}
        <ClosePromptModal />
        <LyricAdjusterModal
          isOpen={isLyricAdjusterOpen}
          onClose={() => setIsLyricAdjusterOpen(false)}
          currentSong={currentSong}
        />
        <LyricExportModal
          isOpen={isLyricExportOpen}
          onClose={() => setIsLyricExportOpen(false)}
          currentSong={currentSong}
          lyrics={currentSongLyrics}
        />
        <SleepTimerModal
          isOpen={isSleepTimerOpen}
          onClose={() => setIsSleepTimerOpen(false)}
        />
        <EqualizerModal
          isOpen={isEqualizerOpen}
          onClose={() => setIsEqualizerOpen(false)}
        />
        <AudioMatchModal
          isOpen={isAudioMatchOpen}
          onClose={() => setIsAudioMatchOpen(false)}
        />
        <AnimatePresence>
          {updateInfo?.show && (
            <UpdatePromptModal
              currentVersion={APP_VERSION}
              latestVersion={updateInfo.latestVersion}
              updateInfo={updateInfo}
              onClose={() => setUpdateInfo({ show: false, latestVersion: '' })}
              onUpdate={downloadUpdate}
              onInstall={installUpdate}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

const generateMediaBase64Icons = () => {
  const drawIcon = (type) => {
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d');
    
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    
    if (type === 'play') {
      ctx.beginPath();
      ctx.moveTo(10, 8);
      ctx.lineTo(26, 16);
      ctx.lineTo(10, 24);
      ctx.closePath();
      ctx.fill();
    } else if (type === 'pause') {
      ctx.fillRect(8, 8, 5, 16);
      ctx.fillRect(19, 8, 5, 16);
    } else if (type === 'prev') {
      ctx.fillRect(6, 8, 4, 16);
      ctx.beginPath();
      ctx.moveTo(26, 8);
      ctx.lineTo(12, 16);
      ctx.lineTo(26, 24);
      ctx.closePath();
      ctx.fill();
    } else if (type === 'next') {
      ctx.fillRect(22, 8, 4, 16);
      ctx.beginPath();
      ctx.moveTo(6, 8);
      ctx.lineTo(20, 16);
      ctx.lineTo(6, 24);
      ctx.closePath();
      ctx.fill();
    }
    
    return canvas.toDataURL('image/png');
  };
  
  return {
    prev: drawIcon('prev'),
    play: drawIcon('play'),
    pause: drawIcon('pause'),
    next: drawIcon('next')
  };
};

export default function App() {
  if (window.location.search.includes('desktop-lyrics=true')) {
    return <DesktopLyrics />;
  }
  if (window.location.search.includes('mini-player=true')) {
    return <IslandMiniPlayer />;
  }

  return (
    <AppProvider>
      <ErrorBoundary>
        <AppContent />
      </ErrorBoundary>
    </AppProvider>
  );
}








