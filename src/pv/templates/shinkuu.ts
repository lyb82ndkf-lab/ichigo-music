// PV Tool — Copyright (c) 2026 DanteAlighieri13210914
// Licensed under Non-Commercial License. See LICENSE for terms.

import type { TemplateConfig } from '../core/types';

/**
 * 深空 — Deep Space
 * 极暗的蓝黑宇宙，细星闪烁，亮星之间连着淡淡的星座线。
 */
export const shinkuuTemplate: TemplateConfig = {
  name: '深空',
  nameKey: 'tpl_shinkuu',
  palette: {
    background: '#050914',
    primary: '#8aa8d0',
    secondary: '#b8d4f8',
    accent: '#c0d4f0',
    text: '#f0f5ff',
  },
  bpm: 80,
  effects: [
    { type: 'meshGradient', layer: 'background', config: {
      colors: ['#0a1430', '#101c3c', '#050914'], blend: 'add',
      count: 3, alpha: 0.45, speed: 0.4,
    }},
    { type: 'starField', layer: 'decoration', config: {
      color: '#dce6f5', count: 180, alpha: 0.9, constellations: true,
    }},
    { type: 'dustParticles', layer: 'decoration', config: {
      color: '#8aa8d0', count: 18, minSize: 2, maxSize: 6,
      alpha: 0.35, speed: 0.3, blend: 'add',
    }},
    { type: 'lyricText', layer: 'text', config: {
      color: '$text', fontSize: 54,
      fontFamily: '"Noto Serif JP", "Yu Mincho", "MS Mincho", serif',
      fontWeight: '400', letterSpacing: 12,
      y: 0.48,
      sideBars: { color: '$primary', thickness: 1.5, lengthFrac: 0.55, gap: 30, alpha: 0.8 },
    }},
    { type: 'vignette', layer: 'overlay', config: {
      color: '#02040a', alpha: 0.45,
    }},
  ],
};

