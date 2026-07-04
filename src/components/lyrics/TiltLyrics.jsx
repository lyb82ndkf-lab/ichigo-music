import React, { useEffect, useRef, useMemo } from 'react';
import { splitGraphemes } from './MonetLyricsEngine';

// Group the characters/words of the line into timed segments chronologically
function buildTimedSegments(line, maxLen = 14) {
  if (!line || !line.text) return [];

  const segments = [];
  let currentSegment = { text: '', graphemes: [], timings: [] };

  if (line.words && line.words.length > 0) {
    // YRC mode: group words
    for (let word of line.words) {
      const wordGraphemes = splitGraphemes(word.text);

      // If adding this word makes it exceed maxLen, and we already have some characters, push segment
      if (currentSegment.graphemes.length + wordGraphemes.length > maxLen && currentSegment.graphemes.length > 0) {
        segments.push(currentSegment);
        currentSegment = { text: '', graphemes: [], timings: [] };
      }

      const timePerGrapheme = word.durationSec / Math.max(1, wordGraphemes.length);
      wordGraphemes.forEach((g, i) => {
        currentSegment.graphemes.push(g);
        currentSegment.timings.push({
          startTime: word.startSec + i * timePerGrapheme,
          endTime: word.startSec + (i + 1) * timePerGrapheme
        });
      });
    }
  } else {
    // LRC mode: distribute all characters of line.text chronologically
    const allGraphemes = splitGraphemes(line.text);
    const duration = line.duration || 4;
    const timePerGrapheme = duration / Math.max(1, allGraphemes.length);

    allGraphemes.forEach((g, idx) => {
      if (currentSegment.graphemes.length >= maxLen) {
        segments.push(currentSegment);
        currentSegment = { text: '', graphemes: [], timings: [] };
      }
      currentSegment.graphemes.push(g);
      currentSegment.timings.push({
        startTime: line.time + idx * timePerGrapheme,
        endTime: line.time + (idx + 1) * timePerGrapheme
      });
    });
  }

  if (currentSegment.graphemes.length > 0) {
    segments.push(currentSegment);
  }

  return segments;
}

export default function TiltLyrics({
  line,
  engineRef,
  fontPx,
  fontStack,
  themeColor = 'var(--primary)',
  showGlow = true,
  globalOffset = 0
}) {
  const containerRef = useRef(null);

  // Flattened characters representation to hook refs easily
  const segmentedGraphemes = useMemo(() => {
    return buildTimedSegments(line, 14);
  }, [line]);

  // Keep flat array of refs
  const charRefs = useRef([]);

  useEffect(() => {
    let charCount = 0;
    segmentedGraphemes.forEach(seg => {
      charCount += seg.graphemes.length;
    });
    charRefs.current = charRefs.current.slice(0, charCount);
  }, [segmentedGraphemes]);

  useEffect(() => {
    let animationId;
    const charElements = charRefs.current;

    const update = () => {
      const currentTime = (engineRef.current?.getCurrentTime() || 0) + globalOffset;
      const lineEndTime = line.time + (line.duration || 5);

      let flatIdx = 0;
      segmentedGraphemes.forEach((seg) => {
        seg.graphemes.forEach((char, idx) => {
          const el = charElements[flatIdx];
          flatIdx++;
          if (!el) return;

          const timing = seg.timings[idx];
          if (!timing) return;

          const startTime = timing.startTime;
          const endTime = timing.endTime;
          
          let scale = 0.6;
          let opacity = 0;
          let yOffset = 0;
          let glowIntensity = 0;

          const tiltDirection = idx % 2 === 0 ? 1 : -1;

          if (currentTime < startTime) {
            scale = 0.6;
            opacity = 0.15;
            yOffset = 0;
          } else if (currentTime <= endTime) {
            const progress = (currentTime - startTime) / Math.max(0.01, endTime - startTime);
            scale = 0.6 + 0.65 * Math.sin(progress * Math.PI); // bounce scaling up
            opacity = 1.0;
            yOffset = Math.sin(progress * Math.PI) * (fontPx * 0.28) * tiltDirection;
            glowIntensity = Math.sin(progress * Math.PI);
          } else {
            scale = 1.0;
            opacity = 0.85;
            yOffset = 0;

            const decayElapsed = currentTime - endTime;
            const decayLimit = Math.max(1.0, lineEndTime - endTime);
            if (decayElapsed < decayLimit) {
              glowIntensity = 0.3 * (1 - decayElapsed / decayLimit);
            }
          }

          // Apply styles
          el.style.transform = `translateY(${yOffset}px) scale(${scale})`;
          el.style.opacity = opacity;

          if (showGlow && glowIntensity > 0.02) {
            const r1 = fontPx * 0.25 * glowIntensity;
            const r2 = fontPx * 0.55 * glowIntensity;
            el.style.textShadow = `0 0 ${r1}px ${themeColor}, 0 0 ${r2}px ${themeColor}`;
          } else {
            el.style.textShadow = 'none';
          }
        });
      });

      animationId = requestAnimationFrame(update);
    };

    animationId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(animationId);
  }, [line, segmentedGraphemes, fontPx, themeColor, showGlow, globalOffset, engineRef]);

  if (!line || !line.text) return null;

  let globalFlatIdx = 0;

  return (
    <div
      ref={containerRef}
      className="tilt-lyrics-container"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        margin: '0 auto',
        padding: '24px',
        boxSizing: 'border-box'
      }}
    >
      <style>
        {`
          .tilt-segment-line {
            display: flex;
            flex-wrap: wrap;
            justify-content: center;
            align-items: center;
            margin-bottom: 22px;
          }
          .tilt-char {
            display: inline-block;
            will-change: transform, opacity, text-shadow;
            transition: color 0.3s ease;
          }
        `}
      </style>
      
      {segmentedGraphemes.map((seg, segIdx) => (
        <div key={`seg-${segIdx}`} className="tilt-segment-line">
          <div
            style={{
              fontStyle: 'italic',
              fontFamily: fontStack,
              fontSize: `${fontPx * 1.5}px`,
              fontWeight: 300,
              color: 'var(--text-main)',
              display: 'flex',
              flexWrap: 'wrap'
            }}
          >
            {seg.graphemes.map((g, gIdx) => {
              const currentRefIdx = globalFlatIdx;
              globalFlatIdx++;
              return (
                <span
                  key={`char-${segIdx}-${gIdx}`}
                  ref={el => charRefs.current[currentRefIdx] = el}
                  className="tilt-char"
                  style={{
                    whiteSpace: g === ' ' ? 'pre' : 'normal',
                    marginRight: g === ' ' ? '12px' : '2px'
                  }}
                >
                  {g}
                </span>
              );
            })}
          </div>
        </div>
      ))}

      {/* Translation */}
      {line.translation && (
        <div
          style={{
            marginTop: `${fontPx * 0.6}px`,
            fontSize: `${fontPx * 0.72}px`,
            fontWeight: 500,
            color: 'var(--text-muted)',
            opacity: 0.85,
            textAlign: 'center',
            fontFamily: fontStack
          }}
        >
          {line.translation}
        </div>
      )}
    </div>
  );
}
