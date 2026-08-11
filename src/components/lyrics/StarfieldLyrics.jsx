import React, { useMemo } from 'react';
import MonetWordSweep from './MonetWordSweep';
import { parseDisplayTokens } from './MonetLyricsEngine';
import ImmersiveAudioVisual from './ImmersiveAudioVisual';

function makeStars(count) {
  return Array.from({ length: count }, (_, index) => ({
    id: index,
    x: (index * 47.31) % 100,
    y: (index * 71.17) % 100,
    size: 1 + ((index * 13) % 4),
    opacity: 0.2 + ((index * 17) % 60) / 100,
    delay: -((index * 0.37) % 6)
  }));
}

const StarLine = React.memo(function StarLine({ line, index, activeLineIndex, fontPx, translationPx, fontStack, showTranslation, showGlow, glowIntensity }) {
  const status = index === activeLineIndex ? 'active' : index < activeLineIndex ? 'passed' : 'waiting';
  const tokens = useMemo(() => parseDisplayTokens(line), [line]);
  return <div className={`star-line star-${status}`}>
    <div className="star-main" style={{ fontSize: `${fontPx}px`, fontFamily: fontStack }}>
      {tokens.map(token => <MonetWordSweep key={token.key} token={token} fontPx={fontPx} fontStack={fontStack} isChorus={line.isChorus === true} lineRenderEndTime={line.time + (line.duration || 5)} status={status} showGlow={showGlow} glowIntensity={glowIntensity} animationStyle="starfield" showBase />)}
    </div>
    {showTranslation && line.translation && <div className="star-translation" style={{ fontSize: `${translationPx}px`, fontFamily: fontStack }}>{line.translation}</div>}
  </div>;
});

export default function StarfieldLyrics({ lyrics = [], activeLineIndex = -1, fontPx = 38, translationPx = 18, fontStack, showTranslation = true, showGlow = true, glowIntensity = 1, density = 42, speed = 1, depth = 1, accentColor = 'var(--primary)', visualizerStyle = 'circle', visualizerOpacity = 0.82, visualizerSmoothing = 0.16, visualizerOffsetY = 0, visualizerScale = 1, visualizerIntensity = 1, isPlaying = true }) {
  const stars = useMemo(() => makeStars(Math.max(12, Math.min(120, density))), [density]);
  const lines = useMemo(() => {
    if (!lyrics.length) return [];
    const active = Math.max(0, Math.min(lyrics.length - 1, activeLineIndex));
    const start = Math.max(0, active - 2);
    return lyrics.slice(start, Math.min(lyrics.length, active + 3)).map((line, offset) => ({ line, index: start + offset }));
  }, [lyrics, activeLineIndex]);
  return <div className="starfield-lyrics" style={{ '--star-accent': accentColor, '--star-speed': Math.max(0.2, speed), '--star-depth': depth }}>
    <ImmersiveAudioVisual variant="starfield" isPlaying={isPlaying} accentColor={accentColor} intensity={visualizerIntensity} visualizerStyle={visualizerStyle} opacity={visualizerOpacity} smoothing={visualizerSmoothing} offsetY={visualizerOffsetY} scale={visualizerScale} />
    <div className="starfield-background" aria-hidden="true">{stars.map(star => <i key={star.id} style={{ left: `${star.x}%`, top: `${star.y}%`, width: `${star.size}px`, height: `${star.size}px`, opacity: star.opacity, animationDelay: `${star.delay}s` }} />)}</div>
    <div className="starfield-lines">{lines.map(({ line, index }) => <StarLine key={`${line.time}-${index}`} line={line} index={index} activeLineIndex={activeLineIndex} fontPx={fontPx} translationPx={translationPx} fontStack={fontStack} showTranslation={showTranslation} showGlow={showGlow} glowIntensity={glowIntensity} />)}</div>
    <style>{`
      .starfield-lyrics{position:relative;width:100%;height:100%;display:flex;align-items:center;justify-content:center;overflow:hidden;isolation:isolate}
      .starfield-lyrics .immersive-audio-visual{position:absolute;inset:0;width:100%;height:100%;z-index:0;opacity:.82;pointer-events:none;mix-blend-mode:screen}
      .starfield-background{position:absolute;inset:0;overflow:hidden;pointer-events:none;background:radial-gradient(circle at 50% 48%,color-mix(in srgb,var(--star-accent) 15%,transparent),transparent 52%)}
      .starfield-background i{position:absolute;border-radius:50%;background:var(--star-accent);box-shadow:0 0 9px var(--star-accent);animation:star-drift calc(7s / (var(--star-depth) * var(--star-speed))) ease-in-out infinite alternate}
      .starfield-lines{position:relative;z-index:1;width:min(92%,1000px);display:flex;flex-direction:column;align-items:center;gap:24px;text-align:center}
      .star-line{max-width:100%;display:flex;flex-direction:column;align-items:center;gap:5px;transition:opacity .5s ease,transform .6s cubic-bezier(.2,.8,.2,1),filter .5s ease}
      .star-main{max-width:100%;line-height:1.16;font-weight:700;overflow-wrap:anywhere;word-break:normal}
      .star-translation{max-width:100%;color:var(--text-muted);line-height:1.25;overflow-wrap:anywhere;word-break:normal}
      .star-active{opacity:1;transform:scale(1.06);filter:none}.star-active .star-main{color:var(--star-accent);text-shadow:0 0 22px color-mix(in srgb,var(--star-accent) 55%,transparent)}
      .star-passed,.star-waiting{opacity:.22;filter:blur(1.4px)}.star-passed{transform:translateX(-18px) scale(.9)}.star-waiting{transform:translateX(18px) scale(.9)}
      @keyframes star-drift{from{transform:translate3d(-5px,4px,0) scale(.8)}to{transform:translate3d(5px,-4px,0) scale(1.25)}}
      @media(prefers-reduced-motion:reduce){.starfield-background i{animation:none}.star-line{transition:none}}
    `}</style>
  </div>;
}


