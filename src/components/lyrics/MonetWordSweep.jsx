import React, { useRef, useEffect, useMemo } from 'react';
import { buildGraphemeOffsets, computeFillWidth } from './MonetLyricsEngine';
import { toRubyHtml } from '../../utils/lyrics/furiganaHelper';

// 全局注册表：存放所有当前存在于 DOM 中的 wordSweep 更新函数
// 由顶级 rAF loop 统一调用，彻底绕过 React render
export const wordRegistry = new Set();

const getSweepBleedPx = (fontPx) => Math.max(3, Math.ceil(fontPx * 0.08));
const quantize = (value, factor = 1000) => Math.round(value * factor) / factor;

const setWordVisualState = (el, fillWidth, glowStr = 'none', reveal = 1, scale = 1, y = 0, x = 0, rotate = 0) => {
  if (!el) return;
  el.style.setProperty('--fill-width-px', `${fillWidth}px`);
  el.style.setProperty('--word-glow', glowStr);
  el.style.setProperty('--word-reveal', `${reveal}`);
  el.style.setProperty('--word-scale', `${scale}`);
  el.style.setProperty('--word-y', `${y}px`);
  el.style.setProperty('--word-x', `${x}px`);
  el.style.setProperty('--word-rotate', `${rotate}deg`);
};

function computeGlow(currentTime, startTime, endTime, lineRenderEndTime, fontPx, isChorus, glowIntensity = 1) {
  if (currentTime <= startTime) return 'none';
  const intensityScale = Math.max(0, Math.min(2, Number(glowIntensity) || 0));
  if (intensityScale <= 0) return 'none';
  
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
  
  // Glow strings otherwise change on every audio-clock sample because of
  // tiny floating-point differences. Quantising to a tenth of a pixel keeps
  // the visual pulse smooth while avoiding needless style recalculation.
  const quantizedIntensity = quantize(intensity, 100);
  const r1 = quantize(fontPx * (isChorus ? 0.45 : 0.28) * quantizedIntensity * intensityScale, 10);
  const r2 = quantize(fontPx * (isChorus ? 0.90 : 0.65) * quantizedIntensity * intensityScale, 10);
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
  glowIntensity = 1,
  animationStyle = 'pop',
  showBase = true,
  showFurigana = true
}) {
  const spanRef = useRef(null);
  const fillRef = useRef(null);
  
  // 1. 离线测量字素偏移（每个 token 在其生命周期内只测量一次）
  const graphemeOffsets = useMemo(() => {
    if (!token.timed) return [0];
    return buildGraphemeOffsets(token.text, fontPx, fontStack, 600);
  }, [token.text, token.timed, fontPx, fontStack]);

  // 2. 挂载到全局高刷更新管线
  useEffect(() => {
    if (!token.timed) return;
    
    const fullWidth = graphemeOffsets[graphemeOffsets.length - 1] || 0;
    const sweepBleedPx = getSweepBleedPx(fontPx);
    const edgeSoftness = Math.max(Math.min(fontPx * 0.22, 8), 4);
    const activeMask = `linear-gradient(90deg, black 0px, black calc(var(--fill-width-px) - ${edgeSoftness}px), transparent var(--fill-width-px), transparent 100%)`;

    // Folia-style hot path: only the active line participates in the rAF word
    // sweep. Waiting and passed lines are static, avoiding N visible lines * M
    // words worth of per-frame DOM writes.
    if (status === 'passed') {
      setWordVisualState(spanRef.current, fullWidth, 'none', 1, 1, 0);
      if (fillRef.current) {
        fillRef.current.style.webkitMaskImage = 'none';
        fillRef.current.style.maskImage = 'none';
      }
      return;
    }

    if (status !== 'active') {
      setWordVisualState(spanRef.current, 0, 'none', 0.08, 1, 0);
      if (fillRef.current) {
        fillRef.current.style.webkitMaskImage = activeMask;
        fillRef.current.style.maskImage = activeMask;
      }
      return;
    }

    const lastValueRef = { fillWidth: -1, glowStr: '', timingIndex: 0, reveal: -1, scale: -1, y: -999, x: -999, rotate: -999, finished: false };
    if (fillRef.current) {
      fillRef.current.style.webkitMaskImage = activeMask;
      fillRef.current.style.maskImage = activeMask;
    }

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
      if (!showGlow && lastValueRef.finished && currentTime >= token.endTime) return;

      const fillWidth = computeFillWidthFast(currentTime);

      const glowStr = showGlow
        ? computeGlow(currentTime, token.startTime, token.endTime, lineRenderEndTime, fontPx, isChorus, glowIntensity)
        : 'none';

      // Pass exact float values to CSS. Browsers GPU-accelerate subpixel
      // clip paths perfectly, while JS-side quantization causes micro-stuttering.
      const roundedFillWidth = Math.round(fillWidth * 4) / 4;
      let reveal = animationStyle === 'regular' ? 1 : 0.08;
      let popScale = 1;
      let popY = 0;
      let popX = 0;
      let popRotate = 0;
      const tokenFinished = currentTime >= token.endTime;

      if (animationStyle === 'regular') {
        reveal = 1;
      } else if (currentTime >= token.endTime) {
        reveal = 1;
      } else if (currentTime >= token.startTime) {
        const progress = Math.max(0, Math.min(1, (currentTime - token.startTime) / Math.max(0.001, token.endTime - token.startTime)));
        const pulse = Math.sin(progress * Math.PI);
        const ease = progress * progress * (3 - 2 * progress);
        reveal = 1;
        if (animationStyle === 'spotlight') {
          // 聚光灯：字形轻微吸入舞台中心，不做高频闪烁。
          popScale = 1 + pulse * 0.08;
          popY = -fontPx * 0.08 * pulse;
        } else if (animationStyle === 'starfield') {
          // 星轨：从下方缓慢升起，保持连续运动。
          popScale = 0.86 + ease * 0.14;
          popX = fontPx * 0.30 * (1 - ease);
          popY = fontPx * 0.18 * (1 - ease);
        } else if (animationStyle === 'filmstrip') {
          // 胶片：像画格被扫描一样从下向上进入。
          popScale = 1;
          popX = -fontPx * 0.34 * (1 - ease);
          popY = fontPx * 0.05 * (1 - ease);
        } else if (animationStyle === 'inkflow') {
          // 水墨：柔和扩散，不改变字的位置，避免抖动感。
          popScale = 0.92 + ease * 0.08;
          popY = -fontPx * 0.045 * pulse;
          popRotate = (1 - ease) * 1.2;
        } else {
          popScale = 1 + pulse * 0.12;
          popY = -fontPx * 0.08 * pulse;
        }
      } else if (currentTime >= token.startTime - 0.18) {
        reveal = animationStyle === 'spotlight' ? 0.24 : animationStyle === 'inkflow' ? 0.12 : 0.3;
      }

      if (roundedFillWidth !== lastValueRef.fillWidth || tokenFinished !== lastValueRef.finished) {
        const wasFinished = lastValueRef.finished;
        lastValueRef.fillWidth = roundedFillWidth;
        lastValueRef.finished = tokenFinished;
        el.style.setProperty('--fill-width-px', `${roundedFillWidth + sweepBleedPx}px`);
        if (tokenFinished && fillRef.current) {
          fillRef.current.style.webkitMaskImage = 'none';
          fillRef.current.style.maskImage = 'none';
        } else if (wasFinished && fillRef.current) {
          fillRef.current.style.webkitMaskImage = activeMask;
          fillRef.current.style.maskImage = activeMask;
        }
      }

      if (glowStr !== lastValueRef.glowStr) {
        el.style.setProperty('--word-glow', glowStr);
        lastValueRef.glowStr = glowStr;
      }

      if (reveal !== lastValueRef.reveal) {
        el.style.setProperty('--word-reveal', `${reveal}`);
        lastValueRef.reveal = reveal;
      }
      const nextScale = quantize(popScale);
      const nextY = quantize(popY, 100);
      const nextX = quantize(popX, 100);
      const nextRotate = quantize(popRotate, 100);
      if (nextScale !== lastValueRef.scale) {
        el.style.setProperty('--word-scale', `${nextScale}`);
        lastValueRef.scale = nextScale;
      }
      if (nextY !== lastValueRef.y) {
        el.style.setProperty('--word-y', `${nextY}px`);
        lastValueRef.y = nextY;
      }
      if (nextX !== lastValueRef.x) {
        el.style.setProperty('--word-x', `${nextX}px`);
        lastValueRef.x = nextX;
      }
      if (nextRotate !== lastValueRef.rotate) {
        el.style.setProperty('--word-rotate', `${nextRotate}deg`);
        lastValueRef.rotate = nextRotate;
      }
    };

    wordUpdater(status === 'active' ? token.startTime : token.startTime);
    wordRegistry.add(wordUpdater);

    return () => {
      wordRegistry.delete(wordUpdater);
    };
  }, [token, graphemeOffsets, fontPx, isChorus, lineRenderEndTime, status, showGlow, glowIntensity, animationStyle]);

  const rubyHtml = useMemo(() => (
    showFurigana === false ? token.text : (token.rubyHtml || toRubyHtml(token.text, true))
  ), [token.text, token.rubyHtml, showFurigana]);
  if (!token.timed) {
    // 标点、空格、没有时轴信息的普通字符
    return (
      <span
        className="monet-word-static"
        style={{ whiteSpace: 'pre-wrap', opacity: showBase ? 1 : 1, color: showBase ? undefined : 'transparent' }}
        dangerouslySetInnerHTML={{ __html: rubyHtml }}
      />
    );
  }

  const sweepBleedPx = getSweepBleedPx(fontPx);
  
  // 注意这里的 inline style。由于采用了原生 --fill-width-px 变量进行 mask 切割，
  // 我们避免了每一帧去重新生成 mask 字符串，浏览器硬件层能很好地优化这种 CSS Var 动画。
  return (
    <span 
      ref={spanRef} 
      className={`monet-word-sweep monet-word-sweep--${animationStyle}`} 
      style={{
        position: 'relative',
        display: 'inline-block',
        whiteSpace: 'pre-wrap',
        opacity: animationStyle === 'regular' ? 1 : 'var(--word-reveal, 0.34)',
        transform: 'translate3d(var(--word-x, 0px), var(--word-y, 0px), 0) rotate(var(--word-rotate, 0deg)) scale(var(--word-scale, 1))',
        transformOrigin: 'center bottom',
        paddingLeft: `${sweepBleedPx}px`,
        marginLeft: `-${sweepBleedPx}px`,
        willChange: status === 'active' && animationStyle !== 'regular' ? 'transform, opacity' : 'auto'
      }}
    >
      <span
        className="monet-word-base"
        style={{ opacity: showBase ? (status === 'active' ? (animationStyle === 'regular' ? 0.58 : 0.28) : 1) : 0, textShadow: showGlow ? 'var(--word-glow, none)' : 'none' }}
        dangerouslySetInnerHTML={{ __html: rubyHtml }}
      />
      <span 
        ref={fillRef}
        className="monet-word-fill"
        style={{
          position: 'absolute',
          left: 0, top: 0,
          paddingLeft: `${sweepBleedPx}px`,
          whiteSpace: 'pre-wrap',
          color: 'var(--primary)',
          textShadow: showGlow ? 'var(--word-glow, none)' : 'none',
          WebkitMaskRepeat: 'no-repeat',
          maskRepeat: 'no-repeat'
        }}
        dangerouslySetInnerHTML={{ __html: rubyHtml }}
      />
    </span>
  );
}
