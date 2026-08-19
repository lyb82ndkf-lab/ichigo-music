import * as PIXI from 'pixi.js';
import { BaseEffect } from './base';
import type { UpdateContext } from '../core/types';
import { resolveColor } from '../core/types';

// 混合矩阵暗码库：包含十六进制、片假名与终端乱码
const CIPHER_HEX = '0123456789ABCDEFｦｱｳｴｵｶｷｹｺｻｼｽｾｿﾀﾂﾃﾅﾆﾇﾈﾊﾋﾎﾏﾐﾑﾒﾓﾔﾕﾗﾘﾜ';
const CIPHER_CJK = 'アイウエオカキクケコサシスセソタチツテト天地玄黄宇宙洪荒日月盈昃辰宿列张0123456789';

interface MatrixChar {
  obj: PIXI.Text;
  realChar: string;
  decoded: boolean;
  decodeTime: number;
  slotX: number;
  slotY: number;
  isCJK: boolean;
  cipherIndex: number;
  lineIdx: number;
}

/**
 * 黑客帝国专属：字符终端矩阵解码器
 * 1. 终端提示符 `> ` 引导打字
 * 2. 中日英文全量真实逐字解密（未唱前跳动对应语言矩阵暗码，到达时间瞬间高频白光解密锁定）
 * 3. 超长歌词智能两行折行，杜绝溢出
 * 4. 底部支持高科技绿光翻译字幕
 * 5. CRT 绿色荧光与闪烁终端光标 █
 */
export class MatrixDecodeText extends BaseEffect {
  readonly name = 'matrixDecodeText';
  private textLayer!: PIXI.Container;
  private cursorObj!: PIXI.Text;
  private headerText!: PIXI.Text;
  private translationText!: PIXI.Text;
  private hudLine!: PIXI.Graphics;
  private matrixChars: MatrixChar[] = [];
  private promptObjs: PIXI.Text[] = [];
  private currentRawText = '';
  private lastScrambleTime = 0;
  private fontSize = 44;

  protected setup(): void {
    this.textLayer = new PIXI.Container();
    this.hudLine = new PIXI.Graphics();
    this.container.addChild(this.hudLine);
    this.container.addChild(this.textLayer);

    const greenColor = resolveColor(this.config.color ?? '#20ff66', this.palette);

    // 终端方块光标
    this.cursorObj = new PIXI.Text({
      text: '█',
      style: new PIXI.TextStyle({
        fontFamily: '"Consolas", "Courier New", "PingFang SC", "Microsoft YaHei", monospace',
        fontSize: this.fontSize,
        fill: greenColor,
        dropShadow: {
          color: greenColor,
          blur: 8,
          distance: 0,
          alpha: 0.9,
          angle: 0
        }
      })
    });
    this.cursorObj.anchor.set(0, 0.5);
    this.textLayer.addChild(this.cursorObj);

    // 终端头部系统信息
    this.headerText = new PIXI.Text({
      text: '> ROOT@MATRIX_CORE:~$ DECRYPT_STREAM --LIVE',
      style: new PIXI.TextStyle({
        fontFamily: '"Consolas", "Courier New", monospace',
        fontSize: 12,
        fontWeight: 'bold',
        fill: '#00bb44',
        letterSpacing: 2
      })
    });
    this.container.addChild(this.headerText);

    // 翻译副歌词行
    this.translationText = new PIXI.Text({
      text: '',
      style: new PIXI.TextStyle({
        fontFamily: '"PingFang SC", "Microsoft YaHei", "Consolas", sans-serif',
        fontSize: 18,
        fill: 'rgba(32, 255, 102, 0.75)',
        letterSpacing: 1.5,
        dropShadow: {
          color: '#002200',
          blur: 6,
          distance: 1,
          alpha: 0.8
        }
      })
    });
    this.translationText.anchor.set(0.5, 0);
    this.container.addChild(this.translationText);
  }

  private rebuildLine(ctx: UpdateContext) {
    const raw = ctx.currentText || '';
    if (raw === this.currentRawText && this.matrixChars.length > 0) return;
    this.currentRawText = raw;

    // 清理旧字符与提示符
    for (const c of this.matrixChars) {
      try {
        this.textLayer.removeChild(c.obj);
        c.obj.destroy();
      } catch { /* safe */ }
    }
    this.matrixChars = [];

    for (const p of this.promptObjs) {
      try {
        this.textLayer.removeChild(p);
        p.destroy();
      } catch { /* safe */ }
    }
    this.promptObjs = [];

    if (!raw.trim()) return;

    this.fontSize = this.config.fontSize ?? 44;
    const greenColor = resolveColor(this.config.color ?? '#20ff66', this.palette);
    const chars = [...raw];
    const charTimings = ctx.charTimings || [];
    const lineStart = ctx.currentLine?.time ?? ctx.time;
    const lineDur = ctx.currentLine?.duration ?? 4.0;

    const isCJK = (ch: string) => /[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af\u3400-\u4dbf]/.test(ch);

    // 超长歌词两行拆分算法（超过 18 字符或总宽超出屏幕阈值时自动拆分）
    const maxLineChars = 20;
    const linesOfChars: { char: string; globalIdx: number }[][] = [];

    if (chars.length > maxLineChars) {
      // 寻找中点附近标点或空格分割
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

    for (let lineIdx = 0; lineIdx < lineCount; lineIdx++) {
      const lineData = linesOfChars[lineIdx];
      const yOffset = lineCount === 1 ? 0 : (lineIdx === 0 ? -lineHeight / 2 : lineHeight / 2);

      let cursorX = 0;

      // 终端提示符 `> `
      const promptObj = new PIXI.Text({
        text: '> ',
        style: new PIXI.TextStyle({
          fontFamily: '"Consolas", "Courier New", monospace',
          fontSize: this.fontSize,
          fontWeight: '900',
          fill: '#00ff66',
          dropShadow: { color: '#00ff66', blur: 8, distance: 0, alpha: 0.9 }
        })
      });
      promptObj.anchor.set(0, 0.5);
      promptObj.x = cursorX;
      promptObj.y = yOffset;
      this.textLayer.addChild(promptObj);
      this.promptObjs.push(promptObj);

      cursorX += this.fontSize * 0.9;

      for (let i = 0; i < lineData.length; i++) {
        const { char, globalIdx } = lineData[i];
        const cjk = isCJK(char);
        const charW = cjk ? this.fontSize * 1.05 : this.fontSize * 0.68;

        const timing = charTimings[globalIdx];
        const decodeTime = timing
          ? timing.time
          : lineStart + (globalIdx / Math.max(1, chars.length)) * lineDur;

        const obj = new PIXI.Text({
          text: char,
          style: new PIXI.TextStyle({
            fontFamily: '"Consolas", "Courier New", "PingFang SC", "Microsoft YaHei", monospace',
            fontSize: this.fontSize,
            fontWeight: 'bold',
            fill: greenColor,
            dropShadow: {
              color: greenColor,
              blur: 10,
              distance: 0,
              alpha: 0.8,
              angle: 0
            }
          })
        });
        obj.anchor.set(0.5, 0.5);

        const slotX = cursorX + charW / 2;
        obj.x = slotX;
        obj.y = yOffset;
        this.textLayer.addChild(obj);

        const pool = cjk ? CIPHER_CJK : CIPHER_HEX;

        this.matrixChars.push({
          obj,
          realChar: char,
          decoded: false,
          decodeTime,
          slotX,
          slotY: yOffset,
          isCJK: cjk,
          cipherIndex: Math.floor(Math.random() * pool.length),
          lineIdx
        });

        cursorX += charW;
      }

      if (cursorX > maxLineWidth) {
        maxLineWidth = cursorX;
      }
    }

    // 居中整个文本层
    this.textLayer.pivot.x = maxLineWidth / 2;
  }

  update(ctx: UpdateContext): void {
    this.rebuildLine(ctx);

    const now = ctx.time;
    const cx = (this.config.x ?? 0.5) * ctx.screenWidth;
    const cy = (this.config.y ?? 0.5) * ctx.screenHeight;

    this.textLayer.x = cx;
    this.textLayer.y = cy;

    // 更新头部 HUD
    this.headerText.x = cx - (this.textLayer.pivot.x || 150);
    this.headerText.y = cy - this.fontSize * 1.4;

    // 底部翻译行
    if (ctx.showTranslation !== false && ctx.translation) {
      this.translationText.visible = true;
      this.translationText.text = ctx.translation;
      this.translationText.x = cx;
      this.translationText.y = cy + (this.promptObjs.length > 1 ? this.fontSize * 1.4 : this.fontSize * 1.1);
    } else {
      this.translationText.visible = false;
    }

    // 下方扫描线与装饰框
    this.hudLine.clear();
    const w = Math.max(320, (this.textLayer.pivot.x * 2) + 50);
    const hudX = cx - w / 2;
    const hudY = cy + (this.promptObjs.length > 1 ? this.fontSize * 1.3 : this.fontSize * 0.95);
    
    // 荧光绿数据线
    this.hudLine.rect(hudX, hudY, w, 2);
    this.hudLine.fill({ color: 0x00ff66, alpha: 0.6 });

    // 边角准星
    this.hudLine.rect(hudX - 10, hudY - 6, 4, 14);
    this.hudLine.rect(hudX + w + 6, hudY - 6, 4, 14);
    this.hudLine.fill({ color: 0x00ff66, alpha: 0.9 });

    // 密码高频乱码跳变
    const needScramble = (now - this.lastScrambleTime) > 0.045;
    if (needScramble) {
      this.lastScrambleTime = now;
    }

    let activeCursorX = 0;
    let activeCursorY = 0;

    for (const mc of this.matrixChars) {
      const isPast = now >= mc.decodeTime;
      const isDecodingNow = Math.abs(now - mc.decodeTime) < 0.14;
      const pool = mc.isCJK ? CIPHER_CJK : CIPHER_HEX;

      if (isPast) {
        // 已解密：显示真实文字，明亮纯正
        mc.decoded = true;
        mc.obj.text = mc.realChar;
        mc.obj.alpha = 1;
        mc.obj.style.fill = '#20ff66';
        mc.obj.scale.set(1);
        activeCursorX = mc.slotX + (mc.isCJK ? this.fontSize * 0.5 : this.fontSize * 0.38);
        activeCursorY = mc.slotY;
      } else {
        // 尚未到达：如果是紧随其后的下一个解密字符，显示高频跳变的矩阵乱码
        mc.decoded = false;
        if (needScramble) {
          mc.cipherIndex = (mc.cipherIndex + 1 + Math.floor(Math.random() * 3)) % pool.length;
        }
        mc.obj.text = pool[mc.cipherIndex] || '0';

        // 只有距离解密点 0.25s 内的当前输入字符才预显乱码，更远处的字符保持隐藏，呈现纯正终端逐字键入打字机效果！
        const timeUntilDecode = mc.decodeTime - now;
        if (timeUntilDecode <= 0.25) {
          mc.obj.alpha = 0.85;
          mc.obj.style.fill = '#ffffff';
          mc.obj.scale.set(1.1);
        } else {
          mc.obj.alpha = 0; // 未打字到达前完全隐藏
        }
      }

      if (isDecodingNow) {
        // 解密瞬间的白光爆发
        mc.obj.style.fill = '#ffffff';
        mc.obj.alpha = 1;
        mc.obj.scale.set(1.22);
      }
    }

    // 光标跟随当前解密头部
    const cursorBlink = Math.sin(now * 8) > 0;
    this.cursorObj.x = activeCursorX || (this.promptObjs[0]?.x ?? 0) + this.fontSize * 0.9;
    this.cursorObj.y = activeCursorY;
    this.cursorObj.alpha = cursorBlink ? 0.95 : 0.1;

  }

  destroy(): void {
    for (const c of this.matrixChars) {
      try { c.obj.destroy(); } catch { /* safe */ }
    }
    this.matrixChars = [];
    for (const p of this.promptObjs) {
      try { p.destroy(); } catch { /* safe */ }
    }
    this.promptObjs = [];
    try {
      this.cursorObj.destroy();
      this.headerText.destroy();
      this.translationText.destroy();
      this.hudLine.destroy();
      this.textLayer.destroy({ children: true });
    } catch { /* safe */ }
    super.destroy();
  }
}
