import React, { useEffect, useRef, useMemo } from 'react';
import { splitGraphemes } from './MonetLyricsEngine';
import { subscribeLyricClock } from '../../utils/lyricClock';
import { toRubyHtml } from '../../utils/lyrics/furiganaHelper';

function buildWordTimings(line) {
  if (!line || !line.text) return [];
  const timings = [];
  if (line.words && line.words.length > 0) {
    for (let word of line.words) {
      timings.push({
        text: word.text,
        startTime: word.startSec,
        endTime: word.endSec !== undefined ? word.endSec : word.startSec + Math.max(0.001, word.durationSec || 0.1)
      });
    }
  } else {
    const graphemes = splitGraphemes(line.text);
    const duration = Math.max(0.4, Number(line.duration || 0) || 5);
    const unitDuration = duration / Math.max(1, graphemes.length);
    graphemes.forEach((text, index) => {
      timings.push({
        text,
        startTime: line.time + index * unitDuration,
        endTime: line.time + (index + 1) * unitDuration
      });
    });
  }
  return timings;
}

const CinematicLine = React.memo(({ line, engineRef, fontPx, fontStack, themeColor, showGlow, globalOffset, isActive, isPassed, dist, spacing, showFurigana = true }) => {
  const wordTimings = useMemo(() => buildWordTimings(line), [line]);
  const wordRefs = useRef([]);

  useEffect(() => {
    wordRefs.current = wordRefs.current.slice(0, wordTimings.length);
  }, [wordTimings]);

  useEffect(() => {
    if (!isActive) return;

    const wordElements = wordRefs.current;

    const update = () => {
      const currentTime = (engineRef.current?.getCurrentTime() || 0) + globalOffset;

      wordTimings.forEach((timing, idx) => {
        const el = wordElements[idx];
        if (!el) return;

        const { startTime, endTime } = timing;
        
        if (currentTime >= startTime && currentTime <= endTime) {
          const progress = Math.max(0, Math.min(1, (currentTime - startTime) / Math.max(0.001, endTime - startTime)));
          const paintProgress = Math.round(progress * 240) / 240;
          const progressKey = paintProgress.toFixed(3);
          if (el.dataset.cloudState === `active:${progressKey}`) return;
          el.dataset.cloudState = `active:${progressKey}`;
          const pulse = Math.sin(paintProgress * Math.PI);
          el.style.color = themeColor;
          el.style.textShadow = showGlow
            ? `0 0 ${fontPx * 0.4}px ${themeColor}, 0 0 ${fontPx * 0.8}px ${themeColor}`
            : `0 0 ${fontPx * 0.18}px ${themeColor}`;
          el.style.transform = `scale(${1 + pulse * 0.15})`;
        } else if (currentTime > endTime) {
          if (el.dataset.cloudState !== 'passed') {
            el.dataset.cloudState = 'passed';
            el.style.color = 'var(--text-main)';
            el.style.textShadow = 'none';
            el.style.transform = 'scale(1)';
          }
        } else {
          if (el.dataset.cloudState !== 'waiting') {
            el.dataset.cloudState = 'waiting';
            el.style.color = 'var(--text-muted)';
            el.style.textShadow = 'none';
            el.style.transform = 'scale(1)';
          }
        }
      });

    };

    update();
    return subscribeLyricClock(update);
  }, [isActive, wordTimings, fontPx, themeColor, showGlow, globalOffset, engineRef]);

  const absDist = Math.abs(dist);
  const zOffset = -absDist * 250; 
  const yOffset = dist * (fontPx * 2.8 * spacing); 
  const opacity = isActive ? 1 : Math.max(0, 0.8 - absDist * 0.25);
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
        willChange: isActive ? 'transform, opacity' : 'auto',
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
            dangerouslySetInnerHTML={{ __html: toRubyHtml(timing.text, showFurigana !== false) }}
          />
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
  cloudStepSpacing = 1,
  showTranslation = true,
  showFurigana = true,
  config = {}
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
  const effectiveShowTranslation = config?.showTranslation !== undefined ? config.showTranslation !== false : showTranslation !== false;
  const effectiveShowFurigana = config?.showFurigana !== undefined ? config.showFurigana !== false : showFurigana !== false;

  return (
    <div style={{
      width: '100%',
      height: '100%',
      position: 'relative',
      overflow: 'hidden',
      perspective: '1200px',
      transformStyle: 'preserve-3d',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      {displayLines.map(item => (
        <CinematicLine
          key={item.line.id || item.index}
          line={item.line}
          engineRef={engineRef}
          fontPx={fontPx}
          fontStack={fontStack}
          themeColor={themeColor}
          showGlow={showGlow}
          globalOffset={globalOffset}
          isActive={item.index === activeLineIndex}
          isPassed={item.index < activeLineIndex}
          dist={item.dist}
          spacing={cloudStepSpacing}
          showFurigana={effectiveShowFurigana}
        />
      ))}
      
      {effectiveShowTranslation && activeLine?.translation && (
        <div
          style={{
            position: 'absolute',
            bottom: '12%',
            left: '10%',
            right: '10%',
            textAlign: 'center',
            fontSize: `${fontPx * 0.85}px`,
            color: 'var(--text-muted)',
            fontFamily: fontStack,
            opacity: 0.8,
            transition: 'opacity 0.5s ease',
            pointerEvents: 'none',
            textShadow: '0 2px 8px rgba(0,0,0,0.5)'
          }}
        >
          {activeLine.translation}
        </div>
      )}
    </div>
  );
}
