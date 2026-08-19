// PV Tool — Copyright (c) 2026 DanteAlighieri13210914
// Licensed under Non-Commercial License. See LICENSE for terms.

import type { TemplateConfig } from '../core/types';

/**
 * 心拍 — Heartbeat
 * 纯白空间，一行字随节拍轻轻搏动，淡灰圆环如涟漪扩散。
 * 极简到只剩律动。
 */
export const shinpakuTemplate: TemplateConfig = {
  name: '心拍',
  nameKey: 'tpl_shinpaku',
  palette: {
    background: '#fdfdfc',
    primary: '#0c0c0c',
    secondary: '#c8c8c4',
    accent: '#d8245e',
    text: '#0c0c0c',
  },
  bpm: 120,
  effects: [
    { type: 'pulsingCircle', layer: 'decoration', config: {
      strokeColor: '#e2e2de', strokeAlpha: 0.9, strokeWidth: 2,
      outerStrokeColor: '#ececea', outerStrokeWidth: 1, outerStrokeAlpha: 0.8,
      radius: 230, x: 0.5, y: 0.5,
      animSpeed: 0.15, strokePulseAmount: 0.3, radiusPulseAmount: 0.05,
      enableBeatReact: true,
    }},
    { type: 'lyricText', layer: 'text', config: {
      color: '$text', fontSize: 62,
      fontFamily: '"Noto Sans JP", "Hiragino Kaku Gothic Pro", "Yu Gothic", sans-serif',
      fontWeight: '600', letterSpacing: 6,
      y: 0.5, beatPulse: 0.16,
      underline: { color: '$accent', thickness: 3, lengthFrac: 0.3, offsetFrac: 0.85, alpha: 1 },
    }},
  ],
};
