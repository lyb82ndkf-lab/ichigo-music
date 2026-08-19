// PV Tool — Copyright (c) 2026 DanteAlighieri13210914
// Licensed under Non-Commercial License. See LICENSE for terms.

import type { TemplateConfig } from '../core/types';

/**
 * 黄昏 — Dusk
 * 琥珀与玫瑰的暮光在天际缓慢流动，暖色浮尘静静漂浮。
 */
export const tasogareTemplate: TemplateConfig = {
  name: '黄昏',
  nameKey: 'tpl_tasogare',
  palette: {
    background: '#241832',
    primary: '#ff9e6a',
    secondary: '#b86a9e',
    accent: '#ffd7a0',
    text: '#ffeadd',
  },
  bpm: 95,
  effects: [
    { type: 'meshGradient', layer: 'background', config: {
      colors: ['#7a3a48', '#5a3268', '#2c2044', '#8a4a3a'],
      blend: 'screen', count: 4, alpha: 0.32, speed: 0.55,
    }},
    { type: 'lightSpot', layer: 'background', config: {
      color: '#ff9e5a', x: 0.5, y: 0.82, alpha: 0.22, size: 0.55,
    }},
    { type: 'dustParticles', layer: 'decoration', config: {
      color: '#ffd7a0', count: 20, minSize: 2, maxSize: 7,
      alpha: 0.45, speed: 0.6, blend: 'add',
    }},
    { type: 'lyricText', layer: 'text', config: {
      color: '$text', fontSize: 58,
      fontFamily: '"Noto Serif JP", "Yu Mincho", "MS Mincho", serif',
      fontWeight: '500', letterSpacing: 8,
      y: 0.44,
      glowColor: '#ff9e6a', glowAlpha: 0.35, glowBlur: 12,
    }},
    { type: 'vignette', layer: 'overlay', config: {
      color: '#140a1c', alpha: 0.5,
    }},
  ],
};
