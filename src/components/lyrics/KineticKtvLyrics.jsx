import React, { useEffect, useRef, useMemo, useState, useCallback } from 'react';
import { PVEngine } from '../../pv/core/engine';
import { templates, getTemplate } from '../../pv/templates';
import { subscribeLyricClock } from '../../utils/lyricClock';
import { parseDisplayTokens } from './MonetLyricsEngine';
import { isPlaceholderLyricText } from '../../pv/jizura/plannerBridge';
import { JIZURA_GALLERY_STYLES } from '../../utils/immersiveModes';
import { Sparkles } from 'lucide-react';

// 模板名称映射（兼容旧预设 ID、中文名称与 JIZURA 新风格 ID）
const PRESET_ALIAS_MAP = {
  '蓝色构成': 'blueInk',
  '几何': 'ruler',
  '黑客帝国': 'matrix',
  'matrix': 'matrix',
  'rainCity': 'matrix',
  '错落文字': 'yorushika',
  '冷静反派': 'mono',
  '少女云朵': 'sweetPink',
  'sweetPink': 'sweetPink',
  '夜樱': 'yozakura',
  '春日樱': 'yozakura',
  'sakura': 'yozakura',
  '格子花边': 'popArt',
  'Fly Me to the Moon': 'shinkuu',
  'fly-me-to-the-moon': 'shinkuu',
  'Kawaii 像素': 'kawaiPixel',
  'Kawaii像素': 'kawaiPixel',
  'kawaii-pixel': 'kawaiPixel',
  '春日影': 'yozakura',
  'haruhikage': 'yozakura',
  'suisai': 'yozakura',
  '纸艺剪贴': 'zasshi',
  'paper-cut': 'zasshi',
  'Custom 自定义': 'cinemaTeal',
  'custom': 'cinemaTeal',
  '青蓝电影': 'cinemaTeal',
  'cinema-teal': 'cinemaTeal',
  'P5怪盗红黑': 'p5',
  'p5': 'p5',
  '都市蓝调': 'cityPop',
  'city-pop': 'cityPop',
  '霓虹夜市': 'neonNight',
  'neon-night': 'neonNight',
  '深空真空': 'shinkuu',
  '黄昏晚霞': 'tasogare',
  '黑白映画': 'mono',
  '日系杂志': 'zasshi',
  '柠檬苏打': 'lemonSoda',
  'lemon-soda': 'lemonSoda',
  '晨雾迷朦': 'kiri',
  '晨雾迷蒙': 'kiri',
  '深海波澜': 'umi',
  '复古胶片': 'film',
  '夜鹿忧郁': 'yorushika',
  '青墨水晕': 'blueInk',
  'blue-structure': 'blueInk',
  '战场冲击': 'battle',
  'blue-impact': 'battle',
  '赛博矩阵': 'cyber',
  '数字印象': 'digitalImpression',
  'digital-impression': 'digitalImpression',
  '故障艺术': 'glitch',
  '全息目镜': 'holoScope',
  'holo-scope': 'holoScope',
  '波普波点': 'popArt',
  'pop-art': 'popArt',
  '标尺构图': 'ruler',
  'geometric': 'ruler',
  '极简剪影': 'silhouetteClean',
  'silhouette-clean': 'silhouetteClean',
  'rain-city': 'matrix',
  'staggered-text': 'yorushika',
  'calm-villain': 'mono',
  'girly-clouds': 'sweetPink',
  'sweet-pink': 'sweetPink',
  'EVA警报': 'evaAlert',
  'eva-alert': 'evaAlert',
  'evaAlert': 'evaAlert',
  '赛博朋克2077': 'cyberpunk2077',
  'cyberpunk': 'cyberpunk2077',
  'cyberpunk-2077': 'cyberpunk2077',
  'cyberpunk2077': 'cyberpunk2077',
  'paper': 'zasshi',
  'noir': 'cinemaTeal',
  'ocean': 'umi',
  'sunset': 'tasogare',
  'crimson': 'battle',
  'caution': 'ruler',
  'hud': 'holoScope',
  'blueprint': 'blueInk',
  'specimen': 'kiri',
  'magenta': 'popArt',
  'mint': 'lemonSoda',
  'rouge': 'p5',
  'transit': 'cityPop',
};

// JIZURA 原生热门风格列表供悬浮胶囊速选
const JIZURA_POPULAR_STYLES = [
  { key: 'matrix', name: '黑客帝国 (Matrix)' },
  { key: 'noir', name: '暗黑电影 (Noir)' },
  { key: 'sakura', name: '和风落樱 (Sakura)' },
  { key: 'ocean', name: '幽蓝深海 (Ocean)' },
  { key: 'sunset', name: '夕阳暮光 (Sunset)' },
  { key: 'crimson', name: '深红数据 (Crimson)' },
  { key: 'caution', name: '亮黄警戒 (Caution)' },
  { key: 'paper', name: '纸墨残像 (Paper)' },
  { key: 'hud', name: '极夜目镜 (Dark HUD)' },
  { key: 'blueprint', name: '建筑蓝图 (Blueprint)' },
  { key: 'specimen', name: '冷调标本 (Specimen)' },
  { key: 'magenta', name: '波普粉紫 (Magenta)' },
  { key: 'mint', name: '薄荷苏打 (Mint)' },
  { key: 'rouge', name: '胭脂赤黑 (Rouge)' },
  { key: 'transit', name: '城市地铁 (Transit)' },
];

function selectAutoTemplate() {
  return getTemplate('cinemaTeal') || templates[0];
}

export default function KineticKtvLyrics({
  lyrics = [],
  activeLineIndex = -1,
  engineRef,
  fontPx = 54,
  fontStack,
  themeColor = 'var(--primary)',
  translationPx = 18,
  songKey,
  songTitle,
  songArtist,
  isPlaying = false,
  coverUrl = '',
  audioAnalyser = null,
  config = {}
}) {
  const containerRef = useRef(null);
  const engineInstanceRef = useRef(null);
  const currentTplKeyRef = useRef('');
  const resolvedTemplateRef = useRef(null);
  const [isEngineReady, setIsEngineReady] = useState(false);

  // 悬浮工具栏与案提示状态
  const [isHovered, setIsHovered] = useState(false);
  const hoverTimerRef = useRef(null);
  const [proposalToast, setProposalToast] = useState(null);
  const toastTimerRef = useRef(null);
  const [proposalCount, setProposalCount] = useState(1);
  const [activeStyle, setActiveStyle] = useState('noir');

  // 统一使用 parseDisplayTokens 生成逐字时间轴（过滤无实际歌词的提示行）
  const lyricTimeline = useMemo(() => {
    if (!Array.isArray(lyrics) || lyrics.length === 0) return [];
    return lyrics
      .filter(l => {
        if (!l) return false;
        const rawTime = l.time ?? l.start ?? l.startTime;
        const validTime = Number.isFinite(Number(rawTime)) && Number(rawTime) >= 0;
        const text = (l.text || '').trim();
        return validTime && text && !isPlaceholderLyricText(text);
      })
      .map(l => {
        const lineTime = Number(l.time ?? l.start ?? l.startTime) || 0;
        const tokens = parseDisplayTokens(l);
        const words = [];
        for (const token of tokens) {
          if (!token || !token.text) continue;
          if (Array.isArray(token.graphemeTimings) && token.graphemeTimings.length > 0) {
            for (const gt of token.graphemeTimings) {
              const startSec = Number(gt.startTime) || lineTime;
              const endSec = Number(gt.endTime) || (startSec + 0.1);
              words.push({
                text: gt.char || token.text,
                time: startSec,
                startSec: startSec,
                duration: Math.max(0.01, endSec - startSec),
                durationSec: Math.max(0.01, endSec - startSec),
                endSec: endSec
              });
            }
          } else if (token.timed && token.startTime >= 0) {
            const startSec = Number(token.startTime) || lineTime;
            const endSec = Number(token.endTime) || (startSec + 0.1);
            words.push({
              text: token.text,
              time: startSec,
              startSec: startSec,
              duration: Math.max(0.01, endSec - startSec),
              durationSec: Math.max(0.01, endSec - startSec),
              endSec: endSec
            });
          } else {
            words.push({
              text: token.text,
              time: lineTime,
              startSec: lineTime,
              duration: 0.1,
              durationSec: 0.1,
              endSec: lineTime + 0.1
            });
          }
        }

        return {
          time: lineTime,
          text: (l.text || '').trim(),
          duration: typeof l.duration === 'number' ? l.duration : 4.0,
          translation: l.translation,
          words: words.length > 0 ? words : undefined
        };
      });
  }, [lyrics]);

  // 解析目标模板
  const resolvedTemplate = useMemo(() => {
    const songId = songKey || (songTitle ? `${songTitle}_${songArtist}` : '');
    const lockedPreset = songId && config?.ktvSongTemplates?.[String(songId)];
    let presetKey = config?.ktvPreset || lockedPreset || 'auto';

    if (presetKey === 'multi') {
      const pool = Array.isArray(config?.ktvPresetPool) && config.ktvPresetPool.length > 0
        ? config.ktvPresetPool
        : ['blueInk', 'ruler', 'rainCity', 'yorushika', 'mono', 'yozakura', 'popArt', 'shinkuu', 'kawaiPixel', 'suisai'];
      const idx = Math.abs(activeLineIndex >= 0 ? activeLineIndex : 0) % pool.length;
      presetKey = pool[idx];
    }
    
    const mappedKey = PRESET_ALIAS_MAP[presetKey] || presetKey;
    let found = getTemplate(mappedKey);
    if (!found) {
      found = getTemplate(presetKey);
    }
    if (!found) {
      found = selectAutoTemplate();
    }
    return found;
  }, [config?.ktvPreset, config?.ktvPresetPool, config?.ktvSongTemplates, songKey, songTitle, songArtist, activeLineIndex]);

  resolvedTemplateRef.current = resolvedTemplate;

  // 提示信息气泡辅助
  const showToast = useCallback((msg) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setProposalToast(msg);
    toastTimerRef.current = setTimeout(() => {
      setProposalToast(null);
    }, 2800);
  }, []);

  const broadcastStatus = useCallback((style, count, mood) => {
    window.dispatchEvent(new CustomEvent('jizura-status-update', {
      detail: {
        activeStyle: style,
        proposalCount: count,
        mood: mood || ''
      }
    }));
  }, []);

  // 查找风格友好展示名称
  const getStyleDisplayName = useCallback((key) => {
    const fromGallery = JIZURA_GALLERY_STYLES.find(s => s.key === key);
    if (fromGallery) return `${fromGallery.name} (${fromGallery.en})`;
    const fromPopular = JIZURA_POPULAR_STYLES.find(s => s.key === key);
    if (fromPopular) return fromPopular.name;
    return key;
  }, []);

  // 触发 JIZURA Omakase 换案
  const handleOmakase = useCallback(() => {
    const pv = engineInstanceRef.current;
    if (!pv || !pv.omakase) return;
    const res = pv.omakase();
    if (res) {
      const nextCount = res.proposalIndex || (proposalCount + 1);
      setProposalCount(nextCount);
      const nextStyle = res.style || 'noir';
      setActiveStyle(nextStyle);
      const styleLabel = getStyleDisplayName(nextStyle);
      const moodText = res.mood ? ` · ${res.mood}` : '';
      showToast(`🎲 案 #${nextCount}: ${styleLabel}${moodText}`);
      broadcastStatus(nextStyle, nextCount, res.mood);
    }
  }, [proposalCount, showToast, broadcastStatus, getStyleDisplayName]);

  const handleUndo = useCallback(() => {
    const pv = engineInstanceRef.current;
    if (!pv || !pv.undoOmakase) return;
    const res = pv.undoOmakase();
    if (res) {
      const nextStyle = res.style || 'noir';
      const nextCount = res.proposalIndex || Math.max(1, proposalCount - 1);
      setProposalCount(nextCount);
      setActiveStyle(nextStyle);
      const styleLabel = getStyleDisplayName(nextStyle);
      const moodText = res.mood ? ` · ${res.mood}` : '';
      showToast(`◀ 案 #${nextCount}: ${styleLabel}${moodText}`);
      broadcastStatus(nextStyle, nextCount, res.mood);
    } else {
      showToast('⚠️ 已是第一案，无法继续回退');
    }
  }, [proposalCount, showToast, broadcastStatus, getStyleDisplayName]);

  const handleRedo = useCallback(() => {
    const pv = engineInstanceRef.current;
    if (!pv || !pv.redoOmakase) return;
    const res = pv.redoOmakase();
    if (res) {
      const nextStyle = res.style || 'noir';
      const nextCount = res.proposalIndex || (proposalCount + 1);
      setProposalCount(nextCount);
      setActiveStyle(nextStyle);
      const styleLabel = getStyleDisplayName(nextStyle);
      const moodText = res.mood ? ` · ${res.mood}` : '';
      showToast(`▶ 案 #${nextCount}: ${styleLabel}${moodText}`);
      broadcastStatus(nextStyle, nextCount, res.mood);
    } else {
      showToast('⚠️ 已是最新案，无法继续前进');
    }
  }, [proposalCount, showToast, broadcastStatus, getStyleDisplayName]);

  const handleStyleSelect = useCallback((key) => {
    const pv = engineInstanceRef.current;
    if (!pv) return;
    const res = pv.setStyle ? pv.setStyle(key) : null;
    const nextStyle = res?.style || key;
    const nextCount = res?.proposalIndex || proposalCount;
    if (res?.proposalIndex) setProposalCount(res.proposalIndex);
    setActiveStyle(nextStyle);
    const styleLabel = getStyleDisplayName(nextStyle);
    showToast(`🎨 风格应用: ${styleLabel}`);
    broadcastStatus(nextStyle, nextCount, res?.mood || '');
  }, [proposalCount, showToast, broadcastStatus, getStyleDisplayName]);

  // 监听来自设置抽屉的 JIZURA 动作指令
  useEffect(() => {
    const handleJizuraAction = (e) => {
      const { action, style } = e.detail || {};
      if (action === 'omakase') {
        handleOmakase();
      } else if (action === 'undo') {
        handleUndo();
      } else if (action === 'redo') {
        handleRedo();
      } else if (action === 'setStyle' && style) {
        handleStyleSelect(style);
      }
    };
    window.addEventListener('jizura-action', handleJizuraAction);
    return () => window.removeEventListener('jizura-action', handleJizuraAction);
  }, [handleOmakase, handleUndo, handleRedo, handleStyleSelect]);

  // 键盘快捷键 R 监听
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'r' || e.key === 'R') {
        const tag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
        if (tag === 'input' || tag === 'textarea' || document.activeElement?.isContentEditable) {
          return;
        }
        e.preventDefault();
        handleOmakase();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleOmakase]);

  // 鼠标移动显示悬浮栏
  const handleMouseMove = () => {
    setIsHovered(true);
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = setTimeout(() => {
      setIsHovered(false);
    }, 2600);
  };

  // 初始化引擎实例
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let destroyed = false;
    const pv = new PVEngine();
    engineInstanceRef.current = pv;

    pv.init(container).then(() => {
      if (destroyed) {
        pv.destroy();
        return;
      }

      const tpl = resolvedTemplateRef.current;
      if (tpl) {
        pv.loadTemplate(tpl);
        currentTplKeyRef.current = tpl.nameKey || tpl.name || '';
      }

      if (lyricTimeline.length > 0) {
        const offset = (config?.globalOffset || 0) / 1000;
        pv.setLyricTimeline(lyricTimeline, offset);
      }

      if (typeof config?.ktvSpeed === 'number') pv.animationSpeed = config.ktvSpeed;
      if (typeof config?.ktvMotion === 'number') pv.motionIntensity = config.ktvMotion;
      if (typeof config?.ktvBgOpacity === 'number') pv.effectOpacity = config.ktvBgOpacity;
      pv.showTranslation = config?.showTranslation !== false;
      pv.showFurigana = config?.showFurigana !== false;

      if (coverUrl && config?.ktvUseCoverTexture !== false) {
        pv.addMediaUrl(coverUrl).catch(() => {});
      }

      if (audioAnalyser && pv.setAudioAnalyser) {
        pv.setAudioAnalyser(audioAnalyser);
      }

      setIsEngineReady(true);
      if (pv.jizura) {
        broadcastStatus(
          pv.jizura.styleKey || 'noir',
          pv.jizura.historyIndex >= 0 ? pv.jizura.historyIndex + 1 : 1,
          pv.jizura.moodKey || ''
        );
      }
    }).catch(err => {
      console.warn('[KineticKtvLyrics] Init failed:', err);
    });

    return () => {
      destroyed = true;
      setIsEngineReady(false);
      if (engineInstanceRef.current) {
        engineInstanceRef.current.destroy();
        engineInstanceRef.current = null;
      }
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  // 歌词时间轴同步
  useEffect(() => {
    if (!isEngineReady) return;
    const pv = engineInstanceRef.current;
    if (!pv) return;
    const offset = (config?.globalOffset || 0) / 1000;
    pv.setLyricTimeline(lyricTimeline, offset);
  }, [isEngineReady, lyricTimeline, config?.globalOffset]);

  // 响应模板与风格热重载
  useEffect(() => {
    if (!isEngineReady) return;
    const pv = engineInstanceRef.current;
    if (!pv) return;

    const presetKey = config?.ktvPreset || 'auto';
    if (presetKey && presetKey !== 'auto' && presetKey !== 'multi') {
      const res = pv.setStyle(presetKey);
      const nextStyle = res?.style || presetKey;
      setActiveStyle(nextStyle);
      currentTplKeyRef.current = presetKey;
    } else if (resolvedTemplate) {
      const tplKey = resolvedTemplate.nameKey || resolvedTemplate.name || '';
      if (currentTplKeyRef.current !== tplKey) {
        currentTplKeyRef.current = tplKey;
        pv.loadTemplate(resolvedTemplate);
        setActiveStyle(resolvedTemplate.id || tplKey);
      }
    }

    if (typeof config?.ktvSpeed === 'number') pv.animationSpeed = config.ktvSpeed;
    if (typeof config?.ktvMotion === 'number') pv.motionIntensity = config.ktvMotion;
    if (typeof config?.ktvBgOpacity === 'number') pv.effectOpacity = config.ktvBgOpacity;
  }, [isEngineReady, resolvedTemplate, config?.ktvPreset, config?.ktvSpeed, config?.ktvMotion, config?.ktvBgOpacity]);

  // 音频频谱联动
  useEffect(() => {
    if (!isEngineReady) return;
    const pv = engineInstanceRef.current;
    if (pv && pv.setAudioAnalyser) {
      pv.setAudioAnalyser(audioAnalyser);
    }
  }, [isEngineReady, audioAnalyser]);

  // 封面更新
  useEffect(() => {
    if (!isEngineReady) return;
    const pv = engineInstanceRef.current;
    if (!pv) return;
    if (coverUrl && config?.ktvUseCoverTexture !== false) {
      pv.addMediaUrl(coverUrl).catch(() => {});
    } else {
      pv.clearMedia();
    }
  }, [isEngineReady, coverUrl, config?.ktvUseCoverTexture]);

  // 控制参数响应
  useEffect(() => {
    if (!isEngineReady) return;
    const pv = engineInstanceRef.current;
    if (!pv) return;
    if (typeof config?.ktvSpeed === 'number') pv.animationSpeed = config.ktvSpeed;
    if (typeof config?.ktvMotion === 'number') pv.motionIntensity = config.ktvMotion;
    if (typeof config?.ktvBgOpacity === 'number') pv.effectOpacity = config.ktvBgOpacity;
    pv.showTranslation = config?.showTranslation !== false;
    pv.showFurigana = config?.showFurigana !== false;
  }, [isEngineReady, config?.ktvSpeed, config?.ktvMotion, config?.ktvBgOpacity, config?.showTranslation, config?.showFurigana]);

  // 实时歌词时钟
  useEffect(() => {
    const unsubscribe = subscribeLyricClock((clockTime) => {
      const pv = engineInstanceRef.current;
      if (!pv) return;

      const exactTime = engineRef?.current?.getCurrentTime
        ? engineRef.current.getCurrentTime()
        : clockTime;

      pv.setPlaybackTime(exactTime, isPlaying);
    });

    return () => {
      unsubscribe();
    };
  }, [isPlaying, engineRef]);

  // 歌曲信息与换曲热重载
  useEffect(() => {
    if (!isEngineReady) return;
    const pv = engineInstanceRef.current;
    if (!pv) return;
    pv.setSongInfo({
      id: songKey || '',
      title: songTitle || '',
      artist: songArtist || '',
      album: ''
    });
    pv.showTitleCard = config?.ktvShowTitleCard !== false;
  }, [isEngineReady, songKey, songTitle, songArtist, config?.ktvShowTitleCard]);

  // 播放/暂停状态响应
  useEffect(() => {
    if (!isEngineReady) return;
    const pv = engineInstanceRef.current;
    if (!pv) return;
    if (isPlaying) {
      pv.resume();
    } else {
      pv.pause();
    }
  }, [isEngineReady, isPlaying]);

  const showTranslation = config?.showTranslation !== false && config?.ktvShowTranslation !== false;

  // 实时跟踪当前正在播放的歌词译文 (根据精准歌词时钟同步)
  const [liveTranslation, setLiveTranslation] = useState('');

  useEffect(() => {
    if (!showTranslation || !lyrics || lyrics.length === 0) {
      setLiveTranslation('');
      return;
    }

    const unsub = subscribeLyricClock((clockTime) => {
      const exactTime = engineRef?.current?.getCurrentTime
        ? engineRef.current.getCurrentTime()
        : clockTime;

      let matchedTrans = '';
      for (let i = lyrics.length - 1; i >= 0; i--) {
        const line = lyrics[i];
        if (line && exactTime >= (line.time ?? 0)) {
          const duration = typeof line.duration === 'number' ? line.duration : 4.0;
          if (exactTime < (line.time ?? 0) + duration + 0.8) {
            matchedTrans = (line.translation || '').trim();
          }
          break;
        }
      }

      setLiveTranslation(prev => prev !== matchedTrans ? matchedTrans : prev);
    });

    return () => {
      unsub();
    };
  }, [showTranslation, lyrics, engineRef]);

  // 当 liveTranslation 为空时，若 activeLineIndex 指向有效行且包含译文，则作为同步兜底
  const currentTranslation = useMemo(() => {
    if (!showTranslation) return '';
    if (liveTranslation) return liveTranslation;
    if (activeLineIndex >= 0 && activeLineIndex < lyrics.length) {
      return (lyrics[activeLineIndex]?.translation || '').trim();
    }
    return '';
  }, [showTranslation, liveTranslation, activeLineIndex, lyrics]);

  return (
    <div
      onMouseMove={handleMouseMove}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        overflow: 'hidden'
      }}
    >
      <div
        ref={containerRef}
        className="kpv-stage kpv-pixi-stage"
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          overflow: 'hidden',
          background: resolvedTemplate?.palette?.background || '#060607',
          contain: 'strict'
        }}
      />

      {/* 案变更浮动微徽章 */}
      {proposalToast && (
        <div
          style={{
            position: 'absolute',
            top: '28px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(10, 10, 14, 0.88)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.22)',
            borderRadius: '24px',
            padding: '7px 18px',
            color: '#fff',
            fontSize: '12px',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 12px 32px rgba(0,0,0,0.5), 0 0 16px rgba(255,255,255,0.1)',
            zIndex: 100,
            animation: 'fadeIn 0.2s ease',
            pointerEvents: 'none',
            letterSpacing: '0.02em'
          }}
        >
          <Sparkles size={14} color="#ffd166" />
          <span>{proposalToast}</span>
        </div>
      )}

      {/* PV 模式底部半透明歌词译文 (Translucent Translation Capsule) */}
      {showTranslation && currentTranslation && (
        <div className="kpv-translation-capsule" role="status" aria-live="polite">
          {currentTranslation}
        </div>
      )}
    </div>
  );
}
