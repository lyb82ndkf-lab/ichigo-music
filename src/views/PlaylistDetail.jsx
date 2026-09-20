import React, { useEffect, useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { api } from '../utils/api';
import { Play, Heart, MessageSquare, Clock, HeartPulse, Sparkles, X, ChevronLeft, ChevronRight, ThumbsUp } from 'lucide-react';

function SongInlineComments({ song, onClose }) {
  const [loading, setLoading] = useState(true);
  const [hotComments, setHotComments] = useState([]);
  const [comments, setComments] = useState([]);
  const [page, setPage] = useState(1);
  const pageSize = 4;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setPage(1);
    api.getComments(song.id, 60, 0).then(res => {
      if (cancelled) return;
      setHotComments(res?.hotComments || []);
      setComments(res?.comments || []);
      setLoading(false);
    }).catch(err => {
      console.error('Failed to load song comments:', err);
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [song.id]);

  const allComments = useMemo(() => {
    const list = [...hotComments];
    const seen = new Set(list.map(c => c.commentId));
    for (const c of comments) {
      if (c?.commentId && !seen.has(c.commentId)) {
        seen.add(c.commentId);
        list.push(c);
      }
    }
    return list;
  }, [hotComments, comments]);

  const totalPages = Math.max(1, Math.ceil(allComments.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const currentComments = allComments.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="song-comments-inline-card">
      <div className="song-comments-card-header">
        <div className="song-comments-header-title">
          <Sparkles size={14} className="sparkle-icon" />
          <span>《{song.name}》精选热评 {allComments.length > 0 && `(${allComments.length})`}</span>
        </div>
        <div className="song-comments-header-actions">
          {totalPages > 1 && (
            <div className="song-comments-pagination">
              <button
                type="button"
                className="song-comments-page-btn"
                disabled={currentPage <= 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
              >
                <ChevronLeft size={12} />
                <span>上一页</span>
              </button>
              <span>{currentPage} / {totalPages}</span>
              <button
                type="button"
                className="song-comments-page-btn"
                disabled={currentPage >= totalPages}
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              >
                <span>下一页</span>
                <ChevronRight size={12} />
              </button>
            </div>
          )}
          <button
            type="button"
            className="song-comments-close-btn"
            onClick={onClose}
            title="收起评论"
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="song-comments-loading">
          🍓 正在加载《{song.name}》的热评...
        </div>
      ) : allComments.length === 0 ? (
        <div className="song-comments-empty">
          这首歌暂无热门评论，快去网易云留下你的第一条精彩评论吧 🍓
        </div>
      ) : (
        <div className="song-comments-list">
          {currentComments.map((c) => (
            <div key={c.commentId} className="song-comment-item">
              <img
                src={c.user?.avatarUrl || 'https://p2.music.126.net/UeTuwE7Cx877Y2gCGIseYg==/109951163026279185.jpg'}
                alt=""
                className="song-comment-avatar"
              />
              <div className="song-comment-body">
                <div className="song-comment-meta">
                  <div>
                    <span className="song-comment-user">{c.user?.nickname || '云音乐用户'}</span>
                    <span className="song-comment-time">{c.timeStr || ''}</span>
                  </div>
                  {typeof c.likedCount === 'number' && c.likedCount > 0 && (
                    <span className="song-comment-likes">
                      <ThumbsUp size={11} />
                      <span>{c.likedCount}</span>
                    </span>
                  )}
                </div>
                <p className="song-comment-content">{c.content}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function PlaylistDetail() {
  const { viewData, playSong, startHeartMode, playMode, setPlayMode, likedSongIds, toggleLike, navigateTo } = useApp();
  const [playlist, setPlaylist] = useState(null);
  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [expandedSongId, setExpandedSongId] = useState(null);
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
    
    let cancelled = false;
    const fetchDetails = async () => {
      setLoading(true);
      setLoadingMore(false);
      setExpandedSongId(null);
      try {
        const detailRes = await api.getPlaylistDetail(viewData.id);
        if (cancelled) return;
        setPlaylist(detailRes.playlist);

        const pageSize = 500;
        const expectedTotal = Number(detailRes.playlist?.trackCount || detailRes.playlist?.trackIds?.length || 0);
        const mergeSongs = (prev, next) => {
          const seen = new Set(prev.map(song => song.id));
          const merged = [...prev];
          for (const song of next) {
            if (!song?.id || seen.has(song.id)) continue;
            seen.add(song.id);
            merged.push(song);
          }
          return merged;
        };

        const tracksRes = await api.getPlaylistTracks(viewData.id, pageSize, 0);
        if (cancelled) return;
        const firstSongs = tracksRes.songs || detailRes.playlist?.tracks || [];
        setSongs(firstSongs);
        setLoading(false);

        let offset = firstSongs.length;
        if (expectedTotal > offset) setLoadingMore(true);
        while (!cancelled && expectedTotal > offset) {
          const res = await api.getPlaylistTracks(viewData.id, pageSize, offset);
          if (cancelled) return;
          const nextSongs = res.songs || [];
          if (nextSongs.length === 0) break;
          setSongs(prev => mergeSongs(prev, nextSongs));
          offset += nextSongs.length;
          if (nextSongs.length < pageSize) break;
        }
      } catch (err) {
        console.error('Failed to load playlist:', err);
      } finally {
        if (!cancelled) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    };

    fetchDetails();
    return () => {
      cancelled = true;
    };
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

          <div className="playlist-actions-row">
            <button 
              className="playlist-action-pill-btn primary"
              onClick={playAll}
            >
              <Play size={16} fill="currentColor" />
              <span>播放全部</span>
            </button>

            <button
              className={`playlist-action-pill-btn secondary ${playMode === 'heart' ? 'is-active heart-mode-btn-active' : ''}`}
              onClick={() => {
                if (songs.length === 0) return;
                if (playMode === 'heart') {
                  setPlayMode('sequence');
                } else {
                  startHeartMode(null, playlist?.id, songs);
                }
              }}
              title={playMode === 'heart' ? '点击退出心动模式（恢复原列表）' : '开启心动模式：基于本歌单真随机播放并智能穿插推荐相似歌曲'}
            >
              <HeartPulse size={16} className="heart-mode-icon" />
              <span>心动模式</span>
              {playMode === 'heart' && <span className="heart-mode-badge">播放中</span>}
            </button>
          </div>
          {loadingMore && (
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Loading {songs.length}/{playlist.trackCount || songs.length}
            </div>
          )}
        </div>
      </div>

      {/* Main Track Table */}
      <div style={{ width: '100%', overflowX: 'auto' }}>
        <table className="songs-table" style={{ marginTop: 0, width: '100%' }}>
          <thead>
            <tr>
              <th style={{ width: '38%' }}>歌名</th>
              <th style={{ width: '28%' }}>歌手</th>
              <th style={{ width: '20%' }}>专辑</th>
              <th style={{ width: '14%' }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {songs.slice(0, visibleCount).map((song, index) => {
              const isLiked = likedSongIds.has(song.id);
              const isCommentsOpen = expandedSongId === song.id;
              return (
                <React.Fragment key={song.id}>
                  <tr 
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
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)' }}>
                        <span style={{ minWidth: '38px' }}>{formatDuration(song.dt)}</span>
                        <button 
                          className={`player-like-btn ${isLiked ? 'liked' : ''}`}
                          onClick={(e) => { e.stopPropagation(); toggleLike(song.id); }}
                          title={isLiked ? '取消喜欢' : '喜欢'}
                          style={{ padding: 0 }}
                        >
                          <Heart size={14} fill={isLiked ? 'currentColor' : 'none'} />
                        </button>
                        <button
                          className={`song-comment-toggle-btn ${isCommentsOpen ? 'active' : ''}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpandedSongId(prev => (prev === song.id ? null : song.id));
                          }}
                          title={isCommentsOpen ? '收起热评' : '查看这首歌的热评'}
                        >
                          <MessageSquare size={12} />
                          <span>{isCommentsOpen ? '收起' : '热评'}</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                  {isCommentsOpen && (
                    <tr className="song-inline-comments-tr">
                      <td colSpan={4}>
                        <SongInlineComments
                          song={song}
                          onClose={() => setExpandedSongId(null)}
                        />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
