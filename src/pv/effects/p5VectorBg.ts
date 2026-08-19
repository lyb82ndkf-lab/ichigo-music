// PV Tool — Copyright (c) 2026 DanteAlighieri13210914
// Licensed under Non-Commercial License. See LICENSE for terms.

import * as PIXI from 'pixi.js';
import { BaseEffect } from './base';
import type { UpdateContext } from '../core/types';

interface P5Star {
  x: number;
  y: number;
  r: number;
  rot: number;
  rotSpeed: number;
  color: number;
  points: number; // 4 or 5
  scalePulse: number;
}

interface ChevronBand {
  yFrac: number;
  height: number;
  speed: number;
  angle: number;
  colorBg: number;
  colorFg: number;
}

/**
 * P5怪盗专属矢量背景 (Persona 5 High-Definition Sharp Vector Stage)
 * 1. 锐利几何色块切割（红黑黄白纯正矢量多边形）
 * 2. 动态滑动斜切 Chevron 警示条带与警戒栅格
 * 3. 旋转矢量五角星与四角黑白星芒
 * 4. 漫画半调网点矩阵装饰
 */
export class P5VectorBg extends BaseEffect {
  readonly name = 'p5VectorBg';
  private graphics!: PIXI.Graphics;
  private stars: P5Star[] = [];
  private bands: ChevronBand[] = [];

  protected setup(): void {
    this.graphics = new PIXI.Graphics();
    this.container.addChild(this.graphics);

    // 矢量五角星与四角星
    const starColors = [0x111111, 0xffea00, 0xffffff, 0x111111];
    for (let i = 0; i < 14; i++) {
      this.stars.push({
        x: (i * 0.08 + 0.05) % 1.0,
        y: (i * 0.17 + 0.1) % 0.9,
        r: 16 + (i % 4) * 14,
        rot: (i * Math.PI) / 6,
        rotSpeed: (i % 2 === 0 ? 1 : -1) * (0.4 + (i % 3) * 0.3),
        color: starColors[i % starColors.length],
        points: i % 3 === 0 ? 4 : 5,
        scalePulse: 0.8 + (i % 5) * 0.1
      });
    }

    // 动态滑动警戒色块条
    this.bands = [
      { yFrac: 0.15, height: 42, speed: 60, angle: -0.12, colorBg: 0x111111, colorFg: 0xffea00 },
      { yFrac: 0.82, height: 50, speed: -80, angle: -0.12, colorBg: 0x111111, colorFg: 0xffffff },
      { yFrac: 0.48, height: 28, speed: 45, angle: 0.08, colorBg: 0xffea00, colorFg: 0x111111 }
    ];
  }

  update(ctx: UpdateContext): void {
    const g = this.graphics;
    g.clear();
    const w = ctx.screenWidth;
    const h = ctx.screenHeight;
    const now = ctx.time;
    const animSpeed = ctx.animationSpeed || 1;
    const dt = Math.min(ctx.deltaTime, 0.1) * animSpeed;

    // 1. 锐利矢量对角切割底板 (Sharp Diagonal Split Poly)
    // 鲜红底色 + 巨大黑色几何切角
    const cutShift = Math.sin(now * 0.5) * 20;

    // 左下黑色斜切大三角
    g.poly([
      0, h * 0.45 + cutShift,
      w * 0.55 + cutShift, h,
      0, h
    ]);
    g.fill({ color: 0x111111, alpha: 1 });

    // 右上极窄锐利黑条与黄边
    g.poly([
      w * 0.4 - cutShift, 0,
      w, 0,
      w, h * 0.35 - cutShift,
      w * 0.65 - cutShift, 0
    ]);
    g.fill({ color: 0x111111, alpha: 0.95 });

    // 黄色切割强调线
    g.poly([
      0, h * 0.45 + cutShift - 6,
      w * 0.55 + cutShift + 8, h,
      w * 0.55 + cutShift, h,
      0, h * 0.45 + cutShift
    ]);
    g.fill({ color: 0xffea00, alpha: 1 });

    // 2. 动态滑动 Chevron 警示斜纹条 (Sliding Chevron Hazard Bands)
    for (const b of this.bands) {
      const cy = b.yFrac * h;
      const bw = w * 1.5;
      const bh = b.height;
      const stripeW = bh * 0.75;
      const offset = ((now * b.speed) % (stripeW * 2));

      // 底条
      g.rect(-w * 0.2, cy - bh / 2, bw, bh);
      g.fill({ color: b.colorBg, alpha: 0.92 });

      // 斜纹切块
      for (let x = -w * 0.2 + offset; x < w * 1.3; x += stripeW * 2) {
        g.poly([
          x, cy - bh / 2,
          x + stripeW, cy - bh / 2,
          x + stripeW - bh * 0.4, cy + bh / 2,
          x - bh * 0.4, cy + bh / 2
        ]);
        g.fill({ color: b.colorFg, alpha: 1 });
      }
    }

    // 3. 漫画半调网点矩阵 (Halftone Dot Array)
    const dotSpacing = 28;
    const dotR = 2.5;
    for (let x = 30; x < w * 0.4; x += dotSpacing) {
      for (let y = h * 0.55; y < h - 20; y += dotSpacing) {
        if ((x + y) % 3 === 0) {
          g.circle(x, y, dotR);
          g.fill({ color: 0xffea00, alpha: 0.45 });
        }
      }
    }

    // 4. 旋转矢量五角星与四角星群 (Spinning P5 Vector Stars)
    for (const s of this.stars) {
      s.rot += s.rotSpeed * dt;
      const sx = s.x * w;
      const sy = s.y * h + Math.sin(now * 0.8 + s.x * 10) * 12;
      const pulse = 1 + 0.12 * Math.sin(now * 2.5 + s.x * 5);
      const r = s.r * pulse;

      this.drawVectorStar(g, sx, sy, r, s.points, s.rot, s.color);
    }
  }

  private drawVectorStar(g: PIXI.Graphics, cx: number, cy: number, r: number, pointsCount: number, rot: number, color: number) {
    const innerR = r * (pointsCount === 4 ? 0.32 : 0.42);
    const totalPoints = pointsCount * 2;
    const polyCoords: number[] = [];

    for (let i = 0; i < totalPoints; i++) {
      const a = rot + (i * Math.PI) / pointsCount;
      const radius = i % 2 === 0 ? r : innerR;
      polyCoords.push(cx + Math.cos(a) * radius, cy + Math.sin(a) * radius);
    }

    // 黑色硬边
    g.poly(polyCoords);
    g.fill({ color, alpha: 1 });
    g.stroke({ color: color === 0x111111 ? 0xffffff : 0x111111, width: 2.5 });
  }
}
