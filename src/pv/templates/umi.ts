// PV Tool — Copyright (c) 2026 DanteAlighieri13210914
// Licensed under Non-Commercial License. See LICENSE for terms.

import type { TemplateConfig } from '../core/types';

/**
 * 海 — Sea
 * 深青海水、透下的光、缓缓上升的微气泡与层层波痕。
 */
export const umiTemplate: TemplateConfig = {
  name: '海',
  nameKey: 'tpl_umi',
  palette: {
    background: '#041824',
    primary: '#5cd3ea',
    secondary: '#a8f5ff',
    accent: '#e0ffff',
    text: '#f0fbff',
  },
  bpm: 90,
  effects: [
    { type: 'gradientOverlay', layer: 'background', config: {
      colorTop: '#041420', colorBottom: '#0a3242', alpha: 0.95, mode: 'linear',
    }},
    { type: 'lightSpot', layer: 'background', config: {
      color: '#8fe8f0', x: 0.5, y: -0.05, alpha: 0.35, size: 0.9,
    }},
    { type: 'waveLines', layer: 'decoration', config: {
      y: 0.72, spread: 0.14, layers: 4, amplitude: 28, speed: 0.45,
    }},
    { type: 'lyricText', layer: 'text', config: {
      color: '$text', fontSize: 56,
      fontFamily: '"Noto Serif JP", "Yu Mincho", "MS Mincho", serif',
      fontWeight: '500', letterSpacing: 8,
      y: 0.42,
      sideBars: { color: '$primary', thickness: 2, lengthFrac: 0.5, gap: 28, alpha: 0.85 },
    }},
    { type: 'vignette', layer: 'overlay', config: {
      color: '#020e16', alpha: 0.4,
    }},
  ],
};

