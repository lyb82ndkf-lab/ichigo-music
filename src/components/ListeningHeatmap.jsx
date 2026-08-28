// src/components/ListeningHeatmap.jsx - Listening Heatmap and Calendar Component
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import {
  Calendar, Flame, Disc, Music, Play, RefreshCw, ChevronLeft, ChevronRight,
  TrendingUp, Clock, Sparkles, Award, Heart, Plus, ListMusic, Check
} from 'lucide-react';
import {
  getListeningHeatmapData,
  generateYearGrid,
  generateMonthGrid,
  formatToDateKey,
  formatDateChinese,
  getLevelFromCount
} from '../utils/listeningHeatmap';

export default function ListeningHeatmap() {
  const { playSong, likedSongIds, toggleLike, navigateTo, colorMode } = useApp();

  const [loading, setLoading] = useState(true);
  const [heatmapData, setHeatmapData] = useState(null);
  const [viewMode, setViewMode] = useState('year'); // 'year' | 'month'
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().getMonth()); // 0-11
  const [selectedDateKey, setSelectedDateKey] = useState(() => formatToDateKey(Date.now()));
  const [hoveredDay, setHoveredDay] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  // Light Mode Detection
  const isLight = useMemo(() => {
    if (colorMode === 'light') return true;
    if (colorMode === 'dark') return false;
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: light)').matches;
    }
    return false;
  }, [colorMode]);

  // Load Data
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getListeningHeatmapData(selectedYear);
      setHeatmapData(data);
      if (!data.dateMap.has(selectedDateKey)) {
        const keys = Array.from(data.dateMap.keys()).sort();
        if (keys.length > 0) {
          setSelectedDateKey(keys[keys.length - 1]);
        }
      }
    } catch (err) {
      console.error('Failed to load heatmap data:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedYear]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Year Grid Calculation
  const yearGrid = useMemo(() => {
    if (!heatmapData) return { weeks: [], monthLabels: [], weekDayLabels: [] };
    return generateYearGrid(selectedYear, heatmapData.dateMap);
  }, [heatmapData, selectedYear]);

  // Month Grid Calculation
  const monthGrid = useMemo(() => {
    if (!heatmapData) return { weeks: [], monthName: '', weekDayLabels: [] };
    return generateMonthGrid(selectedYear, selectedMonth, heatmapData.dateMap);
  }, [heatmapData, selectedYear, selectedMonth]);

  // Day Details for Selected Date
  const selectedDayData = useMemo(() => {
    if (!heatmapData || !selectedDateKey) return null;
    return heatmapData.dateMap.get(selectedDateKey) || {
      date: selectedDateKey,
      count: 0,
      totalSeconds: 0,
      songs: [],
      topSong: null
    };
  }, [heatmapData, selectedDateKey]);

  // Handle cell click
  const handleDayClick = (dayData) => {
    if (dayData && dayData.date) {
      setSelectedDateKey(dayData.date);
    }
  };

  // Handle cell hover for tooltip
  const handleMouseEnter = (e, dayData) => {
    if (!dayData || !dayData.date) return;
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltipPos({
      x: rect.left + rect.width / 2,
      y: rect.top - 10
    });
    setHoveredDay(dayData);
  };

  const handleMouseLeave = () => {
    setHoveredDay(null);
  };

  // Play all songs of selected day
  const handlePlayDaySongs = () => {
    if (selectedDayData && selectedDayData.songs.length > 0) {
      playSong(selectedDayData.songs[0], selectedDayData.songs);
    }
  };

  const formatSeconds = (sec) => {
    if (!sec || sec <= 0) return '0 分钟';
    const m = Math.floor(sec / 60);
    if (m < 60) return `${m} 分钟`;
    const h = (m / 60).toFixed(1);
    return `${h} 小时`;
  };

  const formatDurationTime = (sec) => {
    const s = Math.round(sec || 0);
    const m = Math.floor(s / 60);
    const rem = s % 60;
    return `${String(m).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
  };

  const formatTimestamp = (ts) => {
    if (!ts) return '';
    const d = new Date(ts);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  // Cell Level Color Helper
  const getCellBackground = (level, isSelected) => {
    if (isSelected) {
      return 'var(--primary)';
    }
    if (isLight) {
      switch (level) {
        case 1:
          return 'rgba(var(--accent-rgb, 255, 64, 129), 0.35)';
        case 2:
          return 'rgba(var(--accent-rgb, 255, 64, 129), 0.6)';
        case 3:
          return 'rgba(var(--accent-rgb, 255, 64, 129), 0.85)';
        case 4:
          return 'var(--primary)';
        default:
          return 'rgba(0, 0, 0, 0.06)';
      }
    } else {
      switch (level) {
        case 1:
          return 'rgba(var(--accent-rgb, 255, 64, 129), 0.28)';
        case 2:
          return 'rgba(var(--accent-rgb, 255, 64, 129), 0.55)';
        case 3:
          return 'rgba(var(--accent-rgb, 255, 64, 129), 0.85)';
        case 4:
          return 'var(--primary)';
        default:
          return 'rgba(255, 255, 255, 0.05)';
      }
    }
  };

  const totalWeeks = Math.max(1, yearGrid.weeks.length);

  return (
    <div className="listening-heatmap-container" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header & Controls Toolbar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px',
        padding: '20px 24px',
        background: isLight ? 'rgba(255, 255, 255, 0.85)' : 'rgba(255, 255, 255, 0.03)',
        borderRadius: '16px',
        border: isLight ? '1px solid rgba(0, 0, 0, 0.08)' : '1px solid rgba(255, 255, 255, 0.08)',
        boxShadow: isLight ? '0 4px 20px rgba(0, 0, 0, 0.04)' : 'none',
        backdropFilter: 'blur(12px)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '44px',
            height: '44px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, var(--primary), #9c27b0)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 16px var(--primary-glow, rgba(255, 64, 129, 0.35))'
          }}>
            <Calendar size={22} color="#ffffff" />
          </div>
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-main, #1e1e2d)', margin: 0 }}>
              听歌历史足迹日历
            </h2>
            <div style={{ fontSize: '12px', color: 'var(--text-muted, #71717a)', marginTop: '3px' }}>
              记录每日听歌频次、累计时长与当日最爱单曲
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          {/* View Mode Segmented Control */}
          <div style={{
            display: 'flex',
            background: isLight ? 'rgba(0, 0, 0, 0.06)' : 'rgba(0, 0, 0, 0.35)',
            padding: '3px',
            borderRadius: '10px',
            border: isLight ? '1px solid rgba(0, 0, 0, 0.08)' : '1px solid rgba(255, 255, 255, 0.1)'
          }}>
            <button
              type="button"
              onClick={() => setViewMode('year')}
              style={{
                padding: '6px 14px',
                borderRadius: '8px',
                border: 'none',
                background: viewMode === 'year' ? 'var(--primary)' : 'transparent',
                color: viewMode === 'year' ? '#ffffff' : 'var(--text-muted, #71717a)',
                fontSize: '12.5px',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              年度热力图
            </button>
            <button
              type="button"
              onClick={() => setViewMode('month')}
              style={{
                padding: '6px 14px',
                borderRadius: '8px',
                border: 'none',
                background: viewMode === 'month' ? 'var(--primary)' : 'transparent',
                color: viewMode === 'month' ? '#ffffff' : 'var(--text-muted, #71717a)',
                fontSize: '12.5px',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              月度日历
            </button>
          </div>

          {/* Year / Month Selector */}
          {viewMode === 'year' ? (
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              style={{
                background: isLight ? '#ffffff' : 'rgba(0, 0, 0, 0.4)',
                border: isLight ? '1px solid rgba(0, 0, 0, 0.15)' : '1px solid rgba(255, 255, 255, 0.15)',
                color: isLight ? '#1e1e2d' : '#ffffff',
                borderRadius: '10px',
                padding: '6px 12px',
                fontSize: '13px',
                fontWeight: 700,
                outline: 'none',
                cursor: 'pointer',
                boxShadow: isLight ? '0 2px 6px rgba(0,0,0,0.05)' : 'none'
              }}
            >
              {(heatmapData?.availableYears || [new Date().getFullYear()]).map(y => (
                <option key={y} value={y} style={{ background: isLight ? '#ffffff' : '#181224', color: isLight ? '#1e1e2d' : '#ffffff' }}>{y} 年</option>
              ))}
            </select>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <button
                type="button"
                onClick={() => {
                  if (selectedMonth === 0) {
                    setSelectedMonth(11);
                    setSelectedYear(y => y - 1);
                  } else {
                    setSelectedMonth(m => m - 1);
                  }
                }}
                style={{
                  background: isLight ? 'rgba(0, 0, 0, 0.05)' : 'rgba(255, 255, 255, 0.08)',
                  border: isLight ? '1px solid rgba(0, 0, 0, 0.1)' : '1px solid rgba(255, 255, 255, 0.12)',
                  color: 'var(--text-main, #1e1e2d)',
                  borderRadius: '8px',
                  width: '30px',
                  height: '30px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer'
                }}
                title="上个月"
              >
                <ChevronLeft size={16} />
              </button>
              <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main, #1e1e2d)', minWidth: '80px', textAlign: 'center' }}>
                {selectedYear}年 {selectedMonth + 1}月
              </span>
              <button
                type="button"
                onClick={() => {
                  if (selectedMonth === 11) {
                    setSelectedMonth(0);
                    setSelectedYear(y => y + 1);
                  } else {
                    setSelectedMonth(m => m + 1);
                  }
                }}
                style={{
                  background: isLight ? 'rgba(0, 0, 0, 0.05)' : 'rgba(255, 255, 255, 0.08)',
                  border: isLight ? '1px solid rgba(0, 0, 0, 0.1)' : '1px solid rgba(255, 255, 255, 0.12)',
                  color: 'var(--text-main, #1e1e2d)',
                  borderRadius: '8px',
                  width: '30px',
                  height: '30px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer'
                }}
                title="下个月"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}

          {/* Refresh Button */}
          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: isLight ? 'rgba(0, 0, 0, 0.05)' : 'rgba(255, 255, 255, 0.08)',
              border: isLight ? '1px solid rgba(0, 0, 0, 0.12)' : '1px solid rgba(255, 255, 255, 0.14)',
              borderRadius: '10px',
              padding: '6px 14px',
              color: 'var(--text-main, #1e1e2d)',
              fontSize: '12.5px',
              fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer'
            }}
          >
            <RefreshCw size={14} className={loading ? 'spin' : ''} />
            <span>刷新足迹</span>
          </button>
        </div>
      </div>

      {/* 4 Metric Stats Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '16px'
      }}>
        <div style={{
          background: isLight ? 'rgba(255, 255, 255, 0.9)' : 'rgba(255, 255, 255, 0.03)',
          border: isLight ? '1px solid rgba(0, 0, 0, 0.08)' : '1px solid rgba(255, 255, 255, 0.07)',
          borderRadius: '14px',
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: '14px',
          boxShadow: isLight ? '0 4px 14px rgba(0, 0, 0, 0.04)' : 'none'
        }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '10px',
            background: 'rgba(255, 64, 129, 0.12)',
            color: 'var(--primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Calendar size={20} />
          </div>
          <div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted, #71717a)', textTransform: 'uppercase', fontWeight: 700 }}>
              累计听歌天数
            </div>
            <div style={{ fontSize: '20px', fontWeight: 900, color: 'var(--text-main, #1e1e2d)', marginTop: '2px' }}>
              {heatmapData?.activeDays || 0} <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-muted, #71717a)' }}>天</span>
            </div>
          </div>
        </div>

        <div style={{
          background: isLight ? 'rgba(255, 255, 255, 0.9)' : 'rgba(255, 255, 255, 0.03)',
          border: isLight ? '1px solid rgba(0, 0, 0, 0.08)' : '1px solid rgba(255, 255, 255, 0.07)',
          borderRadius: '14px',
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: '14px',
          boxShadow: isLight ? '0 4px 14px rgba(0, 0, 0, 0.04)' : 'none'
        }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '10px',
            background: 'rgba(0, 212, 255, 0.12)',
            color: '#00d4ff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Music size={20} />
          </div>
          <div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted, #71717a)', textTransform: 'uppercase', fontWeight: 700 }}>
              足迹累计曲数
            </div>
            <div style={{ fontSize: '20px', fontWeight: 900, color: 'var(--text-main, #1e1e2d)', marginTop: '2px' }}>
              {heatmapData?.totalSongs || 0} <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-muted, #71717a)' }}>首</span>
            </div>
          </div>
        </div>

        <div style={{
          background: isLight ? 'rgba(255, 255, 255, 0.9)' : 'rgba(255, 255, 255, 0.03)',
          border: isLight ? '1px solid rgba(0, 0, 0, 0.08)' : '1px solid rgba(255, 255, 255, 0.07)',
          borderRadius: '14px',
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: '14px',
          boxShadow: isLight ? '0 4px 14px rgba(0, 0, 0, 0.04)' : 'none'
        }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '10px',
            background: 'rgba(255, 107, 53, 0.12)',
            color: '#ff6b35',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Flame size={20} />
          </div>
          <div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted, #71717a)', textTransform: 'uppercase', fontWeight: 700 }}>
              连续听歌打卡
            </div>
            <div style={{ fontSize: '20px', fontWeight: 900, color: 'var(--text-main, #1e1e2d)', marginTop: '2px' }}>
              {heatmapData?.currentStreak || 0} <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-muted, #71717a)' }}>天 (最佳 {heatmapData?.longestStreak || 0} 天)</span>
            </div>
          </div>
        </div>

        <div style={{
          background: isLight ? 'rgba(255, 255, 255, 0.9)' : 'rgba(255, 255, 255, 0.03)',
          border: isLight ? '1px solid rgba(0, 0, 0, 0.08)' : '1px solid rgba(255, 255, 255, 0.07)',
          borderRadius: '14px',
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: '14px',
          boxShadow: isLight ? '0 4px 14px rgba(0, 0, 0, 0.04)' : 'none'
        }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '10px',
            background: 'rgba(156, 39, 176, 0.12)',
            color: '#ba68c8',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Award size={20} />
          </div>
          <div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted, #71717a)', textTransform: 'uppercase', fontWeight: 700 }}>
              单日最高纪录
            </div>
            <div style={{ fontSize: '20px', fontWeight: 900, color: 'var(--text-main, #1e1e2d)', marginTop: '2px' }}>
              {heatmapData?.maxDailyPlays || 0} <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-muted, #71717a)' }}>首 {heatmapData?.maxDay ? `(${heatmapData.maxDay.slice(5)})` : ''}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Heatmap Visualizer Card */}
      <div style={{
        background: isLight ? 'rgba(255, 255, 255, 0.9)' : 'rgba(255, 255, 255, 0.03)',
        borderRadius: '18px',
        border: isLight ? '1px solid rgba(0, 0, 0, 0.08)' : '1px solid rgba(255, 255, 255, 0.08)',
        boxShadow: isLight ? '0 4px 20px rgba(0, 0, 0, 0.04)' : 'none',
        padding: '24px',
        position: 'relative'
      }}>
        {viewMode === 'year' ? (
          /* Year View: 100% Full Width Adaptive Layout without horizontal scrollbar */
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column' }}>
            {/* Month Labels Header - Proportional Position across 100% width */}
            <div style={{ position: 'relative', height: '20px', marginLeft: '26px', marginRight: '4px', marginBottom: '8px' }}>
              {yearGrid.monthLabels.map((lbl, idx) => {
                const pct = (lbl.weekIndex / totalWeeks) * 100;
                return (
                  <span
                    key={idx}
                    style={{
                      position: 'absolute',
                      left: `${pct}%`,
                      transform: 'translateX(0)',
                      fontSize: '11.5px',
                      fontWeight: 700,
                      color: 'var(--text-muted, #71717a)',
                      userSelect: 'none'
                    }}
                  >
                    {lbl.name}
                  </span>
                );
              })}
            </div>

            {/* Grid with Weekday Labels */}
            <div style={{ display: 'flex', gap: '8px', alignItems: 'stretch', width: '100%' }}>
              {/* Weekday Row Labels */}
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', width: '18px', paddingTop: '2px', paddingBottom: '2px', flexShrink: 0 }}>
                {['日', '一', '二', '三', '四', '五', '六'].map((dayName, idx) => (
                  <span
                    key={idx}
                    style={{
                      fontSize: '10px',
                      lineHeight: '1',
                      color: idx % 2 === 1 ? 'var(--text-muted, #71717a)' : 'transparent',
                      textAlign: 'right',
                      fontWeight: 600,
                      userSelect: 'none'
                    }}
                  >
                    {dayName}
                  </span>
                ))}
              </div>

              {/* 53 Columns Grid - Flexible 100% width stretch */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${totalWeeks}, 1fr)`,
                gap: '3.5px',
                flex: 1,
                width: '100%'
              }}>
                {yearGrid.weeks.map((week, wIdx) => (
                  <div key={wIdx} style={{ display: 'flex', flexDirection: 'column', gap: '3.5px', width: '100%' }}>
                    {week.map((day, dIdx) => {
                      const isSelected = selectedDateKey === day.date;
                      const isFuture = day.isFuture;
                      return (
                        <div
                          key={dIdx}
                          onClick={() => !isFuture && handleDayClick(day)}
                          onMouseEnter={(e) => !isFuture && handleMouseEnter(e, day)}
                          onMouseLeave={handleMouseLeave}
                          style={{
                            width: '100%',
                            aspectRatio: '1 / 1',
                            borderRadius: '3px',
                            background: isFuture ? (isLight ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.02)') : getCellBackground(day.level, isSelected),
                            border: isSelected
                              ? (isLight ? '1.5px solid var(--primary)' : '1.5px solid #ffffff')
                              : (isLight ? '1px solid rgba(0, 0, 0, 0.06)' : '1px solid rgba(255, 255, 255, 0.06)'),
                            boxShadow: isSelected
                              ? '0 0 10px var(--primary-glow, rgba(255,64,129,0.7)), inset 0 0 3px #ffffff'
                              : (day.level >= 3 ? '0 0 6px var(--primary-glow, rgba(255,64,129,0.3))' : 'none'),
                            cursor: isFuture ? 'default' : 'pointer',
                            transition: 'transform 0.15s ease, background 0.2s ease, border-color 0.2s ease',
                            transform: isSelected ? 'scale(1.25)' : 'scale(1)'
                          }}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* Month View: Full Calendar Layout */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%', minWidth: 0 }}>
            {/* Weekday Header */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: '10px', textAlign: 'center', width: '100%', minWidth: 0 }}>
              {['周日', '周一', '周二', '周三', '周四', '周五', '周六'].map((dayName, idx) => (
                <div key={idx} style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted, #71717a)', paddingBottom: '6px', minWidth: 0, overflow: 'hidden' }}>
                  {dayName}
                </div>
              ))}
            </div>

            {/* Month Day Cells */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: '10px', width: '100%', minWidth: 0 }}>
              {monthGrid.weeks.flat().map((day, idx) => {
                const isSelected = selectedDateKey === day.date;
                const isCurrentMonth = day.isCurrentMonth;
                const isFuture = day.isFuture;
                return (
                  <div
                    key={idx}
                    onClick={() => isCurrentMonth && !isFuture && handleDayClick(day)}
                    style={{
                      minHeight: '80px',
                      minWidth: 0,
                      width: '100%',
                      overflow: 'hidden',
                      background: isSelected
                        ? 'rgba(var(--accent-rgb, 255, 64, 129), 0.15)'
                        : (isCurrentMonth ? (day.count > 0 ? (isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255, 255, 255, 0.05)') : (isLight ? 'rgba(0,0,0,0.02)' : 'rgba(255, 255, 255, 0.02)')) : (isLight ? 'rgba(0,0,0,0.02)' : 'rgba(0, 0, 0, 0.2)')),
                      border: isSelected
                        ? '1.5px solid var(--primary)'
                        : (isLight ? '1px solid rgba(0, 0, 0, 0.08)' : '1px solid rgba(255, 255, 255, 0.08)'),
                      borderRadius: '12px',
                      padding: '8px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      cursor: (isCurrentMonth && !isFuture) ? 'pointer' : 'default',
                      opacity: isCurrentMonth ? (isFuture ? 0.4 : 1) : 0.3,
                      transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                      boxShadow: isSelected ? '0 4px 20px var(--primary-glow, rgba(255,64,129,0.35))' : 'none'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', minWidth: 0 }}>
                      <span style={{ fontSize: '13px', fontWeight: isSelected ? 800 : 600, color: isSelected ? 'var(--primary)' : 'var(--text-main, #1e1e2d)' }}>
                        {day.day}
                      </span>
                      {day.count > 0 && (
                        <span style={{
                          fontSize: '10px',
                          fontWeight: 700,
                          padding: '1px 6px',
                          borderRadius: '99px',
                          background: 'var(--primary)',
                          color: '#ffffff',
                          flexShrink: 0
                        }}>
                          {day.count} 首
                        </span>
                      )}
                    </div>

                    {day.topSong && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', width: '100%', minWidth: 0, overflow: 'hidden' }}>
                        {day.topSong.coverUrl ? (
                          <img
                            src={day.topSong.coverUrl}
                            alt=""
                            style={{ width: '22px', height: '22px', borderRadius: '4px', objectFit: 'cover', flexShrink: 0 }}
                          />
                        ) : (
                          <Disc size={16} color="var(--primary)" style={{ flexShrink: 0 }} />
                        )}
                        <span
                          title={day.topSong.name}
                          style={{
                            fontSize: '11px',
                            color: 'var(--text-main, #1e1e2d)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            flex: 1,
                            minWidth: 0
                          }}
                        >
                          {day.topSong.name}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Legend */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-muted, #71717a)' }}>较少</span>
          {[0, 1, 2, 3, 4].map(lvl => (
            <div
              key={lvl}
              style={{
                width: '12px',
                height: '12px',
                borderRadius: '3px',
                background: getCellBackground(lvl, false),
                border: isLight ? '1px solid rgba(0, 0, 0, 0.08)' : '1px solid rgba(255, 255, 255, 0.08)'
              }}
            />
          ))}
          <span style={{ fontSize: '11px', color: 'var(--text-muted, #71717a)' }}>较多</span>
        </div>
      </div>

      {/* Floating Hover Tooltip */}
      {hoveredDay && (
        <div style={{
          position: 'fixed',
          left: `${tooltipPos.x}px`,
          top: `${tooltipPos.y}px`,
          transform: 'translate(-50%, -100%)',
          background: isLight ? 'rgba(255, 255, 255, 0.98)' : 'rgba(18, 12, 28, 0.95)',
          border: isLight ? '1px solid rgba(0, 0, 0, 0.12)' : '1px solid rgba(255, 255, 255, 0.15)',
          borderRadius: '10px',
          padding: '8px 12px',
          color: isLight ? '#1e1e2d' : '#ffffff',
          fontSize: '12px',
          pointerEvents: 'none',
          zIndex: 9999,
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.2)',
          backdropFilter: 'blur(10px)',
          minWidth: '160px'
        }}>
          <div style={{ fontWeight: 700, color: 'var(--primary)', marginBottom: '3px' }}>
            {formatDateChinese(hoveredDay.date)}
          </div>
          <div style={{ color: 'var(--text-muted, #71717a)', fontSize: '11.5px' }}>
            播放曲数: <strong style={{ color: isLight ? '#1e1e2d' : '#ffffff' }}>{hoveredDay.count || 0} 首</strong>
          </div>
          {hoveredDay.topSong && (
            <div style={{ marginTop: '5px', paddingTop: '5px', borderTop: isLight ? '1px solid rgba(0,0,0,0.08)' : '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Sparkles size={12} color="var(--primary)" />
              <span style={{ fontSize: '11px', color: isLight ? '#1e1e2d' : '#ffffff' }}>
                当日最爱: {hoveredDay.topSong.name} - {hoveredDay.topSong.artist}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Day Details Drawer / Panel */}
      <div style={{
        background: isLight ? 'rgba(255, 255, 255, 0.9)' : 'rgba(255, 255, 255, 0.03)',
        borderRadius: '18px',
        border: isLight ? '1px solid rgba(0, 0, 0, 0.08)' : '1px solid rgba(255, 255, 255, 0.08)',
        boxShadow: isLight ? '0 4px 20px rgba(0, 0, 0, 0.04)' : 'none',
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px'
      }}>
        {/* Detail Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sparkles size={18} color="var(--primary)" />
              <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-main, #1e1e2d)', margin: 0 }}>
                {formatDateChinese(selectedDateKey)} 听歌足迹
              </h3>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted, #71717a)', marginTop: '4px' }}>
              共记录 {selectedDayData?.count || 0} 首歌曲播放 · 累计听歌时长 {formatSeconds(selectedDayData?.totalSeconds || 0)}
            </div>
          </div>

          {selectedDayData && selectedDayData.songs.length > 0 && (
            <button
              type="button"
              onClick={handlePlayDaySongs}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: 'var(--primary)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '99px',
                padding: '8px 20px',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 4px 18px var(--primary-glow, rgba(255,64,129,0.4))',
                transition: 'transform 0.15s ease'
              }}
            >
              <Play size={15} fill="currentColor" />
              <span>播放本日全部歌曲 ({selectedDayData.songs.length})</span>
            </button>
          )}
        </div>

        {/* Spotlight Card: Top Favorite Song of the Day */}
        {selectedDayData?.topSong && (
          <div style={{
            background: isLight
              ? 'linear-gradient(135deg, rgba(var(--accent-rgb, 255, 64, 129), 0.12), rgba(255, 255, 255, 0.95))'
              : 'linear-gradient(135deg, rgba(var(--accent-rgb, 255, 64, 129), 0.15), rgba(0, 0, 0, 0.4))',
            borderRadius: '16px',
            border: isLight ? '1px solid rgba(var(--accent-rgb, 255, 64, 129), 0.25)' : '1px solid rgba(var(--accent-rgb, 255, 64, 129), 0.3)',
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '16px',
            boxShadow: isLight ? '0 6px 20px rgba(0, 0, 0, 0.05)' : '0 8px 32px rgba(0, 0, 0, 0.3)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ position: 'relative', width: '56px', height: '56px' }}>
                <img
                  src={selectedDayData.topSong.coverUrl || 'static/ichigo.png'}
                  alt=""
                  style={{ width: '56px', height: '56px', borderRadius: '12px', objectFit: 'cover', boxShadow: '0 4px 14px rgba(0,0,0,0.2)' }}
                />
                <div style={{
                  position: 'absolute',
                  top: '-4px',
                  right: '-4px',
                  background: 'var(--primary)',
                  color: '#ffffff',
                  borderRadius: '50%',
                  width: '20px',
                  height: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '11px',
                  fontWeight: 900
                }}>
                  👑
                </div>
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 800, padding: '2px 8px', borderRadius: '6px', background: 'var(--primary)', color: '#ffffff' }}>
                    当日最爱单曲
                  </span>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted, #71717a)' }}>
                    今日循环 {selectedDayData.topSong.count} 次
                  </span>
                </div>
                <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-main, #1e1e2d)', marginTop: '4px' }}>
                  {selectedDayData.topSong.name}
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-muted, #71717a)', marginTop: '2px' }}>
                  {selectedDayData.topSong.artist} {selectedDayData.topSong.album ? `· ${selectedDayData.topSong.album}` : ''}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => playSong(selectedDayData.topSong, selectedDayData.songs)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: isLight ? 'rgba(0, 0, 0, 0.06)' : 'rgba(255, 255, 255, 0.12)',
                border: isLight ? '1px solid rgba(0, 0, 0, 0.1)' : '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '99px',
                padding: '8px 18px',
                color: 'var(--text-main, #1e1e2d)',
                fontSize: '13px',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              <Play size={14} fill="currentColor" />
              <span>播放此曲</span>
            </button>
          </div>
        )}

        {/* Songs List */}
        {(!selectedDayData || selectedDayData.songs.length === 0) ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted, #71717a)', fontSize: '13px' }}>
            本日没有收录任何听歌记录，快去戴上耳机听一首吧🍓
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="songs-table" style={{ marginTop: 0 }}>
              <thead>
                <tr>
                  <th style={{ width: '8%' }}>时间</th>
                  <th style={{ width: '42%' }}>歌名</th>
                  <th style={{ width: '25%' }}>歌手</th>
                  <th style={{ width: '18%' }}>专辑</th>
                  <th style={{ width: '7%' }}>时长</th>
                </tr>
              </thead>
              <tbody>
                {selectedDayData.songs.map((song, index) => {
                  return (
                    <tr
                      key={song.id + '-' + index + '-' + song.timestamp}
                      className="song-row"
                      onDoubleClick={() => playSong(song, selectedDayData.songs)}
                    >
                      <td style={{ color: 'var(--text-muted, #71717a)', fontSize: '12px', paddingLeft: '16px' }}>
                        {formatTimestamp(song.timestamp)}
                      </td>
                      <td>
                        <div className="song-title-cell" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <button
                            type="button"
                            className="play-pause-btn"
                            style={{ width: '26px', height: '26px', boxShadow: 'none' }}
                            onClick={() => playSong(song, selectedDayData.songs)}
                          >
                            <Play size={11} fill="currentColor" style={{ marginLeft: 1 }} />
                          </button>
                          {song.coverUrl && (
                            <img
                              src={song.coverUrl}
                              alt=""
                              style={{ width: '32px', height: '32px', borderRadius: '6px', objectFit: 'cover' }}
                            />
                          )}
                          <div className="song-row-info">
                            <div
                              className="song-row-name"
                              onClick={() => playSong(song, selectedDayData.songs)}
                              style={{ cursor: 'pointer', fontWeight: 600, color: 'var(--text-main, #1e1e2d)' }}
                            >
                              {song.name}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="song-row-artists" style={{ color: 'var(--text-muted, #71717a)' }}>
                          {song.artist || '未知歌手'}
                        </div>
                      </td>
                      <td style={{ color: 'var(--text-muted, #71717a)' }}>
                        {song.album || '未知专辑'}
                      </td>
                      <td style={{ color: 'var(--text-muted, #71717a)', fontSize: '12px' }}>
                        {formatDurationTime(song.duration)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
