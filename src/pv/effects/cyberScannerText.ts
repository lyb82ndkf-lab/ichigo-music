// PV Tool — Copyright (c) 2026 DanteAlighieri13210914
// Licensed under Non-Commercial License. See LICENSE for terms.

import * as PIXI from 'pixi.js';
import { BaseEffect } from './base';
import type { UpdateContext } from '../core/types';
import { resolveColor } from '../core/types';
import { clamp01 } from '../core/easing';
import { annotateFurigana } from '../../utils/lyrics/furiganaHelper';

interface CyberChar {
  obj: PIXI.Text;
  char: string;
  time: number;
  duration: number;
  slotX: number;
  scrambleGlyphs: string[];
}

interface CyberRuby {
  obj: PIXI.Text;
  centerX: number;
  startCharIdx: number;
  endCharIdx: number;
}

/**
 * 赛博朋克 2077 专属：夜之城数码扫码器与 HUD 视窗歌词
 * 1. 严格使用官方指定字体：西文 [Rajdhani]，中文 [文鼎 UD 晶熙黑]
 * 2. 逐字到达时，伴随赛博黑客字符瞬态矩阵解密 (Cyber Scramble)
 * 3. 伴随 HUD 瞄准边框、扫描线与日语平假名复合注音
 */
export class CyberScannerText extends BaseEffect {
  readonly name = 'cyberScannerText';
  private textLayer!: PIXI.Container;
  private hudGfx!: PIXI.Graphics;
  private metaTextTop!: PIXI.Text;
  private translationText!: PIXI.Text;
  private chars: CyberChar[] = [];
  private rubies: CyberRuby[] = [];
  private currentRaw = '';
  private fontSize = 54;
  private readonly GLYPHS = ['0', '1', 'X', 'Z', '9', '7', '/', '#', '!', '?', '>', '<', '$', '%', '&'];

  protected setup(): void {
    this.hudGfx = new PIXI.Graphics();
    this.textLayer = new PIXI.Container();

    this.container.addChild(this.hudGfx);
    this.container.addChild(this.textLayer);

    const cyberFont = '"Rajdhani", "文鼎 UD 晶熙黑", "AR CrystalUD Gothic", "Noto Sans TC", "Noto Sans SC", sans-serif';

    this.metaTextTop = new PIXI.Text({
      text: 'CYBERWARE OS // MEM: 64TB // BRAINDANCE SYNC: 99.8%',
      style: new PIXI.TextStyle({
        fontFamily: '"Rajdhani", "Consolas", monospace',
        fontSize: 12,
        fontWeight: 'bold',
        fill: resolveColor('$secondary', this.palette) || '#fcee0a',
        letterSpacing: 2
      })
    });
    this.metaTextTop.anchor.set(0.5, 1);
    this.container.addChild(this.metaTextTop);

    this.translationText = new PIXI.Text({
      text: '',
      style: new PIXI.TextStyle({
        fontFamily: cyberFont,
        fontSize: 18,
        fontWeight: '600',
        fill: '#00f0ff',
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

    // Thoroughly clean up all existing character and ruby text objects
    for (const c of this.chars) {
      try {
        this.textLayer.removeChild(c.obj);
        c.obj.destroy();
      } catch { /* safe */ }
    }
    for (const r of this.rubies) {
      try {
        this.textLayer.removeChild(r.obj);
        r.obj.destroy();
      } catch { /* safe */ }
    }
    this.chars = [];
    this.rubies = [];
    this.textLayer.removeChildren();

    if (!raw.trim()) return;

    this.fontSize = this.config.fontSize ?? 54;
    const fontColor = resolveColor(this.config.color ?? '#fcee0a', this.palette);
    const cyberFont = '"Rajdhani", "文鼎 UD 晶熙黑", "AR CrystalUD Gothic", "Noto Sans TC", "Noto Sans SC", "PingFang SC", "Microsoft YaHei", sans-serif';

    const isCJK = (ch: string) => /[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af\u3400-\u4dbf]/.test(ch);
    const chars = [...raw];
    const charTimings = ctx.charTimings || [];
    const lineStart = ctx.currentLine?.time ?? ctx.time;
    const lineDur = ctx.currentLine?.duration ?? 4.0;

    let cursorX = 0;
    const charSlots: { slotX: number; charW: number }[] = [];

    // 1. Measure and position each character
    for (let i = 0; i < chars.length; i++) {
      const char = chars[i];
      const cjk = isCJK(char);
      const isSpace = /\s/.test(char);
      const charW = isSpace ? this.fontSize * 0.35 : (cjk ? this.fontSize * 1.05 : this.fontSize * 0.58);

      const timing = charTimings[i];
      const time = timing ? timing.time : lineStart + (i / Math.max(1, chars.length)) * lineDur;
      const duration = timing ? timing.duration : 0.22;

      const obj = new PIXI.Text({
        text: char,
        style: new PIXI.TextStyle({
          fontFamily: cyberFont,
          fontSize: this.fontSize,
          fontWeight: '700',
          fill: fontColor,
          letterSpacing: cjk ? 2 : 1
        })
      });
      obj.anchor.set(0.5, 0.5);

      const slotX = cursorX + charW / 2;
      obj.x = slotX;
      obj.y = 0;
      obj.alpha = 0;
      this.textLayer.addChild(obj);

      const scrambleGlyphs = [
        this.GLYPHS[Math.floor(Math.random() * this.GLYPHS.length)],
        this.GLYPHS[Math.floor(Math.random() * this.GLYPHS.length)],
        this.GLYPHS[Math.floor(Math.random() * this.GLYPHS.length)]
      ];

      this.chars.push({
        obj,
        char,
        time,
        duration,
        slotX,
        scrambleGlyphs
      });

      charSlots.push({ slotX, charW });
      cursorX += charW;
    }

    // 2. Parse Furigana compounds and center ruby reading across the full compound span
    if (ctx.showFurigana !== false) {
      const segments = annotateFurigana(raw);
      let charCursor = 0;
      for (const seg of segments) {
        const segLen = seg.text.length;
        const startIdx = charCursor;
        const endIdx = charCursor + segLen - 1;

        if (seg.ruby && charSlots[startIdx] && charSlots[endIdx]) {
          const leftEdge = charSlots[startIdx].slotX - charSlots[startIdx].charW / 2;
          const rightEdge = charSlots[endIdx].slotX + charSlots[endIdx].charW / 2;
          const compoundCenterX = (leftEdge + rightEdge) / 2;

          const rubyObj = new PIXI.Text({
            text: seg.ruby,
            style: new PIXI.TextStyle({
              fontFamily: cyberFont,
              fontSize: Math.max(11, Math.round(this.fontSize * 0.28)),
              fontWeight: 'bold',
              fill: '#00f0ff',
              alpha: 0.95,
              letterSpacing: 1
            })
          });
          rubyObj.anchor.set(0.5, 0.5);
          rubyObj.x = compoundCenterX;
          rubyObj.y = -this.fontSize * 0.58;
          rubyObj.alpha = 0;
          this.textLayer.addChild(rubyObj);

          this.rubies.push({
            obj: rubyObj,
            centerX: compoundCenterX,
            startCharIdx: startIdx,
            endCharIdx: endIdx
          });
        }
        charCursor += segLen;
      }
    }

    this.textLayer.pivot.x = cursorX / 2;
  }

  update(ctx: UpdateContext): void {
    this.rebuildLine(ctx);

    const now = ctx.time;
    const cx = (this.config.x ?? 0.5) * ctx.screenWidth;
    const cy = (this.config.y ?? 0.48) * ctx.screenHeight;

    const bass = ctx.audioReact?.bass ?? 0;
    const isBeat = ctx.audioReact?.isBeat ?? false;

    this.textLayer.x = cx;
    this.textLayer.y = cy;

    const totalW = Math.max(260, (this.textLayer.pivot.x * 2));
    const accentColor = resolveColor(this.config.accentColor ?? '#00f0ff', this.palette);

    // 绘制 Cyber HUD 瞄准外框与扫描线
    const g = this.hudGfx;
    g.clear();

    const padH = 24;
    const padV = 20;
    const left = cx - totalW / 2 - padH;
    const right = cx + totalW / 2 + padH;
    const top = cy - this.fontSize / 2 - padV;
    const bottom = cy + this.fontSize / 2 + padV;

    // HUD Top Bar
    g.moveTo(left, top).lineTo(right, top);
    g.stroke({ color: accentColor, width: 1.5, alpha: 0.7 + bass * 0.3 });

    // HUD Bottom Cut Corners
    g.moveTo(left, bottom - 8).lineTo(left + 8, bottom).lineTo(right - 8, bottom).lineTo(right, bottom - 8);
    g.stroke({ color: accentColor, width: 1.5, alpha: 0.7 + bass * 0.3 });

    // Header info
    this.metaTextTop.x = cx;
    this.metaTextTop.y = top - 8;

    // Translation
    if (ctx.showTranslation !== false && ctx.translation) {
      this.translationText.visible = true;
      this.translationText.text = ctx.translation;
      this.translationText.x = cx;
      this.translationText.y = bottom + 10;
    } else {
      this.translationText.visible = false;
    }

    // 逐字赛博解密与电光黄色高亮
    for (let i = 0; i < this.chars.length; i++) {
      const c = this.chars[i];
      const dur = Math.max(0.12, c.duration || 0.22);
      const endTime = c.time + dur;

      if (now < c.time) {
        c.obj.alpha = 0.1;
        c.obj.style.fill = 'rgba(252, 238, 10, 0.2)';
        c.obj.text = c.scrambleGlyphs[0];
        c.obj.scale.set(0.92);
      } else if (now <= endTime) {
        const p = clamp01((now - c.time) / dur);
        const pulse = Math.sin(p * Math.PI);
        c.obj.alpha = 1;
        if (p < 0.45) {
          c.obj.text = c.scrambleGlyphs[Math.floor(now * 30) % c.scrambleGlyphs.length];
          c.obj.style.fill = '#00f0ff';
        } else {
          c.obj.text = c.char;
          c.obj.style.fill = '#fcee0a';
        }
        c.obj.scale.set(1.0 + pulse * 0.2);
        c.obj.y = -pulse * (this.fontSize * 0.16);
      } else {
        c.obj.text = c.char;
        c.obj.alpha = 1;
        c.obj.style.fill = '#fcee0a';
        c.obj.scale.set(1.0);
        c.obj.y = 0;
      }
    }

    // 复合词假名注音同步显隐与弹跳
    for (const r of this.rubies) {
      if (ctx.showFurigana === false) {
        r.obj.visible = false;
        continue;
      }
      r.obj.visible = true;
      const startChar = this.chars[r.startCharIdx];
      if (startChar) {
        r.obj.alpha = startChar.obj.alpha * 0.95;
        r.obj.scale.set(startChar.obj.scale.x * 0.95);
        r.obj.x = r.centerX;
        r.obj.y = startChar.obj.y - this.fontSize * 0.58;
      }
    }
  }

  destroy(): void {
    for (const c of this.chars) {
      try {
        c.obj.destroy();
      } catch { /* safe */ }
    }
    for (const r of this.rubies) {
      try {
        r.obj.destroy();
      } catch { /* safe */ }
    }
    this.chars = [];
    this.rubies = [];
    try {
      this.metaTextTop.destroy();
      this.translationText.destroy();
      this.hudGfx.destroy();
      this.textLayer.destroy({ children: true });
    } catch { /* safe */ }
  }
}
