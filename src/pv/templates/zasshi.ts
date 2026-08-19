// PV Tool — Copyright (c) 2026 DanteAlighieri13210914
// Licensed under Non-Commercial License. See LICENSE for terms.

import type { TemplateConfig } from '../core/types';

/**
 * 雑誌 — Magazine Editorial
 * 暖纸底色、三分构成线、左侧大衬线标题 + 竖排小注，
 * 一点社论红。像一页排版考究的杂志。
 */
export const zasshiTemplate: TemplateConfig = {
  name: '雑誌',
  nameKey: 'tpl_zasshi',
  palette: {
    background: '#f2ede4',
    primary: '#1a1a1a',
    secondary: '#8a8378',
    accent: '#b03028',
    text: '#1a1a1a',
  },
  effects: [
    { type: 'compositionGuides', layer: 'decoration', config: {
      color: '$primary', alpha: 0.1, lineWidth: 1, guides: ['thirds'],
    }},
    { type: 'lyricText', layer: 'text', config: {
      color: '$text', fontSize: 64,
      fontFamily: '"Noto Serif JP", "Yu Mincho", "MS Mincho", serif',
      fontWeight: '700', letterSpacing: 4,
      align: 'left', x: 0.09, y: 0.5, maxWidthFrac: 0.8,
      underline: { color: '$accent', thickness: 3, lengthFrac: 0.35, offsetFrac: 0.85, alpha: 1 },
    }},
    { type: 'verticalSubText', layer: 'text', config: {
      color: '$secondary', fontSize: 13, x: 0.82, y: 0.24, charsPerCol: 6,
      fontFamily: '"Noto Serif JP", "Yu Mincho", serif',
    }},
    { type: 'filmGrain', layer: 'overlay', config: {
      alpha: 0.035, mono: true, updateInterval: 4,
    }},
  ],
};
