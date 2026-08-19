// PV Tool — Copyright (c) 2026 DanteAlighieri13210914
// Licensed under Non-Commercial License. See LICENSE for terms.

import * as PIXI from 'pixi.js';
import { BaseEffect } from './base';
import type { UpdateContext } from '../core/types';
import { resolveColor } from '../core/types';
import { seededRandom } from '../core/easing';
import { getSoftBlobTexture } from './softTexture';

interface Blob {
  sprite: PIXI.Sprite;
  cx: number; cy: number;   // orbit center (screen fraction)
  rx: number; ry: number;   // orbit radii (screen fraction)
  sp1: number; sp2: number; // angular speeds
  ph1: number; ph2: number; // phases
  baseScale: number;
  scalePh: number;
}

/**
 * Aurora / mesh-gradient background: large soft colour blobs drifting
 * slowly over the base background colour. Use blend 'add' on dark
 * backgrounds, 'normal' (or 'screen') with pastel colours on light ones.
 */
export class MeshGradient extends BaseEffect {
  readonly name = 'meshGradient';
  private blobs: Blob[] = [];

  protected setup(): void {
    const cfg = this.config;
    const tex = getSoftBlobTexture();
    const count = cfg.count ?? 4;
    const colors: string[] = (cfg.colors && cfg.colors.length > 0)
      ? cfg.colors
      : ['$primary', '$secondary', '$accent'];
    const blend = cfg.blend === 'add' ? 'add' : cfg.blend === 'screen' ? 'screen' : 'normal';

    for (let i = 0; i < count; i++) {
      const r = (k: number) => seededRandom(i * 7.13 + k * 3.7);
      const sprite = new PIXI.Sprite(tex);
      sprite.anchor.set(0.5);
      sprite.tint = resolveColor(colors[i % colors.length], this.palette);
      sprite.blendMode = blend;
      this.container.addChild(sprite);
      this.blobs.push({
        sprite,
        cx: 0.15 + r(1) * 0.7,
        cy: 0.15 + r(2) * 0.7,
        rx: 0.08 + r(3) * 0.16,
        ry: 0.06 + r(4) * 0.14,
        sp1: (0.05 + r(5) * 0.08) * (r(6) > 0.5 ? 1 : -1),
        sp2: (0.04 + r(7) * 0.07) * (r(8) > 0.5 ? 1 : -1),
        ph1: r(9) * Math.PI * 2,
        ph2: r(10) * Math.PI * 2,
        baseScale: 0.55 + r(11) * 0.5,
        scalePh: r(12) * Math.PI * 2,
      });
    }
  }

  update(ctx: UpdateContext): void {
    const cfg = this.config;
    const w = ctx.screenWidth;
    const h = ctx.screenHeight;
    const dim = Math.max(w, h);
    const speed = (cfg.speed ?? 1) * ctx.animationSpeed * 0.28;
    const alpha = cfg.alpha ?? 0.75;
    const t = ctx.time * speed;

    for (const b of this.blobs) {
      b.sprite.x = (b.cx + Math.sin(t * b.sp1 + b.ph1) * b.rx) * w;
      b.sprite.y = (b.cy + Math.cos(t * b.sp2 + b.ph2) * b.ry) * h;
      const breathe = 1 + Math.sin(t * 0.6 + b.scalePh) * 0.12;
      const s = (dim / 256) * b.baseScale * breathe * 2.2;
      b.sprite.scale.set(s);
      b.sprite.alpha = alpha;
    }
  }

  destroy(): void {
    this.blobs = [];
    super.destroy();
  }
}
