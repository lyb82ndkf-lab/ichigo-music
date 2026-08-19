// PV Tool — Copyright (c) 2026 DanteAlighieri13210914
// Licensed under Non-Commercial License. See LICENSE for terms.

import type { TemplateConfig } from '../core/types';

/**
 * 春日影 — Haruhikage (秒速5厘米)
 * 日系秒速5厘米落樱：柔和春日晴空微风、3D飘落樱花、水彩光晕与和风诗意排版。
 */
export const yozakuraTemplate: TemplateConfig = {
  name: '春日影',
  nameKey: 'tpl_yozakura',
  palette: {
    background: '#fcf3f6',
    primary: '#6b8db5',
    secondary: '#ff8ca8',
    accent: '#ffb7c5',
    text: '#22384f',
  },
  bpm: 85,
  effects: [
    { type: 'gradientOverlay', layer: 'background', config: {
      colorTop: '#eef6fc', colorMid: '#fff2f6', colorBottom: '#fbe8ef',
      alpha: 0.95, mode: 'linear',
    }},
    { type: 'meshGradient', layer: 'background', config: {
      colors: ['#e4f0fc', '#ffe6ee', '#f8dbe5', '#edf5fc'], blend: 'normal',
      count: 4, alpha: 0.65, speed: 0.45,
    }},
    { type: 'petalFall', layer: 'decoration', config: {
      count: 36, colors: ['#ffffff', '#ffd5e2', '#ffb6cb', '#ffeef4'],
      minSize: 16, maxSize: 38, speed: 0.5, alpha: 0.92,
    }},
    { type: 'watercolorSpreadText', layer: 'text', config: {
      color: '#22384f', fontSize: 54, x: 0.5, y: 0.48,
    }},
  ],
};

