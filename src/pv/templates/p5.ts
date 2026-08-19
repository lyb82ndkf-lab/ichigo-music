// PV Tool — Copyright (c) 2026 DanteAlighieri13210914
// Licensed under Non-Commercial License. See LICENSE for terms.

import type { TemplateConfig } from '../core/types';

export const p5Template: TemplateConfig = {
  name: 'P5怪盗红黑',
  nameKey: 'tpl_p5',
  palette: {
    background: '#d6001c',
    primary: '#111111',
    secondary: '#ffea00',
    accent: '#ffffff',
    text: '#ffffff',
  },
  bpm: 125,
  effects: [
    {
      type: 'p5VectorBg',
      layer: 'background',
      config: {},
    },
    {
      type: 'p5StickerText',
      layer: 'text',
      config: {
        fontSize: 54,
        x: 0.5,
        y: 0.5,
      },
    },
  ],
};


