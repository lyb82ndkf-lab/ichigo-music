// PV Tool — Copyright (c) 2026 DanteAlighieri13210914
// Licensed under Non-Commercial License. See LICENSE for terms.

import * as PIXI from 'pixi.js';
import { BaseEffect } from './base';
import type { UpdateContext } from '../core/types';
import { resolveColor } from '../core/types';

/**
 * EVA 专属：红色蜂窝防御屏障 (Hexagonal A.T. Field Honeycomb)
 * 伴随音频低音产生六边形能量护盾脉冲与红色冲击波
 */
export class EvaHexGrid extends BaseEffect {
  readonly name = 'evaHexGrid';
  private gfx!: PIXI.Graphics;

  protected setup(): void {
    this.gfx = new PIXI.Graphics();
    this.container.addChild(this.gfx);
  }

  update(ctx: UpdateContext): void {
    const g = this.gfx;
    g.clear();

    const w = ctx.screenWidth;
    const h = ctx.screenHeight;
    const color = resolveColor(this.config.color ?? '#ff1836', this.palette);
    const alpha = this.config.alpha ?? 0.25;

    const bass = ctx.audioReact?.bass ?? 0;
    const isBeat = ctx.audioReact?.isBeat ?? false;
    const dynAlpha = Math.min(0.9, alpha * (0.8 + bass * 1.4 + (isBeat ? 0.4 : 0)));

    const hexRadius = 42;
    const hexWidth = Math.sqrt(3) * hexRadius;
    const hexHeight = 2 * hexRadius;
    const vertDist = hexHeight * 0.75;

    const cols = Math.ceil(w / hexWidth) + 2;
    const rows = Math.ceil(h / vertDist) + 2;

    const time = ctx.time * 0.8 * ctx.animationSpeed;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = c * hexWidth + ((r % 2) * (hexWidth / 2));
        const y = r * vertDist;

        // Dist from center for wave ripple
        const dx = (x - w / 2) / (w / 2);
        const dy = (y - h / 2) / (h / 2);
        const dist = Math.hypot(dx, dy);

        const wave = Math.sin(dist * 5.0 - time * 2.0);
        if (wave > 0.35 || isBeat) {
          const cellAlpha = Math.max(0, (wave - 0.35) * 1.5) * dynAlpha;
          this.drawHex(g, x, y, hexRadius * (0.92 + bass * 0.1), color, cellAlpha);
        }
      }
    }
  }

  private drawHex(g: PIXI.Graphics, cx: number, cy: number, r: number, color: number, alpha: number) {
    const points: [number, number][] = [];
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i + Math.PI / 6;
      points.push([cx + r * Math.cos(angle), cy + r * Math.sin(angle)]);
    }

    g.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < 6; i++) {
      g.lineTo(points[i][0], points[i][1]);
    }
    g.closePath();
    g.stroke({ color, width: 1.5, alpha });
    g.fill({ color, alpha: alpha * 0.22 });
  }

  destroy(): void {
    try { this.gfx.destroy(); } catch { /* safe */ }
  }
}
