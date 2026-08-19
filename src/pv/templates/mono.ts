// PV Tool — Copyright (c) 2026 DanteAlighieri13210914
// Licensed under Non-Commercial License. See LICENSE for terms.

import type { TemplateConfig } from '../core/types';

/**
 * 白黒 — Mono Photograph
 * 高对比但干净的黑白：柔灰渐层、细颗粒、深暗角。
 * 配合视频时自动转为高对比黑白画面。
 */
export const monoTemplate: TemplateConfig = {
  name: '白黒(可配视频)',
  nameKey: 'tpl_mono',
  palette: {
    background: '#101010',
    primary: '#f0f0f0',
    secondary: '#666666',
    accent: '#ffffff',
    text: '#f2f2f2',
  },
  bgOpacity: 0.55,
  features: {
    thresholdMedia: true,
  },
  effects: [
    { type: 'meshGradient', layer: 'background', config: {
      colors: ['#2a2a2a', '#161616', '#1f1f1f'], blend: 'normal',
      count: 3, alpha: 0.4, speed: 0.5,
    }},
    { type: 'lyricText', layer: 'text', config: {
      color: '$text', fontSize: 58,
      fontFamily: '"Noto Serif JP", "Yu Mincho", "MS Mincho", serif',
      fontWeight: '500', letterSpacing: 8,
      y: 0.5,
      underline: { color: '$text', thickness: 1.5, lengthFrac: 0.4, offsetFrac: 0.85, alpha: 0.7 },
    }},
    { type: 'filmGrain', layer: 'overlay', config: {
      alpha: 0.09, mono: true, updateInterval: 3,
    }},
    { type: 'vignette', layer: 'overlay', config: {
      color: '#000000', alpha: 0.6,
    }},
  ],
};
