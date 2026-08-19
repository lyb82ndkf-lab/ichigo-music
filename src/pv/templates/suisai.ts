// PV Tool — Copyright (c) 2026 DanteAlighieri13210914
// Licensed under Non-Commercial License. See LICENSE for terms.

import type { TemplateConfig } from '../core/types';

export const suisaiTemplate: TemplateConfig = {
  name: '春日影',
  nameKey: 'tpl_suisai',
  palette: {
    background: '#edf4fb',
    primary: '#689fe0',
    secondary: '#b8d6f8',
    accent: '#ffb3c6',
    text: '#2c4766',
  },
  effects: [
    {
      type: 'meshGradient',
      layer: 'background',
      config: {
        colors: ['#edf4fb', '#d9ebfc', '#ffedf2', '#e2f0fc'],
        alpha: 0.95,
      },
    },
    {
      type: 'petalFall',
      layer: 'decoration',
      config: {
        count: 22,
        color: '#ffccd8',
        alpha: 0.5,
        speed: 0.35,
      },
    },
    {
      type: 'watercolorSpreadText',
      layer: 'text',
      config: {
        color: '#2c4766',
        fontSize: 50,
        x: 0.5,
        y: 0.5,
      },
    },
    {
      type: 'vignette',
      layer: 'overlay',
      config: { intensity: 0.15 },
    },
  ],
};
