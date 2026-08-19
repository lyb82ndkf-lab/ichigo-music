// PV Tool — Copyright (c) 2026 DanteAlighieri13210914
// Licensed under Non-Commercial License. See LICENSE for terms.

import * as PIXI from 'pixi.js';
import { BaseEffect } from './base';
import type { UpdateContext } from '../core/types';
import { resolveColor } from '../core/types';

/**
 * Synthwave / city-pop sun: a warm gradient disc with horizontal slits
 * carved out of its lower half, hovering over the horizon line.
 */
export class RetroSun extends BaseEffect {
  readonly name = 'retroSun';
  private sprite!: PIXI.Sprite;
  private built = false;
  private baseY = 0;

  protected setup(): void {}

  private build(): void {
    if (this.built) return;
    this.built = true;

    const cfg = this.config;
    const colorTop = resolveColor(cfg.colorTop ?? '#ffd319', this.palette);
    const colorBottom = resolveColor(cfg.colorBottom ?? '#ff2975', this.palette);

    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const c = canvas.getContext('2d')!;

    // vertical gradient disc
    const grad = c.createLinearGradient(0, 0, 0, size);
    grad.addColorStop(0, colorTop);
    grad.addColorStop(1, colorBottom);
    c.fillStyle = grad;
    c.beginPath();
    c.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2);
    c.fill();

    // carve transparent horizontal slits, widening toward the bottom
    c.globalCompositeOperation = 'destination-out';
    let y = size * 0.52;
    let gap = 3;
    while (y < size) {
      c.fillRect(0, y, size, gap);
      y += gap + 14;
      gap += 4;
    }
    c.globalCompositeOperation = 'source-over';

    this.sprite = new PIXI.Sprite(PIXI.Texture.from(canvas));
    this.sprite.anchor.set(0.5);
    this.container.addChild(this.sprite);
  }

  update(ctx: UpdateContext): void {
    this.build();
    const cfg = this.config;
    const d = ctx.screenHeight * (cfg.sizeFrac ?? 0.55);
    this.sprite.x = (cfg.x ?? 0.5) * ctx.screenWidth;
    this.baseY = (cfg.y ?? 0.52) * ctx.screenHeight;
    // gentle hover bob + beat pulse
    const bob = Math.sin(ctx.time * 0.5 * ctx.animationSpeed) * d * 0.008;
    this.sprite.y = this.baseY + bob;
    const pulse = 1 + ctx.beatIntensity * (cfg.beatPulse ?? 0.02);
    this.sprite.scale.set((d / 512) * pulse);
    this.sprite.alpha = cfg.alpha ?? 1;
  }
}
