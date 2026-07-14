import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { 
  Play, 
  Pause, 
  SkipForward, 
  SkipBack, 
  Volume2, 
  VolumeX, 
  Maximize2, 
  Minimize2,
  Heart,
  Shuffle,
  Repeat,
  Repeat1,
  ListMusic,
  Trash2,
  Tv
} from 'lucide-react';

export default function PlayerBar({ onToggleLyrics, isLyricsOpen }) {
  const {
    currentSong,
    isPlaying,
    togglePlay,
    playNext,
    playPrev,
    volume,
    setVolume,
    progress,
    duration,
    audioElement,
    playMode,
    setPlayMode,
    playlist,
    setPlaylist,
    playlistIndex,
    playSong,
    likedSongIds,
    toggleLike,
    navigateTo,
    audioQuality,
    setAudioQuality,
    desktopLyricsConfig
  } = useApp();

  const [showQueue, setShowQueue] = useState(false);
  const [prevVolume, setPrevVolume] = useState(0.8);
  const [showQualityMenu, setShowQualityMenu] = useState(false);

  const formatTime = (s) => {
    if (isNaN(s) || s === Infinity) return '00:00';
    const min = Math.floor(s / 60).toString().padStart(2, '0');
    const sec = Math.floor(s % 60).toString().padStart(2, '0');
    return `${min}:${sec}`;
  };

  const handleProgressChange = (e) => {
    if (audioElement && duration) {
      const percentage = parseFloat(e.target.value);
      const newTime = (percentage / 100) * duration;
      audioElement.currentTime = newTime;
    }
  };

  const handleVolumeToggle = () => {
    if (volume > 0) {
      setPrevVolume(volume);
      setVolume(0);
    } else {
      setVolume(prevVolume);
    }
  };

  const handleRemoveFromQueue = (index, e) => {
    e.stopPropagation();
    const newQueue = [...playlist];
    newQueue.splice(index, 1);
    setPlaylist(newQueue);
    
    // Adjust active index
    if (index === playlistIndex) {
      if (newQueue.length === 0) {
        // Queue empty
        audioElement.pause();
        playSong(null);
      } else {
        const nextIdx = index % newQueue.length;
        playSong(newQueue[nextIdx], newQueue);
      }
    }
  };

  const progressPercent = duration ? (progress / duration) * 100 : 0;
  const isLiked = currentSong ? likedSongIds.has(currentSong.id) : false;

  return (
    <div className="app-player-bar">
      {/* Left Pane: Song metadata info */}
      <div className="player-song-info">
        {currentSong ? (
          <>
            <img 
              src={currentSong?.coverUrl || 'https://p2.music.126.net/UeTuwE7Cx877Y2gCGIseYg==/109951163026279185.jpg'} 
              alt={currentSong?.title || 'Unknown'} 
              className={`player-cover ${isPlaying ? 'playing' : ''}`}
              onClick={onToggleLyrics}
            />
            <div className="player-song-details">
              <div 
                className="player-song-name" 
                onClick={onToggleLyrics}
              >
                {currentSong?.title || 'Unknown'}
              </div>
              <div className="player-song-artists">
                {currentSong.ar?.map((artist, idx) => (
                  <React.Fragment key={artist.id}>
                    {idx > 0 && ' / '}
                    <span onClick={() => navigateTo('artist-detail', { id: artist.id })}>
                      {artist.name}
                    </span>
                  </React.Fragment>
                )) || currentSong.artist}
              </div>
            </div>
            
            <button 
              className={`player-like-btn ${isLiked ? 'liked' : ''}`}
              onClick={() => toggleLike(currentSong.id)}
            >
              <Heart size={16} fill={isLiked ? 'currentColor' : 'none'} />
            </button>
            
            {currentSong.mv || currentSong.mvid ? (
              <button 
                className="control-btn"
                style={{ marginLeft: 6 }}
                onClick={() => navigateTo('mv-player', { id: currentSong.mv || currentSong.mvid })}
                title="播放MV"
              >
                <Tv size={16} />
              </button>
            ) : null}
          </>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div className="player-cover" style={{ background: 'var(--surface-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>🍓</div>
            <div className="player-song-details">
              <div className="player-song-name" style={{ color: 'var(--text-muted)' }}>听你所想，享你所爱</div>
              <div className="player-song-artists">ICHIGOMusic</div>
            </div>
          </div>
        )}
      </div>

      {/* Center Pane: Playing state controls and scrubbers */}
      <div className="player-controls-center">
        <div className="control-buttons">
          {/* Mode Switch */}
          <button 
            className={`control-btn ${playMode !== 'sequence' ? 'active' : ''}`}
            onClick={() => {
              if (playMode === 'sequence') setPlayMode('random');
              else if (playMode === 'random') setPlayMode('single');
              else setPlayMode('sequence');
            }}
            title={playMode === 'sequence' ? '列表循环' : playMode === 'random' ? '随机播放' : '单曲循环'}
          >
            {playMode === 'sequence' && <Repeat size={16} />}
            {playMode === 'random' && <Shuffle size={16} />}
            {playMode === 'single' && <Repeat1 size={16} />}
          </button>

          <button className="control-btn" onClick={playPrev}>
            <SkipBack size={20} fill="currentColor" />
          </button>

          <button className="play-pause-btn" onClick={togglePlay}>
            {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" style={{ marginLeft: 2 }} />}
          </button>

          <button className="control-btn" onClick={playNext}>
            <SkipForward size={20} fill="currentColor" />
          </button>

          <button 
            className={`control-btn ${showQueue ? 'active' : ''}`}
            onClick={() => setShowQueue(!showQueue)}
            title="播放队列"
          >
            <ListMusic size={16} />
          </button>
        </div>

        <div className="progress-bar-container">
          <span>{formatTime(progress)}</span>
          <div className="progress-slider">
            <input 
              type="range"
              min="0"
              max="100"
              value={progressPercent}
              onChange={handleProgressChange}
              style={{
                position: 'absolute',
                width: '100%',
                height: '100%',
                opacity: 0,
                cursor: 'pointer',
                zIndex: 5
              }}
            />
            <div className="progress-fill" style={{ width: `${progressPercent}%` }}>
              <div className="progress-handle"></div>
            </div>
          </div>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Right Pane: Extra toggles (Volume, Full Screen Lyrics) */}
      <div className="player-controls-right" style={{ gap: '10px' }}>
        {/* Audio Quality Selector */}
        <div className="quality-control-wrapper" style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <button 
            className="control-btn" 
            style={{ 
              fontSize: '10px', 
              fontWeight: 700, 
              padding: '2px 6px', 
              border: '1px solid var(--primary)', 
              color: 'var(--primary)', 
              borderRadius: '4px',
              textTransform: 'uppercase',
              minWidth: '38px',
              textAlign: 'center'
            }} 
            onClick={() => setShowQualityMenu(!showQualityMenu)}
            title="切换音质"
          >
            {audioQuality === 'standard' ? '标准' :
             audioQuality === 'higher' ? '较高' :
             audioQuality === 'exhigh' ? '极高' :
             audioQuality === 'lossless' ? '无损' : 'Hi-Res'}
          </button>
          
          {showQualityMenu && (
            <div 
              className="quality-popover"
              style={{
                position: 'absolute',
                bottom: '40px',
                left: '50%',
                transform: 'translateX(-50%)',
                background: 'var(--overlay-bg)',
                border: '1px solid var(--card-border)',
                borderRadius: '8px',
                padding: '6px',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
                minWidth: '85px',
                zIndex: 100,
                boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                backdropFilter: 'blur(20px)'
              }}
            >
              {[
                { key: 'hires', label: 'Hi-Res' },
                { key: 'lossless', label: '无损' },
                { key: 'exhigh', label: '极高' },
                { key: 'higher', label: '较高' },
                { key: 'standard', label: '标准' }
              ].map(q => (
                <button
                  key={q.key}
                  style={{
                    background: audioQuality === q.key ? 'var(--primary)' : 'transparent',
                    color: audioQuality === q.key ? 'var(--primary-text)' : 'var(--text-main)',
                    border: 'none',
                    borderRadius: '4px',
                    padding: '4px 8px',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    textAlign: 'center',
                    transition: 'all 0.2s'
                  }}
                  onClick={() => {
                    setAudioQuality(q.key);
                    setShowQualityMenu(false);
                  }}
                >
                  {q.label}
                </button>
              ))}
            </div>
          )}
        </div>
        
        {/* Desktop Lyrics Toggle */}
        <button 
          className={`control-btn ${desktopLyricsConfig?.show ? 'active' : ''}`}
          style={{ 
            fontSize: '11px', 
            fontWeight: 600,
            width: '24px',
            height: '24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: desktopLyricsConfig?.show ? '1px solid var(--primary)' : '1px solid rgba(255,255,255,0.2)',
            borderRadius: '6px',
            color: desktopLyricsConfig?.show ? 'var(--primary)' : 'inherit',
            background: desktopLyricsConfig?.show ? 'var(--primary-subtle)' : 'transparent',
            boxShadow: desktopLyricsConfig?.show ? '0 0 8px var(--primary-glow)' : 'none',
            transition: 'all 0.2s ease'
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

        {/* Volume adjust */}
        <div className="volume-control-wrapper">
          <button className="control-btn" onClick={handleVolumeToggle} title="音量 / 静音">
            {volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>
          <div className="volume-popover">
            <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-main)', userSelect: 'none' }}>
              {Math.round(volume * 100)}%
            </span>
            <input 
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={volume}
              onChange={(e) => setVolume(parseFloat(e.target.value))}
              style={{
                accentColor: 'var(--primary)',
                cursor: 'pointer'
              }}
            />
          </div>
        </div>

        <button 
          className="control-btn" 
          onClick={onToggleLyrics}
          title={isLyricsOpen ? "收起全屏" : "展开全屏"}
        >
          {isLyricsOpen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
        </button>
      </div>

      {/* Queue Drawer Popup Panel */}
      {showQueue && (
        <div className="play-queue-popover">
          <div className="flex-between" style={{ borderBottom: '1px solid var(--card-border)', paddingBottom: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 700 }}>播放列表 ({playlist.length})</span>
            {playlist.length > 0 && (
              <button 
                onClick={() => {
                  setPlaylist([]);
                  audioElement?.pause();
                  playSong(null);
                }}
                style={{ background: 'none', border: 'none', color: '#ef4444', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, cursor: 'pointer' }}
              >
                <Trash2 size={12} />
                清空
              </button>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, overflowY: 'auto', paddingRight: '4px' }}>
            {playlist.map((song, index) => {
              const isActive = index === playlistIndex;
              return (
                <div 
                  key={song.id + '-' + index}
                  onClick={() => playSong(song, playlist)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 10,
                    minWidth: 0,
                    padding: '8px 10px',
                    borderRadius: 'var(--border-radius-md)',
                    background: isActive ? 'var(--primary-subtle)' : 'transparent',
                    border: isActive ? '1px solid var(--primary-glow)' : '1px solid transparent',
                    cursor: 'pointer',
                    fontSize: 12
                  }}
                >
                  <div className="song-row-info">
                    <div className="song-row-name" style={{ fontWeight: 600, color: isActive ? 'var(--primary)' : 'var(--text-main)' }}>
                      {song.name || song.title}
                    </div>
                    <div className="song-row-artist" style={{ fontSize: 10 }}>
                      {song.artist || song.ar?.map(a => a.name).join(' / ')}
                    </div>
                  </div>
                  <button 
                    onClick={(e) => handleRemoveFromQueue(index, e)}
                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', flexShrink: 0 }}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              );
            })}
            {playlist.length === 0 && (
              <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
                播放列表空空如也~
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
