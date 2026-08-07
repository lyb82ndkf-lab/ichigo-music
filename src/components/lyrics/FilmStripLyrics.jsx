import React, { useMemo } from 'react';
import MonetWordSweep from './MonetWordSweep';
import { parseDisplayTokens } from './MonetLyricsEngine';
import ImmersiveAudioVisual from './ImmersiveAudioVisual';

function FilmLine({ line, index, activeLineIndex, fontPx, translationPx, fontStack, showTranslation, showGlow, glowIntensity }) {
  const status = index === activeLineIndex ? 'active' : index < activeLineIndex ? 'passed' : 'waiting';
  const tokens = useMemo(() => parseDisplayTokens(line), [line]);
  return <div className={`film-frame film-${status}`}>
    <div className="film-frame-caption">{String(index + 1).padStart(2, '0')}</div>
    <div className="film-main" style={{ fontSize: `${fontPx}px`, fontFamily: fontStack }}>
      {tokens.map(token => <MonetWordSweep key={token.key} token={token} fontPx={fontPx} fontStack={fontStack} isChorus={line.isChorus === true} lineRenderEndTime={line.time + (line.duration || 5)} status={status} showGlow={showGlow} glowIntensity={glowIntensity} animationStyle="filmstrip" showBase />)}
    </div>
    {showTranslation && line.translation && <div className="film-translation" style={{ fontSize: `${translationPx}px`, fontFamily: fontStack }}>{line.translation}</div>}
  </div>;
}

export default function FilmStripLyrics({ lyrics = [], activeLineIndex = -1, fontPx = 36, translationPx = 17, fontStack, showTranslation = true, showGlow = true, glowIntensity = 1, frameGap = 18, filmOpacity = 0.22, activeScale = 1.08, accentColor = 'var(--primary)', visualizerStyle = 'circle', visualizerOpacity = 0.82, visualizerSmoothing = 0.16, visualizerOffsetY = 0, visualizerScale = 1, visualizerIntensity = 1 }) {
  const frames = useMemo(() => {
    if (!lyrics.length) return [];
    const active = Math.max(0, Math.min(lyrics.length - 1, activeLineIndex));
    const start = Math.max(0, active - 1);
    return lyrics.slice(start, Math.min(lyrics.length, active + 3)).map((line, offset) => ({ line, index: start + offset }));
  }, [lyrics, activeLineIndex]);
  return <div className="filmstrip-lyrics" style={{ '--film-accent': accentColor, '--film-gap': `${frameGap}px`, '--film-dim': filmOpacity, '--film-active-scale': activeScale }}>
    <ImmersiveAudioVisual variant="filmstrip" accentColor={accentColor} intensity={visualizerIntensity} visualizerStyle={visualizerStyle} opacity={visualizerOpacity} smoothing={visualizerSmoothing} offsetY={visualizerOffsetY} scale={visualizerScale} />
    <div className="film-perforations film-perforations-top" aria-hidden="true" />
    <div className="film-track">{frames.map(({ line, index }) => <FilmLine key={`${line.time}-${index}`} line={line} index={index} activeLineIndex={activeLineIndex} fontPx={fontPx} translationPx={translationPx} fontStack={fontStack} showTranslation={showTranslation} showGlow={showGlow} glowIntensity={glowIntensity} />)}</div>
    <div className="film-perforations film-perforations-bottom" aria-hidden="true" />
    <style>{`
      .filmstrip-lyrics{position:relative;width:100%;height:100%;display:flex;align-items:center;justify-content:center;overflow:hidden;background:linear-gradient(90deg,rgba(0,0,0,.2),transparent 18%,transparent 82%,rgba(0,0,0,.2));isolation:isolate}
      .filmstrip-lyrics .immersive-audio-visual{position:absolute;inset:0;width:100%;height:100%;z-index:0;opacity:.72;pointer-events:none;mix-blend-mode:screen}
      .film-track{position:relative;z-index:1;width:min(94%,1080px);display:flex;flex-direction:column;align-items:center;gap:var(--film-gap);text-align:center}
      .film-frame{position:relative;max-width:100%;min-width:44%;padding:12px 28px 14px;border:1px solid color-mix(in srgb,var(--film-accent) 18%,transparent);background:linear-gradient(90deg,rgba(255,255,255,.035),rgba(255,255,255,.015));transition:opacity .48s ease,transform .58s cubic-bezier(.2,.8,.2,1),filter .48s ease,border-color .48s ease;overflow:hidden}
      .film-frame:before,.film-frame:after{content:"";position:absolute;left:0;right:0;height:3px;background:repeating-linear-gradient(90deg,transparent 0 12px,color-mix(in srgb,var(--film-accent) 45%,transparent) 12px 20px,transparent 20px 32px);opacity:.45}
      .film-frame:before{top:0}.film-frame:after{bottom:0}
      .film-frame-caption{position:absolute;top:7px;right:12px;color:var(--text-muted);font:600 10px/1 var(--font-mono,monospace);opacity:.7}
      .film-main{line-height:1.16;font-weight:700;overflow-wrap:anywhere;word-break:normal}.film-translation{margin-top:6px;color:var(--text-muted);line-height:1.25;overflow-wrap:anywhere;word-break:normal}
      .film-active{opacity:1;transform:scale(var(--film-active-scale));border-color:color-mix(in srgb,var(--film-accent) 55%,transparent);box-shadow:0 0 28px color-mix(in srgb,var(--film-accent) 16%,transparent)}.film-active .film-main{color:var(--film-accent);text-shadow:0 0 20px color-mix(in srgb,var(--film-accent) 45%,transparent)}
      .film-passed,.film-waiting{opacity:var(--film-dim);filter:blur(1px) saturate(.7)}.film-passed{transform:translateX(-24px) scale(.9)}.film-waiting{transform:translateX(24px) scale(.9)}
      .film-perforations{position:absolute;left:0;right:0;height:16px;z-index:2;opacity:.7;background:repeating-linear-gradient(90deg,transparent 0 9px,rgba(255,255,255,.16) 9px 24px,transparent 24px 34px);pointer-events:none}.film-perforations-top{top:8%}.film-perforations-bottom{bottom:8%}
      @media(prefers-reduced-motion:reduce){.film-frame{transition:none}}
    `}</style>
  </div>;
}


