import React, { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { api } from '../utils/api';
import { Play } from 'lucide-react';

export default function Discover() {
  const { navigateTo, playSong } = useApp();
  const [banners, setBanners] = useState([]);
  const [recommendPlaylists, setRecommendPlaylists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeBannerIdx, setActiveBannerIdx] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    const fetchJson = async (url, fallback, timeout = 8000) => {
      const timer = setTimeout(() => controller.abort(), timeout);
      try {
        const res = await fetch(url, { signal: controller.signal, credentials: 'include' });
        if (!res.ok) return fallback;
        return await res.json();
      } catch (err) {
        if (err?.name !== 'AbortError') console.warn('Discover request failed:', url, err);
        return fallback;
      } finally {
        clearTimeout(timer);
      }
    };

    const fetchData = async () => {
      try {
        const [bannerResult, playlistResult, personalResult] = await Promise.allSettled([
          fetchJson('/api/banner', { banners: [] }),
          api.search('??', 1000, 12, 0).catch(() => ({ result: { playlists: [] } })),
          fetchJson('/api/personalized?limit=12', { result: [] })
        ]);

        const bannerRes = bannerResult.status === 'fulfilled' ? bannerResult.value : { banners: [] };
        const playlistRes = playlistResult.status === 'fulfilled' ? playlistResult.value : { result: { playlists: [] } };
        const personalRes = personalResult.status === 'fulfilled' ? personalResult.value : { result: [] };

        if (!controller.signal.aborted) {
          setBanners((bannerRes.banners || []).slice(0, 6));
          const list = Array.isArray(personalRes.result) && personalRes.result.length > 0
            ? personalRes.result
            : (playlistRes.result?.playlists || []);
          setRecommendPlaylists(list);
        }
      } catch (err) {
        if (err?.name !== 'AbortError') console.error('Error fetching discovery data:', err);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    fetchData();
    return () => controller.abort();
  }, []);

  // Banner slideshow auto change
  useEffect(() => {
    if (banners.length === 0) return;
    const interval = setInterval(() => {
      setActiveBannerIdx(prev => (prev + 1) % banners.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [banners]);

  const handlePlaylistPlay = async (playlistId, e) => {
    e.stopPropagation();
    try {
      const detailRes = await api.getPlaylistDetail(playlistId);
      const tracksRes = await api.getPlaylistTracks(playlistId, 50);
      const songs = tracksRes.songs || detailRes.playlist?.tracks || [];
      if (songs.length > 0) {
        playSong(songs[0], songs);
      } else {
        alert('该歌单暂无歌曲！');
      }
    } catch (err) {
      console.error(err);
      alert('加载歌单歌曲失败');
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
        🍓 ICHIGOMusic 正在为您加载音乐世界...
      </div>
    );
  }

  return (
    <div className="view-container">
      {/* Banner Carousel */}
      {banners.length > 0 && (
        <div style={{ position: 'relative', height: '220px', borderRadius: 'var(--border-radius-lg)', overflow: 'hidden', marginBottom: '32px', boxShadow: '0 10px 30px rgba(0, 0, 0, 0.4)' }}>
          {banners.map((banner, index) => {
            const isActive = index === activeBannerIdx;
            return (
              <div
                key={index}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  opacity: isActive ? 1 : 0,
                  transition: 'opacity 0.8s ease-in-out',
                  zIndex: isActive ? 1 : 0
                }}
              >
                <img 
                  src={banner.imageUrl || banner.pic} 
                  alt={banner.typeTitle} 
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
                <div style={{
                  position: 'absolute',
                  bottom: '12px',
                  right: '16px',
                  background: banner.titleColor || 'var(--primary)',
                  color: 'var(--text-active)',
                  fontSize: '11px',
                  padding: '4px 10px',
                  borderRadius: 'var(--border-radius-md)',
                  fontWeight: 600
                }}>
                  {banner.typeTitle}
                </div>
              </div>
            );
          })}
          {/* Slide Indicators */}
          <div style={{ position: 'absolute', bottom: '12px', left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: '8px', zIndex: 10 }}>
            {banners.map((_, index) => (
              <button
                key={index}
                onClick={() => setActiveBannerIdx(index)}
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: index === activeBannerIdx ? 'var(--primary)' : 'var(--text-muted)',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.3s'
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Recommended Playlists Header */}
      <h2 style={{ fontFamily: 'var(--font-title)', fontSize: '20px', fontWeight: 700, marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        推荐歌单 <span style={{ fontSize: '12px', fontWeight: 400, color: 'var(--text-muted)' }}>🍓 探索属于你的节奏</span>
      </h2>

      {/* Recommended Playlists Grid */}
      <div className="grid-6">
        {recommendPlaylists.map(playlist => (
          <div 
            key={playlist.id} 
            className="music-card"
            onClick={() => navigateTo('playlist-detail', { id: playlist.id })}
          >
            <div className="card-image-wrap">
              <img 
                src={playlist.picUrl || playlist.coverImgUrl} 
                alt={playlist.name} 
                className="card-image"
                loading="lazy"
              />
              <button 
                className="play-badge"
                onClick={(e) => handlePlaylistPlay(playlist.id, e)}
                title="播放全部"
              >
                <Play size={18} fill="currentColor" />
              </button>
            </div>
            <div className="card-title">{playlist.name}</div>
            <div className="card-desc">
              {playlist.playCount ? `${Math.floor(playlist.playCount / 10000)}万播放` : '精品歌单'}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
