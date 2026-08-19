// PV Tool — Copyright (c) 2026 DanteAlighieri13210914
// Licensed under Non-Commercial License. See LICENSE for terms.

import * as PIXI from 'pixi.js';
import { BaseEffect } from './base';
import type { UpdateContext } from '../core/types';
import { resolveColor } from '../core/types';

/**
 * A single elegant thread winding across the screen — layered sine
 * octaves, drawn twice (wide soft halo + hairline core). Slowly morphs.
 * "赤い糸" (the red string of fate) look.
 */
export class ThreadLine extends BaseEffect {
  readonly name = 'threadLine';
  override readonly heavy = true;
  private graphics!: PIXI.Graphics;

  protected setup(): void {
    this.graphics = new PIXI.Graphics();
    this.container.addChild(this.graphics);
  }

  private trace(ctx: UpdateContext, t: number): void {
    const g = this.graphics;
    const cfg = this.config;
    const w = ctx.screenWidth;
    const h = ctx.screenHeight;
    const yBase = (cfg.y ?? 0.5) * h;
    const amp = (cfg.amplitude ?? 0.16) * h * ctx.motionIntensity;

    g.moveTo(-20, yBase);
    for (let x = -20; x <= w + 20; x += 6) {
      const u = x / w;
      const y = yBase
        + Math.sin(u * Math.PI * 2 * 1.4 + t) * amp
        + Math.sin(u * Math.PI * 2 * 3.1 - t * 0.7) * amp * 0.35
        + Math.sin(u * Math.PI * 2 * 0.6 + t * 0.45) * amp * 0.5;
      g.lineTo(x, y);
    }
  }

  update(ctx: UpdateContext): void {
    const g = this.graphics;
    g.clear();
    const cfg = this.config;
    const color = resolveColor(cfg.color ?? '$accent', this.palette);
    const alpha = cfg.alpha ?? 0.9;
    const t = ctx.time * (cfg.speed ?? 0.4) * ctx.animationSpeed;

    // halo
    this.trace(ctx, t);
    g.stroke({ color, width: (cfg.width ?? 2.5) * 4, alpha: alpha * 0.18, cap: 'round', join: 'round' });
    // core
    this.trace(ctx, t);
    g.stroke({ color, width: cfg.width ?? 2.5, alpha, cap: 'round', join: 'round' });
  }
}
