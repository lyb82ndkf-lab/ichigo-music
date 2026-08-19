// PV Tool — Copyright (c) 2026 DanteAlighieri13210914
// Licensed under Non-Commercial License. See LICENSE for terms.

import * as PIXI from 'pixi.js';
import { BaseEffect } from './base';
import type { UpdateContext } from '../core/types';
import { resolveColor } from '../core/types';
import { seededRandom } from '../core/easing';

interface SeaBubble {
  x: number;
  y: number;
  r: number;
  speedY: number;
  swaySp: number;
  swayAmp: number;
  phase: number;
  alpha: number;
}

/**
 * 深海波澜专属：多层高清矢量海浪与潮汐来回涌动系统
 * 1. 多层矢量海浪曲线（底浪、中浪、前浪，具有清晰的梯度色块与发光浪尖）
 * 2. 潮汐来回涌动 (Back-and-forth tidal undulating flow 差速推进与起伏呼吸)
 * 3. 浪尖高亮矢量描边与浪花高光
 * 4. 深海发光水母/浮游发光气泡微粒缓缓上升
 */
export class WaveLines extends BaseEffect {
  readonly name = 'waveLines';
  override readonly heavy = false;
  private graphics!: PIXI.Graphics;
  private bubbles: SeaBubble[] = [];

  protected setup(): void {
    this.graphics = new PIXI.Graphics();
    this.container.addChild(this.graphics);

    // 初始化深海发光微泡与浮游生物粒子
    for (let i = 0; i < 28; i++) {
      const r = (k: number) => seededRandom(i * 19.3 + k * 7.7);
      this.bubbles.push({
        x: r(0),
        y: r(1),
        r: 1.2 + r(2) * 3.8,
        speedY: 0.02 + r(3) * 0.045,
        swaySp: 0.5 + r(4) * 0.9,
        swayAmp: 0.01 + r(5) * 0.02,
        phase: r(6) * Math.PI * 2,
        alpha: 0.35 + r(7) * 0.55
      });
    }
  }

  update(ctx: UpdateContext): void {
    const g = this.graphics;
    g.clear();

    const cfg = this.config;
    const w = ctx.screenWidth;
    const h = ctx.screenHeight;
    const now = ctx.time;
    const animSpeed = ctx.animationSpeed || 1;
    const dt = Math.min(ctx.deltaTime, 0.1) * animSpeed;

    const layers = cfg.layers ?? 4;
    const baseY = (cfg.y ?? 0.74) * h;
    const spread = (cfg.spread ?? 0.14) * h;
    const baseAmp = (cfg.amplitude ?? 28) * ctx.motionIntensity;
    const baseSpeed = (cfg.speed ?? 0.45) * animSpeed;

    // 1. 渲染深海发光微粒与气泡 (Rising Bioluminescent Bubbles)
    for (const b of this.bubbles) {
      b.y -= b.speedY * dt;
      if (b.y < -0.05) {
        b.y = 1.05;
        b.x = seededRandom(now * 1000 + b.phase);
      }

      const bx = (b.x + Math.sin(now * b.swaySp + b.phase) * b.swayAmp) * w;
      const by = b.y * h;
      const tw = 0.7 + 0.3 * Math.sin(now * 2.0 + b.phase);

      // 发光外晕
      g.circle(bx, by, b.r * 2.2);
      g.fill({ color: 0x50e0f0, alpha: b.alpha * 0.2 * tw });

      // 核心高亮
      g.circle(bx, by, b.r);
      g.fill({ color: 0xe0ffff, alpha: b.alpha * tw });
    }

    // 2. 渲染多层矢量海浪与潮汐来回翻涌 (Multi-Layer Tidal Vector Waves)
    // 渐进色彩层次：从深渊青墨到清透翡翠蓝
    const wavePalettes = [
      { fill: 0x072635, crest: 0x1d5f75, alpha: 0.95 },  // 远景底浪
      { fill: 0x0c3d52, crest: 0x3aa0ba, alpha: 0.90 },  // 中远景
      { fill: 0x135874, crest: 0x5cd3ea, alpha: 0.85 },  // 中近景
      { fill: 0x1d7c9a, crest: 0xa8f5ff, alpha: 0.80 },  // 前景浪尖
    ];

    // 来回潮涌主周期 (Tidal surge cycle: 正向涌入与退潮回荡)
    const tidalSurge = Math.sin(now * baseSpeed * 0.85) * (w * 0.08);
    const tidalVertical = Math.cos(now * baseSpeed * 0.7) * (baseAmp * 0.65);

    for (let l = 0; l < layers; l++) {
      const f = l / Math.max(layers - 1, 1);
      const layerData = wavePalettes[l % wavePalettes.length];
      const yBase = baseY + (f - 0.4) * spread + tidalVertical * (1 - f * 0.3);
      const amp = baseAmp * (0.7 + f * 0.65);
      const freq = 0.0035 + (l % 2) * 0.0015;

      // 差速来回滑动：奇偶层逆向错落涌动
      const dir = l % 2 === 0 ? 1 : -1;
      const surgeOffset = tidalSurge * dir * (0.8 + f * 0.5);
      const phase = now * baseSpeed * (0.7 + f * 0.6) * dir + l * 2.4;

      g.moveTo(0, yBase);

      const step = 8;
      for (let x = 0; x <= w + step; x += step) {
        const sx = x + surgeOffset;
        const wave1 = Math.sin(sx * freq + phase) * amp;
        const wave2 = Math.sin(sx * freq * 0.48 - phase * 1.4) * (amp * 0.45);
        const wave3 = Math.cos(sx * freq * 1.8 + phase * 0.8) * (amp * 0.2);
        const y = yBase + wave1 + wave2 + wave3;
        g.lineTo(x, y);
      }

      // 封闭底部填充
      g.lineTo(w, h + 10);
      g.lineTo(0, h + 10);
      g.closePath();
      g.fill({ color: layerData.fill, alpha: layerData.alpha });

      // 浪尖发光矢量描边 (Crest Highlight Stroke)
      g.moveTo(0, yBase);
      for (let x = 0; x <= w + step; x += step) {
        const sx = x + surgeOffset;
        const wave1 = Math.sin(sx * freq + phase) * amp;
        const wave2 = Math.sin(sx * freq * 0.48 - phase * 1.4) * (amp * 0.45);
        const wave3 = Math.cos(sx * freq * 1.8 + phase * 0.8) * (amp * 0.2);
        const y = yBase + wave1 + wave2 + wave3;
        g.lineTo(x, y);
      }
      g.stroke({
        color: layerData.crest,
        width: l === layers - 1 ? 2.5 : 1.6,
        alpha: 0.95
      });
    }
  }
}

