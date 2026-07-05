import React, { useRef, useEffect, useMemo } from 'react';
import { buildGraphemeOffsets, computeFillWidth } from './MonetLyricsEngine';

// 全局注册表：存放所有当前存在于 DOM 中的 wordSweep 更新函数
// 由顶级 rAF loop 统一调用，彻底绕过 React render
export const wordRegistry = new Set();

const setWordVisualState = (el, fillWidth, glowStr = 'none', reveal = 1, scale = 1, y = 0) => {
  if (!el) return;
  el.style.setProperty('--fill-width-px', `${fillWidth}px`);
  el.style.setProperty('--word-glow', glowStr);
  el.style.setProperty('--word-reveal', `${reveal}`);
  el.style.setProperty('--word-scale', `${scale}`);
  el.style.setProperty('--word-y', `${y}px`);
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
  showGlow = false,
  animationStyle = 'pop'
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
      setWordVisualState(spanRef.current, fullWidth, 'none', 1, 1, 0);
      return;
    }

    if (status !== 'active') {
      setWordVisualState(spanRef.current, 0, 'none', 0.08, 1, 0);
      return;
    }

    const lastValueRef = { fillWidth: -1, glowStr: '', timingIndex: 0, reveal: -1, scale: -1, y: -999 };

    const computeFillWidthFast = (currentTime) => {
      if (currentTime <= token.startTime) {
        lastValueRef.timingIndex = 0;
        return 0;
      }
      if (currentTime >= token.endTime) return fullWidth;

      const timings = token.graphemeTimings || [];
      let i = Math.min(lastValueRef.timingIndex, Math.max(0, timings.length - 1));

      while (i > 0 && currentTime < timings[i].startTime) i -= 1;
      while (i < timings.length - 1 && currentTime > timings[i].endTime) i += 1;
      lastValueRef.timingIndex = i;

      const timing = timings[i];
      if (!timing) {
        return computeFillWidth(currentTime, token.startTime, token.endTime, timings, graphemeOffsets);
      }

      if (currentTime < timing.startTime) return graphemeOffsets[i] || 0;
      if (currentTime <= timing.endTime) {
        const duration = Math.max(0.001, timing.endTime - timing.startTime);
        const progress = (currentTime - timing.startTime) / duration;
        const startWidth = graphemeOffsets[i] || 0;
        const endWidth = graphemeOffsets[i + 1] ?? startWidth;
        return startWidth + (endWidth - startWidth) * progress;
      }

      return graphemeOffsets[Math.min(i + 1, graphemeOffsets.length - 1)] || fullWidth;
    };

    const wordUpdater = (currentTime) => {
      if (!spanRef.current) return;
      const el = spanRef.current;

      const fillWidth = computeFillWidthFast(currentTime);

      const glowStr = showGlow
        ? computeGlow(currentTime, token.startTime, token.endTime, lineRenderEndTime, fontPx, isChorus)
        : 'none';

      // Pass exact float values to CSS. Browsers GPU-accelerate subpixel
      // clip paths perfectly, while JS-side quantization causes micro-stuttering.
      const roundedFillWidth = fillWidth;
      let reveal = animationStyle === 'regular' ? 1 : 0.08;
      let popScale = 1;
      let popY = 0;

      if (animationStyle === 'regular') {
        reveal = 1;
      } else if (currentTime >= token.endTime) {
        reveal = 1;
      } else if (currentTime >= token.startTime) {
        const progress = Math.max(0, Math.min(1, (currentTime - token.startTime) / Math.max(0.001, token.endTime - token.startTime)));
        const pulse = Math.sin(progress * Math.PI);
        reveal = 1;
        popScale = 1 + pulse * 0.18;
        popY = -fontPx * 0.12 * pulse;
      } else if (currentTime >= token.startTime - 0.18) {
        reveal = 0.42;
      }

      if (roundedFillWidth !== lastValueRef.fillWidth) {
        el.style.setProperty('--fill-width-px', `${roundedFillWidth}px`);
        lastValueRef.fillWidth = roundedFillWidth;
      }

      if (glowStr !== lastValueRef.glowStr) {
        el.style.setProperty('--word-glow', glowStr);
        lastValueRef.glowStr = glowStr;
      }

      if (reveal !== lastValueRef.reveal) {
        el.style.setProperty('--word-reveal', `${reveal}`);
        lastValueRef.reveal = reveal;
      }
      if (popScale !== lastValueRef.scale) {
        el.style.setProperty('--word-scale', `${popScale}`);
        lastValueRef.scale = popScale;
      }
      if (popY !== lastValueRef.y) {
        el.style.setProperty('--word-y', `${popY}px`);
        lastValueRef.y = popY;
      }
    };

    wordUpdater(token.startTime);
    wordRegistry.add(wordUpdater);

    return () => {
      wordRegistry.delete(wordUpdater);
    };
  }, [token, graphemeOffsets, fontPx, isChorus, lineRenderEndTime, status, showGlow, animationStyle]);

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
      style={{
        position: 'relative',
        display: 'inline-block',
        whiteSpace: 'pre-wrap',
        opacity: animationStyle === 'regular' ? 1 : 'var(--word-reveal, 0.34)',
        transform: 'translate3d(0, var(--word-y, 0px), 0) scale(var(--word-scale, 1))',
        transformOrigin: 'center bottom',
        willChange: status === 'active' && animationStyle !== 'regular' ? 'transform, opacity' : 'auto'
      }}
    >
      <span className="monet-word-base" style={{ opacity: status === 'active' ? (animationStyle === 'regular' ? 0.42 : 0.28) : 0.35, textShadow: showGlow ? 'var(--word-glow, none)' : 'none' }}>
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
