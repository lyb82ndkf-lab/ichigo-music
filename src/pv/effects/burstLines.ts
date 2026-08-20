// PV Tool — Copyright (c) 2026 DanteAlighieri13210914
// Licensed under Non-Commercial License. See LICENSE for terms.

import * as PIXI from 'pixi.js';
import { BaseEffect } from './base';
import type { UpdateContext } from '../core/types';
import { resolveColor } from '../core/types';

export class BurstLines extends BaseEffect {
  readonly name = 'burstLines';
  private g!: PIXI.Graphics;
  private drawn = false;
  private lastW = 0;
  private lastH = 0;

  protected setup(): void {
    this.g = new PIXI.Graphics();
    this.container.addChild(this.g);
  }

  update(ctx: UpdateContext): void {
    const isStatic = (this.config.rotSpeed ?? 0.05) === 0;
    if (isStatic && this.drawn && this.lastW === ctx.screenWidth && this.lastH === ctx.screenHeight) return;
    this.drawn = true;
    this.lastW = ctx.screenWidth;
    this.lastH = ctx.screenHeight;

    const g = this.g;
    g.clear();

    const w = ctx.screenWidth;
    const h = ctx.screenHeight;
    const cx = w * (this.config.x ?? 0.5);
    const cy = h * (this.config.y ?? 0.5);
    const color = resolveColor(this.config.color ?? '$secondary', this.palette);
    const alpha = this.config.alpha ?? 0.25;
    const rayCount = this.config.rayCount ?? 24;
    const innerRadius = Math.min(w, h) * (this.config.innerRadius ?? 0.08);
    const outerRadius = Math.max(w, h) * (this.config.outerRadius ?? 0.7);
    const angleStep = (Math.PI * 2) / rayCount;
    const rotSpeed = (this.config.rotSpeed ?? 0.05) * ctx.animationSpeed;
    const rot = ctx.time * rotSpeed;

    const bass = ctx.audioReact?.bass ?? 0;
    const energy = ctx.audioReact?.energy ?? 0;
    const isBeat = ctx.audioReact?.isBeat ?? false;
    const pulse = 1.0 + bass * 0.35 + (isBeat ? 0.25 : 0);
    const dynAlpha = Math.min(1.0, alpha * (0.7 + energy * 0.8 + (isBeat ? 0.4 : 0)));
    const dynOuterRadius = outerRadius * pulse;

    for (let i = 0; i < rayCount; i++) {
      const angle = rot + i * angleStep;
      const sx = cx + Math.cos(angle) * innerRadius;
      const sy = cy + Math.sin(angle) * innerRadius;
      const ex = cx + Math.cos(angle) * dynOuterRadius;
      const ey = cy + Math.sin(angle) * dynOuterRadius;
      g.moveTo(sx, sy).lineTo(ex, ey);
    }
    g.stroke({ color, width: (this.config.lineWidth ?? 1) * (isBeat ? 1.6 : 1.0), alpha: dynAlpha });
  }
}