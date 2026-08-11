import React, { useMemo, useRef, useEffect, useState } from 'react';
import { parseDisplayTokens } from './MonetLyricsEngine';
import { subscribeLyricClock } from '../../utils/lyricClock';

// Pre-compute seeded random positions so they stay stable during resizing
function seededRandom(seed) {
  let x = Math.sin(seed++) * 10000;
  return x - Math.floor(x);
}

const SpatialTimedText = React.memo(({ line, isActive, isPassed, engineRef, globalOffset, fontPx, themeColor }) => {
  const tokens = useMemo(() => parseDisplayTokens(line), [line]);
  const tokenRefs = useRef([]);

  useEffect(() => {
    tokenRefs.current = tokenRefs.current.slice(0, tokens.length);
  }, [tokens]);

  useEffect(() => {
    if (!isActive) return undefined;
    tokenRefs.current.forEach((el) => { if (el) delete el.dataset.spatialState; });

    const update = () => {
      const currentTime = (engineRef.current?.getCurrentTime?.() || 0) + globalOffset;

      tokens.forEach((token, index) => {
        const el = tokenRefs.current[index];
        if (!el) return;

        if (!token.timed || currentTime >= token.endTime) {
          if (el.dataset.spatialState === 'done') return;
          el.dataset.spatialState = 'done';
          el.style.color = themeColor;
          el.style.opacity = '1';
          el.style.transform = 'translateY(0) scale(1)';
          el.style.textShadow = `0 0 ${fontPx * 0.45}px ${themeColor}`;
        } else if (currentTime >= token.startTime) {
          const progress = Math.max(0, Math.min(1, (currentTime - token.startTime) / Math.max(0.001, token.endTime - token.startTime)));
          const paintProgress = Math.round(progress * 240) / 240;
          const progressKey = paintProgress.toFixed(3);
          if (el.dataset.spatialState === `active:${progressKey}`) return;
          el.dataset.spatialState = `active:${progressKey}`;
          const pulse = Math.sin(paintProgress * Math.PI);
          el.style.color = themeColor;
          el.style.opacity = `${0.72 + paintProgress * 0.28}`;
          el.style.transform = `translateY(${-fontPx * 0.08 * pulse}px) scale(${1 + 0.14 * pulse})`;
          el.style.textShadow = `0 0 ${fontPx * (0.35 + paintProgress * 0.35)}px ${themeColor}`;
        } else {
          if (el.dataset.spatialState === 'waiting') return;
          el.dataset.spatialState = 'waiting';
          el.style.color = 'var(--text-main)';
          el.style.opacity = '0.36';
          el.style.transform = 'translateY(0) scale(1)';
          el.style.textShadow = 'none';
        }
      });

    };

    update();
    return subscribeLyricClock(update);
  }, [isActive, tokens, engineRef, globalOffset, fontPx, themeColor]);

  if (!isActive) {
    return <>{line.text}</>;
  }

  return (
    <>
      {tokens.map((token, index) => (
        <span
          key={token.key}
          ref={el => { tokenRefs.current[index] = el; }}
          style={{
            display: 'inline-block',
            whiteSpace: 'pre',
            color: isPassed ? themeColor : 'var(--text-main)',
            opacity: isPassed ? 1 : 0.36,
            transform: 'translateY(0) scale(1)',
            transition: 'opacity 0.18s ease, transform 0.18s ease, color 0.18s ease, text-shadow 0.18s ease',
            willChange: 'opacity, transform'
          }}
        >
          {token.text}
        </span>
      ))}
    </>
  );
});

export default function SpatialCanvasLyrics({ lyrics = [], activeLineIndex = -1, engineRef, fontPx = 36, fontStack, themeColor, isPlaying = true, globalOffset = 0, config = {} }) {
  const containerRef = useRef(null);
  const parentRef = useRef(null);
  const [viewportSize, setViewportSize] = useState({ w: 800, h: 600 });

  useEffect(() => {
    const observer = new ResizeObserver((entries) => {
      if (entries[0]) {
        setViewportSize({
          w: entries[0].contentRect.width,
          h: entries[0].contentRect.height
        });
      }
    });
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const linePositions = useMemo(() => {
    return lyrics.map((line, i) => {
      const angle = seededRandom(i * 9876.543) * Math.PI * 2;
      const dist = 100 + seededRandom(i * 1111) * 800; // Denser radius
      
      const x = Math.cos(angle) * dist;
      const y = Math.sin(angle) * dist;
      const z = (seededRandom(i * 222) - 0.5) * 1000; // True 3D depth (-500 to 500)
      
      const rot = (seededRandom(i * 555) - 0.5) * 20;
      
      return { x, y, z, rot };
    });
  }, [lyrics]);

  // Generate stable particle points
  const particles = useMemo(() => {
    const list = [];
    const count = config?.spatialParticleCount ?? 200;
    for (let i = 0; i < count; i++) {
      const angle = seededRandom(i * 123.45) * Math.PI * 2;
      const radius = 150 + seededRandom(i * 543.21) * 1000;
      const px = Math.cos(angle) * radius;
      const py = Math.sin(angle) * radius;
      const pz = (seededRandom(i * 99.9) - 0.5) * 1800;
      list.push({ x: px, y: py, z: pz, id: i });
    }
    return list;
  }, [config?.spatialParticleCount]);

  const configRef = useRef(config);
  useEffect(() => {
    configRef.current = config;
  }, [config]);

  const playingRef = useRef(isPlaying);
  const wakeRef = useRef(null);
  useEffect(() => {
    playingRef.current = isPlaying;
    wakeRef.current?.();
  }, [isPlaying]);

  // Sample the analyser at a controlled rate and write only changed CSS
  // variables. The old loop allocated a Uint8Array every animation frame and
  // accidentally queued two RAF callbacks while disabled, which made this
  // immersive mode progressively heavier than the others.
  useEffect(() => {
    let frameId = 0;
    let idleTimer = 0;
    let idleCleared = false;
    const parent = parentRef.current;
    if (!parent) return undefined;

    let pulseX = 1;
    let pulseY = 1;
    let pulseZ = 1;
    let lastSampleAt = 0;
    let lastPainted = '';
    let buffer = null;

    const reset = () => {
      const next = '1|1|1';
      if (lastPainted === next) return;
      lastPainted = next;
      parent.style.setProperty('--pulse-x', '1');
      parent.style.setProperty('--pulse-y', '1');
      parent.style.setProperty('--pulse-z', '1');
    };
    const isDisabled = (config) => config?.visualizerEnabled === false
      || config?.visualizerStyleByMode?.spatial === 'off'
      || (config?.visualizerStyleByMode?.spatial === undefined && config?.visualizerStyle === 'off');
    const schedule = (idle) => {
      if (idle) {
        if (idleTimer) return;
        idleTimer = window.setTimeout(() => {
          idleTimer = 0;
          if (!document.hidden && playingRef.current && !isDisabled(configRef.current)) {
            frameId = requestAnimationFrame(tick);
          }
        }, 300);
      } else if (!frameId) {
        frameId = requestAnimationFrame(tick);
      }
    };
    const tick = (now = performance.now()) => {
      frameId = 0;
      const config = configRef.current;
      const idle = document.hidden || !playingRef.current || isDisabled(config);
      if (idle) {
        pulseX = pulseY = pulseZ = 1;
        if (!idleCleared) {
          reset();
          idleCleared = true;
        }
        schedule(true);
        return;
      }
      idleCleared = false;
      // 15fps analyser sampling is enough because CSS keeps the spatial field
      // interpolated; it removes most main-thread and GC pressure on dense scenes.
      if (now - lastSampleAt < 66) {
        schedule(false);
        return;
      }
      lastSampleAt = now;
      const analyser = window.ichigoAnalyser;
      if (!analyser?.getByteFrequencyData || !analyser.frequencyBinCount) {
        schedule(false);
        return;
      }
      if (!buffer || buffer.length !== analyser.frequencyBinCount) buffer = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(buffer);
      const bufferLength = buffer.length;
      const bandSize = Math.max(1, Math.floor(bufferLength / 3));
      let bass = 0;
      let mid = 0;
      let treble = 0;
      for (let index = 0; index < bandSize; index += 1) bass += buffer[index] || 0;
      for (let index = bandSize; index < bandSize * 2; index += 1) mid += buffer[index] || 0;
      for (let index = bandSize * 2; index < bufferLength; index += 1) treble += buffer[index] || 0;
      bass /= bandSize;
      mid /= bandSize;
      treble /= Math.max(1, bufferLength - bandSize * 2);

      const intensity = Math.max(0.2, Number(config?.visualizerIntensity ?? 1));
      const targetX = 1 + (bass / 255) * 0.45 * (config?.spatialSpreadX ?? 1) * intensity;
      const targetY = 1 + (mid / 255) * 0.45 * (config?.spatialSpreadY ?? 1) * intensity;
      const targetZ = 1 + (treble / 255) * 0.8 * (config?.spatialSpreadZ ?? 1) * intensity;
      const smoothing = Math.max(0.04, Math.min(0.8, Number(config?.visualizerSmoothing ?? 0.16)));
      pulseX += (targetX - pulseX) * smoothing;
      pulseY += (targetY - pulseY) * smoothing;
      pulseZ += (targetZ - pulseZ) * smoothing;
      const next = [pulseX.toFixed(3), pulseY.toFixed(3), pulseZ.toFixed(3)].join('|');
      if (next !== lastPainted) {
        lastPainted = next;
        const [x, y, z] = next.split('|');
        parent.style.setProperty('--pulse-x', x);
        parent.style.setProperty('--pulse-y', y);
        parent.style.setProperty('--pulse-z', z);
      }
      schedule(false);
    };

    const wake = () => {
      if (idleTimer) {
        window.clearTimeout(idleTimer);
        idleTimer = 0;
      }
      if (!frameId && playingRef.current && !document.hidden && !isDisabled(configRef.current)) {
        frameId = requestAnimationFrame(tick);
      }
    };
    wakeRef.current = wake;
    const handleVisibility = () => {
      if (document.hidden) {
        if (frameId) {
          window.cancelAnimationFrame(frameId);
          frameId = 0;
        }
      } else {
        wake();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    wake();
    return () => {
      window.cancelAnimationFrame(frameId);
      window.clearTimeout(idleTimer);
      if (wakeRef.current === wake) wakeRef.current = null;
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  const activePos = linePositions[Math.max(0, activeLineIndex)] || { x: 0, y: 0, z: 0, rot: 0 };
  
  const camX = -activePos.x;
  const camY = -activePos.y;
  const camZ = -activePos.z + 150; // Pull back slightly from the active text
  const camRot = -activePos.rot * 0.5;

  const particleSize = config?.spatialParticleSize ?? 1.0;
  const particleOpacity = config?.spatialParticleOpacity ?? 0.7;
  const colorMode = config?.spatialColorMode || 'adaptive';
  const resolvedParticleColor = colorMode === 'custom' 
    ? (config?.spatialCustomColor || '#ff4081')
    : themeColor || '#ffffff';
  
  return (
    <div 
      ref={containerRef}
      style={{ 
        width: '100%', 
        height: '100%', 
        overflow: 'hidden',
        position: 'relative',
        perspective: '1200px',
        opacity: Number(config?.visualizerOpacity ?? 0.82),
        transform: `translateY(${Number(config?.visualizerOffsetY || 0)}px) scale(${Number(config?.visualizerScale || 1)})`,
        transformOrigin: 'center center'
      }}
    >
      <div 
        ref={parentRef}
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          width: 0,
          height: 0,
          transformStyle: 'preserve-3d',
          transition: 'transform 1.8s cubic-bezier(0.2, 0.8, 0.2, 1)',
          transform: `translate3d(${camX}px, ${camY}px, ${camZ}px) rotateZ(${camRot}deg)`
        }}
      >
        {/* Render 3D dynamic visualizer particles */}
        {particles.map((p) => {
          const depthBlur = config?.spatialDepthBlur ?? 0.5;
          // Apply basic depth-blur simulation using CSS filter based on particle base coordinate
          const blurFactor = Math.max(0, Math.min(6, (Math.abs(p.z) / 900) * 4.5 * depthBlur));
          
          return (
            <div
              key={`sp-${p.id}`}
              style={{
                position: 'absolute',
                width: `${3 * particleSize}px`,
                height: `${3 * particleSize}px`,
                backgroundColor: resolvedParticleColor,
                borderRadius: '50%',
                opacity: particleOpacity,
                // Scale coordinate multipliers driven by CSS variables on the parent element
                transform: `translate3d(calc(${p.x}px * var(--pulse-x, 1)), calc(${p.y}px * var(--pulse-y, 1)), calc(${p.z}px * var(--pulse-z, 1)))`,
                filter: blurFactor > 0.5 ? `blur(${blurFactor}px)` : 'none',
                pointerEvents: 'none',
                boxShadow: `0 0 ${8 * particleSize}px ${resolvedParticleColor}`
              }}
            />
          );
        })}

        {/* Spatial Lyrics Lines */}
        {lyrics.map((line, i) => {
          const pos = linePositions[i];
          const isActive = i === activeLineIndex;
          const isPassed = i < activeLineIndex;
          const distToActive = Math.abs(i - activeLineIndex);
          
          if (distToActive > 25) return null; 
          
          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                whiteSpace: 'nowrap',
                fontFamily: fontStack,
                fontSize: `${fontPx}px`,
                fontWeight: 800,
                color: isActive ? themeColor : 'var(--text-main)',
                opacity: isActive ? 1 : (isPassed ? 0.2 : 0.45),
                transition: 'all 0.8s cubic-bezier(0.2, 0.8, 0.2, 1)',
                transform: `translate3d(calc(-50% + ${pos.x}px), calc(-50% + ${pos.y}px), ${pos.z + (isActive ? 50 : 0)}px) rotateZ(${pos.rot}deg) scale(${isActive ? 1.2 : 1})`,
                filter: isActive ? `drop-shadow(0 0 20px ${themeColor})` : 'blur(3px)',
                zIndex: isActive ? 10 : 1,
                pointerEvents: 'none'
              }}
            >
              <SpatialTimedText
                line={line}
                isActive={isActive}
                isPassed={isPassed}
                engineRef={engineRef}
                globalOffset={globalOffset}
                fontPx={fontPx}
                themeColor={themeColor}
              />
              {line.translation && (
                <div style={{ 
                  fontSize: `${fontPx * 0.5}px`, 
                  marginTop: '10px', 
                  opacity: 0.8, 
                  fontWeight: 500,
                  textAlign: 'center'
                }}>
                  {line.translation}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
