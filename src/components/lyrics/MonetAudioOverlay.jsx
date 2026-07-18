import React, { useEffect, useMemo, useRef } from 'react';
import { useApp } from '../../context/AppContext';

function resolveCanvasColor(color, fallback = '#ff3366') {
  if (!color) return fallback;
  const value = String(color).trim();
  if (!value.startsWith('var(')) return value;
  if (typeof window === 'undefined') return fallback;
  const cssVar = value.match(/var\((--[^),\s]+)/)?.[1];
  return cssVar ? getComputedStyle(document.body).getPropertyValue(cssVar).trim() || fallback : fallback;
}

function hexToRgba(hex, alpha = 1) {
  if (!hex) return `rgba(255, 255, 255, ${alpha})`;
  const value = String(hex).trim();
  if (value.startsWith('rgb')) {
    return value.replace(/rgba?$/, 'rgba').replace(/\)$/, `, ${alpha})`);
  }
  let c = value.startsWith('#') ? value.slice(1) : value;
  if (c.length === 3) {
    c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
  }
  const r = parseInt(c.substring(0, 2), 16) || 255;
  const g = parseInt(c.substring(2, 4), 16) || 255;
  const b = parseInt(c.substring(4, 6), 16) || 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export default function MonetAudioOverlay({ isPlaying, primaryColor, animationMode = 'regular', isBehindCover = false }) {
  const canvasRef = useRef(null);
  const { renderingConfig, advancedLyricConfig, coverConfig } = useApp();
  
  const visualizerFps = renderingConfig?.visualizerFps !== undefined ? Number(renderingConfig.visualizerFps) : 30;
  const fps = visualizerFps === 0 ? 0 : Math.min(120, Math.max(24, visualizerFps));

  const scaleRef = useRef(1.0);
  const offsetYRef = useRef(0);
  const showCoverRef = useRef(true);

  // Particle systems & visualizer state references
  const particlesRef = useRef([]);
  const talkParticlesRef = useRef([]);
  const streamerPhaseRef = useRef(0);
  const rotationAngleRef = useRef(0);
  const cloudPhaseRef = useRef(0);

  useEffect(() => {
    scaleRef.current = advancedLyricConfig?.visualizerScale ?? 1.0;
    offsetYRef.current = advancedLyricConfig?.visualizerOffsetY ?? 0;
    showCoverRef.current = coverConfig?.showCover !== false && advancedLyricConfig?.showCover !== false;
  }, [advancedLyricConfig, coverConfig]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const ctx = canvas.getContext('2d', { alpha: true });
    let animationId = 0;
    let dataArray = null;
    let currentBufferLength = 0;
    let width = 0;
    let height = 0;
    let lastFrame = 0;
    
    // Smooth data cache for interpolation
    let smoothedData = [];
    
    const minFrameMs = fps === 0 ? 0 : 1000 / fps;
    const resolvedPrimary = resolveCanvasColor(primaryColor || 'var(--primary)');
    const sampleOffset = 4;
    const configuredVisualizerStyle = advancedLyricConfig?.visualizerStyleByMode?.[animationMode]
      || advancedLyricConfig?.visualizerStyle
      || 'mode';

    const resizeCanvas = () => {
      const rect = canvas.parentElement.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    const prepareData = () => {
      const analyser = window.ichigoAnalyser;
      let hasRealData = false;

      if (window.ichigoAudioContext && window.ichigoAudioContext.state === 'suspended') {
        window.ichigoAudioContext.resume().catch(() => {});
      }

      if (analyser) {
        if (analyser.frequencyBinCount !== currentBufferLength) {
          currentBufferLength = analyser.frequencyBinCount;
          dataArray = new Uint8Array(currentBufferLength);
          smoothedData = new Array(currentBufferLength).fill(0);
        }
        analyser.getByteFrequencyData(dataArray);
        for (let i = 0; i < Math.min(16, dataArray.length); i++) {
          if (dataArray[i] > 0) { hasRealData = true; break; }
        }
      }

      if (!hasRealData) {
        if (currentBufferLength !== 128) {
          currentBufferLength = 128;
          dataArray = new Uint8Array(currentBufferLength);
          smoothedData = new Array(currentBufferLength).fill(0);
        }
        for (let i = 0; i < currentBufferLength; i++) {
          dataArray[i] = Math.max(0, (dataArray[i] || 0) * 0.82);
        }
      }
      
      // Attack smoothing & Decay release curves
      const upSmooth = 1 - (advancedLyricConfig?.ringSmoothing ?? 0.25);
      const decay = advancedLyricConfig?.ringTrailDecay ?? 0.85;
      
      for (let i = 0; i < currentBufferLength; i++) {
        const target = dataArray[i] || 0;
        if (target > smoothedData[i]) {
          smoothedData[i] += (target - smoothedData[i]) * upSmooth;
        } else {
          smoothedData[i] = smoothedData[i] * decay + target * (1 - decay);
        }
      }
    };

    // --- High-Energy Particle Emitter System ---
    const spawnParticles = (intensity) => {
      if (advancedLyricConfig?.particleSystem === false) return;
      if (intensity < 200) return; // Only spawn on high peaks
      
      const amount = Math.min(advancedLyricConfig?.particleAmount || 50, 40);
      const baseSize = advancedLyricConfig?.particleSize || 1.5;
      
      // Spawn a burst of particles
      for (let i = 0; i < (intensity / 255) * (amount / 10); i++) {
        const cx = isBehindCover ? width / 2 : width / 2 + (Math.random() - 0.5) * width;
        const cy = isBehindCover ? height / 2 : height * 0.8;
        
        particlesRef.current.push({
          x: cx,
          y: cy,
          vx: (Math.random() - 0.5) * 8,
          vy: (Math.random() - 0.5) * 8 - 2,
          life: 1.0,
          size: (Math.random() * 2 + 1) * baseSize,
          color: Math.random() > 0.5 ? '#ffffff' : resolvedPrimary
        });
      }
    };

    const drawParticles = () => {
      if (advancedLyricConfig?.particleSystem === false) return;
      const opacity = advancedLyricConfig?.particleOpacity || 0.8;
      
      for (let i = particlesRef.current.length - 1; i >= 0; i--) {
        const p = particlesRef.current[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.02;
        p.vy += 0.05; // gravity
        
        if (p.life <= 0) {
          particlesRef.current.splice(i, 1);
          continue;
        }
        
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.life * opacity;
        ctx.fill();
        ctx.globalAlpha = 1.0;
      }
    };

    // --- Visualizer Mode 1: Regular Circular Visualizer ---
    const drawEnhancedCircle = (deltaSec) => {
      const cx = width / 2;
      const scale = scaleRef.current;
      const offsetY = offsetYRef.current;
      
      const cy = height / 2 + offsetY;
      const coverSize = Math.max(100, Math.min(width, height) - 200);
      
      // Apply offset config
      const innerOffset = advancedLyricConfig?.ringInnerOffset ?? 5;
      const inner = (coverSize / 2) + innerOffset;
      const maxPulse = advancedLyricConfig?.ringMaxAmplitude ?? 80;
      
      const bars = Math.min(Number(advancedLyricConfig?.ringBarCount ?? 180) || 180, isBehindCover ? 128 : 96);
      const sampleSpan = currentBufferLength * 0.6;
      let totalEnergy = 0;
      
      const ringLineWidth = advancedLyricConfig?.ringLineWidth ?? 2.5;
      const ringStyle = advancedLyricConfig?.ringStyle || 'radial';
      const ringColorMode = advancedLyricConfig?.ringColorMode || 'adaptive';
      const ringGlowIntensity = advancedLyricConfig?.ringGlowIntensity ?? 0.6;
      const ringGlowPulse = advancedLyricConfig?.ringGlowPulse !== false;
      const ringOpacity = advancedLyricConfig?.ringOpacity ?? 0.85;

      ctx.lineWidth = ringLineWidth;
      ctx.globalAlpha = ringOpacity;

      // Color Mode Setup
      if (ringColorMode === 'custom') {
        const c1 = advancedLyricConfig?.ringCustomColor1 || '#17f700';
        const c2 = advancedLyricConfig?.ringCustomColor2 || '#00d4ff';
        const grad = ctx.createRadialGradient(cx, cy, inner, cx, cy, inner + maxPulse * scale);
        grad.addColorStop(0, c1);
        grad.addColorStop(1, c2);
        ctx.strokeStyle = grad;
        ctx.fillStyle = grad;
      } else {
        ctx.strokeStyle = resolvedPrimary;
        ctx.fillStyle = resolvedPrimary;
      }

      // Collect total energy for glow and beat rotation sync
      for (let i = 0; i < bars; i++) {
        totalEnergy += smoothedData[sampleOffset + Math.floor((i / bars) * sampleSpan)] || 0;
      }
      const avgEnergy = totalEnergy / bars;

      // Rotation angles with beat synchronization
      const rotSpeed = advancedLyricConfig?.ringRotationSpeed ?? 15;
      const rotSpeedRad = (rotSpeed / 60) * (Math.PI / 180);
      const beatMultiplier = (advancedLyricConfig?.ringRotationBeatSync && avgEnergy > 120) ? 1.0 + (avgEnergy - 120) / 135 * 4.0 : 1.0;
      rotationAngleRef.current += rotSpeedRad * deltaSec * beatMultiplier;

      // Glow Setup
      if (ringGlowIntensity > 0) {
        const pulse = ringGlowPulse ? 0.6 + (avgEnergy / 255) * 0.7 : 1.0;
        ctx.shadowBlur = ringLineWidth * 4.5 * ringGlowIntensity * pulse;
        ctx.shadowColor = ringColorMode === 'custom' ? (advancedLyricConfig?.ringCustomColor1 || '#17f700') : resolvedPrimary;
      }

      if (ringStyle === 'radial') {
        for (let i = 0; i < bars; i++) {
          const value = smoothedData[sampleOffset + Math.floor((i / bars) * sampleSpan)] || 0;
          const angle = (i / bars) * Math.PI * 2 + rotationAngleRef.current;
          const outer = inner + Math.pow(value / 255, 1.25) * maxPulse * scale;
          
          ctx.beginPath();
          ctx.moveTo(cx + Math.cos(angle) * inner, cy + Math.sin(angle) * inner);
          ctx.lineTo(cx + Math.cos(angle) * outer, cy + Math.sin(angle) * outer);
          ctx.stroke();
        }
      } else if (ringStyle === 'particle') {
        for (let i = 0; i < bars; i++) {
          const value = smoothedData[sampleOffset + Math.floor((i / bars) * sampleSpan)] || 0;
          const angle = (i / bars) * Math.PI * 2 + rotationAngleRef.current;
          const outer = inner + Math.pow(value / 255, 1.25) * maxPulse * scale;
          const size = ringLineWidth * (0.6 + (value / 255) * 1.6);
          
          ctx.beginPath();
          ctx.arc(cx + Math.cos(angle) * outer, cy + Math.sin(angle) * outer, size, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (ringStyle === 'wave') {
        ctx.beginPath();
        for (let i = 0; i <= bars; i++) {
          const idx = i % bars;
          const value = smoothedData[sampleOffset + Math.floor((idx / bars) * sampleSpan)] || 0;
          const angle = (i / bars) * Math.PI * 2 + rotationAngleRef.current;
          const outer = inner + Math.pow(value / 255, 1.25) * maxPulse * scale;
          const x = cx + Math.cos(angle) * outer;
          const y = cy + Math.sin(angle) * outer;
          
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.stroke();
      }

      // Reset styles
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1.0;
      spawnParticles(avgEnergy);
    };

    // --- Visualizer Mode 2: Streamer Mode Bottom Lamp Strip ---
    const drawStreamerBar = () => {
      const heightVal = advancedLyricConfig?.streamerBarHeight ?? 16;
      const maxHeightVal = advancedLyricConfig?.streamerBarMaxHeight ?? 80;
      const opacity = advancedLyricConfig?.streamerBarOpacity ?? 0.75;
      const glowSpread = advancedLyricConfig?.streamerBarGlowSpread ?? 20;
      const flowSpeed = advancedLyricConfig?.streamerBarFlowSpeed ?? 1.0;
      const colorMode = advancedLyricConfig?.streamerBarColorMode || 'theme';
      
      const bars = 64;
      const sampleSpan = currentBufferLength * 0.5;
      let totalEnergy = 0;
      for (let i = 0; i < bars; i++) {
        totalEnergy += smoothedData[sampleOffset + Math.floor((i / bars) * sampleSpan)] || 0;
      }
      const avgEnergy = totalEnergy / bars;
      
      streamerPhaseRef.current += flowSpeed * 0.015;
      
      ctx.globalAlpha = opacity;
      if (glowSpread > 0) {
        ctx.shadowBlur = glowSpread;
        ctx.shadowColor = colorMode === 'custom' ? (advancedLyricConfig?.streamerBarCustomColor || '#ff4081') : resolvedPrimary;
      }
      
      const barSpacing = width / bars;
      const barWidth = barSpacing * 0.7;
      const gap = barSpacing * 0.3;
      
      for (let i = 0; i < bars; i++) {
        const value = smoothedData[sampleOffset + Math.floor((i / bars) * sampleSpan)] || 0;
        const currentHeight = heightVal + (value / 255) * (maxHeightVal - heightVal);
        const x = i * barSpacing + gap / 2;
        const y = height - currentHeight;
        
        let fillGrad = ctx.createLinearGradient(x, y, x, height);
        if (colorMode === 'custom') {
          const c = advancedLyricConfig?.streamerBarCustomColor || '#ff4081';
          fillGrad.addColorStop(0, c);
          fillGrad.addColorStop(1, hexToRgba(c, 0.15));
        } else {
          const phase = streamerPhaseRef.current + (i / bars) * Math.PI * 2;
          const hue = (phase * (180 / Math.PI)) % 360;
          fillGrad.addColorStop(0, `hsla(${hue}, 90%, 65%, 1)`);
          fillGrad.addColorStop(1, `hsla(${hue}, 90%, 65%, 0.15)`);
        }
        
        ctx.fillStyle = fillGrad;
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, currentHeight, [barWidth / 2, barWidth / 2, 0, 0]);
        ctx.fill();
      }
      
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1.0;
      spawnParticles(avgEnergy);
    };

    // --- Visualizer Mode 3: Talk Mode Shard Particles ---
    const drawTalkParticles = () => {
      const pCount = advancedLyricConfig?.talkParticleCount ?? 80;
      const pSize = advancedLyricConfig?.talkParticleSize ?? 1.0;
      const opacity = advancedLyricConfig?.talkParticleOpacity ?? 0.7;
      const shape = advancedLyricConfig?.talkParticleShape || 'triangle';
      const burstThreshold = advancedLyricConfig?.talkBurstThreshold ?? 200;
      const burstIntensity = advancedLyricConfig?.talkBurstIntensity ?? 1.0;
      const driftSpeed = advancedLyricConfig?.talkDriftSpeed ?? 1.0;
      const colorMode = advancedLyricConfig?.talkColorMode || 'adaptive';
      const gravity = advancedLyricConfig?.talkGravity ?? 0.05;
      
      const bars = 64;
      const sampleSpan = currentBufferLength * 0.5;
      let totalEnergy = 0;
      for (let i = 0; i < bars; i++) {
        totalEnergy += smoothedData[sampleOffset + Math.floor((i / bars) * sampleSpan)] || 0;
      }
      const avgEnergy = totalEnergy / bars;
      
      if (talkParticlesRef.current.length < pCount) {
        talkParticlesRef.current.push({
          x: Math.random() * width,
          y: height + 20,
          vx: (Math.random() - 0.5) * driftSpeed * 1.5,
          vy: - (Math.random() * 2 + 0.6) * driftSpeed,
          size: (Math.random() * 5 + 2.5) * pSize,
          angle: Math.random() * Math.PI * 2,
          rotationSpeed: (Math.random() - 0.5) * 0.06,
          color: colorMode === 'custom' ? (advancedLyricConfig?.talkCustomColor || '#ff4081') : resolvedPrimary,
          opacity: Math.random() * 0.5 + 0.4
        });
      }
      
      if (avgEnergy > burstThreshold) {
        const burstCount = Math.floor((avgEnergy / 255) * 12 * burstIntensity);
        for (let i = 0; i < burstCount; i++) {
          const angle = Math.random() * Math.PI * 2;
          const speed = (Math.random() * 5 + 3.5);
          talkParticlesRef.current.push({
            x: width / 2,
            y: height / 2,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed - 1.5,
            size: (Math.random() * 7 + 4) * pSize,
            angle: angle,
            rotationSpeed: (Math.random() - 0.5) * 0.22,
            color: '#ffffff',
            opacity: 1.0,
            isBurst: true
          });
        }
      }
      
      ctx.globalAlpha = opacity;
      for (let i = talkParticlesRef.current.length - 1; i >= 0; i--) {
        const p = talkParticlesRef.current[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += gravity;
        p.angle += p.rotationSpeed;
        
        if (p.isBurst) {
          p.opacity -= 0.035;
          if (p.opacity <= 0) {
            talkParticlesRef.current.splice(i, 1);
            continue;
          }
        }
        
        if (p.x < -50 || p.x > width + 50 || p.y < -50 || p.y > height + 50) {
          talkParticlesRef.current.splice(i, 1);
          continue;
        }
        
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.opacity * opacity;
        
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);
        ctx.beginPath();
        
        if (shape === 'dot') {
          ctx.arc(0, 0, p.size, 0, Math.PI * 2);
          ctx.fill();
        } else if (shape === 'line') {
          ctx.rect(-p.size, -1, p.size * 2, 2);
          ctx.fill();
        } else if (shape === 'triangle') {
          ctx.moveTo(0, -p.size);
          ctx.lineTo(p.size * 0.86, p.size * 0.5);
          ctx.lineTo(-p.size * 0.86, p.size * 0.5);
          ctx.closePath();
          ctx.fill();
        } else if (shape === 'diamond') {
          ctx.moveTo(0, -p.size);
          ctx.lineTo(p.size * 0.7, 0);
          ctx.lineTo(0, p.size);
          ctx.lineTo(-p.size * 0.7, 0);
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();
      }
      ctx.globalAlpha = 1.0;
    };

    // --- Visualizer Mode 4: CloudStep Cloud Waves ---
    const drawCloudWaves = () => {
      const blurVal = advancedLyricConfig?.cloudWaveBlur ?? 23;
      const heightVal = advancedLyricConfig?.cloudWaveHeight ?? 30;
      const opacity = advancedLyricConfig?.cloudWaveOpacity ?? 0.39;
      const colorMode = advancedLyricConfig?.cloudWaveColorMode || 'theme';
      const verticalSpread = advancedLyricConfig?.cloudWaveVerticalSpread ?? 1.0;
      
      const numWaves = 4;
      const sampleSpan = currentBufferLength * 0.22;
      
      ctx.filter = `blur(${blurVal}px)`;
      
      for (let w = 0; w < numWaves; w++) {
        // Independent layers breathing: gently modulate base opacity over time
        const breathOpacity = opacity * (0.7 + 0.3 * Math.sin(performance.now() * 0.001 + w * 1.7));
        ctx.globalAlpha = breathOpacity;

        const freqOffset = Math.floor(w * sampleSpan);
        const color = colorMode === 'custom' ? (advancedLyricConfig?.cloudWaveCustomColor || '#ff4081') : resolvedPrimary;
        
        ctx.beginPath();
        
        const yBase = height * (0.15 + 0.18 * w * verticalSpread);
        ctx.moveTo(0, height);
        
        for (let i = 0; i <= 20; i++) {
          const x = (i / 20) * width;
          const freqIdx = freqOffset + Math.floor((i / 20) * sampleSpan);
          const energy = smoothedData[freqIdx] || 0;
          const waveHeight = Math.pow(energy / 255, 1.25) * heightVal;
          
          // Flowing wave with gaps/valleys created by multiplying by cos
          const angle = (i / 20) * Math.PI * 2 + w * 2.5 + cloudPhaseRef.current;
          const y = yBase - waveHeight * Math.sin(angle) * Math.cos((i / 20) * Math.PI + w * 1.1);
          
          if (i === 0) ctx.lineTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.lineTo(width, height);
        ctx.closePath();
        
        // Gradient fill that fades to transparent at the bottom of the step, leaving hollows
        let fillGrad = ctx.createLinearGradient(0, yBase - heightVal * 1.5, 0, yBase + 120);
        fillGrad.addColorStop(0, color);
        fillGrad.addColorStop(0.2, color);
        fillGrad.addColorStop(0.8, hexToRgba(color, 0.2));
        fillGrad.addColorStop(1.0, 'transparent');
        
        ctx.fillStyle = fillGrad;
        ctx.fill();
      }
      
      ctx.filter = 'none';
      ctx.globalAlpha = 1.0;
    };

    const draw = (now) => {
      animationId = requestAnimationFrame(draw);
      const frameBudgetMs = isPlaying ? minFrameMs : 1000 / 12;
      if ((isPlaying ? fps !== 0 : true) && now - lastFrame < frameBudgetMs) return;
      
      const deltaSec = lastFrame === 0 ? 0.016 : (now - lastFrame) / 1000;
      lastFrame = now;

      // Update cloud phase for smooth wind blowing flow
      cloudPhaseRef.current += deltaSec * 0.12;

      prepareData();
      ctx.clearRect(0, 0, width, height);

      if (configuredVisualizerStyle === 'off') {
        particlesRef.current = [];
        talkParticlesRef.current = [];
        return;
      }

      // Draw particle system first (background layer)
      drawParticles();

      if (configuredVisualizerStyle === 'bars') {
        drawStreamerBar();
      } else if (configuredVisualizerStyle === 'wave') {
        if (animationMode === 'regular') drawEnhancedCircle(deltaSec);
        else drawCloudWaves();
      } else if (configuredVisualizerStyle === 'circle') {
        drawEnhancedCircle(deltaSec);
      } else if (animationMode === 'regular') {
        drawEnhancedCircle(deltaSec);
      } else if (animationMode === 'streamer') {
        drawStreamerBar();
      } else if (animationMode === 'talk') {
        drawTalkParticles();
      } else if (animationMode === 'cloudstep') {
        drawCloudWaves();
      }
    };

    animationId = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', resizeCanvas);
    };
  }, [isPlaying, primaryColor, animationMode, fps, advancedLyricConfig, isBehindCover]);

  return (
    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '100%', padding: 0, pointerEvents: 'none', zIndex: 10 }}>
      <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%', maxWidth: '1200px', opacity: 0.9, margin: '0 auto', filter: 'drop-shadow(0 0 10px rgba(0,0,0,0.5))' }} />
    </div>
  );
}
