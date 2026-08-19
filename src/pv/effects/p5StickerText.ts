import * as PIXI from 'pixi.js';
import { BaseEffect } from './base';
import type { UpdateContext } from '../core/types';
import { clamp01, easeOutBack } from '../core/easing';

interface P5Char {
  container: PIXI.Container;
  bgGfx: PIXI.Graphics;
  textObj: PIXI.Text;
  char: string;
  time: number;
  duration: number;
  slotX: number;
  angle: number;
  bgStyle: number;
  burst: boolean;
}

/**
 * P5怪盗专属：Persona 5 标志性不规则剪切贴纸与冲击盖章
 * 1. 每一个字符拥有独立的多边形剪贴底块（黑/黄/白高反差撞色）
 * 2. 激进的 -12°~+12° 错落倾斜与字距交错
 * 3. 逐字以超大尺寸向屏幕重力拍击（Stamp Slam Down）并带有弹性回弹
 * 4. 底部呈现 Persona 5 风格的斜切怪盗贴纸标语与翻译
 */
export class P5StickerText extends BaseEffect {
  readonly name = 'p5StickerText';
  private textLayer!: PIXI.Container;
  private bannerGfx!: PIXI.Graphics;
  private bannerText!: PIXI.Text;
  private translationText!: PIXI.Text;
  private chars: P5Char[] = [];
  private currentRaw = '';
  private fontSize = 52;

  protected setup(): void {
    this.bannerGfx = new PIXI.Graphics();
    this.textLayer = new PIXI.Container();

    this.container.addChild(this.bannerGfx);
    this.container.addChild(this.textLayer);

    this.bannerText = new PIXI.Text({
      text: 'TAKE YOUR HEART ★ PHANTOM THIEVES',
      style: new PIXI.TextStyle({
        fontFamily: '"Impact", "Arial Black", sans-serif',
        fontSize: 12,
        fontWeight: '900',
        fill: '#111111',
        letterSpacing: 3
      })
    });
    this.container.addChild(this.bannerText);

    this.translationText = new PIXI.Text({
      text: '',
      style: new PIXI.TextStyle({
        fontFamily: '"PingFang SC", "Microsoft YaHei", "Impact", sans-serif',
        fontSize: 18,
        fontWeight: 'bold',
        fill: '#ffffff',
        stroke: { color: '#111111', width: 4, join: 'round' }
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
        this.textLayer.removeChild(c.container);
        c.container.destroy({ children: true });
      } catch { /* safe */ }
    }
    this.chars = [];

    if (!raw.trim()) return;

    this.fontSize = this.config.fontSize ?? 54;
    const isCJK = (ch: string) => /[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af\u3400-\u4dbf]/.test(ch);

    const chars = [...raw];
    const charTimings = ctx.charTimings || [];
    const lineStart = ctx.currentLine?.time ?? ctx.time;
    const lineDur = ctx.currentLine?.duration ?? 4.0;

    let cursorX = 0;

    for (let i = 0; i < chars.length; i++) {
      const char = chars[i];
      const cjk = isCJK(char);
      const isSpace = /\s/.test(char);
      const charW = isSpace ? this.fontSize * 0.4 : (cjk ? this.fontSize * 1.12 : this.fontSize * 0.76);

      const timing = charTimings[i];
      const time = timing ? timing.time : lineStart + (i / Math.max(1, chars.length)) * lineDur;
      const duration = timing ? timing.duration : 0.22;

      // 确定配色模式：0: 黑色贴纸白字, 1: 黄色贴纸黑字, 2: 白色贴纸红字
      const bgStyle = (i % 3 === 0) ? 1 : ((i % 5 === 0) ? 2 : 0);
      const textColor = bgStyle === 0 ? '#ffffff' : (bgStyle === 1 ? '#111111' : '#d6001c');
      const bgColor = bgStyle === 0 ? 0x111111 : (bgStyle === 1 ? 0xffea00 : 0xffffff);

      const charContainer = new PIXI.Container();
      const bgGfx = new PIXI.Graphics();

      const textObj = new PIXI.Text({
        text: char,
        style: new PIXI.TextStyle({
          fontFamily: '"Impact", "Arial Black", "PingFang SC", "Microsoft YaHei", sans-serif',
          fontSize: this.fontSize,
          fontWeight: '900',
          fill: textColor,
        })
      });
      textObj.anchor.set(0.5, 0.5);

      charContainer.addChild(bgGfx);
      charContainer.addChild(textObj);

      // 绘制 P5 不规则剪切贴纸块
      const padX = charW * 0.58;
      const padY = this.fontSize * 0.62;
      const jx1 = ((i * 7) % 5) - 2;
      const jy1 = ((i * 11) % 5) - 2;
      const jx2 = ((i * 13) % 5) - 2;
      const jy2 = ((i * 17) % 5) - 2;

      bgGfx.clear();
      bgGfx.poly([
        -padX + jx1, -padY + jy1,
        padX + jx2, -padY - jy1,
        padX - jx1, padY + jy2,
        -padX - jx2, padY - jy2
      ]);
      bgGfx.fill({ color: bgColor, alpha: 1 });
      bgGfx.stroke({ color: 0x111111, width: 3 });

      const angle = ((i % 2 === 0 ? -1 : 1) * (0.05 + ((i % 4) * 0.025)));
      charContainer.rotation = angle;

      const slotX = cursorX + charW / 2;
      charContainer.x = slotX;
      charContainer.y = 0;
      charContainer.scale.set(0);
      this.textLayer.addChild(charContainer);

      this.chars.push({
        container: charContainer,
        bgGfx,
        textObj,
        char,
        time,
        duration,
        slotX,
        angle,
        bgStyle,
        burst: false
      });

      cursorX += charW + 4;
    }

    this.textLayer.pivot.x = cursorX / 2;
  }

  update(ctx: UpdateContext): void {
    this.rebuildLine(ctx);

    const now = ctx.time;
    const cx = (this.config.x ?? 0.5) * ctx.screenWidth;
    const cy = (this.config.y ?? 0.5) * ctx.screenHeight;

    this.textLayer.x = cx;
    this.textLayer.y = cy;

    const totalW = Math.max(300, (this.textLayer.pivot.x * 2));

    // 绘制 Persona 5 斜切警示贴纸条 (Take Your Heart Banner)
    this.bannerGfx.clear();
    const bannerY = cy - this.fontSize * 1.35;
    const bW = totalW + 80;
    const bH = 26;

    this.bannerGfx.poly([
      cx - bW / 2 - 12, bannerY - bH / 2,
      cx + bW / 2 + 12, bannerY - bH / 2 - 4,
      cx + bW / 2 + 6, bannerY + bH / 2 + 4,
      cx - bW / 2 - 18, bannerY + bH / 2
    ]);
    this.bannerGfx.fill({ color: 0xffea00, alpha: 0.95 });
    this.bannerGfx.stroke({ color: 0x111111, width: 2.5 });

    this.bannerText.x = cx - this.bannerText.width / 2;
    this.bannerText.y = bannerY - 6;
    this.bannerText.rotation = -0.02;

    // 翻译副歌词 (P5 风格斜切贴纸标语)
    if (ctx.showTranslation !== false && ctx.translation) {
      this.translationText.visible = true;
      this.translationText.text = ctx.translation;
      this.translationText.x = cx;
      this.translationText.y = cy + this.fontSize * 1.05;

      const transW = Math.max(160, this.translationText.width + 24);
      const transH = 28;
      const transY = this.translationText.y + 12;

      this.bannerGfx.poly([
        cx - transW / 2 - 8, transY - transH / 2,
        cx + transW / 2 + 8, transY - transH / 2 - 2,
        cx + transW / 2 + 4, transY + transH / 2 + 2,
        cx - transW / 2 - 12, transY + transH / 2
      ]);
      this.bannerGfx.fill({ color: 0x111111, alpha: 0.95 });
      this.bannerGfx.stroke({ color: 0xffea00, width: 2 });
    } else {
      this.translationText.visible = false;
    }

    // 逐字强力拍击盖章动画 (Stamp Slam Animation)
    for (const c of this.chars) {
      if (now < c.time) {
        c.container.scale.set(0);
        c.container.alpha = 0;
      } else {
        const p = clamp01((now - c.time) / (c.duration || 0.22));
        const ease = easeOutBack(p);

        // 从 2.5 倍超大尺寸向下猛砸并回弹
        const s = 1.0 + (1 - p) * 1.4 * Math.cos(p * Math.PI * 0.5);
        c.container.scale.set(Math.max(0, s));
        c.container.alpha = Math.min(1, p * 4);
        c.container.y = (1 - ease) * -40;
      }
    }
  }

  destroy(): void {
    for (const c of this.chars) {
      try {
        c.container.destroy({ children: true });
      } catch { /* safe */ }
    }
    this.chars = [];
    try {
      this.bannerGfx.destroy();
      this.bannerText.destroy();
      this.translationText.destroy();
      this.textLayer.destroy({ children: true });
    } catch { /* safe */ }
    super.destroy();
  }
}
