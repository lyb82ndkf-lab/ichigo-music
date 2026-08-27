// src/components/ListeningStatsReport.jsx - Personalized Listening Stats & Genre Radar UI
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { getComprehensiveListeningStats, GENRE_CATEGORIES } from '../utils/listeningStats';
import {
  Activity, Clock, Disc, Sparkles, TrendingUp, User, Music,
  RefreshCw, Award, Radio, Play, ChevronRight, BarChart2
} from 'lucide-react';

export default function ListeningStatsReport() {
  const { user, colorMode, immersiveColor, playSong, startHeartMode, playlist } = useApp();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeGenreIndex, setActiveGenreIndex] = useState(null);

  const isLight = colorMode === 'light';

  const loadStats = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getComprehensiveListeningStats(user);
      setStats(data);
    } catch (err) {
      console.warn('Failed to load listening stats:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  // Handle Smart Radio Trigger
  const handleLaunchSmartRadio = () => {
    if (!stats) return;
    const topSong = stats.topSongs?.[0];
    const topArtist = stats.topArtists?.[0];
    
    // Pick seed from top songs, or current playlist, or fallback
    let seed = null;
    if (topSong && topSong.id) {
      seed = {
        id: topSong.id,
        name: topSong.name,
        ar: [{ name: topSong.artist || '未知艺术家' }],
        al: { picUrl: topSong.coverUrl || '' },
        coverUrl: topSong.coverUrl || ''
      };
    } else if (playlist && playlist.length > 0) {
      seed = playlist[0];
    }

    if (startHeartMode) {
      startHeartMode(seed, null, stats.topSongs);
    }
  };

  // Radar Chart Calculations
  const radarData = useMemo(() => {
    if (!stats?.genreDistribution) return null;
    const genres = stats.genreDistribution;
    const count = genres.length;
    const cx = 150;
    const cy = 150;
    const radius = 105;

    // Calculate max value for relative scaling (with min threshold so low values still render nicely)
    const maxPct = Math.max(25, ...genres.map(g => g.percentage || 0));

    // Calculate vertices for user data polygon
    const points = genres.map((g, i) => {
      const angle = (Math.PI * 2 * i) / count - Math.PI / 2;
      const normalized = Math.max(0.12, (g.percentage || 0) / maxPct);
      const r = radius * normalized;
      const x = cx + r * Math.cos(angle);
      const y = cy + r * Math.sin(angle);
      return { x, y, angle, ...g };
    });

    const polygonPath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ') + ' Z';

    // Concentric Web Circles / Polygons
    const levels = [0.25, 0.5, 0.75, 1.0];
    const webPolygons = levels.map(lvl => {
      return genres.map((_, i) => {
        const angle = (Math.PI * 2 * i) / count - Math.PI / 2;
        const r = radius * lvl;
        const x = cx + r * Math.cos(angle);
        const y = cy + r * Math.sin(angle);
        return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
      }).join(' ') + ' Z';
    });

    // Axis Lines
    const axisLines = genres.map((_, i) => {
      const angle = (Math.PI * 2 * i) / count - Math.PI / 2;
      const x = cx + radius * Math.cos(angle);
      const y = cy + radius * Math.sin(angle);
      return { x1: cx, y1: cy, x2: x, y2: y };
    });

    // Label coordinates (outside the web)
    const labels = genres.map((g, i) => {
      const angle = (Math.PI * 2 * i) / count - Math.PI / 2;
      const labelR = radius + 26;
      const x = cx + labelR * Math.cos(angle);
      const y = cy + labelR * Math.sin(angle);
      return { x, y, name: g.name.split(' ')[0], percentage: g.percentage, color: g.color, key: g.key };
    });

    return { cx, cy, radius, points, polygonPath, webPolygons, axisLines, labels };
  }, [stats]);

  if (loading && !stats) {
    return (
      <div style={{
        padding: '36px',
        textAlign: 'center',
        color: isLight ? 'rgba(0, 0, 0, 0.45)' : 'rgba(255, 255, 255, 0.45)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '12px'
      }}>
        <RefreshCw size={24} className="animate-spin" color="var(--primary, #ff4081)" />
        <span style={{ fontSize: '13px' }}>正在为您生成个性化听歌数据报告与流派分布…</span>
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '20px',
      color: isLight ? '#1a192b' : '#ffffff'
    }}>
      {/* Top Banner: Persona & Key Stats Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '14px'
      }}>
        {/* Persona Card */}
        <div style={{
          background: isLight
            ? 'linear-gradient(135deg, rgba(255, 64, 129, 0.12) 0%, rgba(121, 40, 202, 0.1) 100%)'
            : 'linear-gradient(135deg, rgba(255, 64, 129, 0.2) 0%, rgba(121, 40, 202, 0.18) 100%)',
          border: isLight ? '1px solid rgba(255, 64, 129, 0.25)' : '1px solid rgba(255, 64, 129, 0.35)',
          borderRadius: '16px',
          padding: '16px 20px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          position: 'relative',
          overflow: 'hidden'
        }}>
          <div>
            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--primary, #ff4081)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              音乐基因画像
            </span>
            <h3 style={{ margin: '6px 0 0 0', fontSize: '18px', fontWeight: 800, color: isLight ? '#1a192b' : '#fff' }}>
              {stats?.persona || '多元音律探索者'}
            </h3>
          </div>
          <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{
              fontSize: '11px',
              padding: '3px 8px',
              borderRadius: '20px',
              background: 'rgba(255, 64, 129, 0.18)',
              color: 'var(--primary, #ff4081)',
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              <Sparkles size={11} /> 专属风格
            </span>
            {stats?.level > 0 && (
              <span style={{
                fontSize: '11px',
                padding: '3px 8px',
                borderRadius: '20px',
                background: isLight ? 'rgba(0, 0, 0, 0.06)' : 'rgba(255, 255, 255, 0.1)',
                color: isLight ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.8)',
                fontWeight: 600
              }}>
                Lv.{stats.level}
              </span>
            )}
          </div>
        </div>

        {/* Listening Duration Card */}
        <div style={{
          background: isLight ? 'rgba(0, 0, 0, 0.03)' : 'rgba(255, 255, 255, 0.04)',
          border: isLight ? '1px solid rgba(0, 0, 0, 0.08)' : '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '16px',
          padding: '16px 20px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '12px', color: isLight ? 'rgba(0, 0, 0, 0.6)' : 'rgba(255, 255, 255, 0.6)' }}>
              累计听歌时长
            </span>
            <Clock size={16} color="var(--primary, #ff4081)" />
          </div>
          <div style={{ marginTop: '8px' }}>
            <span style={{ fontSize: '24px', fontWeight: 800, color: isLight ? '#1a192b' : '#fff' }}>
              {stats?.totalHours || 0}
            </span>
            <span style={{ fontSize: '12px', marginLeft: '4px', color: isLight ? 'rgba(0, 0, 0, 0.5)' : 'rgba(255, 255, 255, 0.5)' }}>小时</span>
          </div>
          <small style={{ color: isLight ? 'rgba(0, 0, 0, 0.45)' : 'rgba(255, 255, 255, 0.45)', fontSize: '11px', marginTop: '6px' }}>
            今日已收听 {stats?.todayMinutes || 0} 分钟
          </small>
        </div>

        {/* Total Tracks Card */}
        <div style={{
          background: isLight ? 'rgba(0, 0, 0, 0.03)' : 'rgba(255, 255, 255, 0.04)',
          border: isLight ? '1px solid rgba(0, 0, 0, 0.08)' : '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '16px',
          padding: '16px 20px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '12px', color: isLight ? 'rgba(0, 0, 0, 0.6)' : 'rgba(255, 255, 255, 0.6)' }}>
              累计听歌首数
            </span>
            <Disc size={16} color="#00d4ff" />
          </div>
          <div style={{ marginTop: '8px' }}>
            <span style={{ fontSize: '24px', fontWeight: 800, color: isLight ? '#1a192b' : '#fff' }}>
              {stats?.totalListenSongs || 0}
            </span>
            <span style={{ fontSize: '12px', marginLeft: '4px', color: isLight ? 'rgba(0, 0, 0, 0.5)' : 'rgba(255, 255, 255, 0.5)' }}>首</span>
          </div>
          <small style={{ color: isLight ? 'rgba(0, 0, 0, 0.45)' : 'rgba(255, 255, 255, 0.45)', fontSize: '11px', marginTop: '6px' }}>
            云端与本地高精听歌统计
          </small>
        </div>
      </div>

      {/* Main Grid: Radar Chart on Left, Top Artists & Smart Radio on Right */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(320px, 380px) 1fr',
        gap: '16px'
      }}>
        {/* Left Column: Genre Radar Chart */}
        <div style={{
          background: isLight ? 'rgba(255, 255, 255, 0.85)' : 'rgba(20, 16, 30, 0.8)',
          border: isLight ? '1px solid rgba(0, 0, 0, 0.08)' : '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '18px',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center'
        }}>
          <div style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <BarChart2 size={16} color="var(--primary, #ff4081)" />
              曲风与流派分布雷达 (Style Radar)
            </h4>
            <button
              type="button"
              onClick={loadStats}
              title="重新计算分析"
              style={{
                background: 'none',
                border: 'none',
                color: isLight ? 'rgba(0, 0, 0, 0.5)' : 'rgba(255, 255, 255, 0.5)',
                cursor: 'pointer',
                padding: '4px'
              }}
            >
              <RefreshCw size={14} />
            </button>
          </div>

          {/* SVG Radar Visualization */}
          {radarData && (
            <div style={{ width: '300px', height: '300px', position: 'relative' }}>
              <svg width="300" height="300" viewBox="0 0 300 300" style={{ overflow: 'visible' }}>
                <defs>
                  <linearGradient id="radarGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="rgba(255, 64, 129, 0.65)" />
                    <stop offset="50%" stopColor="rgba(0, 212, 255, 0.5)" />
                    <stop offset="100%" stopColor="rgba(157, 78, 221, 0.65)" />
                  </linearGradient>
                  <filter id="radarGlow" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="4" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                  </filter>
                </defs>

                {/* Web Background Polygons */}
                {radarData.webPolygons.map((path, idx) => (
                  <path
                    key={idx}
                    d={path}
                    fill={idx === radarData.webPolygons.length - 1 ? (isLight ? 'rgba(0, 0, 0, 0.02)' : 'rgba(255, 255, 255, 0.02)') : 'none'}
                    stroke={isLight ? 'rgba(0, 0, 0, 0.07)' : 'rgba(255, 255, 255, 0.07)'}
                    strokeWidth="1"
                    strokeDasharray={idx === radarData.webPolygons.length - 1 ? 'none' : '3 3'}
                  />
                ))}

                {/* Axis Radial Lines */}
                {radarData.axisLines.map((line, idx) => (
                  <line
                    key={idx}
                    x1={line.x1}
                    y1={line.y1}
                    x2={line.x2}
                    y2={line.y2}
                    stroke={isLight ? 'rgba(0, 0, 0, 0.09)' : 'rgba(255, 255, 255, 0.09)'}
                    strokeWidth="1"
                  />
                ))}

                {/* User Genre Data Polygon */}
                <path
                  d={radarData.polygonPath}
                  fill="url(#radarGrad)"
                  stroke="var(--primary, #ff4081)"
                  strokeWidth="2.5"
                  filter="url(#radarGlow)"
                  style={{ transition: 'all 0.4s ease' }}
                />

                {/* Vertex Dots */}
                {radarData.points.map((pt, idx) => (
                  <circle
                    key={idx}
                    cx={pt.x}
                    cy={pt.y}
                    r={activeGenreIndex === idx ? 6 : 4}
                    fill={pt.color || 'var(--primary, #ff4081)'}
                    stroke="#ffffff"
                    strokeWidth="1.5"
                    style={{ cursor: 'pointer', transition: 'all 0.2s' }}
                    onMouseEnter={() => setActiveGenreIndex(idx)}
                    onMouseLeave={() => setActiveGenreIndex(null)}
                  />
                ))}

                {/* Labels around the perimeter */}
                {radarData.labels.map((lbl, idx) => (
                  <text
                    key={idx}
                    x={lbl.x}
                    y={lbl.y}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill={activeGenreIndex === idx ? 'var(--primary, #ff4081)' : (isLight ? 'rgba(0, 0, 0, 0.75)' : 'rgba(255, 255, 255, 0.75)')}
                    fontSize="11"
                    fontWeight={activeGenreIndex === idx ? 700 : 500}
                    style={{ cursor: 'pointer', transition: 'all 0.2s' }}
                    onMouseEnter={() => setActiveGenreIndex(idx)}
                    onMouseLeave={() => setActiveGenreIndex(null)}
                  >
                    {lbl.name} {lbl.percentage}%
                  </text>
                ))}
              </svg>
            </div>
          )}

          {/* Genre Badges / Chips */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '12px', justifyContent: 'center' }}>
            {(stats?.genreDistribution || []).map((genre, idx) => (
              <span
                key={genre.key}
                onMouseEnter={() => setActiveGenreIndex(idx)}
                onMouseLeave={() => setActiveGenreIndex(null)}
                style={{
                  fontSize: '11px',
                  padding: '3px 8px',
                  borderRadius: '8px',
                  background: activeGenreIndex === idx ? genre.color : (isLight ? 'rgba(0, 0, 0, 0.04)' : 'rgba(255, 255, 255, 0.05)'),
                  color: activeGenreIndex === idx ? '#fff' : (isLight ? 'rgba(0, 0, 0, 0.75)' : 'rgba(255, 255, 255, 0.75)'),
                  border: `1px solid ${activeGenreIndex === idx ? genre.color : (isLight ? 'rgba(0, 0, 0, 0.08)' : 'rgba(255, 255, 255, 0.08)')}`,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: genre.color }} />
                {genre.name.split(' ')[0]} {genre.percentage}%
              </span>
            ))}
          </div>
        </div>

        {/* Right Column: Top Artists & Smart Radio Launcher */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Smart Radio Action Card */}
          <div style={{
            background: isLight
              ? 'linear-gradient(135deg, rgba(255, 64, 129, 0.08) 0%, rgba(0, 212, 255, 0.08) 100%)'
              : 'linear-gradient(135deg, rgba(255, 64, 129, 0.15) 0%, rgba(0, 212, 255, 0.12) 100%)',
            border: isLight ? '1px solid rgba(255, 64, 129, 0.2)' : '1px solid rgba(255, 64, 129, 0.3)',
            borderRadius: '16px',
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px'
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--primary, #ff4081)', fontSize: '12px', fontWeight: 700 }}>
                <Radio size={15} /> 智能风格电台 (Smart Radio)
              </div>
              <h4 style={{ margin: '4px 0 2px 0', fontSize: '15px', fontWeight: 700, color: isLight ? '#1a192b' : '#fff' }}>
                基于您的最近偏好生成专属电台
              </h4>
              <p style={{ margin: 0, fontSize: '12px', color: isLight ? 'rgba(0,0,0,0.55)' : 'rgba(255,255,255,0.55)' }}>
                动态融合「{stats?.persona}」主偏好与常听歌手，智能平滑穿插推荐
              </p>
            </div>

            <button
              type="button"
              onClick={handleLaunchSmartRadio}
              style={{
                background: 'linear-gradient(135deg, #ff4081 0%, #7928ca 100%)',
                color: '#fff',
                border: 'none',
                borderRadius: '12px',
                padding: '10px 18px',
                fontWeight: 700,
                fontSize: '13px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 4px 16px rgba(255, 64, 129, 0.35)',
                whiteSpace: 'nowrap',
                transition: 'all 0.2s'
              }}
            >
              <Play size={14} fill="#fff" />
              启动专属电台
            </button>
          </div>

          {/* Top Listened Artists */}
          <div style={{
            background: isLight ? 'rgba(255, 255, 255, 0.85)' : 'rgba(20, 16, 30, 0.8)',
            border: isLight ? '1px solid rgba(0, 0, 0, 0.08)' : '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '16px',
            padding: '16px 20px',
            flex: 1
          }}>
            <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <User size={15} color="var(--primary, #ff4081)" /> 常听歌手 (Top Artists)
            </h4>

            {stats?.topArtists && stats.topArtists.length > 0 ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '8px' }}>
                {stats.topArtists.slice(0, 8).map((artist, idx) => (
                  <div
                    key={artist.name + idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '8px 10px',
                      borderRadius: '10px',
                      background: isLight ? 'rgba(0, 0, 0, 0.03)' : 'rgba(255, 255, 255, 0.03)',
                      border: isLight ? '1px solid rgba(0, 0, 0, 0.05)' : '1px solid rgba(255, 255, 255, 0.05)'
                    }}
                  >
                    <div style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      background: idx < 3 ? 'linear-gradient(135deg, #ff4081, #ff6b35)' : (isLight ? 'rgba(0, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0.15)'),
                      color: idx < 3 ? '#fff' : (isLight ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.7)'),
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '11px',
                      fontWeight: 700,
                      flexShrink: 0
                    }}>
                      {idx + 1}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '13px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {artist.name}
                      </div>
                      <small style={{ fontSize: '11px', color: isLight ? 'rgba(0,0,0,0.45)' : 'rgba(255,255,255,0.45)' }}>
                        {artist.count ? `${artist.count} 次播放` : '偏好常听'}
                      </small>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: '12px', color: isLight ? 'rgba(0,0,0,0.45)' : 'rgba(255,255,255,0.45)', padding: '16px 0', textAlign: 'center' }}>
                暂无足够播放记录，畅听更多音乐后自动生成常听歌手排行
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
