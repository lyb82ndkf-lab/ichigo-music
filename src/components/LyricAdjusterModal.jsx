import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { api } from '../utils/api';
import { Clock, Search, RefreshCw, Check, Zap, AlertCircle, X } from 'lucide-react';
import { parseLrc, parseYrc, mergeTranslation, mergeRomaji, computeLineDurations } from '../utils/lyrics/lyricParser';
import { normalizeMatchedLines, assessLyricQuality } from '../hooks/useLyricEngine';

export default function LyricAdjusterModal({ isOpen, onClose, currentSong }) {
  const { advancedLyricConfig, saveAdvancedLyricConfig, currentSong: activeSong } = useApp();
  const song = currentSong || activeSong;

  const [activeTab, setActiveTab] = useState('offset'); // 'offset' | 'search'
  const [searchTitle, setSearchTitle] = useState('');
  const [searchArtist, setSearchArtist] = useState('');
  const [searchSource, setSearchSource] = useState('amll,qq,kugou,netease');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState([]);
  const [error, setError] = useState('');
  const [appliedMsg, setAppliedMsg] = useState('');

  const currentOffset = advancedLyricConfig?.globalOffset || 0;

  useEffect(() => {
    if (song) {
      setSearchTitle(song.name || song.title || '');
      setSearchArtist(song.ar?.[0]?.name || song.artists?.[0]?.name || song.artist || '');
      setResults([]);
      setError('');
      setAppliedMsg('');
    }
  }, [song, isOpen]);

  if (!isOpen) return null;

  const handleAdjustOffset = (delta) => {
    const nextOffset = Math.round((currentOffset + delta) * 100) / 100;
    saveAdvancedLyricConfig({ globalOffset: nextOffset });
  };

  const handleResetOffset = () => {
    saveAdvancedLyricConfig({ globalOffset: 0 });
  };

  const handleSearchLyrics = async () => {
    if (!searchTitle.trim()) return;
    setSearching(true);
    setError('');
    setAppliedMsg('');
    try {
      const res = await api.getMatchedLyrics({
        id: song?.id,
        title: searchTitle.trim(),
        artist: searchArtist.trim(),
        sources: searchSource,
      });

      if (res && (res.lyrics || res.lines || Array.isArray(res))) {
        const lines = computeLineDurations(normalizeMatchedLines(res));
        setResults([{
          id: 'matched_1',
          source: res.source || 'multi-source',
          quality: assessLyricQuality(lines, song?.duration ? song.duration / 1000 : 0),
          lines: lines,
          raw: res
        }]);
      } else {
        setError('未找到匹配的歌词版本，请尝试更改搜索关键词或源');
      }
    } catch (err) {
      console.warn('Manual lyric search failed:', err);
      setError('搜索失败：' + (err.message || '网络请求超时'));
    } finally {
      setSearching(false);
    }
  };

  const handleApplyLyrics = (candidate) => {
    if (!song?.id || !candidate?.lines) return;
    const cacheKey = `ichigo_lyrics_parsed_${song.id}`;
    try {
      localStorage.setItem(cacheKey, JSON.stringify(candidate.lines));
      if (window.electronAPI?.writeLyricCache) {
        window.electronAPI.writeLyricCache({
          key: cacheKey,
          data: candidate.lines,
        }).catch(() => {});
      }
      setAppliedMsg('歌词已成功应用并持久化！即将刷新显示...');
      setTimeout(() => {
        onClose();
        window.location.reload();
      }, 900);
    } catch (e) {
      setError('保存歌词缓存失败：' + e.message);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'rgba(0,0,0,0.65)',
      backdropFilter: 'blur(12px)',
      animation: 'fadeIn 0.2s ease-out'
    }} onClick={onClose}>
      <div style={{
        width: '520px',
        maxWidth: '92vw',
        maxHeight: '85vh',
        background: 'rgba(24, 28, 38, 0.95)',
        border: '1px solid rgba(255, 255, 255, 0.16)',
        borderRadius: '16px',
        boxShadow: '0 24px 48px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.08)',
        color: '#fff',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px',
          borderBottom: '1px solid rgba(255,255,255,0.1)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, fontSize: '15px' }}>
            <Clock size={18} color="var(--primary)" />
            <span>歌词微调与手动替换</span>
          </div>
          <button type="button" onClick={onClose} style={{
            background: 'transparent',
            border: 'none',
            color: 'rgba(255,255,255,0.6)',
            cursor: 'pointer',
            padding: '4px'
          }}>
            <X size={18} />
          </button>
        </div>

        {/* Tab switcher */}
        <div style={{
          display: 'flex',
          padding: '10px 20px',
          gap: '8px',
          borderBottom: '1px solid rgba(255,255,255,0.06)'
        }}>
          <button type="button" onClick={() => setActiveTab('offset')} style={{
            flex: 1,
            padding: '8px',
            borderRadius: '8px',
            border: '1px solid',
            borderColor: activeTab === 'offset' ? 'var(--primary)' : 'rgba(255,255,255,0.12)',
            background: activeTab === 'offset' ? 'rgba(255, 64, 129, 0.15)' : 'transparent',
            color: activeTab === 'offset' ? '#fff' : 'rgba(255,255,255,0.7)',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: 500
          }}>
            时间轴微调
          </button>
          <button type="button" onClick={() => setActiveTab('search')} style={{
            flex: 1,
            padding: '8px',
            borderRadius: '8px',
            border: '1px solid',
            borderColor: activeTab === 'search' ? 'var(--primary)' : 'rgba(255,255,255,0.12)',
            background: activeTab === 'search' ? 'rgba(255, 64, 129, 0.15)' : 'transparent',
            color: activeTab === 'search' ? '#fff' : 'rgba(255,255,255,0.7)',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: 500
          }}>
            多源手动搜索替换
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
          {activeTab === 'offset' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{
                textAlign: 'center',
                padding: '18px',
                background: 'rgba(255,255,255,0.04)',
                borderRadius: '12px',
                border: '1px solid rgba(255,255,255,0.08)'
              }}>
                <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', marginBottom: '6px' }}>
                  当前全局时间轴偏移
                </div>
                <div style={{
                  fontSize: '28px',
                  fontWeight: 700,
                  color: currentOffset === 0 ? '#fff' : (currentOffset > 0 ? '#4caf50' : '#ff9800'),
                  fontVariantNumeric: 'tabular-nums'
                }}>
                  {currentOffset > 0 ? `+${currentOffset.toFixed(2)}s` : `${currentOffset.toFixed(2)}s`}
                </div>
                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.45)', marginTop: '4px' }}>
                  （正数代表歌词延后显示，负数代表歌词提前显示）
                </div>
              </div>

              {/* Offset buttons */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                <button type="button" onClick={() => handleAdjustOffset(-0.5)} style={btnStyle}>-0.5s</button>
                <button type="button" onClick={() => handleAdjustOffset(-0.2)} style={btnStyle}>-0.2s</button>
                <button type="button" onClick={() => handleAdjustOffset(-0.1)} style={btnStyle}>-0.1s</button>
                <button type="button" onClick={() => handleAdjustOffset(-0.05)} style={btnStyle}>-0.05s</button>
                <button type="button" onClick={() => handleAdjustOffset(0.05)} style={btnStyle}>+0.05s</button>
                <button type="button" onClick={() => handleAdjustOffset(0.1)} style={btnStyle}>+0.1s</button>
                <button type="button" onClick={() => handleAdjustOffset(0.2)} style={btnStyle}>+0.2s</button>
                <button type="button" onClick={() => handleAdjustOffset(0.5)} style={btnStyle}>+0.5s</button>
              </div>

              <div style={{ display: 'flex', justifyContent: 'center', marginTop: '6px' }}>
                <button type="button" onClick={handleResetOffset} style={{
                  ...btnStyle,
                  padding: '8px 24px',
                  background: 'rgba(255,255,255,0.08)',
                  color: 'rgba(255,255,255,0.8)'
                }}>
                  <RefreshCw size={13} style={{ marginRight: '6px' }} /> 重置为 0.0s
                </button>
              </div>
            </div>
          )}

          {activeTab === 'search' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  placeholder="歌曲名称"
                  value={searchTitle}
                  onChange={e => setSearchTitle(e.target.value)}
                  style={inputStyle}
                />
                <input
                  type="text"
                  placeholder="歌手名称（选填）"
                  value={searchArtist}
                  onChange={e => setSearchArtist(e.target.value)}
                  style={inputStyle}
                />
                <button
                  type="button"
                  onClick={handleSearchLyrics}
                  disabled={searching || !searchTitle.trim()}
                  style={{
                    ...btnStyle,
                    background: 'var(--primary)',
                    color: '#fff',
                    padding: '0 16px',
                    opacity: searching ? 0.6 : 1
                  }}
                >
                  {searching ? <RefreshCw size={14} className="spin" /> : <Search size={14} />}
                </button>
              </div>

              {error && (
                <div style={{
                  padding: '10px 14px',
                  background: 'rgba(244, 67, 54, 0.15)',
                  border: '1px solid rgba(244, 67, 54, 0.3)',
                  borderRadius: '8px',
                  color: '#ff8a80',
                  fontSize: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <AlertCircle size={15} />
                  <span>{error}</span>
                </div>
              )}

              {appliedMsg && (
                <div style={{
                  padding: '10px 14px',
                  background: 'rgba(76, 175, 80, 0.15)',
                  border: '1px solid rgba(76, 175, 80, 0.3)',
                  borderRadius: '8px',
                  color: '#81c784',
                  fontSize: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <Check size={15} />
                  <span>{appliedMsg}</span>
                </div>
              )}

              {results.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)' }}>搜索匹配结果：</div>
                  {results.map((cand, idx) => (
                    <div key={idx} style={{
                      padding: '12px',
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.12)',
                      borderRadius: '10px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '12px'
                    }}>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                          <span style={{
                            fontSize: '10px',
                            padding: '2px 6px',
                            background: 'var(--primary)',
                            color: '#fff',
                            borderRadius: '4px',
                            fontWeight: 600,
                            textTransform: 'uppercase'
                          }}>
                            {cand.source}
                          </span>
                          {cand.quality?.wordTimed && (
                            <span style={{
                              fontSize: '10px',
                              padding: '2px 6px',
                              background: '#4caf50',
                              color: '#fff',
                              borderRadius: '4px',
                              fontWeight: 600
                            }}>
                              逐字时间轴
                            </span>
                          )}
                          <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>
                            共 {cand.lines.length} 行
                          </span>
                        </div>
                        <div style={{
                          fontSize: '12px',
                          color: 'rgba(255,255,255,0.85)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}>
                          {cand.lines[0]?.text || '歌词首句预览'} ... {cand.lines[1]?.text || ''}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleApplyLyrics(cand)}
                        style={{
                          padding: '6px 14px',
                          borderRadius: '6px',
                          background: 'var(--primary)',
                          color: '#fff',
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: '12px',
                          fontWeight: 500,
                          flexShrink: 0
                        }}
                      >
                        替换并应用
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const btnStyle = {
  padding: '8px 12px',
  borderRadius: '8px',
  border: '1px solid rgba(255,255,255,0.12)',
  background: 'rgba(255,255,255,0.06)',
  color: '#fff',
  fontSize: '12px',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  transition: 'all 0.15s ease'
};

const inputStyle = {
  flex: 1,
  padding: '8px 12px',
  borderRadius: '8px',
  border: '1px solid rgba(255,255,255,0.14)',
  background: 'rgba(255,255,255,0.07)',
  color: '#fff',
  fontSize: '13px',
  outline: 'none'
};
