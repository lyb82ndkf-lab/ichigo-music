// PV Tool — Copyright (c) 2026 DanteAlighieri13210914
// Licensed under Non-Commercial License. See LICENSE for terms.

import type { TemplateConfig } from '../core/types';

/**
 * 赛博朋克 2077 — Cyberpunk 2077 (Night City)
 * 经典夜之城极速透视公路：荧光黄与创伤小组青、数码故障位移切片、HUD 瞄准视窗与逐字黑客矩阵解密。
 */
export const cyberpunk2077Template: TemplateConfig = {
  name: '赛博朋克 2077',
  nameKey: 'tpl_cyberpunk2077',
  palette: {
    background: '#080811',
    primary: '#fcee0a',
    secondary: '#00f0ff',
    accent: '#ff003c',
    text: '#fcee0a',
  },
  bpm: 125,
  effects: [
    {
      type: 'gradientOverlay',
      layer: 'background',
      config: {
        colorTop: '#0c0a1a',
        colorMid: '#080811',
        colorBottom: '#040308',
        alpha: 0.98,
        mode: 'linear',
      },
    },
    {
      type: 'cyberpunkNightCity',
      layer: 'background',
      config: {
        color: '#fcee0a',
        accentColor: '#00f0ff',
      },
    },
    {
      type: 'glitchBars',
      layer: 'decoration',
      config: {
        count: 12,
        speed: 0.8,
        color: '#ff003c',
        alpha: 0.25,
      },
    },
    {
      type: 'cyberScannerText',
      layer: 'text',
      config: {
        fontSize: 56,
        color: '#fcee0a',
        accentColor: '#00f0ff',
        x: 0.5,
        y: 0.48,
      },
    },
    {
      type: 'vignette',
      layer: 'overlay',
      config: {
        color: '#00f0ff',
        alpha: 0.2,
      },
    },
  ],
};
