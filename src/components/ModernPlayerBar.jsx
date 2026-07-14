import React, { useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import { Play, Pause, SkipBack, SkipForward, Heart, Shuffle, Repeat, Repeat1, ListMusic, Volume2, VolumeX } from 'lucide-react';

export default function ModernPlayerBar({ onToggleLyrics }) {
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
    desktopLyricsConfig
  } = useApp();

  const [prevVolume, setPrevVolume] = useState(0.8);
  const handleVolumeToggle = () => {
    if (volume > 0) {
      setPrevVolume(volume);
      setVolume(0);
    } else {
      setVolume(prevVolume);
    }
  };

  const progressRef = useRef(null);

  const formatTime = (time) => {
    if (!time || isNaN(time)) return '00:00';
    const min = Math.floor(time / 60).toString().padStart(2, '0');
    const sec = Math.floor(time % 60).toString().padStart(2, '0');
    return `${min}:${sec}`;
  };

  const handleProgressClick = (e) => {
    if (!progressRef.current || !duration) return;
    const rect = progressRef.current.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    if (audioElement) audioElement.currentTime = percent * duration;
  };

  const progressPercent = duration ? (progress / duration) * 100 : 0;
  const coverUrl = currentSong?.coverUrl || currentSong?.al?.picUrl || 'https://p2.music.126.net/UeTuwE7Cx877Y2gCGIseYg==/109951163026279185.jpg';
  const isLiked = currentSong ? likedSongIds.has(currentSong.id) : false;

  const handlePlayMode = () => {
    if (playMode === 'sequence') setPlayMode('random');
    else if (playMode === 'random') setPlayMode('single');
    else setPlayMode('sequence');
  };

  return (
    <div id="player-bar" className={currentSong ? 'visible' : ''}>
        
      <div id="player-controls">
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0 }}>
            <div className="control-cover" style={{ backgroundImage: `url(${coverUrl})`, cursor: 'pointer' }} onClick={() => { setIsQueueOpen(false); onToggleLyrics?.(); }} title="\u70b9\u51fb\u8fdb\u5165\u6c89\u6d78\u6a21\u5f0f" />
            <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {currentSong?.name || '未播放'}
              </span>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {currentSong?.ar?.[0]?.name || '未知艺术家'}
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
              {formatTime(progress)} / {formatTime(duration)}
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

        <div id="progress-bar" ref={progressRef} onClick={handleProgressClick}>
          <div id="progress-fill" style={{ width: `${progressPercent}%` }} />
          <div id="progress-thumb" style={{ left: `${progressPercent}%` }} />
        </div>
      </div>
  );
}
