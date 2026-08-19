// PV Tool — Copyright (c) 2026 DanteAlighieri13210914
// Licensed under Non-Commercial License. See LICENSE for terms.

import * as PIXI from 'pixi.js';
import { BaseEffect } from './base';
import type { UpdateContext } from '../core/types';
import { resolveColor } from '../core/types';

interface NeonChar {
  obj: PIXI.Text;
  char: string;
  time: number;
  duration: number;
  slotX: number;
  slotY: number;
  lineIdx: number;
}

/**
 * 霓虹夜市专属：霓虹灯管通电打火闪烁与辉光点亮
 * 1. 经典霓虹夜市管线辉光（玫红/荧光青/金黄）
 * 2. 逐字在时间到达时进行 3 次高速高频通电打火闪烁，然后稳定通电发光
 * 3. 超长歌词两行自适应与荧光翻译字幕
 */
export class NeonFlickerText extends BaseEffect {
  readonly name = 'neonFlickerText';
  private textLayer!: PIXI.Container;
  private tubeFrameGfx!: PIXI.Graphics;
  private translationText!: PIXI.Text;
  private chars: NeonChar[] = [];
  private currentRaw = '';
  private fontSize = 52;

  protected setup(): void {
    this.tubeFrameGfx = new PIXI.Graphics();
    this.textLayer = new PIXI.Container();

    this.container.addChild(this.tubeFrameGfx);
    this.container.addChild(this.textLayer);

    this.translationText = new PIXI.Text({
      text: '',
      style: new PIXI.TextStyle({
        fontFamily: '"Outfit", "PingFang SC", "Microsoft YaHei", sans-serif',
        fontSize: 17,
        fontWeight: 'bold',
        fill: '#00f0ff',
        dropShadow: {
          color: '#ff007f',
          blur: 10,
          distance: 0,
          alpha: 0.8
        }
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

    this.fontSize = this.config.fontSize ?? 52;
    const neonColor = resolveColor(this.config.color ?? '#ff007f', this.palette);
    const glowColor = resolveColor(this.config.glowColor ?? '#00f0ff', this.palette);

    const chars = [...raw];
    const charTimings = ctx.charTimings || [];
    const lineStart = ctx.currentLine?.time ?? ctx.time;
    const lineDur = ctx.currentLine?.duration ?? 4.0;

    const isCJK = (ch: string) => /[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af\u3400-\u4dbf]/.test(ch);

    // 超长歌词两行拆分
    const maxLineChars = 20;
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
        const charW = cjk ? this.fontSize * 1.05 : this.fontSize * 0.72;

        const timing = charTimings[globalIdx];
        const time = timing ? timing.time : lineStart + (globalIdx / Math.max(1, chars.length)) * lineDur;
        const duration = timing ? timing.duration : 0.25;

        const obj = new PIXI.Text({
          text: char,
          style: new PIXI.TextStyle({
            fontFamily: '"Outfit", "Arial Rounded MT Bold", "PingFang SC", sans-serif',
            fontSize: this.fontSize,
            fontWeight: '900',
            fill: '#ffffff',
            stroke: {
              color: neonColor,
              width: 4,
              join: 'round'
            },
            dropShadow: {
              color: glowColor,
              blur: 16,
              distance: 0,
              alpha: 0.95
            }
          })
        });
        obj.anchor.set(0.5, 0.5);

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

    // 绘制霓虹边框灯管
    this.tubeFrameGfx.clear();
    const pad = 24;
    const fx = cx - totalW / 2 - pad;
    const fy = cy - (isMultiLine ? this.fontSize * 1.3 : this.fontSize * 0.7);
    const fw = totalW + pad * 2;
    const fh = isMultiLine ? this.fontSize * 2.8 : this.fontSize * 1.4;

    this.tubeFrameGfx.roundRect(fx, fy, fw, fh, 12);
    this.tubeFrameGfx.stroke({ color: 0x00f0ff, width: 2, alpha: 0.6 });

    // 翻译副歌词
    if (ctx.showTranslation !== false && ctx.translation) {
      this.translationText.visible = true;
      this.translationText.text = ctx.translation;
      this.translationText.x = cx;
      this.translationText.y = cy + (isMultiLine ? this.fontSize * 1.5 : this.fontSize * 0.95);
    } else {
      this.translationText.visible = false;
    }

    // 逐字霓虹灯管通电打火闪烁
    for (const c of this.chars) {
      if (now < c.time) {
        c.obj.alpha = 0.08;
      } else {
        const elapsed = now - c.time;
        // 通电前 0.18s 发生 3 次高频闪烁打火
        if (elapsed < 0.18) {
          const flickers = Math.sin(elapsed * 45);
          c.obj.alpha = flickers > 0 ? 1 : 0.2;
        } else {
          // 通电完毕稳定常亮，伴随轻微电压呼吸
          const stableGlow = 0.9 + Math.sin(now * 8 + c.slotX) * 0.08;
          c.obj.alpha = stableGlow;
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
      this.tubeFrameGfx.destroy();
      this.textLayer.destroy({ children: true });
    } catch { /* safe */ }
    super.destroy();
  }
}
