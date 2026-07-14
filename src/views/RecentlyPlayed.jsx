import React from 'react';
import { useApp } from '../context/AppContext';
import { Play, Heart, Trash2, History } from 'lucide-react';

export default function RecentlyPlayed() {
  const { recentlyPlayed, playSong, likedSongIds, toggleLike, navigateTo } = useApp();

  const playAll = () => {
    if (recentlyPlayed.length > 0) {
      playSong(recentlyPlayed[0], recentlyPlayed);
    }
  };

  const formatDuration = (ms) => {
    const s = Math.floor(ms / 1000);
    const min = Math.floor(s / 60).toString().padStart(2, '0');
    const sec = Math.floor(s % 60).toString().padStart(2, '0');
    return `${min}:${sec}`;
  };

  return (
    <div className="view-container">
      {/* Header card info */}
      <div style={{ display: 'flex', gap: '28px', marginBottom: '32px', alignItems: 'center' }}>
        <div 
          style={{ 
            width: '120px', 
            height: '120px', 
            borderRadius: 'var(--border-radius-lg)', 
            background: 'linear-gradient(135deg, #42a5f5, #0d47a1)', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            boxShadow: '0 10px 25px rgba(13, 71, 161, 0.4)' 
          }}
        >
          <History size={48} color="var(--text-active)" />
        </div>
        <div>
          <h1 style={{ fontFamily: 'var(--font-title)', fontSize: '28px', fontWeight: 800, color: 'var(--text-active)' }}>最近播放</h1>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '8px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span>记录上限: 100 首</span>
            <span>·</span>
            <span>当前已存: {recentlyPlayed.length} 首</span>
          </div>
          {recentlyPlayed.length > 0 && (
            <button 
              className="play-pause-btn"
              style={{ borderRadius: '99px', width: 'auto', height: 'auto', padding: '8px 20px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', marginTop: '16px' }}
              onClick={playAll}
            >
              <Play size={14} fill="currentColor" /> 播放最近歌曲
            </button>
          )}
        </div>
      </div>

      {/* Table list */}
      {recentlyPlayed.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)', fontSize: '13px' }}>
          您最近还没有播放过任何歌曲，快去探索好听的歌吧🍓
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
              {recentlyPlayed.map((song, index) => {
                const isLiked = likedSongIds.has(song.id);
                return (
                  <tr 
                    key={song.id + '-' + index} 
                    className="song-row"
                    onDoubleClick={() => playSong(song, recentlyPlayed)}
                  >
                    <td style={{ color: 'var(--text-muted)', paddingLeft: '16px' }}>
                      {(index + 1).toString().padStart(2, '0')}
                    </td>
                    <td>
                      <div className="song-title-cell">
                        <button
                          className="play-pause-btn"
                          style={{ width: '24px', height: '24px', boxShadow: 'none' }}
                          onClick={() => playSong(song, recentlyPlayed)}
                        >
                          <Play size={10} fill="currentColor" style={{ marginLeft: 1 }} />
                        </button>
                        <div className="song-row-info"><div className="song-row-name" onClick={() => playSong(song, recentlyPlayed)}>
                          {song.name || song.title}
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
                        )) || song.artist || '未知歌手'}
                      </div>
                    </td>
                    <td style={{ color: 'var(--text-muted)' }}>
                      {song.al?.name ? (
                        <span onClick={() => navigateTo('album-detail', { id: song.al?.id })} style={{ cursor: 'pointer' }}>
                          {song.al?.name}
                        </span>
                      ) : (
                        <span>{song.album?.name || '未知专辑'}</span>
                      )}
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--text-muted)' }}>
                        <span>{formatDuration(song.dt || song.duration || song.durationMs)}</span>
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
