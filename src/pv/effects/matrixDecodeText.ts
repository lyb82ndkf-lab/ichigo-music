import * as PIXI from 'pixi.js';
import { BaseEffect } from './base';
import type { UpdateContext } from '../core/types';
import { resolveColor } from '../core/types';
import { clamp01, lerp, damp } from '../core/easing';
import { annotateFurigana } from '../../utils/lyrics/furiganaHelper';

export enum MatrixScene {
  SCRAMBLE = 0,    // 0: 乱码解密 + 激光扫描线 + 推进运镜
  TERMINAL = 1,    // 1: 终端命令行打字 + 窗口边框/光标 + 3D等轴轻微倾斜
  HEX_DUMP = 2,    // 2: 十六进制内存转储与字符编码 + 地址偏移 + 拉远运镜
  GRID_RADAR = 3,  // 3: 透视空间网格与雷达目标锁定 + 深度运镜
  TOPOLOGY = 4,    // 4: 网络拓扑路由与数据包传输 + 节点拆分 + 轨迹平移
  GLITCH_BREACH = 5 // 5: 故障过载切片与超频告警 + 重低音冲击震颤
}

// 混合暗码库：十六进制与片假名、古代符文代码
const CIPHER_HEX = '0123456789ABCDEFｦｱｳｴｵｶｷｹｺｻｼｽｾｿﾀﾂﾃﾅﾆﾇﾈﾊﾋﾎﾏﾐﾑﾒﾓﾔﾕﾗﾘﾜ';
const CIPHER_CJK = 'アイウエオカキクケコサシスセソタチツテト天地玄黄宇宙洪荒日月盈昃辰宿列张0123456789';

interface MatrixChar {
  obj: PIXI.Text;
  ghostObj?: PIXI.Text; // Glitch scene chromatic split
  realChar: string;
  hexCode: string;
  decoded: boolean;
  decodeTime: number;
  slotX: number;
  slotY: number;
  isCJK: boolean;
  cipherIndex: number;
  lineIdx: number;
  globalIdx: number;
  nodeIdx?: number;
}

interface MatrixRuby {
  obj: PIXI.Text;
  centerX: number;
  slotY: number;
  startGlobalIdx: number;
  endGlobalIdx: number;
}

interface TopologyNode {
  title: string;
  ip: string;
  boxX: number;
  boxY: number;
  boxW: number;
  boxH: number;
  titleObj: PIXI.Text;
}

/**
 * 黑客帝国专属旗舰核心：全景多维科技矩阵导演引擎 (Matrix Cinematic Director)
 * 
 * 核心创新特性：
 * 1. 6大差异化黑客科技镜头智能轮巡 (乱码解密 / 终端键入 / 内存转储 / 空间雷达 / 拓扑路由 / 故障超频)
 * 2. 真实运镜效果 (Camera Director: 推进拉远 Zoom, 等轴倾斜 Tilt, 数据流追踪 Pan, 重低音冲击 Recoil)
 * 3. 动态高科技矢量线条与 HUD (激光扫描束 / 终端窗口 / 3D透视地网 / 旋转雷达准星 / 拓扑母线与脉冲数据包)
 * 4. 智能歌词分词与拆分算法 (长句两行断句 / 拓扑网络多节点切块)
 * 5. 全套逐字解密演化 (暗码高频跳变 -> 白光爆裂 -> 霓虹绿锁定 / 十六进制字节编码转译)
 * 6. 平假名注音 (Furigana) 与底部网络科技翻译字幕全面自适应
 */
export class MatrixDecodeText extends BaseEffect {
  readonly name = 'matrixDecodeText';

  // 运镜舞台系统
  private cameraStage!: PIXI.Container;
  private hudLayer!: PIXI.Graphics;
  private textLayer!: PIXI.Container;
  private windowLayer!: PIXI.Graphics;
  private glitchLayer!: PIXI.Graphics;

  // 镜头参数平滑跟踪器
  private curCamScale = 1.0;
  private curCamRot = 0;
  private curCamX = 0;
  private curCamY = 0;

  // 场景与文本元素
  private currentScene: MatrixScene = MatrixScene.SCRAMBLE;
  private currentRawText = '';
  private lastScrambleTime = 0;
  private fontSize = 48;

  // 字符、注音与提示符
  private matrixChars: MatrixChar[] = [];
  private rubies: MatrixRuby[] = [];
  private promptObjs: PIXI.Text[] = [];
  private topologyNodes: TopologyNode[] = [];

  // 通用 HUD 元素
  private cursorObj!: PIXI.Text;
  private headerText!: PIXI.Text;
  private subHeaderText!: PIXI.Text;
  private translationText!: PIXI.Text;

  // 拓扑节点包位置
  private topologyActivePacketX = 0;
  private topologyActivePacketY = 0;

  protected setup(): void {
    // 根镜头舞台 (运镜中心)
    this.cameraStage = new PIXI.Container();
    this.container.addChild(this.cameraStage);

    this.windowLayer = new PIXI.Graphics();
    this.hudLayer = new PIXI.Graphics();
    this.glitchLayer = new PIXI.Graphics();
    this.textLayer = new PIXI.Container();

    this.cameraStage.addChild(this.windowLayer);
    this.cameraStage.addChild(this.hudLayer);
    this.cameraStage.addChild(this.textLayer);
    this.cameraStage.addChild(this.glitchLayer);

    const greenColor = resolveColor(this.config.color ?? '#00ff41', this.palette);

    // 终端方块光标
    this.cursorObj = new PIXI.Text({
      text: '█',
      style: new PIXI.TextStyle({
        fontFamily: '"Consolas", "Courier New", monospace',
        fontSize: this.fontSize,
        fill: greenColor,
        dropShadow: {
          color: greenColor,
          blur: 10,
          distance: 0,
          alpha: 0.9,
          angle: 0
        }
      })
    });
    this.cursorObj.anchor.set(0, 0.5);
    this.textLayer.addChild(this.cursorObj);

    // 头部系统信息
    this.headerText = new PIXI.Text({
      text: '> ROOT@MATRIX_CORE:~$ DECRYPT_STREAM --LIVE',
      style: new PIXI.TextStyle({
        fontFamily: '"Consolas", "Courier New", monospace',
        fontSize: 12,
        fontWeight: 'bold',
        fill: '#00cc33',
        letterSpacing: 2
      })
    });
    this.cameraStage.addChild(this.headerText);

    // 副系统指标信息
    this.subHeaderText = new PIXI.Text({
      text: 'MEM_ALLOC: 0x7FFE0000 | STACK_DEPTH: 0x08 | CIPHER: AES-256-GCM',
      style: new PIXI.TextStyle({
        fontFamily: '"Consolas", "Courier New", monospace',
        fontSize: 10,
        fill: 'rgba(0, 255, 65, 0.65)',
        letterSpacing: 1.5
      })
    });
    this.cameraStage.addChild(this.subHeaderText);

    // 翻译字幕行
    this.translationText = new PIXI.Text({
      text: '',
      style: new PIXI.TextStyle({
        fontFamily: '"PingFang SC", "Microsoft YaHei", "Consolas", sans-serif',
        fontSize: 18,
        fill: 'rgba(0, 255, 65, 0.85)',
        letterSpacing: 1.5,
        dropShadow: {
          color: '#002200',
          blur: 8,
          distance: 1,
          alpha: 0.9
        }
      })
    });
    this.translationText.anchor.set(0.5, 0);
    this.cameraStage.addChild(this.translationText);
  }

  /**
   * 字符十六进制编码映射器 (UTF-8 字节代码呈现)
   */
  private charToHex(ch: string): string {
    const code = ch.charCodeAt(0);
    const hex = code.toString(16).toUpperCase();
    return hex.length > 2 ? hex.slice(-2) : hex.padStart(2, '0');
  }

  /**
   * 智能歌词分词与多行重排引擎
   */
  private rebuildLine(ctx: UpdateContext): void {
    const raw = ctx.currentText || '';
    if (raw === this.currentRawText && this.matrixChars.length > 0) return;
    this.currentRawText = raw;

    // 清理旧资源
    for (const c of this.matrixChars) {
      try {
        this.textLayer.removeChild(c.obj);
        c.obj.destroy();
        if (c.ghostObj) {
          this.textLayer.removeChild(c.ghostObj);
          c.ghostObj.destroy();
        }
      } catch { /* safe */ }
    }
    this.matrixChars = [];

    for (const r of this.rubies) {
      try {
        this.textLayer.removeChild(r.obj);
        r.obj.destroy();
      } catch { /* safe */ }
    }
    this.rubies = [];

    for (const p of this.promptObjs) {
      try {
        this.textLayer.removeChild(p);
        p.destroy();
      } catch { /* safe */ }
    }
    this.promptObjs = [];

    for (const node of this.topologyNodes) {
      try {
        this.textLayer.removeChild(node.titleObj);
        node.titleObj.destroy();
      } catch { /* safe */ }
    }
    this.topologyNodes = [];

    this.textLayer.removeChildren();
    this.textLayer.addChild(this.cursorObj);

    if (!raw.trim()) return;

    // 场景智能轮转器 (根据当前行序列号动态切换6大场景)
    this.currentScene = ((ctx.currentLineIndex || 0) % 6) as MatrixScene;

    this.fontSize = this.config.fontSize ?? 48;
    const greenColor = resolveColor(this.config.color ?? '#00ff41', this.palette);
    const chars = [...raw];
    const charTimings = ctx.charTimings || [];
    const lineStart = ctx.currentLine?.time ?? ctx.time;
    const lineDur = ctx.currentLine?.duration ?? 4.0;
    const isCJK = (ch: string) => /[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af\u3400-\u4dbf]/.test(ch);

    const globalCharPositions: Record<number, { slotX: number; slotY: number; charW: number }> = {};

    // ==========================================
    // 场景分支 A: 拓扑节点拆分 (SCENE 4: TOPOLOGY)
    // ==========================================
    if (this.currentScene === MatrixScene.TOPOLOGY) {
      this.buildTopologyScene(chars, charTimings, lineStart, lineDur, isCJK, greenColor, globalCharPositions);
    } 
    // ==========================================
    // 场景分支 B: 标准/终端/内存/雷达/故障两行拆分 (SCENE 0, 1, 2, 3, 5)
    // ==========================================
    else {
      this.buildStandardScenes(chars, charTimings, lineStart, lineDur, isCJK, greenColor, globalCharPositions);
    }

    // 平假名注音合成
    if (ctx.showFurigana !== false) {
      const segments = annotateFurigana(raw);
      let charCursor = 0;
      for (const seg of segments) {
        const segLen = seg.text.length;
        const startIdx = charCursor;
        const endIdx = charCursor + segLen - 1;

        if (seg.ruby && globalCharPositions[startIdx] && globalCharPositions[endIdx]) {
          const startP = globalCharPositions[startIdx];
          const endP = globalCharPositions[endIdx];
          if (startP.slotY === endP.slotY) {
            const centerX = (startP.slotX - startP.charW / 2 + endP.slotX + endP.charW / 2) / 2;
            const rubyObj = new PIXI.Text({
              text: seg.ruby,
              style: new PIXI.TextStyle({
                fontFamily: '"Noto Sans JP", "Hiragino Kaku Gothic Pro", "PingFang SC", sans-serif',
                fontSize: Math.max(11, Math.round(this.fontSize * 0.28)),
                fontWeight: '600',
                fill: '#00ff41',
                alpha: 0.9
              })
            });
            rubyObj.anchor.set(0.5, 0.5);
            rubyObj.x = centerX;
            rubyObj.y = startP.slotY - this.fontSize * 0.58;
            rubyObj.alpha = 0;
            this.textLayer.addChild(rubyObj);

            this.rubies.push({
              obj: rubyObj,
              centerX,
              slotY: startP.slotY,
              startGlobalIdx: startIdx,
              endGlobalIdx: endIdx
            });
          }
        }
        charCursor += segLen;
      }
    }
  }

  /**
   * 构建标准/终端/内存/雷达/故障场景排版
   */
  private buildStandardScenes(
    chars: string[],
    charTimings: any[],
    lineStart: number,
    lineDur: number,
    isCJK: (ch: string) => boolean,
    greenColor: string,
    globalCharPositions: Record<number, { slotX: number; slotY: number; charW: number }>
  ): void {
    const maxLineChars = 18;
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

    const lineHeight = this.fontSize * 1.38;
    const lineCount = linesOfChars.length;
    let maxLineWidth = 0;

    for (let lineIdx = 0; lineIdx < lineCount; lineIdx++) {
      const lineData = linesOfChars[lineIdx];
      const yOffset = lineCount === 1 ? 0 : (lineIdx === 0 ? -lineHeight / 2 : lineHeight / 2);
      let cursorX = 0;

      // 场景专属引导标识
      let promptPrefix = '> ';
      if (this.currentScene === MatrixScene.HEX_DUMP) {
        promptPrefix = lineIdx === 0 ? '0x7FFE0010: ' : '0x7FFE0028: ';
      } else if (this.currentScene === MatrixScene.TERMINAL) {
        promptPrefix = lineIdx === 0 ? '$ exec ' : '$ echo ';
      } else if (this.currentScene === MatrixScene.GRID_RADAR) {
        promptPrefix = '[TGT] ';
      } else if (this.currentScene === MatrixScene.GLITCH_BREACH) {
        promptPrefix = '!ERR! ';
      }

      const promptObj = new PIXI.Text({
        text: promptPrefix,
        style: new PIXI.TextStyle({
          fontFamily: '"Consolas", "Courier New", monospace',
          fontSize: this.currentScene === MatrixScene.HEX_DUMP ? this.fontSize * 0.72 : this.fontSize * 0.9,
          fontWeight: '900',
          fill: this.currentScene === MatrixScene.GLITCH_BREACH ? '#ff2244' : '#00ff41',
          dropShadow: { color: greenColor, blur: 8, distance: 0, alpha: 0.8 }
        })
      });
      promptObj.anchor.set(0, 0.5);
      promptObj.x = cursorX;
      promptObj.y = yOffset;
      this.textLayer.addChild(promptObj);
      this.promptObjs.push(promptObj);

      cursorX += promptObj.width + 12;

      for (let i = 0; i < lineData.length; i++) {
        const { char, globalIdx } = lineData[i];
        const cjk = isCJK(char);
        const charW = cjk ? this.fontSize * 1.05 : this.fontSize * 0.68;

        const timing = charTimings[globalIdx];
        const decodeTime = timing
          ? timing.time
          : lineStart + (globalIdx / Math.max(1, chars.length)) * lineDur;

        // 主文本对象
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
              alpha: 0.85,
              angle: 0
            }
          })
        });
        obj.anchor.set(0.5, 0.5);

        const slotX = cursorX + charW / 2;
        obj.x = slotX;
        obj.y = yOffset;
        this.textLayer.addChild(obj);

        // 故障超频场景：创建双重 RGB 色散重影 Text
        let ghostObj: PIXI.Text | undefined;
        if (this.currentScene === MatrixScene.GLITCH_BREACH) {
          ghostObj = new PIXI.Text({
            text: char,
            style: new PIXI.TextStyle({
              fontFamily: '"Consolas", "Courier New", monospace',
              fontSize: this.fontSize,
              fontWeight: 'bold',
              fill: '#ff1144',
              alpha: 0.7
            })
          });
          ghostObj.anchor.set(0.5, 0.5);
          ghostObj.x = slotX + 4;
          ghostObj.y = yOffset - 2;
          this.textLayer.addChild(ghostObj);
        }

        const pool = cjk ? CIPHER_CJK : CIPHER_HEX;

        this.matrixChars.push({
          obj,
          ghostObj,
          realChar: char,
          hexCode: this.charToHex(char),
          decoded: false,
          decodeTime,
          slotX,
          slotY: yOffset,
          isCJK: cjk,
          cipherIndex: Math.floor(Math.random() * pool.length),
          lineIdx,
          globalIdx
        });

        globalCharPositions[globalIdx] = { slotX, slotY: yOffset, charW };
        cursorX += charW;
      }

      if (cursorX > maxLineWidth) {
        maxLineWidth = cursorX;
      }
    }

    this.textLayer.pivot.x = maxLineWidth / 2;
  }

  /**
   * 构建拓扑网络多节点切块场景排版 (SCENE 4: TOPOLOGY)
   */
  private buildTopologyScene(
    chars: string[],
    charTimings: any[],
    lineStart: number,
    lineDur: number,
    isCJK: (ch: string) => boolean,
    greenColor: string,
    globalCharPositions: Record<number, { slotX: number; slotY: number; charW: number }>
  ): void {
    // 将歌词智能拆分为 2 ~ 3 个网络节点包
    const nodeCount = chars.length > 14 ? 3 : 2;
    const chunkSize = Math.ceil(chars.length / nodeCount);
    const nodeSpacing = 42;
    let totalW = 0;

    const nodeChunks: { chars: { char: string; globalIdx: number }[]; w: number }[] = [];

    for (let n = 0; n < nodeCount; n++) {
      const slice = chars.slice(n * chunkSize, (n + 1) * chunkSize).map((c, i) => ({
        char: c,
        globalIdx: n * chunkSize + i
      }));
      if (slice.length === 0) continue;

      let nw = 28; // 内部边距
      for (const item of slice) {
        nw += isCJK(item.char) ? this.fontSize * 0.95 : this.fontSize * 0.62;
      }
      nodeChunks.push({ chars: slice, w: nw });
      totalW += nw;
    }
    totalW += (nodeChunks.length - 1) * nodeSpacing;

    let startX = -totalW / 2;
    const nodeY = 0;
    const nodeH = this.fontSize * 1.5;

    for (let n = 0; n < nodeChunks.length; n++) {
      const chunk = nodeChunks[n];
      const boxX = startX;
      const boxW = chunk.w;
      const boxY = nodeY - nodeH / 2;

      // 节点头标
      const ip = `192.168.1.${10 + n * 12}`;
      const titleObj = new PIXI.Text({
        text: `[NODE_0${n + 1} // ${ip}]`,
        style: new PIXI.TextStyle({
          fontFamily: '"Consolas", monospace',
          fontSize: 10,
          fontWeight: 'bold',
          fill: '#00ee44'
        })
      });
      titleObj.x = boxX + 6;
      titleObj.y = boxY - 14;
      this.textLayer.addChild(titleObj);

      this.topologyNodes.push({
        title: `NODE_0${n + 1}`,
        ip,
        boxX,
        boxY,
        boxW,
        boxH: nodeH,
        titleObj
      });

      let charX = boxX + 14;
      for (const item of chunk.chars) {
        const cjk = isCJK(item.char);
        const charW = cjk ? this.fontSize * 0.95 : this.fontSize * 0.62;
        const timing = charTimings[item.globalIdx];
        const decodeTime = timing
          ? timing.time
          : lineStart + (item.globalIdx / Math.max(1, chars.length)) * lineDur;

        const obj = new PIXI.Text({
          text: item.char,
          style: new PIXI.TextStyle({
            fontFamily: '"Consolas", "Courier New", "PingFang SC", monospace',
            fontSize: this.fontSize * 0.92,
            fontWeight: 'bold',
            fill: greenColor,
            dropShadow: { color: greenColor, blur: 8, distance: 0, alpha: 0.8 }
          })
        });
        obj.anchor.set(0.5, 0.5);
        obj.x = charX + charW / 2;
        obj.y = nodeY;
        this.textLayer.addChild(obj);

        const pool = cjk ? CIPHER_CJK : CIPHER_HEX;

        this.matrixChars.push({
          obj,
          realChar: item.char,
          hexCode: this.charToHex(item.char),
          decoded: false,
          decodeTime,
          slotX: obj.x,
          slotY: nodeY,
          isCJK: cjk,
          cipherIndex: Math.floor(Math.random() * pool.length),
          lineIdx: 0,
          globalIdx: item.globalIdx,
          nodeIdx: n
        });

        globalCharPositions[item.globalIdx] = { slotX: obj.x, slotY: nodeY, charW };
        charX += charW;
      }

      startX += boxW + nodeSpacing;
    }

    this.textLayer.pivot.x = 0; // 拓扑场景自身通过绝对坐标居中
  }

  update(ctx: UpdateContext): void {
    this.rebuildLine(ctx);

    const now = ctx.time;
    const cx = (this.config.x ?? 0.5) * ctx.screenWidth;
    const cy = (this.config.y ?? 0.5) * ctx.screenHeight;
    const progress = clamp01(ctx.currentLineProgress ?? 0);

    const bass = ctx.audioReact?.bass ?? 0;
    const energy = ctx.audioReact?.energy ?? 0;
    const isBeat = ctx.audioReact?.isBeat ?? false;
    const dt = ctx.deltaTime;

    // ==========================================
    // 1. 运镜控制中枢 (Camera Director)
    // ==========================================
    let targetZoom = 1.0;
    let targetTilt = 0;
    let targetPanX = 0;
    let targetPanY = 0;

    switch (this.currentScene) {
      case MatrixScene.SCRAMBLE:
        // 推进运镜：平滑从 1.0 -> 1.08 推进
        targetZoom = lerp(1.0, 1.08, progress);
        targetTilt = Math.sin(now * 0.5) * 0.008;
        break;

      case MatrixScene.TERMINAL:
        // 3D 等轴轻微倾斜运镜 (-1.8°) + 微量 X 轴平移
        targetZoom = 1.02;
        targetTilt = -0.03; // ~ -1.72 deg
        targetPanX = lerp(-20, 20, progress);
        break;

      case MatrixScene.HEX_DUMP:
        // 拉远运镜：从 1.10 -> 0.98 舒展拉开
        targetZoom = lerp(1.10, 0.98, progress);
        targetTilt = 0.018;
        targetPanX = 10;
        break;

      case MatrixScene.GRID_RADAR:
        // 深度推进 + 垂直视差
        targetZoom = lerp(0.96, 1.07, progress);
        targetPanY = lerp(10, -10, progress);
        break;

      case MatrixScene.TOPOLOGY:
        // 拓扑航向跟机运镜：摄像机横向跟随当前活跃的数据包流动！
        targetZoom = 1.03;
        targetPanX = -this.topologyActivePacketX * 0.65;
        break;

      case MatrixScene.GLITCH_BREACH:
        // 故障超频：重低音剧烈震颤冲击
        targetZoom = 1.0 + (isBeat ? 0.08 : bass * 0.04);
        targetTilt = (Math.random() - 0.5) * (isBeat ? 0.04 : 0.01);
        break;
    }

    // 重低音瞬时抖动
    const beatShakeX = isBeat ? (Math.random() - 0.5) * 10 : 0;
    const beatShakeY = isBeat ? (Math.random() - 0.5) * 8 : 0;

    // 弹性平滑逼近运镜
    const dampSpeed = damp(7, dt);
    this.curCamScale = lerp(this.curCamScale, targetZoom, dampSpeed);
    this.curCamRot = lerp(this.curCamRot, targetTilt, dampSpeed);
    this.curCamX = lerp(this.curCamX, targetPanX, dampSpeed);
    this.curCamY = lerp(this.curCamY, targetPanY, dampSpeed);

    // 应用到镜头舞台
    this.cameraStage.pivot.set(cx, cy);
    this.cameraStage.position.set(cx + this.curCamX + beatShakeX, cy + this.curCamY + beatShakeY);
    this.cameraStage.scale.set(this.curCamScale * (1.0 + bass * 0.04));
    this.cameraStage.rotation = this.curCamRot;

    this.textLayer.x = cx;
    this.textLayer.y = cy;

    // ==========================================
    // 2. 逐字解密 / 字符编码更新
    // ==========================================
    const needScramble = (now - this.lastScrambleTime) > 0.045;
    if (needScramble) {
      this.lastScrambleTime = now;
    }

    let activeCursorX = 0;
    let activeCursorY = 0;
    let activeDecodeGlobalX = 0;
    let minTimeDiff = Infinity;

    for (const mc of this.matrixChars) {
      const isPast = now >= mc.decodeTime;
      const isDecodingNow = Math.abs(now - mc.decodeTime) < 0.15;
      const pool = mc.isCJK ? CIPHER_CJK : CIPHER_HEX;

      // 跟踪当前紧邻解密的字符坐标
      const diff = Math.abs(now - mc.decodeTime);
      if (diff < minTimeDiff) {
        minTimeDiff = diff;
        activeDecodeGlobalX = mc.slotX;
      }

      if (isPast) {
        // 已解密：显示真实文字
        mc.decoded = true;
        mc.obj.text = mc.realChar;
        mc.obj.alpha = 1;
        mc.obj.style.fill = '#00ff41';
        mc.obj.scale.set(1);

        if (mc.ghostObj) {
          mc.ghostObj.text = mc.realChar;
          mc.ghostObj.alpha = isBeat ? 0.75 : 0.2;
          mc.ghostObj.x = mc.slotX + (isBeat ? (Math.random() - 0.5) * 8 : 3);
        }

        activeCursorX = mc.slotX + (mc.isCJK ? this.fontSize * 0.5 : this.fontSize * 0.38);
        activeCursorY = mc.slotY;
      } else {
        mc.decoded = false;
        if (needScramble) {
          mc.cipherIndex = (mc.cipherIndex + 1 + Math.floor(Math.random() * 3)) % pool.length;
        }

        // 场景 2 (内存转储)：显示十六进制编码跳变；其他场景显示片假名/乱码跳变
        if (this.currentScene === MatrixScene.HEX_DUMP) {
          mc.obj.text = needScramble ? pool.slice(0, 2) : mc.hexCode;
        } else {
          mc.obj.text = pool[mc.cipherIndex] || '0';
        }

        const timeUntilDecode = mc.decodeTime - now;
        if (timeUntilDecode <= 0.28) {
          mc.obj.alpha = 0.9;
          mc.obj.style.fill = '#ffffff';
          mc.obj.scale.set(1.15);
        } else {
          mc.obj.alpha = this.currentScene === MatrixScene.TERMINAL ? 0 : 0.18;
          mc.obj.style.fill = '#00aa33';
          mc.obj.scale.set(1.0);
        }

        if (mc.ghostObj) {
          mc.ghostObj.alpha = 0;
        }
      }

      if (isDecodingNow) {
        // 解密瞬间的激光白光爆发
        mc.obj.style.fill = '#ffffff';
        mc.obj.alpha = 1;
        mc.obj.scale.set(1.25);
      }
    }

    // 平假名注音同步跟随
    for (const r of this.rubies) {
      if (ctx.showFurigana === false) {
        r.obj.visible = false;
        continue;
      }
      r.obj.visible = true;
      const startChar = this.matrixChars.find(m => m.globalIdx === r.startGlobalIdx);
      if (startChar) {
        r.obj.alpha = startChar.obj.alpha * 0.92;
        r.obj.x = r.centerX;
        r.obj.y = startChar.slotY - this.fontSize * 0.58;
      }
    }

    // 终端光标位置与闪烁控制
    const cursorBlink = Math.sin(now * 8) > 0;
    this.cursorObj.visible = this.currentScene === MatrixScene.TERMINAL || this.currentScene === MatrixScene.HEX_DUMP;
    this.cursorObj.x = activeCursorX || (this.promptObjs[0]?.x ?? 0) + this.fontSize * 0.9;
    this.cursorObj.y = activeCursorY;
    this.cursorObj.alpha = cursorBlink ? 0.95 : 0.1;

    // 头部系统 HUD
    const boxW = Math.max(340, (this.textLayer.pivot.x * 2) + 60);
    this.headerText.x = cx - boxW / 2;
    this.headerText.y = cy - this.fontSize * 1.5;
    this.headerText.text = `> [SCENE_0${this.currentScene + 1}] MATRIX_CORE // CIPHER_STREAM --SYNC`;

    this.subHeaderText.x = cx - boxW / 2;
    this.subHeaderText.y = cy - this.fontSize * 1.15;

    // 底部翻译字幕
    if (ctx.showTranslation !== false && ctx.translation) {
      this.translationText.visible = true;
      this.translationText.text = `[SYS_TL] ${ctx.translation} [/SYS_TL]`;
      this.translationText.x = cx;
      this.translationText.y = cy + (this.promptObjs.length > 1 ? this.fontSize * 1.45 : this.fontSize * 1.15);
    } else {
      this.translationText.visible = false;
    }

    // ==========================================
    // 3. 场景特定高科技矢量线条与 HUD 渲染
    // ==========================================
    this.drawSceneGraphics(ctx, cx, cy, boxW, activeDecodeGlobalX, now, bass, isBeat);
  }

  /**
   * 绘制 6 大场景专属高科技矢量线条、边框、网格与雷达
   */
  private drawSceneGraphics(
    ctx: UpdateContext,
    cx: number,
    cy: number,
    boxW: number,
    activeX: number,
    now: number,
    bass: number,
    isBeat: boolean
  ): void {
    const hud = this.hudLayer;
    const win = this.windowLayer;
    const glitch = this.glitchLayer;

    hud.clear();
    win.clear();
    glitch.clear();

    const w = ctx.screenWidth;
    const h = ctx.screenHeight;
    const leftX = cx - boxW / 2;
    const rightX = cx + boxW / 2;
    const bottomY = cy + (this.promptObjs.length > 1 ? this.fontSize * 1.25 : this.fontSize * 0.9);

    switch (this.currentScene) {
      // ----------------------------------------------------
      // 场景 0: 乱码解密 + 激光扫描线 + 边角准星
      // ----------------------------------------------------
      case MatrixScene.SCRAMBLE: {
        // 荧光数据底线
        hud.rect(leftX, bottomY, boxW, 2);
        hud.fill({ color: 0x00ff41, alpha: 0.65 });

        // 边角准星
        hud.rect(leftX - 8, bottomY - 6, 3, 14);
        hud.rect(rightX + 5, bottomY - 6, 3, 14);
        hud.fill({ color: 0x00ff41, alpha: 0.9 });

        // 竖向激光扫描束 (扫过当前正在解密的字符位置)
        const scanLaserX = cx - this.textLayer.pivot.x + activeX;
        hud.rect(scanLaserX - 1, cy - this.fontSize * 1.2, 3, this.fontSize * 2.4);
        hud.fill({ color: 0x00ff41, alpha: 0.85 });

        // 激光微光晕
        hud.rect(scanLaserX - 12, cy - this.fontSize * 1.2, 24, this.fontSize * 2.4);
        hud.fill({ color: 0x00ff41, alpha: 0.15 + bass * 0.15 });

        // 扫描箭头标尺
        hud.moveTo(scanLaserX - 5, cy - this.fontSize * 1.25).lineTo(scanLaserX + 5, cy - this.fontSize * 1.25);
        hud.stroke({ width: 2, color: 0x00ff41, alpha: 0.9 });
        break;
      }

      // ----------------------------------------------------
      // 场景 1: 终端命令行打字 + 完整窗口边框与标题栏圆点
      // ----------------------------------------------------
      case MatrixScene.TERMINAL: {
        const winH = this.promptObjs.length > 1 ? this.fontSize * 3.4 : this.fontSize * 2.7;
        const winY = cy - this.fontSize * 1.6;

        // 窗口背景
        win.roundRect(leftX - 16, winY, boxW + 32, winH, 8);
        win.fill({ color: 0x020a04, alpha: 0.72 });
        win.stroke({ width: 1.5, color: 0x00ff41, alpha: 0.75 });

        // 窗口标题栏底线
        win.moveTo(leftX - 16, winY + 24).lineTo(leftX + boxW + 16, winY + 24);
        win.stroke({ width: 1, color: 0x00ff41, alpha: 0.4 });

        // Mac/Linux 终端三色控制点
        win.circle(leftX - 4, winY + 12, 4);
        win.fill({ color: 0xff3b30, alpha: 0.9 }); // 红
        win.circle(leftX + 10, winY + 12, 4);
        win.fill({ color: 0xffcc00, alpha: 0.9 }); // 黄
        win.circle(leftX + 24, winY + 12, 4);
        win.fill({ color: 0x00ff41, alpha: 0.9 }); // 绿
        break;
      }

      // ----------------------------------------------------
      // 场景 2: 十六进制内存转储与字符编码 + 内存块格子
      // ----------------------------------------------------
      case MatrixScene.HEX_DUMP: {
        // 绘制内存条框
        hud.rect(leftX - 10, cy - this.fontSize * 1.3, boxW + 20, (this.promptObjs.length > 1 ? this.fontSize * 3.0 : this.fontSize * 2.3));
        hud.stroke({ width: 1.5, color: 0x00ff41, alpha: 0.55 });

        // 内存字节竖向分隔线
        for (let gx = leftX + 100; gx < rightX; gx += 85) {
          hud.moveTo(gx, cy - this.fontSize * 1.3).lineTo(gx, bottomY + 8);
        }
        hud.stroke({ width: 1, color: 0x00ff41, alpha: 0.18 });

        // 底部内存堆栈遥测条
        hud.rect(leftX - 10, bottomY + 12, (boxW + 20) * (0.35 + bass * 0.5), 3);
        hud.fill({ color: 0x00ff41, alpha: 0.85 });
        break;
      }

      // ----------------------------------------------------
      // 场景 3: 透视空间网格与雷达目标锁定
      // ----------------------------------------------------
      case MatrixScene.GRID_RADAR: {
        // A. 底部 3D 透视线地网
        const horizonY = cy + 50;
        const vLines = 14;
        const spread = w * 1.2;
        for (let i = 0; i <= vLines; i++) {
          const fx = (cx - spread / 2) + (i / vLines) * spread;
          hud.moveTo(cx, horizonY).lineTo(fx, h);
        }
        hud.stroke({ width: 1, color: 0x00ff41, alpha: 0.28 });

        // 滚动的横向深度线
        const scrollOffset = (now * 25) % 20;
        for (let j = 0; j < 8; j++) {
          const t = (j + scrollOffset / 20) / 8;
          const py = horizonY + Math.pow(t, 2.2) * (h - horizonY);
          hud.moveTo(cx - (spread / 2) * t, py).lineTo(cx + (spread / 2) * t, py);
        }
        hud.stroke({ width: 1, color: 0x00ff41, alpha: 0.35 });

        // B. 居中旋转雷达圆环与十字线
        const radarRadius = 110 + bass * 15;
        hud.circle(cx, cy, radarRadius);
        hud.stroke({ width: 1.5, color: 0x00ff41, alpha: 0.6 });

        hud.circle(cx, cy, radarRadius * 0.55);
        hud.stroke({ width: 1, color: 0x00ff41, alpha: 0.35 });

        // 雷达十字准星
        hud.moveTo(cx - radarRadius - 15, cy).lineTo(cx + radarRadius + 15, cy);
        hud.moveTo(cx, cy - radarRadius - 15).lineTo(cx, cy + radarRadius + 15);
        hud.stroke({ width: 1, color: 0x00ff41, alpha: 0.45 });

        // 旋转扫描射线
        const radarAngle = (now * 2.5) % (Math.PI * 2);
        const rayX = cx + Math.cos(radarAngle) * radarRadius;
        const rayY = cy + Math.sin(radarAngle) * radarRadius;
        hud.moveTo(cx, cy).lineTo(rayX, rayY);
        hud.stroke({ width: 2, color: 0x00ff41, alpha: 0.85 });
        break;
      }

      // ----------------------------------------------------
      // 场景 4: 网络拓扑路由与数据包传输
      // ----------------------------------------------------
      case MatrixScene.TOPOLOGY: {
        const nodes = this.topologyNodes;
        if (nodes.length >= 2) {
          // 绘制各节点框与连接电路总线
          for (let i = 0; i < nodes.length; i++) {
            const node = nodes[i];
            const active = now >= (this.matrixChars.find(m => m.nodeIdx === i)?.decodeTime ?? Infinity);

            // 节点框
            hud.roundRect(cx + node.boxX, cy + node.boxY, node.boxW, node.boxH, 4);
            hud.stroke({ width: active ? 2 : 1, color: 0x00ff41, alpha: active ? 0.9 : 0.4 });
            hud.fill({ color: 0x00220a, alpha: active ? 0.55 : 0.25 });

            // 绘制节点间的连接总线
            if (i < nodes.length - 1) {
              const next = nodes[i + 1];
              const fromX = cx + node.boxX + node.boxW;
              const fromY = cy;
              const toX = cx + next.boxX;
              const toY = cy;

              hud.moveTo(fromX, fromY).lineTo(toX, toY);
              hud.stroke({ width: 2, color: 0x00ff41, alpha: 0.7 });

              // 节点引脚小圆点
              hud.circle(fromX, fromY, 3);
              hud.circle(toX, toY, 3);
              hud.fill({ color: 0x00ff41, alpha: 0.9 });
            }
          }

          // 沿总线飞跃的发光数据包粒子
          const totalProgress = clamp01(ctx.currentLineProgress ?? 0);
          const firstNode = nodes[0];
          const lastNode = nodes[nodes.length - 1];
          const startTrackX = cx + firstNode.boxX + firstNode.boxW / 2;
          const endTrackX = cx + lastNode.boxX + lastNode.boxW / 2;

          this.topologyActivePacketX = lerp(startTrackX - cx, endTrackX - cx, totalProgress);
          this.topologyActivePacketY = 0;

          const packetDrawX = cx + this.topologyActivePacketX;
          hud.circle(packetDrawX, cy, 6);
          hud.fill({ color: 0xffffff, alpha: 1.0 });

          hud.circle(packetDrawX, cy, 12);
          hud.fill({ color: 0x00ff41, alpha: 0.4 + bass * 0.4 });
        }
        break;
      }

      // ----------------------------------------------------
      // 场景 5: 故障过载切片与超频告警
      // ----------------------------------------------------
      case MatrixScene.GLITCH_BREACH: {
        // 告警警戒条
        const alertY1 = cy - this.fontSize * 1.5;
        const alertY2 = bottomY + 10;
        glitch.rect(0, alertY1, w, 2);
        glitch.rect(0, alertY2, w, 2);
        glitch.fill({ color: 0xff1144, alpha: 0.85 });

        // 鼓点切片故障条 (Beat Glitch Slices)
        if (isBeat || bass > 0.4) {
          const sliceCount = Math.floor(2 + Math.random() * 4);
          for (let s = 0; s < sliceCount; s++) {
            const sy = cy + (Math.random() - 0.5) * this.fontSize * 2.2;
            const sh = 4 + Math.random() * 12;
            const sx = cx + (Math.random() - 0.5) * boxW;
            const sw = 40 + Math.random() * 180;
            glitch.rect(sx, sy, sw, sh);
            glitch.fill({ color: Math.random() > 0.5 ? 0xff2244 : 0x00ff41, alpha: 0.75 });
          }
        }
        break;
      }
    }
  }

  destroy(): void {
    for (const c of this.matrixChars) {
      try {
        c.obj.destroy();
        if (c.ghostObj) c.ghostObj.destroy();
      } catch { /* safe */ }
    }
    this.matrixChars = [];

    for (const r of this.rubies) {
      try { r.obj.destroy(); } catch { /* safe */ }
    }
    this.rubies = [];

    for (const p of this.promptObjs) {
      try { p.destroy(); } catch { /* safe */ }
    }
    this.promptObjs = [];

    for (const n of this.topologyNodes) {
      try { n.titleObj.destroy(); } catch { /* safe */ }
    }
    this.topologyNodes = [];

    try {
      this.cursorObj.destroy();
      this.headerText.destroy();
      this.subHeaderText.destroy();
      this.translationText.destroy();
      this.hudLayer.destroy();
      this.windowLayer.destroy();
      this.glitchLayer.destroy();
      this.textLayer.destroy({ children: true });
      this.cameraStage.destroy({ children: true });
    } catch { /* safe */ }

    super.destroy();
  }
}
