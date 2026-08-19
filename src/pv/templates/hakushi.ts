// PV Tool — Copyright (c) 2026 DanteAlighieri13210914
// Licensed under Non-Commercial License. See LICENSE for terms.

import type { TemplateConfig } from '../core/types';

/**
 * 白紙 — White Paper
 * 日式极简：暖白纸面、一根缓缓流动的灰线、炭黑衬线字。
 * 大量留白，让文字自己呼吸。
 */
export const hakushiTemplate: TemplateConfig = {
  name: '白紙',
  nameKey: 'tpl_hakushi',
  palette: {
    background: '#f8f8f5',
    primary: '#1a1a1a',
    secondary: '#4a4844',
    accent: '#1a1a1a',
    text: '#181816',
  },
  bpm: 80,
  effects: [
    { type: 'threadLine', layer: 'decoration', config: {
      color: '#c8c4bc', y: 0.68, amplitude: 0.04, speed: 0.25,
      width: 1.5, alpha: 0.85,
    }},
    { type: 'dustParticles', layer: 'decoration', config: {
      color: '#7a7468', count: 14, minSize: 2, maxSize: 5,
      alpha: 0.22, speed: 0.35, blend: 'normal',
    }},
    { type: 'lyricText', layer: 'text', config: {
      color: '$text', fontSize: 60,
      fontFamily: '"Noto Serif JP", "Yu Mincho", "MS Mincho", serif',
      fontWeight: '500', letterSpacing: 10,
      y: 0.46,
      sideBars: { color: '$primary', thickness: 2, lengthFrac: 0.5, gap: 26, alpha: 0.9 },
    }},
  ],
};
