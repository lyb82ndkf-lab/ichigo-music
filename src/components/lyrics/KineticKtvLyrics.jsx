import React, { useEffect, useRef, useMemo, useState } from 'react';
import { PVEngine } from '../../pv/core/engine';
import { templates, getTemplate } from '../../pv/templates';
import { subscribeLyricClock } from '../../utils/lyricClock';

// 模板名称映射（兼容旧预设 ID、中文名称与新模板 ID）
const PRESET_ALIAS_MAP = {
  '蓝色构成': 'blueInk',
  '几何': 'ruler',
  '黑客帝国': 'rainCity',
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
  '命运红线': 'akaiito',
  '都市蓝调': 'cityPop',
  'city-pop': 'cityPop',
  '霓虹夜市': 'neonNight',
  'neon-night': 'neonNight',
  '深空真空': 'shinkuu',
  '黄昏晚霞': 'tasogare',
  '黑白映画': 'mono',
  '白紙极简': 'hakushi',
  '白纸极简': 'hakushi',
  '日系杂志': 'zasshi',
  '柠檬苏打': 'lemonSoda',
  'lemon-soda': 'lemonSoda',
  '晨雾迷朦': 'kiri',
  '晨雾迷蒙': 'kiri',
  '心跳声波': 'shinpaku',
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
  'matrix': 'rainCity',
  'rain-city': 'rainCity',
  'staggered-text': 'yorushika',
  'calm-villain': 'mono',
  'girly-clouds': 'sweetPink',
  'sweet-pink': 'sweetPink',
};

// 智能自动模板选择器
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
  config = {}
}) {
  const containerRef = useRef(null);
  const engineInstanceRef = useRef(null);
  const currentTplKeyRef = useRef('');
  const resolvedTemplateRef = useRef(null); // 供 init 闭包读取最新模板，避免闭包陷阱
  const [isEngineReady, setIsEngineReady] = useState(false);


  // 整理歌词时间轴格式以契合 PVEngine（包含原生 YRC/AMLL 逐字与持续时间）
  const lyricTimeline = useMemo(() => {
    if (!Array.isArray(lyrics) || lyrics.length === 0) return [];
    return lyrics
      .filter(l => l && typeof l.time === 'number' && (l.text || '').trim())
      .map(l => ({
        time: l.time,
        text: (l.text || '').trim(),
        duration: l.duration,
        translation: l.translation,
        words: Array.isArray(l.words) && l.words.length > 0 ? l.words.map(w => {
          const wTime = typeof w.time === 'number'
            ? w.time
            : (typeof w.startSec === 'number' ? w.startSec : (typeof w.start === 'number' ? w.start / 1000 : l.time));
          const wDur = typeof w.duration === 'number'
            ? w.duration
            : (typeof w.durationSec === 'number' ? w.durationSec : (typeof w.endSec === 'number' && typeof w.startSec === 'number' ? w.endSec - w.startSec : 0.25));
          return {
            text: w.text || '',
            time: wTime,
            duration: wDur,
            startSec: wTime,
            durationSec: wDur
          };
        }) : undefined
      }));
  }, [lyrics]);


  // 解析目标模板
  const resolvedTemplate = useMemo(() => {
    // 1. 优先使用用户在面板直接选择的全局预设（非 auto），其次检查单曲锁定的模板
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
    
    // 处理别名转换
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

  // 始终同步 ref，供 init 闭包（useEffect 依赖 []）读取最新值
  resolvedTemplateRef.current = resolvedTemplate;


  // 初始化 Pixi 引擎实例
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

      // 注意：从 ref 中读取最新的 resolvedTemplate，避免闭包陷阱
      const tpl = resolvedTemplateRef.current;
      if (tpl) {
        pv.loadTemplate(tpl);
        currentTplKeyRef.current = tpl.nameKey || tpl.name || '';
      }

      // 加载歌词时间轴
      if (lyricTimeline.length > 0) {
        const offset = (config?.globalOffset || 0) / 1000;
        pv.setLyricTimeline(lyricTimeline, offset);
      }

      // 设置动画速度与动态强度（使用 setter 属性，不是方法）
      if (typeof config?.ktvSpeed === 'number') pv.animationSpeed = config.ktvSpeed;
      if (typeof config?.ktvMotion === 'number') pv.motionIntensity = config.ktvMotion;
      if (typeof config?.ktvBgOpacity === 'number') pv.effectOpacity = config.ktvBgOpacity;

      // 如果有封面图，载入媒体底图
      if (coverUrl && config?.ktvUseCoverTexture !== false) {
        pv.addMediaUrl(coverUrl).catch(() => {});
      }

      setIsEngineReady(true);
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
    };
  }, []); // 仅在挂载时创建一次 Pixi Application

  // 响应歌词时间轴更新
  useEffect(() => {
    if (!isEngineReady) return;
    const pv = engineInstanceRef.current;
    if (!pv) return;
    const offset = (config?.globalOffset || 0) / 1000;
    pv.setLyricTimeline(lyricTimeline, offset);
  }, [isEngineReady, lyricTimeline, config?.globalOffset]);

  // 响应模板切换 — 显式依赖 config.ktvPreset 字符串本身，确保切换时必定触发
  useEffect(() => {
    if (!isEngineReady) return;
    const pv = engineInstanceRef.current;
    if (!pv || !resolvedTemplate) return;

    const tplKey = resolvedTemplate.nameKey || resolvedTemplate.name || '';
    if (currentTplKeyRef.current !== tplKey) {
      console.log('[KineticKtv] Switching template:', currentTplKeyRef.current, '→', tplKey);
      currentTplKeyRef.current = tplKey;
      pv.loadTemplate(resolvedTemplate);

      // 重新应用用户自定义滑块（使用 setter 属性）
      if (typeof config?.ktvSpeed === 'number') pv.animationSpeed = config.ktvSpeed;
      if (typeof config?.ktvMotion === 'number') pv.motionIntensity = config.ktvMotion;
      if (typeof config?.ktvBgOpacity === 'number') pv.effectOpacity = config.ktvBgOpacity;
    }
  }, [isEngineReady, resolvedTemplate, config?.ktvPreset, config?.ktvSpeed, config?.ktvMotion, config?.ktvBgOpacity]);


  // 响应封面图变化
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

  // 响应控制参数滑块变化（使用 setter 属性，不是方法）
  useEffect(() => {
    if (!isEngineReady) return;
    const pv = engineInstanceRef.current;
    if (!pv) return;
    if (typeof config?.ktvSpeed === 'number') pv.animationSpeed = config.ktvSpeed;
    if (typeof config?.ktvMotion === 'number') pv.motionIntensity = config.ktvMotion;
    if (typeof config?.ktvBgOpacity === 'number') pv.effectOpacity = config.ktvBgOpacity;
  }, [isEngineReady, config?.ktvSpeed, config?.ktvMotion, config?.ktvBgOpacity]);


  // 实时同步歌词时钟与高精度播放时间
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

  // 响应歌曲信息与开场标题卡 / 翻译开关配置变化
  useEffect(() => {
    if (!isEngineReady) return;
    const pv = engineInstanceRef.current;
    if (!pv) return;
    pv.setSongInfo({
      title: songTitle || '',
      artist: songArtist || '',
      album: ''
    });
    pv.showTitleCard = config?.ktvShowTitleCard !== false;
    pv.showTranslation = config?.ktvShowTranslation !== false;
  }, [isEngineReady, songTitle, songArtist, config?.ktvShowTitleCard, config?.ktvShowTranslation]);

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

  return (
    <div
      ref={containerRef}
      className="kpv-stage kpv-pixi-stage"
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        background: resolvedTemplate?.palette?.background || '#000000',
        contain: 'strict'
      }}
    />
  );
}

