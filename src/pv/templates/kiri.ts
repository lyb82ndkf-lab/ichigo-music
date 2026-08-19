// PV Tool — Copyright (c) 2026 DanteAlighieri13210914
// Licensed under Non-Commercial License. See LICENSE for terms.

import type { TemplateConfig } from '../core/types';

/**
 * 霧 — Fog
 * 灰蓝的晨雾缓缓流动，低对比、柔焦、安静。
 */
export const kiriTemplate: TemplateConfig = {
  name: '霧',
  nameKey: 'tpl_kiri',
  palette: {
    background: '#b8c4cb',
    primary: '#24343d',
    secondary: '#1c2830',
    accent: '#f0f6f8',
    text: '#142028',
  },
  bpm: 75,
  effects: [
    { type: 'gradientOverlay', layer: 'background', config: {
      colorTop: '#c8d4db', colorBottom: '#a2b0b8', alpha: 0.85, mode: 'linear',
    }},
    { type: 'meshGradient', layer: 'background', config: {
      colors: ['#d8e2e6', '#abb8bf', '#ced8dc'], blend: 'normal',
      count: 4, alpha: 0.5, speed: 0.45,
    }},
    { type: 'dustParticles', layer: 'decoration', config: {
      color: '#ffffff', count: 24, minSize: 4, maxSize: 12,
      alpha: 0.5, speed: 0.35, blend: 'normal',
    }},
    { type: 'lyricText', layer: 'text', config: {
      color: '$text', fontSize: 56,
      fontFamily: '"Noto Serif JP", "Yu Mincho", "MS Mincho", serif',
      fontWeight: '500', letterSpacing: 10,
      y: 0.48,
      sideBars: { color: '$primary', thickness: 2, lengthFrac: 0.5, gap: 28, alpha: 0.8 },
    }},
  ],
};

