// PV Tool — Copyright (c) 2026 DanteAlighieri13210914
// Licensed under Non-Commercial License. See LICENSE for terms.

import * as PIXI from 'pixi.js';
import { BaseEffect } from './base';
import type { UpdateContext } from '../core/types';
import { resolveColor } from '../core/types';
import { seededRandom } from '../core/easing';

interface Cloud {
  x: number;
  y: number;
  scale: number;
  speed: number;
  bobPhase: number;
  bobSpeed: number;
  alpha: number;
  layer: number; // 0: back (lavender/sky), 1: mid (soft pink), 2: front (white puffy)
  puffs: { dx: number; dy: number; r: number }[];
}

interface FloatingSparkle {
  x: number;
  y: number;
  size: number;
  speedY: number;
  swayAmp: number;
  swaySpeed: number;
  phase: number;
  type: 'heart' | 'star' | 'bubble';
  color: number;
  rotSpeed: number;
}

/**
 * 少女云朵专属：软萌蓬松棉花糖云团、粉嫩马卡龙浮空粒子与爱心星芒
 * 1. 多层有机浮动棉花糖云朵（前、中、后景差速漂浮与轻柔呼吸上下浮动）
 * 2. 少女心微粒：飘浮爱心 ♡、糖果星芒 ☆、梦幻粉彩气泡
 * 3. 梦幻柔焦光晕与粉嫩色彩漫射
 */
export class FluffyClouds extends BaseEffect {
  readonly name = 'fluffyClouds';
  private graphics!: PIXI.Graphics;
  private clouds: Cloud[] = [];
  private sparkles: FloatingSparkle[] = [];

  protected setup(): void {
    this.graphics = new PIXI.Graphics();
    this.container.addChild(this.graphics);

    const cfg = this.config;
    const cloudCount = cfg.cloudCount ?? 9;

    // 预设生成具有丰富层次的蓬松棉花糖云朵
    for (let i = 0; i < cloudCount; i++) {
      const r = (k: number) => seededRandom(i * 13.37 + k * 7.19);
      const layer = i % 3;
      const puffCount = 5 + Math.floor(r(0) * 4);
      const puffs: { dx: number; dy: number; r: number }[] = [];

      for (let p = 0; p < puffCount; p++) {
        const pr = (k: number) => seededRandom(i * 31.7 + p * 11.3 + k * 4.7);
        puffs.push({
          dx: (pr(0) - 0.5) * 160,
          dy: (pr(1) - 0.5) * 60,
          r: 45 + pr(2) * 55
        });
      }

      this.clouds.push({
        x: r(1),
        y: 0.12 + r(2) * 0.76,
        scale: 0.8 + r(3) * 0.5 + (layer === 2 ? 0.3 : 0),
        speed: 0.008 + r(4) * 0.012 + (layer === 2 ? 0.008 : 0),
        bobPhase: r(5) * Math.PI * 2,
        bobSpeed: 0.4 + r(6) * 0.6,
        alpha: layer === 0 ? 0.45 : (layer === 1 ? 0.65 : 0.88),
        layer,
        puffs
      });
    }

    // 飘浮粒子：爱心、星星、气泡
    const sparkleColors = [0xffb7d5, 0xffd1e8, 0xbfe3ff, 0xfff0b3, 0xe0c8ff, 0xffffff];
    const sparkleCount = cfg.sparkleCount ?? 26;
    for (let i = 0; i < sparkleCount; i++) {
      const r = (k: number) => seededRandom(i * 23.41 + k * 9.87);
      const typeChoice = r(0);
      const type: 'heart' | 'star' | 'bubble' = typeChoice > 0.6 ? 'heart' : (typeChoice > 0.3 ? 'star' : 'bubble');
      this.sparkles.push({
        x: r(1),
        y: r(2),
        size: 10 + r(3) * 16,
        speedY: 0.02 + r(4) * 0.04,
        swayAmp: 0.015 + r(5) * 0.03,
        swaySpeed: 0.5 + r(6) * 1.0,
        phase: r(7) * Math.PI * 2,
        type,
        color: sparkleColors[Math.floor(r(8) * sparkleColors.length)],
        rotSpeed: (r(9) - 0.5) * 1.5
      });
    }
  }

  update(ctx: UpdateContext): void {
    const g = this.graphics;
    g.clear();
    const w = ctx.screenWidth;
    const h = ctx.screenHeight;
    const now = ctx.time;
    const animSpeed = ctx.animationSpeed || 1;
    const dt = Math.min(ctx.deltaTime, 0.1) * animSpeed;

    // 1. 渲染多层蓬松棉花糖云团 (Puffy Marshmallow Clouds)
    const layerColors = [
      0xf0ddf8, // 远景：淡紫薰衣草
      0xffd4e6, // 中景：草莓牛奶粉
      0xffffff  // 近景：纯净蓬松白云
    ];

    for (const c of this.clouds) {
      // 云朵水平慢漂移（平滑循环）
      c.x += c.speed * dt;
      if (c.x > 1.25) c.x = -0.25;

      const bobY = Math.sin(now * c.bobSpeed + c.bobPhase) * 14;
      const cx = c.x * w;
      const cy = c.y * h + bobY;
      const baseCol = layerColors[c.layer];

      // 绘制棉花糖云朵群聚椭圆
      for (const p of c.puffs) {
        const px = cx + p.dx * c.scale;
        const py = cy + p.dy * c.scale;
        const pr = p.r * c.scale;

        // 云朵底层外发光
        g.circle(px, py, pr * 1.15);
        g.fill({ color: baseCol, alpha: c.alpha * 0.35 });

        // 云朵主体
        g.circle(px, py, pr);
        g.fill({ color: baseCol, alpha: c.alpha });
      }

      // 云朵边缘高光圆弧
      if (c.layer === 2) {
        for (const p of c.puffs) {
          const px = cx + p.dx * c.scale;
          const py = cy + (p.dy - 6) * c.scale;
          const pr = p.r * 0.75 * c.scale;
          g.circle(px, py, pr);
          g.fill({ color: 0xffffff, alpha: 0.4 });
        }
      }
    }

    // 2. 渲染少女心飘浮微粒 (Hearts, Stars, Bubbles)
    for (const s of this.sparkles) {
      s.y -= s.speedY * dt;
      if (s.y < -0.08) {
        s.y = 1.08;
        s.x = seededRandom(now * 1000 + s.phase);
      }

      const swayX = Math.sin(now * s.swaySpeed + s.phase) * s.swayAmp;
      const sx = (s.x + swayX) * w;
      const sy = s.y * h;
      const pulse = 0.85 + 0.15 * Math.sin(now * 2.0 + s.phase);
      const curSize = s.size * pulse;

      if (s.type === 'heart') {
        // 绘制矢量爱心 ♡
        this.drawHeart(g, sx, sy, curSize, s.color, 0.85);
      } else if (s.type === 'star') {
        // 绘制软萌四角星芒 ☆
        this.drawCuteStar(g, sx, sy, curSize, s.color, now * s.rotSpeed);
      } else {
        // 绘制梦幻粉彩气泡
        g.circle(sx, sy, curSize * 0.7);
        g.fill({ color: s.color, alpha: 0.35 });
        g.stroke({ color: 0xffffff, width: 1.5, alpha: 0.8 });
        // 气泡内高光
        g.circle(sx - curSize * 0.25, sy - curSize * 0.25, curSize * 0.2);
        g.fill({ color: 0xffffff, alpha: 0.85 });
      }
    }
  }

  private drawHeart(g: PIXI.Graphics, x: number, y: number, size: number, color: number, alpha: number) {
    const s = size * 0.55;
    g.circle(x - s * 0.5, y - s * 0.3, s * 0.55);
    g.fill({ color, alpha });
    g.circle(x + s * 0.5, y - s * 0.3, s * 0.55);
    g.fill({ color, alpha });
    g.poly([
      x - s, y - s * 0.1,
      x + s, y - s * 0.1,
      x, y + s * 0.95
    ]);
    g.fill({ color, alpha });
    // 心形高光
    g.circle(x - s * 0.45, y - s * 0.45, s * 0.18);
    g.fill({ color: 0xffffff, alpha: 0.75 });
  }

  private drawCuteStar(g: PIXI.Graphics, x: number, y: number, size: number, color: number, angle: number) {
    const r = size * 0.7;
    const inner = r * 0.35;
    const points: number[] = [];
    for (let i = 0; i < 8; i++) {
      const a = angle + (i * Math.PI) / 4;
      const radius = i % 2 === 0 ? r : inner;
      points.push(x + Math.cos(a) * radius, y + Math.sin(a) * radius);
    }
    g.poly(points);
    g.fill({ color, alpha: 0.9 });
    g.circle(x, y, inner * 0.8);
    g.fill({ color: 0xffffff, alpha: 0.75 });
  }
}
