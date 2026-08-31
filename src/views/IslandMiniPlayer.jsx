import React, { useState, useEffect, useMemo } from 'react';
import {
  Play, Pause, SkipBack, SkipForward, Heart,
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
  const songTitle = currentSong?.name || currentSong?.title || '未在播放';
  const artistName = currentSong?.ar?.map(a => a.name).join(' / ') || currentSong?.artists?.map(a => a.name).join(' / ') || currentSong?.artist || '';

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
      <style>{`
        .mini-control-btn {
          background: ${isLight ? 'rgba(0, 0, 0, 0.05)' : 'rgba(255, 255, 255, 0.08)'};
          border: 1px solid ${isLight ? 'rgba(0, 0, 0, 0.08)' : 'rgba(255, 255, 255, 0.1)'};
          color: ${isLight ? 'rgba(0, 0, 0, 0.75)' : 'rgba(255, 255, 255, 0.85)'};
          width: 28px;
          height: 28px;
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
          width: 34px;
          height: 34px;
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
          background: ${isLight ? 'rgba(0, 0, 0, 0.04)' : 'rgba(255, 255, 255, 0.06)'};
          border: 1px solid ${isLight ? 'rgba(0, 0, 0, 0.06)' : 'rgba(255, 255, 255, 0.08)'};
          color: ${isLight ? 'rgba(0, 0, 0, 0.45)' : 'rgba(255, 255, 255, 0.55)'};
          cursor: pointer;
          width: 20px;
          height: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 6px;
          transition: all 0.15s ease;
          -webkit-app-region: no-drag;
          padding: 0;
        }
        .mini-top-action-btn:hover {
          color: ${isLight ? '#000000' : '#ffffff'};
          background: ${isLight ? 'rgba(0, 0, 0, 0.12)' : 'rgba(255, 255, 255, 0.2)'};
          transform: scale(1.05);
        }
      `}</style>

      {/* Main Island Capsule Container */}
      <div
        style={{
          width: '100%',
          height: '100%',
          borderRadius: '28px',
          background: isLight
            ? 'linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(246, 244, 252, 0.98) 100%)'
            : 'linear-gradient(135deg, rgba(24, 18, 36, 0.95) 0%, rgba(12, 10, 20, 0.98) 100%)',
          backdropFilter: 'blur(32px) saturate(180%)',
          WebkitBackdropFilter: 'blur(32px) saturate(180%)',
          border: `1px solid ${isLight ? 'rgba(0, 0, 0, 0.08)' : 'rgba(255, 255, 255, 0.12)'}`,
          boxShadow: isLight
            ? `0 10px 28px rgba(0, 0, 0, 0.14), 0 0 16px ${immersiveColor}30`
            : `0 10px 28px rgba(0, 0, 0, 0.6), 0 0 16px ${immersiveColor}25`,
          display: 'flex',
          alignItems: 'center',
          padding: '0 14px',
          gap: '12px',
          position: 'relative',
          boxSizing: 'border-box',
          WebkitAppRegion: 'drag'
        }}
      >
        {/* Top-Right Maximize & Close Buttons */}
        <div
          style={{
            position: 'absolute',
            top: '8px',
            right: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            zIndex: 10,
            WebkitAppRegion: 'no-drag'
          }}
        >
          <button
            type="button"
            className="mini-top-action-btn"
            onClick={handleRestoreMain}
            title="还原展开完整窗口"
          >
            <Maximize2 size={11} />
          </button>
          <button
            type="button"
            className="mini-top-action-btn"
            onClick={handleClose}
            title="关闭迷你播放器"
          >
            <X size={12} />
          </button>
        </div>

        {/* Left: Pure Clean Album Cover */}
        <div
          style={{
            width: '54px',
            height: '54px',
            borderRadius: '13px',
            overflow: 'hidden',
            flexShrink: 0,
            background: isLight ? '#f0edf6' : '#1b1726',
            boxShadow: `0 4px 14px rgba(0, 0, 0, 0.3), 0 0 12px ${immersiveColor}35`,
            border: `1px solid ${isLight ? 'rgba(0, 0, 0, 0.08)' : 'rgba(255, 255, 255, 0.12)'}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative'
          }}
        >
          {coverUrl ? (
            <img
              src={coverUrl}
              alt="cover"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                display: 'block'
              }}
              draggable={false}
            />
          ) : (
            <Music size={22} color={immersiveColor || '#ff4081'} />
          )}
        </div>

        {/* Center: Song info & Single-Line Dynamic Lyric */}
        <div
          style={{
            flex: 1,
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            gap: '4px',
            paddingRight: '6px'
          }}
        >
          {/* Top Row: Track Name & Artist */}
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: '6px',
              minWidth: 0,
              width: '100%',
              overflow: 'hidden'
            }}
          >
            <span
              title={songTitle}
              style={{
                fontSize: '13px',
                fontWeight: 800,
                color: isLight ? '#1a192b' : '#ffffff',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                flexShrink: 1,
                minWidth: 0
              }}
            >
              {songTitle}
            </span>
            {artistName && (
              <span
                title={artistName}
                style={{
                  fontSize: '11px',
                  fontWeight: 500,
                  color: isLight ? 'rgba(0, 0, 0, 0.55)' : 'rgba(255, 255, 255, 0.55)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  flexShrink: 2,
                  minWidth: 0
                }}
              >
                · {artistName}
              </span>
            )}
          </div>

          {/* Middle: Single-Line Dynamic Scrolling Lyrics */}
          <div
            title={currentLyricLine}
            style={{
              fontSize: '12px',
              fontWeight: 600,
              color: isPlaying ? (immersiveColor || '#ff4081') : (isLight ? 'rgba(0, 0, 0, 0.65)' : 'rgba(255, 255, 255, 0.65)'),
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              lineHeight: '16px',
              textShadow: !isLight && isPlaying ? `0 0 8px ${immersiveColor}55` : 'none',
              transition: 'all 0.3s ease',
              width: '100%',
              minWidth: 0
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
              marginTop: '1px'
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
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            flexShrink: 0,
            marginTop: '4px',
            WebkitAppRegion: 'no-drag'
          }}
        >
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
