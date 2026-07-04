import React, { useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';

function adjustAlpha(color, opacity) {
  if (!color) return `rgba(255, 51, 102, ${opacity})`;
  color = color.trim();
  if (color.startsWith('#')) {
    const hex = color.slice(1);
    const r = parseInt(hex.length === 3 ? hex[0]+hex[0] : hex.slice(0, 2), 16);
    const g = parseInt(hex.length === 3 ? hex[1]+hex[1] : hex.slice(2, 4), 16);
    const b = parseInt(hex.length === 3 ? hex[2]+hex[2] : hex.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  }
  if (color.startsWith('rgb')) {
    const matches = color.match(/\d+/g);
    if (matches && matches.length >= 3) {
      return `rgba(${matches[0]}, ${matches[1]}, ${matches[2]}, ${opacity})`;
    }
  }
  if (color.startsWith('hsl')) {
    const matches = color.match(/[\d.]+/g);
    if (matches && matches.length >= 3) {
      return `hsla(${matches[0]}, ${matches[1]}%, ${matches[2]}%, ${opacity})`;
    }
  }
  return color;
}

export default function Visualizer() {
  const canvasRef = useRef(null);
  const { visualizerMode, isPlaying, theme, customThemeColors, visualizerConfig } = useApp();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let animationId;

    // Set canvas dimensions
    const resizeCanvas = () => {
      const rect = canvas.parentElement.getBoundingClientRect();
      canvas.width = rect.width * window.devicePixelRatio;
      canvas.height = rect.height * window.devicePixelRatio;
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      // Reset transform before scaling to avoid exponential accumulation on resize
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Advanced Particle System Pool
    const particles = [];
    const maxParticles = 120;
    
    // Create initial particle field
    for (let i = 0; i < maxParticles; i++) {
      particles.push(createParticle());
    }

    function createParticle(burst = false, angle = null, speedMultiplier = 1) {
      const pAngle = angle !== null ? angle : Math.random() * Math.PI * 2;
      const distance = burst ? Math.random() * 20 : Math.random() * 200 + 40;
      
      return {
        x: Math.cos(pAngle) * distance,
        y: Math.sin(pAngle) * distance,
        radius: Math.random() * 2 + (burst ? 1.5 : 0.8),
        angle: pAngle,
        speed: (Math.random() * 1.2 + 0.4) * speedMultiplier,
        orbitSpeed: (Math.random() - 0.5) * 0.015,
        alpha: Math.random() * 0.7 + 0.3,
        colorHue: Math.random() * 30 - 15, // hue offset from primary
        decay: burst ? Math.random() * 0.015 + 0.008 : 0,
        isBurst: burst
      };
    }

    // Colors based on current theme
    const getThemeColors = () => {
      const userColor = visualizerConfig?.color;
      const styles = getComputedStyle(document.body);
      const textMuted = styles.getPropertyValue('--text-muted').trim() || 'rgba(255, 255, 255, 0.4)';
      const glassBgStrong = styles.getPropertyValue('--glass-bg-strong').trim() || 'rgba(255, 255, 255, 0.15)';

      if (userColor && !userColor.startsWith('var')) {
        return {
          primary: userColor,
          glow: adjustAlpha(userColor, 0.3),
          hueBase: extractHue(userColor),
          textMuted,
          glassBgStrong
        };
      }

      if (theme === 'custom') {
        return {
          primary: customThemeColors.primary,
          glow: adjustAlpha(customThemeColors.primary, 0.3),
          hueBase: extractHue(customThemeColors.primary),
          textMuted,
          glassBgStrong
        };
      }
      const primary = styles.getPropertyValue('--primary').trim() || '#ff3366';
      const glow = styles.getPropertyValue('--primary-glow').trim() || 'rgba(255, 51, 102, 0.3)';
      return {
        primary,
        glow,
        hueBase: theme === 'matcha' ? 100 : theme === 'ocean' ? 200 : theme === 'purple' ? 270 : theme === 'sakura' ? 330 : 350,
        textMuted,
        glassBgStrong
      };
    };

    function extractHue(hex) {
      // Simple HEX to HSL hue extractor
      let r = parseInt(hex.slice(1, 3), 16) / 255;
      let g = parseInt(hex.slice(3, 5), 16) / 255;
      let b = parseInt(hex.slice(5, 7), 16) / 255;
      let max = Math.max(r, g, b), min = Math.min(r, g, b);
      let h = 0;
      if (max !== min) {
        let d = max - min;
        switch (max) {
          case r: h = (g - b) / d + (g < b ? 6 : 0); break;
          case g: h = (b - r) / d + 2; break;
          case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
      }
      return Math.round(h * 360);
    }

    let rotationAngle = 0;
    let particleBurstCooldown = 0;

    // Cache theme colors outside the draw loop to prevent Layout Thrashing
    const cachedThemeColors = getThemeColors();

    // Persist data array to prevent heavy GC allocations per frame
    let sharedDataArray = null;
    let currentBufferLength = 0;

    const draw = () => {
      animationId = requestAnimationFrame(draw);

      const width = canvas.width / window.devicePixelRatio;
      const height = canvas.height / window.devicePixelRatio;
      const centerX = width / 2;
      const centerY = height / 2;

      try {
        // Clear canvas completely to prevent Chromium compositor color-bleeding bugs on blur backgrounds
        ctx.clearRect(0, 0, width, height);

        const activeStyle = visualizerConfig?.style || visualizerMode;
        if (activeStyle === 'none') return;

        const analyser = window.ichigoAnalyser;
        let dataArray = sharedDataArray;
        let bufferLength = currentBufferLength;
        let hasRealData = false;

        if (analyser) {
          if (analyser.frequencyBinCount !== currentBufferLength) {
            currentBufferLength = analyser.frequencyBinCount;
            bufferLength = currentBufferLength;
            sharedDataArray = new Uint8Array(bufferLength);
            dataArray = sharedDataArray;
          }
          
          analyser.getByteFrequencyData(dataArray);

          let sum = 0;
          for (let i = 0; i < 20; i++) sum += dataArray[i];
          if (sum > 0) hasRealData = true;
        }

        // Generate simulated visualizer frequency values if paused or no real buffer
        if (!hasRealData) {
          if (128 !== currentBufferLength) {
            currentBufferLength = 128;
            bufferLength = currentBufferLength;
            sharedDataArray = new Uint8Array(bufferLength);
            dataArray = sharedDataArray;
          }
          if (isPlaying) {
            const time = Date.now() * 0.0035;
            for (let i = 0; i < bufferLength; i++) {
              const multiplier = i < 15 ? 1.5 : (1 - i / bufferLength);
              const val = Math.abs(Math.sin(time + i * 0.12) * Math.cos(time * 0.5 + i * 0.07));
              dataArray[i] = val * 170 * multiplier;
            }
          } else {
            // zero out simulated array if paused
            dataArray.fill(0);
          }
        }

        const themeColors = cachedThemeColors;
        
        // Calculate bass power (first 8 frequency bands)
      let bassSum = 0;
      const bassBands = 8;
      for (let i = 0; i < bassBands; i++) {
        bassSum += dataArray[i] || 0;
      }
      const bassAvg = bassSum / bassBands;
      const bassIntensity = bassAvg / 255; // 0.0 to 1.0
      const bassPulseScale = 1 + bassIntensity * 0.22; // Scale size based on bass hits

      // Decrease burst cooldown
      if (particleBurstCooldown > 0) particleBurstCooldown--;

      // BASS EXPLOSION BEAT TRIGGER
      if (isPlaying && bassIntensity > 0.68 && particleBurstCooldown === 0) {
        // Create explosion particles shooting from center
        const numExplosionParticles = Math.floor(bassIntensity * 25) + 10;
        for (let j = 0; j < numExplosionParticles; j++) {
          const angle = Math.random() * Math.PI * 2;
          const speed = (Math.random() * 4 + 2) * (1 + bassIntensity * 2);
          particles.push(createParticle(true, angle, speed));
        }
        // Caps particles pool to prevent rendering lag
        if (particles.length > maxParticles * 2.5) {
          particles.splice(maxParticles, particles.length - maxParticles * 2.5);
        }
        particleBurstCooldown = 12; // Wait a few frames before triggering again
      }

      // Turn on overlay glow blending
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';

      // 1. Draw glowing circular waveforms
      if (activeStyle === 'circular') {
        const baseRadius = Math.min(width, height) * 0.25 * bassPulseScale;
        
        ctx.save();
        ctx.translate(centerX, centerY);
        if (visualizerConfig?.rotation !== false) {
          rotationAngle += 0.003 + bassIntensity * 0.01;
          ctx.rotate(rotationAngle);
        }

        // Gradient color ring
        const gradient = ctx.createRadialGradient(0, 0, baseRadius - 30, 0, 0, baseRadius + 120);
        gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
        gradient.addColorStop(0.2, adjustAlpha(themeColors.primary, 0.12));
        gradient.addColorStop(0.5, adjustAlpha(themeColors.primary, 0.25));
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(0, 0, baseRadius + 100, 0, Math.PI * 2);
        ctx.fill();

        // Draw frequency spoked paths
        const numSpokes = 180;
        ctx.lineWidth = 2.2;
        ctx.shadowBlur = 20;
        ctx.shadowColor = themeColors.primary;
        ctx.strokeStyle = themeColors.primary;

        ctx.beginPath();
        for (let i = 0; i < numSpokes; i++) {
          const angle = (i / numSpokes) * Math.PI * 2;
          const dataIdx = Math.floor((i / numSpokes) * (bufferLength * 0.75));
          const amplitude = (dataArray[dataIdx] || 0) * 0.42 * (1 + bassIntensity * 0.3);
          const r = baseRadius + amplitude;

          const x = Math.cos(angle) * r;
          const y = Math.sin(angle) * r;

          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.closePath();
        ctx.stroke();

        // Draw secondary inner pulsing ring
        ctx.shadowBlur = 8;
        ctx.lineWidth = 1;
        ctx.strokeStyle = themeColors.textMuted;
        ctx.beginPath();
        ctx.arc(0, 0, baseRadius - 10, 0, Math.PI * 2);
        ctx.stroke();

        ctx.restore();
      }

      // 2. Render particle constellation field with orbital drift
      ctx.save();
      // 2. Render particle constellation field with orbital drift
      if (activeStyle === 'particle' || activeStyle === 'particles') {
        ctx.save();
        ctx.translate(centerX, centerY);

        for (let i = particles.length - 1; i >= 0; i--) {
          const p = particles[i];

          // Orbit update
          if (!p.isBurst) {
            p.angle += p.orbitSpeed * (1 + bassIntensity * 2);
            const currentRadius = Math.sqrt(p.x * p.x + p.y * p.y);
            // Gently drift particles outwards or inwards on bass beats
            const newRadius = currentRadius + (p.speed * (1 + bassIntensity * 1.5) * (p.orbitSpeed > 0 ? 0.3 : -0.3));
            
            if (newRadius < 20 || newRadius > Math.max(width, height)) {
              // Respawn particle at core
              particles[i] = createParticle();
              continue;
            }

            p.x = Math.cos(p.angle) * newRadius;
            p.y = Math.sin(p.angle) * newRadius;
          } else {
            // Burst update: flies straight out radially
            p.x += Math.cos(p.angle) * p.speed;
            p.y += Math.sin(p.angle) * p.speed;
            p.alpha -= p.decay;

            if (p.alpha <= 0) {
              particles.splice(i, 1);
              continue;
            }
          }

          // Draw particle node
          const hue = (themeColors.hueBase + p.colorHue) % 360;
          ctx.fillStyle = `hsla(${hue}, 90%, 65%, ${p.alpha})`;
          ctx.shadowBlur = p.isBurst ? 10 : 4;
          ctx.shadowColor = `hsla(${hue}, 90%, 65%, 0.8)`;

          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius * (p.isBurst ? 1 : (1 + bassIntensity * 0.8)), 0, Math.PI * 2);
          ctx.fill();

          // Connect lines to nearby particles to form visual grids (constellation effect)
          if (!p.isBurst && i % 5 === 0) { // check subsets to optimize CPU usage
            for (let k = i - 1; k >= 0; k--) {
              const p2 = particles[k];
              if (p2.isBurst) continue;
              
              const dx = p.x - p2.x;
              const dy = p.y - p2.y;
              // Fast distance check without Math.sqrt to avoid heavy math
              if (Math.abs(dx) < 65 && Math.abs(dy) < 65) {
                const distSq = dx * dx + dy * dy;
                if (distSq < 4225) { // 65^2
                  const dist = Math.sqrt(distSq);
                  ctx.beginPath();
                  ctx.moveTo(p.x, p.y);
                  ctx.lineTo(p2.x, p2.y);
                  ctx.lineWidth = 0.5 * (1 - dist / 65);
                  ctx.strokeStyle = `hsla(${hue}, 80%, 60%, ${0.2 * (1 - dist / 65) * (p.alpha + p2.alpha)})`;
                  ctx.stroke();
                }
              }
            }
          }
        }
        ctx.restore();
      }

      // 3. Draw alternate visualizer styles overlaid in center
      if (activeStyle === 'bar' || activeStyle === 'frequency') {
        const barWidth = 6;
        const barGap = 4;
        const numBars = 60;
        const totalW = numBars * (barWidth + barGap);
        const startX = centerX - totalW / 2;

        for (let i = 0; i < numBars; i++) {
          const dataIdx = Math.floor((i / numBars) * (bufferLength * 0.65));
          const amplitude = (dataArray[dataIdx] || 0) * 0.75 * (height * 0.0018);
          
          const x = startX + i * (barWidth + barGap);
          const y = height - amplitude - 20;

          // Glowing bar drawing
          ctx.shadowBlur = 10;
          ctx.shadowColor = themeColors.primary;
          ctx.fillStyle = themeColors.primary;
          ctx.fillRect(x, y, barWidth, amplitude);

          // Symmetric top reflections
          ctx.fillStyle = themeColors.glassBgStrong;
          ctx.fillRect(x, y, barWidth, 2);
        }
      } else if (activeStyle === 'waveform') {
        // Double glowing wave overlay
        ctx.shadowBlur = 15;
        ctx.shadowColor = themeColors.primary;
        ctx.lineWidth = 3;
        ctx.strokeStyle = themeColors.primary;

        const sliceWidth = width / 64;
        
        ctx.beginPath();
        let x = 0;
        for (let i = 0; i < 64; i++) {
          const dataIdx = Math.floor((i / 64) * (bufferLength * 0.5));
          const amplitude = ((dataArray[dataIdx] || 0) - 128) * (height * 0.0018);
          const y = centerY + amplitude;

          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);

          x += sliceWidth;
        }
        ctx.stroke();
      }

      } catch (err) {
        console.error("Visualizer Error:", err);
      } finally {
        ctx.restore(); // Restore Composite Operations
      }
    };

    draw();

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', resizeCanvas);
    };
  }, [visualizerMode, isPlaying, theme, customThemeColors, visualizerConfig]);

  return <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }} />;
}
