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

      wordTimings.forEach((timing, idx) => {
        const el = wordElements[idx];
        if (!el) return;

        const { startTime, endTime } = timing;
        
        if (currentTime >= startTime && currentTime <= endTime) {
          if (!el.dataset.state || el.dataset.state !== 'active') {
            el.dataset.state = 'active';
            if (showGlow) {
              el.style.color = themeColor;
              el.style.textShadow = `0 0 ${fontPx * 0.4}px ${themeColor}, 0 0 ${fontPx * 0.8}px ${themeColor}`;
            }
            el.style.transform = 'scale(1.15)';
          }
        } else if (currentTime > endTime) {
          if (!el.dataset.state || el.dataset.state !== 'passed') {
            el.dataset.state = 'passed';
            el.style.color = 'var(--text-main)';
            el.style.textShadow = 'none';
            el.style.transform = 'scale(1)';
          }
        } else {
          if (el.dataset.state) {
            el.removeAttribute('data-state');
            el.style.color = 'var(--text-muted)';
            el.style.textShadow = 'none';
            el.style.transform = 'scale(1)';
          }
        }
      });

      animationId = requestAnimationFrame(update);
    };

    animationId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(animationId);
  }, [isActive, wordTimings, fontPx, themeColor, showGlow, globalOffset, engineRef]);

  const absDist = Math.abs(dist);
  const zOffset = -absDist * 250; 
  const yOffset = dist * (fontPx * 2.8 * spacing); 
  const opacity = isActive ? 1 : Math.max(0, 0.8 - absDist * 0.25);
  // Cap blur heavily to avoid GPU stalls.
  const blur = isActive ? 0 : Math.min(2, absDist * 0.5);
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
        transition: 'transform 0.8s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.8s ease, filter 0.8s ease',
        willChange: 'transform, opacity',
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
              whiteSpace: timing.text.trim() === '' ? 'pre' : 'normal',
              color: isActive ? 'var(--text-main)' : 'var(--text-muted)',
              transition: 'color 0.4s ease, transform 0.4s cubic-bezier(0.2, 0.8, 0.2, 1), text-shadow 0.4s ease',
              willChange: isActive ? 'transform, color' : 'auto'
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
