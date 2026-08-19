// PV Tool — Copyright (c) 2026 DanteAlighieri13210914
// Licensed under Non-Commercial License. See LICENSE for terms.

import * as PIXI from 'pixi.js';
import { BaseEffect } from './base';
import type { UpdateContext } from '../core/types';
import { resolveColor } from '../core/types';
import { seededRandom } from '../core/easing';
import { getSoftBlobTexture } from './softTexture';

interface Mote {
  sprite: PIXI.Sprite;
  x: number; y: number;         // screen fraction
  vx: number; vy: number;       // drift (fraction / s)
  size: number;                 // px
  twinklePh: number;
  twinkleSp: number;
  baseAlpha: number;
}

/**
 * Floating dust / bokeh motes with parallax depth (small = slow & dim).
 * The quiet atmosphere layer of 日系MV stills.
 */
export class DustParticles extends BaseEffect {
  readonly name = 'dustParticles';
  private motes: Mote[] = [];

  protected setup(): void {
    const cfg = this.config;
    const count = cfg.count ?? 26;
    const color = resolveColor(cfg.color ?? '#ffffff', this.palette);
    const minSize = cfg.minSize ?? 3;
    const maxSize = cfg.maxSize ?? 16;
    const blend = cfg.blend === 'add' ? 'add' : cfg.blend === 'screen' ? 'screen' : 'normal';
    const tex = getSoftBlobTexture();

    for (let i = 0; i < count; i++) {
      const r = (k: number) => seededRandom(i * 13.73 + k * 5.1);
      const depth = r(0); // 0 far … 1 near
      const sprite = new PIXI.Sprite(tex);
      sprite.anchor.set(0.5);
      sprite.tint = color;
      sprite.blendMode = blend;
      const size = minSize + (maxSize - minSize) * depth * depth;
      sprite.width = size;
      sprite.height = size;
      this.container.addChild(sprite);
      const drift = 0.004 + depth * 0.012;
      const ang = (cfg.driftAngle ?? -90) * Math.PI / 180 + (r(1) - 0.5) * 1.2;
      this.motes.push({
        sprite,
        x: r(2), y: r(3),
        vx: Math.cos(ang) * drift,
        vy: Math.sin(ang) * drift,
        size,
        twinklePh: r(4) * Math.PI * 2,
        twinkleSp: 0.3 + r(5) * 0.8,
        baseAlpha: 0.25 + depth * 0.55,
      });
    }
  }

  update(ctx: UpdateContext): void {
    const w = ctx.screenWidth;
    const h = ctx.screenHeight;
    const speed = (this.config.speed ?? 1) * ctx.animationSpeed;
    const alpha = this.config.alpha ?? 0.6;
    const dt = Math.min(ctx.deltaTime, 0.1);

    for (const m of this.motes) {
      m.x += m.vx * dt * speed;
      m.y += m.vy * dt * speed;
      // wrap with margin
      if (m.x < -0.05) m.x += 1.1; else if (m.x > 1.05) m.x -= 1.1;
      if (m.y < -0.05) m.y += 1.1; else if (m.y > 1.05) m.y -= 1.1;

      const tw = 0.6 + 0.4 * Math.sin(ctx.time * m.twinkleSp + m.twinklePh);
      m.sprite.alpha = alpha * m.baseAlpha * tw;
      m.sprite.x = m.x * w;
      m.sprite.y = m.y * h;
    }
  }

  destroy(): void {
    this.motes = [];
    super.destroy();
  }
}
