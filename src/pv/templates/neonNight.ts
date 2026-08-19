// PV Tool — Copyright (c) 2026 DanteAlighieri13210914
// Licensed under Non-Commercial License. See LICENSE for terms.

import type { TemplateConfig } from '../core/types';

export const neonNightTemplate: TemplateConfig = {
  name: '霓虹夜市',
  nameKey: 'tpl_neonNight',
  palette: {
    background: '#090514',
    primary: '#ff007f',
    secondary: '#00f0ff',
    accent: '#ffe600',
    text: '#ffffff',
  },
  effects: [
    {
      type: 'meshGradient',
      layer: 'background',
      config: {
        colors: ['#090514', '#1f0933', '#002538', '#070014'],
        alpha: 0.95,
      },
    },
    {
      type: 'perspectiveGrid',
      layer: 'background',
      config: {
        color: '#ff007f',
        alpha: 0.25,
        speed: 0.6,
      },
    },
    {
      type: 'neonFlickerText',
      layer: 'text',
      config: {
        color: '#ff007f',
        glowColor: '#00f0ff',
        fontSize: 54,
        x: 0.5,
        y: 0.5,
      },
    },
    {
      type: 'scanlines',
      layer: 'overlay',
      config: { alpha: 0.12 },
    },
    {
      type: 'vignette',
      layer: 'overlay',
      config: { intensity: 0.4 },
    },
  ],
};
