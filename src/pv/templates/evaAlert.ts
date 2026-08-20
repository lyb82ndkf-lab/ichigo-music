// PV Tool — Copyright (c) 2026 DanteAlighieri13210914
// Licensed under Non-Commercial License. See LICENSE for terms.

import type { TemplateConfig } from '../core/types';

/**
 * EVA 警报 — EVA Alert // Pattern: Blood-Type Red
 * 经典新世纪福音战士黑红高对比度：红色蜂窝防御护盾、战术斜向警戒封条、倒计时警戒标尺与冲击感字幕。
 */
export const evaAlertTemplate: TemplateConfig = {
  name: 'EVA 警报',
  nameKey: 'tpl_evaAlert',
  palette: {
    background: '#0d0a0d',
    primary: '#ff1836',
    secondary: '#ffaa00',
    accent: '#ffffff',
    text: '#ffffff',
  },
  bpm: 130,
  effects: [
    {
      type: 'gradientOverlay',
      layer: 'background',
      config: {
        colorTop: '#180a0e',
        colorMid: '#0d0a0d',
        colorBottom: '#050305',
        alpha: 0.98,
        mode: 'linear',
      },
    },
    {
      type: 'evaHexGrid',
      layer: 'background',
      config: {
        color: '#ff1836',
        alpha: 0.35,
      },
    },
    {
      type: 'burstLines',
      layer: 'decoration',
      config: {
        rayCount: 32,
        lineWidth: 1.5,
        color: '#ff1836',
        alpha: 0.22,
        innerRadius: 0.15,
        outerRadius: 0.85,
        rotSpeed: 0.04,
      },
    },
    {
      type: 'hazardTape',
      layer: 'decoration',
      config: {
        color: '#ff1836',
        alpha: 0.9,
      },
    },
    {
      type: 'evaImpactText',
      layer: 'text',
      config: {
        fontSize: 58,
        color: '#ffffff',
        accentColor: '#ff1836',
        x: 0.5,
        y: 0.48,
      },
    },
    {
      type: 'vignette',
      layer: 'overlay',
      config: {
        color: '#ff1836',
        alpha: 0.25,
      },
    },
  ],
};
