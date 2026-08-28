// src/components/AudioMatchModal.jsx - Audio Match (听歌识曲) Modal Component
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import {
  Radio, Mic, Monitor, Play, Heart, Plus, FileText, RefreshCw, X,
  Sparkles, Check, AlertCircle, Disc, Volume2, ShieldCheck
} from 'lucide-react';
import { recordAndRecognize } from '../utils/audioMatchEngine';

function hexToRgba(hex, alpha = 1) {
  if (!hex || typeof hex !== 'string') return `rgba(255, 64, 129, ${alpha})`;
  let c = hex.replace('#', '').trim();
  if (c.startsWith('rgb')) return hex;
  if (c.length === 3) c = c.split('').map(x => x + x).join('');
  const num = parseInt(c, 16);
  if (isNaN(num)) return `rgba(255, 64, 129, ${alpha})`;
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export default function AudioMatchModal({ isOpen, onClose }) {
  const { playSong, likedSongIds, toggleLike, playlist, setPlaylistAndPersist, setIsLyricsOpen, navigateTo, colorMode } = useApp();

  const [mode, setMode] = useState('screen'); // 'screen' | 'mic'
  const [status, setStatus] = useState('idle'); // 'idle' | 'listening' | 'identifying' | 'success' | 'failed'
  const [secondsLeft, setSecondsLeft] = useState(3);
  const [results, setResults] = useState([]);
  const [errorMessage, setErrorMessage] = useState('');
  const [isAborted, setIsAborted] = useState(false);

  const canvasRef = useRef(null);
  const waveformRef = useRef(new Uint8Array(128));
  const freqRef = useRef(new Uint8Array(128));
  const animationFrameRef = useRef(null);

  // Light Mode Detection
  const isLight = useMemo(() => {
    if (colorMode === 'light') return true;
    if (colorMode === 'dark') return false;
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: light)').matches;
    }
    return false;
  }, [colorMode]);

  // Start Recognition Flow
  const startRecognition = useCallback(async () => {
    setStatus('listening');
    setSecondsLeft(3);
    setResults([]);
    setErrorMessage('');
    setIsAborted(false);

    try {
      const recognitionResult = await recordAndRecognize({
        mode,
        durationSec: 3,
        onProgress: ({ secondsLeft: rem, progress, liveVolume }) => {
          setSecondsLeft(Math.max(0, Math.ceil(rem)));
          if (rem <= 0.2) {
            setStatus('identifying');
          }
        },
        onWaveform: (timeData, freqData) => {
          waveformRef.current = timeData;
          freqRef.current = freqData;
        }
      });

      if (recognitionResult.success && recognitionResult.results.length > 0) {
        setResults(recognitionResult.results);
        setStatus('success');
      } else {
        setErrorMessage(recognitionResult.message || '未能识别到正在播放的歌曲');
        setStatus('failed');
      }
    } catch (err) {
      console.error('Audio match failed:', err);
      setErrorMessage(err?.message || '识别过程中发生异常，请重试');
      setStatus('failed');
    }
  }, [mode]);

  // Auto-start when modal opens
  useEffect(() => {
    if (isOpen) {
      startRecognition();
    } else {
      setStatus('idle');
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    }
  }, [isOpen, startRecognition]);

  // Canvas Waveform & Radar Animation
  useEffect(() => {
    if (!isOpen || (status !== 'listening' && status !== 'identifying')) {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let phase = 0;

    const render = () => {
      const w = canvas.width = canvas.offsetWidth * window.devicePixelRatio || 300;
      const h = canvas.height = canvas.offsetHeight * window.devicePixelRatio || 160;
      ctx.clearRect(0, 0, w, h);

      // Get real computed primary color from DOM
      const primaryHex = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim() || '#ff3366';

      // Radar pulse waves
      phase += 0.035;
      const centerX = w / 2;
      const centerY = h / 2;
      const maxRadius = Math.min(centerX, centerY) * 0.92;

      // Draw concentric radar ripples
      for (let i = 0; i < 3; i++) {
        const ringProgress = (phase + i * 0.33) % 1;
        const radius = ringProgress * maxRadius;
        const alpha = Math.max(0, 1 - ringProgress);

        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.strokeStyle = hexToRgba(primaryHex, alpha * (isLight ? 0.45 : 0.55));
        ctx.lineWidth = 2 * window.devicePixelRatio;
        ctx.stroke();
      }

      // Draw live waveform bars
      const freq = freqRef.current;
      const barCount = 38;
      const barWidth = (w / barCount) * 0.65;
      const gap = (w / barCount) * 0.35;

      for (let i = 0; i < barCount; i++) {
        const freqIdx = Math.floor((i / barCount) * (freq.length / 2));
        const val = (freq[freqIdx] || 0) / 255;
        const barHeight = Math.max(4 * window.devicePixelRatio, val * (h * 0.45));
        const x = i * (barWidth + gap) + gap / 2;
        const y = centerY - barHeight / 2;

        const grad = ctx.createLinearGradient(0, y, 0, y + barHeight);
        grad.addColorStop(0, hexToRgba(primaryHex, 0.85));
        grad.addColorStop(1, hexToRgba(primaryHex, 0.15));

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barHeight, 2 * window.devicePixelRatio);
        ctx.fill();
      }

      animationFrameRef.current = requestAnimationFrame(render);
    };

    animationFrameRef.current = requestAnimationFrame(render);

    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [isOpen, status, isLight]);

  if (!isOpen) return null;

  const topSong = results[0];

  const handlePlaySong = (song) => {
    if (!song) return;
    playSong(song.raw || song, [song.raw || song]);
  };

  const handleAddToQueue = (song) => {
    if (!song) return;
    const currentList = Array.isArray(playlist) ? [...playlist] : [];
    if (!currentList.some(s => s.id === song.id)) {
      setPlaylistAndPersist([...currentList, song.raw || song]);
    }
  };

  const handleViewLyrics = (song) => {
    if (!song) return;
    handlePlaySong(song);
    setIsLyricsOpen(true);
    onClose();
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: isLight ? 'rgba(0, 0, 0, 0.4)' : 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(16px)',
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px'
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '540px',
          maxWidth: '95vw',
          background: isLight ? 'rgba(255, 255, 255, 0.98)' : 'rgba(20, 14, 30, 0.95)',
          borderRadius: '24px',
          border: isLight ? '1px solid rgba(0, 0, 0, 0.1)' : '1px solid rgba(255, 255, 255, 0.12)',
          boxShadow: isLight
            ? '0 24px 60px rgba(0, 0, 0, 0.15), 0 0 30px var(--primary-glow, rgba(255,64,129,0.15))'
            : '0 24px 60px rgba(0, 0, 0, 0.7), 0 0 40px var(--primary-glow, rgba(255,64,129,0.25))',
          padding: '28px',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
          color: 'var(--text-main, #1e1e2d)',
          position: 'relative'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, var(--primary), #9c27b0)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 14px var(--primary-glow, rgba(255,64,129,0.4))'
            }}>
              <Radio size={18} color="#ffffff" />
            </div>
            <div>
              <h3 style={{ fontSize: '18px', fontWeight: 800, margin: 0, color: 'var(--text-main, #1e1e2d)' }}>
                听歌识曲
              </h3>
              <div style={{ fontSize: '11px', color: 'var(--text-muted, #71717a)', marginTop: '2px' }}>
                高精度音频指纹识别技术
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* Capture Mode Toggle */}
            <div style={{
              display: 'flex',
              background: isLight ? 'rgba(0, 0, 0, 0.05)' : 'rgba(255, 255, 255, 0.08)',
              padding: '3px',
              borderRadius: '99px',
              border: isLight ? '1px solid rgba(0, 0, 0, 0.08)' : '1px solid rgba(255, 255, 255, 0.1)'
            }}>
              <button
                type="button"
                onClick={() => {
                  setMode('screen');
                  if (status === 'listening' || status === 'identifying') startRecognition();
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '5px 12px',
                  borderRadius: '99px',
                  border: 'none',
                  background: mode === 'screen' ? 'var(--primary)' : 'transparent',
                  color: mode === 'screen' ? '#ffffff' : 'var(--text-muted, #71717a)',
                  fontSize: '11.5px',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
                title="直接捕获电脑屏幕与扬声器正在播放的声音"
              >
                <Monitor size={13} />
                <span>屏幕/系统音频</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setMode('mic');
                  if (status === 'listening' || status === 'identifying') startRecognition();
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '5px 12px',
                  borderRadius: '99px',
                  border: 'none',
                  background: mode === 'mic' ? 'var(--primary)' : 'transparent',
                  color: mode === 'mic' ? '#ffffff' : 'var(--text-muted, #71717a)',
                  fontSize: '11.5px',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
                title="使用麦克风捕获环境外放声音"
              >
                <Mic size={13} />
                <span>麦克风拾音</span>
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: isLight ? 'rgba(0, 0, 0, 0.05)' : 'rgba(255, 255, 255, 0.08)',
                border: isLight ? '1px solid rgba(0, 0, 0, 0.1)' : '1px solid rgba(255, 255, 255, 0.12)',
                color: 'var(--text-muted, #71717a)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer'
              }}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Content Body based on Status */}
        {(status === 'listening' || status === 'identifying') && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', padding: '24px 0' }}>
            <div style={{ position: 'relative', width: '100%', height: '140px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <canvas
                ref={canvasRef}
                style={{ width: '100%', height: '100%', borderRadius: '16px' }}
              />
              <div style={{
                position: 'absolute',
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: isLight ? 'rgba(255, 255, 255, 0.95)' : 'rgba(var(--accent-rgb, 255, 64, 129), 0.2)',
                border: isLight ? '2px solid var(--primary)' : '2px solid var(--primary)',
                boxShadow: isLight
                  ? '0 4px 20px var(--primary-glow, rgba(255,64,129,0.35)), inset 0 0 10px rgba(var(--accent-rgb, 255, 64, 129), 0.15)'
                  : '0 0 24px var(--primary-glow, rgba(255,64,129,0.6))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backdropFilter: 'blur(8px)'
              }}>
                <Radio size={26} color="var(--primary)" className="pulse" />
              </div>
            </div>

            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-main, #1e1e2d)' }}>
                {status === 'listening'
                  ? (mode === 'screen' ? '正在监听屏幕/系统播放的声音…' : '正在通过麦克风拾音…')
                  : '正在提取指纹并云端智能识别…'}
              </div>
              <div style={{ fontSize: '13px', color: 'var(--primary)', marginTop: '6px', fontWeight: 700 }}>
                {status === 'listening' ? `倒计时 ${secondsLeft} 秒` : '请稍候，马上呈现结果'}
              </div>
            </div>
          </div>
        )}

        {/* Success State */}
        {status === 'success' && topSong && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Top Recognized Hero Card */}
            <div style={{
              background: isLight
                ? 'linear-gradient(135deg, rgba(var(--accent-rgb, 255, 64, 129), 0.12), rgba(245, 245, 250, 0.95))'
                : 'linear-gradient(135deg, rgba(var(--accent-rgb, 255, 64, 129), 0.2), rgba(0, 0, 0, 0.5))',
              borderRadius: '20px',
              border: isLight
                ? '1.5px solid rgba(var(--accent-rgb, 255, 64, 129), 0.3)'
                : '1.5px solid rgba(var(--accent-rgb, 255, 64, 129), 0.4)',
              padding: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '18px',
              boxShadow: isLight ? '0 8px 24px rgba(0, 0, 0, 0.06)' : '0 12px 36px rgba(0, 0, 0, 0.4)'
            }}>
              <img
                src={topSong.coverUrl || 'static/ichigo.png'}
                alt=""
                style={{
                  width: '90px',
                  height: '90px',
                  borderRadius: '14px',
                  objectFit: 'cover',
                  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.2)',
                  border: isLight ? '1px solid rgba(0, 0, 0, 0.08)' : '1px solid rgba(255, 255, 255, 0.15)'
                }}
              />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{
                    fontSize: '11px',
                    fontWeight: 800,
                    padding: '2px 8px',
                    borderRadius: '6px',
                    background: 'var(--primary)',
                    color: '#ffffff'
                  }}>
                    {topSong.matchScore}% 精确匹配
                  </span>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted, #71717a)' }}>
                    定位至第 {topSong.startTimeSec || 0} 秒
                  </span>
                </div>
                <div style={{ fontSize: '18px', fontWeight: 900, color: 'var(--text-main, #1e1e2d)' }}>
                  {topSong.name}
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-muted, #71717a)' }}>
                  {topSong.artist} · {topSong.album}
                </div>
              </div>
            </div>

            {/* Quick Action Buttons */}
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => handlePlaySong(topSong)}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  background: 'var(--primary)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '12px',
                  padding: '10px 16px',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 4px 18px var(--primary-glow, rgba(255,64,129,0.4))'
                }}
              >
                <Play size={16} fill="currentColor" />
                <span>立即播放</span>
              </button>

              <button
                type="button"
                onClick={() => handleAddToQueue(topSong)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  background: isLight ? 'rgba(0, 0, 0, 0.05)' : 'rgba(255, 255, 255, 0.1)',
                  border: isLight ? '1px solid rgba(0, 0, 0, 0.1)' : '1px solid rgba(255, 255, 255, 0.18)',
                  color: 'var(--text-main, #1e1e2d)',
                  borderRadius: '12px',
                  padding: '10px 16px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                <Plus size={16} />
                <span>加入播放列表</span>
              </button>

              <button
                type="button"
                onClick={() => handleViewLyrics(topSong)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  background: isLight ? 'rgba(0, 0, 0, 0.05)' : 'rgba(255, 255, 255, 0.1)',
                  border: isLight ? '1px solid rgba(0, 0, 0, 0.1)' : '1px solid rgba(255, 255, 255, 0.18)',
                  color: 'var(--text-main, #1e1e2d)',
                  borderRadius: '12px',
                  padding: '10px 16px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                <FileText size={16} />
                <span>查看歌词</span>
              </button>
            </div>

            {/* Other Candidates if multiple */}
            {results.length > 1 && (
              <div style={{ marginTop: '8px' }}>
                <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted, #71717a)', marginBottom: '8px' }}>
                  其他可能匹配候选 ({results.length - 1})
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {results.slice(1, 3).map((item, idx) => (
                    <div
                      key={item.id + '-' + idx}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        background: isLight ? 'rgba(0, 0, 0, 0.03)' : 'rgba(255, 255, 255, 0.04)',
                        padding: '8px 12px',
                        borderRadius: '10px',
                        border: isLight ? '1px solid rgba(0, 0, 0, 0.06)' : '1px solid rgba(255, 255, 255, 0.08)'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <img src={item.coverUrl} alt="" style={{ width: '32px', height: '32px', borderRadius: '6px', objectFit: 'cover' }} />
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main, #1e1e2d)' }}>{item.name}</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted, #71717a)' }}>{item.artist} · {item.matchScore}% 匹配</div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handlePlaySong(item)}
                        style={{
                          background: isLight ? 'rgba(0, 0, 0, 0.06)' : 'rgba(255, 255, 255, 0.1)',
                          border: 'none',
                          color: 'var(--text-main, #1e1e2d)',
                          borderRadius: '8px',
                          padding: '4px 10px',
                          fontSize: '12px',
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        播放
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Failed State */}
        {status === 'failed' && (
          <div style={{ textAlign: 'center', padding: '30px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>
            <div style={{
              width: '54px',
              height: '54px',
              borderRadius: '50%',
              background: 'rgba(255, 107, 53, 0.15)',
              color: '#ff6b35',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <AlertCircle size={28} />
            </div>
            <div>
              <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-main, #1e1e2d)' }}>
                未能识别到正在播放的歌曲
              </div>
              <div style={{ fontSize: '12.5px', color: 'var(--text-muted, #71717a)', marginTop: '6px' }}>
                {errorMessage || '建议靠近音频源、调大音量或切换录音模式后重试'}
              </div>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        {(status === 'success' || status === 'failed') && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', marginTop: '6px' }}>
            <button
              type="button"
              onClick={startRecognition}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: isLight ? 'rgba(0, 0, 0, 0.06)' : 'rgba(255, 255, 255, 0.08)',
                border: isLight ? '1px solid rgba(0, 0, 0, 0.12)' : '1px solid rgba(255, 255, 255, 0.15)',
                color: 'var(--text-main, #1e1e2d)',
                borderRadius: '99px',
                padding: '8px 22px',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              <RefreshCw size={14} />
              <span>重新识别</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
