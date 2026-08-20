// PV Tool — Copyright (c) 2026 DanteAlighieri13210914
// Licensed under Non-Commercial License. See LICENSE for terms.

import * as PIXI from 'pixi.js';
import { BaseEffect } from './base';
import type { UpdateContext } from '../core/types';
import { resolveColor } from '../core/types';
import { clamp01 } from '../core/easing';
import { annotateFurigana } from '../../utils/lyrics/furiganaHelper';

interface EvaChar {
  obj: PIXI.Text;
  char: string;
  time: number;
  duration: number;
  slotX: number;
}

interface EvaRuby {
  obj: PIXI.Text;
  centerX: number;
  startCharIdx: number;
  endCharIdx: number;
}

/**
 * EVA 警报专属：极具压迫感的粗黑明朝/重黑标题字体与冲击波震颤
 * 1. 经典 EVA 红色警戒括号与战术状态码
 * 2. 逐字到达时，伴随强烈数码红色电光闪烁与重音下沉
 * 3. 伴随低音 Bass 产生强烈的战术震颤与反冲力
 */
export class EvaImpactText extends BaseEffect {
  readonly name = 'evaImpactText';
  private textLayer!: PIXI.Container;
  private bracketGfx!: PIXI.Graphics;
  private headerText!: PIXI.Text;
  private translationText!: PIXI.Text;
  private chars: EvaChar[] = [];
  private rubies: EvaRuby[] = [];
  private currentRaw = '';
  private fontSize = 56;

  protected setup(): void {
    this.bracketGfx = new PIXI.Graphics();
    this.textLayer = new PIXI.Container();

    this.container.addChild(this.bracketGfx);
    this.container.addChild(this.textLayer);

    this.headerText = new PIXI.Text({
      text: '[ EMERGENCY AUDIO STREAM // THREAT LEVEL: S ]',
      style: new PIXI.TextStyle({
        fontFamily: '"Impact", "Arial Black", sans-serif',
        fontSize: 14,
        fontWeight: 'bold',
        fill: resolveColor('$secondary', this.palette) || '#ff1836',
        letterSpacing: 3
      })
    });
    this.headerText.anchor.set(0.5, 1);
    this.container.addChild(this.headerText);

    this.translationText = new PIXI.Text({
      text: '',
      style: new PIXI.TextStyle({
        fontFamily: '"Noto Sans SC", "Microsoft YaHei", sans-serif',
        fontSize: 18,
        fontWeight: '600',
        fill: '#ffffff',
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

    // Clean up previous characters and rubies
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

    this.fontSize = this.config.fontSize ?? 56;
    const fontColor = resolveColor(this.config.color ?? '#ffffff', this.palette);

    const isCJK = (ch: string) => /[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af\u3400-\u4dbf]/.test(ch);
    const chars = [...raw];
    const charTimings = ctx.charTimings || [];
    const lineStart = ctx.currentLine?.time ?? ctx.time;
    const lineDur = ctx.currentLine?.duration ?? 4.0;

    let cursorX = 0;
    const charSlots: { slotX: number; charW: number }[] = [];

    // 1. Measure and position characters
    for (let i = 0; i < chars.length; i++) {
      const char = chars[i];
      const cjk = isCJK(char);
      const isSpace = /\s/.test(char);
      const charW = isSpace ? this.fontSize * 0.35 : (cjk ? this.fontSize * 1.02 : this.fontSize * 0.62);

      const timing = charTimings[i];
      const time = timing ? timing.time : lineStart + (i / Math.max(1, chars.length)) * lineDur;
      const duration = timing ? timing.duration : 0.22;

      const obj = new PIXI.Text({
        text: char,
        style: new PIXI.TextStyle({
          fontFamily: '"Impact", "Arial Black", "Noto Sans JP", "SimHei", sans-serif',
          fontSize: this.fontSize,
          fontWeight: '900',
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

      this.chars.push({
        obj,
        char,
        time,
        duration,
        slotX
      });

      charSlots.push({ slotX, charW });
      cursorX += charW;
    }

    // 2. Parse Furigana compounds and center ruby reading
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
              fontFamily: '"Noto Sans JP", "Hiragino Kaku Gothic Pro", "PingFang SC", sans-serif',
              fontSize: Math.max(11, Math.round(this.fontSize * 0.28)),
              fontWeight: 'bold',
              fill: '#ff1836',
              alpha: 0.95
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
    const cy = (this.config.y ?? 0.5) * ctx.screenHeight;

    const bass = ctx.audioReact?.bass ?? 0;
    const isBeat = ctx.audioReact?.isBeat ?? false;

    // 低音 Bass 冲击波震颤
    const shake = isBeat ? (Math.random() - 0.5) * 8 : (bass > 0.4 ? (Math.random() - 0.5) * 3 : 0);
    this.textLayer.x = cx + shake;
    this.textLayer.y = cy + shake;

    const totalW = Math.max(280, (this.textLayer.pivot.x * 2));
    const red = resolveColor(this.config.accentColor ?? '#ff1836', this.palette);

    // 绘制战术红色角标
    const g = this.bracketGfx;
    g.clear();

    const padH = 28;
    const padV = 22;
    const left = cx - totalW / 2 - padH;
    const right = cx + totalW / 2 + padH;
    const top = cy - this.fontSize / 2 - padV;
    const bottom = cy + this.fontSize / 2 + padV;
    const arm = 18;

    // 4 边角战术标
    g.moveTo(left, top + arm).lineTo(left, top).lineTo(left + arm, top);
    g.moveTo(right - arm, top).lineTo(right, top).lineTo(right, top + arm);
    g.moveTo(left, bottom - arm).lineTo(left, bottom).lineTo(left + arm, bottom);
    g.moveTo(right - arm, bottom).lineTo(right, bottom).lineTo(right, bottom - arm);
    g.stroke({ color: red, width: 2.5, alpha: 0.8 + (isBeat ? 0.2 : 0) });

    // 顶部战术状态栏
    this.headerText.x = cx;
    this.headerText.y = top - 8;

    // 翻译字幕
    if (ctx.showTranslation !== false && ctx.translation) {
      this.translationText.visible = true;
      this.translationText.text = ctx.translation;
      this.translationText.x = cx;
      this.translationText.y = bottom + 12;
    } else {
      this.translationText.visible = false;
    }

    // 逐字冲击波弹跳
    for (let i = 0; i < this.chars.length; i++) {
      const c = this.chars[i];
      const dur = Math.max(0.12, c.duration || 0.22);
      const endTime = c.time + dur;

      if (now < c.time) {
        c.obj.alpha = 0.15;
        c.obj.style.fill = 'rgba(255, 255, 255, 0.25)';
        c.obj.scale.set(0.94);
        c.obj.y = 0;
      } else if (now <= endTime) {
        const p = clamp01((now - c.time) / dur);
        const pulse = Math.sin(p * Math.PI);
        c.obj.alpha = 1;
        c.obj.style.fill = (p < 0.35) ? '#ff1836' : '#ffffff';
        c.obj.scale.set(1.0 + pulse * 0.28);
        c.obj.y = -pulse * (this.fontSize * 0.2);
      } else {
        c.obj.alpha = 1;
        c.obj.style.fill = '#ffffff';
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
      this.headerText.destroy();
      this.translationText.destroy();
      this.bracketGfx.destroy();
      this.textLayer.destroy({ children: true });
    } catch { /* safe */ }
  }
}
