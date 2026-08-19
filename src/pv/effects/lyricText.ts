// PV Tool — Copyright (c) 2026 DanteAlighieri13210914
// Licensed under Non-Commercial License. See LICENSE for terms.

import * as PIXI from 'pixi.js';
import { BaseEffect } from './base';
import type { UpdateContext } from '../core/types';
import { resolveColor } from '../core/types';
import { clamp01, easeOutQuart, easeInQuad, easeOutExpo, lerp } from '../core/easing';

interface CharUnit {
  obj: PIXI.Text;
  slotX: number;
  slotY: number;
  index: number;
}

interface ExitingLine {
  line: PIXI.Container;
  decor: PIXI.Graphics;
  t0: number;
  startX: number;
  startY: number;
  scale: number;
}

/**
 * Flagship lyric renderer — replaces the old staggered/glow/wave text effects.
 *
 * Motion language (日系MV standard):
 *  - Entrance: per-char cascade — fade in while rising ~0.45em and settling
 *    from 1.12× to 1.0× scale, easeOutQuart, ~38 ms stagger between chars.
 *  - Exit: whole line floats up slightly and fades, easeInQuad, fast.
 *  - Optional thin underline / side-bar marks that sweep in after the chars
 *    have landed (easeOutExpo).
 *  - Optional subtle beat pulse on the whole line.
 *
 * Layout: horizontal (default) or vertical (tategaki) with left/center/right
 * alignment; auto-shrinks to fit `maxWidthFrac` of the screen.
 */
export class LyricText extends BaseEffect {
  readonly name = 'lyricText';
  private line!: PIXI.Container;
  private decor!: PIXI.Graphics;
  private translationText!: PIXI.Text;
  private chars: CharUnit[] = [];
  private exitingLines: ExitingLine[] = [];
  private currentText = '';
  private enterT0 = 0;
  private naturalW = 0;
  private naturalH = 0;
  private fitScale = 1;
  /** Centre of the laid-out text along the writing axis (0 = anchor for
   *  centre align, ±half the advance for right/left align). */
  private decorCenter = 0;

  protected setup(): void {
    this.line = new PIXI.Container();
    this.decor = new PIXI.Graphics();
    this.container.addChild(this.decor);
    this.container.addChild(this.line);

    // 智能计算背景亮度以适配最清晰的翻译字形与阴影
    const bgHex = resolveColor('$background', this.palette) || '#000000';
    const isLightBg = typeof bgHex === 'string' && /#[0-9a-f]{6}/i.test(bgHex)
      ? ((parseInt(bgHex.slice(1, 3), 16) * 299 + parseInt(bgHex.slice(3, 5), 16) * 587 + parseInt(bgHex.slice(5, 7), 16) * 114) / 1000) > 130
      : false;

    const transFill = isLightBg
      ? (resolveColor('$secondary', this.palette) || resolveColor('$text', this.palette) || '#333333')
      : (resolveColor('$secondary', this.palette) || resolveColor('$text', this.palette) || '#ffffff');

    this.translationText = new PIXI.Text({
      text: '',
      style: new PIXI.TextStyle({
        fontFamily: '"PingFang SC", "Microsoft YaHei", "Noto Serif SC", serif',
        fontSize: 18,
        fontWeight: isLightBg ? '500' : 'normal',
        fill: transFill,
        dropShadow: isLightBg ? undefined : {
          color: 0x000000,
          blur: 6,
          distance: 1,
          alpha: 0.85
        }
      })
    });
    this.translationText.anchor.set(0.5, 0);
    this.container.addChild(this.translationText);

    this.enterT0 = -Infinity; // first text snaps in without waiting
  }


  // ── layout ──────────────────────────────────────────────────────────

  private buildChars(text: string, ctx: UpdateContext): void {
    const cfg = this.config;
    const fontSize = cfg.fontSize ?? 64;
    const fontFamily = cfg.fontFamily ?? '"Noto Serif JP", "Yu Mincho", "MS Mincho", serif';
    const color = resolveColor(cfg.color ?? '$text', this.palette);
    const letterSpacing = cfg.letterSpacing ?? fontSize * 0.08;
    const vertical = cfg.vertical ?? false;

    const style: Partial<PIXI.TextStyle> = {
      fontFamily,
      fontSize,
      fontWeight: cfg.fontWeight ?? '500',
      fill: color,
    };
    if (cfg.strokeColor) {
      style.stroke = { color: resolveColor(cfg.strokeColor, this.palette), width: cfg.strokeWidth ?? 4, join: 'round' };
    }
    if (cfg.glowColor) {
      style.dropShadow = {
        color: resolveColor(cfg.glowColor, this.palette),
        blur: cfg.glowBlur ?? 10,
        angle: Math.PI / 2,
        distance: 0,
        alpha: cfg.glowAlpha ?? 0.8,
      };
    }

    const chars = [...text];
    const units: CharUnit[] = [];

    // First pass: create objects and measure advances
    let cursor = 0;
    for (let i = 0; i < chars.length; i++) {
      const obj = new PIXI.Text({ text: chars[i], style: new PIXI.TextStyle(style) });
      obj.anchor.set(0.5);
      const advance = (vertical ? fontSize : obj.width) + letterSpacing;
      units.push({ obj, slotX: 0, slotY: 0, index: i });
      cursor += advance;
    }
    const totalAdvance = cursor - letterSpacing; // last char doesn't need trailing space

    // Second pass: place slots around the alignment anchor
    const align = cfg.align ?? 'center';
    const origin = align === 'center' ? -totalAdvance / 2 : align === 'right' ? -totalAdvance : 0;
    this.decorCenter = origin + totalAdvance / 2;
    let acc = 0;
    for (const u of units) {
      const advance = (vertical ? fontSize : u.obj.width) + letterSpacing;
      const center = origin + acc + (advance - letterSpacing) / 2;
      if (vertical) {
        u.slotX = 0;
        u.slotY = center;
      } else {
        u.slotX = center;
        u.slotY = 0;
      }
      acc += advance;
    }

    this.naturalW = vertical ? fontSize : Math.max(totalAdvance, 1);
    this.naturalH = vertical ? Math.max(totalAdvance, 1) : fontSize;

    const maxW = (cfg.maxWidthFrac ?? 0.86) * ctx.screenWidth;
    const maxH = (cfg.maxHeightFrac ?? 0.7) * ctx.screenHeight;
    const fitW = maxW / this.naturalW;
    const fitH = maxH / this.naturalH;
    this.fitScale = Math.min(1, fitW, vertical ? fitH : fitW);

    this.chars = units;
  }

  private setText(text: string, ctx: UpdateContext, instant: boolean): void {
    // Retire current line into the exiting list
    if (this.chars.length > 0 && !instant) {
      this.exitingLines.push({
        line: this.line,
        decor: this.decor,
        t0: ctx.time,
        startX: this.line.x,
        startY: this.line.y,
        scale: this.line.scale.x
      });
      this.line = new PIXI.Container();
      this.decor = new PIXI.Graphics();
      this.container.addChild(this.decor);
      this.container.addChild(this.line);
    } else {
      if (this.line) {
        this.line.removeChildren().forEach(c => { try { c.destroy({ children: true }); } catch { /* ignore */ } });
      }
      if (this.decor) {
        this.decor.clear();
      }
    }
    this.chars = [];
    this.currentText = text;

    if (!text) return;
    this.buildChars(text, ctx);
    this.enterT0 = instant ? -Infinity : ctx.time;
    for (const u of this.chars) {
      if (instant) {
        u.obj.alpha = 1;
        u.obj.x = u.slotX;
        u.obj.y = u.slotY;
      } else {
        u.obj.alpha = 0;
      }
      this.line.addChild(u.obj);
    }
  }

  // ── per-frame ───────────────────────────────────────────────────────

  update(ctx: UpdateContext): void {
    const cfg = this.config;
    const text = ctx.currentText ?? cfg.text ?? '';

    if (ctx.deltaTime === 0) {
      // Pause-safe: settle immediately
      if (text !== this.currentText) this.setText(text, ctx, true);
      for (const e of this.exitingLines) {
        try {
          e.line.destroy({ children: true });
          e.decor.destroy();
        } catch { /* ignore */ }
      }
      this.exitingLines = [];
      this.placeLine(ctx, 0);
      this.drawDecor(1);
      return;
    }

    if (text !== this.currentText) {
      this.setText(text, ctx, false);
    }

    const fontSize = cfg.fontSize ?? 64;
    const stagger = cfg.stagger ?? 0.038;
    const enterDur = cfg.enterDuration ?? 0.45;
    const enterRise = (cfg.enterRiseFrac ?? 0.45) * fontSize;
    const popIn = cfg.popIn ?? 0.12;
    const rotateIn = (cfg.rotateIn ?? 0) * Math.PI / 180;
    const exitDur = cfg.exitDuration ?? 0.3;
    const exitRise = (cfg.exitRiseFrac ?? 0.35) * fontSize;
    const vertical = cfg.vertical ?? false;

    // Entering chars (逐字真实时间轴渲染、弹性弹跳与从左到右平滑展开)
    const t = ctx.time;
    for (const u of this.chars) {
      const timing = ctx.charTimings?.[u.index];
      if (timing && timing.time > 0) {
        const startTime = timing.time;
        const dur = Math.max(0.12, timing.duration);
        const endTime = startTime + dur;

        if (t < startTime) {
          // 未唱到：半透明淡色预览，轻微下沉
          u.obj.alpha = 0.18;
          u.obj.scale.set(0.96);
          if (vertical) {
            u.obj.x = u.slotX + 4;
            u.obj.y = u.slotY;
          } else {
            u.obj.x = u.slotX;
            u.obj.y = u.slotY + 6;
          }
        } else if (t <= endTime) {
          // 正在唱到：从左到右波浪弹跳 (Bounce Pop) 与放大高亮
          const progress = clamp01((t - startTime) / dur);
          const pulse = Math.sin(progress * Math.PI);
          const bounceY = -pulse * (fontSize * 0.18);
          const bounceScale = 1.0 + pulse * 0.18;
          u.obj.alpha = 1.0;
          u.obj.scale.set(bounceScale);
          if (vertical) {
            u.obj.x = u.slotX - pulse * 6;
            u.obj.y = u.slotY;
          } else {
            u.obj.x = u.slotX;
            u.obj.y = u.slotY + bounceY;
          }
        } else {
          // 已唱过：完全显示，落定在基准线上
          u.obj.alpha = 1.0;
          u.obj.scale.set(1.0);
          u.obj.x = u.slotX;
          u.obj.y = u.slotY;
        }
      } else {
        // 无逐字时间数据时的平滑逐字入场
        const delay = u.index * stagger;
        const p = clamp01((t - this.enterT0 - delay) / enterDur);
        const e = easeOutQuart(p);
        u.obj.alpha = e;
        const rise = (1 - e) * enterRise;
        if (vertical) {
          u.obj.x = u.slotX + rise;
          u.obj.y = u.slotY;
        } else {
          u.obj.x = u.slotX;
          u.obj.y = u.slotY + rise;
        }
        const s = 1 + (1 - e) * popIn;
        u.obj.scale.set(s);
        u.obj.rotation = (1 - e) * rotateIn;
      }
    }

    // Exiting lines: smoothly rise and fade without jumping to top-left
    for (let i = this.exitingLines.length - 1; i >= 0; i--) {
      const ex = this.exitingLines[i];
      const p = clamp01((t - ex.t0) / exitDur);
      const e = easeInQuad(p);
      const a = 1 - e;
      ex.line.alpha = a;
      ex.decor.alpha = a;
      if (vertical) {
        ex.line.x = ex.startX - e * exitRise;
        ex.decor.x = ex.startX - e * exitRise;
      } else {
        ex.line.y = ex.startY - e * exitRise;
        ex.decor.y = ex.startY - e * exitRise;
      }
      if (p >= 1) {
        try {
          this.container.removeChild(ex.line);
          this.container.removeChild(ex.decor);
          ex.line.destroy({ children: true });
          ex.decor.destroy();
        } catch { /* ignore */ }
        this.exitingLines.splice(i, 1);
      }
    }

    this.placeLine(ctx, cfg.beatPulse ?? 0.05);

    // Decoration sweep starts once the last char has mostly landed
    const lastDelay = (this.chars.length - 1) * stagger;
    const decorP = clamp01((t - this.enterT0 - lastDelay - enterDur * 0.4) / 0.5);
    this.drawDecor(easeOutExpo(decorP));
  }

  private placeLine(ctx: UpdateContext, beatPulse: number): void {
    const px = this.config.x ?? 0.5;
    const py = this.config.y ?? 0.5;
    this.line.x = px * ctx.screenWidth;
    this.line.y = py * ctx.screenHeight;
    const beat = 1 + ctx.beatIntensity * beatPulse;
    this.line.scale.set(this.fitScale * beat);
    this.decor.x = this.line.x;
    this.decor.y = this.line.y;
    this.decor.scale.set(this.fitScale * beat);

    // 翻译副歌词（自适应避开下划线装饰）
    if (ctx.showTranslation !== false && ctx.translation) {
      this.translationText.visible = true;
      this.translationText.text = ctx.translation;
      this.translationText.x = this.line.x;

      let bottomOffset = (this.naturalH * this.fitScale) / 2;
      const fontSize = this.config.fontSize ?? 64;
      if (!this.config.vertical && this.config.underline) {
        const u = this.config.underline;
        const off = (u.offsetFrac ?? 0.75) * fontSize * this.fitScale;
        const thickness = (u.thickness ?? 2) * this.fitScale;
        bottomOffset = Math.max(bottomOffset, off + thickness);
      }

      this.translationText.y = this.line.y + bottomOffset + 14;
    } else {
      this.translationText.visible = false;
    }
  }


  private drawDecor(p: number): void {
    const g = this.decor;
    g.clear();
    if (p <= 0 || this.chars.length === 0) return;

    const cfg = this.config;
    const vertical = cfg.vertical ?? false;
    const fontSize = cfg.fontSize ?? 64;

    if (cfg.underline) {
      const u = cfg.underline;
      const color = resolveColor(u.color ?? '$accent', this.palette);
      const thickness = u.thickness ?? Math.max(2, fontSize * 0.045);
      const len = (u.lengthFrac ?? 1) * (vertical ? this.naturalH : this.naturalW);
      const off = (u.offsetFrac ?? 0.75) * fontSize;
      const alpha = (u.alpha ?? 0.9) * p;
      const drawLen = len * p;
      if (vertical) {
        g.rect(off, this.decorCenter - drawLen / 2, thickness, drawLen);
      } else {
        g.rect(this.decorCenter - drawLen / 2, off, drawLen, thickness);
      }
      g.fill({ color, alpha });
    }

    if (cfg.sideBars) {
      const s = cfg.sideBars;
      const color = resolveColor(s.color ?? '$accent', this.palette);
      const thickness = s.thickness ?? Math.max(2, fontSize * 0.05);
      const len = (s.lengthFrac ?? 0.9) * fontSize;
      const half = (vertical ? this.naturalH : this.naturalW) / 2 + (s.gap ?? fontSize * 0.35);
      const alpha = (s.alpha ?? 0.9) * p;
      const slide = (1 - p) * fontSize * 0.3;
      if (vertical) {
        g.rect(-thickness / 2, this.decorCenter - half - slide - len / 2, thickness, len);
        g.rect(-thickness / 2, this.decorCenter + half + slide - len / 2, thickness, len);
      } else {
        g.rect(this.decorCenter - half - slide - len / 2, -thickness / 2, len, thickness);
        g.rect(this.decorCenter + half + slide - len / 2, -thickness / 2, len, thickness);
      }
      g.fill({ color, alpha });
    }
  }

  destroy(): void {
    for (const e of this.exitingLines) {
      try {
        e.line.destroy({ children: true });
        e.decor.destroy();
      } catch { /* ignore */ }
    }
    this.exitingLines = [];
    this.chars = [];
    try {
      this.translationText.destroy();
    } catch { /* ignore */ }
    super.destroy();
  }

}

// Re-export for convenience in templates
export { lerp };
