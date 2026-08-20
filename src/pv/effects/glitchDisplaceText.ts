// PV Tool — Copyright (c) 2026 DanteAlighieri13210914
// Licensed under Non-Commercial License. See LICENSE for terms.

import * as PIXI from 'pixi.js';
import { BaseEffect } from './base';
import type { UpdateContext } from '../core/types';
import { resolveColor } from '../core/types';
import { annotateFurigana } from '../../utils/lyrics/furiganaHelper';

interface GlitchChar {
  objMain: PIXI.Text;
  objRed: PIXI.Text;
  objCyan: PIXI.Text;
  char: string;
  time: number;
  duration: number;
  slotX: number;
  slotY: number;
  lineIdx: number;
}

interface GlitchRuby {
  obj: PIXI.Text;
  centerX: number;
  baseY: number;
  startGlobalIdx: number;
  endGlobalIdx: number;
}

/**
 * 故障艺术 / 赛博矩阵专属：RGB 色散切片与数码故障位移
 * 1. 经典赛博朋克 RGB Channel 分离（红/青双色散）
 * 2. 逐字到达时触发瞬态数码切片与 RGB 错位震颤
 * 3. 超长歌词两行自适应与故障翻译字幕
 * 4. 支持平假名复合注音
 */
export class GlitchDisplaceText extends BaseEffect {
  readonly name = 'glitchDisplaceText';
  private textLayer!: PIXI.Container;
  private glitchBarGfx!: PIXI.Graphics;
  private translationText!: PIXI.Text;
  private chars: GlitchChar[] = [];
  private rubies: GlitchRuby[] = [];
  private currentRaw = '';
  private fontSize = 52;

  protected setup(): void {
    this.glitchBarGfx = new PIXI.Graphics();
    this.textLayer = new PIXI.Container();

    this.container.addChild(this.glitchBarGfx);
    this.container.addChild(this.textLayer);

    this.translationText = new PIXI.Text({
      text: '',
      style: new PIXI.TextStyle({
        fontFamily: '"Consolas", "PingFang SC", "Microsoft YaHei", monospace',
        fontSize: 17,
        fontWeight: 'bold',
        fill: '#00f0ff',
        dropShadow: {
          color: '#ff003c',
          blur: 0,
          distance: 2,
          angle: 0,
          alpha: 0.9
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

    for (const r of this.rubies) {
      try {
        this.textLayer.removeChild(r.obj);
        r.obj.destroy();
      } catch { /* safe */ }
    }
    this.rubies = [];

    for (const c of this.chars) {
      try {
        this.textLayer.removeChild(c.objMain);
        this.textLayer.removeChild(c.objRed);
        this.textLayer.removeChild(c.objCyan);
        c.objMain.destroy();
        c.objRed.destroy();
        c.objCyan.destroy();
      } catch { /* safe */ }
    }
    this.chars = [];

    if (!raw.trim()) return;

    this.fontSize = this.config.fontSize ?? 52;
    const fontColor = resolveColor(this.config.color ?? '#ffffff', this.palette);

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
        const duration = timing ? timing.duration : 0.22;

        // 红色通道错位层
        const objRed = new PIXI.Text({
          text: char,
          style: new PIXI.TextStyle({
            fontFamily: '"Impact", "Consolas", "PingFang SC", sans-serif',
            fontSize: this.fontSize,
            fontWeight: 'bold',
            fill: '#ff003c'
          })
        });
        objRed.anchor.set(0.5, 0.5);

        // 青色通道错位层
        const objCyan = new PIXI.Text({
          text: char,
          style: new PIXI.TextStyle({
            fontFamily: '"Impact", "Consolas", "PingFang SC", sans-serif',
            fontSize: this.fontSize,
            fontWeight: 'bold',
            fill: '#00f0ff'
          })
        });
        objCyan.anchor.set(0.5, 0.5);

        // 白色主文字层
        const objMain = new PIXI.Text({
          text: char,
          style: new PIXI.TextStyle({
            fontFamily: '"Impact", "Consolas", "PingFang SC", sans-serif',
            fontSize: this.fontSize,
            fontWeight: 'bold',
            fill: fontColor
          })
        });
        objMain.anchor.set(0.5, 0.5);

        const slotX = cursorX + charW / 2;
        objRed.x = slotX;
        objRed.y = yOffset;
        objCyan.x = slotX;
        objCyan.y = yOffset;
        objMain.x = slotX;
        objMain.y = yOffset;

        objRed.alpha = 0;
        objCyan.alpha = 0;
        objMain.alpha = 0;

        this.textLayer.addChild(objRed);
        this.textLayer.addChild(objCyan);
        this.textLayer.addChild(objMain);

        this.chars.push({
          objMain,
          objRed,
          objCyan,
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
                fontFamily: '"Impact", "Consolas", "PingFang SC", sans-serif',
                fontSize: Math.max(11, Math.round(this.fontSize * 0.28)),
                fontWeight: 'bold',
                fill: '#00f0ff',
                dropShadow: { color: '#ff003c', blur: 0, distance: 2, angle: 0, alpha: 0.9 }
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

    // 绘制随机数码切片横条
    this.glitchBarGfx.clear();
    if (Math.random() < 0.15) {
      const gY = cy + (Math.random() - 0.5) * (this.fontSize * 1.5);
      const gH = 3 + Math.random() * 8;
      this.glitchBarGfx.rect(cx - totalW / 2 - 20, gY, totalW + 40, gH);
      this.glitchBarGfx.fill({ color: Math.random() < 0.5 ? 0x00f0ff : 0xff003c, alpha: 0.7 });
    }

    // 翻译副歌词
    if (ctx.showTranslation !== false && ctx.translation) {
      this.translationText.visible = true;
      this.translationText.text = ctx.translation;
      this.translationText.x = cx;
      this.translationText.y = cy + (isMultiLine ? this.fontSize * 1.4 : this.fontSize * 0.95);
    } else {
      this.translationText.visible = false;
    }

    // 逐字 RGB 色散与瞬态位移
    for (const c of this.chars) {
      if (now < c.time) {
        c.objMain.alpha = 0;
        c.objRed.alpha = 0;
        c.objCyan.alpha = 0;
      } else {
        const elapsed = now - c.time;
        c.objMain.alpha = 1;
        if (elapsed < 0.15) {
          const glitchPower = (1 - elapsed / 0.15) * 12;
          c.objRed.alpha = 0.8;
          c.objCyan.alpha = 0.8;

          c.objRed.x = c.slotX - glitchPower * (0.6 + Math.random() * 0.4);
          c.objCyan.x = c.slotX + glitchPower * (0.6 + Math.random() * 0.4);
          c.objMain.y = c.slotY + (Math.random() - 0.5) * glitchPower * 0.5;
        } else {
          c.objRed.alpha = 0;
          c.objCyan.alpha = 0;
          c.objMain.y = c.slotY;
        }
      }
    }

    // 假名注音同步显现
    for (const r of this.rubies) {
      const parentChar = this.chars[r.startGlobalIdx];
      if (parentChar) {
        if (now < parentChar.time) {
          r.obj.alpha = 0;
        } else {
          r.obj.alpha = 0.95;
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
      try {
        c.objMain.destroy();
        c.objRed.destroy();
        c.objCyan.destroy();
      } catch { /* safe */ }
    }
    this.chars = [];
    try {
      this.translationText.destroy();
      this.glitchBarGfx.destroy();
      this.textLayer.destroy({ children: true });
    } catch { /* safe */ }
    super.destroy();
  }
}
