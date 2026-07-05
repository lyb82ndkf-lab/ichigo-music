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

function normalizeStyle(style) {
  if (style === 'waveform') return 'wave';
  if (style === 'circular') return 'circle';
  if (style === 'particle') return 'bars';
  if (style === 'none' || style === 'off') return 'none';
  return style || 'bars';
}

export default function MonetAudioOverlay({ isPlaying, primaryColor, visualizerStyle = 'bars', isBehindCover = false }) {
  const canvasRef = useRef(null);
  const { renderingConfig, advancedLyricConfig, coverConfig } = useApp();
  
  const visualizerFps = renderingConfig?.visualizerFps !== undefined ? Number(renderingConfig.visualizerFps) : 30;
  const fps = visualizerFps === 0 ? 0 : Math.min(120, Math.max(24, visualizerFps));
  const normalizedStyle = useMemo(() => normalizeStyle(visualizerStyle), [visualizerStyle]);

  const scaleRef = useRef(1.0);
  const offsetYRef = useRef(0);
  const showCoverRef = useRef(true);

  // Particles state
  const particlesRef = useRef([]);

  useEffect(() => {
    scaleRef.current = advancedLyricConfig?.visualizerScale ?? 1.0;
    offsetYRef.current = advancedLyricConfig?.visualizerOffsetY ?? 0;
    showCoverRef.current = coverConfig?.showCover !== false && advancedLyricConfig?.showCover !== false;
  }, [advancedLyricConfig, coverConfig]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || normalizedStyle === 'none') return undefined;

    const ctx = canvas.getContext('2d', { alpha: true });
    let animationId = 0;
    let dataArray = null;
    let currentBufferLength = 0;
    let width = 0;
    let height = 0;
    let gradient = null;
    let glowGradient = null;
    let lastFrame = 0;
    
    // Smooth data cache for interpolation
    let smoothedData = [];
    
    const minFrameMs = fps === 0 ? 0 : 1000 / fps;
    const resolvedPrimary = resolveCanvasColor(primaryColor || 'var(--primary)');
    const sampleOffset = 4;

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
      
      // Cyber gradient for mirrored peaks
      gradient = ctx.createLinearGradient(0, height, 0, 0);
      gradient.addColorStop(0, resolvedPrimary);
      gradient.addColorStop(0.5, 'rgba(255,255,255,0.9)');
      gradient.addColorStop(1, resolvedPrimary);

      glowGradient = ctx.createRadialGradient(width/2, height/2, 0, width/2, height/2, height/2);
      glowGradient.addColorStop(0, resolvedPrimary);
      glowGradient.addColorStop(1, 'rgba(0,0,0,0)');
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
      
      // Smooth data array for less jittery visuals
      for (let i = 0; i < currentBufferLength; i++) {
        smoothedData[i] += (dataArray[i] - smoothedData[i]) * 0.3;
      }
    };

    // --- High-Energy Particle Emitter System ---
    const spawnParticles = (intensity) => {
      if (advancedLyricConfig?.particleSystem === false) return;
      if (intensity < 200) return; // Only spawn on high peaks
      
      const amount = advancedLyricConfig?.particleAmount || 50;
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

    // --- Visualizer Mode 1: Symmetrical Mirrored Peaks (Waveform Replacement) ---
    const drawMirroredPeaks = () => {
      const points = width > 900 ? 64 : 48;
      const sampleSpan = currentBufferLength * 0.5;
      const scale = scaleRef.current;
      const offsetY = offsetYRef.current + height / 2; // Center it
      
      ctx.lineWidth = 3;
      ctx.strokeStyle = gradient;
      ctx.fillStyle = gradient;
      
      ctx.beginPath();
      // Draw top half
      for (let i = 0; i < points; i++) {
        const value = smoothedData[sampleOffset + Math.floor((i / points) * sampleSpan)] || 0;
        const x = (i / (points - 1)) * width;
        const wave = Math.pow(value / 255, 1.2) * height * 0.4 * scale;
        const y = offsetY - wave;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
        
        // Spawn particles from peaks
        if (i % 5 === 0) spawnParticles(value);
      }
      
      // Draw bottom half mirrored
      for (let i = points - 1; i >= 0; i--) {
        const value = smoothedData[sampleOffset + Math.floor((i / points) * sampleSpan)] || 0;
        const x = (i / (points - 1)) * width;
        const wave = Math.pow(value / 255, 1.2) * height * 0.4 * scale;
        const y = offsetY + wave * 0.5; // Bottom reflection is slightly shorter
        ctx.lineTo(x, y);
      }
      ctx.closePath();
      
      ctx.globalAlpha = 0.8;
      ctx.fill();
      ctx.globalAlpha = 1.0;
      ctx.stroke();
    };

    // --- Visualizer Mode 2: Standard Bars ---
    const drawBars = () => {
      const numBars = width > 900 ? 50 : 36;
      const gap = 4;
      const barWidth = Math.max(2, (width - (numBars - 1) * gap) / numBars);
      const sampleSpan = currentBufferLength * 0.5;
      const scale = scaleRef.current;
      const offsetY = offsetYRef.current;
      
      ctx.fillStyle = gradient;
      
      for (let i = 0; i < numBars; i++) {
        const value = smoothedData[sampleOffset + Math.floor((i / numBars) * sampleSpan)] || 0;
        const envelope = Math.sin((i / (numBars - 1)) * Math.PI);
        const amplitude = (2 + Math.pow(value / 255, 1.0) * height * 0.8 * envelope) * scale;
        const x = i * (barWidth + gap);
        const y = height - amplitude + offsetY;
        
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, amplitude, [barWidth/2, barWidth/2, 0, 0]);
        ctx.fill();
        
        if (i % 3 === 0) spawnParticles(value);
      }
    };

    // --- Visualizer Mode 3: Circular / Pulsing Energy Orb ---
    const drawCircle = () => {
      const cx = width / 2;
      const scale = scaleRef.current;
      const offsetY = offsetYRef.current;
      
      let cy, inner, maxPulse;
      if (isBehindCover) {
        cy = height / 2 + offsetY;
        const coverSize = Math.max(100, Math.min(width, height) - 200);
        inner = (coverSize / 2) * 0.98 * scale;
        maxPulse = Math.min(100, (Math.min(width, height) - coverSize) / 2 - 10);
      } else {
        cy = height * 0.68 + offsetY;
        inner = Math.min(width, height) * 0.18 * scale;
        maxPulse = Math.min(width, height) * 0.25;
      }
      
      const bars = 64;
      const sampleSpan = currentBufferLength * 0.6;
      let totalEnergy = 0;
      
      ctx.lineWidth = 3;
      ctx.strokeStyle = resolvedPrimary;
      
      for (let i = 0; i < bars; i++) {
        const value = smoothedData[sampleOffset + Math.floor((i / bars) * sampleSpan)] || 0;
        totalEnergy += value;
        const angle = (i / bars) * Math.PI * 2 - Math.PI / 2;
        const outer = inner + Math.pow(value / 255, 1.2) * maxPulse * scale;
        
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(angle) * inner, cy + Math.sin(angle) * inner);
        ctx.lineTo(cx + Math.cos(angle) * outer, cy + Math.sin(angle) * outer);
        ctx.stroke();
      }
      
      const avgEnergy = totalEnergy / bars;
      spawnParticles(avgEnergy * 1.5);

      // If cover is hidden and not behind cover, draw the Pulsing Energy Orb in the center
      if (!showCoverRef.current && !isBehindCover) {
         ctx.beginPath();
         const orbRadius = inner * 0.8 + (avgEnergy / 255) * inner * 0.4;
         ctx.arc(cx, cy, orbRadius, 0, Math.PI * 2);
         ctx.fillStyle = glowGradient;
         ctx.globalAlpha = 0.5 + (avgEnergy / 255) * 0.5;
         ctx.fill();
         ctx.globalAlpha = 1.0;
      }
    };

    const draw = (now) => {
      animationId = requestAnimationFrame(draw);
      if (fps !== 0 && now - lastFrame < minFrameMs) return;
      lastFrame = now;

      prepareData();
      ctx.clearRect(0, 0, width, height);

      // Draw particle system first (background layer)
      drawParticles();

      // Draw primary visualizer
      if (normalizedStyle === 'wave') drawMirroredPeaks();
      else if (normalizedStyle === 'circle') drawCircle();
      else drawBars();
    };

    animationId = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', resizeCanvas);
    };
  }, [isPlaying, primaryColor, normalizedStyle, fps, advancedLyricConfig, isBehindCover]);

  if (normalizedStyle === 'none' && advancedLyricConfig?.particleSystem === false) return null;

  return (
    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '100%', padding: 0, pointerEvents: 'none', zIndex: 10 }}>
      <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%', maxWidth: '1200px', opacity: 0.9, margin: '0 auto', filter: 'drop-shadow(0 0 10px rgba(0,0,0,0.5))' }} />
    </div>
  );
}
