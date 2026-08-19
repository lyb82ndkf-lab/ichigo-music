// PV Tool — Copyright (c) 2026 DanteAlighieri13210914
// Licensed under Non-Commercial License. See LICENSE for terms.

import * as PIXI from 'pixi.js';
import { BaseEffect } from './base';
import type { UpdateContext } from '../core/types';
import { resolveColor } from '../core/types';
import { seededRandom } from '../core/easing';

interface Ray {
  angle: number;
  inner: number;   // fraction of maxRadius
  outer: number;
  width: number;
  sp: number;      // outward flow speed
  alpha: number;
}

/**
 * Concentration / speed lines radiating from a focal point, gently
 * rotating and flowing outward. Pop energy without the noise.
 */
export class SpeedLines extends BaseEffect {
  readonly name = 'speedLines';
  override readonly heavy = true;
  private graphics!: PIXI.Graphics;
  private rays: Ray[] = [];

  protected setup(): void {
    this.graphics = new PIXI.Graphics();
    this.container.addChild(this.graphics);
    const count = this.config.count ?? 48;
    for (let i = 0; i < count; i++) {
      const r = (k: number) => seededRandom(i * 9.31 + k * 4.7);
      this.rays.push({
        angle: (i / count) * Math.PI * 2 + (r(0) - 0.5) * 0.06,
        inner: r(1) * 0.5,
        outer: 0.6 + r(2) * 0.45,
        width: this.config.lineWidth ?? 1.6,
        sp: 0.25 + r(3) * 0.5,
        alpha: 0.5 + r(4) * 0.5,
      });
    }
  }

  update(ctx: UpdateContext): void {
    const g = this.graphics;
    g.clear();
    const cfg = this.config;
    const w = ctx.screenWidth;
    const h = ctx.screenHeight;
    const cx = (cfg.x ?? 0.5) * w;
    const cy = (cfg.y ?? 0.5) * h;
    const maxR = Math.hypot(w, h) * 0.55;
    const color = resolveColor(cfg.color ?? '$primary', this.palette);
    const alpha = (cfg.alpha ?? 0.15) + ctx.beatIntensity * (cfg.beatBoost ?? 0.08);
    const rot = ctx.time * (cfg.rotSpeed ?? 0.05) * ctx.animationSpeed;
    const flow = (cfg.flowSpeed ?? 0.5) * ctx.animationSpeed;

    for (const r of this.rays) {
      // inner edge streams outward, then wraps
      const t = (r.inner + ctx.time * r.sp * flow * 0.1) % 0.55;
      const r0 = (0.28 + t) * maxR;
      const r1 = r0 + (r.outer - 0.6) * 0.35 * maxR;
      const a = r.angle + rot;
      g.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
      g.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
      g.stroke({ color, width: r.width, alpha: alpha * r.alpha, cap: 'round' });
    }
  }
}
