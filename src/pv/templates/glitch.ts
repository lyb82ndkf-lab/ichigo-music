// PV Tool — Copyright (c) 2026 DanteAlighieri13210914
// Licensed under Non-Commercial License. See LICENSE for terms.

import type { TemplateConfig } from '../core/types';

export const glitchTemplate: TemplateConfig = {
  name: '故障艺术',
  nameKey: 'tpl_glitch',
  palette: {
    background: '#0a0a0f',
    primary: '#00f0ff',
    secondary: '#ff003c',
    accent: '#ffe600',
    text: '#ffffff',
  },
  postfx: { glitch: 0.18, shake: 0.04 },
  effects: [
    {
      type: 'glitchBars',
      layer: 'background',
      config: { count: 8, color: '#00f0ff', alpha: 0.35 },
    },
    {
      type: 'glitchDisplaceText',
      layer: 'text',
      config: {
        color: '#ffffff',
        fontSize: 54,
        x: 0.5,
        y: 0.5,
      },
    },
    {
      type: 'scanlines',
      layer: 'overlay',
      config: { alpha: 0.2 },
    },
  ],
};
