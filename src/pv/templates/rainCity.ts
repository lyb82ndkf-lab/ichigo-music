// PV Tool — Copyright (c) 2026 DanteAlighieri13210914
// Licensed under Non-Commercial License. See LICENSE for terms.

import type { TemplateConfig } from '../core/types';

export const rainCityTemplate: TemplateConfig = {
  name: '黑客帝国',
  nameKey: 'tpl_rainCity',
  palette: {
    background: '#040804',
    primary: '#003b00',
    secondary: '#005500',
    accent: '#00ff41',
    text: '#00ff41',
  },
  bgOpacity: 0.95,
  effects: [
    {
      type: 'meshGradient',
      layer: 'background',
      config: {
        colors: ['#040804', '#001a00', '#002e08', '#000c02'],
        alpha: 0.9,
      },
    },
    {
      type: 'matrixRain',
      layer: 'decoration',
      config: {},
    },
    {
      type: 'matrixDecodeText',
      layer: 'text',
      config: {
        color: '#00ff41',
        fontSize: 52,
        x: 0.5,
        y: 0.5,
      },
    },

    {
      type: 'scanlines',
      layer: 'overlay',
      config: {
        alpha: 0.15,
      },
    },
    {
      type: 'chromaticAberration',
      layer: 'overlay',
      config: {
        offset: 3.5,
        flickerSpeed: 1.5,
      },
    },
    {
      type: 'vignette',
      layer: 'overlay',
      config: {
        color: '#000000',
        alpha: 0.7,
        radius: 0.6,
      },
    },
  ],
};