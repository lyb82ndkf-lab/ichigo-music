// PV Tool — Copyright (c) 2026 DanteAlighieri13210914
// Licensed under Non-Commercial License. See LICENSE for terms.

import type { TemplateConfig } from '../core/types';

/**
 * 几何模式 — Geometric Architect
 * 现代极简几何网格、L型精密标尺、建筑坐标轴与逐字动力学排版。
 */
export const rulerTemplate: TemplateConfig = {
  name: '几何',
  nameKey: 'tpl_ruler',
  palette: {
    background: '#161922',
    primary: '#416be2',
    secondary: '#8bb0ff',
    accent: '#ffffff',
    text: '#ffffff',
  },
  bpm: 100,
  effects: [
    {
      type: 'breathingBlocks',
      layer: 'background',
      config: {
        count: 8,
        minSize: 0.15, maxSize: 0.55,
        minBrightness: 20, maxBrightness: 60,
      },
    },
    {
      type: 'rulerGuide',
      layer: 'decoration',
      config: {
        color: '#416be2', alpha: 0.65,
        x: 0.12, y: 0.78,
        hLength: 0.85, vLength: 0.65,
        tickSpacing: 12, majorEvery: 5,
        minorTickLen: 6, majorTickLen: 14,
        circleRadius: 8, lineWidth: 1.5,
      },
    },
    {
      type: 'modernArchitectText',
      layer: 'text',
      config: {
        fontSize: 52,
        color: '#ffffff',
        accentColor: '#416be2',
        x: 0.5,
        y: 0.48,
      },
    },
    {
      type: 'vignette',
      layer: 'overlay',
      config: { color: '#090a0f', alpha: 0.45 },
    },
  ],
};
