// PV Tool — Copyright (c) 2026 DanteAlighieri13210914
// Licensed under Non-Commercial License. See LICENSE for terms.

import type { TemplateConfig } from '../core/types';

/**
 * 都市蓝调 — City Pop
 * 80年代落日：紫夜渐变、割缝落日、远处的海平线波光。
 */
export const cityPopTemplate: TemplateConfig = {
  name: '都市蓝调',
  nameKey: 'tpl_cityPop',
  palette: {
    background: '#1a0b2e',
    primary: '#ff9e4a',
    secondary: '#ff2975',
    accent: '#ffd319',
    text: '#ffe8d0',
  },
  bpm: 115,
  effects: [
    { type: 'gradientOverlay', layer: 'background', config: {
      colorTop: '#2a0f42', colorMid: '#38144a', colorBottom: '#0d0618',
      alpha: 0.95, mode: 'linear',
    }},
    { type: 'retroSun', layer: 'decoration', config: {
      colorTop: '#ffd319', colorBottom: '#ff2975',
      x: 0.5, y: 0.52, sizeFrac: 0.65, beatPulse: 0.03,
    }},
    { type: 'waveLines', layer: 'decoration', config: {
      color: '#ff9e4a', y: 0.82, spread: 0.1, layers: 3,
      amplitude: 14, speed: 0.35, alpha: 0.4,
    }},
    { type: 'lyricText', layer: 'text', config: {
      color: '$text', fontSize: 60,
      fontFamily: '"Outfit", "Noto Sans JP", "Hiragino Kaku Gothic Pro", sans-serif',
      fontWeight: '700', letterSpacing: 6,
      y: 0.22,
      glowColor: '#ff9e4a', glowAlpha: 0.6, glowBlur: 16,
    }},
    { type: 'vignette', layer: 'overlay', config: {
      color: '#0a0414', alpha: 0.45,
    }},
  ],
};
