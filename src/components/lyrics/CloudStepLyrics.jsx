import React, { useEffect, useRef, useMemo } from 'react';
import { parseDisplayTokens } from './MonetLyricsEngine';

export default function CloudStepLyrics({
  line,
  engineRef,
  fontPx,
  fontStack,
  themeColor = 'var(--primary)',
  showGlow = true,
  globalOffset = 0
}) {
  const tokens = useMemo(() => parseDisplayTokens(line), [line]);

  // Distribute tokens into columns
  const columnData = useMemo(() => {
    if (!tokens || tokens.length === 0) return [];
    
    // Determine column count based on token count
    const wordCount = tokens.filter(t => t.timed).length;
    let colCount = 1;
    if (wordCount > 10) colCount = 4;
    else if (wordCount > 6) colCount = 3;
    else if (wordCount > 2) colCount = 2;

    const cols = Array.from({ length: colCount }, () => []);
    
    // Distribute tokens evenly
    tokens.forEach((token, idx) => {
      const colIdx = idx % colCount;
      cols[colIdx].push({ token, originalIndex: idx });
    });

    return cols;
  }, [tokens]);

  const tokenRefs = useRef([]);

  useEffect(() => {
    tokenRefs.current = tokenRefs.current.slice(0, tokens.length);
  }, [tokens]);

  useEffect(() => {
    let animationId;
    const tokenElements = tokenRefs.current;

    const update = () => {
      const currentTime = (engineRef.current?.getCurrentTime() || 0) + globalOffset;
      const lineEndTime = line.time + (line.duration || 5);

      tokens.forEach((token, index) => {
        const el = tokenElements[index];
        if (!el) return;

        if (!token.timed) {
          // Spaces/punctuation: just stay aligned with surrounding opacity
          el.style.opacity = currentTime >= line.time ? 0.8 : 0.3;
          el.style.transform = 'none';
          return;
        }

        let scale = 0.88;
        let opacity = 0.25;
        let translateY = fontPx * 0.45; // Starts lower
        let glowIntensity = 0;

        if (currentTime < token.startTime) {
          // Waiting
          scale = 0.88;
          opacity = 0.25;
          translateY = fontPx * 0.45;
        } else if (currentTime <= token.endTime) {
          // Active (Currently singing)
          const wordProgress = (currentTime - token.startTime) / Math.max(0.01, token.endTime - token.startTime);
          
          // Smooth slide and scale up
          scale = 0.88 + 0.32 * Math.sin(wordProgress * Math.PI); // Pulse/Spring feel
          opacity = 1.0;
          translateY = (fontPx * 0.45) * (1 - wordProgress); // slide up to 0
          glowIntensity = Math.sin(wordProgress * Math.PI);
        } else {
          // Passed
          scale = 1.0;
          opacity = 0.72;
          translateY = -fontPx * 0.22; // Drift slightly upwards

          const decayElapsed = currentTime - token.endTime;
          const decayLimit = Math.max(1.0, lineEndTime - token.endTime);
          if (decayElapsed < decayLimit) {
            glowIntensity = 0.35 * (1 - decayElapsed / decayLimit);
          }
        }

        // Apply style changes directly to bypass React virtual DOM overhead
        el.style.transform = `translateY(${translateY}px) scale(${scale})`;
        el.style.opacity = opacity;

        if (showGlow && glowIntensity > 0.02) {
          const r1 = fontPx * 0.28 * glowIntensity;
          const r2 = fontPx * 0.65 * glowIntensity;
          el.style.textShadow = `0 0 ${r1}px ${themeColor}, 0 0 ${r2}px ${themeColor}`;
        } else {
          el.style.textShadow = 'none';
        }
      });

      animationId = requestAnimationFrame(update);
    };

    animationId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(animationId);
  }, [line, tokens, fontPx, themeColor, showGlow, globalOffset, engineRef]);

  if (!line || !line.text) return null;

  return (
    <div
      className="cloudstep-lyrics-container"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        width: '100%',
        margin: '0 auto',
        padding: '24px',
        boxSizing: 'border-box'
      }}
    >
      <style>
        {`
          .cloudstep-columns-row {
            display: flex;
            flex-direction: row;
            justify-content: center;
            align-items: flex-start;
            gap: 40px;
            width: 100%;
            max-width: 900px;
          }
          .cloudstep-column {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 16px;
            flex: 1;
          }
          .cloudstep-word {
            display: inline-block;
            will-change: transform, opacity, text-shadow;
            transition: color 0.3s ease;
          }
        `}
      </style>
      
      <div className="cloudstep-columns-row">
        {columnData.map((col, colIdx) => (
          <div key={`col-${colIdx}`} className="cloudstep-column">
            {col.map(({ token, originalIndex }) => (
              <span
                key={token.key}
                ref={el => tokenRefs.current[originalIndex] = el}
                className="cloudstep-word"
                style={{
                  fontFamily: fontStack,
                  fontSize: `${fontPx * 1.2}px`,
                  fontWeight: 800,
                  color: 'var(--text-main)',
                  textAlign: 'center',
                  wordBreak: 'break-word',
                  minHeight: `${fontPx * 1.5}px`
                }}
              >
                {token.text}
              </span>
            ))}
          </div>
        ))}
      </div>

      {/* Translation */}
      {line.translation && (
        <div
          style={{
            marginTop: `${fontPx * 0.8}px`,
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
