// PV Tool — Copyright (c) 2026 DanteAlighieri13210914
// Licensed under Non-Commercial License. See LICENSE for terms.

import type { TemplateConfig } from '../core/types';

/**
 * 赤い糸 — The Red Thread
 * 米白画面上，一根红线缓缓蜿蜒穿过——命运的线。
 */
export const akaiitoTemplate: TemplateConfig = {
  name: '赤い糸',
  nameKey: 'tpl_akaiito',
  palette: {
    background: '#f7f3ee',
    primary: '#1a1a1a',
    secondary: '#b0a89c',
    accent: '#b02820',
    text: '#1c1a18',
  },
  bpm: 85,
  effects: [
    { type: 'dustParticles', layer: 'decoration', config: {
      color: '#b0a89c', count: 12, minSize: 2, maxSize: 5,
      alpha: 0.3, speed: 0.35, blend: 'normal',
    }},
    { type: 'threadLine', layer: 'decoration', config: {
      color: '$accent', y: 0.58, amplitude: 0.14, speed: 0.35,
      width: 2, alpha: 0.85,
    }},
    { type: 'lyricText', layer: 'text', config: {
      color: '$text', fontSize: 58,
      fontFamily: '"Noto Serif JP", "Yu Mincho", "MS Mincho", serif',
      fontWeight: '600', letterSpacing: 8,
      y: 0.38,
    }},
  ],
};
