import React, { useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import ResilientCover from './ResilientCover';
import { Play, Pause, SkipBack, SkipForward, Heart, Shuffle, Repeat, Repeat1, ListMusic, Volume2, VolumeX } from 'lucide-react';

export default function ModernPlayerBar({ onToggleLyrics, lyrics = [] }) {
  const { 
    currentSong,
    isPlaying, 
    togglePlay, 
    playNext,
    playPrev,
    progress,
    duration,
    audioElement,
    likedSongIds,
    toggleLike,
    playMode,
    setPlayMode,
    isQueueOpen,
    setIsQueueOpen,
    volume,
    setVolume,
    desktopLyricsConfig,
    navigateTo
  } = useApp();

  const [prevVolume, setPrevVolume] = useState(0.8);
  const [isSeeking, setIsSeeking] = useState(false);
  const [progressPreview, setProgressPreview] = useState(null);
  const handleVolumeToggle = () => {
    if (volume > 0) {
      setPrevVolume(volume);
      setVolume(0);
    } else {
      setVolume(prevVolume);
    }
  };

  const progressRef = useRef(null);
  const effectiveDuration = duration > 0 ? duration : Number(currentSong?.durationMs || currentSong?.dt || 0) / 1000;

  const formatTime = (time) => {
    if (!time || isNaN(time)) return '00:00';
    const min = Math.floor(time / 60).toString().padStart(2, '0');
    const sec = Math.floor(time % 60).toString().padStart(2, '0');
    return `${min}:${sec}`;
  };

  const seekFromClientX = (clientX) => {
    if (!progressRef.current || !effectiveDuration) return;
    const rect = progressRef.current.getBoundingClientRect();
    const percent = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    if (audioElement) audioElement.currentTime = percent * effectiveDuration;
  };

  const getLyricPreview = (clientX) => {
    if (!progressRef.current || !effectiveDuration || !Array.isArray(lyrics) || lyrics.length === 0) return null;
    const rect = progressRef.current.getBoundingClientRect();
    const percent = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const targetTime = percent * effectiveDuration;
    let index = -1;
    for (let i = lyrics.length - 1; i >= 0; i -= 1) {
      if (targetTime >= Number(lyrics[i].time || 0)) {
        index = i;
        break;
      }
    }
    if (index < 0) index = 0;
    const line = lyrics[index];
    const start = Number(line?.time || 0);
    const nextStart = lyrics[index + 1] ? Number(lyrics[index + 1].time || 0) : effectiveDuration;
    const end = Math.max(start + 0.2, Math.min(effectiveDuration || nextStart, nextStart || (start + Number(line?.duration || 5))));
    const lineProgress = Math.max(0, Math.min(1, (targetTime - start) / Math.max(0.2, end - start)));
    return {
      x: Math.max(120, Math.min(rect.width - 120, clientX - rect.left)),
      index,
      total: lyrics.length,
      text: line?.text || '',
      translation: line?.translation || '',
      start,
      end,
      lineProgress
    };
  };

  const updateProgressPreview = (clientX) => {
    setProgressPreview(getLyricPreview(clientX));
  };

  const handleProgressPointerDown = (e) => {
    e.preventDefault();
    setIsSeeking(true);
    updateProgressPreview(e.clientX);
    e.currentTarget.setPointerCapture?.(e.pointerId);
    seekFromClientX(e.clientX);
  };

  const handleProgressPointerMove = (e) => {
    updateProgressPreview(e.clientX);
    if (!isSeeking) return;
    seekFromClientX(e.clientX);
  };

  const handleProgressPointerUp = (e) => {
    setIsSeeking(false);
    e.currentTarget.releasePointerCapture?.(e.pointerId);
  };

  const progressPercent = effectiveDuration ? (progress / effectiveDuration) * 100 : 0;
  const coverUrl = currentSong?.coverUrl || currentSong?.al?.picUrl || 'https://p2.music.126.net/UeTuwE7Cx877Y2gCGIseYg==/109951163026279185.jpg';
  const isLiked = currentSong ? likedSongIds.has(currentSong.id) : false;
  const primaryArtist = currentSong?.ar?.[0] || currentSong?.artists?.[0] || null;
  const albumId = currentSong?.al?.id || currentSong?.album?.id;

  const handleSongClick = () => {
    if (albumId) navigateTo('album-detail', { id: albumId });
  };

  const handleArtistClick = () => {
    if (primaryArtist?.id) navigateTo('artist-detail', { id: primaryArtist.id });
  };

  const handlePlayMode = () => {
    if (playMode === 'sequence') setPlayMode('random');
    else if (playMode === 'random') setPlayMode('single');
    else setPlayMode('sequence');
  };

  return (
    <div id="player-bar" className={currentSong ? 'visible' : ''}>
        
      <div id="player-controls">
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0 }}>
            <ResilientCover
              src={coverUrl}
              alt={currentSong?.name || '专辑封面'}
              className="control-cover"
              style={{ cursor: 'pointer' }}
              onClick={() => { setIsQueueOpen(false); onToggleLyrics?.(); }}
            />
            <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column' }}>
              <span
                onClick={handleSongClick}
                title={albumId ? '打开专辑' : undefined}
                style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', cursor: albumId ? 'pointer' : 'default' }}
              >
                {currentSong?.name || '未播放'}
              </span>
              <span
                onClick={handleArtistClick}
                title={primaryArtist?.id ? '打开歌手' : undefined}
                style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', cursor: primaryArtist?.id ? 'pointer' : 'default' }}
              >
                {primaryArtist?.name || '未知艺术家'}
              </span>
            </div>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <button className="ctrl-btn" onClick={playPrev}>
              <SkipBack size={20} />
            </button>
            <button className="play-btn" onClick={togglePlay}>
              {isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" style={{ marginLeft: 3 }} />}
            </button>
            <button className="ctrl-btn" onClick={playNext}>
              <SkipForward size={20} />
            </button>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-end' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginRight: '8px', fontVariantNumeric: 'tabular-nums' }}>
              {formatTime(progress)} / {formatTime(effectiveDuration)}
            </span>
            <button className="ctrl-btn" onClick={handlePlayMode} title="播放模式">
              {playMode === 'random' ? <Shuffle size={18} /> : playMode === 'single' ? <Repeat1 size={18} /> : <Repeat size={18} />}
            </button>
            <button className="ctrl-btn" onClick={() => currentSong && toggleLike(currentSong.id)} style={{ color: isLiked ? '#ef4444' : '' }}>
              <Heart size={18} fill={isLiked ? "currentColor" : "none"} />
            </button>
            <button className={`ctrl-btn ${isQueueOpen ? 'active' : ''}`} onClick={() => setIsQueueOpen(!isQueueOpen)}>
              <ListMusic size={18} />
            </button>
            <button 
              className={`ctrl-btn ${desktopLyricsConfig?.show ? 'active' : ''}`}
              style={{ 
                fontSize: '11px', 
                fontWeight: 600,
                width: '22px',
                height: '22px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: desktopLyricsConfig?.show ? '1px solid var(--primary)' : '1px solid var(--border, rgba(255,255,255,0.2))',
                borderRadius: '6px',
                color: desktopLyricsConfig?.show ? 'var(--primary)' : 'var(--text-muted)',
                background: desktopLyricsConfig?.show ? 'var(--primary-subtle)' : 'transparent',
                boxShadow: desktopLyricsConfig?.show ? '0 0 8px var(--primary-glow)' : 'none',
                transition: 'all 0.2s ease',
                padding: 0
              }}
              onClick={() => {
                if (window.electronAPI) {
                  window.electronAPI.toggleDesktopLyrics();
                } else {
                  alert("桌面歌词功能仅在桌面客户端可用");
                }
              }}
              title="桌面歌词"
            >
              词
            </button>
            <div className="volume-control-wrapper" style={{ position: 'relative' }}>
              <button className="ctrl-btn" onClick={handleVolumeToggle} title="音量 / 静音">
                {volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
              </button>
              <div className="volume-popover" style={{ bottom: '40px', left: '50%', transform: 'translateX(-50%)' }}>
                <div className="volume-value-bubble">
                  {Math.round(volume * 100)}%
                </div>
                <input 
                  type="range" 
                  className="volume-slider"
                  min="0" 
                  max="1" 
                  step="0.01" 
                  value={volume}
                  onChange={(e) => setVolume(parseFloat(e.target.value))}
                  style={{
                    background: `linear-gradient(to top, var(--primary) ${volume * 100}%, rgba(255, 255, 255, 0.1) ${volume * 100}%)`
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        <div
          id="progress-bar"
          className={isSeeking ? 'seeking' : ''}
          ref={progressRef}
          onPointerDown={handleProgressPointerDown}
          onPointerMove={handleProgressPointerMove}
          onPointerUp={handleProgressPointerUp}
          onPointerCancel={handleProgressPointerUp}
          onPointerLeave={() => {
            if (!isSeeking) setProgressPreview(null);
          }}
        >
          {progressPreview && (
            <div className="progress-lyric-preview" style={{ left: `${progressPreview.x}px` }}>
              <div className="progress-preview-count">{progressPreview.index + 1} / {progressPreview.total}</div>
              <div className="progress-preview-text">{progressPreview.text}</div>
              {progressPreview.translation && <div className="progress-preview-translation">{progressPreview.translation}</div>}
              <div className="progress-preview-line">
                <span>{formatTime(progressPreview.start)}</span>
                <div className="progress-preview-meter">
                  <i style={{ width: `${progressPreview.lineProgress * 100}%` }} />
                </div>
                <span>{formatTime(progressPreview.end)}</span>
              </div>
            </div>
          )}
          <div id="progress-fill" style={{ transform: `scaleX(${Math.max(0, Math.min(1, progressPercent / 100))})` }} />
          <div id="progress-thumb" style={{ left: `${progressPercent}%` }} />
        </div>
      </div>
  );
}
