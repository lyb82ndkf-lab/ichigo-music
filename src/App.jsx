import React, { useState, useEffect, useMemo, useRef } from 'react';
import { AppProvider, useApp } from './context/AppContext';
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

import DesktopLyrics from './views/DesktopLyrics';
import { useLyricEngine } from './hooks/useLyricEngine';

// Views
import Discover from './views/Discover';
import Search from './views/Search';
import PlaylistDetail from './views/PlaylistDetail';
import AlbumDetail from './views/AlbumDetail';
import ArtistDetail from './views/ArtistDetail';
import MVPlayer from './views/MVPlayer';
import Leaderboards from './views/Leaderboards';
import MyLiked from './views/MyLiked';
import RecentlyPlayed from './views/RecentlyPlayed';
import Settings from './views/Settings';
import ModernHome from './views/ModernHome';

// Icons
import { ChevronLeft, ChevronRight, X, Settings as SettingsIcon, Minus, Square } from 'lucide-react';

function AppContent() {
  const {
    currentView,
    goBack,
    goForward,
    canGoBack,
    canGoForward,
    currentSong,
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
    toggleLike,
    isQueueOpen,
    setIsQueueOpen,
    navigateTo,
    immersiveColor
  } = useApp();

  const { engineRef, lyrics, activeLineIndex } = useLyricEngine(currentSong?.id, audioElement);

  const [isLyricsOpen, setIsLyricsOpen] = useState(false);
  const [isImmersiveSettingsOpen, setIsImmersiveSettingsOpen] = useState(false);
  const [immersiveSettingsTab, setImmersiveSettingsTab] = useState('lyrics');

  const updateAdvancedLyricConfig = (patch) => {
    saveAdvancedLyricConfig({
      ...advancedLyricConfig,
      ...patch
    });
  };

  const immersiveCoverUrl = currentSong?.coverUrl || 'https://p2.music.126.net/UeTuwE7Cx877Y2gCGIseYg==/109951163026279185.jpg';
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
      playPrev();
    });

    const unsubNext = window.electronAPI.onMediaNext(() => {
      playNext();
    });

    const unsubToggle = window.electronAPI.onMediaTogglePlay(() => {
      togglePlay();
    });

    return () => {
      unsubPrev();
      unsubNext();
      unsubToggle();
    };
  }, [playPrev, playNext, togglePlay]);

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

      window.electronAPI.sendLyricsUpdate({
        isPlaying: isPlaying,
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
    layoutMode
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
        layoutMode: currentLayoutMode
      } = shortcutsRef.current;

      if (e.key === 'Escape' && currentIsLyricsOpen) {
        setIsLyricsOpen(false);
        return;
      }
      if (isTypingTarget(e.target)) return;
      if (currentShortcuts?.enabled === false) return;

      if (shortcutMatches(e, currentShortcuts?.playPause)) { togglePlay(); e.preventDefault(); }
      else if (shortcutMatches(e, currentShortcuts?.nextTrack)) { playNext(); e.preventDefault(); }
      else if (shortcutMatches(e, currentShortcuts?.prevTrack)) { playPrev(); e.preventDefault(); }
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
        if (currentAudioElement) currentAudioElement.currentTime = Math.min(currentAudioElement.duration || currentAudioElement.currentTime, currentAudioElement.currentTime + 5);
        e.preventDefault();
      }
      else if (shortcutMatches(e, currentShortcuts?.seekBack)) {
        if (currentAudioElement) currentAudioElement.currentTime = Math.max(0, currentAudioElement.currentTime - 5);
        e.preventDefault();
      }
      else if (shortcutMatches(e, currentShortcuts?.likeTrack)) { if (currentCurrentSong?.id) toggleLike(currentCurrentSong.id); e.preventDefault(); }
      else if (shortcutMatches(e, currentShortcuts?.cyclePlayMode)) {
        const modes = ['sequence', 'random', 'single'];
        setPlayMode(modes[(modes.indexOf(currentPlayMode) + 1) % modes.length]);
        e.preventDefault();
      }
      else if (shortcutMatches(e, currentShortcuts?.goHome)) { navigateTo(currentLayoutMode === 'modern' ? 'home' : 'discover'); e.preventDefault(); }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    togglePlay, playNext, playPrev, setVolume, saveDesktopLyricsConfig, navigateTo, toggleLike, setPlayMode
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
      default:
        return layoutMode === 'modern' ? <ModernHome key="home" /> : <Discover key="discover" />;
    }
  }, [currentView, viewData, layoutMode]);

  return (
    <div style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {layoutMode !== 'modern' && <TopBar />}
      {layoutMode === 'modern' && <ModernTopControls />}
      <div className="app-container" style={{ flex: 1, overflow: 'hidden' }}>
        {/* Background Audio Node */}
        <AudioPlayer />
        
        {/* Navigation Sidebar */}
        <Sidebar />
        
        {/* Main Workspace */}
        <main className="app-main">
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
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {viewComponent}
          </div>
        </main>

        {/* Bottom Playback Control Bar */}
        {layoutMode !== 'modern' && (
          <PlayerBar
            onToggleLyrics={() => setIsLyricsOpen(!isLyricsOpen)}
            isLyricsOpen={isLyricsOpen}
          />
        )}
        {layoutMode === 'modern' && <ModernPlayerBar onToggleLyrics={() => setIsLyricsOpen(!isLyricsOpen)} />}
        
        {layoutMode === 'modern' && (
          <MiniQueuePopover isOpen={isQueueOpen} onClose={() => setIsQueueOpen(false)} />
        )}

        {/* Full Screen Interactive Lyrics Overlay (Monet Mode) */}
        {isLyricsOpen && (
          <div 
            className="lyrics-overlay" 
            role="dialog" 
            aria-modal="true" 
            aria-label="沉浸式歌词"
            style={{
              '--primary': immersiveColor || 'var(--primary)',
              '--primary-glow': `${immersiveColor || 'var(--primary)'}59`,
              '--primary-subtle': `${immersiveColor || 'var(--primary)'}1a`
            }}
          >
            <div
              className="lyrics-overlay-bg"
              style={immersiveBgStyle}
            />
            <div className="lyrics-overlay-wash" />

            {advancedLyricConfig.showDecor === true && <MonetFloatingDecor />}

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
                <LyricsView engineRef={engineRef} lyrics={lyrics} activeLineIndex={activeLineIndex} />
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
                <div className="immersive-settings-header">
                  <h3>沉浸式歌词设置</h3>
                  <button
                    className="immersive-settings-close"
                    onClick={() => setIsImmersiveSettingsOpen(false)}
                    aria-label="关闭设置"
                  >
                    <X size={16} />
                  </button>
                </div>
                
                {/* Tab Row */}
                <div style={{ display: 'flex', borderBottom: '1px solid var(--divider-color)', background: 'rgba(0,0,0,0.1)' }}>
                  {[
                    { key: 'lyrics', label: '歌词样式' },
                    { key: 'background', label: '背景/封面' },
                    { key: 'visualizer', label: '音频可视化' }
                  ].map(tab => (
                    <button
                      key={tab.key}
                      onClick={() => setImmersiveSettingsTab(tab.key)}
                      style={{
                        flex: 1,
                        padding: '12px',
                        background: 'transparent',
                        border: 'none',
                        borderBottom: immersiveSettingsTab === tab.key ? '2px solid var(--primary)' : '2px solid transparent',
                        color: immersiveSettingsTab === tab.key ? 'var(--primary)' : 'var(--text-muted)',
                        fontWeight: 600,
                        fontSize: '12px',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                <div className="immersive-settings-body" style={{ flex: 1, overflowY: 'auto' }}>
                  {immersiveSettingsTab === 'lyrics' && (
                    <div className="immersive-settings-section">
                      <label className="setting-row-inline">
                        <span>动画模式</span>
                        <select className="setting-select" value={advancedLyricConfig.lyricsMode || 'talk'}
                          onChange={(e) => updateAdvancedLyricConfig({ lyricsMode: e.target.value })}>
                          <option value="talk">混乱模式 (3D倾诉)</option>
                          <option value="regular">常规滚动</option>
                          <option value="streamer">气泡模式 (流光)</option>
                          <option value="cloudstep">云阶模式 (楼梯)</option>
                          <option value="spatial">空间画布 (全屏)</option>
                          <option value="vinyl">黑胶光碟 (旋转)</option>
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
                        <span>歌词字号：{advancedLyricConfig.fontSize || 24}px</span>
                        <input type="range" min="18" max="52" value={advancedLyricConfig.fontSize || 24}
                          onChange={(e) => updateAdvancedLyricConfig({ fontSize: Number(e.target.value) })} />
                      </label>
                      <label className="setting-row-inline">
                        <span>显示行数：{advancedLyricConfig.visibleLines || 5} 行</span>
                        <input type="range" min="1" max="9" step="2" value={advancedLyricConfig.visibleLines || 5}
                          onChange={(e) => updateAdvancedLyricConfig({ visibleLines: Number(e.target.value) })} />
                      </label>
                      <label className="setting-row-inline">
                        <span>歌词纵向位置：{advancedLyricConfig.lyricsPositionY || 42}%</span>
                        <input type="range" min="20" max="70" value={advancedLyricConfig.lyricsPositionY || 42}
                          onChange={(e) => updateAdvancedLyricConfig({ lyricsPositionY: Number(e.target.value) })} />
                      </label>
                      {advancedLyricConfig.lyricsMode === 'streamer' && (
                        <label className="setting-row-inline">
                          <span>气泡对齐方式</span>
                          <select className="setting-select" value={advancedLyricConfig.bubbleAlign || 'alternate'}
                            onChange={(e) => updateAdvancedLyricConfig({ bubbleAlign: e.target.value })}>
                            <option value="alternate">交替对话</option>
                            <option value="left">全左对齐</option>
                            <option value="right">全右对齐</option>
                          </select>
                        </label>
                      )}
                      {advancedLyricConfig.lyricsMode === 'cloudstep' && (
                        <label className="setting-row-inline">
                          <span>云阶行间距：{(advancedLyricConfig.cloudStepSpacing || 1).toFixed(1)}</span>
                          <input type="range" min="0.5" max="3" step="0.1" value={advancedLyricConfig.cloudStepSpacing || 1}
                            onChange={(e) => updateAdvancedLyricConfig({ cloudStepSpacing: Number(e.target.value) })} />
                        </label>
                      )}
                      {advancedLyricConfig.lyricsMode === 'vinyl' && (
                        <>
                          <label className="setting-row-inline">
                            <span>黑胶倾斜角度：{advancedLyricConfig.vinylTiltAngle || 0}°</span>
                            <input type="range" min="0" max="60" step="5" value={advancedLyricConfig.vinylTiltAngle || 0}
                              onChange={(e) => updateAdvancedLyricConfig({ vinylTiltAngle: Number(e.target.value) })} />
                          </label>
                          <label className="setting-row-inline">
                            <span>黑胶行间距：{(advancedLyricConfig.vinylLineSpacing || 1).toFixed(1)}</span>
                            <input type="range" min="0.5" max="2.5" step="0.1" value={advancedLyricConfig.vinylLineSpacing || 1}
                              onChange={(e) => updateAdvancedLyricConfig({ vinylLineSpacing: Number(e.target.value) })} />
                          </label>
                        </>
                      )}
                      <label className="setting-row-inline">
                        <span>歌词时间偏移：{Number(advancedLyricConfig.globalOffset || 0).toFixed(2)} 秒</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <button 
                            className="modern-glass-btn" 
                            style={{ padding: '2px 8px', fontSize: '12px', cursor: 'pointer' }}
                            onClick={() => updateAdvancedLyricConfig({ globalOffset: (Number(advancedLyricConfig.globalOffset) || 0) - 0.5 })}
                          >-0.5s</button>
                          <input type="range" min="-3" max="3" step="0.05" value={advancedLyricConfig.globalOffset || 0}
                            onChange={(e) => updateAdvancedLyricConfig({ globalOffset: Number(e.target.value) })} style={{ width: '100px' }} />
                          <button 
                            className="modern-glass-btn" 
                            style={{ padding: '2px 8px', fontSize: '12px', cursor: 'pointer' }}
                            onClick={() => updateAdvancedLyricConfig({ globalOffset: (Number(advancedLyricConfig.globalOffset) || 0) + 0.5 })}
                          >+0.5s</button>
                        </div>
                      </label>
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
                      <label className="setting-row-inline compact-toggle">
                        <span>显示双语歌词</span>
                        <input type="checkbox" checked={advancedLyricConfig.showTranslation !== false}
                          onChange={(e) => updateAdvancedLyricConfig({ showTranslation: e.target.checked })} />
                      </label>
                      <label className="setting-row-inline compact-toggle">
                        <span>歌词辉光效果</span>
                        <input type="checkbox" checked={advancedLyricConfig.showGlow === true}
                          onChange={(e) => updateAdvancedLyricConfig({ showGlow: e.target.checked })} />
                      </label>
                      <label className="setting-row-inline compact-toggle">
                        <span>Floating decor</span>
                        <input type="checkbox" checked={advancedLyricConfig.showDecor === true}
                          onChange={(e) => updateAdvancedLyricConfig({ showDecor: e.target.checked })} />
                      </label>
                      <label className="setting-row-inline">
                        <span>非活动歌词模糊度：{(advancedLyricConfig.inactiveLyricBlur !== undefined ? advancedLyricConfig.inactiveLyricBlur : 0.8).toFixed(1)}</span>
                        <input type="range" min="0" max="3.0" step="0.2" value={advancedLyricConfig.inactiveLyricBlur !== undefined ? advancedLyricConfig.inactiveLyricBlur : 0.8}
                          onChange={(e) => updateAdvancedLyricConfig({ inactiveLyricBlur: Number(e.target.value) })} />
                      </label>
                    </div>
                  )}

                  {immersiveSettingsTab === 'background' && (
                    <div className="immersive-settings-section">
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
                      <label className="setting-row-inline compact-toggle">
                        <span>显示专辑封面</span>
                        <input type="checkbox" checked={advancedLyricConfig.showCover !== false}
                          onChange={(e) => updateAdvancedLyricConfig({ showCover: e.target.checked })} />
                      </label>
                      <label className="setting-row-inline">
                        <span>背景模糊度：{advancedLyricConfig.backgroundBlur !== undefined ? advancedLyricConfig.backgroundBlur : 32}px</span>
                        <input type="range" min="0" max="60" step="2" value={advancedLyricConfig.backgroundBlur !== undefined ? advancedLyricConfig.backgroundBlur : 32}
                          onChange={(e) => updateAdvancedLyricConfig({ backgroundBlur: Number(e.target.value) })} />
                      </label>
                    </div>
                  )}

                  {immersiveSettingsTab === 'visualizer' && (
                    <div className="immersive-settings-section">
                      <label className="setting-row-inline">
                        <span>波形样式</span>
                        <select className="setting-select" value={advancedLyricConfig.visualizerStyle || 'bars'}
                          onChange={(e) => updateAdvancedLyricConfig({ visualizerStyle: e.target.value })}>
                          <option value="bars">底部律动条</option>
                          <option value="wave">流动波形</option>
                          <option value="circle">环形脉冲</option>
                          <option value="off">关闭</option>
                        </select>
                      </label>
                      <label className="setting-row-inline">
                        <span>垂直位置偏移：{(advancedLyricConfig.visualizerOffsetY || 0)}px</span>
                        <input type="range" min="-300" max="300" step="5" value={advancedLyricConfig.visualizerOffsetY || 0}
                          onChange={(e) => updateAdvancedLyricConfig({ visualizerOffsetY: Number(e.target.value) })} />
                      </label>
                      <label className="setting-row-inline">
                        <span>缩放/放大系数：{(advancedLyricConfig.visualizerScale || 1.0).toFixed(2)}x</span>
                        <input type="range" min="0.2" max="3.0" step="0.05" value={advancedLyricConfig.visualizerScale || 1.0}
                          onChange={(e) => updateAdvancedLyricConfig({ visualizerScale: Number(e.target.value) })} />
                      </label>
                    </div>
                  )}
                </div>
              </div>
            )}
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

  return (
    <AppProvider>
      <ErrorBoundary>
        <AppContent />
      </ErrorBoundary>
    </AppProvider>
  );
}
