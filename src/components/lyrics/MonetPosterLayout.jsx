import React, { useState, useEffect, useMemo, useRef } from 'react';
import { buildVisibleWindow } from './MonetLyricsEngine';
import MonetLyricsRail from './MonetLyricsRail';
import ImmersiveLyricsStage, { preloadKineticKtvLyrics } from './ImmersiveLyricsStage';
import MonetAudioOverlay from './MonetAudioOverlay';
import MonetFloatingDecor from './MonetFloatingDecor';

function MonetPosterLayout({ 
  lyrics, 
  activeLineIndex, 
  currentSong, 
  isPlaying, 
  currentTimeRef,
  currentTime,
  themeColor,
  coverUrl,
  audioAnalyser,
  engineRef,
  advancedLyricConfig,
  visualizerFps = 30,
  showCoverPreference = true,
  seekTo,
  layoutMode
}) {
  const animMode = advancedLyricConfig?.lyricsMode || 'regular';
  const isRegularMode = animMode === 'regular';

  useEffect(() => {
    if (animMode === 'talk') preloadKineticKtvLyrics();
  }, [animMode]);

  const isKashiMode = ['talk'].includes(animMode);
  const showCover = advancedLyricConfig?.showCover !== false && isRegularMode;
  const showSongInfo = advancedLyricConfig?.showSongInfo !== false;
  const enableDecor = advancedLyricConfig?.showDecor === true && !isKashiMode;
  const fontScale = (advancedLyricConfig?.fontSize || 24) / 24;
  const fontFamilyMap = {
    Inter: '"Inter", "Noto Sans SC", sans-serif',
    Outfit: '"Outfit", "Noto Sans SC", sans-serif',
    'Noto Serif SC': '"Noto Serif SC", "Songti SC", serif',
    'Microsoft YaHei': '"Microsoft YaHei", "Noto Sans SC", sans-serif',
    KaiTi: '"KaiTi", "STKaiti", serif'
  };
  const fontStack = fontFamilyMap[advancedLyricConfig?.fontFamily] || fontFamilyMap.Inter;
  const titleFontStack = fontFamilyMap[advancedLyricConfig?.titleFontFamily] || fontFamilyMap.Outfit || fontFamilyMap.Inter;

  const [manualScrollOffset, setManualScrollOffset] = useState(0);
  const scrollTimeoutRef = useRef(null);

  const handleWheel = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const delta = e.deltaY > 0 ? 1.5 : -1.5;
    setManualScrollOffset(prev => prev + delta);
    
    if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    scrollTimeoutRef.current = setTimeout(() => {
      setManualScrollOffset(0);
    }, 2200);
  };

  const handleLyricClick = (line) => {
    if (seekTo && line && line.time !== undefined) {
      seekTo(line.time);
      setManualScrollOffset(0);
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    }
  };

  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    };
  }, []);

  const [dimensions, setDimensions] = useState({
    fontPx: 36 * fontScale,
    transPx: 18 * fontScale,
    maxWidthPx: 600,
    railHeight: 500
  });

  const railContainerRef = useRef(null);
  const coverPaneRef = useRef(null);
  const coverImgRef = useRef(null);
  const [coverAlignedRatio, setCoverAlignedRatio] = useState(0.5);

  useEffect(() => {
    const updateDimensions = () => {
      if (!railContainerRef.current) return;
      const { clientWidth, clientHeight } = railContainerRef.current;
      const baseFont = Math.min(Math.max(clientWidth * 0.052, 22), 48) * fontScale;
      setDimensions({
        fontPx: baseFont,
        transPx: baseFont * 0.48,
        maxWidthPx: clientWidth * 0.95,
        railHeight: clientHeight
      });

      if (showCover && coverPaneRef.current && railContainerRef.current) {
        const coverRect = coverPaneRef.current.getBoundingClientRect();
        const railRect = railContainerRef.current.getBoundingClientRect();
        if (railRect.height > 0) {
          const coverCenterY = coverRect.top + coverRect.height / 2;
          const relativeY = coverCenterY - railRect.top;
          const ratio = Math.max(0.1, Math.min(0.9, relativeY / railRect.height));
          setCoverAlignedRatio(ratio);
        }
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, [fontScale, showCover]);

  const displayLyrics = useMemo(() => {
    return lyrics && lyrics.length > 0 ? lyrics : [{
      time: 0,
      duration: 999,
      text: '暂无歌词，享受音乐',
      translation: 'No lyrics available'
    }];
  }, [lyrics]);

  const effectiveActiveIndex = useMemo(() => {
    if (manualScrollOffset === 0) return activeLineIndex;
    const currentLine = displayLyrics[activeLineIndex] || displayLyrics[0];
    const targetTime = (currentLine?.time || 0) + manualScrollOffset;
    let closestIndex = activeLineIndex;
    let minDiff = Infinity;
    displayLyrics.forEach((l, idx) => {
      const diff = Math.abs(l.time - targetTime);
      if (diff < minDiff) {
        minDiff = diff;
        closestIndex = idx;
      }
    });
    return closestIndex;
  }, [displayLyrics, activeLineIndex, manualScrollOffset]);

  const visibleLines = useMemo(() => {
    return buildVisibleWindow(
      displayLyrics,
      effectiveActiveIndex,
      0,
      { before: 5, after: 6 }
    );
  }, [displayLyrics, effectiveActiveIndex]);
  const fallbackSong = currentSong || {
    title: 'ICHIGOMusic',
    artist: 'High-Fidelity Audio',
    album: { name: 'Local Experience' }
  };

  const coverUrlResized = useMemo(() => {
    if (!coverUrl) return '';
    if (coverUrl.includes('param=')) return coverUrl.replace(/param=\d+y\d+/, 'param=600y600');
    return coverUrl.includes('?') ? `${coverUrl}&param=600y600` : `${coverUrl}?param=600y600`;
  }, [coverUrl]);

  return (
    <div className={`monet-poster-layout ${isKashiMode ? 'monet-poster-layout--kashi' : ''}`} style={{
      position: 'absolute',
      inset: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: isKashiMode ? '0' : '4vh 5vw',
      gap: isKashiMode ? '0' : '5vw',
      overflow: 'hidden',
      userSelect: 'none'
    }}>
      <style>
        {`
          .monet-poster-layout {
            box-sizing: border-box;
            font-family: ${fontStack};
          }
          
          .monet-left-pane {
            flex: 1 1 55%;
            height: 100%;
            display: flex;
            flex-direction: column;
            justifyContent: center;
            min-width: 0;
            z-index: 2;
          }
          
          .monet-right-pane {
            flex: 1 1 45%;
            height: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
            max-width: 540px;
            z-index: 2;
            position: relative;
          }

          /* Intro Animations */
          @keyframes monet-fade-right {
            from { opacity: 0; transform: translateX(-40px); }
            to { opacity: 1; transform: translateX(0); }
          }
          @keyframes monet-fade-up {
            from { opacity: 0; transform: translateY(25px); }
            to { opacity: 1; transform: translateY(0); }
          }
          @keyframes monet-scale-y {
            from { transform: scaleY(0); opacity: 0; }
            to { transform: scaleY(1); opacity: 1; }
          }
          @keyframes monet-cover-enter {
            from { opacity: 0; transform: translateX(60px) scale(0.92) rotate(2deg); }
            to { opacity: 1; transform: translateX(0) scale(1) rotate(0deg); }
          }
          @keyframes monet-float-cover {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-12px); }
          }
          
          .monet-anim-artist { animation: monet-fade-right 1.4s cubic-bezier(0.2, 0.8, 0.2, 1) both; animation-delay: 0.15s; }
          .monet-anim-line { animation: monet-scale-y 1.6s cubic-bezier(0.2, 0.8, 0.2, 1) both; animation-delay: 0.4s; transform-origin: top; }
          .monet-anim-title { animation: monet-fade-right 1.4s cubic-bezier(0.2, 0.8, 0.2, 1) both; animation-delay: 0.25s; }
          .monet-anim-rail { animation: monet-fade-up 1.4s cubic-bezier(0.2, 0.8, 0.2, 1) both; animation-delay: 0.5s; }
          .monet-anim-capsule { animation: monet-fade-up 1.2s cubic-bezier(0.2, 0.8, 0.2, 1) both; animation-delay: 0.8s; }
          .monet-anim-cover-wrapper { 
            animation: monet-cover-enter 1.8s cubic-bezier(0.25, 0.8, 0.15, 1) both, monet-float-cover 6s ease-in-out infinite 2.2s; 
            width: 100%; 
            position: relative;
            will-change: transform; 
          }
          .monet-cover-img { 
            transform: translateZ(0); 
          }
          
          .monet-artist-text {
            font-family: ${titleFontStack};
            font-size: clamp(1.4rem, 2.5vw, 2rem);
            font-weight: 500;
            font-style: italic;
            color: var(--text-muted);
            letter-spacing: -0.02em;
          }
          
          .monet-title-text {
            font-family: ${titleFontStack};
            font-size: clamp(2rem, 4vw, 3.5rem);
            font-weight: 800;
            color: var(--text-main);
            letter-spacing: -0.03em;
            line-height: 1.1;
            margin-top: 8px;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow: hidden;
          }
          
          .monet-album-text {
            font-size: clamp(0.9rem, 1.2vw, 1.1rem);
            font-weight: 500;
            color: var(--primary);
            margin-top: 6px;
            opacity: 0.8;
          }
          
          .monet-cover-img {
            width: 100%;
            aspect-ratio: 1;
            object-fit: cover;
            border-radius: 2.5vw;
            box-shadow: 0 40px 80px -20px rgba(0,0,0,0.6), 0 20px 40px -10px var(--primary-glow);
            border: 1px solid rgba(255,255,255,0.08);
            cursor: pointer;
            transition: transform 0.3s ease;
          }
          .monet-cover-img:hover {
            transform: scale(1.02) translateY(-5px);
          }

          .monet-poster-layout--kashi .monet-left-pane { position: relative; z-index: 2; pointer-events: none; }
          .monet-poster-layout--kashi .monet-anim-rail { display: none !important; }
          .monet-kashi-layer { position: absolute; inset: 0; z-index: 1; overflow: hidden; }
        `}
      </style>

      {enableDecor && <MonetFloatingDecor isPlaying={isPlaying} currentSong={currentSong} advancedLyricConfig={advancedLyricConfig} />}

      {/* LEFT: Metadata & Lyrics */}
      <div className="monet-left-pane">
        
        {/* Header Metadata */}
        {showSongInfo && !isKashiMode && (
          <div style={{ display: 'flex', gap: '24px', marginBottom: '4vh', position: 'relative', zIndex: 2 }}>
            <div className="monet-anim-line" style={{ width: '4px', background: 'var(--primary)', borderRadius: '4px' }} />
            <div>
              <div className="monet-anim-artist monet-artist-text">{fallbackSong.artist}</div>
              <div className="monet-anim-title monet-title-text">{fallbackSong.title}</div>
              <div className="monet-anim-title monet-album-text">{fallbackSong.album?.name || 'ICHIGOMusic Single'}</div>
            </div>
          </div>
        )}

        {/* Lyrics Rail */}
        <div 
          className="monet-anim-rail" 
          ref={railContainerRef}
          style={{ flex: 1, position: 'relative', zIndex: 2, display: 'flex', alignItems: 'center' }}
        >
          {isKashiMode ? null : isRegularMode ? (
            <MonetLyricsRail
              visibleLines={visibleLines}
              fontPx={dimensions.fontPx}
              translationFontPx={dimensions.transPx}
              fontStack={fontStack}
              containerHeight={dimensions.railHeight}
              maxWidthPx={dimensions.maxWidthPx}
              showTranslation={advancedLyricConfig?.showTranslation !== false}
              showFurigana={advancedLyricConfig?.showFurigana !== false}
              showGlow={advancedLyricConfig?.showGlow === true}
              glowIntensity={advancedLyricConfig?.lyricGlowIntensity ?? 1}
              activeAnchorRatio={(() => {
                if (showCover) {
                  const userExtraOffset = ((advancedLyricConfig?.lyricsPositionY ?? 50) - 50) / 100;
                  return Math.min(0.82, Math.max(0.18, coverAlignedRatio + userExtraOffset));
                } else {
                  return (advancedLyricConfig?.lyricsPositionY ?? 50) / 100;
                }
              })()}
              onWheel={handleWheel}
              onLyricClick={handleLyricClick}
              inactiveLyricBlur={advancedLyricConfig?.inactiveLyricBlur}
            />
          ) : (
            <ImmersiveLyricsStage mode={animMode} lyrics={displayLyrics} activeLineIndex={activeLineIndex} engineRef={engineRef} dimensions={dimensions} fontStack={fontStack} themeColor={themeColor} coverUrl={coverUrlResized} isPlaying={isPlaying} songKey={fallbackSong.id || `${fallbackSong.title}-${fallbackSong.artist}`} songTitle={fallbackSong.title} songArtist={fallbackSong.artist} config={advancedLyricConfig} />
          )}
        </div>
      </div>

      {isKashiMode && (
        <div className="monet-kashi-layer">
          <ImmersiveLyricsStage mode={animMode} lyrics={displayLyrics} activeLineIndex={activeLineIndex} engineRef={engineRef} dimensions={dimensions} fontStack={fontStack} themeColor={themeColor} coverUrl={coverUrlResized} isPlaying={isPlaying} songKey={fallbackSong.id || `${fallbackSong.title}-${fallbackSong.artist}`} songTitle={fallbackSong.title} songArtist={fallbackSong.artist} config={advancedLyricConfig} />
        </div>
      )}

      {/* RIGHT: Cover Art */}
      {showCover && (
      <div className="monet-right-pane" ref={coverPaneRef}>
        <div className="monet-anim-cover-wrapper">
          {animMode === 'regular' && (
            <div style={{ position: 'absolute', inset: '-100px', zIndex: 1, pointerEvents: 'none' }}>
              <MonetAudioOverlay isPlaying={isPlaying} primaryColor={themeColor} animationMode="regular" isBehindCover={true} coverRef={coverImgRef} advancedLyricConfig={advancedLyricConfig} visualizerFps={visualizerFps} showCover={showCoverPreference} />
            </div>
          )}
          <img 
            src={coverUrlResized} 
            alt="Album Cover" 
            className="monet-cover-img"
            ref={coverImgRef}
            style={{ position: 'relative', zIndex: 2 }}
            draggable="false"
          />
        </div>
      </div>
      )}

      {['streamer', 'cloudstep'].includes(animMode) && (
        <div style={{ position: 'absolute', inset: 0, zIndex: animMode === 'streamer' ? 3 : 1, pointerEvents: 'none' }}>
          <MonetAudioOverlay isPlaying={isPlaying} primaryColor={themeColor} animationMode={animMode} isBehindCover={false} advancedLyricConfig={advancedLyricConfig} visualizerFps={visualizerFps} showCover={showCoverPreference} />
        </div>
      )}
    </div>
  );
}

export default React.memo(MonetPosterLayout);
