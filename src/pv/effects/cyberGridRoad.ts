// PV Tool — Copyright (c) 2026 DanteAlighieri13210914
// Licensed under Non-Commercial License. See LICENSE for terms.

import * as PIXI from 'pixi.js';
import { BaseEffect } from './base';
import type { UpdateContext } from '../core/types';
import { resolveColor } from '../core/types';

/**
 * 赛博朋克 2077 专属：夜之城 3D 透视极速公路与激光扫描网格
 * 伴随音频律动产生高速纵深穿梭感与霓虹光束
 */
export class CyberGridRoad extends BaseEffect {
  readonly name = 'cyberGridRoad';
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
    const colorYellow = resolveColor(this.config.color ?? '#fcee0a', this.palette);
    const colorCyan = resolveColor(this.config.accentColor ?? '#00f0ff', this.palette);

    const bass = ctx.audioReact?.bass ?? 0;
    const isBeat = ctx.audioReact?.isBeat ?? false;

    const horizonY = h * 0.52;
    const speed = ctx.time * 2.5 * ctx.animationSpeed * (1.0 + bass * 0.8);

    // 1. Perspective Grid Lines (Vanish to Horizon Center)
    const cx = w * 0.5;
    const lineCount = 18;

    for (let i = -lineCount; i <= lineCount; i++) {
      const bottomX = cx + (i * (w / (lineCount * 0.8)));
      g.moveTo(cx, horizonY);
      g.lineTo(bottomX, h);
      g.stroke({
        color: (i === 0 || Math.abs(i) === 6) ? colorYellow : colorCyan,
        width: Math.abs(i) === 0 ? 2 : 1,
        alpha: 0.18 + bass * 0.25
      });
    }

    // 2. Horizontal Traverse Lines (Moving towards viewer exponentially)
    const travCount = 12;
    for (let i = 0; i < travCount; i++) {
      const offset = ((i + speed) % travCount) / travCount;
      const expOffset = Math.pow(offset, 2.6); // Perspective compression
      const y = horizonY + expOffset * (h - horizonY);
      const alpha = expOffset * (0.4 + bass * 0.5 + (isBeat ? 0.3 : 0));
      g.moveTo(0, y);
      g.lineTo(w, y);
      g.stroke({ color: colorYellow, width: 1.2 + expOffset * 2, alpha });
    }

    // 3. Horizon Laser Beam
    g.moveTo(0, horizonY);
    g.lineTo(w, horizonY);
    g.stroke({ color: colorCyan, width: 2.5 + bass * 3, alpha: 0.8 + bass * 0.2 });
  }

  destroy(): void {
    try { this.gfx.destroy(); } catch { /* safe */ }
  }
}
