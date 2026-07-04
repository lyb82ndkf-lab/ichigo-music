import React, { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { api } from '../utils/api';
import { Play, Heart, Music, Award, Video, Info } from 'lucide-react';

const artistTabs = [
  { key: 'songs', name: '热门单曲', icon: Music },
  { key: 'albums', name: '所有专辑', icon: Award },
  { key: 'mvs', name: '相关MV', icon: Video },
  { key: 'desc', name: '艺人介绍', icon: Info }
];

export default function ArtistDetail() {
  const { viewData, playSong, likedSongIds, toggleLike, navigateTo } = useApp();
  const [artist, setArtist] = useState(null);
  const [hotSongs, setHotSongs] = useState([]);
  const [albums, setAlbums] = useState([]);
  const [mvs, setMvs] = useState([]);
  const [desc, setDesc] = useState('');
  const [activeTab, setActiveTab] = useState('songs');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!viewData?.id) return;

    const fetchArtistData = async () => {
      setLoading(true);
      try {
        // Fetch Artist details and Hot Songs
        const mainRes = await api.getArtistDetail(viewData.id);
        setArtist(mainRes.artist);
        setHotSongs(mainRes.hotSongs || []);

        // Fetch Artist Albums
        const albumsRes = await api.getArtistAlbums(viewData.id, 24);
        setAlbums(albumsRes.hotAlbums || []);

        // Fetch Artist MVs
        const mvsRes = await api.getArtistMVs(viewData.id);
        setMvs(mvsRes.mvs || []);

        // Fetch biography
        const descRes = await fetch(`/api/artist/desc?id=${viewData.id}`).then(res => res.json()).catch(() => ({}));
        setDesc(descRes.briefDesc || mainRes.artist?.briefDesc || '暂无详细介绍');
      } catch (err) {
        console.error('Failed to load artist details:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchArtistData();
  }, [viewData]);

  const playAllHot = () => {
    if (hotSongs.length > 0) {
      playSong(hotSongs[0], hotSongs);
    }
  };

  const formatDuration = (ms) => {
    const s = Math.floor(ms / 1000);
    const min = Math.floor(s / 60).toString().padStart(2, '0');
    const sec = Math.floor(s % 60).toString().padStart(2, '0');
    return `${min}:${sec}`;
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
        🍓 歌手详情加载中...
      </div>
    );
  }

  if (!artist) {
    return (
      <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
        加载歌手信息失败，请重试 🍓
      </div>
    );
  }

  return (
    <div className="view-container">
      {/* Artist Profile Header Card */}
      <div 
        style={{ 
          position: 'relative', 
          height: '280px', 
          borderRadius: 'var(--border-radius-lg)', 
          overflow: 'hidden', 
          marginBottom: '32px',
          backgroundImage: `linear-gradient(to bottom, rgba(0,0,0,0.1), rgba(0,0,0,0.85)), url(${artist.picUrl})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center 30%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end',
          padding: '40px',
          boxShadow: '0 10px 30px rgba(0, 0, 0, 0.4)',
          border: '1px solid var(--card-border)'
        }}
      >
        <span style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--primary)', letterSpacing: '1.5px', fontWeight: 700, marginBottom: '8px' }}>艺人歌手</span>
        <h1 style={{ fontFamily: 'var(--font-title)', fontSize: '36px', fontWeight: 800, color: 'var(--text-active)', lineHeight: 1.2 }}>{artist.name}</h1>
        {artist.alias?.length > 0 && (
          <div style={{ fontSize: '14px', color: 'var(--text-muted)', marginTop: '4px', fontWeight: 500 }}>
            {artist.alias.join(' / ')}
          </div>
        )}
        <div style={{ display: 'flex', gap: '20px', marginTop: '16px', fontSize: '12px', color: 'var(--text-muted)' }}>
          <span>单曲: <strong>{artist.musicSize}</strong>首</span>
          <span>专辑: <strong>{artist.albumSize}</strong>张</span>
          <span>MV: <strong>{artist.mvSize}</strong>个</span>
        </div>
      </div>

      {/* Artist Tabs */}
      <div className="search-tabs">
        {artistTabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              className={`search-tab-btn ${isActive ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.key)}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <Icon size={14} />
              <span>{tab.name}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Contents */}
      <div style={{ marginTop: '20px' }}>
        {/* Hot Songs Tab */}
        {activeTab === 'songs' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 700 }}>热门单曲 (前50首)</h3>
              <button 
                className="play-pause-btn"
                style={{ borderRadius: '99px', width: 'auto', height: 'auto', padding: '8px 18px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}
                onClick={playAllHot}
              >
                <Play size={14} fill="currentColor" /> 播放全部
              </button>
            </div>
            
            <table className="songs-table" style={{ marginTop: 0 }}>
              <thead>
                <tr>
                  <th style={{ width: '10%' }}>#</th>
                  <th style={{ width: '50%' }}>歌名</th>
                  <th style={{ width: '30%' }}>专辑</th>
                  <th style={{ width: '10%' }}>时长</th>
                </tr>
              </thead>
              <tbody>
                {hotSongs.map((song, index) => {
                  const isLiked = likedSongIds.has(song.id);
                  return (
                    <tr 
                      key={song.id} 
                      className="song-row"
                      onDoubleClick={() => playSong(song, hotSongs)}
                    >
                      <td style={{ color: 'var(--text-muted)', paddingLeft: '16px' }}>
                        {(index + 1).toString().padStart(2, '0')}
                      </td>
                      <td>
                        <div className="song-title-cell">
                          <button
                            className="play-pause-btn"
                            style={{ width: '24px', height: '24px', boxShadow: 'none' }}
                            onClick={() => playSong(song, hotSongs)}
                          >
                            <Play size={10} fill="currentColor" style={{ marginLeft: 1 }} />
                          </button>
                          <div className="song-row-info">
                            <div className="song-row-name" onClick={() => playSong(song, hotSongs)}>
                              {song.name}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td style={{ color: 'var(--text-muted)' }}>
                        <span onClick={() => navigateTo('album-detail', { id: song.al?.id })} style={{ cursor: 'pointer' }}>
                          {song.al?.name}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--text-muted)' }}>
                          <span>{formatDuration(song.dt)}</span>
                          <button 
                            className={`player-like-btn ${isLiked ? 'liked' : ''}`}
                            onClick={() => toggleLike(song.id)}
                            style={{ padding: 0 }}
                          >
                            <Heart size={14} fill={isLiked ? 'currentColor' : 'none'} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Albums Tab */}
        {activeTab === 'albums' && (
          <div className="grid-6">
            {albums.map(album => (
              <div 
                key={album.id} 
                className="music-card"
                onClick={() => navigateTo('album-detail', { id: album.id })}
              >
                <div className="card-image-wrap">
                  <img src={album.picUrl} alt="" className="card-image" />
                </div>
                <div className="card-title">{album.name}</div>
                <div className="card-desc">
                  {new Date(album.publishTime).getFullYear()} · {album.size}首歌曲
                </div>
              </div>
            ))}
            {albums.length === 0 && (
              <div style={{ gridColumn: 'span 6', textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
                暂无专辑记录
              </div>
            )}
          </div>
        )}

        {/* MVs Tab */}
        {activeTab === 'mvs' && (
          <div className="grid-6">
            {mvs.map(mv => (
              <div 
                key={mv.id} 
                className="music-card"
                onClick={() => navigateTo('mv-player', { id: mv.id })}
              >
                <div className="card-image-wrap" style={{ aspectRatio: '16/9' }}>
                  <img src={mv.imgurl16v9 || mv.imgurl} alt="" className="card-image" />
                </div>
                <div className="card-title">{mv.name}</div>
                <div className="card-desc">{mv.publishTime} · {mv.playCount ? `${Math.floor(mv.playCount / 10000)}万播放` : ''}</div>
              </div>
            ))}
            {mvs.length === 0 && (
              <div style={{ gridColumn: 'span 6', textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
                暂无MV记录
              </div>
            )}
          </div>
        )}

        {/* Bio Description Tab */}
        {activeTab === 'desc' && (
          <div 
            style={{ 
              background: 'var(--surface-bg)', 
              border: '1px solid var(--card-border)', 
              borderRadius: 'var(--border-radius-lg)', 
              padding: '30px', 
              fontSize: '14px', 
              lineHeight: '1.8', 
              color: 'var(--text-main)', 
              whiteSpace: 'pre-wrap' 
            }}
          >
            {desc}
          </div>
        )}
      </div>
    </div>
  );
}
