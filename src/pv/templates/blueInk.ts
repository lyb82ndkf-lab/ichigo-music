// PV Tool — Copyright (c) 2026 DanteAlighieri13210914
// Licensed under Non-Commercial License. See LICENSE for terms.

import type { TemplateConfig } from '../core/types';

/**
 * 蓝色构成 — Blue Constructivism
 * 现代蓝白构成主义：多层动态几何切块、坐标网格、斜向动感色块与建筑结构歌词。
 */
export const blueInkTemplate: TemplateConfig = {
  name: '蓝色构成',
  nameKey: 'tpl_blueInk',
  palette: {
    background: '#122b68',
    primary: '#4175e8',
    secondary: '#8eb6ff',
    accent: '#ffffff',
    text: '#ffffff',
  },
  bpm: 110,
  effects: [
    {
      type: 'gradientOverlay',
      layer: 'background',
      config: {
        colorTop: '#10255c',
        colorMid: '#163884',
        colorBottom: '#0a1738',
        alpha: 0.95,
        mode: 'linear',
      },
    },
    {
      type: 'colorMask',
      layer: 'background',
      config: {
        color: '#ffffff',
        alpha: 0.12,
        coverage: { x: 0.35, y: 0, w: 0.65, h: 1 },
      },
    },
    {
      type: 'crossPattern',
      layer: 'decoration',
      config: {
        spacing: 32,
        size: 3,
        color: '#8eb6ff',
        alpha: 0.5,
        area: { x: 0.1, y: 0.1, w: 0.8, h: 0.8 },
      },
    },
    {
      type: 'modernArchitectText',
      layer: 'text',
      config: {
        fontSize: 54,
        color: '#ffffff',
        accentColor: '#8eb6ff',
        x: 0.5,
        y: 0.48,
      },
    },
    {
      type: 'scatteredShapes',
      layer: 'decoration',
      config: {
        count: 10,
        color: '#ffffff',
        shapes: ['square', 'dot'],
        minSize: 4,
        maxSize: 14,
        alpha: 0.6,
      },
    },
    {
      type: 'vignette',
      layer: 'overlay',
      config: { color: '#060e24', alpha: 0.45 },
    },
  ],
};
