// PV Tool — Copyright (c) 2026 DanteAlighieri13210914
// Licensed under Non-Commercial License. See LICENSE for terms.

import type { TemplateConfig } from '../core/types';

export const kineticTemplate: TemplateConfig = {
  name: '激烈排版',
  nameKey: 'tpl_kinetic',
  palette: {
    background: '#120000',
    primary: '#cc1a1a',
    secondary: '#ffffff',
    accent: '#ff2b2b',
    text: '#ffffff',
  },
  effects: [
    {
      type: 'speedLines',
      layer: 'background',
      config: {
        color: '#cc1a1a',
        count: 24,
        alpha: 0.35,
        speed: 1.2,
      },
    },
    {
      type: 'paperTear',
      layer: 'decoration',
      config: {
        color: '#cc1a1a',
        width: 120,
        angle: 15,
        alpha: 0.8,
      },
    },
    {
      type: 'kineticSlashText',
      layer: 'text',
      config: {
        fontSize: 68,
        color: '#ffffff',
        strokeColor: '#000000',
        x: 0.5,
        y: 0.5,
      },
    },
    {
      type: 'vignette',
      layer: 'overlay',
      config: { intensity: 0.45 },
    },
  ],
};
