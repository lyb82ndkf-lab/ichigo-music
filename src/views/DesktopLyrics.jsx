import React, { useEffect, useMemo, useRef, useState } from 'react';

const t = {
  locked: '已锁定',
  unlocked: '已解锁',
  clickUnlock: '点击解锁',
  clickLock: '点击锁定',
  dragHint: '解锁后可拖动移动，并调整大小'
};

export default function DesktopLyrics() {
  const [syncData, setSyncData] = useState({
    isPlaying: false,
    audioTime: 0,
    systemTime: Date.now(),
    lines: [],
    activeIndex: -1,
    globalOffset: 0
  });

  const [isHovered, setIsHovered] = useState(false);
  const [config, setConfig] = useState({
    locked: true,
    fontSize: 36,
    translationSize: 22,
    fontFamily: 'Inter',
    fontWeight: 700,
    boldFirstLine: true,
    desktopColor: 'theme',
    colorPreset: 'strawberry',
    playedColor: '#ff3366',
    unplayedColor: '#ffffff',
    textStroke: { enabled: true, width: 0.6, color: '#4a0e1c' },
    textShadow: { enabled: true, color: '#ff336680', blur: 12, offsetX: 0, offsetY: 0 },
    glow: { enabled: false, intensity: 0.6 },
    opacity: 1,
    theme: 'strawberry',
    customThemeColors: { primary: '#ff3366' },
    alignment: 'center',
    showTranslation: true,
    lineCount: 3
  });
  const [windowSize, setWindowSize] = useState({ width: 1000, height: 150 });
  const [railY, setRailY] = useState(0);

  const wordsRefs = useRef([]);
  const sweepContainerRefs = useRef([]);
  const activeLineRef = useRef(null);
  const innerRef = useRef(null);

  const colorPresets = {
    strawberry: { played: '#ff3366', unplayed: '#ffffff', stroke: '#4a0e1c' },
    aurora: { played: '#00e676', unplayed: '#e0f7fa', stroke: '#003300' },
    ocean: { played: '#00b0ff', unplayed: '#e1f5fe', stroke: '#0d47a1' },
    purple: { played: '#ab47bc', unplayed: '#f3e5f5', stroke: '#310d3f' },
    gold: { played: '#ffb300', unplayed: '#fffde7', stroke: '#3e2723' },
    sakura: { played: '#ff66b2', unplayed: '#fff0f5', stroke: '#4d0026' },
    dark: { played: '#e0e0e0', unplayed: '#757575', stroke: '#1a1a1a' }
  };

  const preset = colorPresets[config.colorPreset || 'strawberry'] || colorPresets.strawberry;
  
  const activeAccent = config.colorPreset === 'custom'
    ? (config.playedColor || '#ff3366')
    : preset.played;
    
  const unplayedColor = config.colorPreset === 'custom'
    ? (config.unplayedColor || '#ffffff')
    : preset.unplayed;

  const strokeColor = config.colorPreset === 'custom'
    ? (config.textStroke?.color || '#000000')
    : preset.stroke;

  const isStrokeEnabled = config.textStroke?.enabled !== false;
  const stroke = isStrokeEnabled ? `${config.textStroke?.width || 0.6}px ${strokeColor}` : '0 transparent';

  const fontFamily = config.fontFamily || 'Inter';
  const shadow = config.textShadow?.enabled === false
    ? 'none'
    : `${config.textShadow?.offsetX || 0}px ${config.textShadow?.offsetY || 2}px ${config.textShadow?.blur || 12}px ${config.textShadow?.color || '#000000cc'}`;
  const glow = config.glow?.enabled ? `, 0 0 ${Math.round((config.glow?.intensity || 0.6) * 28)}px ${activeAccent}aa` : '';

  const pushConfig = (patch) => {
    const next = { ...config, ...patch };
    setConfig(next);
    window.electronAPI?.updateDesktopLyricsConfig?.(next);
  };

  const isHoveredRef = useRef(false);
  isHoveredRef.current = isHovered;

  // Track absolute mouse coordinates relative to the inner bounding box
  const handleGlobalMouseMove = (e) => {
    if (!innerRef.current) return;
    const rect = innerRef.current.getBoundingClientRect();
    const isInside = (
      e.clientX >= rect.left &&
      e.clientX <= rect.right &&
      e.clientY >= rect.top &&
      e.clientY <= rect.bottom
    );
    
    if (isInside) {
      if (!isHoveredRef.current) {
        setIsHovered(true);
        window.electronAPI?.setDesktopLyricsLock?.(false);
      }
    } else {
      if (isHoveredRef.current) {
        setIsHovered(false);
        if (config.locked) {
          window.electronAPI?.setDesktopLyricsLock?.(true);
        }
      }
    }
  };

  // Reset hover state and lock mouse when cursor leaves the window boundary or window loses focus
  useEffect(() => {
    const handleMouseLeaveWindow = () => {
      setIsHovered(false);
      if (config.locked) {
        window.electronAPI?.setDesktopLyricsLock?.(true);
      }
    };
    document.addEventListener('mouseleave', handleMouseLeaveWindow);
    window.addEventListener('blur', handleMouseLeaveWindow);
    return () => {
      document.removeEventListener('mouseleave', handleMouseLeaveWindow);
      window.removeEventListener('blur', handleMouseLeaveWindow);
    };
  }, [config.locked]);

  useEffect(() => {
    const cleanupFns = [];
    if (window.electronAPI?.onLyricsUpdate) {
      const cleanup = window.electronAPI.onLyricsUpdate((data) => setSyncData(data));
      if (typeof cleanup === 'function') cleanupFns.push(cleanup);
    }
    if (window.electronAPI?.onDesktopLyricsConfig) {
      const cleanup = window.electronAPI.onDesktopLyricsConfig((data) => {
        setConfig(prev => {
          const next = { ...prev, ...data };
          if (next.locked === false) {
            window.electronAPI?.setDesktopLyricsLock?.(false);
          }
          return next;
        });
      });
      if (typeof cleanup === 'function') cleanupFns.push(cleanup);
    }
    document.body.style.background = 'transparent';
    document.documentElement.style.background = 'transparent';
    return () => cleanupFns.forEach((cleanup) => cleanup());
  }, []);

  useEffect(() => {
    window.electronAPI?.resizeDesktopLyrics?.(windowSize);
  }, [windowSize]);

  // Dynamically calculate constrained viewport height based on window height
  const viewportHeight = Math.max(60, windowSize.height - 56);

  // Center active lyric scroll rail
  useEffect(() => {
    // Clear YRC word refs to prevent stale elements from previous lines
    wordsRefs.current = [];
    
    if (activeLineRef.current) {
      const offsetTop = activeLineRef.current.offsetTop;
      const height = activeLineRef.current.offsetHeight;
      setRailY(-offsetTop + (viewportHeight / 2) - (height / 2));
    }
  }, [syncData.activeIndex, viewportHeight, syncData.lines]);

  // Syllable-level YRC & line-level LRC sweep animation loop
  useEffect(() => {
    let rafId;
    const loop = () => {
      if (syncData.lines && syncData.lines.length > 0) {
        let virtualTime = syncData.audioTime;
        if (syncData.isPlaying) {
          virtualTime += (Date.now() - syncData.systemTime) / 1000;
        }
        const adjustedTime = virtualTime + syncData.globalOffset;
        const localActiveIdx = syncData.activeIndex;
        const activeLine = syncData.lines[localActiveIdx];

        if (activeLine) {
          if (activeLine.isYrc && activeLine.words) {
            for (let i = 0; i < activeLine.words.length; i++) {
              const el = wordsRefs.current[i];
              if (!el) continue;
              const w = activeLine.words[i];
              let wordProgress = 0;
              if (adjustedTime >= w.endSec) wordProgress = 100;
              else if (adjustedTime < w.startSec) wordProgress = 0;
              else wordProgress = ((adjustedTime - w.startSec) / w.durationSec) * 100;
              el.style.clipPath = `inset(0 ${100 - wordProgress}% 0 0)`;
            }
          } else if (activeLine.duration) {
            const container = sweepContainerRefs.current[localActiveIdx];
            if (container) {
              const sweepProgress = Math.min(100, Math.max(0, ((adjustedTime - activeLine.time) / activeLine.duration) * 100));
              container.style.clipPath = `inset(0 ${100 - sweepProgress}% 0 0)`;
            }
          }
        }
      }
      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, [syncData]);

  useEffect(() => {
    if (window.electronAPI?.onDesktopLyricsConfig) {
      const cleanup = window.electronAPI.onDesktopLyricsConfig((data) => {
        setConfig(prev => {
          const next = { ...prev, ...data };
          if (next.locked === false) {
            window.electronAPI?.setDesktopLyricsLock?.(false);
          } else if (next.locked === true && !isHoveredRef.current) {
            window.electronAPI?.setDesktopLyricsLock?.(true);
          }
          return next;
        });
      });
      return cleanup;
    }
  }, []);

  const localActiveIdx = syncData.activeIndex;
  const alignItems = config.alignment === 'left' ? 'flex-start' : (config.alignment === 'right' ? 'flex-end' : 'center');
  const textAlign = config.alignment || 'center';

  const controls = useMemo(() => (
    <div
      style={{
        position: 'absolute',
        top: -24,
        left: '50%',
        transform: 'translateX(-50%)',
        display: (isHovered || !config.locked) ? 'flex' : 'none',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '7px 14px',
        borderRadius: 999,
        background: 'rgba(8, 8, 12, 0.85)',
        border: `1px solid ${activeAccent}88`,
        color: '#fff',
        boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
        backdropFilter: 'blur(16px)',
        zIndex: 1000,
        WebkitAppRegion: 'no-drag'
      }}
    >
      <button
        onClick={(e) => { e.stopPropagation(); pushConfig({ locked: !config.locked }); }}
        style={{
          border: 'none',
          borderRadius: 999,
          padding: '4px 14px',
          color: '#fff',
          background: activeAccent,
          cursor: 'pointer',
          fontWeight: 800,
          fontSize: 12,
          whiteSpace: 'nowrap'
        }}
      >
        {config.locked ? '🔓 解锁' : '🔒 锁定'}
      </button>
    </div>
  ), [isHovered, config.locked, activeAccent]);

  return (
    <div
      onMouseMove={handleGlobalMouseMove}
      style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: alignItems,
        justifyContent: 'center',
        WebkitAppRegion: config.locked ? 'no-drag' : 'drag',
        overflow: 'hidden',
        background: 'transparent',
        boxSizing: 'border-box',
        padding: '30px 48px',
        position: 'relative',
        userSelect: 'none',
        WebkitUserSelect: 'none'
      }}
    >
      <div
        className="desktop-lyrics-inner-container"
        ref={innerRef}
        onDoubleClick={() => pushConfig({ locked: !config.locked })}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems,
          justifyContent: 'center',
          width: 'fit-content',
          minWidth: '320px',
          maxWidth: '100%',
          height: 'fit-content',
          borderRadius: 12,
          border: (!config.locked || isHovered) ? `2px dashed ${activeAccent}` : '2px solid transparent',
          background: (!config.locked && isHovered) ? 'rgba(0, 0, 0, 0.28)' : (isHovered ? 'rgba(0, 0, 0, 0.15)' : 'transparent'),
          transition: 'all 0.25s ease',
          boxSizing: 'border-box',
          padding: '16px 28px',
          position: 'relative',
          WebkitAppRegion: config.locked ? 'no-drag' : 'inherit',
          overflow: 'visible'
        }}
      >
        {controls}
        {!config.locked && isHovered && (
          <div style={{
            position: 'absolute', bottom: -20, left: '50%', transform: 'translateX(-50%)',
            color: '#fff', background: 'rgba(0,0,0,0.65)', padding: '3px 10px',
            borderRadius: 999, fontSize: 11, zIndex: 900, WebkitAppRegion: 'no-drag',
            border: '1px solid rgba(255,255,255,0.1)'
          }}>
            {t.dragHint}
          </div>
        )}

        <div
          className="desktop-lyrics-viewport"
          style={{
            width: '100%',
            height: `${viewportHeight}px`,
            overflow: 'visible',
            position: 'relative'
          }}
        >
          {syncData.lines && syncData.lines.length > 0 ? (
            <div
              className="desktop-lyrics-rail"
              style={{
                transform: `translateY(${railY}px)`,
                transition: 'transform 0.4s cubic-bezier(0.2, 0.8, 0.2, 1)',
                display: 'flex',
                flexDirection: 'column',
                alignItems,
                width: '100%'
              }}
            >
              {syncData.lines.map((line, idx) => {
                const isActive = idx === localActiveIdx;
                const isYrc = line.isYrc && line.words;
                
                // Calculate line visibility based on lineCount settings
                const count = Number(config.lineCount ?? 3);
                const before = count === 1 ? 0 : 1;
                const after = count === 3 ? 1 : 0;
                const isVisible = idx >= localActiveIdx - before && idx <= localActiveIdx + after;
                
                // Shrink non-active lines more aggressively so they fit in 150px height
                const scale = isActive ? 1 : 0.62;
                const opacity = isActive ? 1 : (isVisible ? 0.38 : 0);
                const blur = isActive ? 0 : (isVisible ? 0.8 : 4);
                const pointerEvents = isVisible ? 'auto' : 'none';
                
                // Keep active margins normal, shrink non-active margins
                const margin = isActive ? '8px 0' : '2px 0';
                
                return (
                  <div 
                    key={`desktop-lyric-${line.time}-${idx}`} 
                    ref={isActive ? activeLineRef : null}
                    style={{
                      position: 'relative', 
                      margin, 
                      transition: 'all 0.4s cubic-bezier(0.2, 0.8, 0.2, 1)',
                      transform: `scale(${scale})`,
                      transformOrigin: config.alignment === 'left' ? 'center left' : (config.alignment === 'right' ? 'center right' : 'center center'),
                      opacity, 
                      filter: blur > 0 ? `blur(${blur}px)` : 'none',
                      display: 'flex', 
                      flexDirection: 'column', 
                      alignItems,
                      width: '100%',
                      pointerEvents
                    }}
                  >
                    <div style={{
                      position: 'relative', fontSize: `${config.fontSize || 36}px`,
                      fontWeight: isActive ? (config.fontWeight || 700) : Math.max(300, (config.fontWeight || 700) - 100),
                      fontFamily: `"${fontFamily}", "Microsoft YaHei", "Noto Sans SC", sans-serif`, textAlign,
                      whiteSpace: 'nowrap', color: unplayedColor,
                      textShadow: `${shadow}${glow}`,
                      WebkitTextStroke: stroke
                    }}>
                      {isYrc ? (
                        <div style={{ position: 'relative' }}>
                          <div style={{ position: 'relative', zIndex: 1 }}>
                            {line.words.map((w, wIdx) => <span key={`bg-${wIdx}`} style={{ marginRight: '0.25em' }}>{w.text}</span>)}
                          </div>
                          <div style={{ position: 'absolute', inset: 0, zIndex: 2, display: 'flex', pointerEvents: 'none' }}>
                            {line.words.map((w, wIdx) => (
                              <span key={`fg-${wIdx}`} ref={el => { if (isActive) wordsRefs.current[wIdx] = el; }}
                                style={{ marginRight: '0.25em', color: activeAccent, textShadow: `${shadow}${glow}, 0 0 12px ${activeAccent}88`, clipPath: isActive ? 'inset(0 100% 0 0)' : (idx < localActiveIdx ? 'inset(0 0 0 0)' : 'inset(0 100% 0 0)'), whiteSpace: 'nowrap' }}>
                                {w.text}
                              </span>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div style={{ position: 'relative' }}>
                          <div style={{ position: 'relative', zIndex: 1 }}>{line.text}</div>
                          <div ref={el => { if (isActive) sweepContainerRefs.current[idx] = el; }}
                            style={{ position: 'absolute', inset: 0, zIndex: 2, color: activeAccent, textShadow: `${shadow}${glow}, 0 0 12px ${activeAccent}88`, clipPath: isActive ? 'inset(0 100% 0 0)' : (idx < localActiveIdx ? 'inset(0 0 0 0)' : 'inset(0 100% 0 0)'), whiteSpace: 'nowrap' }}>
                            {line.text}
                          </div>
                        </div>
                      )}
                    </div>
                    {/* Render translations for the active line ONLY to prevent vertical overflow clipping */}
                    {isActive && config.showTranslation !== false && line.translation && (
                      <div style={{
                        fontSize: `${config.translationSize || Math.max(16, (config.fontSize || 36) * 0.6)}px`,
                        fontWeight: 500,
                        fontFamily: `"${fontFamily}", "Microsoft YaHei", "Noto Sans SC", sans-serif`,
                        color: 'rgba(255,255,255,0.76)',
                        marginTop: 4,
                        textShadow: '0 2px 6px rgba(0,0,0,0.8)',
                        textAlign
                      }}>
                        {line.translation}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', fontSize: `${config.fontSize || 36}px`, fontWeight: config.fontWeight || 800, fontFamily: `"${fontFamily}", "Microsoft YaHei", sans-serif`, color: unplayedColor, textShadow: `${shadow}${glow}`, WebkitTextStroke: stroke, whiteSpace: 'nowrap' }}>
              ICHIGOMusic
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
