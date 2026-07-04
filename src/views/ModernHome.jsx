import React from 'react';
import { useApp } from '../context/AppContext';
import { Compass, TrendingUp, Heart, History, Settings, Play, Music } from 'lucide-react';
import GlassNavCard from '../components/GlassNavCard';
import { useLyricEngine } from '../hooks/useLyricEngine';

function GlassTile({ song }) {
  const { playSong } = useApp();
  const coverUrl = song?.coverUrl || song?.al?.picUrl || 'https://p2.music.126.net/UeTuwE7Cx877Y2gCGIseYg==/109951163026279185.jpg';
  
  return (
    <div className="home-glass-tile" onClick={() => playSong(song)}>
      <img src={coverUrl} alt="cover" className="tile-cover" />
      <div className="tile-info">
        <div className="tile-name">{song.name}</div>
        <div className="tile-artist">{song.ar?.[0]?.name || '未知艺术家'}</div>
      </div>
      <button className="tile-play-btn"><Play size={16} fill="currentColor" /></button>
    </div>
  );
}

function GlassPlaylistTile({ playlist }) {
  const { navigateTo } = useApp();
  const coverUrl = playlist?.coverImgUrl || 'https://p2.music.126.net/UeTuwE7Cx877Y2gCGIseYg==/109951163026279185.jpg';
  
  return (
    <div className="home-glass-tile" onClick={() => navigateTo('playlist-detail', { id: playlist.id })}>
      <img src={coverUrl} alt="cover" className="tile-cover" />
      <div className="tile-info">
        <div className="tile-name">{playlist.name}</div>
        <div className="tile-artist">{playlist.trackCount || 0} 首歌曲</div>
      </div>
      <button className="tile-play-btn"><Music size={16} /></button>
    </div>
  );
}

export default function ModernHome() {
  const { currentSong, isPlaying, togglePlay, navigateTo, recentlyPlayed, audioElement, userPlaylists } = useApp();
  const { lyrics, activeLineIndex } = useLyricEngine(currentSong?.id, audioElement);

  const openSearch = () => {
    navigateTo('search');
  };

  const coverUrl = currentSong?.coverUrl || currentSong?.al?.picUrl;
  const activeLyric = activeLineIndex >= 0 && lyrics[activeLineIndex] ? lyrics[activeLineIndex].text : '';

  return (
    <div id="modern-home" className="modern-home">
      <div className="home-hero glass-hero">
        <div className="home-hero-inner" style={{ display: 'flex', alignItems: 'center', gap: '32px' }}>
          {coverUrl ? (
            <div className="hero-cover-container" style={{ flexShrink: 0, position: 'relative' }}>
              <img 
                src={coverUrl} 
                alt="cover" 
                style={{ width: '160px', height: '160px', borderRadius: '20px', objectFit: 'cover', boxShadow: '0 24px 48px rgba(0,0,0,0.4)', zIndex: 2, position: 'relative' }} 
              />
              <div 
                className="hero-cover-glow" 
                style={{ position: 'absolute', inset: 0, background: `url(${coverUrl})`, filter: 'blur(32px)', opacity: 0.6, zIndex: 1, transform: 'translateY(10px) scale(1.05)', backgroundSize: 'cover' }} 
              />
            </div>
          ) : (
            <div className="hero-cover-placeholder" style={{ width: '160px', height: '160px', borderRadius: '20px', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 24px 48px rgba(0,0,0,0.2)', flexShrink: 0 }}>
              <Music size={48} color="rgba(255,255,255,0.1)" />
            </div>
          )}
          
          <div className="hero-info" style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div className="home-kicker">ICHIGOMUSIC</div>
            <div className="home-title" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {currentSong ? currentSong.name : '听你所想，享你所爱'}
            </div>
            <div className="home-sub" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {currentSong ? `${currentSong.ar?.[0]?.name || '未知艺术家'} · ${currentSong.al?.name || '未知专辑'}` : '选择一首歌开始'}
            </div>
            
            {activeLyric && (
              <div className="hero-lyric" style={{ marginTop: '-12px', marginBottom: '20px', fontSize: '15px', color: 'rgba(255,255,255,0.8)', fontStyle: 'italic', height: '22px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                ♪ {activeLyric}
              </div>
            )}
            
            {!activeLyric && currentSong && (
              <div style={{ height: '22px', marginTop: '-12px', marginBottom: '20px' }} />
            )}

            <div className="home-quick-row">
              <button className="home-chip" onClick={() => { if (currentSong) togglePlay(); else navigateTo('discover'); }}>
                {currentSong ? (isPlaying ? '暂停播放' : '继续播放') : '开始探索'}
              </button>
              <button className="home-chip home-accent-chip" onClick={openSearch}>搜索音乐</button>
            </div>
          </div>
        </div>
      </div>

      <div className="home-card-grid">
        <GlassNavCard icon={<Compass />} label="DISCOVER" title="发现音乐" sub="每天都有新发现" color="discover" onClick={() => navigateTo('discover')} />
        <GlassNavCard icon={<TrendingUp />} label="LEADERBOARD" title="排行榜" sub="时下最热单曲" color="leaderboard" onClick={() => navigateTo('leaderboards')} />
        <GlassNavCard icon={<Heart />} label="LIKED SONGS" title="我喜欢的音乐" sub="你的私人珍藏" color="liked" onClick={() => navigateTo('liked')} />
        <GlassNavCard icon={<History />} label="RECENT" title="最近播放" sub="时光机" color="recent" onClick={() => navigateTo('recent')} />
        <GlassNavCard icon={<Settings />} label="SETTINGS" title="设置" sub="应用偏好" color="settings" onClick={() => navigateTo('settings')} />
      </div>

      {recentlyPlayed && recentlyPlayed.length > 0 && (
        <div className="home-rail">
          <div className="home-section-head">
            <div className="home-section-title">最近播放</div>
          </div>
          <div className="home-tile-row">
            {recentlyPlayed.slice(0, 5).map(song => (
              <GlassTile key={song.id} song={song} />
            ))}
          </div>
        </div>
      )}

      {userPlaylists && userPlaylists.length > 0 && (
        <div className="home-rail" style={{ marginTop: '24px' }}>
          <div className="home-section-head">
            <div className="home-section-title">我的歌单</div>
          </div>
          <div className="home-tile-row">
            {userPlaylists.map(playlist => (
              <GlassPlaylistTile key={playlist.id} playlist={playlist} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
