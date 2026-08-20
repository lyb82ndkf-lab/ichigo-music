import React, { useEffect, useRef, useMemo } from 'react';
import { splitGraphemes } from './MonetLyricsEngine';
import { subscribeLyricClock } from '../../utils/lyricClock';
import { toRubyHtml } from '../../utils/lyrics/furiganaHelper';

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
          endTime: word.endSec !== undefined ? word.endSec : word.startSec + Math.max(0.001, word.durationSec || 0.1)
        });
      } else {
        const graphemes = splitGraphemes(word.text);
        const duration = Math.max(0.001, word.durationSec || (word.endSec !== undefined ? word.endSec - word.startSec : 0.1));
        const timePerGrapheme = duration / Math.max(1, graphemes.length);
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
    const graphemes = splitGraphemes(line.text);
    const duration = Math.max(0.4, Number(line.duration || 0) || 5);
    const timePerGrapheme = duration / Math.max(1, graphemes.length);
    graphemes.forEach((g, i) => {
      timings.push({
        text: g,
        startTime: line.time + i * timePerGrapheme,
        endTime: line.time + (i + 1) * timePerGrapheme
      });
    });
  }
  return timings;
}

const TiltLyricLine = React.memo(({ line, engineRef, fontPx, fontStack, themeColor, showGlow, globalOffset, trackIndex, isActive, dist, glowIntensity = 1, showTranslation = true, showFurigana = true }) => {
  const flatTimings = useMemo(() => buildFlatTimings(line), [line]);
  const charRefs = useRef([]);
  const translationRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    charRefs.current = charRefs.current.slice(0, flatTimings.length);
  }, [flatTimings]);

  // Generate a deterministic chaotic pseudo-random angle/offset based on line text & index
  const chaosOffsets = useMemo(() => {
    return flatTimings.map((_, i) => {
      const seed = (line.text.charCodeAt(i % line.text.length) || 1) * (i + 1);
      const angle = ((seed % 19) - 9) * 0.8; // -7.2 to 7.2 deg
      const x = ((seed % 13) - 6) * 1.5;     // -9 to 9 px
      const y = ((seed % 17) - 8) * 1.5;     // -12 to 12 px
      return { angle, x, y };
    });
  }, [line.text, flatTimings]);

  useEffect(() => {
    if (!isActive && Math.abs(dist) > 1) return undefined;
    const charElements = charRefs.current;
    const lastPaint = [];
    let lastTranslationOpacity = null;
    const lineEndTime = line.time + (line.duration || 5);

    const update = () => {
      const currentTime = (engineRef.current?.getCurrentTime() || 0) + globalOffset;

      flatTimings.forEach((timing, idx) => {
        const el = charElements[idx];
        if (!el) return;

        const { startTime, endTime } = timing;
        const charDuration = Math.max(0.001, endTime - startTime);
        
        let opacity = 0;
        let scale = 1;
        let x = 0;
        let y = 0;
        let rot = 0;
        let glowing = false;

        if (currentTime < startTime) {
          const timeUntilStart = startTime - currentTime;
          if (timeUntilStart <= 0.6) {
            const enterProgress = 1 - (timeUntilStart / 0.6);
            opacity = enterProgress * 0.35;
            scale = 0.85 + enterProgress * 0.15;
            y = (1 - enterProgress) * 15;
            rot = (chaosOffsets[idx]?.angle || 0) * (1 - enterProgress) * 2;
          } else {
            opacity = 0;
          }
        } else if (currentTime <= endTime) {
          const hitProgress = Math.max(0, Math.min(1, (currentTime - startTime) / charDuration));
          const hitPulse = Math.sin(hitProgress * Math.PI);
          opacity = 1;
          scale = 1.0 + hitPulse * 0.35;
          x = (chaosOffsets[idx]?.x || 0) * hitPulse * 0.5;
          y = -hitPulse * (fontPx * 0.25) + (chaosOffsets[idx]?.y || 0) * hitPulse * 0.5;
          rot = (chaosOffsets[idx]?.angle || 0) * (1 + hitPulse * 0.5);
          glowing = true;
        } else {
          const timeSinceEnd = currentTime - endTime;
          if (timeSinceEnd <= 2.5) {
            const decay = timeSinceEnd / 2.5;
            opacity = Math.max(0, 0.9 - decay * 0.9);
            scale = 1.0 - decay * 0.1;
            x = (chaosOffsets[idx]?.x || 0) * (1 - decay);
            y = (chaosOffsets[idx]?.y || 0) * (1 - decay) + (decay * 8);
            rot = (chaosOffsets[idx]?.angle || 0) * (1 - decay);
          } else {
            opacity = 0;
          }
        }

        const paintKey = `${Math.round(opacity * 240)}|${Math.round(x * 10)}|${Math.round(y * 10)}|${Math.round(rot * 10)}|${Math.round(scale * 1000)}|${glowing ? 'g' : 'n'}`;
        if (lastPaint[idx] !== paintKey) {
          lastPaint[idx] = paintKey;
          el.style.transform = `translate(${x}px, ${y}px) rotate(${rot}deg) scale(${scale})`;
          el.style.opacity = opacity;
          el.style.color = glowing ? themeColor : 'var(--text-main)';
          el.style.textShadow = glowing
            ? `0 0 ${fontPx * 0.15}px ${themeColor}, 0 0 ${fontPx * 0.35}px ${themeColor}`
            : 'none';

          if (glowing) {
            if (el.dataset.state !== 'glowing') el.dataset.state = 'glowing';
          } else {
            if (el.dataset.state === 'glowing') el.dataset.state = 'normal';
          }
        }
      });

      // Handle translation opacity
      if (translationRef.current) {
        let nextTranslationOpacity;
        if (currentTime >= line.time && currentTime <= lineEndTime) {
          nextTranslationOpacity = 0.6;
        } else if (currentTime > lineEndTime) {
          const postLineElapsed = currentTime - lineEndTime;
          nextTranslationOpacity = Math.max(0, 0.6 - (postLineElapsed / 1.0));
        } else {
          nextTranslationOpacity = 0;
        }
        const roundedTranslationOpacity = Math.round(nextTranslationOpacity * 240) / 240;
        if (roundedTranslationOpacity !== lastTranslationOpacity) {
          lastTranslationOpacity = roundedTranslationOpacity;
          translationRef.current.style.opacity = roundedTranslationOpacity;
        }
      }
    };

    update();
    return subscribeLyricClock(update);
  }, [line, flatTimings, fontPx, themeColor, showGlow, globalOffset, engineRef, chaosOffsets, isActive, dist, glowIntensity]);

  const trackStyles = [
    { jc: 'flex-start', align: 'left' },
    { jc: 'center', align: 'center' },
    { jc: 'flex-end', align: 'right' },
    { jc: 'center', align: 'center' }
  ];
  const tStyle = trackStyles[trackIndex % trackStyles.length];

  return (
    <div 
      ref={containerRef}
      style={{
        position: 'absolute',
        top: '50%',
        left: '6%',
        right: '6%',
        transform: `translateY(-50%) translateY(${dist * fontPx * 2.6}px)`,
        transition: 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: tStyle.align === 'left' ? 'flex-start' : tStyle.align === 'right' ? 'flex-end' : 'center',
        justifyContent: 'center',
        pointerEvents: 'none'
      }}
    >
      <div
        style={{
          fontFamily: fontStack,
          fontSize: `${fontPx * (isActive ? 1.3 : 1.05)}px`,
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
        <style>
          {`
            .tilt-lyric-char {
              color: var(--text-main);
              text-shadow: none;
              transition: color 0.12s linear, text-shadow 0.12s linear;
            }
            .tilt-lyric-char[data-state="glowing"] {
              color: ${themeColor};
              text-shadow: 0 0 ${fontPx * 0.15}px ${themeColor}, 0 0 ${fontPx * 0.35}px ${themeColor};
            }
            .tilt-lyric-char[data-state="normal"] {
              color: var(--text-main);
              text-shadow: none;
            }
          `}
        </style>
        {flatTimings.map((timing, idx) => (
          <span
            key={idx}
            className="tilt-lyric-char"
            ref={el => { charRefs.current[idx] = el; }}
            style={{
              display: 'inline-block',
              willChange: isActive || Math.abs(dist) <= 1 ? 'transform, opacity' : 'auto',
              whiteSpace: timing.text.trim() === '' ? 'pre' : 'normal',
              transformOrigin: 'center center',
              opacity: 0
            }}
            dangerouslySetInnerHTML={{ __html: toRubyHtml(timing.text, showFurigana !== false) }}
          />
        ))}
      </div>

      {showTranslation && line.translation && (
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
  globalOffset = 0,
  showTranslation = true,
  showFurigana = true,
  config = {}
}) {
  const effectiveShowTranslation = config?.showTranslation !== undefined ? config.showTranslation !== false : showTranslation !== false;
  const effectiveShowFurigana = config?.showFurigana !== undefined ? config.showFurigana !== false : showFurigana !== false;

  const displayLines = useMemo(() => {
    if (!lyrics || lyrics.length === 0) return [];
    const start = Math.max(0, activeLineIndex - 3);
    const end = Math.min(lyrics.length - 1, activeLineIndex + 1);
    const lines = [];
    for (let i = start; i <= end; i++) {
      lines.push({
        line: lyrics[i],
        index: i,
        dist: i - activeLineIndex,
        trackIndex: i % 4
      });
    }
    return lines;
  }, [lyrics, activeLineIndex]);

  return (
    <div style={{
      width: '100%',
      height: '100%',
      position: 'relative',
      overflow: 'hidden',
      perspective: '1200px'
    }}>
      {displayLines.map(item => (
        <TiltLyricLine
          key={item.line.id || item.index}
          line={item.line}
          engineRef={engineRef}
          fontPx={fontPx}
          fontStack={fontStack}
          themeColor={themeColor}
          showGlow={showGlow}
          globalOffset={globalOffset}
          trackIndex={item.trackIndex}
          isActive={item.index === activeLineIndex}
          dist={item.dist}
          showTranslation={effectiveShowTranslation}
          showFurigana={effectiveShowFurigana}
        />
      ))}
    </div>
  );
}
