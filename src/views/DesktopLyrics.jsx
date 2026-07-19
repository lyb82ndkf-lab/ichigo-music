import React, { useEffect, useMemo, useRef, useState } from 'react';
import { parseDisplayTokens } from '../components/lyrics/MonetLyricsEngine';
import { calculateDesktopLyricLayout } from '../utils/desktopLyricLayout';

const t = {
  locked: 'Locked',
  unlocked: 'Unlocked',
  clickUnlock: 'Click to unlock',
  clickLock: 'Click to lock',
  dragHint: 'Unlock to drag and resize'
};

const getSweepClipBleedPx = (fontSize) => Math.max(3, Math.ceil(fontSize * 0.08));
const UNLOCK_HOT_ZONE_WIDTH = 180;
const UNLOCK_HOT_ZONE_TOP_BLEED = 48;
const UNLOCK_HOT_ZONE_BOTTOM_BLEED = 18;
const getLinesSignature = (lines = []) => {
  if (!Array.isArray(lines) || lines.length === 0) return '0';
  const first = lines[0];
  const last = lines[lines.length - 1];
  return `${lines.length}:${first?.time || 0}:${last?.time || 0}:${last?.text || ''}`;
};

const findActiveLineIndex = (lines = [], currentTime = 0, preferredIndex = -1) => {
  if (!Array.isArray(lines) || lines.length === 0) return -1;
  const isCurrent = (index) => {
    const line = lines[index];
    if (!line || currentTime < Number(line.time || 0)) return false;
    const nextLine = lines[index + 1];
    const endTime = nextLine ? Number(nextLine.time || 0) : Number(line.time || 0) + Number(line.duration || 8);
    return currentTime < endTime;
  };

  if (preferredIndex >= 0 && preferredIndex < lines.length && isCurrent(preferredIndex)) return preferredIndex;
  const nextIndex = preferredIndex + 1;
  if (nextIndex >= 0 && nextIndex < lines.length && isCurrent(nextIndex)) return nextIndex;

  let low = 0;
  let high = lines.length - 1;
  let result = -1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if (currentTime >= Number(lines[mid]?.time || 0)) {
      result = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return result;
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
  const wordsRefs = useRef([]);
  const innerRef = useRef(null);
  const unlockHotZoneRef = useRef(false);
  const syncDataRef = useRef(syncData);
  const configRef = useRef(config);
  const activeTokensRef = useRef([]);
  const lastClipPathsRef = useRef([]);
  const renderedSyncRef = useRef({ linesSignature: '0', activeIndex: -1, globalOffset: 0 });

  configRef.current = config;

  useEffect(() => {
    syncDataRef.current = { ...syncDataRef.current, ...syncData };
  }, [syncData]);

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

  // Track absolute mouse coordinates relative to the inner bounding box.
  // When locked, only the small area around the top-center unlock pill should
  // reveal controls/border and temporarily accept mouse events.
  const handleGlobalMouseMove = (e) => {
    if (!innerRef.current) return;
    const rect = innerRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const halfHotZoneWidth = UNLOCK_HOT_ZONE_WIDTH / 2;
    const isInUnlockHotZone = (
      e.clientX >= centerX - halfHotZoneWidth &&
      e.clientX <= centerX + halfHotZoneWidth &&
      e.clientY >= Math.max(0, rect.top - UNLOCK_HOT_ZONE_TOP_BLEED) &&
      e.clientY <= rect.top + UNLOCK_HOT_ZONE_BOTTOM_BLEED
    );
    const isInsideDragSurface = (
      e.clientX >= rect.left &&
      e.clientX <= rect.right &&
      e.clientY >= rect.top &&
      e.clientY <= rect.bottom
    );

    if (configRef.current.locked && isInUnlockHotZone !== unlockHotZoneRef.current) {
      unlockHotZoneRef.current = isInUnlockHotZone;
      window.electronAPI?.setDesktopLyricsLock?.(!isInUnlockHotZone);
    }

    const shouldShowControls = configRef.current.locked
      ? isInUnlockHotZone
      : (isInUnlockHotZone || isInsideDragSurface);

    if (shouldShowControls) {
      if (!isHoveredRef.current) setIsHovered(true);
    } else {
      if (isHoveredRef.current) setIsHovered(false);
    }
  };

  // Reset hover state when cursor leaves the window boundary or window loses focus
  useEffect(() => {
    const handleMouseLeaveWindow = () => {
      setIsHovered(false);
      unlockHotZoneRef.current = false;
      if (configRef.current.locked) window.electronAPI?.setDesktopLyricsLock?.(true);
    };
    document.addEventListener('mouseleave', handleMouseLeaveWindow);
    window.addEventListener('blur', handleMouseLeaveWindow);
    return () => {
      document.removeEventListener('mouseleave', handleMouseLeaveWindow);
      window.removeEventListener('blur', handleMouseLeaveWindow);
    };
  }, []);

  // Sync actual window lock state with config.locked
  useEffect(() => {
    if (config.locked) {
      window.electronAPI?.setDesktopLyricsLock?.(true);
    } else {
      window.electronAPI?.setDesktopLyricsLock?.(false);
    }
  }, [config.locked]);

  useEffect(() => {
    const cleanupFns = [];
    if (window.electronAPI?.onLyricsUpdate) {
      const cleanup = window.electronAPI.onLyricsUpdate((data) => {
        const next = { ...syncDataRef.current, ...data };
        let packetTime = Number(next.audioTime || 0) + Number(next.globalOffset || 0);
        if (next.isPlaying) packetTime += Math.max(0, Date.now() - Number(next.systemTime || Date.now())) / 1000;
        next.activeIndex = findActiveLineIndex(next.lines, packetTime, syncDataRef.current.activeIndex);
        syncDataRef.current = next;
        const linesSignature = getLinesSignature(next.lines);
        const rendered = renderedSyncRef.current;
        if (
          rendered.linesSignature !== linesSignature ||
          rendered.activeIndex !== next.activeIndex ||
          rendered.globalOffset !== next.globalOffset
        ) {
          renderedSyncRef.current = {
            linesSignature,
            activeIndex: next.activeIndex,
            globalOffset: next.globalOffset
          };
          setSyncData(next);
        }
      });
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

  const visibleLineCount = Number(config.lineCount ?? 3);
  const requiredWindowHeight = Math.ceil((config.fontSize || 36) * (visibleLineCount === 3 ? 4.8 : visibleLineCount === 2 ? 3.7 : 2.7) + (config.showTranslation !== false ? (config.translationSize || 22) * 1.2 : 0) + 120);
  const effectiveWindowHeight = Math.max(windowSize.height, requiredWindowHeight);
  useEffect(() => {
    window.electronAPI?.resizeDesktopLyrics?.({ ...windowSize, height: effectiveWindowHeight });
  }, [windowSize, effectiveWindowHeight]);

  // Dynamically calculate constrained viewport height based on window height
  const viewportHeight = Math.max(60, effectiveWindowHeight - 100);
  const localActiveIdx = syncData.activeIndex;
  const activeLineForTokens = syncData.lines?.[syncData.activeIndex] || null;
  const activeTokens = useMemo(() => (
    activeLineForTokens ? parseDisplayTokens(activeLineForTokens) : []
  ), [activeLineForTokens]);

  useEffect(() => {
    activeTokensRef.current = activeTokens;
    lastClipPathsRef.current = [];
  }, [activeTokens]);

  // Keep every lyric on a fixed-height rail slot. Measuring the active DOM node
  // caused the coordinate origin to change whenever hidden rows were mounted.
  const hasActiveTranslation = config.showTranslation !== false && !!activeLineForTokens?.translation;
  const { lyricSlotHeight, getLineOffset } = calculateDesktopLyricLayout({
    fontSize: config.fontSize || 36,
    translationSize: config.translationSize || 22,
    hasTranslation: hasActiveTranslation
  });
  // Shared token-level sweep animation loop. It uses the same display-token
  // model as immersive lyrics, so YRC/QRC/KRC and fallback LRC all reveal on the
  // same per-grapheme timing path.
  useEffect(() => {
    let rafId;
    const loop = () => {
      const currentSync = syncDataRef.current;
      const currentConfig = configRef.current;
      if (currentSync.lines && currentSync.lines.length > 0) {
        let virtualTime = currentSync.audioTime;
        if (currentSync.isPlaying && currentSync.audioTime > 0) {
          virtualTime += (Date.now() - currentSync.systemTime) / 1000;
        }
        const adjustedTime = virtualTime + currentSync.globalOffset;
        const localActiveIndex = findActiveLineIndex(currentSync.lines, adjustedTime, currentSync.activeIndex);
        if (localActiveIndex !== currentSync.activeIndex) {
          const nextSync = { ...currentSync, activeIndex: localActiveIndex };
          syncDataRef.current = nextSync;
          renderedSyncRef.current = {
            ...renderedSyncRef.current,
            activeIndex: localActiveIndex,
            linesSignature: getLinesSignature(nextSync.lines)
          };
          setSyncData(nextSync);
          rafId = requestAnimationFrame(loop);
          return;
        }
        const tokens = activeTokensRef.current;
        if (tokens.length > 0) {
          for (let i = 0; i < tokens.length; i += 1) {
            const token = tokens[i];
            const el = wordsRefs.current[i];
            if (!el) continue;
            
            let progress = 1; // Untimed gap tokens (like spaces) are always fully revealed to preserve width
            if (token.timed) {
              const duration = Math.max(0.001, token.endTime - token.startTime);
              if (adjustedTime >= token.endTime) progress = 1;
              else if (adjustedTime > token.startTime) progress = (adjustedTime - token.startTime) / duration;
              else progress = 0;
            }
            
            const pct = Math.max(0, Math.min(1, progress));
            const clipBleedPx = getSweepClipBleedPx(currentConfig.fontSize || 36);
            const clipPath = pct <= 0
              ? 'inset(0 100% 0 100%)'
              : `inset(0 ${100 - pct * 100}% 0 -${clipBleedPx}px)`;
            if (lastClipPathsRef.current[i] !== clipPath) {
              lastClipPathsRef.current[i] = clipPath;
              el.style.clipPath = clipPath;
              el.style.webkitClipPath = clipPath;
              el.style.transform = 'none';
            }
          }
        }
      }
      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, []);

  const alignItems = config.alignment === 'left' ? 'flex-start' : (config.alignment === 'right' ? 'flex-end' : 'center');
  const textAlign = config.alignment || 'center';

  const controls = useMemo(() => (
    <div
      style={{
        position: 'absolute',
        top: -24,
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
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
        WebkitAppRegion: 'no-drag',
        pointerEvents: isHovered ? 'auto' : 'none',
        opacity: isHovered ? 1 : 0,
        transition: 'opacity 0.2s ease'
      }}
    >
      <button
        onMouseEnter={() => {
          if (config.locked) window.electronAPI?.setDesktopLyricsLock?.(false);
        }}
        onMouseLeave={() => {
          if (config.locked) window.electronAPI?.setDesktopLyricsLock?.(true);
        }}
        onClick={(e) => { 
          e.stopPropagation(); 
          pushConfig({ locked: !config.locked }); 
        }}
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
        {config.locked ? '\uD83D\uDD12 \u89e3\u9501' : '\uD83D\uDD13 \u4e0a\u9501'}
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
        WebkitUserSelect: 'none',
        pointerEvents: 'auto'
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
          width: '100%',
          minWidth: '320px',
          maxWidth: '100%',
          height: 'fit-content',
          borderRadius: 12,
          border: (!config.locked || isHovered) ? `2px dashed ${activeAccent}` : '2px solid transparent',
          background: (!config.locked && isHovered) ? `rgba(0, 0, 0, ${0.22 * (config.opacity ?? 1)})` : 'transparent',
          opacity: config.opacity ?? 1,
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
                position: 'relative',
                width: '100%',
                height: '100%'
              }}
            >
              {syncData.lines.map((line, idx) => {
                const isActive = idx === localActiveIdx;
                
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
                if (!isVisible) return null;
                const relativeIndex = idx - localActiveIdx;
                
                const yOffset = getLineOffset(relativeIndex);
                
                return (
                  <div 
                    key={`desktop-lyric-${line.time}-${idx}`} 
                    style={{
                      position: 'absolute',
                      top: '50%',
                      left: 0,
                      height: `${lyricSlotHeight}px`,
                      padding: 0,
                      boxSizing: 'border-box',
                      '--desktop-line-transform': `translateY(calc(-50% + ${yOffset}px)) scale(${scale})`,
                      transition: 'transform 0.38s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.28s ease',
                      animation: relativeIndex > 0 ? 'desktopLyricEnter 0.38s cubic-bezier(0.16, 1, 0.3, 1)' : undefined,
                      transform: 'var(--desktop-line-transform)',
                      transformOrigin: config.alignment === 'left' ? 'center left' : (config.alignment === 'right' ? 'center right' : 'center center'),
                      opacity, 
                      filter: 'none',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center',
                      alignItems,
                      width: '100%',
                      pointerEvents
                    }}
                  >
                    {isVisible && (
                    <>
                    <div style={{
                      position: 'relative', fontSize: `${config.fontSize || 36}px`,
                      fontWeight: isActive ? (config.fontWeight || 700) : Math.max(300, (config.fontWeight || 700) - 100),
                      fontFamily: `"${fontFamily}", "Microsoft YaHei", "Noto Sans SC", sans-serif`, textAlign,
                      whiteSpace: 'nowrap', color: unplayedColor,
                      textShadow: `${shadow}${glow}`,
                      WebkitTextStroke: stroke
                    }}>
                      {(() => {
                        const displayTokens = parseDisplayTokens(line);
                        const rows = [displayTokens];
                        const clipBleedPx = getSweepClipBleedPx(config.fontSize || 36);
                        const tokenStyle = (token) => ({
                          display: 'inline-block',
                          marginRight: 0,
                          whiteSpace: 'pre'
                        });
                        let tokenCounter = 0;
                        if (isActive) {
                          wordsRefs.current = [];
                        }
                        return (
                        <div style={{ position: 'relative' }}>
                          <div style={{ position: 'relative', zIndex: 1 }}>
                            <span style={{ display: 'block', minHeight: `${(config.fontSize || 36) * 1.12}px`, whiteSpace: 'nowrap', opacity: isActive ? 0.68 : 1, color: !isActive && idx < localActiveIdx ? activeAccent : unplayedColor }}>
                              {line.text}
                            </span>
                          </div>
                          <div style={{ position: 'absolute', inset: 0, zIndex: 2, pointerEvents: 'none', display: isActive ? 'block' : 'none' }}>
                            {rows.map((row, rowIdx) => (
                              <span key={`fg-row-${rowIdx}`} style={{ display: 'block', minHeight: `${(config.fontSize || 36) * 1.12}px`, whiteSpace: 'nowrap' }}>
                                {row.map((token) => {
                                  const currentIdx = tokenCounter++;
                                  return (
                                  <span key={`fg-${token.key}`} ref={el => { if (isActive) wordsRefs.current[currentIdx] = el; }}
                                    style={{ ...tokenStyle(token), color: activeAccent, textShadow: config.glow?.enabled ? `${shadow}${glow}, 0 0 12px ${activeAccent}88` : shadow, clipPath: isActive ? 'inset(0 100% 0 100%)' : (idx < localActiveIdx ? `inset(0 0 0 -${clipBleedPx}px)` : 'inset(0 100% 0 100%)'), WebkitClipPath: isActive ? 'inset(0 100% 0 100%)' : (idx < localActiveIdx ? `inset(0 0 0 -${clipBleedPx}px)` : 'inset(0 100% 0 100%)'), transformOrigin: 'center bottom' }}>
                                    {token.text}
                                  </span>
                                  );
                                })}
                              </span>
                            ))}
                          </div>
                        </div>
                        );
                      })()}
                    </div>
                    {/* Render translations for the active line ONLY to prevent vertical overflow clipping */}
                    {isActive && config.showTranslation !== false && line.translation && (
                      <div style={{
                        fontSize: `${config.translationSize || Math.max(16, (config.fontSize || 36) * 0.6)}px`,
                        fontWeight: config.fontWeight || 700,
                        fontFamily: `"${fontFamily}", "Microsoft YaHei", "Noto Sans SC", sans-serif`,
                        color: activeAccent,
                        marginTop: 2,
                        textShadow: `${shadow}${glow}`,
                        WebkitTextStroke: stroke,
                        textAlign
                      }}>
                        {line.translation}
                      </div>
                    )}
                    </>
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

