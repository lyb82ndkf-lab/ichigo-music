import React, { useRef, useEffect, useMemo } from 'react';
import { buildGraphemeOffsets, computeFillWidth } from './MonetLyricsEngine';

// 全局注册表：存放所有当前存在于 DOM 中的 wordSweep 更新函数
// 由顶级 rAF loop 统一调用，彻底绕过 React render
export const wordRegistry = new Set();

const setWordVisualState = (el, fillWidth, glowStr = 'none') => {
  if (!el) return;
  el.style.setProperty('--fill-width-px', `${fillWidth}px`);
  el.style.setProperty('--word-glow', glowStr);
};

function computeGlow(currentTime, startTime, endTime, lineRenderEndTime, fontPx, isChorus) {
  if (currentTime <= startTime) return 'none';
  
  const wordDuration = Math.max(0.01, endTime - startTime);
  const glowRiseDuration = wordDuration * 1.18;
  const glowPeakTime = startTime + glowRiseDuration;
  // 尾部衰减时间必须至少延续到该行结束，并多加 1.05 秒余量
  const glowTailEndTime = Math.max(lineRenderEndTime, endTime + 1.05);
  
  let intensity = 0;
  if (currentTime <= glowPeakTime) {
    const t = Math.max(0, (currentTime - startTime) / glowRiseDuration);
    intensity = t * t * (3 - 2 * t); // smoothstep rise
  } else if (currentTime <= glowTailEndTime) {
    const t = Math.min(1, (currentTime - glowPeakTime) / (glowTailEndTime - glowPeakTime));
    const remaining = 1 - t;
    intensity = remaining * remaining * (3 - 2 * remaining); // smoothstep decay
  }
  
  if (intensity <= 0.01) return 'none';
  
  const r1 = fontPx * (isChorus ? 0.45 : 0.28) * intensity;
  const r2 = fontPx * (isChorus ? 0.90 : 0.65) * intensity;
  const glowColor = 'var(--primary)'; // 动态调用当前主题色
  return `0 0 ${r1}px ${glowColor}, 0 0 ${r2}px ${glowColor}`;
}

export default function MonetWordSweep({ 
  token, 
  fontPx, 
  fontStack, 
  isChorus, 
  lineRenderEndTime,
  status,
  showGlow = false
}) {
  const spanRef = useRef(null);
  
  // 1. 离线测量字素偏移（每个 token 在其生命周期内只测量一次）
  const graphemeOffsets = useMemo(() => {
    if (!token.timed) return [0];
    return buildGraphemeOffsets(token.text, fontPx, fontStack, 600);
  }, [token.text, token.timed, fontPx, fontStack]);

  // 2. 挂载到全局高刷更新管线
  useEffect(() => {
    if (!token.timed) return;
    
    const fullWidth = graphemeOffsets[graphemeOffsets.length - 1] || 0;

    // Folia-style hot path: only the active line participates in the rAF word
    // sweep. Waiting and passed lines are static, avoiding N visible lines * M
    // words worth of per-frame DOM writes.
    if (status === 'passed') {
      setWordVisualState(spanRef.current, fullWidth, 'none');
      return;
    }

    if (status !== 'active') {
      setWordVisualState(spanRef.current, 0, 'none');
      return;
    }

    const lastValueRef = { fillWidth: -1, glowStr: '' };

    const wordUpdater = (currentTime) => {
      if (!spanRef.current) return;
      const el = spanRef.current;

      const fillWidth = computeFillWidth(
        currentTime,
        token.startTime,
        token.endTime,
        token.graphemeTimings,
        graphemeOffsets
      );

      const glowStr = showGlow
        ? computeGlow(currentTime, token.startTime, token.endTime, lineRenderEndTime, fontPx, isChorus)
        : 'none';

      // Quantize tiny sub-pixel changes so 60fps doesn't force style recalcs for
      // imperceptible deltas.
      const roundedFillWidth = Math.round(fillWidth * 10) / 10;

      if (roundedFillWidth !== lastValueRef.fillWidth) {
        el.style.setProperty('--fill-width-px', `${roundedFillWidth}px`);
        lastValueRef.fillWidth = roundedFillWidth;
      }

      if (glowStr !== lastValueRef.glowStr) {
        el.style.setProperty('--word-glow', glowStr);
        lastValueRef.glowStr = glowStr;
      }
    };

    wordUpdater(token.startTime);
    wordRegistry.add(wordUpdater);

    return () => {
      wordRegistry.delete(wordUpdater);
    };
  }, [token, graphemeOffsets, fontPx, isChorus, lineRenderEndTime, status, showGlow]);

  if (!token.timed) {
    // 标点、空格、没有时轴信息的普通字符
    return (
      <span className="monet-word-static" style={{ whiteSpace: 'pre-wrap', opacity: status === 'active' ? 1 : 0.4 }}>
        {token.text}
      </span>
    );
  }

  const edgeSoftness = Math.max(Math.min(fontPx * 0.45, 16), 6);
  
  // 注意这里的 inline style。由于采用了原生 --fill-width-px 变量进行 mask 切割，
  // 我们避免了每一帧去重新生成 mask 字符串，浏览器硬件层能很好地优化这种 CSS Var 动画。
  return (
    <span 
      ref={spanRef} 
      className="monet-word-sweep" 
      style={{ position: 'relative', display: 'inline-block', whiteSpace: 'pre-wrap' }}
    >
      <span className="monet-word-base" style={{ opacity: 0.35, textShadow: showGlow ? 'var(--word-glow, none)' : 'none' }}>
        {token.text}
      </span>
      <span 
        className="monet-word-fill"
        style={{
          position: 'absolute',
          left: 0, top: 0,
          whiteSpace: 'pre-wrap',
          color: 'var(--text-main)',
          textShadow: 'none',
          WebkitMaskImage: `linear-gradient(90deg, black 0px, black calc(max(var(--fill-width-px, 0px) - ${edgeSoftness}px, 0px)), rgba(0,0,0,0.92) calc(max(var(--fill-width-px, 0px) - ${edgeSoftness * 0.55}px, 0px)), transparent max(var(--fill-width-px, 0px), 0px), transparent 100%)`,
          maskImage: `linear-gradient(90deg, black 0px, black calc(max(var(--fill-width-px, 0px) - ${edgeSoftness}px, 0px)), rgba(0,0,0,0.92) calc(max(var(--fill-width-px, 0px) - ${edgeSoftness * 0.55}px, 0px)), transparent max(var(--fill-width-px, 0px), 0px), transparent 100%)`
        }}
      >
        {token.text}
      </span>
    </span>
  );
}
