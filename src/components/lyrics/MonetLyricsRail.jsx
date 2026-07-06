import React, { useMemo, useRef } from 'react';
import { measureLineLayout, parseDisplayTokens } from './MonetLyricsEngine';
import MonetWordSweep from './MonetWordSweep';

/**
 * MonetRailLine component
 */
const MonetRailLine = React.memo(({ entry, fontPx, translationFontPx, fontStack, y, maxWidthPx, showTranslation, showGlow, onClick, inactiveLyricBlur }) => {
  const { line, status, offset, layout } = entry;
  
  const tokens = useMemo(() => parseDisplayTokens(line), [line]);
  const tokenRows = useMemo(() => [tokens], [tokens]);
  const isChorus = line.isChorus || false;

  // 根据 status 设置不同样式
  let opacity = 0;
  let scale = 1;
  let blur = 0;
  let fontWeight = 500;
  let color = 'var(--text-main)';

  if (status === 'active') {
    opacity = 1;
    scale = 1;
    blur = 0;
    fontWeight = 600;
    color = 'var(--text-main)';
  } else {
    // 距离中心越远，越透明且越小，并且添加模糊
    const distance = Math.abs(offset);
    const blurAmount = inactiveLyricBlur !== undefined ? inactiveLyricBlur : 0.8;
    opacity = Math.max(0.15, 0.72 - distance * 0.15);
    scale = Math.max(0.7, 0.92 - distance * 0.08);
    // Keep blur bounded like folia-major; large animated CSS filters are one of
    // the most expensive paint paths in the immersive view.
    blur = Math.min(3.2, distance * blurAmount);
    fontWeight = 500;
    color = 'var(--text-muted)';
  }

  const rotateX = status === 'active' ? 0 : (offset < 0 ? 15 : -15);
  const lineEndTime = line.time + (line.duration || 5);

  return (
    <div 
      className={`monet-rail-line ${status}`}
      onClick={onClick}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        transform: `translateY(${y}px) scale(${scale}) perspective(800px) rotateX(${rotateX}deg)`,
        opacity: opacity,
        filter: blur > 0 ? `blur(${blur}px)` : 'none',
        transformOrigin: 'left center',
        transition: 'transform 0.6s cubic-bezier(0.25, 1, 0.5, 1), opacity 0.6s ease, filter 0.6s ease, color 0.6s ease',
        willChange: 'transform, opacity',
        display: 'flex',
        flexDirection: 'column',
        gap: `${fontPx * 0.2}px`,
        background: (showGlow && status === 'active')
          ? 'radial-gradient(circle at 30% 50%, var(--primary-subtle) 0%, transparent 60%)'
          : 'none',
        padding: `${fontPx * 0.16}px 0`
      }}
    >
      <div 
        className="monet-line-main"
        style={{
          fontSize: `${fontPx}px`,
          fontWeight: fontWeight,
          color: color,
          lineHeight: 1.18,
          display: 'block',
          wordBreak: 'break-word',
          whiteSpace: 'normal',
        }}
      >
        {tokenRows.map((row, rowIndex) => (
          <span
            key={`row-${rowIndex}`}
            className="monet-line-row"
            style={{
              display: 'inline-block',
              whiteSpace: 'normal',
              wordBreak: 'break-word',
              minHeight: `${fontPx * 1.18}px`,
              marginTop: rowIndex === 0 ? 0 : `${fontPx * 0.04}px`
            }}
          >
            {row.map((token) => (
              <MonetWordSweep
                key={token.key}
                token={token}
                fontPx={fontPx}
                fontStack={fontStack}
                isChorus={isChorus}
                lineRenderEndTime={lineEndTime}
                status={status}
                showGlow={showGlow}
                animationStyle="regular"
              />
            ))}
          </span>
        ))}
      </div>
      
      {showTranslation && line.translation && (
        <div 
          className="monet-line-translation"
          style={{
            fontSize: `${translationFontPx}px`,
            fontWeight: 500,
            color: 'var(--text-muted)',
            lineHeight: 1.28,
            marginTop: `${translationFontPx * 0.2}px`,
            opacity: status === 'active' ? 0.9 : 0.6
          }}
        >
          {line.translation}
        </div>
      )}
    </div>
  );
});

export default function MonetLyricsRail({ visibleLines, fontPx, translationFontPx, fontStack, containerHeight, maxWidthPx, showTranslation = true, showGlow = false, activeAnchorRatio = 0.5, onWheel, onLyricClick, inactiveLyricBlur }) {
  const containerRef = useRef(null);

  // 计算每一行 Y 的绝对位置
  const positionedLines = useMemo(() => {
    if (!visibleLines || visibleLines.length === 0) return [];

    // 1. 先测量每一行的 layout 物理高度
    const linesWithLayout = visibleLines.map(entry => {
      const lineForLayout = showTranslation ? entry.line : { ...entry.line, translation: '' };
      const layout = measureLineLayout(lineForLayout, fontPx, translationFontPx, fontStack, maxWidthPx);
      return { ...entry, layout };
    });

    // 2. 锚点计算 (offset === 0 的活跃行作为中心基准，让其处于 activeAnchorRatio 比例处)
    let anchorIndex = linesWithLayout.findIndex(e => e.offset === 0);
    if (anchorIndex === -1) anchorIndex = 0;

    const anchorY = containerHeight * activeAnchorRatio; 
    // 3. 向下计算坐标
    for (let i = anchorIndex; i < linesWithLayout.length; i++) {
      if (i === anchorIndex) {
        linesWithLayout[i].y = anchorY - (linesWithLayout[i].layout.visualHeightPx / 2);
      } else {
        const prev = linesWithLayout[i - 1];
        const gap = (prev.status === 'active' || linesWithLayout[i].status === 'active') ? 24 : 16;
        linesWithLayout[i].y = prev.y + prev.layout.visualHeightPx + gap;
      }
    }

    // 4. 向上计算坐标
    for (let i = anchorIndex - 1; i >= 0; i--) {
      const next = linesWithLayout[i + 1];
      const current = linesWithLayout[i];
      const gap = (next.status === 'active' || current.status === 'active') ? 24 : 16;
      current.y = next.y - current.layout.visualHeightPx - gap;
    }

    return linesWithLayout;
  }, [visibleLines, fontPx, translationFontPx, fontStack, containerHeight, maxWidthPx, activeAnchorRatio, showTranslation]);

  return (
    <div 
      className="monet-rail-container" 
      ref={containerRef}
      onWheel={onWheel}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 5%, black 90%, transparent 100%)',
        maskImage: 'linear-gradient(to bottom, transparent 0%, black 5%, black 90%, transparent 100%)',
        contain: 'layout paint style'
      }}
    >
      {positionedLines.map(entry => (
        <MonetRailLine 
          key={entry.key}
          entry={entry}
          fontPx={fontPx}
          translationFontPx={translationFontPx}
          fontStack={fontStack}
          y={entry.y}
          maxWidthPx={maxWidthPx}
          showTranslation={showTranslation}
          showGlow={showGlow}
          onClick={() => onLyricClick && onLyricClick(entry.line)}
          inactiveLyricBlur={inactiveLyricBlur}
        />
      ))}
    </div>
  );
}

