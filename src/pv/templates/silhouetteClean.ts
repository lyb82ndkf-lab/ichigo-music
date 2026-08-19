// PV Tool — Copyright (c) 2026 DanteAlighieri13210914
// Licensed under Non-Commercial License. See LICENSE for terms.

import type { TemplateConfig } from '../core/types';

export const silhouetteCleanTemplate: TemplateConfig = {
  name: '极简剪影',
  nameKey: 'tpl_silhouetteClean',
  palette: {
    background: '#0d0d0d',
    primary: '#ffffff',
    secondary: '#888888',
    accent: '#cccccc',
    text: '#ffffff',
  },
  effects: [
    {
      type: 'filmGrain',
      layer: 'background',
      config: {
        intensity: 0.12,
        speed: 1.0,
      },
    },
    {
      type: 'cinematicCleanText',
      layer: 'text',
      config: {
        fontSize: 48,
        color: '#ffffff',
        x: 0.5,
        y: 0.5,
      },
    },
    {
      type: 'vignette',
      layer: 'overlay',
      config: { intensity: 0.6 },
    },
  ],
};
