// PV Tool — Copyright (c) 2026 DanteAlighieri13210914
// Licensed under Non-Commercial License. See LICENSE for terms.

import * as PIXI from 'pixi.js';
import { BaseEffect } from './base';
import type { UpdateContext } from '../core/types';
import { resolveColor } from '../core/types';

/** Cinematic letterbox bars (top & bottom). */
export class Letterbox extends BaseEffect {
  readonly name = 'letterbox';
  private graphics!: PIXI.Graphics;

  protected setup(): void {
    this.graphics = new PIXI.Graphics();
    this.container.addChild(this.graphics);
  }

  update(ctx: UpdateContext): void {
    const g = this.graphics;
    g.clear();
    const color = resolveColor(this.config.color ?? '#000000', this.palette);
    const barH = ctx.screenHeight * (this.config.heightFrac ?? 0.11);
    const alpha = this.config.alpha ?? 1;
    g.rect(0, 0, ctx.screenWidth, barH);
    g.rect(0, ctx.screenHeight - barH, ctx.screenWidth, barH);
    g.fill({ color, alpha });
  }
}
