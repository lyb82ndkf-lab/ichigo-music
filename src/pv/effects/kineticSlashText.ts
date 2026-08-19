// PV Tool — Copyright (c) 2026 DanteAlighieri13210914
// Licensed under Non-Commercial License. See LICENSE for terms.

import * as PIXI from 'pixi.js';
import { BaseEffect } from './base';
import type { UpdateContext } from '../core/types';
import { resolveColor } from '../core/types';
import { clamp01 } from '../core/easing';

interface SlashChar {
  obj: PIXI.Text;
  char: string;
  time: number;
  duration: number;
  slotX: number;
  slotY: number;
  angle: number;
  lineIdx: number;
}

/**
 * 激烈排版专属：瑞士重装粗黑现代主义排版与动态冲击撞击
 * 1. 经典红黑高冲击撕纸排版，超粗不规则文字切块
 * 2. 逐字以高速划痕斜切撞击着陆（着陆瞬间伴随微震颤）
 * 3. 超长歌词两行自适应与翻译副标题
 */
export class KineticSlashText extends BaseEffect {
  readonly name = 'kineticSlashText';
  private textLayer!: PIXI.Container;
  private slashGfx!: PIXI.Graphics;
  private translationText!: PIXI.Text;
  private chars: SlashChar[] = [];
  private currentRaw = '';
  private fontSize = 60;

  protected setup(): void {
    this.slashGfx = new PIXI.Graphics();
    this.textLayer = new PIXI.Container();

    this.container.addChild(this.slashGfx);
    this.container.addChild(this.textLayer);

    this.translationText = new PIXI.Text({
      text: '',
      style: new PIXI.TextStyle({
        fontFamily: '"Impact", "PingFang SC", "Microsoft YaHei", sans-serif',
        fontSize: 18,
        fontWeight: 'bold',
        fill: '#ffffff',
        stroke: { color: '#000000', width: 4, join: 'round' }
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

    this.fontSize = this.config.fontSize ?? 60;
    const fontColor = resolveColor(this.config.color ?? '#ffffff', this.palette);
    const strokeColor = resolveColor(this.config.strokeColor ?? '#111111', this.palette);

    const chars = [...raw];
    const charTimings = ctx.charTimings || [];
    const lineStart = ctx.currentLine?.time ?? ctx.time;
    const lineDur = ctx.currentLine?.duration ?? 4.0;

    const isCJK = (ch: string) => /[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af\u3400-\u4dbf]/.test(ch);

    // 超长歌词两行拆分
    const maxLineChars = 18;
    const linesOfChars: { char: string; globalIdx: number }[][] = [];

    if (chars.length > maxLineChars) {
      const mid = Math.floor(chars.length / 2);
      let splitIdx = mid;
      for (let offset = 0; offset <= 5; offset++) {
        if (/[，, 。.？！?!、\s]/.test(chars[mid + offset])) {
          splitIdx = mid + offset + 1;
          break;
        } else if (/[，, 。.？！?!、\s]/.test(chars[mid - offset])) {
          splitIdx = mid - offset + 1;
          break;
        }
      }
      linesOfChars.push(chars.slice(0, splitIdx).map((c, i) => ({ char: c, globalIdx: i })));
      linesOfChars.push(chars.slice(splitIdx).map((c, i) => ({ char: c, globalIdx: splitIdx + i })));
    } else {
      linesOfChars.push(chars.map((c, i) => ({ char: c, globalIdx: i })));
    }

    const lineHeight = this.fontSize * 1.35;
    const lineCount = linesOfChars.length;
    let maxLineWidth = 0;

    for (let lineIdx = 0; lineIdx < lineCount; lineIdx++) {
      const lineData = linesOfChars[lineIdx];
      const yOffset = lineCount === 1 ? 0 : (lineIdx === 0 ? -lineHeight / 2 : lineHeight / 2);

      let cursorX = 0;

      for (let i = 0; i < lineData.length; i++) {
        const { char, globalIdx } = lineData[i];
        const cjk = isCJK(char);
        const charW = cjk ? this.fontSize * 1.05 : this.fontSize * 0.75;

        const timing = charTimings[globalIdx];
        const time = timing ? timing.time : lineStart + (globalIdx / Math.max(1, chars.length)) * lineDur;
        const duration = timing ? timing.duration : 0.2;
        const angle = (i % 2 === 0 ? -0.05 : 0.05) + ((i % 3) * 0.02);

        const obj = new PIXI.Text({
          text: char,
          style: new PIXI.TextStyle({
            fontFamily: '"Impact", "Arial Black", "PingFang SC", sans-serif',
            fontSize: this.fontSize,
            fontWeight: '900',
            fill: globalIdx % 4 === 0 ? '#ff1e1e' : fontColor,
            stroke: {
              color: strokeColor,
              width: 8,
              join: 'round'
            },
            dropShadow: {
              color: strokeColor,
              blur: 0,
              distance: 8,
              angle: Math.PI / 3,
              alpha: 1
            }
          })
        });
        obj.anchor.set(0.5, 0.5);
        obj.rotation = angle;

        const slotX = cursorX + charW / 2;
        obj.x = slotX;
        obj.y = yOffset;
        obj.alpha = 0;
        this.textLayer.addChild(obj);

        this.chars.push({
          obj,
          char,
          time,
          duration,
          slotX,
          slotY: yOffset,
          angle,
          lineIdx
        });

        cursorX += charW;
      }

      if (cursorX > maxLineWidth) {
        maxLineWidth = cursorX;
      }
    }

    this.textLayer.pivot.x = maxLineWidth / 2;
  }

  update(ctx: UpdateContext): void {
    this.rebuildLine(ctx);

    const now = ctx.time;
    const cx = (this.config.x ?? 0.5) * ctx.screenWidth;
    const cy = (this.config.y ?? 0.5) * ctx.screenHeight;

    this.textLayer.x = cx;
    this.textLayer.y = cy;

    const totalW = Math.max(240, (this.textLayer.pivot.x * 2));
    const isMultiLine = this.chars.some(c => c.lineIdx > 0);

    // 绘制撕纸斜切条带
    this.slashGfx.clear();
    const pad = 36;
    const sx = cx - totalW / 2 - pad;
    const sy = cy - (isMultiLine ? this.fontSize * 1.3 : this.fontSize * 0.7);
    const sw = totalW + pad * 2;
    const sh = isMultiLine ? this.fontSize * 2.8 : this.fontSize * 1.4;

    this.slashGfx.poly([
      { x: sx - 16, y: sy + 10 },
      { x: sx + sw + 20, y: sy - 14 },
      { x: sx + sw + 8, y: sy + sh + 12 },
      { x: sx - 24, y: sy + sh - 8 }
    ]);
    this.slashGfx.fill({ color: 0xcc1a1a, alpha: 0.85 });
    this.slashGfx.stroke({ color: 0x111111, width: 3 });

    // 翻译副歌词
    if (ctx.showTranslation !== false && ctx.translation) {
      this.translationText.visible = true;
      this.translationText.text = ctx.translation;
      this.translationText.x = cx;
      this.translationText.y = cy + (isMultiLine ? this.fontSize * 1.5 : this.fontSize * 1.0);
    } else {
      this.translationText.visible = false;
    }

    // 逐字斜切撞击着陆
    for (const c of this.chars) {
      if (now < c.time) {
        c.obj.alpha = 0;
      } else {
        const p = clamp01((now - c.time) / (c.duration || 0.2));
        c.obj.alpha = 1;
        // 高速斜滑切入
        const slideOffset = (1 - p) * 30;
        c.obj.x = c.slotX + slideOffset;
        c.obj.y = c.slotY + slideOffset * 0.5;
        // 着陆微震颤
        if (p < 1) {
          c.obj.rotation = c.angle + Math.sin(p * Math.PI * 4) * 0.05 * (1 - p);
        } else {
          c.obj.rotation = c.angle;
        }
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
      this.slashGfx.destroy();
      this.textLayer.destroy({ children: true });
    } catch { /* safe */ }
    super.destroy();
  }
}
