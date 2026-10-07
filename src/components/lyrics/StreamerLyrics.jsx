import React, { useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { parseDisplayTokens } from './MonetLyricsEngine';
import { subscribeLyricClock } from '../../utils/lyricClock';
import { toRubyHtml } from '../../utils/lyrics/furiganaHelper';

// Renders a single chat bubble for a lyric line
const ChatBubbleLine = React.memo(({ line, engineRef, fontPx, fontStack, themeColor, globalOffset, alignMode, index, activeLineIndex, showTranslation = true, showFurigana = true }) => {
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
  const bubbleFontPx = Math.round(Math.min(Math.max(fontPx * 0.72, 17), 23));

  useEffect(() => {
    if (!isActive) {
      if (bubbleRef.current) {
        tokens.forEach((t, i) => {
          const el = wordsRefs.current[i];
          if (el) {
            el.style.display = isPassed ? 'inline-block' : 'none';
            el.style.opacity = isPassed ? '1' : '0';
            el.style.textShadow = 'none';
            el.style.transform = 'translateY(0) scale(1)';
            el.style.color = isPassed ? 'rgba(255, 255, 255, 0.75)' : 'rgba(255, 255, 255, 0.58)';
            delete el.dataset.streamState;
            delete el.dataset.streamProgress;
          }
        });
      }
      return;
    }

    let lastPaintAt = 0;
    const update = (clockNow = performance.now()) => {
      const paintNow = clockNow;
      if (paintNow - lastPaintAt < 33) return;
      lastPaintAt = paintNow;
      const currentTime = (engineRef.current?.getCurrentTime() || 0) + globalOffset;

      // Word level discrete typing
      tokens.forEach((token, idx) => {
        const el = wordsRefs.current[idx];
        if (!el) return;

        if (!token.timed) {
          if (el.dataset.streamState !== 'done') {
            el.dataset.streamState = 'done';
            el.style.display = 'inline-block';
            el.style.opacity = 1;
            el.style.transform = 'translateY(0) scale(1)';
            el.style.color = themeColor || '#fff';
            el.style.textShadow = 'none';
          }
          return;
        }

        if (currentTime < token.startTime) {
          if (el.dataset.streamState !== 'waiting') {
            el.dataset.streamState = 'waiting';
            el.style.display = 'none';
            el.style.opacity = '0';
            el.style.transform = 'translateY(8px) scale(0.96)';
            el.style.color = 'rgba(255,255,255,0.58)';
            el.style.textShadow = 'none';
          }
        } else if (currentTime >= token.endTime) {
          if (el.dataset.streamState !== 'done') {
            el.dataset.streamState = 'done';
            el.style.display = 'inline-block';
            el.style.opacity = 1;
            el.style.transform = 'translateY(0) scale(1)';
            el.style.color = themeColor || '#fff';
            el.style.textShadow = 'none';
          }
        } else {
          const progress = token.timed
            ? Math.max(0, Math.min(1, (currentTime - token.startTime) / Math.max(0.001, token.endTime - token.startTime)))
            : 1;
          const progressKey = progress.toFixed(3);
          if (el.dataset.streamState === 'active' && el.dataset.streamProgress === progressKey) return;
          el.dataset.streamState = 'active';
          el.dataset.streamProgress = progressKey;
          el.style.display = 'inline-block';
          const pulse = Math.sin(progress * Math.PI);
          el.style.opacity = '1';
          el.style.transform = `translateY(${-bubbleFontPx * 0.06 * pulse}px) scale(${1 + pulse * 0.08})`;
          el.style.color = themeColor || '#fff';
          el.style.textShadow = `0 0 ${bubbleFontPx * 0.35}px ${themeColor}, 0 0 ${bubbleFontPx * 0.7}px ${themeColor}`;
        }
      });
    };

    update();
    return subscribeLyricClock(update);
  }, [isActive, isPassed, tokens, engineRef, globalOffset, bubbleFontPx, themeColor]);

  // If the line hasn't started and we're not active or passed, don't show it at all
  if (index > activeLineIndex) return null;

  const tailSize = Math.round(bubbleFontPx * 0.35);
  const paddingV = Math.round(bubbleFontPx * 0.45);
  const paddingH = Math.round(bubbleFontPx * 0.75);

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
        margin: `${Math.round(bubbleFontPx * 0.35)}px 0`,
        width: '100%'
      }}
    >
      <div
        ref={bubbleRef}
        style={{
          position: 'relative',
          maxWidth: '85%',
          background: isActive 
            ? 'linear-gradient(135deg, var(--primary-subtle) 0%, rgba(255,255,255,0.08) 100%)' 
            : 'rgba(255, 255, 255, 0.05)',
          border: isActive ? '1px solid var(--primary)' : '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: `${Math.round(bubbleFontPx * 0.65)}px`,
          padding: `${paddingV}px ${paddingH}px`,
          boxShadow: isActive ? '0 8px 32px var(--primary-subtle)' : '0 4px 12px rgba(0,0,0,0.1)',
          transition: 'padding 0.2s ease, max-width 0.2s ease',
          opacity: isActive ? 1 : Math.max(0.42, 1 - (activeLineIndex - index) * 0.12)
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
          fontSize: `${bubbleFontPx}px`,
          fontWeight: 600,
          color: '#fff',
          lineHeight: 1.4,
          wordBreak: 'normal',
          overflowWrap: 'normal',
          hyphens: 'none',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'baseline',
          justifyContent: isLeft ? 'flex-start' : 'flex-end',
          textAlign: isLeft ? 'left' : 'right',
          width: '100%'
        }}>
          {tokens.map((token, idx) => (
            <span
              key={token.key}
              ref={el => { wordsRefs.current[idx] = el; }}
              style={{
                display: isPassed || !token.timed ? 'inline-block' : 'none',
                whiteSpace: 'pre',
                flex: '0 0 auto',
                opacity: isPassed ? 1 : 0,
                transform: isPassed ? 'translateY(0px) scale(1)' : 'translateY(8px) scale(0.96)',
                color: isPassed ? 'rgba(255, 255, 255, 0.85)' : 'rgba(255,255,255,0.58)',
                transition: 'opacity 0.12s linear, transform 0.12s linear, color 0.12s linear',
                textShadow: isActive ? `0 0 ${bubbleFontPx * 0.2}px rgba(255,255,255,0.5)` : 'none',
                willChange: isActive && token.timed ? 'opacity, transform' : 'auto'
              }}
              dangerouslySetInnerHTML={{ __html: toRubyHtml(token.text, showFurigana !== false) }}
            />
          ))}
        </div>
        
        {showTranslation && line.translation && (
          <div style={{
            marginTop: `${Math.round(bubbleFontPx * 0.2)}px`,
            fontSize: `${Math.round(bubbleFontPx * 0.65)}px`,
            color: 'rgba(255,255,255,0.7)',
            fontFamily: fontStack,
            lineHeight: 1.3,
            textAlign: isLeft ? 'left' : 'right',
            width: '100%'
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
  alignMode = 'alternate',
  showTranslation = true,
  showFurigana = true,
  config = {}
}) {

  const effectiveShowTranslation = config?.showTranslation !== undefined ? config.showTranslation !== false : showTranslation !== false;
  const effectiveShowFurigana = config?.showFurigana !== undefined ? config.showFurigana !== false : showFurigana !== false;

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

  const containerRef = useRef(null);

  const scrollToBottom = () => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    scrollToBottom();
    const frameId = requestAnimationFrame(scrollToBottom);
    return () => cancelAnimationFrame(frameId);
  }, [displayLines.length, activeLineIndex]);

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        overflowY: 'auto',
        padding: '24px 32px 140px 32px',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        scrollBehavior: 'smooth'
      }}
    >
      <div style={{
        marginTop: 'auto',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        width: '100%',
        minHeight: '100%'
      }}>
        <AnimatePresence initial={false}>
          {displayLines.map(item => (
            <motion.div
              key={item.line.id || item.index}
              initial={{ opacity: 0, y: 30, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
              style={{ width: '100%' }}
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
                showTranslation={effectiveShowTranslation}
                showFurigana={effectiveShowFurigana}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
