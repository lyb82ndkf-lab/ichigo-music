// PV Tool — Copyright (c) 2026 DanteAlighieri13210914
// Licensed under Non-Commercial License. See LICENSE for terms.

import * as PIXI from 'pixi.js';
import { BaseEffect } from './base';
import type { UpdateContext } from '../core/types';
import { seededRandom } from '../core/easing';

let petalTexture: PIXI.Texture | null = null;

/** Classic high-detail sakura petal silhouette drawn on a canvas. */
function getPetalTexture(): PIXI.Texture {
  if (petalTexture) return petalTexture;
  const s = 128;
  const canvas = document.createElement('canvas');
  canvas.width = s;
  canvas.height = s;
  const c = canvas.getContext('2d')!;
  c.translate(s / 2, s / 2);

  // Soft translucent gradient fill
  const grad = c.createRadialGradient(0, -10, 5, 0, 0, 54);
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(0.4, '#ffe4ec');
  grad.addColorStop(0.85, '#ffb8cb');
  grad.addColorStop(1, '#ff9ebb');
  c.fillStyle = grad;

  c.beginPath();
  // Realistic sakura petal with subtle notched tip and curved stem
  c.moveTo(0, -50);
  c.bezierCurveTo(34, -44, 48, -4, 28, 32);
  c.bezierCurveTo(16, 50, 4, 54, 0, 42);
  c.bezierCurveTo(-4, 54, -16, 50, -28, 32);
  c.bezierCurveTo(-48, -4, -34, -44, 0, -50);
  c.closePath();
  c.fill();

  petalTexture = PIXI.Texture.from(canvas);
  return petalTexture;
}

interface Petal {
  sprite: PIXI.Sprite;
  x: number;
  y: number;
  baseSize: number;
  depth: number;      // 0: background small, 1: midground standard, 2: foreground cinematic
  vy: number;
  vx: number;
  swayAmp: number;
  swaySp: number;
  swayPh: number;
  rotX: number;
  rotY: number;
  rotZ: number;
  rotSpX: number;
  rotSpY: number;
  rotSpZ: number;
}

interface PollenSparkle {
  x: number;
  y: number;
  r: number;
  speedY: number;
  swaySp: number;
  phase: number;
  alpha: number;
}

/**
 * 春日樱 / 3D 樱吹雪飘落系统：
 * 1. 前、中、后景三层景深（前置散焦大花瓣掠过、中景细腻翻滚花瓣、远景细碎落樱雨）
 * 2. 真实 3D 空间翻滚 (Pitch / Yaw / Roll 3D 投影翻折变换)
 * 3. 动态物理春风气流与微风摇曳轨迹
 * 4. 浮光漫射的金色/粉色花粉光斑 (Pollen Motes)
 */
export class PetalFall extends BaseEffect {
  readonly name = 'petalFall';
  private petals: Petal[] = [];
  private pollenGfx!: PIXI.Graphics;
  private pollenList: PollenSparkle[] = [];

  protected setup(): void {
    const cfg = this.config;
    const count = cfg.count ?? 38;
    const tex = getPetalTexture();
    const colors: string[] = cfg.colors ?? ['#ffffff', '#ffd0de', '#ffb6cb', '#ffeef4'];

    this.pollenGfx = new PIXI.Graphics();
    this.container.addChild(this.pollenGfx);

    for (let i = 0; i < count; i++) {
      const r = (k: number) => seededRandom(i * 17.9 + k * 3.3);
      const sprite = new PIXI.Sprite(tex);
      sprite.anchor.set(0.5);
      sprite.tint = colors[i % colors.length];

      // 分层：0 远景(50%), 1 中景(35%), 2 前景(15%)
      const depthVal = r(0);
      const depth = depthVal > 0.85 ? 2 : (depthVal > 0.5 ? 1 : 0);
      const baseSize = depth === 2
        ? 42 + r(1) * 36
        : (depth === 1 ? 22 + r(1) * 18 : 12 + r(1) * 10);

      sprite.width = baseSize;
      sprite.height = baseSize;
      sprite.alpha = depth === 2 ? 0.75 : (depth === 1 ? 0.95 : 0.65);

      this.container.addChild(sprite);
      this.petals.push({
        sprite,
        x: r(2) * 1.3 - 0.15,
        y: r(3) * 1.2 - 0.1,
        baseSize,
        depth,
        vy: (depth === 2 ? 0.08 : (depth === 1 ? 0.05 : 0.03)) + r(4) * 0.03,
        vx: 0.03 + r(5) * 0.04,
        swayAmp: 0.03 + r(6) * 0.05,
        swaySp: 0.6 + r(7) * 0.9,
        swayPh: r(8) * Math.PI * 2,
        rotX: r(9) * Math.PI * 2,
        rotY: r(10) * Math.PI * 2,
        rotZ: r(11) * Math.PI * 2,
        rotSpX: (r(12) - 0.5) * 2.5,
        rotSpY: (r(13) - 0.5) * 2.8,
        rotSpZ: (r(14) - 0.5) * 1.8,
      });
    }

    // 初始化金色/粉色花粉漫射微粒
    for (let i = 0; i < 30; i++) {
      const r = (k: number) => seededRandom(i * 41.2 + k * 8.7);
      this.pollenList.push({
        x: r(0),
        y: r(1),
        r: 1.0 + r(2) * 2.2,
        speedY: 0.015 + r(3) * 0.03,
        swaySp: 0.4 + r(4) * 0.8,
        phase: r(5) * Math.PI * 2,
        alpha: 0.3 + r(6) * 0.5
      });
    }
  }

  update(ctx: UpdateContext): void {
    const cfg = this.config;
    const w = ctx.screenWidth;
    const h = ctx.screenHeight;
    const animSpeed = ctx.animationSpeed || 1;
    const dt = Math.min(ctx.deltaTime, 0.1) * animSpeed;
    const now = ctx.time;

    // 1. 物理微风与阵风风向模拟 (Spring Wind Waves)
    const windGust = Math.sin(now * 0.35) * 0.025 + Math.sin(now * 0.8) * 0.015;

    for (const p of this.petals) {
      p.y += p.vy * dt;
      p.x += (p.vx + windGust) * dt;

      // 越界循环生成
      if (p.y > 1.12 || p.x > 1.25) {
        p.y = -0.12;
        p.x = seededRandom(now * 1000 + p.swayPh) * 1.3 - 0.25;
      }

      const sway = Math.sin(now * p.swaySp + p.swayPh) * p.swayAmp;
      p.sprite.x = (p.x + sway) * w;
      p.sprite.y = p.y * h;

      // 3D 空间翻折计算 (3D Tumbling & Flutter)
      p.rotX += p.rotSpX * dt;
      p.rotY += p.rotSpY * dt;
      p.rotZ += p.rotSpZ * dt;

      p.sprite.rotation = p.rotZ;

      // 模拟真实樱花 3D 翻转的透视缩放
      const scaleX = Math.cos(p.rotX);
      const scaleY = Math.sin(p.rotY);
      const depthMultiplier = p.depth === 2 ? 1.4 : (p.depth === 1 ? 1.0 : 0.7);

      p.sprite.scale.x = (0.2 + 0.8 * Math.abs(scaleX)) * depthMultiplier;
      p.sprite.scale.y = (0.2 + 0.8 * Math.abs(scaleY)) * depthMultiplier;
    }

    // 2. 渲染花粉与微光微粒 (Golden Pollen Motes)
    const pg = this.pollenGfx;
    pg.clear();
    for (const pl of this.pollenList) {
      pl.y += pl.speedY * dt;
      pl.x += (0.015 + windGust * 0.5) * dt;
      if (pl.y > 1.05) { pl.y = -0.05; pl.x = seededRandom(now * 800 + pl.phase); }
      if (pl.x > 1.05) { pl.x = -0.05; }

      const px = (pl.x + Math.sin(now * pl.swaySp + pl.phase) * 0.01) * w;
      const py = pl.y * h;
      const tw = 0.6 + 0.4 * Math.sin(now * 2.5 + pl.phase);

      pg.circle(px, py, pl.r);
      pg.fill({ color: 0xffe6b0, alpha: pl.alpha * tw * 0.75 });
    }
  }

  destroy(): void {
    this.petals = [];
    this.pollenList = [];
    super.destroy();
  }
}

