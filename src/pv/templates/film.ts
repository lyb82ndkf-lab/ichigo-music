// PV Tool — Copyright (c) 2026 DanteAlighieri13210914
// Licensed under Non-Commercial License. See LICENSE for terms.

import type { TemplateConfig } from '../core/types';

/**
 * フィルム — Vintage Film
 * 暖棕褪色、彩色颗粒、一角漏光、窄黑边——老胶片的温度。
 */
export const filmTemplate: TemplateConfig = {
  name: 'フィルム',
  nameKey: 'tpl_film',
  palette: {
    background: '#241c14',
    primary: '#d8b48a',
    secondary: '#8a6a4a',
    accent: '#f0d0a0',
    text: '#ecd9bd',
  },
  bpm: 85,
  effects: [
    { type: 'meshGradient', layer: 'background', config: {
      colors: ['#3a2a1a', '#241c14', '#2e2016'], blend: 'add',
      count: 3, alpha: 0.45, speed: 0.4,
    }},
    { type: 'lightSpot', layer: 'decoration', config: {
      color: '#f0a050', x: 0.92, y: 0.08, alpha: 0.35, size: 0.55,
    }},
    { type: 'letterbox', layer: 'decoration', config: {
      color: '#000000', heightFrac: 0.07, alpha: 1,
    }},
    { type: 'lyricText', layer: 'text', config: {
      color: '$text', fontSize: 54,
      fontFamily: '"Noto Serif JP", "Yu Mincho", "MS Mincho", serif',
      fontWeight: '500', letterSpacing: 8,
      y: 0.5,
    }},
    { type: 'filmGrain', layer: 'overlay', config: {
      alpha: 0.12, mono: false, updateInterval: 3,
    }},
    { type: 'vignette', layer: 'overlay', config: {
      color: '#120a04', alpha: 0.55,
    }},
  ],
};
