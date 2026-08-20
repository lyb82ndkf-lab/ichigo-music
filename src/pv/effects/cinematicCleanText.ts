// PV Tool — Copyright (c) 2026 DanteAlighieri13210914
// Licensed under Non-Commercial License. See LICENSE for terms.

import * as PIXI from 'pixi.js';
import { BaseEffect } from './base';
import type { UpdateContext } from '../core/types';
import { resolveColor } from '../core/types';
import { clamp01, easeOutExpo } from '../core/easing';
import { annotateFurigana } from '../../utils/lyrics/furiganaHelper';

interface CleanChar {
  obj: PIXI.Text;
  char: string;
  time: number;
  duration: number;
  slotX: number;
  slotY: number;
  lineIdx: number;
}

interface CleanRuby {
  obj: PIXI.Text;
  centerX: number;
  baseY: number;
  startGlobalIdx: number;
  endGlobalIdx: number;
}

/**
 * 极简剪影专属：电影宽银幕画幅与极简留白排版
 * 1. 2.35:1 电影宽银幕遮罩、极简负空间、沉静电影感
 * 2. 极细线条十字准星与场景编号标记
 * 3. 超长歌词两行自适应排版与平假名注音
 */
export class CinematicCleanText extends BaseEffect {
  readonly name = 'cinematicCleanText';
  private textLayer!: PIXI.Container;
  private letterboxGfx!: PIXI.Graphics;
  private crosshairGfx!: PIXI.Graphics;
  private sceneBadge!: PIXI.Text;
  private translationText!: PIXI.Text;
  private chars: CleanChar[] = [];
  private rubies: CleanRuby[] = [];
  private currentRaw = '';
  private fontSize = 44;

  protected setup(): void {
    this.letterboxGfx = new PIXI.Graphics();
    this.crosshairGfx = new PIXI.Graphics();
    this.textLayer = new PIXI.Container();

    this.container.addChild(this.letterboxGfx);
    this.container.addChild(this.crosshairGfx);
    this.container.addChild(this.textLayer);

    this.sceneBadge = new PIXI.Text({
      text: 'SCENE_01 • TAKE_04  [SILHOUETTE 2.35:1 CINEMASCOPE]',
      style: new PIXI.TextStyle({
        fontFamily: '"Helvetica Neue", "Inter", sans-serif',
        fontSize: 10,
        fill: resolveColor('$secondary', this.palette),
        letterSpacing: 3
      })
    });
    this.container.addChild(this.sceneBadge);

    this.translationText = new PIXI.Text({
      text: '',
      style: new PIXI.TextStyle({
        fontFamily: '"Helvetica Neue", "Inter", "PingFang SC", sans-serif',
        fontSize: 16,
        fontWeight: '300',
        fill: 'rgba(255, 255, 255, 0.7)',
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

    this.fontSize = this.config.fontSize ?? 44;
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
        const charW = cjk ? this.fontSize * 1.05 : this.fontSize * 0.70;

        const timing = charTimings[globalIdx];
        const time = timing ? timing.time : lineStart + (globalIdx / Math.max(1, chars.length)) * lineDur;
        const duration = timing ? timing.duration : 0.3;

        const obj = new PIXI.Text({
          text: char,
          style: new PIXI.TextStyle({
            fontFamily: '"Helvetica Neue", "Inter", "PingFang SC", sans-serif',
            fontSize: this.fontSize,
            fontWeight: '300',
            fill: fontColor,
            letterSpacing: 4
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

        globalCharSlots[globalIdx] = { slotX, charW, y: yOffset, lineIdx };
        cursorX += charW;
      }

      if (cursorX > maxLineWidth) {
        maxLineWidth = cursorX;
      }
    }

    // Furigana 平假名注音生成
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
            const rubyY = sSlot.y - this.fontSize * 0.58;

            const rubyObj = new PIXI.Text({
              text: seg.ruby,
              style: new PIXI.TextStyle({
                fontFamily: '"Helvetica Neue", "Inter", sans-serif',
                fontSize: Math.max(10, Math.round(this.fontSize * 0.28)),
                fontWeight: '300',
                fill: resolveColor('$secondary', this.palette) || '#cccccc',
                alpha: 0.85
              })
            });
            rubyObj.anchor.set(0.5, 0.5);
            rubyObj.x = compoundCenterX;
            rubyObj.y = rubyY;
            rubyObj.alpha = 0;
            this.textLayer.addChild(rubyObj);

            this.rubies.push({
              obj: rubyObj,
              centerX: compoundCenterX,
              baseY: rubyY,
              startGlobalIdx: startIdx,
              endGlobalIdx: endIdx
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

    const isMultiLine = this.chars.some(c => c.lineIdx > 0);

    // 绘制 2.35:1 电影宽银幕上下遮罩条
    this.letterboxGfx.clear();
    const barHeight = ctx.screenHeight * 0.12;
    this.letterboxGfx.rect(0, 0, ctx.screenWidth, barHeight);
    this.letterboxGfx.rect(0, ctx.screenHeight - barHeight, ctx.screenWidth, barHeight);
    this.letterboxGfx.fill({ color: 0x000000, alpha: 0.95 });

    // 极简十字准星
    this.crosshairGfx.clear();
    const chSize = 14;
    const chY = cy - (isMultiLine ? this.fontSize * 1.3 : this.fontSize * 0.9);
    this.crosshairGfx.moveTo(cx - chSize, chY);
    this.crosshairGfx.lineTo(cx + chSize, chY);
    this.crosshairGfx.moveTo(cx, chY - chSize);
    this.crosshairGfx.lineTo(cx, chY + chSize);
    this.crosshairGfx.stroke({ color: 0xffffff, width: 1, alpha: 0.3 });

    this.sceneBadge.x = cx - this.sceneBadge.width / 2;
    this.sceneBadge.y = cy - (isMultiLine ? this.fontSize * 1.5 : this.fontSize * 1.1) - 18;

    // 翻译副歌词
    if (ctx.showTranslation !== false && ctx.translation) {
      this.translationText.visible = true;
      this.translationText.text = ctx.translation;
      this.translationText.x = cx;
      this.translationText.y = cy + (isMultiLine ? this.fontSize * 1.3 : this.fontSize * 0.9);
    } else {
      this.translationText.visible = false;
    }

    // 逐字沉静微光淡入与平滑展开
    for (const c of this.chars) {
      if (now < c.time) {
        c.obj.alpha = 0.08;
        c.obj.y = c.slotY + 6;
      } else {
        const p = clamp01((now - c.time) / (c.duration || 0.3));
        const ease = easeOutExpo(p);
        c.obj.alpha = 0.92;
        c.obj.y = c.slotY + (1 - ease) * 6;
      }
    }

    // 假名注音同步显现
    for (const r of this.rubies) {
      const parentChar = this.chars[r.startGlobalIdx];
      if (parentChar) {
        if (now < parentChar.time) {
          r.obj.alpha = 0.08;
          r.obj.y = r.baseY + 4;
        } else {
          const p = clamp01((now - parentChar.time) / (parentChar.duration || 0.3));
          const ease = easeOutExpo(p);
          r.obj.alpha = 0.85;
          r.obj.y = r.baseY + (1 - ease) * 4;
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
      this.sceneBadge.destroy();
      this.crosshairGfx.destroy();
      this.letterboxGfx.destroy();
      this.textLayer.destroy({ children: true });
    } catch { /* safe */ }
    super.destroy();
  }
}
