import React, { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { api } from '../utils/api';
import { Play } from 'lucide-react';

export default function Leaderboards() {
  const { navigateTo, playSong } = useApp();
  const [officialLists, setOfficialLists] = useState([]);
  const [globalLists, setGlobalLists] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTopLists = async () => {
      setLoading(true);
      try {
        const res = await api.getLeaderboards();
        if (res.list) {
          // Official lists contain preview tracks in 'tracks' field from NetEase toplists
          const official = res.list.filter(item => item.tracks && item.tracks.length > 0);
          const global = res.list.filter(item => !item.tracks || item.tracks.length === 0);
          
          setOfficialLists(official.slice(0, 4));
          setGlobalLists(global);
        }
      } catch (err) {
        console.error('Failed to load leaderboards:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchTopLists();
  }, []);

  const handlePlayLeaderboard = async (playlistId, e) => {
    e.stopPropagation();
    try {
      const tracksRes = await api.getPlaylistTracks(playlistId, 50);
      const songs = tracksRes.songs || [];
      if (songs.length > 0) {
        playSong(songs[0], songs);
      } else {
        alert('该榜单暂无歌曲！');
      }
    } catch (err) {
      console.error(err);
      alert('加载榜单歌曲失败');
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
        🍓 排行榜加载中...
      </div>
    );
  }

  return (
    <div className="view-container">
      {/* Official leaderboards */}
      <h2 style={{ fontFamily: 'var(--font-title)', fontSize: '20px', fontWeight: 700, marginBottom: '20px' }}>官方榜单</h2>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '40px' }}>
        {officialLists.map(list => (
          <div
            key={list.id}
            onClick={() => navigateTo('playlist-detail', { id: list.id })}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '24px',
              padding: '16px 24px',
              background: 'var(--surface-bg)',
              border: '1px solid var(--card-border)',
              borderRadius: 'var(--border-radius-lg)',
              cursor: 'pointer',
              transition: 'all 0.3s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.background = 'var(--glass-bg-hover)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'none';
              e.currentTarget.style.background = 'var(--surface-bg)';
            }}
          >
            {/* Cover */}
            <div className="card-image-wrap" style={{ width: '120px', height: '120px', minWidth: '120px' }}>
              <img src={list.coverImgUrl} alt="" className="card-image" />
              <button
                className="play-badge"
                onClick={(e) => handlePlayLeaderboard(list.id, e)}
                title="播放榜单"
              >
                <Play size={16} fill="currentColor" />
              </button>
            </div>

            {/* Tracks Previews */}
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-active)' }}>{list.name}</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {list.tracks.map((track, idx) => (
                  <div key={idx} style={{ fontSize: '13px', display: 'flex', gap: '10px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    <span style={{ fontWeight: 700, color: idx === 0 ? 'var(--primary)' : 'var(--text-muted)', width: '16px' }}>
                      {idx + 1}
                    </span>
                    <span style={{ color: 'var(--text-main)', fontWeight: 500 }}>{track.first}</span>
                    <span style={{ color: 'var(--text-muted)' }}>- {track.second}</span>
                  </div>
                ))}
              </div>
            </div>
            
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', alignSelf: 'flex-end' }}>
              {list.updateFrequency}
            </div>
          </div>
        ))}
      </div>

      {/* Global leaderboards */}
      <h2 style={{ fontFamily: 'var(--font-title)', fontSize: '20px', fontWeight: 700, marginBottom: '20px' }}>全球媒体榜单</h2>
      
      <div className="grid-6">
        {globalLists.map(list => (
          <div
            key={list.id}
            className="music-card"
            onClick={() => navigateTo('playlist-detail', { id: list.id })}
          >
            <div className="card-image-wrap">
              <img src={list.coverImgUrl} alt="" className="card-image" />
              <button
                className="play-badge"
                onClick={(e) => handlePlayLeaderboard(list.id, e)}
                title="播放全部"
              >
                <Play size={18} fill="currentColor" />
              </button>
            </div>
            <div className="card-title">{list.name}</div>
            <div className="card-desc">{list.updateFrequency}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
