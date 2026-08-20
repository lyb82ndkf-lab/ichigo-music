import * as PIXI from 'pixi.js';
import { BaseEffect } from './base';
import type { UpdateContext } from '../core/types';
import { resolveColor } from '../core/types';
import { annotateFurigana } from '../../utils/lyrics/furiganaHelper';

interface PixelCharUnit {
  obj: PIXI.Text;
  char: string;
  time: number;
  duration: number;
  slotX: number;
  slotY: number;
  lineIdx: number;
}

interface PixelRubyUnit {
  obj: PIXI.Text;
  centerX: number;
  baseY: number;
  startGlobalIdx: number;
  endGlobalIdx: number;
}

/**
 * Kawaii 像素专属：8-bit 点阵打字机与方块跳跃
 * 1. 采用像素点阵字体与硬边 8-bit 投影（0 模糊），纯正复古街机风
 * 2. 逐字以像素阶梯弹跳输出（到达时向上跳跃 8px 后落地）
 * 3. 超长歌词两行自适应排版
 * 4. 底部支持像素风格翻译字幕与平假名注音
 */
export class PixelTypewriterText extends BaseEffect {
  readonly name = 'pixelTypewriterText';
  private textContainer!: PIXI.Container;
  private boxGfx!: PIXI.Graphics;
  private badgeText!: PIXI.Text;
  private translationText!: PIXI.Text;
  private chars: PixelCharUnit[] = [];
  private rubies: PixelRubyUnit[] = [];
  private currentRaw = '';
  private fontSize = 42;

  protected setup(): void {
    this.boxGfx = new PIXI.Graphics();
    this.textContainer = new PIXI.Container();
    this.container.addChild(this.boxGfx);
    this.container.addChild(this.textContainer);

    this.badgeText = new PIXI.Text({
      text: '★ 8-BIT STAGE ★',
      style: new PIXI.TextStyle({
        fontFamily: '"DotGothic16", "Press Start 2P", "Silkscreen", monospace',
        fontSize: 13,
        fill: resolveColor('$accent', this.palette),
        fontWeight: 'bold',
        dropShadow: {
          color: 0x000000,
          blur: 0,
          distance: 2,
          angle: Math.PI / 4,
          alpha: 0.8
        }
      })
    });
    this.container.addChild(this.badgeText);

    this.translationText = new PIXI.Text({
      text: '',
      style: new PIXI.TextStyle({
        fontFamily: '"DotGothic16", "PingFang SC", "Microsoft YaHei", monospace',
        fontSize: 18,
        fontWeight: 'bold',
        fill: '#ffffff',
        dropShadow: {
          color: '#5a3a5a',
          blur: 0,
          distance: 2,
          angle: Math.PI / 4,
          alpha: 1
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
        this.textContainer.removeChild(r.obj);
        r.obj.destroy();
      } catch { /* safe */ }
    }
    this.rubies = [];

    for (const c of this.chars) {
      try {
        this.textContainer.removeChild(c.obj);
        c.obj.destroy();
      } catch { /* safe */ }
    }
    this.chars = [];

    if (!raw.trim()) return;

    this.fontSize = this.config.fontSize ?? 42;
    const fontColor = resolveColor(this.config.color ?? '$text', this.palette);
    const shadowColor = resolveColor(this.config.shadowColor ?? '#000000', this.palette);

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
        const time = timing ? timing.time : lineStart + (globalIdx / Math.max(1, chars.length)) * lineDur;
        const duration = timing ? timing.duration : 0.2;

        const obj = new PIXI.Text({
          text: char,
          style: new PIXI.TextStyle({
            fontFamily: '"DotGothic16", "Press Start 2P", "Silkscreen", "VT323", "Zpix", monospace',
            fontSize: this.fontSize,
            fontWeight: 'bold',
            fill: fontColor,
            dropShadow: {
              color: shadowColor,
              blur: 0,
              distance: 4,
              angle: Math.PI / 4,
              alpha: 0.95
            }
          })
        });
        obj.anchor.set(0.5, 0.5);

        const slotX = cursorX + charW / 2;
        obj.x = slotX;
        obj.y = yOffset;
        obj.alpha = 0;
        this.textContainer.addChild(obj);

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
                fontFamily: '"DotGothic16", "Press Start 2P", monospace',
                fontSize: Math.max(10, Math.round(this.fontSize * 0.28)),
                fontWeight: 'bold',
                fill: resolveColor('$accent', this.palette) || '#ffea00',
                dropShadow: { color: 0x000000, blur: 0, distance: 2, angle: Math.PI / 4, alpha: 0.9 }
              })
            });
            rubyObj.anchor.set(0.5, 0.5);
            rubyObj.x = compoundCenterX;
            rubyObj.y = rubyY;
            rubyObj.alpha = 0;
            this.textContainer.addChild(rubyObj);

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

    this.textContainer.pivot.x = maxLineWidth / 2;
  }

  update(ctx: UpdateContext): void {
    this.rebuildLine(ctx);

    const now = ctx.time;
    const cx = (this.config.x ?? 0.5) * ctx.screenWidth;
    const cy = (this.config.y ?? 0.5) * ctx.screenHeight;

    this.textContainer.x = cx;
    this.textContainer.y = cy;

    const totalW = (this.textContainer.pivot.x * 2) || 200;
    const isMultiLine = this.chars.some(c => c.lineIdx > 0);
    const boxH = isMultiLine ? this.fontSize * 2.5 : this.fontSize + 28;

    // 绘制复古像素气泡背景框
    this.boxGfx.clear();
    const padX = 24;
    const bx = Math.round(cx - totalW / 2 - padX);
    const by = Math.round(cy - boxH / 2);
    const bw = Math.round(totalW + padX * 2);

    // 像素粗边框底色
    this.boxGfx.rect(bx + 4, by + 4, bw, boxH);
    this.boxGfx.fill({ color: 0x000000, alpha: 0.5 });

    this.boxGfx.rect(bx, by, bw, boxH);
    this.boxGfx.fill({ color: resolveColor(this.config.boxBg ?? '$primary', this.palette), alpha: 0.85 });

    this.boxGfx.stroke({
      color: resolveColor('$accent', this.palette),
      width: 3,
      alignment: 0
    });

    // 像素顶部 Badge
    this.badgeText.x = bx + 12;
    this.badgeText.y = by - 16;

    // 翻译副歌词 (8-Bit 像素字幕框)
    if (ctx.showTranslation !== false && ctx.translation) {
      this.translationText.visible = true;
      this.translationText.text = `▶ ${ctx.translation}`;
      this.translationText.x = cx;
      this.translationText.y = cy + boxH / 2 + 14;

      const transW = Math.max(160, this.translationText.width + 24);
      const transH = 26;
      const tbx = Math.round(cx - transW / 2);
      const tby = Math.round(this.translationText.y - 2);

      // 像素阴影
      this.boxGfx.rect(tbx + 3, tby + 3, transW, transH);
      this.boxGfx.fill({ color: 0x000000, alpha: 0.35 });

      // 像素卡片底色
      this.boxGfx.rect(tbx, tby, transW, transH);
      this.boxGfx.fill({ color: 0xffffff, alpha: 0.95 });
      this.boxGfx.stroke({ color: 0xffb3d9, width: 2 });
    } else {
      this.translationText.visible = false;
    }

    // 逐字 8-bit 跳跃打印
    for (const c of this.chars) {
      if (now < c.time) {
        c.obj.alpha = 0;
      } else {
        c.obj.alpha = 1;
        const elapsed = now - c.time;
        if (elapsed < 0.12) {
          const jumpP = Math.sin((elapsed / 0.12) * Math.PI);
          c.obj.y = Math.round(c.slotY - jumpP * 8);
        } else {
          c.obj.y = c.slotY;
        }
      }
    }

    // 假名注音同步跳跃
    for (const r of this.rubies) {
      const parentChar = this.chars[r.startGlobalIdx];
      if (parentChar) {
        if (now < parentChar.time) {
          r.obj.alpha = 0;
        } else {
          r.obj.alpha = 1;
          const elapsed = now - parentChar.time;
          if (elapsed < 0.12) {
            const jumpP = Math.sin((elapsed / 0.12) * Math.PI);
            r.obj.y = Math.round(r.baseY - jumpP * 6);
          } else {
            r.obj.y = r.baseY;
          }
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
      this.badgeText.destroy();
      this.translationText.destroy();
      this.boxGfx.destroy();
      this.textContainer.destroy({ children: true });
    } catch { /* safe */ }
    super.destroy();
  }
}
