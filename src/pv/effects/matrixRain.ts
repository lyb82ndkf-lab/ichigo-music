// PV Tool — Copyright (c) 2026 DanteAlighieri13210914
// Licensed under Non-Commercial License. See LICENSE for terms.

import * as PIXI from 'pixi.js';
import { BaseEffect } from './base';
import type { UpdateContext } from '../core/types';
import { resolveColor } from '../core/types';

interface MatrixColumn {
  x: number;
  y: number;
  speed: number;
  chars: string[];
  charObjs: PIXI.Text[];
  len: number;
  fontSize: number;
}

const MATRIX_CHARS = 'ｦｱｳｴｵｶｷｹｺｻｼｽｾｿﾀﾂﾃﾅﾆﾇﾈﾊﾋﾎﾏﾐﾑﾒﾓﾔﾕﾗﾘﾜ0123456789ZXYZ#@$%&*<>';

/**
 * 黑客帝国专属：数字代码雨 (Audio-Reactive Matrix Code Rain)
 * 1. 伴随音乐低音 Bass 与鼓点实时加速流动、绽放荧光与强光闪烁
 * 2. 真实片假名与二进制绿色流光
 */
export class MatrixRain extends BaseEffect {
  readonly name = 'matrixRain';
  private columns: MatrixColumn[] = [];
  private layer!: PIXI.Container;
  private initialized = false;

  protected setup(): void {
    this.layer = new PIXI.Container();
    this.container.addChild(this.layer);
  }

  private initColumns(w: number, h: number): void {
    if (this.initialized) return;
    this.initialized = true;

    const colWidth = 22;
    const colCount = Math.floor(w / colWidth);

    for (let i = 0; i < colCount; i++) {
      const colX = i * colWidth + 10;
      const len = 10 + Math.floor(Math.random() * 16);
      const fontSize = 14 + (Math.random() > 0.7 ? 2 : 0);
      const charObjs: PIXI.Text[] = [];
      const chars: string[] = [];

      for (let j = 0; j < len; j++) {
        const ch = MATRIX_CHARS[Math.floor(Math.random() * MATRIX_CHARS.length)];
        chars.push(ch);

        const obj = new PIXI.Text({
          text: ch,
          style: new PIXI.TextStyle({
            fontFamily: '"Consolas", "Courier New", monospace',
            fontSize,
            fontWeight: j === 0 ? 'bold' : 'normal',
            fill: j === 0 ? '#ffffff' : (j < 3 ? '#20ff66' : '#00aa33'),
          })
        });
        obj.anchor.set(0.5);
        obj.x = colX;
        obj.y = -999;
        this.layer.addChild(obj);
        charObjs.push(obj);
      }

      this.columns.push({
        x: colX,
        y: Math.random() * h - h,
        speed: 120 + Math.random() * 220,
        chars,
        charObjs,
        len,
        fontSize
      });
    }
  }

  update(ctx: UpdateContext): void {
    const w = ctx.screenWidth;
    const h = ctx.screenHeight;
    this.initColumns(w, h);

    const bass = ctx.audioReact?.bass ?? 0;
    const energy = ctx.audioReact?.energy ?? 0;
    const isBeat = ctx.audioReact?.isBeat ?? false;
    const dt = ctx.deltaTime;
    const speedMult = (1.0 + bass * 1.5 + energy * 0.8) * ctx.animationSpeed;

    for (const col of this.columns) {
      col.y += col.speed * speedMult * dt;
      if (col.y - col.len * col.fontSize > h) {
        col.y = -Math.random() * 200;
        col.speed = 120 + Math.random() * 220;
      }

      // Periodically randomize characters
      if (Math.random() < 0.08) {
        const randIdx = Math.floor(Math.random() * col.len);
        col.chars[randIdx] = MATRIX_CHARS[Math.floor(Math.random() * MATRIX_CHARS.length)];
        col.charObjs[randIdx].text = col.chars[randIdx];
      }

      for (let j = 0; j < col.len; j++) {
        const obj = col.charObjs[j];
        const cy = col.y - j * col.fontSize;
        obj.y = cy;

        if (cy < -20 || cy > h + 20) {
          obj.visible = false;
        } else {
          obj.visible = true;
          // Fade tail
          const tailFrac = 1 - j / col.len;
          obj.alpha = (j === 0 ? 1 : Math.max(0.08, tailFrac * 0.85)) * (0.8 + bass * 0.3);
          // Highlight head
          if (j === 0 && (isBeat || Math.random() < 0.15)) {
            obj.style.fill = '#ffffff';
          } else if (j < 2) {
            obj.style.fill = '#80ff99';
          } else {
            obj.style.fill = '#00ff41';
          }
        }
      }
    }
  }

  destroy(): void {
    for (const col of this.columns) {
      for (const obj of col.charObjs) {
        try { obj.destroy(); } catch { /* safe */ }
      }
    }
    this.columns = [];
    try { this.layer.destroy({ children: true }); } catch { /* safe */ }
  }
}
