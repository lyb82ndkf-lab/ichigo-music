import React, { useEffect, useRef } from 'react';

export default function MonetFloatingDecor({ isPlaying = true, currentSong = null, advancedLyricConfig = {} } = {}) {
  const canvasRef = useRef(null);
  const playingRef = useRef(isPlaying);
  const wakeRef = useRef(null);

  useEffect(() => {
    playingRef.current = isPlaying;
    wakeRef.current?.();
  }, [isPlaying]);

  const configRef = useRef(advancedLyricConfig);
  useEffect(() => {
    configRef.current = advancedLyricConfig;
  }, [advancedLyricConfig]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animationId = 0;
    let idleTimer = 0;
    let idleCleared = false;
    let particles = [];
    let meteors = [];
    
    // Parse CSS color
    let themeColor = '#ffffff';
    const updateThemeColor = () => {
      const col = getComputedStyle(document.body).getPropertyValue('--primary').trim();
      if (col) themeColor = col;
    };
    updateThemeColor();

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', resize);
    resize();

    // Init slow particles
    const initParticleCount = configRef.current?.decorParticleAmount ?? 40;
    for (let i = 0; i < initParticleCount; i++) {
      particles.push(createParticle(canvas));
    }

    let lastTime = performance.now();
    let lastFrameTime = 0;
    let frameCount = 0;
    let burstCooldown = 0;
    let analyserBuffer = null;

    function createParticle(cvs, isBurst = false) {
      const sizeVal = configRef.current?.decorSize ?? 1.0;
      const opacityVal = configRef.current?.decorOpacity ?? 0.6;
      return {
        x: isBurst ? cvs.width / 2 : Math.random() * cvs.width,
        y: isBurst ? cvs.height / 2 : Math.random() * cvs.height,
        vx: isBurst ? (Math.random() - 0.5) * 10 : (Math.random() - 0.5) * 0.5,
        vy: isBurst ? (Math.random() - 0.5) * 10 : (Math.random() - 0.5) * 0.5,
        size: isBurst ? Math.random() * 3 + 1 : (Math.random() * 2 + 0.5) * sizeVal,
        alpha: isBurst ? 1 : (Math.random() * 0.5 + 0.1) * (opacityVal / 0.6),
        life: isBurst ? 1 : Math.random() * 0.5 + 0.5,
        decay: isBurst ? Math.random() * 0.02 + 0.01 : 0
      };
    }

    function hexToRgba(hex, alpha) {
      let r = 255, g = 255, b = 255;
      if (hex.startsWith('#')) {
        const hexStr = hex.slice(1);
        if (hexStr.length === 3) {
          r = parseInt(hexStr[0]+hexStr[0], 16);
          g = parseInt(hexStr[1]+hexStr[1], 16);
          b = parseInt(hexStr[2]+hexStr[2], 16);
        } else if (hexStr.length === 6) {
          r = parseInt(hexStr.substring(0,2), 16);
          g = parseInt(hexStr.substring(2,4), 16);
          b = parseInt(hexStr.substring(4,6), 16);
        }
      } else if (hex.startsWith('rgb')) {
        const match = hex.match(/\d+/g);
        if (match && match.length >= 3) {
          r = parseInt(match[0]); g = parseInt(match[1]); b = parseInt(match[2]);
        }
      }
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    const scheduleIdle = () => {
      if (idleTimer) return;
      idleTimer = window.setTimeout(() => {
        idleTimer = 0;
        if (playingRef.current && !document.hidden) {
          animationId = requestAnimationFrame(draw);
        }
      }, 300);
    };
    const wake = () => {
      if (idleTimer) {
        window.clearTimeout(idleTimer);
        idleTimer = 0;
      }
      if (!animationId && playingRef.current && !document.hidden) {
        animationId = requestAnimationFrame(draw);
      }
    };
    wakeRef.current = wake;

    const draw = (time) => {
      animationId = 0;
      if (document.hidden || !playingRef.current) {
        if (!idleCleared) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          idleCleared = true;
        }
        scheduleIdle();
        return;
      }
      idleCleared = false;
      animationId = requestAnimationFrame(draw);
      if (time - lastFrameTime < 1000 / 30) return;
      lastFrameTime = time;
      // Cap dt to max 2 frames worth — prevents giant leap when app returns from background
      const rawDt = (time - lastTime) / 16.66;
      const dt = Math.min(rawDt, 2.0);
      lastTime = time;
      frameCount++;

      if (frameCount % 60 === 0) updateThemeColor();

      // Clear
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const analyser = window.ichigoAnalyser;
      let dataArray = null;
      let bassAvg = 0;

      if (analyser) {
        if (!analyserBuffer || analyserBuffer.length !== analyser.frequencyBinCount) {
          analyserBuffer = new Uint8Array(analyser.frequencyBinCount);
        }
        analyser.getByteFrequencyData(analyserBuffer);

        let bassSum = 0;
        for (let i = 0; i < Math.min(10, analyserBuffer.length); i++) bassSum += analyserBuffer[i];
        bassAvg = bassSum / 10;

        const enableTwinkleBurst = configRef.current?.decorTwinkle === true;
        if (enableTwinkleBurst) {
          if (burstCooldown > 0) burstCooldown -= dt;
          if (bassAvg > 220 && burstCooldown <= 0) {
            burstCooldown = 30; // ~0.5s cooldown
            for (let i = 0; i < 30; i++) {
              meteors.push(createParticle(canvas, true));
            }
          }
        }
      }

      // Draw normal particles
      const speedVal = configRef.current?.decorSpeed ?? 1.0;
      ctx.fillStyle = hexToRgba(themeColor, 1);
      particles.forEach(p => {
        p.x += Math.sin(time * 0.001 * speedVal + p.size) * 0.5 * speedVal * dt;
        p.y -= 0.2 * speedVal * dt;

        if (p.y < -10) p.y = canvas.height + 10;
        if (p.x < -10) p.x = canvas.width + 10;
        if (p.x > canvas.width + 10) p.x = -10;

        ctx.globalAlpha = p.alpha;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      });

      // Maintain particle count if settings changed
      const targetCount = Math.min(configRef.current?.decorParticleAmount ?? 40, 80);
      if (particles.length < targetCount) {
        particles.push(createParticle(canvas));
      } else if (particles.length > targetCount) {
        particles.pop();
      }

      // Draw meteors
      for (let i = meteors.length - 1; i >= 0; i--) {
        const m = meteors[i];
        m.x += m.vx * dt;
        m.y += m.vy * dt;
        m.life -= m.decay * dt;

        if (m.life <= 0) {
          meteors.splice(i, 1);
          continue;
        }

        ctx.globalAlpha = m.life;
        ctx.beginPath();
        ctx.arc(m.x, m.y, m.size, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(m.x, m.y);
        ctx.lineTo(m.x - m.vx * 3, m.y - m.vy * 3);
        ctx.strokeStyle = hexToRgba(themeColor, m.life);
        ctx.lineWidth = m.size;
        ctx.stroke();
      }
      
      ctx.globalAlpha = 1.0;
    };

    wake();

    // When the window becomes visible again after being hidden (app switched to background),
    // reset lastTime so dt doesn't spike to a huge value on the first resumed frame.
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        lastTime = performance.now();
        wake();
      } else if (animationId) {
        window.cancelAnimationFrame(animationId);
        animationId = 0;
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.cancelAnimationFrame(animationId);
      window.clearTimeout(idleTimer);
      if (wakeRef.current === wake) wakeRef.current = null;
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const watermarkText = currentSong ? `${currentSong.artist} - ${currentSong.title}` : 'ICHIGOMusic';

  return (
    <div 
      className="monet-floating-decor"
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 1,
        overflow: 'hidden'
      }}
    >
      <style>
        {`
          @keyframes monet-watermark-pan {
            0% { transform: translateX(10%) translateY(-50%) rotate(-5deg); }
            50% { transform: translateX(-10%) translateY(-50%) rotate(-5deg); }
            100% { transform: translateX(10%) translateY(-50%) rotate(-5deg); }
          }
        `}
      </style>
      
      <div 
        style={{
          position: 'absolute',
          top: '50%',
          left: 0,
          right: 0,
          whiteSpace: 'nowrap',
          fontSize: 'clamp(10rem, 20vw, 30rem)',
          fontWeight: 900,
          color: 'var(--primary)',
          opacity: 0.03, // Extremely faint
          zIndex: 0,
          fontFamily: 'Inter, sans-serif',
          letterSpacing: '-0.05em',
          animation: 'monet-watermark-pan 60s ease-in-out infinite',
          filter: 'blur(4px)'
        }}
      >
        {watermarkText.toUpperCase()}
      </div>

      <canvas 
        ref={canvasRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          zIndex: 1
        }}
      />
    </div>
  );
}
