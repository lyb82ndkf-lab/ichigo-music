import React, { useEffect, useRef, useMemo } from 'react';
import { splitGraphemes } from './MonetLyricsEngine';

function buildWordTimings(line) {
  if (!line || !line.text) return [];
  const timings = [];
  if (line.words && line.words.length > 0) {
    for (let word of line.words) {
      timings.push({
        text: word.text,
        startTime: word.startSec,
        endTime: word.startSec + word.durationSec
      });
    }
  } else {
    const words = line.text.split(/(\s+)/);
    const duration = line.duration || 4;
    let accumulatedTextLen = 0;
    const totalChars = line.text.length;
    words.forEach(w => {
      const wDur = (w.length / totalChars) * duration;
      const wStart = line.time + (accumulatedTextLen / totalChars) * duration;
      timings.push({ text: w, startTime: wStart, endTime: wStart + wDur });
      accumulatedTextLen += w.length;
    });
  }
  return timings;
}

const CinematicLine = React.memo(({ line, engineRef, fontPx, fontStack, themeColor, showGlow, globalOffset, isActive, isPassed, dist, spacing }) => {
  const wordTimings = useMemo(() => buildWordTimings(line), [line]);
  const wordRefs = useRef([]);

  useEffect(() => {
    wordRefs.current = wordRefs.current.slice(0, wordTimings.length);
  }, [wordTimings]);

  useEffect(() => {
    if (!isActive) return;

    let animationId;
    const wordElements = wordRefs.current;

    const update = () => {
      const currentTime = (engineRef.current?.getCurrentTime() || 0) + globalOffset;
      const lineEndTime = line.time + (line.duration || 5);

      wordTimings.forEach((timing, idx) => {
        const el = wordElements[idx];
        if (!el) return;

        const { startTime, endTime } = timing;
        let glowIntensity = 0;
        let scale = 1;
        
        if (currentTime < startTime) {
          glowIntensity = 0;
          scale = 1;
        } else if (currentTime <= endTime) {
          const progress = (currentTime - startTime) / Math.max(0.01, endTime - startTime);
          glowIntensity = Math.sin(progress * Math.PI); // Peak at center
          scale = 1 + 0.15 * Math.sin(progress * Math.PI);
        } else {
          scale = 1;
          const decayElapsed = currentTime - endTime;
          const decayLimit = Math.max(1.0, lineEndTime - endTime);
          if (decayElapsed < decayLimit) {
            glowIntensity = 1 - (decayElapsed / decayLimit);
          }
        }

        if (showGlow && glowIntensity > 0.05) {
          const r1 = fontPx * 0.25 * glowIntensity;
          const r2 = fontPx * 0.6 * glowIntensity;
          el.style.textShadow = `0 0 ${r1}px ${themeColor}, 0 0 ${r2}px ${themeColor}`;
          el.style.color = themeColor;
        } else {
          el.style.textShadow = 'none';
          el.style.color = 'var(--text-main)';
        }
        el.style.transform = `scale(${scale})`;
      });

      animationId = requestAnimationFrame(update);
    };

    animationId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(animationId);
  }, [isActive, line, wordTimings, fontPx, themeColor, showGlow, globalOffset, engineRef]);

  const absDist = Math.abs(dist);
  const zOffset = -absDist * 250; 
  const yOffset = dist * (fontPx * 2.8 * spacing); 
  const opacity = isActive ? 1 : Math.max(0, 0.8 - absDist * 0.25);
  const blur = isActive ? 0 : Math.min(8, absDist * 1.5);
  const rotateX = dist * 8; 

  return (
    <div
      style={{
        position: 'absolute',
        top: '50%',
        left: '5%',
        right: '5%',
        transform: `translateY(-50%) translateY(${yOffset}px) translateZ(${zOffset}px) rotateX(${rotateX}deg)`,
        opacity: opacity,
        filter: blur > 0 ? `blur(${blur}px)` : 'none',
        transition: 'all 0.8s cubic-bezier(0.2, 0.8, 0.2, 1)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: isActive ? 10 : 5 - absDist
      }}
    >
      <div
        style={{
          fontFamily: fontStack,
          fontSize: `${fontPx * (isActive ? 1.4 : 1.1)}px`,
          fontWeight: isActive ? 800 : 500,
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '12px',
          textAlign: 'center',
          lineHeight: '1.4',
          transition: 'font-size 0.8s cubic-bezier(0.2, 0.8, 0.2, 1), font-weight 0.8s ease',
          borderBottom: isActive ? `3px solid ${themeColor}` : '3px solid transparent',
          paddingBottom: '8px',
          boxShadow: isActive && showGlow ? `0 8px 15px -10px ${themeColor}` : 'none'
        }}
      >
        {wordTimings.map((timing, idx) => (
          <span
            key={idx}
            ref={el => { wordRefs.current[idx] = el; }}
            style={{
              display: 'inline-block',
              willChange: isActive ? 'transform, color, text-shadow' : 'auto',
              whiteSpace: timing.text.trim() === '' ? 'pre' : 'normal',
              color: isActive ? 'var(--text-main)' : 'var(--text-muted)',
              transition: 'color 0.8s ease'
            }}
          >
            {timing.text}
          </span>
        ))}
      </div>
    </div>
  );
});

export default function CloudStepLyrics({
  lyrics,
  activeLineIndex,
  engineRef,
  fontPx,
  fontStack,
  themeColor = 'var(--primary)',
  showGlow = true,
  globalOffset = 0,
  cloudStepSpacing = 1
}) {

  const displayLines = useMemo(() => {
    if (!lyrics || lyrics.length === 0) return [];
    const start = Math.max(0, activeLineIndex - 4);
    const end = Math.min(lyrics.length - 1, activeLineIndex + 4);
    
    const lines = [];
    for (let i = start; i <= end; i++) {
      lines.push({
        line: lyrics[i],
        index: i,
        dist: i - activeLineIndex
      });
    }
    return lines;
  }, [lyrics, activeLineIndex]);

  const activeLine = lyrics?.[activeLineIndex];

  return (
    <div style={{
      width: '100%',
      height: '100%',
      position: 'relative',
      perspective: '1200px', 
      transformStyle: 'preserve-3d',
      overflow: 'hidden'
    }}>
      <div style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 20
      }} />

      {displayLines.map(item => (
        <CinematicLine
          key={`cloudstep-${item.line.time}-${item.index}`}
          line={item.line}
          dist={item.dist}
          spacing={cloudStepSpacing}
          isActive={item.dist === 0}
          isPassed={item.dist < 0}
          engineRef={engineRef}
          fontPx={fontPx}
          fontStack={fontStack}
          themeColor={themeColor}
          showGlow={showGlow}
          globalOffset={globalOffset}
        />
      ))}

      {/* Independent translation layer at the bottom, above visualizer */}
      {activeLine && activeLine.translation && (
        <div style={{
          position: 'absolute',
          bottom: '100px', // Right above the visualizer which is max 88px tall
          left: 0,
          right: 0,
          textAlign: 'center',
          fontSize: `${fontPx * 0.7}px`,
          fontWeight: 600,
          color: 'var(--text-main)',
          opacity: 0.85,
          fontFamily: fontStack,
          letterSpacing: '1px',
          textShadow: `0 2px 10px rgba(0,0,0,0.8)`,
          zIndex: 30,
          transition: 'all 0.5s ease'
        }}>
          {activeLine.translation}
        </div>
      )}
    </div>
  );
}
