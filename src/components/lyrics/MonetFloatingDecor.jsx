import React, { useMemo } from 'react';
import { Sparkles, Music, Star, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export default function MonetFloatingDecor() {
  const { currentSong } = useApp();
  
  const particles = useMemo(() => {
    // Cross-stars are typically represented by X or custom SVG, we'll use X, Star, Music, Sparkles
    const icons = [X, Star, Music, Sparkles];
    const arr = [];
    for (let i = 0; i < 12; i++) {
      const Icon = icons[i % icons.length];
      const x = ((i * 127 + 43) % 100);
      const y = ((i * 73 + 19) % 100);
      const size = ((i * 31 + 7) % 25) + 10;
      const duration = ((i * 41 + 13) % 30) + 40; // Very slow float
      const delay = (i * 1.5) % 10;
      const rotation = ((i * 101 + 23) % 360);
      arr.push({ id: i, Icon, x, y, size, duration, delay, rotation });
    }
    return arr;
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
          @keyframes monet-float-decor {
            0% { transform: translateY(0px) translateX(0px) rotate(0deg); opacity: 0.1; }
            33% { transform: translateY(-80px) translateX(40px) rotate(120deg); opacity: 0.3; }
            66% { transform: translateY(40px) translateX(-30px) rotate(240deg); opacity: 0.15; }
            100% { transform: translateY(0px) translateX(0px) rotate(360deg); opacity: 0.1; }
          }
          @keyframes monet-watermark-pan {
            0% { transform: translateX(10%) translateY(-50%) rotate(-5deg); }
            50% { transform: translateX(-10%) translateY(-50%) rotate(-5deg); }
            100% { transform: translateX(10%) translateY(-50%) rotate(-5deg); }
          }
        `}
      </style>
      
      {/* Massive Faint Watermark */}
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

      <div style={{ width: '100%', height: '100%', position: 'relative', zIndex: 1 }}>
        {particles.map((p) => {
          const Icon = p.Icon;
          return (
          <div
            key={p.id}
            style={{
              position: 'absolute',
              left: `${p.x}%`,
              top: `${p.y}%`,
              width: `${p.size}px`,
              height: `${p.size}px`,
              color: 'var(--primary)',
              opacity: 0,
              filter: 'blur(1px)',
              animation: `monet-float-decor ${p.duration}s ease-in-out infinite`,
              willChange: 'transform',
              animationDelay: `${p.delay}s`,
              transformOrigin: 'center center'
            }}
          >
            <Icon size={p.size} strokeWidth={p.Icon === X ? 1 : 1.5} />
          </div>
          );
        })}
      </div>
    </div>
  );
}
