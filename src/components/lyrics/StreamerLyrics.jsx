import React, { useEffect, useRef, useMemo } from 'react';
import { parseDisplayTokens } from './MonetLyricsEngine';

export default function StreamerLyrics({
  line,
  engineRef,
  fontPx,
  fontStack,
  themeColor = 'var(--primary)',
  showGlow = true,
  globalOffset = 0
}) {
  const containerRef = useRef(null);
  const tokens = useMemo(() => parseDisplayTokens(line), [line]);
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

        // Floating ambient movement (sinus based on time and word index)
        const timeFactor = Date.now() / 1000;
        const driftY = Math.sin(timeFactor * 1.5 + index * 0.8) * (fontPx * 0.08);
        const driftX = Math.cos(timeFactor * 1.0 + index * 0.5) * (fontPx * 0.03);
        const rotate = Math.sin(timeFactor * 0.8 + index * 1.2) * 2; // subtle rotation (degrees)

        if (!token.timed) {
          // Static text like punctuation / spaces
          el.style.transform = `translate(${driftX}px, ${driftY}px) rotate(${rotate}deg)`;
          el.style.opacity = currentTime >= line.time ? 0.9 : 0.35;
          return;
        }

        // Timed word state calculations
        let scale = 0.92;
        let opacity = 0.4;
        let glowIntensity = 0;

        if (currentTime < token.startTime) {
          // Waiting
          scale = 0.92;
          opacity = 0.4;
        } else if (currentTime <= token.endTime) {
          // Active (Currently singing)
          const wordProgress = (currentTime - token.startTime) / Math.max(0.01, token.endTime - token.startTime);
          scale = 0.92 + 0.22 * Math.sin(wordProgress * Math.PI); // Pulse up to 1.14
          opacity = 1.0;
          glowIntensity = Math.sin(wordProgress * Math.PI);
        } else {
          // Passed
          scale = 1.0;
          opacity = 0.82;
          
          // Slowly decay glow after word has finished
          const decayElapsed = currentTime - token.endTime;
          const decayLimit = Math.max(1.2, lineEndTime - token.endTime);
          if (decayElapsed < decayLimit) {
            glowIntensity = 0.4 * (1 - decayElapsed / decayLimit);
          }
        }

        // Apply styles directly bypassing React render
        el.style.transform = `translate(${driftX}px, ${driftY}px) scale(${scale}) rotate(${rotate}deg)`;
        el.style.opacity = opacity;

        if (showGlow && glowIntensity > 0.02) {
          const r1 = fontPx * 0.35 * glowIntensity;
          const r2 = fontPx * 0.75 * glowIntensity;
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
      ref={containerRef}
      className="streamer-lyrics-container"
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'center',
        alignItems: 'center',
        width: '100%',
        maxWidth: '900px',
        margin: '0 auto',
        padding: '24px',
        textAlign: 'center',
        perspective: '1000px'
      }}
    >
      <style>
        {`
          .streamer-word {
            display: inline-block;
            transition: color 0.3s ease;
            will-change: transform, opacity, text-shadow;
            cursor: default;
          }
        `}
      </style>
      <div
        style={{
          fontFamily: fontStack,
          fontSize: `${fontPx * 1.3}px`,
          fontWeight: 700,
          lineHeight: 1.35,
          color: 'var(--text-main)',
          display: 'block',
          wordBreak: 'break-word'
        }}
      >
        {tokens.map((token, index) => (
          <span
            key={token.key}
            ref={el => tokenRefs.current[index] = el}
            className="streamer-word"
            style={{
              marginRight: token.text === ' ' ? '0px' : `${fontPx * 0.18}px`
            }}
          >
            {token.text}
          </span>
        ))}
      </div>
      
      {/* Translation */}
      {line.translation && (
        <div
          style={{
            width: '100%',
            marginTop: `${fontPx * 0.5}px`,
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
