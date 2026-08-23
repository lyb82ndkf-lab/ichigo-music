// PV Tool — Copyright (c) 2026 DanteAlighieri13210914
// Licensed under Non-Commercial License. See LICENSE for terms.

import * as PIXI from 'pixi.js';
import { BaseEffect } from './base';
import type { UpdateContext } from '../core/types';
import { resolveColor } from '../core/types';
import { clamp01, easeOutQuart } from '../core/easing';
import { annotateFurigana } from '../../utils/lyrics/furiganaHelper';

interface PoeticChar {
  obj: PIXI.Text;
  char: string;
  time: number;
  duration: number;
  baseX: number;
  baseY: number;
  floatPhase: number;
  lineIdx: number;
}

interface PoeticRuby {
  obj: PIXI.Text;
  baseX: number;
  baseY: number;
  startGlobalIdx: number;
  endGlobalIdx: number;
  floatPhase: number;
}

/**
 * 错落文字 (Yorushika) 专属：诗意错落排版与黄昏微尘
 * 1. 彻底废除机械全倾斜！采用ヨルシカ (Yorushika) 诗意微错落排版
 * 2. 奇偶字符带有自然的微高低起伏与字距呼吸漂移
 * 3. 优雅的衬线字体、半透明阶梯淡入与黄昏浮尘微动
 * 4. 超长歌词两行自适应排版与翻译副标题
 * 5. 全面支持平假名复合注音与行居中对齐
 */
export class PoeticStaggerText extends BaseEffect {
  readonly name = 'poeticStaggerText';
  private textLayer!: PIXI.Container;
  private quoteGfx!: PIXI.Graphics;
  private translationText!: PIXI.Text;
  private chars: PoeticChar[] = [];
  private rubies: PoeticRuby[] = [];
  private currentRaw = '';
  private fontSize = 48;

  protected setup(): void {
    this.quoteGfx = new PIXI.Graphics();
    this.textLayer = new PIXI.Container();
    this.container.addChild(this.quoteGfx);
    this.container.addChild(this.textLayer);

    this.translationText = new PIXI.Text({
      text: '',
      style: new PIXI.TextStyle({
        fontFamily: '"Noto Serif SC", "Source Han Serif SC", "Yu Mincho", serif',
        fontSize: 16,
        fill: resolveColor('$secondary', this.palette),
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

    for (const r of this.rubies) {
      try {
        this.textLayer.removeChild(r.obj);
        r.obj.destroy();
      } catch { /* safe */ }
    }
    this.rubies = [];

    for (const c of this.chars) {
      try {
        this.textLayer.removeChild(c.obj);
        c.obj.destroy();
      } catch { /* safe */ }
    }
    this.chars = [];

    if (!raw.trim()) return;

    this.fontSize = this.config.fontSize ?? 48;
    const fontColor = resolveColor(this.config.color ?? '$text', this.palette);
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
    const globalCharSlots: Record<number, { slotX: number; charW: number; y: number; lineIdx: number }> = {};

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
            fontFamily: '"Noto Serif SC", "Source Han Serif SC", "Yu Mincho", "MS Mincho", serif',
            fontSize: this.fontSize,
            fontWeight: i % 3 === 0 ? '600' : '400',
            fill: fontColor,
            letterSpacing: 3
          })
        });
        obj.anchor.set(0.5, 0.5);

        const staggerY = yOffset + (i % 2 === 0 ? -4 : 4);
        const slotX = cursorX + charW / 2;

        obj.x = slotX;
        obj.y = staggerY;
        obj.alpha = 0;
        this.textLayer.addChild(obj);

        this.chars.push({
          obj,
          char,
          time,
          duration,
          baseX: slotX,
          baseY: staggerY,
          floatPhase: globalIdx * 0.6,
          lineIdx
        });

        globalCharSlots[globalIdx] = { slotX, charW, y: staggerY, lineIdx };
        cursorX += charW;
      }

      if (cursorX > maxLineWidth) {
        maxLineWidth = cursorX;
      }
    }

    // Furigana 注音生成
    if (ctx.showFurigana !== false) {
      const segments = annotateFurigana(raw);
      let charCursor = 0;
      for (const seg of segments) {
        const segLen = seg.text.length;
        const startIdx = charCursor;
        const endIdx = charCursor + segLen - 1;

        if (seg.ruby && globalCharSlots[startIdx] && globalCharSlots[endIdx]) {
          const sSlot = globalCharSlots[startIdx];
          const eSlot = globalCharSlots[endIdx];

          if (sSlot.lineIdx === eSlot.lineIdx) {
            const leftEdge = sSlot.slotX - sSlot.charW / 2;
            const rightEdge = eSlot.slotX + eSlot.charW / 2;
            const compoundCenterX = (leftEdge + rightEdge) / 2;
            const rubyY = sSlot.y - this.fontSize * 0.56;

            const rubyFill = resolveColor('$primary', this.palette) || '#ffffff';
            const rubyObj = new PIXI.Text({
              text: seg.ruby,
              style: new PIXI.TextStyle({
                fontFamily: '"Noto Serif SC", "Source Han Serif SC", "Yu Mincho", serif',
                fontSize: Math.max(11, Math.round(this.fontSize * 0.28)),
                fontWeight: '600',
                fill: rubyFill,
                stroke: { color: '#000000', width: 2 },
                dropShadow: { color: '#000000', alpha: 0.6, blur: 4, distance: 1 }
              })
            });
            rubyObj.anchor.set(0.5, 0.5);
            rubyObj.x = compoundCenterX;
            rubyObj.y = rubyY;
            rubyObj.alpha = 0;
            this.textLayer.addChild(rubyObj);

            this.rubies.push({
              obj: rubyObj,
              baseX: compoundCenterX,
              baseY: rubyY,
              startGlobalIdx: startIdx,
              endGlobalIdx: endIdx,
              floatPhase: startIdx * 0.6
            });
          }
        }
        charCursor += segLen;
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

    const totalW = Math.max(200, (this.textLayer.pivot.x * 2));
    const isMultiLine = this.chars.some(c => c.lineIdx > 0);

    // 翻译副歌词在下方
    if (ctx.showTranslation !== false && ctx.translation) {
      this.translationText.visible = true;
      this.translationText.text = ctx.translation;
      this.translationText.x = cx;
      this.translationText.y = cy + (isMultiLine ? this.fontSize * 1.35 : this.fontSize * 0.95);
    } else {
      this.translationText.visible = false;
    }

    // 诗意书名号/引号装饰线
    this.quoteGfx.clear();
    const qX = cx - totalW / 2 - 18;
    const qY = cy - (isMultiLine ? this.fontSize * 1.1 : this.fontSize * 0.6);
    this.quoteGfx.moveTo(qX, qY);
    this.quoteGfx.lineTo(qX + 8, qY);
    this.quoteGfx.lineTo(qX, qY + 12);
    this.quoteGfx.stroke({ color: resolveColor('$secondary', this.palette), width: 1.5, alpha: 0.6 });

    // 逐字诗意浮现与微浮动
    for (const c of this.chars) {
      if (now < c.time) {
        c.obj.alpha = 0.12;
        c.obj.y = c.baseY + 8;
      } else {
        const p = clamp01((now - c.time) / (c.duration || 0.25));
        const ease = easeOutQuart(p);
        c.obj.alpha = 0.95;
        const floatDelta = Math.sin(now * 1.5 + c.floatPhase) * 1.5;
        c.obj.y = c.baseY + (1 - ease) * 8 + floatDelta;
      }
    }

    // 假名注音同步浮现
    for (const r of this.rubies) {
      const parentChar = this.chars[r.startGlobalIdx];
      if (parentChar) {
        if (now < parentChar.time) {
          r.obj.alpha = 0.12;
          r.obj.y = r.baseY + 6;
        } else {
          const p = clamp01((now - parentChar.time) / (parentChar.duration || 0.25));
          const ease = easeOutQuart(p);
          r.obj.alpha = 0.9;
          const floatDelta = Math.sin(now * 1.5 + r.floatPhase) * 1.5;
          r.obj.y = r.baseY + (1 - ease) * 6 + floatDelta;
        }
      }
    }
  }

  destroy(): void {
    for (const r of this.rubies) {
      try { r.obj.destroy(); } catch { /* safe */ }
    }
    this.rubies = [];

    for (const c of this.chars) {
      try { c.obj.destroy(); } catch { /* safe */ }
    }
    this.chars = [];
    try {
      this.translationText.destroy();
      this.quoteGfx.destroy();
      this.textLayer.destroy({ children: true });
    } catch { /* safe */ }
    super.destroy();
  }
}
