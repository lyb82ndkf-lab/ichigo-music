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
  const { renderingConfig, advancedLyricConfig } = useApp();
  const visualizerFps = renderingConfig?.visualizerFps !== undefined ? Number(renderingConfig.visualizerFps) : 60;
  const fps = visualizerFps === 0 ? 0 : Math.max(24, visualizerFps);
  const normalizedStyle = useMemo(() => normalizeStyle(visualizerStyle), [visualizerStyle]);

  const scaleRef = useRef(1.0);
  const offsetYRef = useRef(0);

  useEffect(() => {
    scaleRef.current = advancedLyricConfig?.visualizerScale ?? 1.0;
    offsetYRef.current = advancedLyricConfig?.visualizerOffsetY ?? 0;
  }, [advancedLyricConfig?.visualizerScale, advancedLyricConfig?.visualizerOffsetY]);

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
    let lastFrame = 0;
    let time = 0;
    const minFrameMs = fps === 0 ? 0 : 1000 / fps;
    const resolvedPrimary = resolveCanvasColor(primaryColor || 'var(--primary)');

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
      gradient = ctx.createLinearGradient(0, height, 0, 0);
      gradient.addColorStop(0, resolvedPrimary);
      gradient.addColorStop(1, 'rgba(255,255,255,0.78)');
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    const prepareData = () => {
      const analyser = window.ichigoAnalyser;
      let hasRealData = false;

      if (analyser) {
        if (analyser.frequencyBinCount !== currentBufferLength) {
          currentBufferLength = analyser.frequencyBinCount;
          dataArray = new Uint8Array(currentBufferLength);
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
        }
        if (isPlaying) {
          time += 0.08;
          for (let i = 0; i < currentBufferLength; i++) {
            dataArray[i] = Math.abs(Math.sin(time + i * 0.13)) * 96;
          }
        } else {
          dataArray.fill(0);
        }
      }
    };

    const drawBars = () => {
      const numBars = width > 900 ? 56 : 44;
      const gap = 3;
      const barWidth = Math.max(2, (width - (numBars - 1) * gap) / numBars);
      const sampleSpan = currentBufferLength * 0.45;
      const scale = scaleRef.current;
      const offsetY = offsetYRef.current;
      for (let i = 0; i < numBars; i++) {
        const value = dataArray[4 + Math.floor((i / numBars) * sampleSpan)] || 0;
        const envelope = Math.sin((i / (numBars - 1)) * Math.PI);
        const amplitude = (2 + Math.pow(value / 255, 0.82) * height * 0.9 * envelope) * scale;
        const x = i * (barWidth + gap);
        const y = height - amplitude + offsetY;
        ctx.fillRect(x, y, barWidth, amplitude);
      }
    };

    const drawWave = () => {
      ctx.lineWidth = 2;
      ctx.beginPath();
      const points = 64;
      const sampleSpan = currentBufferLength * 0.45;
      const scale = scaleRef.current;
      const offsetY = offsetYRef.current;
      for (let i = 0; i < points; i++) {
        const value = dataArray[4 + Math.floor((i / points) * sampleSpan)] || 0;
        const x = (i / (points - 1)) * width;
        const wave = Math.pow(value / 255, 0.82) * height * 0.85 * scale;
        const y = height * 0.82 - wave * Math.sin((i / (points - 1)) * Math.PI) + offsetY;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    };

    const drawCircle = () => {
      ctx.lineWidth = 2.5;
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
      
      const bars = 60;
      const sampleSpan = currentBufferLength * 0.6;
      for (let i = 0; i < bars; i++) {
        const value = dataArray[4 + Math.floor((i / bars) * sampleSpan)] || 0;
        const angle = (i / bars) * Math.PI * 2;
        const outer = inner + (value / 255) * maxPulse * scale;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(angle) * inner, cy + Math.sin(angle) * inner);
        ctx.lineTo(cx + Math.cos(angle) * outer, cy + Math.sin(angle) * outer);
        ctx.stroke();
      }
    };

    const draw = (now) => {
      animationId = requestAnimationFrame(draw);
      if (fps !== 0 && now - lastFrame < minFrameMs) return;
      lastFrame = now;

      prepareData();
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = gradient;
      ctx.strokeStyle = gradient;
      ctx.shadowBlur = 0;

      if (normalizedStyle === 'wave') drawWave();
      else if (normalizedStyle === 'circle') drawCircle();
      else drawBars();
    };

    animationId = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', resizeCanvas);
    };
  }, [isPlaying, primaryColor, normalizedStyle, fps]);

  if (normalizedStyle === 'none') return null;

  return (
    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '100%', padding: 0, pointerEvents: 'none', zIndex: 10 }}>
      <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%', maxWidth: '800px', opacity: 0.86, margin: '0 auto' }} />
    </div>
  );
}
