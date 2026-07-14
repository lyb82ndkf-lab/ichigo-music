import React, { useMemo, useRef, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { parseDisplayTokens } from './MonetLyricsEngine';

const VinylTimedText = React.memo(({ line, isActive, isPassed, engineRef, globalOffset, fontPx, themeColor }) => {
  const tokens = useMemo(() => parseDisplayTokens(line), [line]);
  const tokenRefs = useRef([]);

  useEffect(() => {
    tokenRefs.current = tokenRefs.current.slice(0, tokens.length);
  }, [tokens]);

  useEffect(() => {
    if (!isActive) return undefined;

    let animationId;
    const update = () => {
      const currentTime = (engineRef.current?.getCurrentTime?.() || 0) + globalOffset;

      tokens.forEach((token, index) => {
        const el = tokenRefs.current[index];
        if (!el) return;

        if (!token.timed || currentTime >= token.endTime) {
          el.style.color = themeColor;
          el.style.opacity = '1';
          el.style.transform = 'translateY(0) scale(1)';
          el.style.textShadow = `0 0 ${fontPx * 0.35}px ${themeColor}`;
        } else if (currentTime >= token.startTime) {
          const progress = Math.max(0, Math.min(1, (currentTime - token.startTime) / Math.max(0.001, token.endTime - token.startTime)));
          const pulse = Math.sin(progress * Math.PI);
          el.style.color = themeColor;
          el.style.opacity = `${0.72 + progress * 0.28}`;
          el.style.transform = `translateY(${-fontPx * 0.08 * pulse}px) scale(${1 + 0.12 * pulse})`;
          el.style.textShadow = `0 0 ${fontPx * (0.28 + progress * 0.32)}px ${themeColor}`;
        } else {
          el.style.color = 'var(--text-main)';
          el.style.opacity = '0.38';
          el.style.transform = 'translateY(0) scale(1)';
          el.style.textShadow = 'none';
        }
      });

      animationId = requestAnimationFrame(update);
    };

    update();
    return () => cancelAnimationFrame(animationId);
  }, [isActive, tokens, engineRef, globalOffset, fontPx, themeColor]);

  if (!isActive) {
    return <>{line.text}</>;
  }

  return (
    <>
      {tokens.map((token, index) => (
        <span
          key={token.key}
          ref={el => { tokenRefs.current[index] = el; }}
          style={{
            display: 'inline-block',
            whiteSpace: 'pre',
            color: isPassed ? themeColor : 'var(--text-main)',
            opacity: isPassed ? 1 : 0.38,
            transform: 'translateY(0) scale(1)',
            transition: 'opacity 0.18s ease, transform 0.18s ease, color 0.18s ease, text-shadow 0.18s ease',
            willChange: 'opacity, transform, color'
          }}
        >
          {token.text}
        </span>
      ))}
    </>
  );
});

export default function VinylRecordLyrics({ 
  lyrics = [], 
  activeLineIndex = -1, 
  engineRef,
  fontPx = 36, 
  fontStack, 
  themeColor, 
  coverUrl, 
  isPlaying,
  globalOffset = 0,
  lineSpacing = 0.7,
  tiltAngle = 0
}) {
  const containerRef = useRef(null);
  const grooveCanvasRef = useRef(null);
  const { advancedLyricConfig } = useApp();

  // Center of rotation logic
  // The disc is on the left, so we set transformOrigin far to the left.
  const rotationRadius = 60; // vw

  // Render pulsing concentric groove lines and stylus contact points on vinyl disc
  useEffect(() => {
    const canvas = grooveCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animId;
    let smoothedData = [];

    const draw = () => {
      animId = requestAnimationFrame(draw);
      
      const analyser = window.ichigoAnalyser;
      let dataArray = null;
      let bufferLength = 128;
      if (analyser) {
        bufferLength = analyser.frequencyBinCount;
        dataArray = new Uint8Array(bufferLength);
        analyser.getByteFrequencyData(dataArray);
      } else {
        dataArray = new Uint8Array(bufferLength);
      }

      if (smoothedData.length !== bufferLength) {
        smoothedData = new Array(bufferLength).fill(0);
      }

      const upSmooth = 1 - (advancedLyricConfig?.vinylSmoothing ?? 0.25);
      for (let i = 0; i < bufferLength; i++) {
        smoothedData[i] += ((dataArray[i] || 0) - smoothedData[i]) * upSmooth;
      }

      const width = canvas.offsetWidth;
      const height = canvas.offsetHeight;
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      ctx.clearRect(0, 0, width, height);

      const cx = width / 2;
      const cy = height / 2;
      const discRadius = width / 2;

      const grooveCount = advancedLyricConfig?.vinylGrooveCount ?? 12;
      const baseWidth = advancedLyricConfig?.vinylGrooveWidth ?? 1.0;
      const maxWidth = advancedLyricConfig?.vinylGrooveMaxWidth ?? 4.0;
      const opacity = advancedLyricConfig?.vinylGrooveOpacity ?? 0.6;
      const colorMode = advancedLyricConfig?.vinylGrooveColorMode || 'theme';
      const resolvedColor = colorMode === 'theme' ? themeColor : 'rgba(255, 255, 255, 0.4)';

      ctx.globalAlpha = opacity;
      ctx.strokeStyle = resolvedColor;
      
      // Draw concentric groove rings
      const sampleSpan = bufferLength / grooveCount;
      for (let i = 0; i < grooveCount; i++) {
        const val = smoothedData[Math.floor(i * sampleSpan)] || 0;
        const startRad = discRadius * 0.23;
        const endRad = discRadius * 0.92;
        const ringRad = startRad + (i / (grooveCount - 1)) * (endRad - startRad);
        
        ctx.lineWidth = baseWidth + (val / 255) * (maxWidth - baseWidth);
        ctx.beginPath();
        ctx.arc(cx, cy, ringRad, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Draw reflective highlights if configured
      if (advancedLyricConfig?.vinylEdgeReflection !== false) {
        const reflectionVal = advancedLyricConfig?.vinylEdgeReflectionIntensity ?? 0.5;
        const highVal = smoothedData[Math.floor(bufferLength * 0.85)] || 0;
        
        const grad = ctx.createConicGradient(Math.PI / 4, cx, cy);
        grad.addColorStop(0, 'rgba(255,255,255,0)');
        grad.addColorStop(0.2, `rgba(255,255,255,${0.08 * reflectionVal * (1 + highVal / 255)})`);
        grad.addColorStop(0.4, 'rgba(255,255,255,0)');
        grad.addColorStop(0.5, 'rgba(255,255,255,0)');
        grad.addColorStop(0.7, `rgba(255,255,255,${0.08 * reflectionVal * (1 + highVal / 255)})`);
        grad.addColorStop(0.9, 'rgba(255,255,255,0)');
        
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx, cy, discRadius * 0.95, 0, Math.PI * 2);
        ctx.fill();
      }

      // Stylus touch-point glow
      const stylusGlow = advancedLyricConfig?.vinylStylusGlowStrength ?? 0.7;
      if (stylusGlow > 0) {
        const stylusSize = advancedLyricConfig?.vinylStylusGlowSize ?? 20;
        const stylusAngle = -Math.PI / 4; 
        const stylusRad = discRadius * 0.82;
        const sx = cx + Math.cos(stylusAngle) * stylusRad;
        const sy = cy + Math.sin(stylusAngle) * stylusRad;
        
        const highVal = smoothedData[Math.floor(bufferLength * 0.7)] || 0;
        const currentSize = stylusSize * (0.65 + (highVal / 255) * 0.8);
        
        const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, currentSize);
        grad.addColorStop(0, themeColor || '#ff3366');
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        
        ctx.save();
        ctx.globalAlpha = stylusGlow * (0.55 + (highVal / 255) * 0.45);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(sx, sy, currentSize, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      
      ctx.globalAlpha = 1.0;
    };

    draw();

    return () => cancelAnimationFrame(animId);
  }, [isPlaying, themeColor, advancedLyricConfig]);

  return (
    <div 
      ref={containerRef}
      style={{ 
        width: '100%', 
        height: '100%', 
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '4vw',
        padding: '0 4vw',
        perspective: '1200px'
      }}
    >
      <style>
        {`
          @keyframes spin-vinyl {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          
          .vinyl-wrapper {
            position: relative;
            width: clamp(200px, 30vw, 450px);
            aspect-ratio: 1;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
            z-index: 2;
          }
          
          .vinyl-disc {
            width: 100%;
            height: 100%;
            border-radius: 50%;
            background: #111;
            box-shadow: 0 30px 60px rgba(0,0,0,0.7), inset 0 0 20px rgba(0,0,0,0.9);
            border: 4px solid #222;
            position: absolute;
            display: flex;
            align-items: center;
            justify-content: center;
            animation: spin-vinyl 12s linear infinite;
            animation-play-state: ${isPlaying ? 'running' : 'paused'};
          }
          
          .vinyl-grooves {
            position: absolute;
            inset: 2px;
            border-radius: 50%;
            background: repeating-radial-gradient(
              #111,
              #111 2px,
              #222 4px,
              #111 6px
            );
            opacity: 0.6;
          }
          
          .vinyl-shine {
            position: absolute;
            inset: 0;
            border-radius: 50%;
            background: conic-gradient(
              from 45deg,
              rgba(255, 255, 255, 0) 0%,
              rgba(255, 255, 255, 0.15) 10%,
              rgba(255, 255, 255, 0) 20%,
              rgba(255, 255, 255, 0) 50%,
              rgba(255, 255, 255, 0.15) 60%,
              rgba(255, 255, 255, 0) 70%
            );
            z-index: 2;
            pointer-events: none;
            mix-blend-mode: screen;
          }
          
          .vinyl-label {
            width: 42%;
            aspect-ratio: 1;
            border-radius: 50%;
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            overflow: hidden;
            border: 3px solid #000;
            z-index: 3;
            box-shadow: 0 0 10px rgba(0,0,0,0.8);
          }
          
          .vinyl-label img {
            width: 100%;
            height: 100%;
            object-fit: cover;
          }
          
          .vinyl-hole {
            width: 5%;
            aspect-ratio: 1;
            border-radius: 50%;
            background: #fff;
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            box-shadow: inset 0 2px 5px rgba(0,0,0,0.8);
            z-index: 4;
            border: 1px solid #ddd;
          }
          
          .vinyl-lyrics-container {
            flex: 1.5;
            height: 85%;
            max-width: 900px;
            position: relative;
            display: flex;
            flex-direction: column;
            justify-content: center;
            overflow: hidden;
            mask-image: linear-gradient(to bottom, transparent, black 25%, black 75%, transparent);
            -webkit-mask-image: linear-gradient(to bottom, transparent, black 25%, black 75%, transparent);
            transform-style: preserve-3d;
            transform: rotateY(${tiltAngle}deg);
            transition: transform 0.5s ease;
          }
        `}
      </style>

      {/* LEFT: Premium Spinning Vinyl */}
      <div className="vinyl-wrapper">
        <div className="vinyl-disc">
          <div className="vinyl-grooves" />
          <canvas ref={grooveCanvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', borderRadius: '50%', pointerEvents: 'none', zIndex: 2 }} />
          <div className="vinyl-label">
            <img src={coverUrl} alt="Album Art" />
          </div>
          <div className="vinyl-hole" />
        </div>
        <div className="vinyl-shine" />
      </div>

      {/* RIGHT: Arc-Rotating Lyrics */}
      <div className="vinyl-lyrics-container">
        <div style={{ position: 'relative', height: '100%', width: '100%', transformStyle: 'preserve-3d' }}>
          {lyrics.map((line, i) => {
            const isActive = i === activeLineIndex;
            const isPassed = i < activeLineIndex;
            const dist = i - activeLineIndex;
            
            if (Math.abs(dist) > 12) return null;
            
            const anglePerLine = 12 * lineSpacing; 
            const rotation = dist * anglePerLine;
            
            return (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: '10%', 
                  width: '100%',
                  fontFamily: '"Georgia", "Times New Roman", serif, "Noto Sans SC"',
                  fontSize: `${fontPx * (isActive ? 1.1 : 0.85)}px`,
                  fontWeight: isActive ? 700 : 400,
                  color: isActive ? themeColor : 'var(--text-main)',
                  opacity: isActive ? 1 : (isPassed ? 0.3 : 0.5),
                  transformOrigin: `-${rotationRadius}vw center`,
                  transform: `translateY(-50%) rotate(${rotation}deg) scale(${isActive ? 1 : 0.95})`,
                  transition: 'transform 0.7s cubic-bezier(0.25, 0.8, 0.25, 1), opacity 0.7s ease, color 0.7s ease, font-size 0.7s ease',
                  filter: isActive ? `drop-shadow(0 0 15px ${themeColor})` : 'none',
                  zIndex: isActive ? 10 : 1,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                  letterSpacing: '1px'
                }}
              >
                <div style={{ fontStyle: isActive ? 'italic' : 'normal', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  <VinylTimedText
                    line={line}
                    isActive={isActive}
                    isPassed={isPassed}
                    engineRef={engineRef}
                    globalOffset={globalOffset}
                    fontPx={fontPx}
                    themeColor={themeColor}
                  />
                </div>
                {line.translation && (
                  <div style={{ 
                    fontSize: `${fontPx * 0.45}px`, 
                    opacity: 0.7, 
                    fontFamily: fontStack, 
                    letterSpacing: '0',
                    fontStyle: 'normal',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word'
                  }}>
                    {line.translation}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
