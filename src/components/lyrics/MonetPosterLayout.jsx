import React, { useState, useEffect, useMemo, useRef } from 'react';
import { buildVisibleWindow } from './MonetLyricsEngine';
import MonetLyricsRail from './MonetLyricsRail';
import MonetAudioOverlay from './MonetAudioOverlay';
import MonetFloatingDecor from './MonetFloatingDecor';
import StreamerLyrics from './StreamerLyrics';
import TiltLyrics from './TiltLyrics';
import CloudStepLyrics from './CloudStepLyrics';
import { useApp } from '../../context/AppContext';

export default function MonetPosterLayout({ 
  lyrics, 
  activeLineIndex, 
  currentSong, 
  isPlaying, 
  currentTimeRef,
  currentTime,
  themeColor,
  coverUrl,
  audioAnalyser,
  engineRef
}) {
  const { advancedLyricConfig, seekTo, layoutMode } = useApp();
  const animMode = advancedLyricConfig?.animationMode || 'regular';
  const isRegularMode = animMode === 'regular';
  const showCover = advancedLyricConfig?.showCover !== false && isRegularMode;
  const enableDecor = advancedLyricConfig?.showDecor === true;
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
    // 鼠标滚轮翻页预览歌词，每次滚动约 1.5 秒的时间跨度
    const delta = e.deltaY > 0 ? 1.5 : -1.5;
    setManualScrollOffset(prev => prev + delta);
    
    if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    // 停止滚动 3 秒后自动恢复跟随播放进度
    scrollTimeoutRef.current = setTimeout(() => {
      setManualScrollOffset(0);
    }, 3000);
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
  // Responsive Layout Tracking for Canvas exact pixel measurements
  const [dimensions, setDimensions] = useState({
    fontPx: 36 * fontScale,
    transPx: 18 * fontScale,
    maxWidthPx: 600,
    railHeight: 500
  });

  const railContainerRef = useRef(null);

  useEffect(() => {
    const handleResize = () => {
      const w = window.innerWidth;
      let fPx = 36;
      let tPx = 18;
      if (w > 1600) { fPx = 42; tPx = 20; }
      else if (w > 1200) { fPx = 36; tPx = 18; }
      else if (w > 800) { fPx = 28; tPx = 15; }
      else { fPx = 24; tPx = 14; }

      let maxWidth = 600;
      let railH = 500;
      if (railContainerRef.current) {
        const rect = railContainerRef.current.getBoundingClientRect();
        maxWidth = rect.width * 0.95;
        railH = rect.height;
      }

      setDimensions({
        fontPx: fPx * fontScale,
        transPx: tPx * fontScale,
        maxWidthPx: maxWidth,
        railHeight: railH
      });
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [fontScale]);

  const visibleLines = useMemo(() => {
    const configuredLines = advancedLyricConfig?.visibleLines || 5;
    const linesToKeep = Math.max(1, Math.min(configuredLines, 5));
    const half = Math.floor(linesToKeep / 2);
    const baseTime = currentTime ?? currentTimeRef?.current ?? 0;
    const displayTime = Math.max(0, baseTime + manualScrollOffset);
    
    let effectiveActiveIndex = activeLineIndex;
    // During normal playback the lyric engine's activeLineIndex is the single
    // source of truth. Recomputing from a stale currentTimeRef during the same
    // render can lag by one line and center the previous lyric instead.
    if (manualScrollOffset !== 0 && lyrics && lyrics.length > 0) {
      for (let i = lyrics.length - 1; i >= 0; i--) {
        if (displayTime >= lyrics[i].time) {
          effectiveActiveIndex = i;
          break;
        }
      }
    }
    const sourceLyrics = advancedLyricConfig?.showTranslation === false
      ? lyrics.map(line => ({ ...line, translation: '' }))
      : lyrics;
    return buildVisibleWindow(sourceLyrics, effectiveActiveIndex, displayTime, { before: half, after: half });
  }, [lyrics, activeLineIndex, currentTime, manualScrollOffset, advancedLyricConfig?.visibleLines, advancedLyricConfig?.showTranslation]);

  // Active Intro Key logic for transitions on song change
  const [introKey, setIntroKey] = useState(currentSong?.id || 'initial');
  useEffect(() => {
    if (currentSong?.id) {
      setIntroKey(currentSong.id);
    }
  }, [currentSong?.id]);

  const fallbackSong = {
    title: '听你所想，享你所爱',
    artist: 'ICHIGOMusic',
    coverUrl: 'https://p2.music.126.net/UeTuwE7Cx877Y2gCGIseYg==/109951163026279185.jpg',
    ...currentSong
  };

  const safeCoverUrl = coverUrl || fallbackSong.coverUrl || 'https://p2.music.126.net/UeTuwE7Cx877Y2gCGIseYg==/109951163026279185.jpg';
  const coverUrlResized = safeCoverUrl.includes('?') 
    ? safeCoverUrl 
    : `${safeCoverUrl}?param=600y600`;

  useEffect(() => {
    if (audioAnalyser) window.ichigoAnalyser = audioAnalyser;
  }, [audioAnalyser]);

  return (
    <div key={introKey} className="monet-poster-layout" style={{ width: '100%', height: '100%', position: 'relative' }}>
      <style>
        {`
          .monet-poster-layout {
            display: flex;
            flex-direction: row;
            padding: 5vh 4vw 80px 4vw;
            box-sizing: border-box;
            gap: 4vw;
            align-items: stretch;
            height: 100%;
          }
          
          .monet-left-pane {
            flex: ${showCover === false ? '1 1 100%' : '1'};
            display: flex;
            flex-direction: column;
            min-width: 0;
          }

          .monet-right-pane {
            flex-basis: clamp(260px, 32vw, 550px);
            display: flex;
            align-items: center;
            justify-content: center;
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
        `}
      </style>

      {/* Background Decor: disabled by default for smoother lyric rendering. */}
      {enableDecor && <MonetFloatingDecor />}

      {/* LEFT: Metadata & Lyrics */}
      <div className="monet-left-pane">
        
        {/* Header Metadata */}
        <div style={{ display: 'flex', gap: '24px', marginBottom: '4vh', position: 'relative', zIndex: 2 }}>
          <div className="monet-anim-line" style={{ width: '4px', background: 'var(--primary)', borderRadius: '4px' }} />
          <div>
            <div className="monet-anim-artist monet-artist-text">{fallbackSong.artist}</div>
            <div className="monet-anim-title monet-title-text">{fallbackSong.title}</div>
            <div className="monet-anim-title monet-album-text">{fallbackSong.album?.name || 'ICHIGOMusic Single'}</div>
          </div>
        </div>

        {/* Lyrics Rail */}
        <div 
          className="monet-anim-rail" 
          ref={railContainerRef}
          style={{ flex: 1, position: 'relative', zIndex: 2, display: 'flex', alignItems: 'center' }}
        >
          {isRegularMode ? (
            <MonetLyricsRail
              visibleLines={visibleLines}
              fontPx={dimensions.fontPx}
              translationFontPx={dimensions.transPx}
              fontStack={fontStack}
              containerHeight={dimensions.railHeight}
              maxWidthPx={dimensions.maxWidthPx}
              showTranslation={advancedLyricConfig?.showTranslation !== false}
              showGlow={advancedLyricConfig?.showGlow === true}
              activeAnchorRatio={(advancedLyricConfig?.lyricsPositionY || 50) / 100}
              onWheel={handleWheel}
              onLyricClick={handleLyricClick}
              inactiveLyricBlur={advancedLyricConfig?.inactiveLyricBlur}
            />
          ) : (
            <div style={{ width: '100%' }}>
              {animMode === 'streamer' && (
                <StreamerLyrics
                  line={lyrics[activeLineIndex] || { text: 'ICHIGOMusic', time: 0, duration: 5 }}
                  engineRef={engineRef}
                  fontPx={dimensions.fontPx}
                  fontStack={fontStack}
                  themeColor="var(--primary)"
                  showGlow={advancedLyricConfig?.showGlow === true}
                  globalOffset={advancedLyricConfig?.globalOffset || 0}
                />
              )}
              {animMode === 'tilt' && (
                <TiltLyrics
                  line={lyrics[activeLineIndex] || { text: 'ICHIGOMusic', time: 0, duration: 5 }}
                  engineRef={engineRef}
                  fontPx={dimensions.fontPx}
                  fontStack={fontStack}
                  themeColor="var(--primary)"
                  showGlow={advancedLyricConfig?.showGlow === true}
                  globalOffset={advancedLyricConfig?.globalOffset || 0}
                />
              )}
              {animMode === 'cloudStep' && (
                <CloudStepLyrics
                  line={lyrics[activeLineIndex] || { text: 'ICHIGOMusic', time: 0, duration: 5 }}
                  engineRef={engineRef}
                  fontPx={dimensions.fontPx}
                  fontStack={fontStack}
                  themeColor="var(--primary)"
                  showGlow={advancedLyricConfig?.showGlow === true}
                  globalOffset={advancedLyricConfig?.globalOffset || 0}
                />
              )}
            </div>
          )}
        </div>
      </div>

      {/* RIGHT: Cover Art */}
      {showCover && (
      <div className="monet-right-pane">
        <div className="monet-anim-cover-wrapper">
          {/* Render circular visualizer behind the cover image if style is circle/circular */}
          {['circle', 'circular'].includes(advancedLyricConfig?.visualizerStyle) && (
            <div style={{ position: 'absolute', inset: '-100px', zIndex: 1, pointerEvents: 'none' }}>
              <MonetAudioOverlay isPlaying={isPlaying} primaryColor={themeColor} visualizerStyle="circle" isBehindCover={true} />
            </div>
          )}
          <img 
            src={coverUrlResized} 
            alt="Album Cover" 
            className="monet-cover-img"
            style={{ position: 'relative', zIndex: 2 }}
            draggable="false"
          />
        </div>
      </div>
      )}

      {/* BOTTOM: Audio Visualizer */}
      {!['off', 'none', 'circle', 'circular'].includes(advancedLyricConfig?.visualizerStyle) && (
      <div className="monet-anim-rail" style={{ 
        animationDelay: '0.9s', 
        position: 'absolute', 
        bottom: layoutMode === 'classic' ? '88px' : '12px', 
        left: 0, 
        right: 0, 
        height: '80px', 
        zIndex: 10, 
        pointerEvents: 'none' 
      }}>
        <MonetAudioOverlay isPlaying={isPlaying} primaryColor={themeColor} visualizerStyle={advancedLyricConfig?.visualizerStyle || 'bars'} />
      </div>
      )}
    </div>
  );
}
