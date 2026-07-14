import React, { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { api } from '../utils/api';
import { Play, Heart } from 'lucide-react';

export default function AlbumDetail() {
  const { viewData, playSong, likedSongIds, toggleLike, navigateTo } = useApp();
  const [album, setAlbum] = useState(null);
  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!viewData?.id) return;

    const fetchAlbumDetails = async () => {
      setLoading(true);
      try {
        const res = await api.getAlbumDetail(viewData.id);
        setAlbum(res.album);
        setSongs(res.songs || []);
      } catch (err) {
        console.error('Failed to load album:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchAlbumDetails();
  }, [viewData]);

  const playAll = () => {
    if (songs.length > 0) {
      playSong(songs[0], songs);
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
        🍓 专辑详情加载中...
      </div>
    );
  }

  if (!album) {
    return (
      <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
        加载专辑失败，请重试 🍓
      </div>
    );
  }

  return (
    <div className="view-container">
      {/* Album Info Header Card */}
      <div style={{ display: 'flex', gap: '28px', marginBottom: '32px', alignItems: 'flex-start' }}>
        <img 
          src={album.picUrl} 
          alt={album.name} 
          style={{ width: '200px', height: '200px', borderRadius: 'var(--border-radius-lg)', objectFit: 'cover', boxShadow: '0 10px 30px rgba(0,0,0,0.5)', border: '1px solid var(--card-border)' }}
        />
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <span style={{ fontSize: '12px', textTransform: 'uppercase', color: 'var(--primary)', letterSpacing: '1.5px', fontWeight: 700 }}>专辑</span>
          <h1 style={{ fontFamily: 'var(--font-title)', fontSize: '28px', fontWeight: 800, color: 'var(--text-active)', lineHeight: 1.2 }}>{album.name}</h1>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '13px', color: 'var(--text-active)', fontWeight: 500 }}>
              歌手: <span onClick={() => navigateTo('artist-detail', { id: album.artist?.id })} style={{ cursor: 'pointer', textDecoration: 'underline' }}>{album.artist?.name}</span>
            </span>
            <span style={{ color: 'var(--text-muted)' }}>|</span>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              发行公司: {album.company || '独立发行'}
            </span>
            <span style={{ color: 'var(--text-muted)' }}>|</span>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              发行日期: {new Date(album.publishTime).toLocaleDateString()}
            </span>
          </div>

          {album.description && (
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.5', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', textOverflow: 'ellipsis' }} title={album.description}>
              {album.description}
            </p>
          )}

          <div style={{ display: 'flex', gap: '12px', marginTop: '6px' }}>
            <button 
              className="play-pause-btn"
              style={{ borderRadius: '99px', width: 'auto', height: 'auto', padding: '10px 24px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 600 }}
              onClick={playAll}
            >
              <Play size={16} fill="currentColor" /> 播放全部
            </button>
          </div>
        </div>
      </div>

      {/* Album Tracks Table */}
      <div style={{ overflowX: 'auto' }}>
        <table className="songs-table" style={{ marginTop: 0 }}>
          <thead>
            <tr>
              <th style={{ width: '10%' }}>#</th>
              <th style={{ width: '50%' }}>歌名</th>
              <th style={{ width: '30%' }}>歌手</th>
              <th style={{ width: '10%' }}>时长</th>
            </tr>
          </thead>
          <tbody>
            {songs.map((song, index) => {
              const isLiked = likedSongIds.has(song.id);
              return (
                <tr 
                  key={song.id} 
                  className="song-row"
                  onDoubleClick={() => playSong(song, songs)}
                >
                  <td style={{ color: 'var(--text-muted)', paddingLeft: '16px' }}>
                    {(index + 1).toString().padStart(2, '0')}
                  </td>
                  <td>
                    <div className="song-title-cell">
                      <button
                        className="play-pause-btn"
                        style={{ width: '24px', height: '24px', boxShadow: 'none' }}
                        onClick={() => playSong(song, songs)}
                      >
                        <Play size={10} fill="currentColor" style={{ marginLeft: 1 }} />
                      </button>
                      <div className="song-row-info">
                        <div className="song-row-name" onClick={() => playSong(song, songs)}>
                          {song.name}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="song-row-artists">
                      {song.ar?.map((artist, idx) => (
                        <React.Fragment key={artist.id}>
                          {idx > 0 && ' / '}
                          <span onClick={() => navigateTo('artist-detail', { id: artist.id })}>
                            {artist.name}
                          </span>
                        </React.Fragment>
                      )) || album.artist?.name}
                    </div>
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
    </div>
  );
}
