import React, { useEffect, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import { api } from '../utils/api';
import { ArrowLeft, Play, User } from 'lucide-react';

export default function MVPlayer() {
  const { viewData, isPlaying, setIsPlaying, navigateTo } = useApp();
  const [mvUrl, setMvUrl] = useState('');
  const [mvDetail, setMvDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const videoRef = useRef(null);
  const sourceRef = useRef(null);

  useEffect(() => {
    if (!viewData?.id) return;

    // Pause general music playback
    setIsPlaying(false);

    const fetchMvData = async () => {
      setLoading(true);
      try {
        // Fetch MV stream URL
        const urlRes = await api.getMVUrl(viewData.id);
        setMvUrl(urlRes.data?.url || '');

        // Fetch MV details
        const detailRes = await api.getMVDetail(viewData.id);
        setMvDetail(detailRes.data || null);
      } catch (err) {
        console.error('Failed to load MV details:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchMvData();
  }, [viewData]);

  // Sync general audio pause on video play
  const handleVideoPlay = () => {
    setIsPlaying(false);
    // Directly pause context audio element if active
    const appAudio = document.querySelector('audio');
    if (appAudio) {
      appAudio.pause();
    }

    // Connect to Web Audio API for visualizers
    if (videoRef.current && window.ichigoAudioContext && window.ichigoAnalyser) {
      try {
        const audioCtx = window.ichigoAudioContext;
        if (audioCtx.state === 'suspended') {
          audioCtx.resume().catch(() => {});
        }
        if (!sourceRef.current) {
          sourceRef.current = audioCtx.createMediaElementSource(videoRef.current);
          sourceRef.current.connect(window.ichigoAnalyser);
        }
      } catch (e) {
        console.warn('MV Audio routing failed', e);
      }
    }
  };

  useEffect(() => {
    return () => {
      if (sourceRef.current) {
        try {
          sourceRef.current.disconnect();
        } catch (e) {}
      }
    };
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
        🍓 MV视频正在缓冲加载中...
      </div>
    );
  }

  if (!mvUrl) {
    return (
      <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
        无法获取当前MV播放源，可能是地区限制或VIP资源 🍓
      </div>
    );
  }

  return (
    <div className="view-container">
      {/* Back button */}
      <button
        onClick={() => navigateTo('discover')}
        style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', marginBottom: '20px', fontSize: '13px' }}
        onMouseEnter={(e) => e.target.style.color = 'var(--text-active)'}
        onMouseLeave={(e) => e.target.style.color = 'var(--text-muted)'}
      >
        <ArrowLeft size={16} /> 返回发现页
      </button>

      {/* Video element */}
      <div style={{ position: 'relative', width: '100%', aspectRatio: '16/9', borderRadius: 'var(--border-radius-lg)', overflow: 'hidden', boxShadow: '0 15px 40px rgba(0,0,0,0.6)', border: '1px solid var(--card-border)', background: 'var(--bg-gradient-start)', marginBottom: '24px' }}>
        <video
          ref={videoRef}
          src={mvUrl}
          controls
          autoPlay
          crossOrigin="anonymous"
          onPlay={handleVideoPlay}
          style={{ width: '100%', height: '100%', objectFit: 'contain' }}
        />
      </div>

      {/* Details metadata */}
      {mvDetail && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <h1 style={{ fontFamily: 'var(--font-title)', fontSize: '24px', fontWeight: 800, color: 'var(--text-active)' }}>
            {mvDetail.name}
          </h1>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', fontSize: '13px', color: 'var(--text-muted)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-active)', fontWeight: 600 }}>
              <User size={14} /> {mvDetail.artistName}
            </span>
            <span>|</span>
            <span>发布日期: {mvDetail.publishTime}</span>
            <span>|</span>
            <span>播放次数: {mvDetail.playCount ? mvDetail.playCount.toLocaleString() : 0}次</span>
          </div>

          {mvDetail.desc && (
            <div style={{ 
              background: 'var(--surface-bg)', 
              border: '1px solid var(--card-border)', 
              borderRadius: 'var(--border-radius-md)', 
              padding: '16px', 
              fontSize: '13px', 
              lineHeight: '1.6', 
              color: 'var(--text-muted)', 
              whiteSpace: 'pre-wrap',
              marginTop: '8px'
            }}>
              {mvDetail.desc}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
