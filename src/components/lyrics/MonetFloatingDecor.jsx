import React, { useMemo } from 'react';
import { Sparkles, Music, Star, Circle, Heart } from 'lucide-react';

export default function MonetFloatingDecor() {
  const particles = useMemo(() => {
    const icons = [Sparkles, Music, Star, Circle, Heart];
    const arr = [];
    // 固定伪随机种子，保证每次切回来粒子的位置都是一致的，不会乱跳
    for (let i = 0; i < 6; i++) {
      const Icon = icons[i % icons.length];
      const x = ((i * 127 + 43) % 100);
      const y = ((i * 73 + 19) % 100);
      const size = ((i * 31 + 7) % 20) + 15;
      const duration = ((i * 41 + 13) % 15) + 20;
      const delay = (i * 1.5) % 10;
      const rotation = ((i * 101 + 23) % 360);
      arr.push({ id: i, Icon, x, y, size, duration, delay, rotation });
    }
    return arr;
  }, []);

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
          @keyframes monet-float {
            0% { transform: translateY(0px) translateX(0px) rotate(0deg); opacity: 0.1; }
            33% { transform: translateY(-40px) translateX(20px) rotate(120deg); opacity: 0.4; }
            66% { transform: translateY(20px) translateX(-15px) rotate(240deg); opacity: 0.2; }
            100% { transform: translateY(0px) translateX(0px) rotate(360deg); opacity: 0.1; }
          }
          .monet-intro-decor {
            animation: monet-intro-fade 2.2s cubic-bezier(0.25, 0.46, 0.45, 0.94) both;
          }
          @keyframes monet-intro-fade {
            from { opacity: 0; }
            to { opacity: 1; }
          }
        `}
      </style>
      <div className="monet-intro-decor" style={{ width: '100%', height: '100%' }}>
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
              opacity: 0.3,
              filter: 'blur(1px)',
              animation: `monet-float ${p.duration}s ease-in-out infinite`,
              willChange: 'transform',
              animationDelay: `${p.delay}s`,
              transformOrigin: 'center center'
            }}
          >
            <Icon size={p.size} strokeWidth={1.5} />
          </div>
          );
        })}
      </div>
    </div>
  );
}
