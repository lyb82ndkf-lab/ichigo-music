import React, { useEffect, useRef, useMemo } from 'react';
import { splitGraphemes } from './MonetLyricsEngine';

function isWholeWord(text) {
  if (/[\u4e00-\u9fa5\u3040-\u30ff]/.test(text)) return false;
  return /[a-zA-Z0-9]/.test(text) && text.trim().length >= 1;
}

// Extract timing for a line down to character/word level
function buildFlatTimings(line) {
  if (!line || !line.text) return [];

  const timings = [];
  if (line.words && line.words.length > 0) {
    for (let word of line.words) {
      if (isWholeWord(word.text)) {
        timings.push({
          text: word.text,
          startTime: word.startSec,
          endTime: word.startSec + word.durationSec
        });
      } else {
        const graphemes = splitGraphemes(word.text);
        const timePerGrapheme = word.durationSec / Math.max(1, graphemes.length);
        graphemes.forEach((g, i) => {
          timings.push({
            text: g,
            startTime: word.startSec + i * timePerGrapheme,
            endTime: word.startSec + (i + 1) * timePerGrapheme
          });
        });
      }
    }
  } else {
    // Fallback
    const words = line.text.split(/(\s+)/);
    const duration = line.duration || 4;
    let accumulatedTextLen = 0;
    const totalChars = line.text.length;
    
    words.forEach(w => {
      if (!w) return;
      const wDur = (w.length / totalChars) * duration;
      const wStart = line.time + (accumulatedTextLen / totalChars) * duration;
      
      if (isWholeWord(w) || w.trim() === '') {
        timings.push({
          text: w,
          startTime: wStart,
          endTime: wStart + wDur
        });
      } else {
        const graphemes = splitGraphemes(w);
        const timePerGrapheme = wDur / Math.max(1, graphemes.length);
        graphemes.forEach((g, idx) => {
          timings.push({
            text: g,
            startTime: wStart + idx * timePerGrapheme,
            endTime: wStart + (idx + 1) * timePerGrapheme
          });
        });
      }
      accumulatedTextLen += w.length;
    });
  }
  return timings;
}

// Generate animation mode specific initial offsets
function useAnimationMode(lineId, length, trackIndex) {
  return useMemo(() => {
    const offsets = [];
    const mode = trackIndex % 4;
    // mode 0: scatter from all directions
    // mode 1: typewriter (scale up in place)
    // mode 2: drop from above
    // mode 3: slide from alternating sides
    for (let i = 0; i < length; i++) {
      let x = 0, y = 0, rot = 0, scale = 1;
      if (mode === 0) {
        const angle = Math.random() * Math.PI * 2;
        const dist = 300 + Math.random() * 500;
        x = Math.cos(angle) * dist;
        y = Math.sin(angle) * dist;
        rot = (Math.random() - 0.5) * 180;
        scale = 0.2 + Math.random() * 0.8;
      } else if (mode === 1) {
        x = 0;
        y = 0;
        rot = 0;
        scale = 0.3; // Just scale up
      } else if (mode === 2) {
        x = 0;
        y = -200 - Math.random() * 300;
        rot = 0;
        scale = 0.8;
      } else if (mode === 3) {
        x = i % 2 === 0 ? -400 : 400;
        y = 0;
        rot = 0;
        scale = 1;
      }
      offsets.push({ x, y, rot, scale, mode });
    }
    return offsets;
  }, [lineId, length, trackIndex]);
}

const ChaosLine = React.memo(({ line, trackIndex, engineRef, fontPx, fontStack, themeColor, showGlow, globalOffset, isActive }) => {
  const flatTimings = useMemo(() => buildFlatTimings(line), [line]);
  const charRefs = useRef([]);
  const containerRef = useRef(null);
  const translationRef = useRef(null);

  const chaosOffsets = useAnimationMode(line.id || line.time, flatTimings.length, trackIndex);

  useEffect(() => {
    charRefs.current = charRefs.current.slice(0, flatTimings.length);
  }, [flatTimings]);

  useEffect(() => {
    let animationId;
    const charElements = charRefs.current;
    
    const update = () => {
      const currentTime = (engineRef.current?.getCurrentTime() || 0) + globalOffset;
      const lineEndTime = line.time + (line.duration || 5);

      flatTimings.forEach((timing, idx) => {
        const el = charElements[idx];
        if (!el) return;

        const { startTime, endTime } = timing;
        const initial = chaosOffsets[idx];
        
        let opacity = 0;
        let x = initial.x;
        let y = initial.y;
        let rot = initial.rot;
        let scale = initial.scale;
        let glowIntensity = 0;
        
        if (currentTime < startTime) {
          // Hovering outside before starting
          opacity = 0;
        } else if (currentTime <= endTime) {
          // Flying in!
          const duration = Math.max(0.01, endTime - startTime);
          const progress = (currentTime - startTime) / duration;
          // Cubic ease-out
          const easeOut = 1 - Math.pow(1 - progress, 3);
          
          opacity = progress;
          x = initial.x * (1 - easeOut);
          y = initial.y * (1 - easeOut);
          rot = initial.rot * (1 - easeOut);
          scale = initial.scale + (1 - initial.scale) * easeOut;
          glowIntensity = progress;
        } else {
          // Arrived
          opacity = 1.0;
          x = 0;
          y = 0;
          rot = 0;
          scale = 1;

          // Decay the glow after landing
          const decayElapsed = currentTime - endTime;
          const decayLimit = Math.max(1.0, lineEndTime - endTime);
          if (decayElapsed < decayLimit) {
            glowIntensity = 1 - (decayElapsed / decayLimit);
          } else {
            // After decay, fade out if line is over
            const postLineElapsed = currentTime - lineEndTime;
            if (postLineElapsed > 0) {
               opacity = Math.max(0, 1 - (postLineElapsed / 2.0));
               // Slowly drift downwards and scale down as it fades
               y = postLineElapsed * 20;
               scale = 1 - (postLineElapsed * 0.1);
            }
            glowIntensity = 0;
          }
        }

        el.style.transform = `translate(${x}px, ${y}px) rotate(${rot}deg) scale(${scale})`;
        el.style.opacity = opacity;

        if (showGlow && glowIntensity > 0.05) {
          const r1 = fontPx * 0.15 * glowIntensity;
          const r2 = fontPx * 0.35 * glowIntensity;
          el.style.textShadow = `0 0 ${r1}px ${themeColor}, 0 0 ${r2}px ${themeColor}`;
          el.style.color = themeColor;
        } else {
          el.style.textShadow = 'none';
          el.style.color = 'var(--text-main)';
        }
      });

      // Handle translation opacity - only show during active time
      if (translationRef.current) {
        if (currentTime >= line.time && currentTime <= lineEndTime) {
          translationRef.current.style.opacity = 0.6;
        } else if (currentTime > lineEndTime) {
          const postLineElapsed = currentTime - lineEndTime;
          translationRef.current.style.opacity = Math.max(0, 0.6 - (postLineElapsed / 1.0));
        } else {
          translationRef.current.style.opacity = 0;
        }
      }

      animationId = requestAnimationFrame(update);
    };

    animationId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(animationId);
  }, [line, flatTimings, fontPx, themeColor, showGlow, globalOffset, engineRef, chaosOffsets]);

  // Determine alignment based on the 4 tracks
  const trackStyles = [
    { jc: 'flex-start', align: 'left' },   // Track 0
    { jc: 'center', align: 'center' },     // Track 1
    { jc: 'flex-end', align: 'right' },    // Track 2
    { jc: 'center', align: 'center' }      // Track 3
  ];
  const tStyle = trackStyles[trackIndex % 4];

  return (
    <div
      ref={containerRef}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: tStyle.jc === 'center' ? 'center' : (tStyle.jc === 'flex-start' ? 'flex-start' : 'flex-end'),
        width: '100%',
        padding: '16px 8vw',
        boxSizing: 'border-box'
      }}
    >
      <div
        style={{
          fontFamily: fontStack,
          fontSize: `${fontPx * 1.4}px`,
          fontWeight: 700,
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: tStyle.jc,
          alignItems: 'baseline',
          gap: '4px',
          textAlign: tStyle.align,
          lineHeight: '1.5',
          perspective: '1000px'
        }}
      >
        {flatTimings.map((timing, idx) => (
          <span
            key={idx}
            ref={el => { charRefs.current[idx] = el; }}
            style={{
              display: 'inline-block',
              willChange: 'transform, opacity',
              whiteSpace: timing.text.trim() === '' ? 'pre' : 'normal',
              transformOrigin: 'center center'
            }}
          >
            {timing.text}
          </span>
        ))}
      </div>

      {line.translation && (
        <div 
          ref={translationRef}
          style={{
            marginTop: '8px',
            fontSize: `${fontPx * 0.6}px`,
            opacity: 0,
            fontWeight: 500,
            fontFamily: fontStack,
            textAlign: tStyle.align,
            width: '100%',
            willChange: 'opacity'
          }}>
          {line.translation}
        </div>
      )}
    </div>
  );
});

export default function TiltLyrics({
  lyrics,
  activeLineIndex,
  engineRef,
  fontPx,
  fontStack,
  themeColor = 'var(--primary)',
  showGlow = true,
  globalOffset = 0
}) {
  // We want to render up to 4 recent lines (the active one and previous ones that might still be fading out)
  const displayLines = useMemo(() => {
    if (!lyrics || lyrics.length === 0) return [];
    // Render the active line, plus up to 3 previous lines
    const start = Math.max(0, activeLineIndex - 3);
    const end = Math.min(lyrics.length - 1, activeLineIndex + 1); // Also render the NEXT line if it's about to start
    
    const lines = [];
    for (let i = start; i <= end; i++) {
      lines.push({
        line: lyrics[i],
        index: i,
        trackIndex: i % 4,
        isActive: i === activeLineIndex
      });
    }
    return lines;
  }, [lyrics, activeLineIndex]);

  return (
    <div style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      gap: '2vh'
    }}>
      {displayLines.map(item => (
        <ChaosLine
          key={`chaos-${item.line.time}-${item.index}`}
          line={item.line}
          trackIndex={item.trackIndex}
          isActive={item.isActive}
          engineRef={engineRef}
          fontPx={fontPx}
          fontStack={fontStack}
          themeColor={themeColor}
          showGlow={showGlow}
          globalOffset={globalOffset}
        />
      ))}
    </div>
  );
}
