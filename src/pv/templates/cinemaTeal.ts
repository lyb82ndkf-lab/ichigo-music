// PV Tool — Copyright (c) 2026 DanteAlighieri13210914
// Licensed under Non-Commercial License. See LICENSE for terms.

import type { TemplateConfig } from '../core/types';

/**
 * 青蓝电影 — Cinema Teal
 * 宽银幕黑边 + 青蓝调 + 细颗粒，衬线歌词配一缕暖沙色细线。
 * 低背景不透明度，适合叠加视频。
 */
export const cinemaTealTemplate: TemplateConfig = {
  name: '青蓝电影(可配视频)',
  nameKey: 'tpl_cinemaTeal',
  palette: {
    background: '#0b141c',
    primary: '#79a8b8',
    secondary: '#3d5a66',
    accent: '#d8c9a3',
    text: '#e8eef0',
  },
  bgOpacity: 0.62,
  effects: [
    { type: 'letterbox', layer: 'decoration', config: {
      color: '#000000', heightFrac: 0.1, alpha: 1,
    }},
    { type: 'colorMask', layer: 'background', config: {
      color: '#12303c', alpha: 0.3,
    }},
    { type: 'lyricText', layer: 'text', config: {
      color: '$text', fontSize: 54,
      fontFamily: '"Noto Serif JP", "Yu Mincho", "MS Mincho", serif',
      fontWeight: '500', letterSpacing: 6,
      y: 0.5,
      underline: { color: '$accent', thickness: 2, lengthFrac: 0.55, offsetFrac: 0.85, alpha: 0.8 },
    }},
    { type: 'filmGrain', layer: 'overlay', config: {
      alpha: 0.06, mono: true, updateInterval: 3,
    }},
    { type: 'vignette', layer: 'overlay', config: {
      color: '#040a0e', alpha: 0.5,
    }},
  ],
};
