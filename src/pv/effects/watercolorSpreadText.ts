// PV Tool — Copyright (c) 2026 DanteAlighieri13210914
// Licensed under Non-Commercial License. See LICENSE for terms.

import * as PIXI from 'pixi.js';
import { BaseEffect } from './base';
import type { UpdateContext } from '../core/types';
import { resolveColor } from '../core/types';
import { clamp01, easeOutQuart } from '../core/easing';

interface WaterChar {
  obj: PIXI.Text;
  char: string;
  time: number;
  duration: number;
  slotX: number;
}

/**
 * 水彩 / 春日影专属：水彩墨晕渐染与水滴融散
 * 1. 柔和春日水彩青蓝粉紫渐晕
 * 2. 逐字到达时，像一滴水彩落入宣纸慢慢晕染扩散（从轻微模糊渐显到鲜润）
 * 3. 伴随水彩光晕与微风浮动
 * 4. 彻底消除千篇一律的心跳呼吸
 */
export class WatercolorSpreadText extends BaseEffect {
  readonly name = 'watercolorSpreadText';
  private textLayer!: PIXI.Container;
  private haloGfx!: PIXI.Graphics;
  private translationText!: PIXI.Text;
  private chars: WaterChar[] = [];
  private currentRaw = '';
  private fontSize = 48;

  protected setup(): void {
    this.haloGfx = new PIXI.Graphics();
    this.textLayer = new PIXI.Container();

    this.container.addChild(this.haloGfx);
    this.container.addChild(this.textLayer);

    this.translationText = new PIXI.Text({
      text: '',
      style: new PIXI.TextStyle({
        fontFamily: '"Yu Mincho", "Noto Serif JP", "Source Han Serif SC", serif',
        fontSize: 17,
        fontWeight: 'normal',
        fill: resolveColor('$secondary', this.palette) || '#4a6fa5',
        letterSpacing: 2
      })
    });
    this.translationText.anchor.set(0.5, 0);
    this.container.addChild(this.translationText);
  }

  private rebuildLine(ctx: UpdateContext) {
    const raw = ctx.currentText || '';
    if (raw === this.currentRaw && this.chars.length > 0) return;
    this.currentRaw = raw;

    for (const c of this.chars) {
      try {
        this.textLayer.removeChild(c.obj);
        c.obj.destroy();
      } catch { /* safe */ }
    }
    this.chars = [];

    if (!raw.trim()) return;

    this.fontSize = this.config.fontSize ?? 48;
    const fontColor = resolveColor(this.config.color ?? '#4a6fa5', this.palette);

    const isCJK = (ch: string) => /[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af\u3400-\u4dbf]/.test(ch);
    const chars = [...raw];
    const charTimings = ctx.charTimings || [];
    const lineStart = ctx.currentLine?.time ?? ctx.time;
    const lineDur = ctx.currentLine?.duration ?? 4.0;

    let cursorX = 0;

    for (let i = 0; i < chars.length; i++) {
      const char = chars[i];
      const cjk = isCJK(char);
      const isSpace = /\s/.test(char);
      const charW = isSpace ? this.fontSize * 0.35 : (cjk ? this.fontSize * 1.05 : this.fontSize * 0.56);

      const timing = charTimings[i];
      const time = timing ? timing.time : lineStart + (i / Math.max(1, chars.length)) * lineDur;
      const duration = timing ? timing.duration : 0.35;

      const obj = new PIXI.Text({
        text: char,
        style: new PIXI.TextStyle({
          fontFamily: '"Yu Mincho", "Noto Serif JP", "Source Han Serif SC", "Songti SC", serif',
          fontSize: this.fontSize,
          fontWeight: '500',
          fill: fontColor,
          letterSpacing: cjk ? 2 : 0
        })
      });
      obj.anchor.set(0.5, 0.5);

      const slotX = cursorX + charW / 2;
      obj.x = slotX;
      obj.y = 0;
      obj.alpha = 0;
      this.textLayer.addChild(obj);

      this.chars.push({
        obj,
        char,
        time,
        duration,
        slotX
      });

      cursorX += charW;
    }

    this.textLayer.pivot.x = cursorX / 2;
  }

  update(ctx: UpdateContext): void {
    this.rebuildLine(ctx);

    const now = ctx.time;
    const cx = (this.config.x ?? 0.5) * ctx.screenWidth;
    const cy = (this.config.y ?? 0.5) * ctx.screenHeight;

    this.textLayer.x = cx;
    this.textLayer.y = cy;

    const totalW = Math.max(220, (this.textLayer.pivot.x * 2));

    // 绘制水彩底晕圆弧
    this.haloGfx.clear();
    this.haloGfx.circle(cx, cy, totalW / 2 + 30);
    this.haloGfx.fill({ color: resolveColor('$secondary', this.palette), alpha: 0.12 });

    // 翻译副歌词 (水彩和风排版)
    if (ctx.showTranslation !== false && ctx.translation) {
      this.translationText.visible = true;
      this.translationText.text = ctx.translation;
      this.translationText.x = cx;
      this.translationText.y = cy + this.fontSize * 0.9;
    } else {
      this.translationText.visible = false;
    }

    // 逐字水彩晕染渐散与弹跳扩散 (Left-to-Right Watercolor Pop & Bloom)
    for (const c of this.chars) {
      const dur = Math.max(0.15, c.duration || 0.35);
      const endTime = c.time + dur;

      if (now < c.time) {
        // 未唱到：极淡水墨底色，准备晕开
        c.obj.alpha = 0.15;
        c.obj.scale.set(0.92);
        c.obj.y = 5;
      } else if (now <= endTime) {
        // 正在唱到：水墨落纸晕染激荡，向上微弹并扩散 (Pop & Bloom)
        const p = clamp01((now - c.time) / dur);
        const pulse = Math.sin(p * Math.PI);
        const bounce = -pulse * (this.fontSize * 0.16);
        const bloomScale = 1.0 + (1 - p) * 0.22 + pulse * 0.12;
        c.obj.alpha = Math.min(1, 0.4 + p * 0.6);
        c.obj.scale.set(bloomScale);
        c.obj.y = bounce;
      } else {
        // 已唱过：鲜润水墨落定，微风轻拂
        c.obj.alpha = 1.0;
        c.obj.scale.set(1.0);
        c.obj.y = Math.sin(now * 1.2 + c.slotX * 0.05) * 1.5;
      }
    }
  }

  destroy(): void {
    for (const c of this.chars) {
      try { c.obj.destroy(); } catch { /* safe */ }
    }
    this.chars = [];
    try {
      this.translationText.destroy();
      this.haloGfx.destroy();
      this.textLayer.destroy({ children: true });
    } catch { /* safe */ }
    super.destroy();
  }
}
