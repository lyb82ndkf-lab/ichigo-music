import React, { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { api } from '../utils/api';
import { Play, Heart, MessageSquare, Clock } from 'lucide-react';

export default function PlaylistDetail() {
  const { viewData, playSong, likedSongIds, toggleLike, navigateTo } = useApp();
  const [playlist, setPlaylist] = useState(null);
  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState([]);
  const [hotComments, setHotComments] = useState([]);
  
  const [visibleCount, setVisibleCount] = useState(100);

  useEffect(() => {
    setVisibleCount(100);
  }, [viewData]);

  useEffect(() => {
    const handleScroll = (e) => {
      const target = e.target;
      if (!target || !target.scrollHeight) return;

      const { scrollTop, scrollHeight, clientHeight } = target;
      if (scrollHeight - scrollTop - clientHeight < 400) {
        setVisibleCount(prev => Math.min(songs.length, prev + 100));
      }
    };

    window.addEventListener('scroll', handleScroll, true);
    return () => window.removeEventListener('scroll', handleScroll, true);
  }, [songs.length]);

  useEffect(() => {
    if (!viewData?.id) return;
    
    const fetchDetails = async () => {
      setLoading(true);
      setShowComments(false);
      try {
        const detailRes = await api.getPlaylistDetail(viewData.id);
        setPlaylist(detailRes.playlist);

        const tracksRes = await api.getPlaylistTracks(viewData.id, 1000);
        setSongs(tracksRes.songs || detailRes.playlist?.tracks || []);
      } catch (err) {
        console.error('Failed to load playlist:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchDetails();
  }, [viewData]);

  // Load comments if toggled
  const toggleComments = async () => {
    if (showComments) {
      setShowComments(false);
      return;
    }
    
    if (songs.length === 0) return;
    
    // Fetch comments for the first song or a sample song in playlist
    const sampleSongId = songs[0].id;
    try {
      const res = await api.getComments(sampleSongId, 15);
      setComments(res.comments || []);
      setHotComments(res.hotComments || []);
      setShowComments(true);
    } catch (err) {
      console.error(err);
    }
  };

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
        🍓 歌单详情加载中...
      </div>
    );
  }

  if (!playlist) {
    return (
      <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
        加载歌单失败，请重试 🍓
      </div>
    );
  }

  return (
    <div className="view-container">
      {/* Playlist Info Header Card */}
      <div style={{ display: 'flex', gap: '28px', marginBottom: '32px', alignItems: 'flex-start' }}>
        <img 
          src={playlist.coverImgUrl} 
          alt={playlist.name} 
          style={{ width: '200px', height: '200px', borderRadius: 'var(--border-radius-lg)', objectFit: 'cover', boxShadow: '0 10px 30px rgba(0,0,0,0.5)', border: '1px solid var(--card-border)' }}
        />
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <span style={{ fontSize: '12px', textTransform: 'uppercase', color: 'var(--primary)', letterSpacing: '1.5px', fontWeight: 700 }}>歌单</span>
          <h1 style={{ fontFamily: 'var(--font-title)', fontSize: '28px', fontWeight: 800, color: 'var(--text-active)', lineHeight: 1.2 }}>{playlist.name}</h1>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <img 
              src={playlist.creator?.avatarUrl} 
              alt={playlist.creator?.nickname} 
              style={{ width: '24px', height: '24px', borderRadius: '50%' }}
            />
            <span style={{ fontSize: '13px', color: 'var(--text-active)', fontWeight: 500 }}>{playlist.creator?.nickname}</span>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              创建时间: {new Date(playlist.createTime).toLocaleDateString()}
            </span>
          </div>

          {playlist.description && (
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.5', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {playlist.description}
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
            
            <button
              onClick={toggleComments}
              style={{ background: 'var(--glass-bg)', border: '1px solid var(--card-border)', color: 'var(--text-active)', borderRadius: '99px', padding: '10px 20px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer', transition: 'all 0.2s' }}
            >
              <MessageSquare size={16} /> 
              {showComments ? '隐藏歌曲热评' : '歌曲热评'}
            </button>
          </div>
        </div>
      </div>

      {/* Main Grid: Track table / Comments Section */}
      <div style={{ display: 'grid', gridTemplateColumns: showComments ? '60% 40%' : '100%', gap: '30px' }}>
        {/* Track table */}
        <div style={{ overflowX: 'auto' }}>
          <table className="songs-table" style={{ marginTop: 0 }}>
            <thead>
              <tr>
                <th style={{ width: '40%' }}>歌名</th>
                <th style={{ width: '30%' }}>歌手</th>
                <th style={{ width: '20%' }}>专辑</th>
                <th style={{ width: '10%' }}>时长</th>
              </tr>
            </thead>
            <tbody>
              {songs.slice(0, visibleCount).map((song, index) => {
                const isLiked = likedSongIds.has(song.id);
                return (
                  <tr 
                    key={song.id} 
                    className="song-row"
                    onDoubleClick={() => playSong(song, songs)}
                  >
                    <td>
                      <div className="song-title-cell">
                        <span style={{ width: '22px', fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center' }}>
                          {(index + 1).toString().padStart(2, '0')}
                        </span>
                        
                        <button
                          className="play-pause-btn"
                          style={{ width: '26px', height: '26px', boxShadow: 'none' }}
                          onClick={() => playSong(song, songs)}
                        >
                          <Play size={10} fill="currentColor" style={{ marginLeft: 1 }} />
                        </button>
                        
                        <div className="song-row-info">
                          <div className="song-row-name" onClick={() => playSong(song, songs)} >
                            {song.name}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="song-row-artists" >
                        {song.ar?.map((artist, idx) => (
                          <React.Fragment key={artist.id}>
                            {idx > 0 && ' / '}
                            <span onClick={() => navigateTo('artist-detail', { id: artist.id })}>
                              {artist.name}
                            </span>
                          </React.Fragment>
                        )) || '未知歌手'}
                      </div>
                    </td>
                    <td style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      <span 
                        onClick={() => navigateTo('album-detail', { id: song.al?.id })}
                        style={{ cursor: 'pointer' }}
                      >
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

        {/* Comments section */}
        {showComments && (
          <div style={{ background: 'var(--surface-bg)', border: '1px solid var(--card-border)', borderRadius: 'var(--border-radius-lg)', padding: '20px', height: 'fit-content', maxHeight: '600px', overflowY: 'auto' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '16px', color: 'var(--text-main)', borderBottom: '1px solid var(--card-border)', paddingBottom: '10px' }}>
              首推曲目评论区
            </h3>
            
            {/* Hot Comments */}
            {hotComments.length > 0 && (
              <div style={{ marginBottom: '24px' }}>
                <span style={{ fontSize: '11px', color: 'var(--primary)', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase' }}>精彩评论</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '10px' }}>
                  {hotComments.map(c => (
                    <div key={c.commentId} style={{ display: 'flex', gap: '10px', fontSize: '12px' }}>
                      <img src={c.user.avatarUrl} alt="" style={{ width: '28px', height: '28px', borderRadius: '50%' }} />
                      <div style={{ flex: 1 }}>
                        <div>
                          <span style={{ fontWeight: 600, color: 'var(--text-active)' }}>{c.user.nickname}</span>
                          <span style={{ color: 'var(--text-muted)', fontSize: '10px', marginLeft: '8px' }}>{c.timeStr}</span>
                        </div>
                        <p style={{ color: 'var(--text-main)', marginTop: '4px', lineHeight: '1.4' }}>{c.content}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent Comments */}
            <div>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase' }}>最新评论</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '10px' }}>
                {comments.map(c => (
                  <div key={c.commentId} style={{ display: 'flex', gap: '10px', fontSize: '12px' }}>
                    <img src={c.user.avatarUrl} alt="" style={{ width: '28px', height: '28px', borderRadius: '50%' }} />
                    <div style={{ flex: 1 }}>
                      <div>
                        <span style={{ fontWeight: 600, color: 'var(--text-active)' }}>{c.user.nickname}</span>
                        <span style={{ color: 'var(--text-muted)', fontSize: '10px', marginLeft: '8px' }}>{c.timeStr}</span>
                      </div>
                      <p style={{ color: 'var(--text-main)', marginTop: '4px', lineHeight: '1.4' }}>{c.content}</p>
                    </div>
                  </div>
                ))}
                {comments.length === 0 && (
                  <div style={{ color: 'var(--text-muted)', fontSize: '12px', textAlign: 'center', padding: '20px 0' }}>暂无评论记录</div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
