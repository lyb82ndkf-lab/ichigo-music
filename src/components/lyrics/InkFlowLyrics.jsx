import React, { useMemo } from 'react';
import MonetWordSweep from './MonetWordSweep';
import { parseDisplayTokens } from './MonetLyricsEngine';
import ImmersiveAudioVisual from './ImmersiveAudioVisual';

const InkLine = React.memo(function InkLine({ line, index, activeLineIndex, fontPx, translationPx, fontStack, showTranslation, showGlow, glowIntensity }) {
  const status = index === activeLineIndex ? 'active' : index < activeLineIndex ? 'passed' : 'waiting';
  const tokens = useMemo(() => parseDisplayTokens(line), [line]);
  return <div className={`ink-line ink-${status}`}>
    <div className="ink-main" style={{ fontSize: `${fontPx}px`, fontFamily: fontStack }}>
      {tokens.map(token => <MonetWordSweep key={token.key} token={token} fontPx={fontPx} fontStack={fontStack} isChorus={line.isChorus === true} lineRenderEndTime={line.time + (line.duration || 5)} status={status} showGlow={showGlow} glowIntensity={glowIntensity} animationStyle="inkflow" showBase />)}
    </div>
    {showTranslation && line.translation && <div className="ink-translation" style={{ fontSize: `${translationPx}px`, fontFamily: fontStack }}>{line.translation}</div>}
  </div>;
});

export default function InkFlowLyrics({ lyrics = [], activeLineIndex = -1, fontPx = 40, translationPx = 18, fontStack, showTranslation = true, showGlow = true, glowIntensity = 1, spread = 1, opacity = 0.45, speed = 1, accentColor = 'var(--primary)', visualizerStyle = 'circle', visualizerOpacity = 0.82, visualizerSmoothing = 0.16, visualizerOffsetY = 0, visualizerScale = 1, visualizerIntensity = 1, isPlaying = true }) {
  const lines = useMemo(() => {
    if (!lyrics.length) return [];
    const active = Math.max(0, Math.min(lyrics.length - 1, activeLineIndex));
    const start = Math.max(0, active - 2);
    return lyrics.slice(start, Math.min(lyrics.length, active + 3)).map((line, offset) => ({ line, index: start + offset }));
  }, [lyrics, activeLineIndex]);
  return <div className="inkflow-lyrics" style={{ '--ink-accent': accentColor, '--ink-opacity': opacity, '--ink-spread': spread, '--ink-speed': speed }}>
    <ImmersiveAudioVisual variant="inkflow" isPlaying={isPlaying} accentColor={accentColor} intensity={visualizerIntensity} visualizerStyle={visualizerStyle} opacity={visualizerOpacity} smoothing={visualizerSmoothing} offsetY={visualizerOffsetY} scale={visualizerScale} />
    <div className="ink-wash ink-wash-a" /><div className="ink-wash ink-wash-b" /><div className="ink-grain" />
    <div className="ink-lines">{lines.map(({ line, index }) => <InkLine key={`${line.time}-${index}`} line={line} index={index} activeLineIndex={activeLineIndex} fontPx={fontPx} translationPx={translationPx} fontStack={fontStack} showTranslation={showTranslation} showGlow={showGlow} glowIntensity={glowIntensity} />)}</div>
    <style>{`
      .inkflow-lyrics{position:relative;width:100%;height:100%;display:flex;align-items:center;justify-content:center;overflow:hidden;isolation:isolate}
      .inkflow-lyrics .immersive-audio-visual{position:absolute;inset:0;width:100%;height:100%;z-index:0;opacity:.68;pointer-events:none;mix-blend-mode:screen}
      .ink-wash{position:absolute;width:58vmax;height:42vmax;border-radius:48% 52% 55% 45%;background:radial-gradient(ellipse at center,color-mix(in srgb,var(--ink-accent) calc(45% * var(--ink-opacity)),transparent),transparent 68%);filter:blur(calc(34px * var(--ink-spread)));opacity:.65;animation:ink-breathe calc(9s / var(--ink-speed)) ease-in-out infinite alternate;pointer-events:none}
      .ink-wash-a{left:-18%;top:4%;transform:rotate(-18deg)}.ink-wash-b{right:-18%;bottom:0;transform:rotate(22deg);animation-delay:-3s}
      .ink-grain{position:absolute;inset:0;opacity:.08;pointer-events:none;background-image:radial-gradient(rgba(255,255,255,.65) .5px,transparent .7px);background-size:5px 5px;mix-blend-mode:screen}
      .ink-lines{position:relative;z-index:1;width:min(92%,980px);display:flex;flex-direction:column;align-items:center;gap:25px;text-align:center}
      .ink-line{max-width:100%;display:flex;flex-direction:column;align-items:center;gap:6px;transition:opacity .5s ease,transform .6s cubic-bezier(.2,.8,.2,1),filter .5s ease}.ink-main{max-width:100%;line-height:1.14;font-weight:700;overflow-wrap:anywhere;word-break:normal}.ink-translation{color:var(--text-muted);line-height:1.25;overflow-wrap:anywhere;word-break:normal}
      .ink-active{opacity:1;transform:scale(1.05);filter:none}.ink-active .ink-main{color:var(--ink-accent);text-shadow:0 0 26px color-mix(in srgb,var(--ink-accent) 48%,transparent)}.ink-passed,.ink-waiting{opacity:.23;filter:blur(1.5px)}.ink-passed{transform:translateY(-14px) scale(.92)}.ink-waiting{transform:translateY(14px) scale(.92)}
      @keyframes ink-breathe{from{transform:translate3d(-3%,2%,0) scale(.92) rotate(-18deg)}to{transform:translate3d(4%,-3%,0) scale(1.1) rotate(-10deg)}}
      @media(prefers-reduced-motion:reduce){.ink-wash{animation:none}.ink-line{transition:none}}
    `}</style>
  </div>;
}


