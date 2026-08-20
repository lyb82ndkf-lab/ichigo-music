// PV Tool — Copyright (c) 2026 DanteAlighieri13210914
// Licensed under Non-Commercial License. See LICENSE for terms.

import * as PIXI from 'pixi.js';
import { BaseEffect } from './base';
import type { UpdateContext } from '../core/types';
import { resolveColor } from '../core/types';
import { clamp01 } from '../core/easing';
import { annotateFurigana } from '../../utils/lyrics/furiganaHelper';

interface PopChar {
  obj: PIXI.Text;
  char: string;
  time: number;
  duration: number;
  slotX: number;
  slotY: number;
  lineIdx: number;
}

interface PopRuby {
  obj: PIXI.Text;
  centerX: number;
  baseY: number;
  startGlobalIdx: number;
  endGlobalIdx: number;
}

/**
 * 波普格子花边专属：美漫波普粗边框与漫画弹跳
 * 1. 经典 Pop Art 高饱和度撞色（黄色/粉红/青蓝/纯黑粗描边）
 * 2. 逐字美漫弹性着陆（到达时弹性挤压与反弹放大落地）
 * 3. 伴随波普波点网纹与爆炸徽章
 * 4. 超长歌词两行自适应与平假名注音
 */
export class PopComicText extends BaseEffect {
  readonly name = 'popComicText';
  private textLayer!: PIXI.Container;
  private bgGfx!: PIXI.Graphics;
  private burstGfx!: PIXI.Graphics;
  private translationText!: PIXI.Text;
  private chars: PopChar[] = [];
  private rubies: PopRuby[] = [];
  private currentRaw = '';
  private fontSize = 54;

  protected setup(): void {
    this.bgGfx = new PIXI.Graphics();
    this.burstGfx = new PIXI.Graphics();
    this.textLayer = new PIXI.Container();

    this.container.addChild(this.bgGfx);
    this.container.addChild(this.burstGfx);
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

    this.fontSize = this.config.fontSize ?? 54;
    const fontColor = resolveColor(this.config.color ?? '#ffffff', this.palette);
    const strokeColor = resolveColor(this.config.strokeColor ?? '#000000', this.palette);

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
        const charW = cjk ? this.fontSize * 1.05 : this.fontSize * 0.75;

        const timing = charTimings[globalIdx];
        const time = timing ? timing.time : lineStart + (globalIdx / Math.max(1, chars.length)) * lineDur;
        const duration = timing ? timing.duration : 0.22;

        const obj = new PIXI.Text({
          text: char,
          style: new PIXI.TextStyle({
            fontFamily: '"Impact", "Arial Black", "Trebuchet MS", "PingFang SC", sans-serif',
            fontSize: this.fontSize,
            fontWeight: '900',
            fill: globalIdx % 2 === 0 ? '#ffde59' : fontColor,
            stroke: {
              color: strokeColor,
              width: 7,
              join: 'round'
            },
            dropShadow: {
              color: strokeColor,
              blur: 0,
              distance: 6,
              angle: Math.PI / 4,
              alpha: 1
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
                fontFamily: '"Impact", "PingFang SC", sans-serif',
                fontSize: Math.max(11, Math.round(this.fontSize * 0.28)),
                fontWeight: '900',
                fill: '#00f0ff',
                stroke: { color: '#000000', width: 4 }
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

    const totalW = Math.max(220, (this.textLayer.pivot.x * 2));
    const isMultiLine = this.chars.some(c => c.lineIdx > 0);

    // 绘制波普色块背景条（倾斜撞色）
    this.bgGfx.clear();
    const bgPad = 28;
    const bgX = cx - totalW / 2 - bgPad;
    const bgH = isMultiLine ? this.fontSize * 2.8 : this.fontSize + bgPad;
    const bgY = cy - bgH / 2;
    const bgW = totalW + bgPad * 2;

    // 底部黑色投影条
    this.bgGfx.poly([
      { x: bgX + 6, y: bgY + 8 },
      { x: bgX + bgW + 12, y: bgY + 8 },
      { x: bgX + bgW + 6, y: bgY + bgH + 8 },
      { x: bgX, y: bgY + bgH + 8 }
    ]);
    this.bgGfx.fill({ color: 0x000000, alpha: 0.9 });

    // 顶层粉色斜切背景条
    this.bgGfx.poly([
      { x: bgX, y: bgY },
      { x: bgX + bgW + 6, y: bgY },
      { x: bgX + bgW, y: bgY + bgH },
      { x: bgX - 6, y: bgY + bgH }
    ]);
    this.bgGfx.fill({ color: 0xff3b77, alpha: 0.95 });
    this.bgGfx.stroke({ color: 0x000000, width: 4 });

    // 翻译副歌词
    if (ctx.showTranslation !== false && ctx.translation) {
      this.translationText.visible = true;
      this.translationText.text = ctx.translation;
      this.translationText.x = cx;
      this.translationText.y = cy + bgH / 2 + 10;
    } else {
      this.translationText.visible = false;
    }

    // 逐字美漫弹性弹跳 (Left-to-Right Comic Bounce)
    for (const c of this.chars) {
      const dur = Math.max(0.15, c.duration || 0.25);
      const endTime = c.time + dur;

      if (now < c.time) {
        c.obj.alpha = 0.12;
        c.obj.scale.set(0.85);
        c.obj.y = 8;
      } else if (now <= endTime) {
        const p = clamp01((now - c.time) / dur);
        const bounce = Math.sin(p * Math.PI);
        c.obj.alpha = 1;
        c.obj.scale.set(1.0 + bounce * 0.35, 1.0 - bounce * 0.15);
        c.obj.y = -bounce * (this.fontSize * 0.25);
      } else {
        c.obj.alpha = 1;
        c.obj.scale.set(1);
        c.obj.y = 0;
      }
    }

    // 假名注音同步显现
    for (const r of this.rubies) {
      const parentChar = this.chars[r.startGlobalIdx];
      if (parentChar) {
        if (now < parentChar.time) {
          r.obj.alpha = 0.12;
        } else {
          r.obj.alpha = 1;
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
      this.bgGfx.destroy();
      this.burstGfx.destroy();
      this.translationText.destroy();
      this.textLayer.destroy({ children: true });
    } catch { /* safe */ }
    super.destroy();
  }
}
