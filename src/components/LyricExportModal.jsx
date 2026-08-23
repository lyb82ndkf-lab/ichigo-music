import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { api } from '../utils/api';
import { parseLrc, parseYrc, mergeTranslation, mergeRomaji, computeLineDurations } from '../utils/lyrics/lyricParser';
import { isJapaneseSong, warmupFuriganaLines } from '../utils/lyrics/furiganaHelper';
import {
  Download,
  Copy,
  Check,
  FileText,
  FileCode,
  Music,
  Globe,
  Sliders,
  X,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Loader2
} from 'lucide-react';
import {
  generateLyricExport,
  sanitizeFilename,
  getFormatExtension,
  downloadLyricFile,
  copyLyricToClipboard,
  extractSongMeta
} from '../utils/lyrics/lyricExporter';

const BASE_FORMAT_OPTIONS = [
  {
    id: 'lrc',
    label: '标准 LRC',
    ext: '.lrc',
    icon: FileText,
    badge: '推荐',
    desc: '通用单语时间戳格式，适配所有硬件与车载播放器'
  },
  {
    id: 'bilingual_lrc',
    label: '双语 LRC',
    ext: '.lrc',
    icon: Globe,
    badge: '双语',
    desc: '原文与翻译逐行对应时间轴，主流软件双语标准'
  },
  {
    id: 'yrc',
    label: '逐字 YRC',
    ext: '.yrc',
    icon: Sparkles,
    badge: '高精逐字',
    desc: '网易云逐字格式，包含每个汉字/词语的精确毫秒时间'
  },
  {
    id: 'txt',
    label: '纯文本 TXT',
    ext: '.txt',
    icon: FileText,
    badge: '纯文本',
    desc: '无时间戳文本歌词，适合阅读、打印、排版与分享'
  },
  {
    id: 'ttml',
    label: 'AMLL TTML',
    ext: '.ttml',
    icon: FileCode,
    badge: 'XML',
    desc: 'Apple Music / AMLL 标准 XML 富文本歌词'
  }
];

export default function LyricExportModal({ isOpen, onClose, currentSong, lyrics = [] }) {
  const { advancedLyricConfig, currentSong: activeSong } = useApp();
  const song = currentSong || activeSong;

  const [selectedFormat, setSelectedFormat] = useState('lrc');
  const [includeMeta, setIncludeMeta] = useState(true);
  const [includeTranslation, setIncludeTranslation] = useState(true);
  const [includeRomaji, setIncludeRomaji] = useState(false);
  const [includeFurigana, setIncludeFurigana] = useState(true);
  const [furiganaMode, setFuriganaMode] = useState('inline'); // 'inline' (漢字(かんじ)) | 'separate' (独立行) | 'ruby_html' (<ruby>) | 'reading' (纯假名)
  const [bilingualMode, setBilingualMode] = useState('interleaved'); // 'interleaved' | 'combined' | 'block'
  const [applyGlobalOffset, setApplyGlobalOffset] = useState(true);
  const [skipInterlude, setSkipInterlude] = useState(true);

  const [copySuccess, setCopySuccess] = useState(false);
  const [exportStatus, setExportStatus] = useState(null); // { type: 'success' | 'error', message: string }
  const [isExporting, setIsExporting] = useState(false);
  const [internalLyrics, setInternalLyrics] = useState(lyrics || []);
  const [isLoadingLyrics, setIsLoadingLyrics] = useState(false);
  const [furiganaWarmed, setFuriganaWarmed] = useState(0);
  useEffect(() => {
    if (Array.isArray(lyrics) && lyrics.length > 0) {
      setInternalLyrics(lyrics);
      return;
    }
    if (!isOpen || !song?.id) {
      setInternalLyrics([]);
      return;
    }

    let isMounted = true;
    setIsLoadingLyrics(true);

    const loadLyricsAsync = async () => {
      const cacheKey = `ichigo_lyrics_parsed_${song.id}`;
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            if (isMounted) {
              setInternalLyrics(parsed);
              setIsLoadingLyrics(false);
            }
            return;
          }
        } catch (e) {}
      }

      try {
        const res = await api.getLyrics(song.id);
        if (!isMounted) return;
        const yrcLines = res.yrc && res.yrc.lyric ? parseYrc(res.yrc.lyric) : [];
        const lrcLines = res.lrc && res.lrc.lyric ? parseLrc(res.lrc.lyric) : [];
        let combined = yrcLines.length > 0 ? yrcLines : lrcLines;
        if (res.tlyric && res.tlyric.lyric) {
          combined = mergeTranslation(combined, res.tlyric.lyric);
        }
        if (res.romalrc && res.romalrc.lyric) {
          combined = mergeRomaji(combined, res.romalrc.lyric);
        }
        combined = computeLineDurations(combined);
        if (isMounted) {
          setInternalLyrics(combined);
        }
      } catch (err) {
        console.warn('Failed to fetch fallback lyrics for export modal:', err);
      } finally {
        if (isMounted) setIsLoadingLyrics(false);
      }
    };

    loadLyricsAsync();

    return () => {
      isMounted = false;
    };
  }, [isOpen, song?.id, lyrics]);
  const effectiveLyrics = internalLyrics.length > 0 ? internalLyrics : (lyrics || []);
  const currentOffset = advancedLyricConfig?.globalOffset || 0;
  const meta = useMemo(() => extractSongMeta(song), [song]);

  // Check if current lyrics belong to a Japanese song
  const isJpSong = useMemo(() => isJapaneseSong(effectiveLyrics), [effectiveLyrics]);

  // Pre-warm furigana lines immediately when modal is open and song is Japanese
  useEffect(() => {
    if (!isOpen || !Array.isArray(effectiveLyrics) || effectiveLyrics.length === 0) return;
    if (!isJpSong) return;

    let isMounted = true;
    warmupFuriganaLines(effectiveLyrics).then(() => {
      if (isMounted) {
        setFuriganaWarmed((v) => v + 1);
      }
    }).catch((err) => {
      console.warn('Furigana warmup error in export modal:', err);
    });

    return () => {
      isMounted = false;
    };
  }, [isOpen, effectiveLyrics, isJpSong]);


  // Check if current lyrics contain translations or romaji
  const hasTranslations = useMemo(() => {
    return Array.isArray(effectiveLyrics) && effectiveLyrics.some(l => Boolean((l?.translation || '').trim()));
  }, [effectiveLyrics]);

  const hasRomaji = useMemo(() => {
    return Array.isArray(effectiveLyrics) && effectiveLyrics.some(l => Boolean((l?.romaji || '').trim()));
  }, [effectiveLyrics]);

  const hasWordTiming = useMemo(() => {
    return Array.isArray(effectiveLyrics) && effectiveLyrics.some(l => Array.isArray(l?.words) && l.words.length > 0);
  }, [effectiveLyrics]);

  // Reset status on open or song change
  useEffect(() => {
    if (isOpen) {
      setCopySuccess(false);
      setExportStatus(null);
    }
  }, [isOpen, song?.id]);

  // Auto-close on ESC key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, onClose]);

  // Generate exported lyric text in real time
  const exportedContent = useMemo(() => {
    if (isLoadingLyrics) {
      return '正在解析并加载歌词数据，请稍候...';
    }
    if (!Array.isArray(effectiveLyrics) || effectiveLyrics.length === 0) {
      return '【暂无歌词数据】\n当前歌曲尚未加载歌词或未找到匹配歌词。';
    }

    const options = {
      song,
      includeMeta,
      includeTranslation,
      includeRomaji,
      includeFurigana: isJpSong && includeFurigana,
      furiganaMode,
      bilingualMode,
      offset: applyGlobalOffset ? currentOffset : 0,
      skipInterlude
    };

    return generateLyricExport(effectiveLyrics, selectedFormat, options);
  }, [
    effectiveLyrics,
    isLoadingLyrics,
    song,
    selectedFormat,
    includeMeta,
    includeTranslation,
    includeRomaji,
    includeFurigana,
    furiganaMode,
    isJpSong,
    bilingualMode,
    applyGlobalOffset,
    currentOffset,
    skipInterlude,
    furiganaWarmed
  ]);
  const stats = useMemo(() => {
    const linesCount = exportedContent.split('\n').filter(Boolean).length;
    const charCount = exportedContent.length;
    const ext = getFormatExtension(selectedFormat);
    const filename = sanitizeFilename(meta.title, meta.artist, ext);
    return { linesCount, charCount, ext, filename };
  }, [exportedContent, selectedFormat, meta]);

  if (!isOpen) return null;

  const handleCopy = async () => {
    try {
      if (isJpSong) {
        await warmupFuriganaLines(effectiveLyrics);
      }
      const content = exportedContent;
      const ok = await copyLyricToClipboard(content);
      if (ok) {
        setCopySuccess(true);
        setExportStatus({ type: 'success', message: '歌词已成功复制到剪贴板！' });
        setTimeout(() => setCopySuccess(false), 2500);
      } else {
        setExportStatus({ type: 'error', message: '复制失败，请手动在下方全选复制。' });
      }
    } catch (err) {
      setExportStatus({ type: 'error', message: `复制出错: ${err?.message || err}` });
    }
  };

  const handleDownload = async () => {
    setIsExporting(true);
    setExportStatus(null);
    try {
      if (isJpSong) {
        await warmupFuriganaLines(effectiveLyrics);
      }
      const res = await downloadLyricFile(exportedContent, stats.filename);
      if (res?.success) {
        const destMsg = res.filePath ? `已保存至：${res.filePath}` : '文件已保存并开始下载！';
        setExportStatus({ type: 'success', message: `导出成功！${destMsg}` });
      } else if (res?.canceled) {
        // user canceled file save dialog, no error needed
      } else {
        setExportStatus({ type: 'error', message: res?.error || '导出失败，请重试或尝试直接复制。' });
      }
    } catch (err) {
      setExportStatus({ type: 'error', message: `导出异常: ${err?.message || err}` });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.72)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        animation: 'fadeIn 0.2s ease-out'
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '780px',
          maxWidth: '94vw',
          maxHeight: '88vh',
          background: 'linear-gradient(145deg, rgba(26, 30, 42, 0.96), rgba(18, 20, 28, 0.98))',
          border: '1px solid rgba(255, 255, 255, 0.16)',
          borderRadius: '20px',
          boxShadow: '0 28px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.06)',
          color: '#fff',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px 16px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(255, 255, 255, 0.02)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, var(--primary, #ff4081), #9c27b0)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(255, 64, 129, 0.35)'
              }}
            >
              <Download size={20} color="#fff" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600, letterSpacing: '0.3px' }}>
                  导出歌词文件
                </h3>
                <span
                  style={{
                    fontSize: '11px',
                    padding: '2px 8px',
                    borderRadius: '12px',
                    background: 'rgba(255, 255, 255, 0.12)',
                    color: 'rgba(255, 255, 255, 0.85)'
                  }}
                >
                  {stats.filename}
                </span>
              </div>
              <p
                style={{
                  margin: '4px 0 0',
                  fontSize: '13px',
                  color: 'rgba(255, 255, 255, 0.6)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Music size={13} style={{ opacity: 0.8 }} />
                <span>{meta.title || '当前歌曲'}</span>
                {meta.artist && <span>· {meta.artist}</span>}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.06)',
              border: 'none',
              borderRadius: '50%',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'rgba(255, 255, 255, 0.7)',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
              e.currentTarget.style.color = '#fff';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
              e.currentTarget.style.color = 'rgba(255, 255, 255, 0.7)';
            }}
            title="关闭 (Esc)"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          
          {/* Format Selector Pills */}
          <div>
            <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '10px', color: 'rgba(255,255,255,0.9)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <FileCode size={14} color="var(--primary, #ff4081)" />
              <span>选择导出格式</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px' }}>
              {BASE_FORMAT_OPTIONS.map((fmt) => {
                const IconComp = fmt.icon;
                const isSelected = selectedFormat === fmt.id;
                return (
                  <button
                    key={fmt.id}
                    onClick={() => setSelectedFormat(fmt.id)}
                    style={{
                      padding: '12px 10px',
                      borderRadius: '12px',
                      border: isSelected ? '1.5px solid var(--primary, #ff4081)' : '1px solid rgba(255, 255, 255, 0.1)',
                      background: isSelected ? 'rgba(255, 64, 129, 0.16)' : 'rgba(255, 255, 255, 0.04)',
                      color: isSelected ? '#fff' : 'rgba(255, 255, 255, 0.75)',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                      gap: '4px',
                      transition: 'all 0.2s ease',
                      textAlign: 'left',
                      position: 'relative',
                      boxShadow: isSelected ? '0 0 16px rgba(255, 64, 129, 0.2)' : 'none'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <IconComp size={15} color={isSelected ? 'var(--primary, #ff4081)' : 'rgba(255,255,255,0.6)'} />
                        <span style={{ fontSize: '13px', fontWeight: 600 }}>{fmt.label}</span>
                      </div>
                      <span
                        style={{
                          fontSize: '10px',
                          padding: '1px 6px',
                          borderRadius: '8px',
                          background: isSelected ? 'var(--primary, #ff4081)' : 'rgba(255,255,255,0.1)',
                          color: '#fff',
                          fontWeight: 500
                        }}
                      >
                        {fmt.ext}
                      </span>
                    </div>
                    <span style={{ fontSize: '11px', color: isSelected ? 'rgba(255, 255, 255, 0.85)' : 'rgba(255, 255, 255, 0.45)', lineHeight: 1.3 }}>
                      {fmt.badge}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Configuration Toggles */}
          <div
            style={{
              padding: '14px 16px',
              borderRadius: '14px',
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}
          >
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'rgba(255,255,255,0.75)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Sliders size={13} />
              <span>导出参数定制</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px 18px' }}>
              {/* Option: Include Metadata header */}
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', cursor: 'pointer', userSelect: 'none' }}>
                <input
                  type="checkbox"
                  checked={includeMeta}
                  onChange={(e) => setIncludeMeta(e.target.checked)}
                  style={{ accentColor: 'var(--primary, #ff4081)' }}
                />
                <span>包含歌曲信息头部 (标题/歌手/专辑)</span>
              </label>

              {/* Option: Apply current global offset */}
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', cursor: 'pointer', userSelect: 'none' }}>
                <input
                  type="checkbox"
                  checked={applyGlobalOffset}
                  onChange={(e) => setApplyGlobalOffset(e.target.checked)}
                  style={{ accentColor: 'var(--primary, #ff4081)' }}
                />
                <span>
                  应用时间轴微调偏移
                  {currentOffset !== 0 ? ` (${currentOffset > 0 ? `+${currentOffset}` : currentOffset}s)` : ' (0s)'}
                </span>
              </label>

              {/* Option: Skip interlude placeholders */}
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', cursor: 'pointer', userSelect: 'none' }}>
                <input
                  type="checkbox"
                  checked={skipInterlude}
                  onChange={(e) => setSkipInterlude(e.target.checked)}
                  style={{ accentColor: 'var(--primary, #ff4081)' }}
                />
                <span>过滤间奏占位点 (......)</span>
              </label>

              {/* Option: Include Romaji (for Japanese/multilingual songs) */}
              {(hasRomaji || (isJpSong && (selectedFormat === 'bilingual_lrc' || selectedFormat === 'txt'))) && (
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', cursor: 'pointer', userSelect: 'none' }}>
                  <input
                    type="checkbox"
                    checked={includeRomaji}
                    onChange={(e) => setIncludeRomaji(e.target.checked)}
                    style={{ accentColor: 'var(--primary, #ff4081)' }}
                  />
                  <span>包含罗马音行 (Romaji)</span>
                </label>
              )}

              {/* Option: Include Japanese Furigana (Only for Japanese songs) */}
              {isJpSong && (
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', cursor: 'pointer', userSelect: 'none' }}>
                  <input
                    type="checkbox"
                    checked={includeFurigana}
                    onChange={(e) => setIncludeFurigana(e.target.checked)}
                    style={{ accentColor: 'var(--primary, #ff4081)' }}
                  />
                  <span>包含日文汉字假名注音 (ルビ)</span>
                </label>
              )}
            </div>

            {/* Japanese Furigana mode selector (Only visible for Japanese songs when enabled) */}
            {isJpSong && includeFurigana && (
              <div style={{ paddingTop: '8px', borderTop: '1px dashed rgba(255, 255, 255, 0.1)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.7)' }}>假名注音呈现形式：</span>
                <select
                  value={furiganaMode}
                  onChange={(e) => setFuriganaMode(e.target.value)}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '8px',
                    background: 'rgba(0, 0, 0, 0.3)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    color: '#fff',
                    fontSize: '12px',
                    cursor: 'pointer'
                  }}
                >
                  <option value="inline">行内括号注音（推荐，如：漢字(かんじ)）</option>
                  <option value="separate">独立时间轴行（每句原文紧跟全假名行）</option>
                  <option value="ruby_html">HTML Ruby 标签（如：&lt;ruby&gt;漢字&lt;rt&gt;かんじ&lt;/rt&gt;&lt;/ruby&gt;）</option>
                  <option value="reading">纯假名行（汉字直接替换为平假名）</option>
                </select>
              </div>
            )}

            {/* Bilingual layout sub-selector when bilingual format is selected */}
            {selectedFormat === 'bilingual_lrc' && (
              <div style={{ paddingTop: '8px', borderTop: '1px dashed rgba(255, 255, 255, 0.1)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.7)' }}>双语排版样式：</span>
                <select
                  value={bilingualMode}
                  onChange={(e) => setBilingualMode(e.target.value)}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '8px',
                    background: 'rgba(0, 0, 0, 0.3)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    color: '#fff',
                    fontSize: '12px',
                    cursor: 'pointer'
                  }}
                >
                  <option value="interleaved">交叉时间轴（推荐，每句原文后紧跟译文）</option>
                  <option value="combined">单行合并（[00:12.34]原文 (译文)）</option>
                  <option value="block">分块呈现（先全部原文，后全部译文）</option>
                </select>
              </div>
            )}
          </div>

          {/* Live Preview Box */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px', color: 'rgba(255, 255, 255, 0.65)' }}>
              <span>实时歌词预览</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span>共 {stats.linesCount} 行</span>
                <span>·</span>
                <span>{stats.charCount} 字符</span>
                {hasWordTiming && selectedFormat === 'yrc' && (
                  <span style={{ color: '#4caf50', display: 'flex', alignItems: 'center', gap: '3px' }}>
                    <Check size={12} /> 逐字毫秒就绪
                  </span>
                )}
                {isJpSong && includeFurigana && (
                  <span style={{ color: 'var(--primary, #ff4081)', display: 'flex', alignItems: 'center', gap: '3px' }}>
                    <Sparkles size={12} /> 假名注音已启用
                  </span>
                )}
              </div>
            </div>

            <div
              style={{
                height: '190px',
                background: 'rgba(0, 0, 0, 0.45)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '12px',
                padding: '12px 14px',
                fontFamily: 'Consolas, Monaco, "Courier New", monospace',
                fontSize: '12px',
                lineHeight: 1.55,
                color: 'rgba(255, 255, 255, 0.9)',
                overflowY: 'auto',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
                userSelect: 'text',
                boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.4)'
              }}
            >
              {exportedContent}
            </div>
          </div>

          {/* Feedback & Notifications */}
          {exportStatus && (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: '10px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '12.5px',
                background:
                  exportStatus.type === 'success'
                    ? 'rgba(76, 175, 80, 0.18)'
                    : 'rgba(244, 67, 54, 0.18)',
                border:
                  exportStatus.type === 'success'
                    ? '1px solid rgba(76, 175, 80, 0.4)'
                    : '1px solid rgba(244, 67, 54, 0.4)',
                color: exportStatus.type === 'success' ? '#a5d6a7' : '#ef9a9a',
                animation: 'fadeIn 0.2s ease-out'
              }}
            >
              {exportStatus.type === 'success' ? (
                <CheckCircle2 size={16} color="#81c784" />
              ) : (
                <AlertCircle size={16} color="#e57373" />
              )}
              <span style={{ flex: 1, wordBreak: 'break-all' }}>{exportStatus.message}</span>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div
          style={{
            padding: '14px 24px 18px',
            borderTop: '1px solid rgba(255, 255, 255, 0.1)',
            background: 'rgba(0, 0, 0, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px'
          }}
        >
          <button
            type="button"
            onClick={handleCopy}
            style={{
              padding: '10px 18px',
              borderRadius: '10px',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              background: copySuccess ? 'rgba(76, 175, 80, 0.25)' : 'rgba(255, 255, 255, 0.08)',
              color: copySuccess ? '#a5d6a7' : '#fff',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.2s'
            }}
          >
            {copySuccess ? <Check size={16} /> : <Copy size={16} />}
            <span>{copySuccess ? '已复制歌词！' : '复制到剪贴板'}</span>
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '10px 18px',
                borderRadius: '10px',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                background: 'transparent',
                color: 'rgba(255, 255, 255, 0.75)',
                fontSize: '13px',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#fff')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(255, 255, 255, 0.75)')}
            >
              取消
            </button>

            <button
              type="button"
              onClick={handleDownload}
              disabled={isExporting}
              style={{
                padding: '10px 22px',
                borderRadius: '10px',
                border: 'none',
                background: 'linear-gradient(135deg, var(--primary, #ff4081), #e91e63)',
                color: '#fff',
                fontSize: '13px',
                fontWeight: 600,
                cursor: isExporting ? 'wait' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 4px 16px rgba(255, 64, 129, 0.4)',
                transition: 'all 0.2s',
                opacity: isExporting ? 0.8 : 1
              }}
            >
              <Download size={16} />
              <span>{isExporting ? '正在导出...' : `导出保存文件 (${stats.ext})`}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
