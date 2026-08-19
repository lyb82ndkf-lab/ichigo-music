// PV Tool — Copyright (c) 2026 DanteAlighieri13210914
// Licensed under Non-Commercial License. See LICENSE for terms.

import type { TemplateConfig } from '../core/types';

export const holoScopeTemplate: TemplateConfig = {
  name: '全息目镜',
  nameKey: 'tpl_holoScope',
  palette: {
    background: '#04121a',
    primary: '#00d4ff',
    secondary: '#006688',
    accent: '#00ffcc',
    text: '#00d4ff',
  },
  effects: [
    {
      type: 'meshGradient',
      layer: 'background',
      config: {
        colors: ['#04121a', '#06202c', '#03141f', '#020b12'],
        alpha: 0.95,
      },
    },
    {
      type: 'targetGuide',
      layer: 'decoration',
      config: {
        color: '#00d4ff',
        alpha: 0.45,
        radius: 180,
      },
    },
    {
      type: 'matrixDecodeText',
      layer: 'text',
      config: {
        fontSize: 48,
        color: '#00d4ff',
        x: 0.5,
        y: 0.5,
      },
    },
    {
      type: 'scanlines',
      layer: 'overlay',
      config: { alpha: 0.18 },
    },
  ],
};
