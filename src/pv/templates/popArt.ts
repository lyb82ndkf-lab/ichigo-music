// PV Tool — Copyright (c) 2026 DanteAlighieri13210914
// Licensed under Non-Commercial License. See LICENSE for terms.

import type { TemplateConfig } from '../core/types';

export const popArtTemplate: TemplateConfig = {
  name: '格子花边',
  nameKey: 'tpl_popArt',
  palette: {
    background: '#ff3b77',
    primary: '#ffde59',
    secondary: '#00e5ff',
    accent: '#ffffff',
    text: '#ffffff',
  },
  effects: [
    {
      type: 'dotScreen',
      layer: 'background',
      config: {
        color: '#ffffff',
        dotSize: 6,
        spacing: 20,
        alpha: 0.25,
      },
    },
    {
      type: 'pinkGrid',
      layer: 'background',
      config: {
        color: '#ffffff',
        lineColor: '#ffde59',
        lineWidth: 3,
        cellSize: 48,
        alpha: 0.2,
      },
    },
    {
      type: 'popComicText',
      layer: 'text',
      config: {
        fontSize: 56,
        color: '#ffffff',
        strokeColor: '#000000',
        x: 0.5,
        y: 0.5,
      },
    },
    {
      type: 'vignette',
      layer: 'overlay',
      config: { intensity: 0.25 },
    },
  ],
};
