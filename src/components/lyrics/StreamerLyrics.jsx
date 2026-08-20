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
          }
          return;
        }

        if (currentTime < token.startTime) {
          if (el.dataset.streamState !== 'waiting') {
            el.dataset.streamState = 'waiting';
            el.style.display = 'none';
            el.style.opacity = '0';
            el.style.transform = 'translateY(10px) scale(0.96)';
            el.style.color = 'rgba(255,255,255,0.58)';
          }
        } else if (currentTime >= token.endTime) {
          if (el.dataset.streamState !== 'done') {
            el.dataset.streamState = 'done';
            el.style.display = 'inline-block';
            el.style.opacity = '1';
            el.style.transform = 'translateY(0) scale(1)';
            el.style.color = themeColor || '#fff';
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
          el.style.transform = `translateY(${-fontPx * 0.06 * pulse}px) scale(${1 + pulse * 0.08})`;
          el.style.color = themeColor || '#fff';
          el.style.textShadow = `0 0 ${fontPx * 0.4}px ${themeColor}, 0 0 ${fontPx * 0.8}px ${themeColor}`;
        }
      });
    };

    update();
    return subscribeLyricClock(update);
  }, [isActive, isPassed, tokens, engineRef, globalOffset, fontPx, themeColor]);

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
        margin: `${fontPx * 0.6}px 0`,
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
          borderRadius: `${fontPx * 0.8}px`,
          padding: `${paddingV}px ${paddingH}px`,
          boxShadow: isActive ? '0 8px 32px var(--primary-subtle)' : '0 4px 12px rgba(0,0,0,0.1)',
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
          wordBreak: 'normal',
          overflowWrap: 'normal',
          hyphens: 'none',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'baseline'
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
                transform: isPassed ? 'translateY(0px) scale(1)' : 'translateY(10px) scale(0.96)',
                color: isPassed ? '#fff' : 'rgba(255,255,255,0.58)',
                transition: 'opacity 0.12s linear, transform 0.12s linear, color 0.12s linear',
                textShadow: `0 0 ${fontPx * 0.2}px rgba(255,255,255,0.5)`,
                willChange: isActive && token.timed ? 'opacity, transform' : 'auto'
              }}
              dangerouslySetInnerHTML={{ __html: toRubyHtml(token.text, showFurigana !== false) }}
            />
          ))}
        </div>
        
        {showTranslation && line.translation && (
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

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [displayLines.length]);

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        overflowY: 'auto',
        padding: '24px 16px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-start',
        scrollBehavior: 'smooth'
      }}
    >
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
  );
}
