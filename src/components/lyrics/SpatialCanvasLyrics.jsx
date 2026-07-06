import React, { useMemo, useRef, useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';

// Pre-compute seeded random positions so they stay stable during resizing
function seededRandom(seed) {
  let x = Math.sin(seed++) * 10000;
  return x - Math.floor(x);
}

export default function SpatialCanvasLyrics({ lyrics = [], activeLineIndex = -1, fontPx = 36, fontStack, themeColor }) {
  const containerRef = useRef(null);
  const parentRef = useRef(null);
  const { advancedLyricConfig } = useApp();
  const [viewportSize, setViewportSize] = useState({ w: 800, h: 600 });

  useEffect(() => {
    const observer = new ResizeObserver((entries) => {
      if (entries[0]) {
        setViewportSize({
          w: entries[0].contentRect.width,
          h: entries[0].contentRect.height
        });
      }
    });
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const linePositions = useMemo(() => {
    return lyrics.map((line, i) => {
      const angle = seededRandom(i * 9876.543) * Math.PI * 2;
      const dist = 100 + seededRandom(i * 1111) * 800; // Denser radius
      
      const x = Math.cos(angle) * dist;
      const y = Math.sin(angle) * dist;
      const z = (seededRandom(i * 222) - 0.5) * 1000; // True 3D depth (-500 to 500)
      
      const rot = (seededRandom(i * 555) - 0.5) * 20;
      
      return { x, y, z, rot };
    });
  }, [lyrics]);

  // Generate stable particle points
  const particles = useMemo(() => {
    const list = [];
    const count = advancedLyricConfig?.spatialParticleCount ?? 200;
    for (let i = 0; i < count; i++) {
      const angle = seededRandom(i * 123.45) * Math.PI * 2;
      const radius = 150 + seededRandom(i * 543.21) * 1000;
      const px = Math.cos(angle) * radius;
      const py = Math.sin(angle) * radius;
      const pz = (seededRandom(i * 99.9) - 0.5) * 1800;
      list.push({ x: px, y: py, z: pz, id: i });
    }
    return list;
  }, [advancedLyricConfig?.spatialParticleCount]);

  // Audio visualizer loop: updates CSS properties on the parent container to animate elements in 3D
  useEffect(() => {
    let animId;
    const parent = parentRef.current;
    if (!parent) return;

    let pulseX = 1.0;
    let pulseY = 1.0;
    let pulseZ = 1.0;

    const tick = () => {
      animId = requestAnimationFrame(tick);
      
      const analyser = window.ichigoAnalyser;
      let dataArray = null;
      let bufferLength = 128;
      if (analyser) {
        bufferLength = analyser.frequencyBinCount;
        dataArray = new Uint8Array(bufferLength);
        analyser.getByteFrequencyData(dataArray);
      }

      let bass = 0;
      let mid = 0;
      let treble = 0;

      if (dataArray) {
        const bandSize = Math.floor(bufferLength / 3);
        for (let i = 0; i < bandSize; i++) bass += dataArray[i] || 0;
        for (let i = bandSize; i < bandSize * 2; i++) mid += dataArray[i] || 0;
        for (let i = bandSize * 2; i < bufferLength; i++) treble += dataArray[i] || 0;

        bass = bass / bandSize;
        mid = mid / bandSize;
        treble = treble / (bufferLength - bandSize * 2);
      }

      // Configured scaling ranges
      const spreadX = advancedLyricConfig?.spatialSpreadX ?? 1.0;
      const spreadY = advancedLyricConfig?.spatialSpreadY ?? 1.0;
      const spreadZ = advancedLyricConfig?.spatialSpreadZ ?? 1.0;

      const targetPulseX = 1.0 + (bass / 255) * 0.45 * spreadX;    
      const targetPulseY = 1.0 + (mid / 255) * 0.45 * spreadY;     
      const targetPulseZ = 1.0 + (treble / 255) * 0.8 * spreadZ;    

      pulseX += (targetPulseX - pulseX) * 0.15;
      pulseY += (targetPulseY - pulseY) * 0.15;
      pulseZ += (targetPulseZ - pulseZ) * 0.15;

      parent.style.setProperty('--pulse-x', pulseX.toFixed(3));
      parent.style.setProperty('--pulse-y', pulseY.toFixed(3));
      parent.style.setProperty('--pulse-z', pulseZ.toFixed(3));
    };

    tick();
    return () => cancelAnimationFrame(animId);
  }, [advancedLyricConfig]);

  const activePos = linePositions[Math.max(0, activeLineIndex)] || { x: 0, y: 0, z: 0, rot: 0 };
  
  const camX = -activePos.x;
  const camY = -activePos.y;
  const camZ = -activePos.z + 150; // Pull back slightly from the active text
  const camRot = -activePos.rot * 0.5;

  const particleSize = advancedLyricConfig?.spatialParticleSize ?? 1.0;
  const particleOpacity = advancedLyricConfig?.spatialParticleOpacity ?? 0.7;
  const colorMode = advancedLyricConfig?.spatialColorMode || 'adaptive';
  const resolvedParticleColor = colorMode === 'custom' 
    ? (advancedLyricConfig?.spatialCustomColor || '#ff4081') 
    : themeColor || '#ffffff';
  
  return (
    <div 
      ref={containerRef}
      style={{ 
        width: '100%', 
        height: '100%', 
        overflow: 'hidden',
        position: 'relative',
        perspective: '1200px'
      }}
    >
      <div 
        ref={parentRef}
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          width: 0,
          height: 0,
          transformStyle: 'preserve-3d',
          transition: 'transform 1.8s cubic-bezier(0.2, 0.8, 0.2, 1)',
          transform: `translate3d(${camX}px, ${camY}px, ${camZ}px) rotateZ(${camRot}deg)`
        }}
      >
        {/* Render 3D dynamic visualizer particles */}
        {particles.map((p) => {
          const depthBlur = advancedLyricConfig?.spatialDepthBlur ?? 0.5;
          // Apply basic depth-blur simulation using CSS filter based on particle base coordinate
          const blurFactor = Math.max(0, Math.min(6, (Math.abs(p.z) / 900) * 4.5 * depthBlur));
          
          return (
            <div
              key={`sp-${p.id}`}
              style={{
                position: 'absolute',
                width: `${3 * particleSize}px`,
                height: `${3 * particleSize}px`,
                backgroundColor: resolvedParticleColor,
                borderRadius: '50%',
                opacity: particleOpacity,
                // Scale coordinate multipliers driven by CSS variables on the parent element
                transform: `translate3d(calc(${p.x}px * var(--pulse-x, 1)), calc(${p.y}px * var(--pulse-y, 1)), calc(${p.z}px * var(--pulse-z, 1)))`,
                filter: blurFactor > 0.5 ? `blur(${blurFactor}px)` : 'none',
                pointerEvents: 'none',
                boxShadow: `0 0 ${8 * particleSize}px ${resolvedParticleColor}`
              }}
            />
          );
        })}

        {/* Spatial Lyrics Lines */}
        {lyrics.map((line, i) => {
          const pos = linePositions[i];
          const isActive = i === activeLineIndex;
          const isPassed = i < activeLineIndex;
          const distToActive = Math.abs(i - activeLineIndex);
          
          if (distToActive > 25) return null; 
          
          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                whiteSpace: 'nowrap',
                fontFamily: fontStack,
                fontSize: `${fontPx}px`,
                fontWeight: 800,
                color: isActive ? themeColor : 'var(--text-main)',
                opacity: isActive ? 1 : (isPassed ? 0.2 : 0.45),
                transition: 'all 0.8s cubic-bezier(0.2, 0.8, 0.2, 1)',
                transform: `translate3d(calc(-50% + ${pos.x}px), calc(-50% + ${pos.y}px), ${pos.z + (isActive ? 50 : 0)}px) rotateZ(${pos.rot}deg) scale(${isActive ? 1.2 : 1})`,
                filter: isActive ? `drop-shadow(0 0 20px ${themeColor})` : 'blur(3px)',
                zIndex: isActive ? 10 : 1,
                pointerEvents: 'none'
              }}
            >
              {line.text}
              {line.translation && (
                <div style={{ 
                  fontSize: `${fontPx * 0.5}px`, 
                  marginTop: '10px', 
                  opacity: 0.8, 
                  fontWeight: 500,
                  textAlign: 'center'
                }}>
                  {line.translation}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
