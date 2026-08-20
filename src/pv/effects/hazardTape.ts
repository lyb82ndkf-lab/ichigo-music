// PV Tool — Copyright (c) 2026 DanteAlighieri13210914
// Licensed under Non-Commercial License. See LICENSE for terms.

import * as PIXI from 'pixi.js';
import { BaseEffect } from './base';
import type { UpdateContext } from '../core/types';
import { resolveColor } from '../core/types';

/**
 * 警戒封条 / 战术斜条纹 (Tactical Hazard Warning Tape)
 * 经典 EVA 红色/黑色或黄色/黑色高对比度斜向警戒封条
 */
export class HazardTape extends BaseEffect {
  readonly name = 'hazardTape';
  private gfx!: PIXI.Graphics;
  private bannerTextTop!: PIXI.Text;
  private bannerTextBottom!: PIXI.Text;

  protected setup(): void {
    this.gfx = new PIXI.Graphics();
    this.container.addChild(this.gfx);

    this.bannerTextTop = new PIXI.Text({
      text: 'EMERGENCY // PRIORITY-1 // PATTERN: BLOOD-TYPE RED',
      style: new PIXI.TextStyle({
        fontFamily: '"Impact", "Arial Black", sans-serif',
        fontSize: 12,
        fill: '#ffffff',
        letterSpacing: 3
      })
    });
    this.container.addChild(this.bannerTextTop);

    this.bannerTextBottom = new PIXI.Text({
      text: 'CAUTION // SYNCHRONIZATION RATE: 100% // NERV HQ',
      style: new PIXI.TextStyle({
        fontFamily: '"Impact", "Arial Black", sans-serif',
        fontSize: 12,
        fill: '#ffffff',
        letterSpacing: 3
      })
    });
    this.container.addChild(this.bannerTextBottom);
  }

  update(ctx: UpdateContext): void {
    const g = this.gfx;
    g.clear();

    const w = ctx.screenWidth;
    const h = ctx.screenHeight;
    const color = resolveColor(this.config.color ?? '#ff1836', this.palette);
    const alpha = this.config.alpha ?? 0.85;

    const tapeHeight = 28;
    const stripeWidth = 24;
    const speed = (ctx.time * 60 * ctx.animationSpeed) % (stripeWidth * 2);

    // Top Tape
    g.rect(0, 24, w, tapeHeight);
    g.fill({ color: 0x111118, alpha: 0.9 });
    for (let x = -stripeWidth * 2 + speed; x < w + stripeWidth * 2; x += stripeWidth * 2) {
      g.moveTo(x, 24);
      g.lineTo(x + stripeWidth, 24);
      g.lineTo(x, 24 + tapeHeight);
      g.lineTo(x - stripeWidth, 24 + tapeHeight);
      g.closePath();
      g.fill({ color, alpha });
    }

    // Bottom Tape
    g.rect(0, h - 52, w, tapeHeight);
    g.fill({ color: 0x111118, alpha: 0.9 });
    for (let x = -stripeWidth * 2 - speed; x < w + stripeWidth * 2; x += stripeWidth * 2) {
      g.moveTo(x, h - 52);
      g.lineTo(x + stripeWidth, h - 52);
      g.lineTo(x, h - 52 + tapeHeight);
      g.lineTo(x - stripeWidth, h - 52 + tapeHeight);
      g.closePath();
      g.fill({ color, alpha });
    }

    this.bannerTextTop.x = 24;
    this.bannerTextTop.y = 32;
    this.bannerTextBottom.x = 24;
    this.bannerTextBottom.y = h - 44;
  }

  destroy(): void {
    try {
      this.bannerTextTop.destroy();
      this.bannerTextBottom.destroy();
      this.gfx.destroy();
    } catch { /* safe */ }
  }
}
