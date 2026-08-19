// PV Tool — Copyright (c) 2026 DanteAlighieri13210914
// Licensed under Non-Commercial License. See LICENSE for terms.

import type { TemplateConfig } from '../core/types';

/**
 * 檸檬ソーダ — Lemon Soda
 * 明快的柠檬黄 + 白色集中线缓缓旋转，贴纸风粗体字随节拍弹跳。
 */
export const lemonSodaTemplate: TemplateConfig = {
  name: '檸檬ソーダ',
  nameKey: 'tpl_lemonSoda',
  palette: {
    background: '#ffd93b',
    primary: '#1c1a14',
    secondary: '#fff6d8',
    accent: '#ff7a3d',
    text: '#1c1a14',
  },
  bpm: 128,
  effects: [
    { type: 'speedLines', layer: 'decoration', config: {
      color: '#ffffff', count: 46, alpha: 0.3, rotSpeed: 0.04,
      lineWidth: 2.2, beatBoost: 0.1,
    }},
    { type: 'scatteredShapes', layer: 'decoration', config: {
      shapes: ['circle'], color: '#ff8c42', count: 9,
      minSize: 7, maxSize: 16, alpha: 0.5, speed: 0.25,
    }},
    { type: 'lyricText', layer: 'text', config: {
      color: '$text', fontSize: 66,
      fontFamily: '"Noto Sans JP", "Hiragino Kaku Gothic Pro", "Yu Gothic", sans-serif',
      fontWeight: '800', letterSpacing: 4,
      y: 0.5, popIn: 0.3, stagger: 0.05, beatPulse: 0.1,
      strokeColor: '#ffffff', strokeWidth: 7,
      rotateIn: 6,
    }},
  ],
};
