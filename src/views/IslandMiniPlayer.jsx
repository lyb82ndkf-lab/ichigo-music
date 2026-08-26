import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Play, Pause, SkipBack, SkipForward, Heart, Volume2, VolumeX,
  Maximize2, X, Music
} from 'lucide-react';

export default function IslandMiniPlayer() {
  const [playerState, setPlayerState] = useState({
    isPlaying: false,
    currentSong: null,
    progress: 0,
    duration: 0,
    volume: 0.8,
    isLiked: false,
    lyrics: [],
    activeLineIndex: -1,
    immersiveColor: '#ff4081',
    colorMode: 'dark'
  });

  const [localVolume, setLocalVolume] = useState(0.8);

  useEffect(() => {
    document.body.style.background = 'transparent';
    document.body.style.backgroundColor = 'transparent';
    document.documentElement.style.background = 'transparent';
    document.documentElement.style.backgroundColor = 'transparent';
    const root = document.getElementById('root');
    if (root) {
      root.style.background = 'transparent';
      root.style.backgroundColor = 'transparent';
    }
  }, []);

  // Subscribe to updates from main window
  useEffect(() => {
    if (window.electronAPI?.onMiniPlayerUpdate) {
      const cleanup = window.electronAPI.onMiniPlayerUpdate((data) => {
        if (data) {
          setPlayerState((prev) => ({
            ...prev,
            ...data
          }));
          if (typeof data.volume === 'number') {
            setLocalVolume(data.volume);
          }
        }
      });
      return cleanup;
    }
  }, []);

  const {
    isPlaying,
    currentSong,
    progress,
    duration,
    isLiked,
    lyrics = [],
    activeLineIndex = -1,
    immersiveColor = '#ff4081',
    colorMode = 'dark'
  } = playerState;

  const isLight = colorMode === 'light';

  // Derive current lyric line text
  const currentLyricLine = useMemo(() => {
    if (Array.isArray(lyrics) && activeLineIndex >= 0 && activeLineIndex < lyrics.length) {
      const line = lyrics[activeLineIndex];
      const text = (line?.text || line?.content || '').trim();
      if (text) return text;
    }
    if (currentSong?.name || currentSong?.title) {
      const artist = currentSong?.ar?.[0]?.name || currentSong?.artists?.[0]?.name || currentSong?.artist || '';
      return artist ? `${currentSong.name || currentSong.title} - ${artist}` : (currentSong.name || currentSong.title);
    }
    return 'ICHIGOMusic · 享受纯粹音乐';
  }, [lyrics, activeLineIndex, currentSong]);

  const coverUrl = currentSong?.coverUrl || currentSong?.al?.picUrl || currentSong?.picUrl || '';
  const progressPct = duration > 0 ? Math.min(100, Math.max(0, (progress / duration) * 100)) : 0;

  // Actions back to main window
  const handleTogglePlay = () => {
    window.electronAPI?.sendMiniPlayerAction?.('toggle-play');
  };

  const handlePrev = () => {
    window.electronAPI?.sendMiniPlayerAction?.('prev');
  };

  const handleNext = () => {
    window.electronAPI?.sendMiniPlayerAction?.('next');
  };

  const handleToggleLike = (e) => {
    e?.stopPropagation?.();
    setPlayerState((prev) => ({ ...prev, isLiked: !prev.isLiked }));
    window.electronAPI?.sendMiniPlayerAction?.('toggle-like');
  };

  const handleRestoreMain = () => {
    window.electronAPI?.restoreMainWindow?.();
  };

  const handleClose = () => {
    window.electronAPI?.closeMiniPlayer?.();
  };

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        margin: 0,
        padding: '4px',
        boxSizing: 'border-box',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'transparent',
        userSelect: 'none',
        overflow: 'hidden',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif'
      }}
    >
      {/* Global CSS for Vinyl Needle and Vinyl Spin (Dark & Light Mode Aware) */}
      <style>{`
        @keyframes vinylSpin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .mini-vinyl-disc {
          animation: vinylSpin 14s linear infinite;
        }
        .mini-vinyl-disc.paused {
          animation-play-state: paused;
        }
        .mini-control-btn {
          background: ${isLight ? 'rgba(0, 0, 0, 0.05)' : 'rgba(255, 255, 255, 0.08)'};
          border: 1px solid ${isLight ? 'rgba(0, 0, 0, 0.08)' : 'rgba(255, 255, 255, 0.1)'};
          color: ${isLight ? 'rgba(0, 0, 0, 0.75)' : 'rgba(255, 255, 255, 0.85)'};
          width: 26px;
          height: 26px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.25, 1, 0.5, 1);
          -webkit-app-region: no-drag;
          padding: 0;
        }
        .mini-control-btn:hover {
          background: ${isLight ? 'rgba(0, 0, 0, 0.12)' : 'rgba(255, 255, 255, 0.2)'};
          color: ${isLight ? '#000000' : '#ffffff'};
          transform: scale(1.08);
        }
        .mini-play-btn {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: linear-gradient(135deg, ${immersiveColor || '#ff4081'}, #7928ca);
          border: none;
          color: #fff;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          box-shadow: 0 0 14px ${immersiveColor || '#ff4081'}55;
          transition: all 0.2s cubic-bezier(0.25, 1, 0.5, 1);
          -webkit-app-region: no-drag;
          padding: 0;
        }
        .mini-play-btn:hover {
          transform: scale(1.1);
          box-shadow: 0 0 20px ${immersiveColor || '#ff4081'}88;
        }
        .mini-top-action-btn {
          background: none;
          border: none;
          color: ${isLight ? 'rgba(0, 0, 0, 0.42)' : 'rgba(255, 255, 255, 0.45)'};
          cursor: pointer;
          padding: 2px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 4px;
          transition: all 0.15s;
          -webkit-app-region: no-drag;
        }
        .mini-top-action-btn:hover {
          color: ${isLight ? '#000000' : '#ffffff'};
          background: ${isLight ? 'rgba(0, 0, 0, 0.08)' : 'rgba(255, 255, 255, 0.15)'};
        }
      `}</style>

      {/* Main Island Capsule Container */}
      <div
        style={{
          width: '100%',
          height: '100%',
          borderRadius: '38px',
          background: isLight
            ? 'linear-gradient(135deg, rgba(255, 255, 255, 0.94) 0%, rgba(246, 244, 252, 0.97) 100%)'
            : 'linear-gradient(135deg, rgba(22, 16, 32, 0.94) 0%, rgba(10, 8, 16, 0.96) 100%)',
          backdropFilter: 'blur(30px) saturate(180%)',
          WebkitBackdropFilter: 'blur(30px) saturate(180%)',
          border: `1px solid ${isLight ? 'rgba(0, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0.15)'}`,
          boxShadow: isLight
            ? `0 12px 32px rgba(0, 0, 0, 0.16), 0 0 20px ${immersiveColor}35`
            : `0 12px 32px rgba(0, 0, 0, 0.65), 0 0 20px ${immersiveColor}28`,
          display: 'flex',
          alignItems: 'center',
          padding: '0 14px',
          gap: '12px',
          position: 'relative',
          boxSizing: 'border-box',
          WebkitAppRegion: 'drag'
        }}
      >
        {/* Left: Vinyl Disc & Rotating Tonearm / Needle */}
        <div style={{ position: 'relative', width: '64px', height: '64px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {/* Vinyl Record Disc */}
          <div
            className={`mini-vinyl-disc ${!isPlaying ? 'paused' : ''}`}
            style={{
              width: '58px',
              height: '58px',
              borderRadius: '50%',
              background: 'radial-gradient(circle, #1a1a1a 0%, #111 40%, #2a2a2a 45%, #151515 70%, #080808 100%)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.6), inset 0 0 6px rgba(255,255,255,0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid rgba(255, 255, 255, 0.12)'
            }}
          >
            {/* Center Album Cover */}
            <div
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                overflow: 'hidden',
                background: '#222',
                border: '2px solid #000',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              {coverUrl ? (
                <img
                  src={coverUrl}
                  alt="cover"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  draggable={false}
                />
              ) : (
                <Music size={14} color="#ff4081" />
              )}
            </div>
          </div>

          {/* Tonearm / Needle (旋转唱针) */}
          <div
            style={{
              position: 'absolute',
              top: '0px',
              right: '2px',
              width: '24px',
              height: '32px',
              pointerEvents: 'none',
              transformOrigin: '20px 4px',
              transform: isPlaying ? 'rotate(24deg)' : 'rotate(-8deg)',
              transition: 'transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)'
            }}
          >
            {/* Stylus needle graphic */}
            <svg width="24" height="32" viewBox="0 0 24 32" fill="none">
              {/* Pivot Base */}
              <circle cx="20" cy="4" r="3.5" fill={isLight ? '#9ca3af' : '#d1d5db'} stroke={isLight ? '#4b5563' : '#374151'} strokeWidth="1" />
              <circle cx="20" cy="4" r="1.5" fill={immersiveColor || '#ff4081'} />
              {/* Arm Rod */}
              <path d="M19 6 L12 24 L10 28" stroke={isLight ? '#6b7280' : '#e5e7eb'} strokeWidth="1.5" strokeLinecap="round" />
              {/* Cartridge Head */}
              <rect x="7" y="26" width="6" height="5" rx="1" fill={isLight ? '#1f2937' : '#374151'} stroke={isLight ? '#4b5563' : '#9ca3af'} strokeWidth="0.8" />
            </svg>
          </div>
        </div>

        {/* Center: Song info & Single-Line Dynamic Lyric */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '3px' }}>
          {/* Top Row: Track Name & Mini Window Actions */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
              <span
                style={{
                  fontSize: '12px',
                  fontWeight: 700,
                  color: isLight ? '#1a192b' : '#ffffff',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}
              >
                {currentSong?.name || currentSong?.title || '未在播放'}
              </span>
              {(currentSong?.ar?.[0]?.name || currentSong?.artist) && (
                <span
                  style={{
                    fontSize: '10px',
                    color: isLight ? 'rgba(0, 0, 0, 0.55)' : 'rgba(255, 255, 255, 0.5)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}
                >
                  · {currentSong?.ar?.[0]?.name || currentSong?.artist}
                </span>
              )}
            </div>

            {/* Window Top Buttons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '2px', flexShrink: 0 }}>
              <button
                type="button"
                className="mini-top-action-btn"
                onClick={handleRestoreMain}
                title="展开为主窗口"
              >
                <Maximize2 size={12} />
              </button>
              <button
                type="button"
                className="mini-top-action-btn"
                onClick={handleClose}
                title="关闭迷你播放器"
              >
                <X size={13} />
              </button>
            </div>
          </div>

          {/* Middle: Single-Line Dynamic Scrolling Lyrics */}
          <div
            style={{
              fontSize: '12px',
              fontWeight: 600,
              color: isPlaying ? (immersiveColor || '#ff4081') : (isLight ? 'rgba(0, 0, 0, 0.8)' : 'rgba(255, 255, 255, 0.8)'),
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              lineHeight: '16px',
              textShadow: !isLight && isPlaying ? `0 0 10px ${immersiveColor}66` : 'none',
              transition: 'all 0.3s ease'
            }}
          >
            {currentLyricLine}
          </div>

          {/* Bottom: Mini Progress Bar */}
          <div
            style={{
              width: '100%',
              height: '3px',
              background: isLight ? 'rgba(0, 0, 0, 0.08)' : 'rgba(255, 255, 255, 0.12)',
              borderRadius: '2px',
              overflow: 'hidden',
              marginTop: '2px'
            }}
          >
            <div
              style={{
                width: `${progressPct}%`,
                height: '100%',
                background: `linear-gradient(90deg, ${immersiveColor || '#ff4081'}, #00d4ff)`,
                borderRadius: '2px',
                transition: 'width 0.25s linear'
              }}
            />
          </div>
        </div>

        {/* Right: Transport Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
          {/* Like Button */}
          <button
            type="button"
            className="mini-control-btn"
            onClick={handleToggleLike}
            title={isLiked ? '已喜欢 (点击取消喜欢)' : '喜欢 (点击收藏)'}
            style={{
              color: isLiked ? '#ff4081' : (isLight ? 'rgba(0, 0, 0, 0.65)' : 'rgba(255, 255, 255, 0.7)'),
              background: isLiked ? 'rgba(255, 64, 129, 0.16)' : (isLight ? 'rgba(0, 0, 0, 0.05)' : 'rgba(255, 255, 255, 0.08)'),
              border: isLiked ? '1px solid rgba(255, 64, 129, 0.4)' : (isLight ? '1px solid rgba(0, 0, 0, 0.08)' : '1px solid rgba(255, 255, 255, 0.1)')
            }}
          >
            <Heart size={14} fill={isLiked ? '#ff4081' : 'none'} color={isLiked ? '#ff4081' : 'currentColor'} />
          </button>

          {/* Prev */}
          <button
            type="button"
            className="mini-control-btn"
            onClick={handlePrev}
            title="上一首"
          >
            <SkipBack size={13} fill="currentColor" />
          </button>

          {/* Play / Pause */}
          <button
            type="button"
            className="mini-play-btn"
            onClick={handleTogglePlay}
            title={isPlaying ? '暂停' : '播放'}
          >
            {isPlaying ? <Pause size={15} fill="currentColor" /> : <Play size={15} fill="currentColor" style={{ marginLeft: '2px' }} />}
          </button>

          {/* Next */}
          <button
            type="button"
            className="mini-control-btn"
            onClick={handleNext}
            title="下一首"
          >
            <SkipForward size={13} fill="currentColor" />
          </button>
        </div>
      </div>
    </div>
  );
}
