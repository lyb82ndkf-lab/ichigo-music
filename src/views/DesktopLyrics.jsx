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

const DesktopLyricLine = React.memo(({
  line,
  lineIndex,
  status,
  offset,
  yOffset,
  scale,
  opacity,
  lyricSlotHeight,
  config,
  activeAccent,
  unplayedColor,
  stroke,
  shadow,
  glow,
  fontFamily,
  textAlign,
  alignItems,
  onRegisterToken
}) => {
  const tokens = useMemo(() => parseDisplayTokens(line), [line]);
  const isChorus = line.isChorus || false;
  const isActive = status === 'active';
  const isPassed = status === 'passed';

  return (
    <div
      style={{
        position: 'absolute',
        top: '50%',
        left: 0,
        right: 0,
        height: `${lyricSlotHeight}px`,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems,
        transform: `translateY(calc(-50% + ${yOffset}px)) scale(${scale})`,
        opacity,
        transformOrigin: config.alignment === 'left' ? 'center left' : (config.alignment === 'right' ? 'center right' : 'center center'),
        transition: 'transform 0.52s cubic-bezier(0.25, 1, 0.5, 1), opacity 0.42s ease',
        pointerEvents: 'none',
        boxSizing: 'border-box'
      }}
    >
      <div
        style={{
          position: 'relative',
          fontSize: `${config.fontSize || 36}px`,
          fontWeight: isActive ? (config.fontWeight || 700) : Math.max(300, (config.fontWeight || 700) - 100),
          fontFamily: `"${fontFamily}", "Microsoft YaHei", "Noto Sans SC", sans-serif`,
          textAlign,
          whiteSpace: 'nowrap',
          textShadow: `${shadow}${glow}`,
          WebkitTextStroke: stroke
        }}
      >
        {/* Stable dual-layer: never unmounts/remounts spans during line transitions */}
        <div style={{ position: 'relative' }}>
          {/* Base layer (unplayed color for upcoming/active, played color for passed) */}
          <div style={{ position: 'relative', zIndex: 1 }}>
            <span
              style={{
                display: 'block',
                minHeight: `${(config.fontSize || 36) * 1.12}px`,
                whiteSpace: 'nowrap',
                opacity: isPassed ? 1 : 0.65,
                color: isPassed ? activeAccent : unplayedColor
              }}
            >
              {line.text}
            </span>
          </div>
          {/* Foreground sweeping layer (persistent per token, driven directly by high-rate rAF) */}
          <div style={{ position: 'absolute', inset: 0, zIndex: 2, pointerEvents: 'none' }}>
            <span style={{ display: 'block', minHeight: `${(config.fontSize || 36) * 1.12}px`, whiteSpace: 'nowrap' }}>
              {tokens.map((token, tokenIdx) => (
                <span
                  key={`fg-${token.key || tokenIdx}`}
                  ref={el => onRegisterToken(lineIndex, tokenIdx, el, token)}
                  style={{
                    display: 'inline-block',
                    whiteSpace: 'pre',
                    color: activeAccent,
                    textShadow: config.glow?.enabled ? `${shadow}${glow}, 0 0 12px ${activeAccent}88` : shadow,
                    transformOrigin: 'center bottom'
                  }}
                >
                  {token.text}
                </span>
              ))}
            </span>
          </div>
        </div>
      </div>

      {/* Active Line Translation */}
      {isActive && config.showTranslation !== false && line.translation && (
        <div
          style={{
            fontSize: `${config.translationSize || Math.max(16, (config.fontSize || 36) * 0.6)}px`,
            fontWeight: config.fontWeight || 700,
            fontFamily: `"${fontFamily}", "Microsoft YaHei", "Noto Sans SC", sans-serif`,
            color: activeAccent,
            marginTop: 2,
            textShadow: `${shadow}${glow}`,
            WebkitTextStroke: stroke,
            textAlign
          }}
        >
          {line.translation}
        </div>
      )}
    </div>
  );
});
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
  const activeWordsMapRef = useRef(new Map());
  const innerRef = useRef(null);
  const unlockHotZoneRef = useRef(false);
  const syncDataRef = useRef(syncData);
  const configRef = useRef(config);
  const lastActiveIndexRef = useRef(-1);
  const lastClipPathsRef = useRef([]);

  configRef.current = config;
  syncDataRef.current = syncData;

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
    : (config.textStroke?.color || preset.stroke);

  const isStrokeEnabled = config.textStroke?.enabled !== false;
  const strokeWidth = config.textStroke?.width ?? 0.6;
  const stroke = isStrokeEnabled ? `${strokeWidth}px ${strokeColor}` : '0 transparent';

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

    if (configRef.current.locked) {
      if (isInUnlockHotZone !== unlockHotZoneRef.current) {
        unlockHotZoneRef.current = isInUnlockHotZone;
        window.electronAPI?.setDesktopLyricsLock?.(!isInUnlockHotZone);
        if (isInUnlockHotZone !== isHoveredRef.current) {
          setIsHovered(isInUnlockHotZone);
        }
      }
    } else {
      const shouldShowControls = isInUnlockHotZone || isInsideDragSurface;
      if (shouldShowControls !== isHoveredRef.current) {
        setIsHovered(shouldShowControls);
      }
    }
  };

  useEffect(() => {
    const handleMouseLeaveWindow = () => {
      if (isHoveredRef.current) setIsHovered(false);
      if (unlockHotZoneRef.current) {
        unlockHotZoneRef.current = false;
        if (configRef.current.locked) window.electronAPI?.setDesktopLyricsLock?.(true);
      }
    };
    document.addEventListener('mouseleave', handleMouseLeaveWindow);
    window.addEventListener('blur', handleMouseLeaveWindow);
    return () => {
      document.removeEventListener('mouseleave', handleMouseLeaveWindow);
      window.removeEventListener('blur', handleMouseLeaveWindow);
    };
  }, []);

  useEffect(() => {
    if (config.locked) {
      window.electronAPI?.setDesktopLyricsLock?.(true);
    } else {
      window.electronAPI?.setDesktopLyricsLock?.(false);
    }
  }, [config.locked]);

  const getExactCurrentTime = () => {
    const current = syncDataRef.current;
    let virtualTime = Number(current.audioTime || 0);
    if (current.isPlaying && virtualTime > 0) {
      virtualTime += Math.max(0, Date.now() - Number(current.systemTime || Date.now())) / 1000;
    }
    return virtualTime + Number(current.globalOffset || 0);
  };

  const computeTokenClipPath = (token, currentTime, fontSize = 36) => {
    if (!token) return 'inset(0 100% 0 100%)';
    const clipBleedPx = getSweepClipBleedPx(fontSize);
    let progress = 1;
    if (token.timed) {
      const duration = Math.max(0.001, token.endTime - token.startTime);
      if (currentTime >= token.endTime) progress = 1;
      else if (currentTime > token.startTime) progress = (currentTime - token.startTime) / duration;
      else progress = 0;
    }
    const pct = Math.max(0, Math.min(1, progress));
    return pct <= 0
      ? 'inset(0 100% 0 100%)'
      : `inset(0 ${100 - pct * 100}% 0 -${clipBleedPx}px)`;
  };

  const paintTokensAtTime = (adjustedTime) => {
    const currentSync = syncDataRef.current;
    const currentConfig = configRef.current;
    if (!currentSync.lines || currentSync.lines.length === 0) return;

    const activeIdx = currentSync.activeIndex >= 0 ? currentSync.activeIndex : 0;
    const fontSize = currentConfig.fontSize || 36;
    const clipBleedPx = getSweepClipBleedPx(fontSize);

    for (const item of activeWordsMapRef.current.values()) {
      const { el, token, lineIndex } = item;
      if (!el) continue;

      let clipPath;
      if (lineIndex < activeIdx) {
        clipPath = `inset(0 0% 0 -${clipBleedPx}px)`;
      } else if (lineIndex > activeIdx) {
        clipPath = 'inset(0 100% 0 100%)';
      } else {
        clipPath = computeTokenClipPath(token, adjustedTime, fontSize);
      }

      if (el._lastClipPath !== clipPath || el.style.clipPath !== clipPath) {
        el._lastClipPath = clipPath;
        el.style.clipPath = clipPath;
        el.style.webkitClipPath = clipPath;
        el.style.transform = 'none';
      }
    }
  };

  useEffect(() => {
    const cleanupFns = [];
    if (window.electronAPI?.onLyricsUpdate) {
      const cleanup = window.electronAPI.onLyricsUpdate((data) => {
        const prev = syncDataRef.current;
        const isPlayingChanged = prev.isPlaying !== data.isPlaying;
        const timeJump = Math.abs(Number(data.audioTime || 0) - Number(prev.audioTime || 0)) > 0.35;
        const next = { ...prev, ...data };
        
        let packetTime = Number(next.audioTime || 0) + Number(next.globalOffset || 0);
        if (next.isPlaying) {
          packetTime += Math.max(0, Date.now() - Number(next.systemTime || Date.now())) / 1000;
        }
        
        const calculatedActiveIndex = findActiveLineIndex(next.lines, packetTime, prev.activeIndex);
        next.activeIndex = calculatedActiveIndex;
        syncDataRef.current = next;

        const linesSignature = getLinesSignature(next.lines);
        const linesChanged = linesSignature !== getLinesSignature(prev.lines);
        const indexChanged = calculatedActiveIndex !== prev.activeIndex;
        const offsetChanged = next.globalOffset !== prev.globalOffset;

        if (linesChanged || indexChanged || offsetChanged || isPlayingChanged || timeJump) {
          setSyncData(next);
        }

        // Immediately freeze/paint exact frame on pause or packet update
        paintTokensAtTime(packetTime);
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

  const viewportHeight = Math.max(60, effectiveWindowHeight - 100);
  const localActiveIdx = syncData.activeIndex;
  const activeLineForTokens = syncData.lines?.[syncData.activeIndex] || null;
  const activeTokens = useMemo(() => (
    activeLineForTokens ? parseDisplayTokens(activeLineForTokens) : []
  ), [activeLineForTokens]);

  const hasActiveTranslation = config.showTranslation !== false && !!activeLineForTokens?.translation;
  const { lyricSlotHeight, getLineOffset } = calculateDesktopLyricLayout({
    fontSize: config.fontSize || 36,
    translationSize: config.translationSize || 22,
    hasTranslation: hasActiveTranslation
  });

  // Scoped Token Registration: Each token is registered with its lineIndex & tokenIdx
  const handleRegisterToken = (lineIndex, tokenIdx, el, token) => {
    const key = `${lineIndex}-${tokenIdx}`;
    if (el) {
      activeWordsMapRef.current.set(key, { el, token, lineIndex, tokenIdx });
      const currentTime = getExactCurrentTime();
      const activeIdx = syncDataRef.current.activeIndex >= 0 ? syncDataRef.current.activeIndex : 0;
      const clipBleedPx = getSweepClipBleedPx(configRef.current.fontSize || 36);
      
      let clipPath;
      if (lineIndex < activeIdx) {
        clipPath = `inset(0 0% 0 -${clipBleedPx}px)`;
      } else if (lineIndex > activeIdx) {
        clipPath = 'inset(0 100% 0 100%)';
      } else {
        clipPath = computeTokenClipPath(token, currentTime, configRef.current.fontSize || 36);
      }
      
      el._lastClipPath = clipPath;
      el.style.clipPath = clipPath;
      el.style.webkitClipPath = clipPath;
    } else {
      activeWordsMapRef.current.delete(key);
    }
  };

  // High-rate animation loop: zero frame drops on line switches
  useEffect(() => {
    let rafId;
    const loop = () => {
      const currentSync = syncDataRef.current;
      if (currentSync.lines && currentSync.lines.length > 0) {
        const adjustedTime = getExactCurrentTime();
        const localActiveIndex = findActiveLineIndex(currentSync.lines, adjustedTime, currentSync.activeIndex);
        
        if (localActiveIndex !== currentSync.activeIndex) {
          const nextSync = { ...currentSync, activeIndex: localActiveIndex };
          syncDataRef.current = nextSync;
          setSyncData(nextSync);
          paintTokensAtTime(adjustedTime);
          rafId = requestAnimationFrame(loop);
          return;
        }

        paintTokensAtTime(adjustedTime);
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
        pointerEvents: 'auto',
        opacity: (isHovered || !config.locked) ? 1 : 0,
        transition: 'opacity 0.2s ease'
      }}
    >
      <button
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
          whiteSpace: 'nowrap',
          WebkitAppRegion: 'no-drag',
          pointerEvents: 'auto'
        }}
      >
        {config.locked ? '🔒 解锁' : '🔓 上锁'}
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
        alignItems,
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
          WebkitAppRegion: config.locked ? 'no-drag' : 'drag',
          cursor: config.locked ? 'default' : 'move',
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
                const count = Number(config.lineCount ?? 3);
                const before = count === 1 ? 0 : 1;
                const after = count === 3 ? 1 : 0;
                const isVisible = idx >= localActiveIdx - before && idx <= localActiveIdx + after;
                if (!isVisible) return null;

                const relativeIndex = idx - localActiveIdx;
                const status = relativeIndex === 0 ? 'active' : (relativeIndex < 0 ? 'passed' : 'upcoming');
                const scale = status === 'active' ? 1 : 0.65;
                const opacity = status === 'active' ? 1 : 0.42;
                const yOffset = getLineOffset(relativeIndex);

                return (
                  <DesktopLyricLine
                    key={`desktop-line-${line.time}-${idx}`}
                    line={line}
                    lineIndex={idx}
                    status={status}
                    offset={relativeIndex}
                    yOffset={yOffset}
                    scale={scale}
                    opacity={opacity}
                    lyricSlotHeight={lyricSlotHeight}
                    config={config}
                    activeAccent={activeAccent}
                    unplayedColor={unplayedColor}
                    stroke={stroke}
                    shadow={shadow}
                    glow={glow}
                    fontFamily={fontFamily}
                    textAlign={textAlign}
                    alignItems={alignItems}
                    onRegisterToken={handleRegisterToken}
                  />
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

