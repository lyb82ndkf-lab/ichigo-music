import React, { useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { parseDisplayTokens } from './MonetLyricsEngine';

// Renders a single chat bubble for a lyric line
const ChatBubbleLine = React.memo(({ line, engineRef, fontPx, fontStack, themeColor, globalOffset, alignMode, index, activeLineIndex }) => {
  const tokens = useMemo(() => parseDisplayTokens(line), [line]);
  const containerRef = useRef(null);
  const bubbleRef = useRef(null);
  const wordsRefs = useRef([]);

  // Determine alignment based on user preference and line index
  let isLeft = true;
  if (alignMode === 'left') isLeft = true;
  else if (alignMode === 'right') isLeft = false;
  else isLeft = index % 2 === 0;

  useEffect(() => {
    wordsRefs.current = wordsRefs.current.slice(0, tokens.length);
  }, [tokens]);

  const isActive = index === activeLineIndex;
  const isPassed = index < activeLineIndex;

  useEffect(() => {
    if (!isActive) {
      // If passed, fully reveal everything
      if (isPassed && bubbleRef.current) {
        tokens.forEach((t, i) => {
          if (wordsRefs.current[i]) {
            wordsRefs.current[i].style.display = 'inline-block';
            wordsRefs.current[i].style.opacity = 1;
          }
        });
      }
      return;
    }

    let animationId;
    const update = () => {
      const currentTime = (engineRef.current?.getCurrentTime() || 0) + globalOffset;

      // Word level discrete typing
      tokens.forEach((token, idx) => {
        const el = wordsRefs.current[idx];
        if (!el) return;

        if (!token.timed) {
          if (el.style.display !== 'inline-block') {
            el.style.display = 'inline-block';
            el.style.opacity = 1;
          }
          return;
        }

        if (currentTime < token.startTime) {
          // Hide it so the bubble collapses to fit
          if (el.style.display !== 'none') {
            el.style.display = 'none';
            el.style.opacity = 0;
          }
        } else {
          // Show it! The bubble will natively expand.
          if (el.style.display !== 'inline-block') {
            el.style.display = 'inline-block';
            el.style.opacity = 1;
          }
        }
      });

      animationId = requestAnimationFrame(update);
    };

    animationId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(animationId);
  }, [isActive, isPassed, tokens, engineRef, globalOffset]);

  // If the line hasn't started and we're not active or passed, don't show it at all
  if (index > activeLineIndex) return null;

  const tailSize = fontPx * 0.4;
  const paddingV = fontPx * 0.5;
  const paddingH = fontPx * 0.8;

  const tailStyle = isLeft ? {
    borderLeft: `${tailSize}px solid transparent`,
    borderTop: `${tailSize}px solid var(--primary-subtle)`,
    borderBottom: `${tailSize}px solid transparent`,
    left: `-${tailSize * 0.8}px`,
    top: `${paddingV}px`
  } : {
    borderRight: `${tailSize}px solid transparent`,
    borderTop: `${tailSize}px solid var(--primary-subtle)`,
    borderBottom: `${tailSize}px solid transparent`,
    right: `-${tailSize * 0.8}px`,
    top: `${paddingV}px`
  };

  return (
    <div
      ref={containerRef}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: isLeft ? 'flex-start' : 'flex-end',
        width: '100%',
        marginBottom: `${fontPx * 0.6}px`,
        opacity: isActive ? 1 : 0.6,
        transition: 'opacity 0.5s ease',
        transformOrigin: isLeft ? 'left bottom' : 'right bottom'
      }}
    >
      <div
        ref={bubbleRef}
        style={{
          position: 'relative',
          background: 'var(--primary-subtle)',
          borderRadius: `${fontPx * 0.5}px`,
          borderTopLeftRadius: isLeft ? 0 : `${fontPx * 0.5}px`,
          borderTopRightRadius: isLeft ? `${fontPx * 0.5}px` : 0,
          padding: `${paddingV}px ${paddingH}px`,
          maxWidth: '85%',
          boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
          display: 'inline-block',
          transition: 'padding 0.2s ease, max-width 0.2s ease'
        }}
      >
        {/* Tail */}
        <div style={{
          position: 'absolute',
          width: 0,
          height: 0,
          ...tailStyle
        }} />

        <div style={{
          fontFamily: fontStack,
          fontSize: `${fontPx}px`,
          fontWeight: 600,
          color: '#fff',
          lineHeight: 1.4,
          wordBreak: 'break-word',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'baseline'
        }}>
          {tokens.map((token, idx) => (
            <span
              key={token.key}
              ref={el => { wordsRefs.current[idx] = el; }}
              style={{
                display: isPassed ? 'inline-block' : 'none',
                whiteSpace: 'pre',
                opacity: isPassed ? 1 : 0,
                textShadow: `0 0 ${fontPx * 0.2}px rgba(255,255,255,0.5)`
              }}
            >
              {token.text}
            </span>
          ))}
        </div>
        
        {line.translation && (
          <div style={{
            marginTop: `${fontPx * 0.2}px`,
            fontSize: `${fontPx * 0.65}px`,
            color: 'rgba(255,255,255,0.7)',
            fontFamily: fontStack,
            lineHeight: 1.3
          }}>
            {line.translation}
          </div>
        )}
      </div>
    </div>
  );
});

export default function StreamerLyrics({
  lyrics,
  activeLineIndex,
  engineRef,
  fontPx,
  fontStack,
  themeColor = 'var(--primary)',
  showGlow = true,
  globalOffset = 0,
  alignMode = 'alternate'
}) {

  // Only render the last N lines to keep DOM lightweight
  const displayLines = useMemo(() => {
    if (!lyrics || lyrics.length === 0) return [];
    const start = Math.max(0, activeLineIndex - 8);
    const end = Math.min(lyrics.length - 1, activeLineIndex);
    return lyrics.slice(start, end + 1).map((line, idx) => ({
      line,
      index: start + idx
    }));
  }, [lyrics, activeLineIndex]);

  return (
    // Outer clipping container — fills the rail area
    <div
      className="streamer-bubble-container"
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      {/* Inner rail — absolutely positioned, anchored to bottom.
          Content grows upward; anything above the container is clipped. */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          padding: '0 6vw 16px 6vw',
          boxSizing: 'border-box'
        }}
      >
        <AnimatePresence initial={false}>
          {displayLines.map((item) => (
            <motion.div
              key={`bubble-${item.line.time}-${item.index}`}
              initial={{ opacity: 0, y: 30, scale: 0.92 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{
                opacity: 0,
                height: 0,
                marginBottom: 0,
                scale: 0.95,
                transition: { duration: 0.25, ease: 'easeIn' }
              }}
              transition={{
                duration: 0.35,
                ease: [0.25, 1, 0.5, 1]
              }}
              style={{ width: '100%', overflow: 'hidden' }}
            >
              <ChatBubbleLine
                line={item.line}
                index={item.index}
                activeLineIndex={activeLineIndex}
                engineRef={engineRef}
                fontPx={fontPx}
                fontStack={fontStack}
                themeColor={themeColor}
                globalOffset={globalOffset}
                alignMode={alignMode}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
