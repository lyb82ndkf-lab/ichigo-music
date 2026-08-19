// PV Tool — Copyright (c) 2026 DanteAlighieri13210914
// Licensed under Non-Commercial License. See LICENSE for terms.

import type { TemplateConfig } from '../core/types';

export const yorushikaTemplate: TemplateConfig = {
  name: '错落文字',
  nameKey: 'tpl_yorushika',
  palette: {
    background: '#141c26',
    primary: '#7696c2',
    secondary: '#a3b8d7',
    accent: '#e8efff',
    text: '#ffffff',
  },
  effects: [
    {
      type: 'meshGradient',
      layer: 'background',
      config: {
        colors: ['#0f1722', '#182434', '#1f2e42', '#0d131c'],
        alpha: 0.95,
      },
    },
    {
      type: 'dustParticles',
      layer: 'decoration',
      config: {
        count: 28,
        color: '#a3b8d7',
        alpha: 0.4,
        speed: 0.25,
      },
    },
    {
      type: 'poeticStaggerText',
      layer: 'text',
      config: {
        fontSize: 50,
        color: '#ffffff',
        x: 0.5,
        y: 0.5,
      },
    },
    {
      type: 'vignette',
      layer: 'overlay',
      config: { intensity: 0.5 },
    },
  ],
};
