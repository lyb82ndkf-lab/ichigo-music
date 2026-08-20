// PV Tool — Copyright (c) 2026 DanteAlighieri13210914
// Licensed under Non-Commercial License. See LICENSE for terms.

import * as PIXI from 'pixi.js';
import { BaseEffect } from './base';
import type { UpdateContext } from '../core/types';
import { resolveColor } from '../core/types';

/**
 * 赛博朋克 2077 专属：夜之城天际线、霓虹全息信标与战术黄色 HUD 边角
 * 1. 严格使用官方指定的字体：西文 [Rajdhani]，中文 [文鼎 UD 晶熙黑]
 * 2. 具备低音反应性天际线均衡器与全息光幕脉冲
 */
export class CyberpunkNightCity extends BaseEffect {
  readonly name = 'cyberpunkNightCity';
  private gfxSkyline!: PIXI.Graphics;
  private gfxHud!: PIXI.Graphics;
  private bannerTextTop!: PIXI.Text;
  private bannerTextBottom!: PIXI.Text;

  protected setup(): void {
    this.gfxSkyline = new PIXI.Graphics();
    this.gfxHud = new PIXI.Graphics();

    this.container.addChild(this.gfxSkyline);
    this.container.addChild(this.gfxHud);

    const cyberFont = '"Rajdhani", "文鼎 UD 晶熙黑", "AR CrystalUD Gothic", "Noto Sans TC", "Noto Sans SC", sans-serif';

    this.bannerTextTop = new PIXI.Text({
      text: 'NIGHT CITY WIRE // PROTOCOL: 2077 // NEURAL LINK: ACTIVE',
      style: new PIXI.TextStyle({
        fontFamily: cyberFont,
        fontSize: 12,
        fontWeight: 'bold',
        fill: '#fcee0a',
        letterSpacing: 2
      })
    });
    this.container.addChild(this.bannerTextTop);

    this.bannerTextBottom = new PIXI.Text({
      text: 'TRAUMA TEAM INTEL // SEC-LEVEL: 0 // BRAINDANCE FEED',
      style: new PIXI.TextStyle({
        fontFamily: cyberFont,
        fontSize: 11,
        fontWeight: '600',
        fill: '#00f0ff',
        letterSpacing: 2
      })
    });
    this.container.addChild(this.bannerTextBottom);
  }

  update(ctx: UpdateContext): void {
    const w = ctx.screenWidth;
    const h = ctx.screenHeight;
    const bass = ctx.audioReact?.bass ?? 0;
    const energy = ctx.audioReact?.energy ?? 0;
    const isBeat = ctx.audioReact?.isBeat ?? false;

    const yellow = resolveColor(this.config.color ?? '#fcee0a', this.palette);
    const cyan = resolveColor(this.config.accentColor ?? '#00f0ff', this.palette);
    const red = 0xff003c;

    // 1. 绘制夜之城巨型天际线与楼宇霓虹窗
    const gSky = this.gfxSkyline;
    gSky.clear();

    const horizonY = h * 0.72;
    const bldCount = 14;
    const bldWidth = w / bldCount;

    for (let i = 0; i < bldCount; i++) {
      const bx = i * bldWidth;
      // Fixed pseudo-random building heights
      const hSeed = Math.sin(i * 99.1 + 12.3) * 0.5 + 0.5;
      const bHeight = 120 + hSeed * (h * 0.35) + (i % 3 === 0 ? bass * 40 : 0);
      const by = horizonY - bHeight;

      // Building block
      gSky.rect(bx, by, bldWidth + 1, bHeight + (h - horizonY));
      gSky.fill({ color: 0x06060c, alpha: 0.95 });
      gSky.stroke({ color: 0x141424, width: 1 });

      // Window grid neon glow
      if (hSeed > 0.3) {
        const winCols = 3;
        const winRows = Math.floor(bHeight / 24);
        for (let r = 0; r < winRows; r++) {
          if ((r + i) % 4 === 0) {
            const wy = by + 12 + r * 20;
            const wx = bx + 6;
            gSky.rect(wx, wy, bldWidth - 12, 3);
            const winColor = (i % 2 === 0) ? cyan : yellow;
            gSky.fill({ color: winColor, alpha: 0.15 + (isBeat ? 0.3 : 0.05) });
          }
        }
      }

      // Rooftop antenna beam
      if (i % 4 === 1) {
        gSky.moveTo(bx + bldWidth / 2, by);
        gSky.lineTo(bx + bldWidth / 2, by - 28);
        gSky.stroke({ color: red, width: 2, alpha: 0.8 });
        // Red blinker
        gSky.circle(bx + bldWidth / 2, by - 28, 2.5 + bass * 2);
        gSky.fill({ color: red, alpha: (Math.sin(ctx.time * 6 + i) > 0 || isBeat) ? 1 : 0.2 });
      }
    }

    // 2. 绘制 2077 标志性赛博黄色切角 HUD 与高能扫描线
    const gHud = this.gfxHud;
    gHud.clear();

    // Top yellow header bar
    gHud.rect(20, 20, 160, 4);
    gHud.fill({ color: yellow, alpha: 0.9 });
    gHud.rect(184, 20, 8, 4);
    gHud.fill({ color: yellow, alpha: 0.9 });

    this.bannerTextTop.x = 200;
    this.bannerTextTop.y = 14;

    // Bottom cyan telemetry bar
    gHud.rect(w - 240, h - 26, 220, 2);
    gHud.fill({ color: cyan, alpha: 0.7 + bass * 0.3 });

    this.bannerTextBottom.x = 24;
    this.bannerTextBottom.y = h - 28;

    // Corner yellow cyber brackets
    const cornerSize = 24;
    // Top-right
    gHud.moveTo(w - 20 - cornerSize, 20).lineTo(w - 20, 20).lineTo(w - 20, 20 + cornerSize);
    // Bottom-left
    gHud.moveTo(20, h - 20 - cornerSize).lineTo(20, h - 20).lineTo(20 + cornerSize, h - 20);
    gHud.stroke({ color: yellow, width: 2, alpha: 0.85 });

    // Audio Equalizer meter in bottom-right
    const eqBars = 8;
    for (let b = 0; b < eqBars; b++) {
      const barH = 6 + Math.sin(ctx.time * 4 + b) * 12 + bass * 24 * ((b + 1) / eqBars);
      gHud.rect(w - 180 + b * 16, h - 20 - Math.max(4, barH), 8, Math.max(4, barH));
      gHud.fill({ color: b > 5 ? red : cyan, alpha: 0.8 });
    }
  }

  destroy(): void {
    try {
      this.bannerTextTop.destroy();
      this.bannerTextBottom.destroy();
      this.gfxSkyline.destroy();
      this.gfxHud.destroy();
    } catch { /* safe */ }
  }
}
