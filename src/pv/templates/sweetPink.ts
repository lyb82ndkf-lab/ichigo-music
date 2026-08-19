// PV Tool — Copyright (c) 2026 DanteAlighieri13210914
// Licensed under Non-Commercial License. See LICENSE for terms.

import type { TemplateConfig } from '../core/types';

/**
 * 少女云朵 — Sweet Pink / Girly Clouds
 * 梦幻草莓牛奶与棉花糖浮云、粉嫩漂浮爱心与糖果星芒、圆润可爱的软糖文字。
 */
export const sweetPinkTemplate: TemplateConfig = {
  name: '少女云朵',
  nameKey: 'tpl_sweetPink',
  palette: {
    background: '#fff0f6',
    primary: '#ff85b3',
    secondary: '#b8668c',
    accent: '#ffb3d9',
    text: '#5c3349',
  },
  bpm: 105,
  effects: [
    { type: 'gradientOverlay', layer: 'background', config: {
      colorTop: '#fff5f9', colorBottom: '#fbe8f2', alpha: 0.95, mode: 'linear',
    }},
    { type: 'meshGradient', layer: 'background', config: {
      colors: ['#ffe4f0', '#fce8ff', '#e6f3ff'], blend: 'normal',
      count: 4, alpha: 0.55, speed: 0.5,
    }},
    { type: 'fluffyClouds', layer: 'decoration', config: {
      cloudCount: 8, sparkleCount: 28,
    }},
    { type: 'lyricText', layer: 'text', config: {
      color: '$text', fontSize: 56,
      fontFamily: '"PingFang SC", "Microsoft YaHei", "Outfit", sans-serif',
      fontWeight: '600', letterSpacing: 6,
      y: 0.48,
      sideBars: { color: '$primary', thickness: 3, lengthFrac: 0.4, gap: 24, alpha: 0.85 },
    }},
  ],
};
