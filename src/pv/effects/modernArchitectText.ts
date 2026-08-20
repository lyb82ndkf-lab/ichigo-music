import * as PIXI from 'pixi.js';
import { BaseEffect } from './base';
import type { UpdateContext } from '../core/types';
import { resolveColor } from '../core/types';
import { clamp01 } from '../core/easing';
import { annotateFurigana } from '../../utils/lyrics/furiganaHelper';

interface ArchitectChar {
  obj: PIXI.Text;
  char: string;
  time: number;
  duration: number;
  slotX: number;
  slotY: number;
  lineIdx: number;
}

interface ArchitectRuby {
  obj: PIXI.Text;
  centerX: number;
  baseY: number;
  startGlobalIdx: number;
  endGlobalIdx: number;
}

/**
 * 蓝色构成专属：横向现代建筑网格与几何线框排版
 * 1. 彻底废弃竖排，采用横向现代建筑排版架构
 * 2. 蓝白极简高对比，配建筑坐标轴、网格辅助线、标尺角标与图纸编号
 * 3. 超长歌词两行自适应排版
 * 4. 底部支持高精几何翻译字幕与平假名注音
 */
export class ModernArchitectText extends BaseEffect {
  readonly name = 'modernArchitectText';
  private textLayer!: PIXI.Container;
  private gridGfx!: PIXI.Graphics;
  private metaTextTop!: PIXI.Text;
  private metaTextBottom!: PIXI.Text;
  private translationText!: PIXI.Text;
  private chars: ArchitectChar[] = [];
  private rubies: ArchitectRuby[] = [];
  private currentRaw = '';
  private fontSize = 48;

  protected setup(): void {
    this.gridGfx = new PIXI.Graphics();
    this.textLayer = new PIXI.Container();
    this.container.addChild(this.gridGfx);
    this.container.addChild(this.textLayer);

    const blueAccent = resolveColor(this.config.accentColor ?? '#416be2', this.palette);

    this.metaTextTop = new PIXI.Text({
      text: 'ARCHITECTURAL STRUCTURE // AXIS-01 [BLUE-IN-WHITE]',
      style: new PIXI.TextStyle({
        fontFamily: '"Outfit", "Inter", "Helvetica Neue", sans-serif',
        fontSize: 11,
        fill: blueAccent,
        fontWeight: '700',
        letterSpacing: 3
      })
    });

    this.metaTextBottom = new PIXI.Text({
      text: 'SCALE: 1:100  •  GRID ELEVATION SEC-A',
      style: new PIXI.TextStyle({
        fontFamily: '"Outfit", "Inter", "Helvetica Neue", sans-serif',
        fontSize: 10,
        fill: 'rgba(255,255,255,0.6)',
        letterSpacing: 2
      })
    });

    this.translationText = new PIXI.Text({
      text: '',
      style: new PIXI.TextStyle({
        fontFamily: '"PingFang SC", "Microsoft YaHei", "Inter", sans-serif',
        fontSize: 17,
        fill: 'rgba(255, 255, 255, 0.75)',
        letterSpacing: 1.5
      })
    });
    this.translationText.anchor.set(0.5, 0);

    this.container.addChild(this.metaTextTop);
    this.container.addChild(this.metaTextBottom);
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

    const lineHeight = this.fontSize * 1.3;
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
        const time = timing
          ? timing.time
          : lineStart + (globalIdx / Math.max(1, chars.length)) * lineDur;
        const duration = timing ? timing.duration : 0.35;

        const obj = new PIXI.Text({
          text: char,
          style: new PIXI.TextStyle({
            fontFamily: '"Outfit", "Inter", "PingFang SC", "Microsoft YaHei", sans-serif',
            fontSize: this.fontSize,
            fontWeight: '800',
            fill: fontColor,
            letterSpacing: 2
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

    // Furigana 注音
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

            const rubyObj = new PIXI.Text({
              text: seg.ruby,
              style: new PIXI.TextStyle({
                fontFamily: '"Outfit", "Inter", sans-serif',
                fontSize: Math.max(10, Math.round(this.fontSize * 0.28)),
                fontWeight: '700',
                fill: '#416be2',
                alpha: 0.95
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

    const totalW = Math.max(260, (this.textLayer.pivot.x * 2));
    const pad = 36;
    const leftX = cx - totalW / 2 - pad;
    const rightX = cx + totalW / 2 + pad;
    const isMultiLine = this.chars.some(c => c.lineIdx > 0);
    const topY = cy - (isMultiLine ? this.fontSize * 1.4 : this.fontSize * 0.85);
    const bottomY = cy + (isMultiLine ? this.fontSize * 1.4 : this.fontSize * 0.85);

    // 绘制现代建筑几何线条与坐标轴
    this.gridGfx.clear();

    // 顶部基准线
    this.gridGfx.moveTo(leftX - 40, topY);
    this.gridGfx.lineTo(rightX + 40, topY);
    this.gridGfx.stroke({ color: 0x416be2, width: 1.5, alpha: 0.8 });

    // 底部基准线
    this.gridGfx.moveTo(leftX - 20, bottomY);
    this.gridGfx.lineTo(rightX + 20, bottomY);
    this.gridGfx.stroke({ color: 0xffffff, width: 1, alpha: 0.4 });

    // 左右建筑刻度标记
    this.gridGfx.rect(leftX - 6, topY - 6, 12, 12);
    this.gridGfx.rect(rightX - 6, topY - 6, 12, 12);
    this.gridGfx.fill({ color: 0x416be2, alpha: 0.9 });

    // 垂直辅助线
    this.gridGfx.moveTo(cx, topY - 24);
    this.gridGfx.lineTo(cx, topY + 8);
    this.gridGfx.stroke({ color: 0x416be2, width: 1, alpha: 0.5 });

    // 顶部与底部元数据
    this.metaTextTop.x = leftX;
    this.metaTextTop.y = topY - 20;

    this.metaTextBottom.x = leftX;
    this.metaTextBottom.y = bottomY + 8;

    // 翻译副歌词
    if (ctx.showTranslation !== false && ctx.translation) {
      this.translationText.visible = true;
      this.translationText.text = ctx.translation;
      this.translationText.x = cx;
      this.translationText.y = bottomY + 28;
    } else {
      this.translationText.visible = false;
    }

    // 逐字建筑几何推进
    for (const c of this.chars) {
      const dur = Math.max(0.12, c.duration || 0.25);
      const endTime = c.time + dur;

      if (now < c.time) {
        c.obj.alpha = 0.15;
        c.obj.style.fill = 'rgba(255,255,255,0.2)';
        c.obj.scale.set(0.95);
        c.obj.y = c.slotY + 6;
      } else if (now <= endTime) {
        const p = clamp01((now - c.time) / dur);
        const pulse = Math.sin(p * Math.PI);
        c.obj.alpha = 1;
        c.obj.style.fill = '#ffffff';
        c.obj.scale.set(1.0 + pulse * 0.15);
        c.obj.y = c.slotY - pulse * (this.fontSize * 0.16);
      } else {
        c.obj.alpha = 1;
        c.obj.style.fill = '#ffffff';
        c.obj.scale.set(1.0);
        c.obj.y = c.slotY;
      }
    }

    // 假名注音同步显现
    for (const r of this.rubies) {
      const parentChar = this.chars[r.startGlobalIdx];
      if (parentChar) {
        if (now < parentChar.time) {
          r.obj.alpha = 0.15;
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
      try { c.obj.destroy(); } catch { /* safe */ }
    }
    this.chars = [];
    try {
      this.metaTextTop.destroy();
      this.metaTextBottom.destroy();
      this.translationText.destroy();
      this.gridGfx.destroy();
      this.textLayer.destroy({ children: true });
    } catch { /* safe */ }
    super.destroy();
  }
}
