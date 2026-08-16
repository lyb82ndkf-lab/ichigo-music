import React, { useEffect, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import { api } from '../utils/api';
import { Play, Heart, LogIn, HeartPulse } from 'lucide-react';

const mergeSongs = (prev, next) => {
  const seen = new Set(prev.map((song) => String(song?.id ?? '')));
  const merged = [...prev];
  for (const song of next) {
    const id = String(song?.id ?? '');
    if (!id || seen.has(id)) continue;
    seen.add(id);
    merged.push(song);
  }
  return merged;
};

export default function MyLiked() {
  const { 
    user, 
    likedPlaylistId, 
    playSong, 
    startHeartMode,
    playMode,
    likedSongIds, 
    toggleLike, 
    navigateTo 
  } = useApp();
  
  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [visibleCount, setVisibleCount] = useState(100);
  const pendingPlayAllRef = useRef(false);

  useEffect(() => {
    setVisibleCount(100);
  }, [likedPlaylistId]);

  useEffect(() => {
    const handleScroll = (event) => {
      const target = event.target;
      if (!target || !target.scrollHeight) return;
      if (target.scrollHeight - target.scrollTop - target.clientHeight < 480) {
        setVisibleCount((prev) => Math.min(songs.length, prev + 100));
      }
    };
    window.addEventListener('scroll', handleScroll, true);
    return () => window.removeEventListener('scroll', handleScroll, true);
  }, [songs.length]);

  useEffect(() => {
    if (!user || !likedPlaylistId) {
      setSongs([]);
      setLoadingMore(false);
      return;
    }

    let cancelled = false;
    const fetchLikedSongsDetails = async () => {
      setLoading(true);
      setLoadingMore(false);
      try {
        // First paint uses a bounded page; the rest is filled in the background.
        const pageSize = 500;

        const firstPage = await api.getPlaylistTracks(likedPlaylistId, pageSize, 0);
        if (cancelled) return;
        const firstSongs = firstPage.songs || [];
        setSongs(firstSongs);
        setLoading(false);

        const expectedTotal = Math.max(Number(likedSongIds?.size || 0), firstSongs.length);
        let offset = firstSongs.length;
        if (offset < expectedTotal) setLoadingMore(true);
        while (!cancelled && offset < expectedTotal) {
          const res = await api.getPlaylistTracks(likedPlaylistId, pageSize, offset);
          if (cancelled) return;
          const nextSongs = res.songs || [];
          if (nextSongs.length === 0) break;
          setSongs(prev => mergeSongs(prev, nextSongs));
          offset += nextSongs.length;
          if (nextSongs.length < pageSize) break;
        }
      } catch (err) {
        console.error('Failed to load liked songs:', err);
      } finally {
        if (!cancelled) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    };

    fetchLikedSongsDetails();
    return () => {
      cancelled = true;
    };
  }, [user?.userId, likedPlaylistId]);

  const playAll = () => {
    if (loadingMore) {
      pendingPlayAllRef.current = true;
      return;
    }
    if (songs.length > 0) {
      playSong(songs[0], songs);
    }
  };

  useEffect(() => {
    if (!loadingMore && pendingPlayAllRef.current && songs.length > 0) {
      pendingPlayAllRef.current = false;
      playSong(songs[0], songs);
    }
  }, [loadingMore, playSong, songs]);

  const formatDuration = (ms) => {
    const s = Math.floor(ms / 1000);
    const min = Math.floor(s / 60).toString().padStart(2, '0');
    const sec = Math.floor(s % 60).toString().padStart(2, '0');
    return `${min}:${sec}`;
  };

  if (!user) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '80%', alignItems: 'center', justifyContent: 'center', gap: '20px' }}>
        <div style={{ fontSize: '48px' }}>🍓</div>
        <div style={{ fontSize: '15px', color: 'var(--text-muted)' }}>您需要登录网易云账号才能查看我喜欢的音乐</div>
        <button
          className="play-pause-btn"
          style={{ borderRadius: '99px', width: 'auto', height: 'auto', padding: '10px 24px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}
          onClick={() => navigateTo('settings')}
        >
          <LogIn size={16} /> 立即去登录
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
        🍓 我喜欢的音乐加载中...
      </div>
    );
  }

  return (
    <div className="view-container">
      {/* Header Info */}
      <div style={{ display: 'flex', gap: '28px', marginBottom: '32px', alignItems: 'center' }}>
        <div 
          style={{ 
            width: '120px', 
            height: '120px', 
            borderRadius: 'var(--border-radius-lg)', 
            background: 'linear-gradient(135deg, #ff4081, #ff80ab)', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            boxShadow: '0 10px 25px rgba(255, 64, 129, 0.4)' 
          }}
        >
          <Heart size={48} color="var(--text-active)" fill="var(--text-active)" />
        </div>
        <div>
          <h1 style={{ fontFamily: 'var(--font-title)', fontSize: '28px', fontWeight: 800, color: 'var(--text-active)' }}>我喜欢的音乐</h1>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '8px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span>用户: {user.nickname}</span>
            <span>·</span>
            <span>共 {likedSongIds.size} 首歌曲</span>
          </div>
          {songs.length > 0 && (
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginTop: '16px' }}>
              <button 
                className="play-pause-btn"
                style={{ borderRadius: '99px', width: 'auto', height: 'auto', padding: '8px 20px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}
                onClick={playAll}
              >
                <Play size={14} fill="currentColor" /> 播放全部
              </button>
              <button 
                className={`secondary-btn ${playMode === 'heart' ? 'heart-mode-btn-active' : ''}`}
                style={{
                  borderRadius: '99px',
                  padding: '8px 18px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '12px',
                  cursor: 'pointer',
                  border: '1px solid var(--primary-glow, rgba(255,64,129,0.3))',
                  background: playMode === 'heart' ? 'var(--primary)' : 'var(--glass-bg)',
                  color: playMode === 'heart' ? '#fff' : 'var(--text-main)',
                  transition: 'all 0.2s ease'
                }}
                onClick={() => songs.length > 0 && startHeartMode(null, likedPlaylistId, songs)}
                title="开启心动模式：在红心歌曲中随机播放并穿插推荐相似好歌"
              >
                <HeartPulse size={15} color={playMode === 'heart' ? '#fff' : 'var(--primary)'} className="heart-mode-icon" /> 心动模式
              </button>
            </div>
          )}
          {loadingMore && (
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '10px' }}>
              Loading {songs.length}/{likedSongIds.size || songs.length}
            </div>
          )}
        </div>
      </div>

      {/* Liked list table */}
      {songs.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)', fontSize: '13px' }}>
          您还没有收藏任何音乐呢，快去听歌收藏吧🍓
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="songs-table" style={{ marginTop: 0 }}>
            <thead>
              <tr>
                <th style={{ width: '10%' }}>#</th>
                <th style={{ width: '40%' }}>歌名</th>
                <th style={{ width: '25%' }}>歌手</th>
                <th style={{ width: '20%' }}>专辑</th>
                <th style={{ width: '5%' }}>时长</th>
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
                        <div className="song-row-info"><div className="song-row-name" onClick={() => playSong(song, songs)}>
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
                        )) || '未知歌手'}
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
    </div>
  );
}
