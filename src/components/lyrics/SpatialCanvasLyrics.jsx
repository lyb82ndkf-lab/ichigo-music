import React, { useMemo, useRef, useEffect, useState } from 'react';

// Pre-compute seeded random positions so they stay stable during resizing
function seededRandom(seed) {
  let x = Math.sin(seed++) * 10000;
  return x - Math.floor(x);
}

export default function SpatialCanvasLyrics({ lyrics = [], activeLineIndex = -1, fontPx = 36, fontStack, themeColor }) {
  const containerRef = useRef(null);
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

  const activePos = linePositions[Math.max(0, activeLineIndex)] || { x: 0, y: 0, z: 0, rot: 0 };
  
  const camX = -activePos.x;
  const camY = -activePos.y;
  const camZ = -activePos.z + 150; // Pull back slightly from the active text
  const camRot = -activePos.rot * 0.5;
  
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
        {lyrics.map((line, i) => {
          const pos = linePositions[i];
          const isActive = i === activeLineIndex;
          const isPassed = i < activeLineIndex;
          const distToActive = Math.abs(i - activeLineIndex);
          
          if (distToActive > 25) return null; // Increased cull range due to density
          
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
