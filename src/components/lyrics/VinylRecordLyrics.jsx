import React, { useRef } from 'react';

export default function VinylRecordLyrics({ 
  lyrics = [], 
  activeLineIndex = -1, 
  fontPx = 36, 
  fontStack, 
  themeColor, 
  coverUrl, 
  isPlaying,
  lineSpacing = 1,
  tiltAngle = 0
}) {
  const containerRef = useRef(null);

  // Center of rotation logic
  // The disc is on the left, so we set transformOrigin far to the left.
  const rotationRadius = 60; // vw

  return (
    <div 
      ref={containerRef}
      style={{ 
        width: '100%', 
        height: '100%', 
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '4vw',
        padding: '0 4vw',
        perspective: '1200px'
      }}
    >
      <style>
        {`
          @keyframes spin-vinyl {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          
          .vinyl-wrapper {
            position: relative;
            width: clamp(200px, 30vw, 450px);
            aspect-ratio: 1;
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
            z-index: 2;
          }
          
          .vinyl-disc {
            width: 100%;
            height: 100%;
            border-radius: 50%;
            background: #111;
            box-shadow: 0 30px 60px rgba(0,0,0,0.7), inset 0 0 20px rgba(0,0,0,0.9);
            border: 4px solid #222;
            position: absolute;
            display: flex;
            align-items: center;
            justify-content: center;
            animation: spin-vinyl 12s linear infinite;
            animation-play-state: ${isPlaying ? 'running' : 'paused'};
          }
          
          .vinyl-grooves {
            position: absolute;
            inset: 2px;
            border-radius: 50%;
            background: repeating-radial-gradient(
              #111,
              #111 2px,
              #222 4px,
              #111 6px
            );
            opacity: 0.6;
          }
          
          .vinyl-shine {
            position: absolute;
            inset: 0;
            border-radius: 50%;
            background: conic-gradient(
              from 45deg,
              rgba(255, 255, 255, 0) 0%,
              rgba(255, 255, 255, 0.15) 10%,
              rgba(255, 255, 255, 0) 20%,
              rgba(255, 255, 255, 0) 50%,
              rgba(255, 255, 255, 0.15) 60%,
              rgba(255, 255, 255, 0) 70%
            );
            z-index: 2;
            pointer-events: none;
            mix-blend-mode: screen;
          }
          
          .vinyl-label {
            width: 42%;
            aspect-ratio: 1;
            border-radius: 50%;
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            overflow: hidden;
            border: 3px solid #000;
            z-index: 3;
            box-shadow: 0 0 10px rgba(0,0,0,0.8);
          }
          
          .vinyl-label img {
            width: 100%;
            height: 100%;
            object-fit: cover;
          }
          
          .vinyl-hole {
            width: 5%;
            aspect-ratio: 1;
            border-radius: 50%;
            background: #fff;
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            box-shadow: inset 0 2px 5px rgba(0,0,0,0.8);
            z-index: 4;
            border: 1px solid #ddd;
          }
          
          .vinyl-lyrics-container {
            flex: 1.5;
            height: 85%;
            max-width: 900px;
            position: relative;
            display: flex;
            flex-direction: column;
            justify-content: center;
            overflow: hidden;
            mask-image: linear-gradient(to bottom, transparent, black 25%, black 75%, transparent);
            -webkit-mask-image: linear-gradient(to bottom, transparent, black 25%, black 75%, transparent);
            transform-style: preserve-3d;
            transform: rotateY(${tiltAngle}deg);
            transition: transform 0.5s ease;
          }
        `}
      </style>

      {/* LEFT: Premium Spinning Vinyl */}
      <div className="vinyl-wrapper">
        <div className="vinyl-disc">
          <div className="vinyl-grooves" />
          <div className="vinyl-label">
            <img src={coverUrl} alt="Album Art" />
          </div>
          <div className="vinyl-hole" />
        </div>
        <div className="vinyl-shine" />
      </div>

      {/* RIGHT: Arc-Rotating Lyrics */}
      <div className="vinyl-lyrics-container">
        <div style={{ position: 'relative', height: '100%', width: '100%', transformStyle: 'preserve-3d' }}>
          {lyrics.map((line, i) => {
            const isActive = i === activeLineIndex;
            const isPassed = i < activeLineIndex;
            const dist = i - activeLineIndex;
            
            // Limit render to avoid off-screen elements
            if (Math.abs(dist) > 12) return null;
            
            // Calculate arc rotation. 
            // Dist 0 = 0 deg
            // Dist -1 = -10 deg (rotates up and left)
            // Dist +1 = +10 deg (rotates down and left)
            const anglePerLine = 12 * lineSpacing; // Adjustable via settings
            const rotation = dist * anglePerLine;
            
            return (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: '10%', // Base distance from the disc
                  width: '100%',
                  fontFamily: '"Georgia", "Times New Roman", serif, "Noto Sans SC"',
                  fontSize: `${fontPx * (isActive ? 1.1 : 0.85)}px`,
                  fontWeight: isActive ? 700 : 400,
                  color: isActive ? themeColor : 'var(--text-main)',
                  opacity: isActive ? 1 : (isPassed ? 0.3 : 0.5),
                  // Transform origin is set far to the left to simulate revolving around the record
                  transformOrigin: `-${rotationRadius}vw center`,
                  transform: `translateY(-50%) rotate(${rotation}deg) scale(${isActive ? 1 : 0.95})`,
                  transition: 'transform 0.7s cubic-bezier(0.25, 0.8, 0.25, 1), opacity 0.7s ease, color 0.7s ease, font-size 0.7s ease',
                  filter: isActive ? `drop-shadow(0 0 15px ${themeColor})` : 'none',
                  zIndex: isActive ? 10 : 1,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                  letterSpacing: '1px'
                }}
              >
                <div style={{ fontStyle: isActive ? 'italic' : 'normal', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{line.text}</div>
                {line.translation && (
                  <div style={{ 
                    fontSize: `${fontPx * 0.45}px`, 
                    opacity: 0.7, 
                    fontFamily: fontStack, 
                    letterSpacing: '0',
                    fontStyle: 'normal',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word'
                  }}>
                    {line.translation}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
