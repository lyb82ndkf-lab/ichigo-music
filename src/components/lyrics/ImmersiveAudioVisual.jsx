import React, { useEffect, useRef } from 'react';

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));

function colorToRgb(value, fallback = [255, 64, 129]) {
  const input = String(value || '').trim();
  const hex = input.match(/^#([0-9a-f]{6}|[0-9a-f]{3})$/i);
  if (hex) {
    const raw = hex[1].length === 3 ? hex[1].split('').map(char => char + char).join('') : hex[1];
    return [parseInt(raw.slice(0, 2), 16), parseInt(raw.slice(2, 4), 16), parseInt(raw.slice(4, 6), 16)];
  }
  const rgb = input.match(/rgba?\(([^)]+)\)/i);
  if (rgb) return rgb[1].split(',').slice(0, 3).map(channel => Number(channel.trim()) || 0);
  return fallback;
}

function rgba(rgb, alpha) {
  return `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${clamp(alpha)})`;
}

function seeded(index) {
  const value = Math.sin(index * 12.9898 + 78.233) * 43758.5453;
  return value - Math.floor(value);
}

function makeParticles(count = 90) {
  return Array.from({ length: count }, (_, index) => ({
    x: seeded(index + 1),
    y: seeded(index + 101),
    z: 0.25 + seeded(index + 201) * 0.75,
    phase: seeded(index + 301) * Math.PI * 2,
    speed: 0.25 + seeded(index + 401) * 0.75
  }));
}

export default function ImmersiveAudioVisual({
  variant = 'spotlight',
  accentColor = 'var(--primary)',
  intensity = 1,
  visualizerStyle = 'circle',
  opacity = 0.82,
  smoothing = 0.16,
  offsetY = 0,
  scale = 1,
  isPlaying = true
}) {
  const canvasRef = useRef(null);
  const stateRef = useRef({ bass: 0, mid: 0, treble: 0, energy: 0, time: 0 });
  const playingRef = useRef(isPlaying);
  const wakeRef = useRef(null);

  useEffect(() => {
    playingRef.current = isPlaying;
    wakeRef.current?.();
  }, [isPlaying]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const context = canvas.getContext('2d');
    if (!context) return undefined;
    const parent = canvas.parentElement;
    const particles = makeParticles(72);
    const analyserBufferRef = { current: null };
    let frameId = 0;
    let width = 1;
    let height = 1;
    let dpr = 1;
    let visualEnergy = 0;
    let lastDrawAt = 0;
    let idleTimer = 0;
    let idleCleared = false;

    const resize = () => {
      const rect = parent?.getBoundingClientRect() || canvas.getBoundingClientRect();
      dpr = Math.min(1.25, window.devicePixelRatio || 1);
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
    observer?.observe(parent || canvas);
    resize();
    const cssAccent = getComputedStyle(canvas).getPropertyValue('--audio-accent').trim();
    const rootPrimary = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim();
    const visualRgb = colorToRgb(cssAccent.startsWith('var(') ? rootPrimary : cssAccent);

    const drawSpotlight = (rgb, levels, now) => {
      const cx = width * 0.5;
      const cy = height * 0.5;
      const radius = Math.min(width, height) * (0.18 + levels.bass * 0.12);
      const glow = context.createRadialGradient(cx, cy, 0, cx, cy, radius * 3.6);
      glow.addColorStop(0, rgba(rgb, 0.14 + levels.energy * 0.18));
      glow.addColorStop(0.42, rgba(rgb, 0.05 + levels.mid * 0.08));
      glow.addColorStop(1, rgba(rgb, 0));
      context.fillStyle = glow;
      context.fillRect(0, 0, width, height);
      context.save();
      context.translate(cx, cy);
      context.rotate(now * 0.00012);
      for (let ring = 0; ring < 4; ring += 1) {
        const ringRadius = radius * (1.25 + ring * 0.52) + levels.bass * 18 * (ring + 1);
        context.beginPath();
        context.arc(0, 0, ringRadius, -Math.PI * 0.15, Math.PI * 1.1);
        context.strokeStyle = rgba(rgb, (0.16 - ring * 0.025) + levels.treble * 0.12);
        context.lineWidth = 1 + levels.mid * 2;
        context.shadowBlur = 14 + levels.bass * 20;
        context.shadowColor = rgba(rgb, 0.7);
        context.stroke();
      }
      const spokes = 36;
      for (let index = 0; index < spokes; index += 1) {
        const angle = index / spokes * Math.PI * 2;
        const length = radius * (0.8 + levels.treble * (0.5 + (index % 5) / 8));
        context.beginPath();
        context.moveTo(Math.cos(angle) * radius * 0.92, Math.sin(angle) * radius * 0.92);
        context.lineTo(Math.cos(angle) * (radius + length * 0.42), Math.sin(angle) * (radius + length * 0.42));
        context.strokeStyle = rgba(rgb, 0.05 + levels.treble * 0.18);
        context.lineWidth = 1;
        context.stroke();
      }
      context.restore();
      // 渲染大范围光束背景：能量越高，光束越宽。
      context.save();
      context.translate(cx, cy);
      context.rotate(-now * 0.00018);
      const beamCount = 6;
      // All beams share the same radial falloff. Build the gradient once per
      // frame instead of allocating six identical CanvasGradient objects.
      const beamGradient = context.createRadialGradient(0, 0, radius * 0.3, 0, 0, Math.max(width, height));
      beamGradient.addColorStop(0, rgba(rgb, 0.16 + levels.mid * 0.12));
      beamGradient.addColorStop(1, rgba(rgb, 0));
      for (let index = 0; index < beamCount; index += 1) {
        const angle = (index / beamCount) * Math.PI * 2;
        const beamWidth = 0.08 + levels.treble * 0.08;
        context.fillStyle = beamGradient;
        context.beginPath();
        context.moveTo(0, 0);
        context.arc(0, 0, Math.max(width, height), angle - beamWidth, angle + beamWidth);
        context.closePath();
        context.fill();
      }
      context.restore();
    };

    const drawStarfield = (rgb, levels, now) => {
      const centerX = width * 0.5;
      const centerY = height * 0.5;
      const speed = 0.00004 * (1 + levels.energy * 8);
      for (const particle of particles) {
        const depth = particle.z;
        const travel = ((now * speed * particle.speed + particle.x) % 1 + 1) % 1;
        // 星轨粒子沿纵深方向流动：能量越高，移动速度越快。
        const perspective = 0.12 + travel * (0.88 + depth * 0.35);
        const x = (particle.x - 0.5) * width * perspective + centerX;
        const y = (particle.y - 0.5) * height * perspective + centerY;
        const length = (8 + levels.treble * 72) * perspective * depth;
        context.beginPath();
        context.moveTo(centerX + (x - centerX) * 0.78, centerY + (y - centerY) * 0.78);
        context.lineTo(x, y);
        context.strokeStyle = rgba(rgb, 0.12 + depth * 0.42 + levels.treble * 0.18);
        context.lineWidth = 0.5 + depth * 1.8;
        context.stroke();
        context.fillStyle = rgba(rgb, 0.25 + depth * 0.4);
        context.beginPath();
        context.arc(x, y, 0.8 + depth * 2.2 + levels.treble * 1.5, 0, Math.PI * 2);
        context.fill();
      }
      const halo = context.createRadialGradient(centerX, centerY, 0, centerX, centerY, Math.min(width, height) * 0.56);
      halo.addColorStop(0, rgba(rgb, 0.08 + levels.bass * 0.12));
      halo.addColorStop(1, rgba(rgb, 0));
      context.fillStyle = halo;
      context.fillRect(0, 0, width, height);
    };

    const drawFilmstrip = (rgb, levels, data) => {
      const centerY = height * 0.5;
      const barCount = Math.min(64, data.length || 64);
      const step = width / barCount;
        // 胶片齿孔与中部电平条：低频能量越高，齿孔间距呼吸感越强。
      context.fillStyle = rgba(rgb, 0.05 + levels.energy * 0.06);
      context.fillRect(0, centerY - 2, width, 4);
      for (let hole = 0; hole < Math.ceil(width / 34); hole += 1) {
        context.fillStyle = rgba(rgb, 0.16 + levels.mid * 0.18);
        context.fillRect(hole * 34 + 7, centerY - height * 0.38, 15, 4);
        context.fillRect(hole * 34 + 7, centerY + height * 0.38 - 4, 15, 4);
      }
      for (let index = 0; index < barCount; index += 1) {
        const sample = ((data[index] || 0) / 255) * 0.28 + levels.energy * 0.72;
        const bar = 4 + sample * (height * 0.20) + levels.bass * 5;
        const x = index * step;
        context.fillStyle = rgba(rgb, 0.12 + sample * 0.42);
        context.fillRect(x, centerY - bar, Math.max(1, step - 2), bar * 2);
      }
      const scanX = (Date.now() * (0.08 + levels.mid * 0.22)) % (width + 160) - 80;
      const scan = context.createLinearGradient(scanX - 80, 0, scanX + 80, 0);
      scan.addColorStop(0, rgba(rgb, 0));
      scan.addColorStop(0.5, rgba(rgb, 0.3 + levels.treble * 0.3));
      scan.addColorStop(1, rgba(rgb, 0));
      context.fillStyle = scan;
      context.fillRect(scanX - 80, 0, 160, height);
    };

    /* // 水墨模式已停用：保留实现以备将来恢复
    const drawInkflow = (rgb, levels, now) => {
      const ribbons = 5;
      for (let ribbon = 0; ribbon < ribbons; ribbon += 1) {
        const baseY = height * (0.18 + ribbon / (ribbons - 1) * 0.64);
        context.beginPath();
        const points = [];
        for (let x = -20; x <= width + 20; x += Math.max(12, width / 32)) {
          const wave = Math.sin(x * 0.012 + now * 0.0007 * (1 + levels.mid * 3) + ribbon) * (8 + levels.bass * 26);
          const fine = Math.sin(x * 0.031 - now * 0.0004 + ribbon * 1.7) * (3 + levels.treble * 12);
          const y = baseY + wave + fine;
          points.push([x, y]);
          if (x === -20) context.moveTo(x, y); else context.lineTo(x, y);
        }
        for (let index = points.length - 1; index >= 0; index -= 1) context.lineTo(points[index][0], points[index][1] + 8 + levels.bass * 16);
        context.closePath();
        context.fillStyle = rgba(rgb, 0.025 + levels.energy * 0.09);
        context.shadowBlur = 18 + levels.bass * 18;
        context.shadowColor = rgba(rgb, 0.24);
        context.fill();
        context.shadowBlur = 0;
        context.strokeStyle = rgba(rgb, 0.07 + levels.energy * 0.12);
        context.lineWidth = 1 + levels.mid * 2.5;
        context.stroke();
      }
      for (let drop = 0; drop < 9; drop += 1) {
        const x = (seeded(drop + 700) * width + now * 0.008 * (1 + levels.mid)) % width;
        const y = height * (0.18 + seeded(drop + 900) * 0.64);
        context.fillStyle = rgba(rgb, 0.08 + levels.bass * 0.18);
        context.beginPath();
        context.ellipse(x, y, 3 + levels.bass * 7, 8 + levels.mid * 14, 0, 0, Math.PI * 2);
        context.fill();
      }
    };
    */

    const schedule = (idle = false) => {
      if (idle) {
        if (!idleTimer) {
          idleTimer = window.setTimeout(() => {
            idleTimer = 0;
            frameId = window.requestAnimationFrame(tick);
          }, 300);
        }
      } else {
        frameId = window.requestAnimationFrame(tick);
      }
    };
    const wake = () => {
      if (idleTimer) {
        window.clearTimeout(idleTimer);
        idleTimer = 0;
      }
      if (!frameId && playingRef.current && !document.hidden && visualizerStyle !== 'off') {
        frameId = window.requestAnimationFrame(tick);
      }
    };
    wakeRef.current = wake;
    const handleVisibility = () => {
      if (!document.hidden) wake();
    };
    document.addEventListener('visibilitychange', handleVisibility);

    const tick = (now) => {
      frameId = 0;
      // The lyric clock remains at display rate; background visualizers are
      // deliberately capped to a stable 30fps to prevent canvas work from
      // competing with per-word timing and causing visible jitter.
      // When paused or hidden, keep the RAF callback lightweight and avoid
      // analyser reads / gradient allocation. This keeps all immersive modes
      // responsive while the audio element is buffering or the window is
      // backgrounded.
      if (document.hidden || !playingRef.current || visualizerStyle === 'off') {
        if (!idleCleared) {
          context.clearRect(0, 0, width, height);
          idleCleared = true;
        }
        schedule(true);
        return;
      }
      idleCleared = false;
      schedule(false);
      if (now - lastDrawAt < 1000 / 24) return;
      lastDrawAt = now;
      const analyser = window.ichigoAnalyser;
      let data = analyserBufferRef.current;
      if (analyser) {
        if (!data || data.length !== analyser.frequencyBinCount) data = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(data);
        analyserBufferRef.current = data;
      }
      const length = data?.length || 0;
      const third = Math.max(1, Math.floor(length / 3));
      let bass = 0; let mid = 0; let treble = 0;
      for (let index = 0; index < length; index += 1) {
        const value = data[index] / 255;
        if (index < third) bass += value;
        else if (index < third * 2) mid += value;
        else treble += value;
      }
      const target = {
        bass: length ? bass / third : 0,
        mid: length ? mid / third : 0,
        treble: length ? treble / Math.max(1, length - third * 2) : 0
      };
      const previous = stateRef.current;
      const smoothingFactor = clamp(Number(smoothing) || 0.16, 0.04, 0.8);
      previous.bass += (target.bass - previous.bass) * smoothingFactor;
      previous.mid += (target.mid - previous.mid) * smoothingFactor;
      previous.treble += (target.treble - previous.treble) * smoothingFactor;
      previous.energy = (previous.bass + previous.mid + previous.treble) / 3;
      visualEnergy += (previous.energy - visualEnergy) * 0.08;
      // Keep the visual response smoothed once per sample.
      previous.time = now;
      const rgb = visualRgb;
      context.clearRect(0, 0, width, height);
      context.globalCompositeOperation = 'screen';
      context.save();
        // 统一应用透明度、纵向偏移与缩放，随后绘制当前视觉变体。
      context.globalAlpha = clamp(Number(opacity) || 0.82, 0, 1) * 0.64;
      context.translate(0, Number(offsetY) || 0);
      context.translate(width / 2, height / 2);
      context.scale(Math.max(0.2, Number(scale) || 1), Math.max(0.2, Number(scale) || 1));
      context.translate(-width / 2, -height / 2);
      const levels = {
        bass: clamp(previous.bass * Number(intensity || 1)),
        mid: clamp(previous.mid * Number(intensity || 1)),
        treble: clamp(previous.treble * Number(intensity || 1)),
        energy: clamp(visualEnergy * Number(intensity || 1))
      };
      const drawBars = () => {
        const barCount = Math.min(48, data?.length || 48);
        const step = width / barCount;
        for (let index = 0; index < barCount; index += 1) {
          const sample = (data?.[index] || 0) / 255;
          const bar = 3 + sample * height * 0.24 + levels.bass * 12;
          context.fillStyle = rgba(rgb, 0.08 + sample * 0.34);
          context.fillRect(index * step, height / 2 - bar, Math.max(1, step - 2), bar * 2);
        }
      };
      const drawWave = () => {
        const points = Math.min(80, data?.length || 80);
        context.beginPath();
        for (let index = 0; index < points; index += 1) {
          const sample = (data?.[index] || 0) / 255;
          const x = (index / Math.max(1, points - 1)) * width;
          const y = height / 2 + Math.sin(index * 0.22 + now * 0.002) * (4 + levels.mid * 18) + (sample - 0.5) * height * 0.22;
          if (index === 0) context.moveTo(x, y); else context.lineTo(x, y);
        }
        context.strokeStyle = rgba(rgb, 0.2 + levels.energy * 0.35);
        context.lineWidth = 1.5 + levels.treble * 2.5;
        context.shadowBlur = 12 + levels.bass * 18;
        context.shadowColor = rgba(rgb, 0.7);
        context.stroke();
      };
      if (visualizerStyle !== 'off') {
        if (visualizerStyle === 'bars') drawBars();
        else if (visualizerStyle === 'wave') drawWave();
        else if (variant === 'starfield') drawStarfield(rgb, levels, now);
        else if (variant === 'filmstrip') drawFilmstrip(rgb, levels, data || []);
        // else if (variant === 'inkflow') drawInkflow(rgb, levels, now);
        else drawSpotlight(rgb, levels, now);
      }
      context.restore();
    };

    frameId = window.requestAnimationFrame(tick);
    return () => {
      window.cancelAnimationFrame(frameId);
      window.clearTimeout(idleTimer);
      if (wakeRef.current === wake) wakeRef.current = null;
      document.removeEventListener('visibilitychange', handleVisibility);
      observer?.disconnect();
    };
  // All inputs above are scalar values. Do not depend on an object created by
  // the parent render: that would tear down and recreate the full canvas loop
  // whenever lyrics update, causing visible flashes and spectrum jitter.
  }, [variant, accentColor, intensity, visualizerStyle, opacity, smoothing, offsetY, scale]);

  return <canvas ref={canvasRef} className={`immersive-audio-visual immersive-audio-${variant}`} style={{ '--audio-accent': accentColor }} aria-hidden="true" />;
}
