// PV Tool — Copyright (c) 2026 DanteAlighieri13210914
// Licensed under Non-Commercial License. See LICENSE for terms.

import type { TemplateConfig } from '../core/types';

export const cyberTemplate: TemplateConfig = {
  name: '赛博矩阵',
  nameKey: 'tpl_cyber',
  palette: {
    background: '#050a14',
    primary: '#00f0ff',
    secondary: '#ff0055',
    accent: '#00ff66',
    text: '#ffffff',
  },
  effects: [
    {
      type: 'perspectiveGrid',
      layer: 'background',
      config: { color: '#00f0ff', alpha: 0.3, speed: 0.8 },
    },
    {
      type: 'dataMonitors',
      layer: 'decoration',
      config: { color: '#00f0ff', alpha: 0.4 },
    },
    {
      type: 'glitchDisplaceText',
      layer: 'text',
      config: {
        color: '#ffffff',
        fontSize: 52,
        x: 0.5,
        y: 0.5,
      },
    },
    {
      type: 'scanlines',
      layer: 'overlay',
      config: { alpha: 0.15 },
    },
  ],
};
