// PV Tool — Copyright (c) 2026 DanteAlighieri13210914
// Licensed under Non-Commercial License. See LICENSE for terms.

import * as PIXI from 'pixi.js';
import { BaseEffect } from './base';
import type { UpdateContext } from '../core/types';
import { resolveColor } from '../core/types';
import { seededRandom } from '../core/easing';

interface Star {
  x: number; y: number;       // screen fraction
  r: number;
  twPh: number;
  twSp: number;
  baseAlpha: number;
  colorType: number;          // 0: cool white, 1: celestial blue, 2: warm gold
}

interface ConstellationPoint {
  x: number;
  y: number;
  name?: string;
  major?: boolean;
}

interface Constellation {
  name: string;
  points: ConstellationPoint[];
  edges: [number, number][];
  baseX: number;
  baseY: number;
  scale: number;
  alpha: number;
  driftSpeedX: number;
  driftSpeedY: number;
  rotSpeed: number;
}

interface ShootingStar {
  x: number;
  y: number;
  len: number;
  speed: number;
  angle: number;
  alpha: number;
  active: boolean;
  spawnTime: number;
}

/**
 * Fly Me to the Moon / 真实深空星图：
 * 包含 10+ 款经典真实星座连线（北斗七星、仙后座、猎户座、天鹅座、仙女座、天琴座、金牛座、双子座、天蝎座、飞马座等）
 * 全景动态深空平移漫游、随机天际流星划过（Shooting Stars）、四角星芒闪烁与柔美月晕
 */
export class StarField extends BaseEffect {
  readonly name = 'starField';
  private graphics!: PIXI.Graphics;
  private stars: Star[] = [];
  private constellations: Constellation[] = [];
  private shootingStars: ShootingStar[] = [];
  private lastMeteorTime = 0;

  protected setup(): void {
    this.graphics = new PIXI.Graphics();
    this.container.addChild(this.graphics);

    const cfg = this.config;
    const count = cfg.count ?? 180;
    for (let i = 0; i < count; i++) {
      const r = (k: number) => seededRandom(i * 11.17 + k * 6.3);
      this.stars.push({
        x: r(0), y: r(1),
        r: 0.5 + r(2) * r(2) * 2.6,
        twPh: r(3) * Math.PI * 2,
        twSp: 0.4 + r(4) * 1.6,
        baseAlpha: 0.35 + r(5) * 0.65,
        colorType: r(6) > 0.75 ? 2 : (r(6) > 0.4 ? 1 : 0),
      });
    }

    // 1. 北斗七星 (Big Dipper / Ursa Major)
    this.constellations.push({
      name: 'Ursa Major (Big Dipper)',
      baseX: 0.14,
      baseY: 0.18,
      scale: 1.05,
      alpha: 0.9,
      driftSpeedX: 0.003,
      driftSpeedY: 0.002,
      rotSpeed: 0.008,
      points: [
        { x: 0, y: 0, name: 'Alkaid', major: true },
        { x: 0.04, y: 0.02, name: 'Mizar' },
        { x: 0.08, y: 0.035, name: 'Alioth' },
        { x: 0.11, y: 0.055, name: 'Megrez' },
        { x: 0.10, y: 0.095, name: 'Phecda' },
        { x: 0.16, y: 0.10, name: 'Merak', major: true },
        { x: 0.17, y: 0.06, name: 'Dubhe', major: true },
      ],
      edges: [
        [0, 1], [1, 2], [2, 3],
        [3, 4], [4, 5], [5, 6], [6, 3]
      ]
    });

    // 2. 仙后座 (Cassiopeia - W Shape)
    this.constellations.push({
      name: 'Cassiopeia',
      baseX: 0.68,
      baseY: 0.16,
      scale: 0.95,
      alpha: 0.85,
      driftSpeedX: -0.0025,
      driftSpeedY: 0.0018,
      rotSpeed: -0.006,
      points: [
        { x: 0, y: 0.04 },
        { x: 0.035, y: 0, major: true },
        { x: 0.07, y: 0.03 },
        { x: 0.105, y: 0.005, major: true },
        { x: 0.14, y: 0.045 }
      ],
      edges: [
        [0, 1], [1, 2], [2, 3], [3, 4]
      ]
    });

    // 3. 猎户座 (Orion - 腰带与四角亮星)
    this.constellations.push({
      name: 'Orion',
      baseX: 0.78,
      baseY: 0.58,
      scale: 1.15,
      alpha: 0.85,
      driftSpeedX: 0.002,
      driftSpeedY: -0.0025,
      rotSpeed: 0.005,
      points: [
        { x: 0, y: 0, name: 'Betelgeuse', major: true },
        { x: 0.09, y: 0.01, name: 'Bellatrix', major: true },
        { x: 0.035, y: 0.055, name: 'Alnitak' },
        { x: 0.045, y: 0.057, name: 'Alnilam' },
        { x: 0.055, y: 0.059, name: 'Mintaka' },
        { x: 0.01, y: 0.11, name: 'Saiph' },
        { x: 0.085, y: 0.105, name: 'Rigel', major: true },
      ],
      edges: [
        [0, 1], [0, 2], [1, 4],
        [2, 3], [3, 4],
        [2, 5], [4, 6], [5, 6]
      ]
    });

    // 4. 天鹅座 / 北十字 (Cygnus)
    this.constellations.push({
      name: 'Cygnus',
      baseX: 0.18,
      baseY: 0.65,
      scale: 0.95,
      alpha: 0.8,
      driftSpeedX: -0.003,
      driftSpeedY: -0.0015,
      rotSpeed: -0.007,
      points: [
        { x: 0.05, y: 0, name: 'Deneb', major: true },
        { x: 0.05, y: 0.05, name: 'Sadr' },
        { x: 0.05, y: 0.11, name: 'Albireo', major: true },
        { x: 0, y: 0.045, name: 'Gienah' },
        { x: 0.10, y: 0.048, name: 'Rukh' },
      ],
      edges: [
        [0, 1], [1, 2], [3, 1], [1, 4]
      ]
    });

    // 5. 仙女座 (Andromeda)
    this.constellations.push({
      name: 'Andromeda',
      baseX: 0.44,
      baseY: 0.12,
      scale: 0.9,
      alpha: 0.75,
      driftSpeedX: 0.0015,
      driftSpeedY: 0.002,
      rotSpeed: 0.004,
      points: [
        { x: 0, y: 0.04, name: 'Alpheratz', major: true },
        { x: 0.05, y: 0.02, name: 'Mirach', major: true },
        { x: 0.11, y: 0, name: 'Almach', major: true },
        { x: 0.05, y: 0.06 },
        { x: 0.09, y: 0.075 },
      ],
      edges: [
        [0, 1], [1, 2], [1, 3], [3, 4]
      ]
    });

    // 6. 天琴座 (Lyra - 织女星 Vega)
    this.constellations.push({
      name: 'Lyra',
      baseX: 0.35,
      baseY: 0.38,
      scale: 0.85,
      alpha: 0.85,
      driftSpeedX: -0.002,
      driftSpeedY: 0.003,
      rotSpeed: 0.009,
      points: [
        { x: 0.04, y: 0, name: 'Vega', major: true },
        { x: 0.03, y: 0.04 },
        { x: 0.06, y: 0.045 },
        { x: 0.02, y: 0.085 },
        { x: 0.055, y: 0.09 },
      ],
      edges: [
        [0, 1], [0, 2], [1, 2], [1, 3], [2, 4], [3, 4]
      ]
    });

    // 7. 金牛座与昴星团 (Taurus & Pleiades)
    this.constellations.push({
      name: 'Taurus',
      baseX: 0.56,
      baseY: 0.68,
      scale: 1.0,
      alpha: 0.8,
      driftSpeedX: 0.0022,
      driftSpeedY: -0.002,
      rotSpeed: -0.005,
      points: [
        { x: 0.07, y: 0.06, name: 'Aldebaran', major: true },
        { x: 0.04, y: 0.08 },
        { x: 0.02, y: 0.04 },
        { x: 0.05, y: 0.02 },
        { x: 0.12, y: 0, name: 'Elnath', major: true },
        { x: 0.10, y: 0.09, name: 'Tianguan' },
      ],
      edges: [
        [2, 3], [3, 0], [0, 1], [1, 2], [0, 4], [1, 5]
      ]
    });

    // 8. 飞马座 (Pegasus - 大四边形)
    this.constellations.push({
      name: 'Pegasus',
      baseX: 0.84,
      baseY: 0.28,
      scale: 0.95,
      alpha: 0.78,
      driftSpeedX: -0.0018,
      driftSpeedY: 0.0022,
      rotSpeed: 0.004,
      points: [
        { x: 0, y: 0, name: 'Markab', major: true },
        { x: 0.07, y: 0.01, name: 'Scheat', major: true },
        { x: 0.08, y: 0.08, name: 'Alpheratz' },
        { x: 0.01, y: 0.07, name: 'Algenib' },
        { x: -0.04, y: 0.04, name: 'Enif' }
      ],
      edges: [
        [0, 1], [1, 2], [2, 3], [3, 0], [0, 4]
      ]
    });

    // 9. 双子座 (Gemini)
    this.constellations.push({
      name: 'Gemini',
      baseX: 0.06,
      baseY: 0.42,
      scale: 0.9,
      alpha: 0.75,
      driftSpeedX: 0.0025,
      driftSpeedY: 0.0015,
      rotSpeed: -0.006,
      points: [
        { x: 0.02, y: 0, name: 'Castor', major: true },
        { x: 0.06, y: 0.01, name: 'Pollux', major: true },
        { x: 0.01, y: 0.04 },
        { x: 0.05, y: 0.05 },
        { x: 0, y: 0.09, name: 'Alhena' },
        { x: 0.04, y: 0.10 }
      ],
      edges: [
        [0, 1], [0, 2], [1, 3], [2, 4], [3, 5], [4, 5]
      ]
    });

    // 10. 南十字座 (Southern Cross)
    this.constellations.push({
      name: 'Crux',
      baseX: 0.48,
      baseY: 0.78,
      scale: 0.8,
      alpha: 0.8,
      driftSpeedX: -0.002,
      driftSpeedY: -0.0018,
      rotSpeed: 0.008,
      points: [
        { x: 0.03, y: 0, name: 'Gacrux', major: true },
        { x: 0.03, y: 0.07, name: 'Acrux', major: true },
        { x: 0, y: 0.035, name: 'Mimosa', major: true },
        { x: 0.06, y: 0.032, name: 'Imai' },
      ],
      edges: [
        [0, 1], [2, 3]
      ]
    });

    // 初始化流星池 (Meteors / Shooting Stars)
    for (let i = 0; i < 4; i++) {
      this.shootingStars.push({
        x: 0,
        y: 0,
        len: 120,
        speed: 800,
        angle: Math.PI / 4 + 0.2,
        alpha: 0,
        active: false,
        spawnTime: 0
      });
    }
  }

  update(ctx: UpdateContext): void {
    const g = this.graphics;
    g.clear();
    const w = ctx.screenWidth;
    const h = ctx.screenHeight;
    const baseColor = resolveColor(this.config.color ?? '#dce6f5', this.palette);
    const alpha = this.config.alpha ?? 0.9;
    const now = ctx.time;
    const animSpeed = ctx.animationSpeed || 1;

    const showConstellations = this.config.constellations === true || this.config.mode === 'deepSpace' || this.config.showConstellations === true;
    const showMoon = this.config.showMoon === true || this.config.mode === 'deepSpace';
    const showMeteors = this.config.showMeteors === true || this.config.mode === 'deepSpace';

    // 1. 渲染优雅月相与星云柔光 (Moon Crescent & Lunar Halo) — 仅深空真空/Fly Me to the Moon 启用
    if (showMoon) {
      const moonX = w * 0.86;
      const moonY = h * 0.16 + Math.sin(now * 0.3) * 6;
      const moonR = Math.min(w, h) * 0.046;
      
      // 外层漫射光晕
      g.circle(moonX, moonY, moonR * 3.2);
      g.fill({ color: 0x90b8f8, alpha: 0.05 + 0.02 * Math.sin(now * 0.6) });
      g.circle(moonX, moonY, moonR * 1.8);
      g.fill({ color: 0xd0e4ff, alpha: 0.10 + 0.03 * Math.cos(now * 0.8) });
      
      // 弯月图形
      g.circle(moonX, moonY, moonR);
      g.fill({ color: 0xfffae8, alpha: 0.92 });
      g.circle(moonX - moonR * 0.42, moonY - moonR * 0.18, moonR * 0.86);
      g.fill({ color: resolveColor('$background', this.palette), alpha: 1 });
    }

    // 2. 渲染背景繁星微光与多色星点 (Twinkling Starfield)
    for (let i = 0; i < this.stars.length; i++) {
      const s = this.stars[i];
      const tw = 0.5 + 0.5 * Math.sin(now * s.twSp * animSpeed + s.twPh);
      
      // 轻微深空平移视差
      const driftX = (s.x + Math.sin(now * 0.02 * animSpeed + i) * 0.004) * w;
      const driftY = (s.y + Math.cos(now * 0.02 * animSpeed + i) * 0.004) * h;

      const starTint = s.colorType === 2 ? 0xfff0b8 : (s.colorType === 1 ? 0xaad4ff : baseColor);
      g.circle(driftX, driftY, s.r);
      g.fill({ color: starTint, alpha: alpha * s.baseAlpha * tw });

      // 亮星四角微光芒 (Cross Star Flare)
      if (s.r > 2.0 && tw > 0.8) {
        const flareLen = s.r * 2.8 * tw;
        g.moveTo(driftX - flareLen, driftY);
        g.lineTo(driftX + flareLen, driftY);
        g.moveTo(driftX, driftY - flareLen);
        g.lineTo(driftX + flareLen, driftY);
        g.stroke({ color: starTint, width: 0.8, alpha: alpha * 0.45 * tw });
      }
    }

    // 3. 渲染真实星座连线、发光节点与星座漫游 (Constellation Asterisms) — 仅深空模式启用
    if (showConstellations) {
      const globalDriftX = Math.sin(now * 0.04 * animSpeed) * 0.015;
      const globalDriftY = Math.cos(now * 0.03 * animSpeed) * 0.012;

      for (let ci = 0; ci < this.constellations.length; ci++) {
        const c = this.constellations[ci];
        const localTime = now * animSpeed;
        const constDriftX = globalDriftX + Math.sin(localTime * c.driftSpeedX * 10 + ci) * 0.02;
        const constDriftY = globalDriftY + Math.cos(localTime * c.driftSpeedY * 10 + ci) * 0.018;
        const rot = Math.sin(localTime * c.rotSpeed) * 0.06;

        const constAlpha = c.alpha * (0.82 + 0.18 * Math.sin(now * 0.7 + c.baseX * 8));

        // 连线
        for (const [fromIdx, toIdx] of c.edges) {
          const p1 = c.points[fromIdx];
          const p2 = c.points[toIdx];
          if (!p1 || !p2) continue;

          // 局部旋转与缩放计算
          const rx1 = p1.x * Math.cos(rot) - p1.y * Math.sin(rot);
          const ry1 = p1.x * Math.sin(rot) + p1.y * Math.cos(rot);
          const rx2 = p2.x * Math.cos(rot) - p2.y * Math.sin(rot);
          const ry2 = p2.x * Math.sin(rot) + p2.y * Math.cos(rot);

          const x1 = (c.baseX + constDriftX + rx1 * c.scale) * w;
          const y1 = (c.baseY + constDriftY + ry1 * c.scale) * h;
          const x2 = (c.baseX + constDriftX + rx2 * c.scale) * w;
          const y2 = (c.baseY + constDriftY + ry2 * c.scale) * h;

          g.moveTo(x1, y1);
          g.lineTo(x2, y2);
          g.stroke({ color: 0x90c2ff, width: 1.0, alpha: constAlpha * 0.38 });
        }

        // 星座节点与光芒光晕
        for (let i = 0; i < c.points.length; i++) {
          const pt = c.points[i];
          const rx = pt.x * Math.cos(rot) - pt.y * Math.sin(rot);
          const ry = pt.x * Math.sin(rot) + pt.y * Math.cos(rot);
          const px = (c.baseX + constDriftX + rx * c.scale) * w;
          const py = (c.baseY + constDriftY + ry * c.scale) * h;
          const nodeTw = 0.7 + 0.3 * Math.sin(now * 2.2 + i * 1.5 + ci);

          // 主亮星额外光环与十字星芒
          if (pt.major) {
            g.circle(px, py, 9);
            g.fill({ color: 0x7ab0ff, alpha: constAlpha * 0.22 * nodeTw });
            const flare = 10 * nodeTw;
            g.moveTo(px - flare, py);
            g.lineTo(px + flare, py);
            g.moveTo(px, py - flare);
            g.lineTo(px + flare, py);
            g.stroke({ color: 0xc8e2ff, width: 1.0, alpha: constAlpha * 0.7 * nodeTw });
          }

          // 外层柔光晕
          g.circle(px, py, pt.major ? 4.5 : 3.2);
          g.fill({ color: 0xa0ccff, alpha: constAlpha * 0.35 * nodeTw });

          // 核心亮点
          g.circle(px, py, pt.major ? 2.5 : 1.8);
          g.fill({ color: 0xffffff, alpha: constAlpha * nodeTw });
        }
      }
    }

    // 4. 随机流星划过天际 (Shooting Stars / Meteors) — 仅深空模式启用
    if (showMeteors) {
      if (now - this.lastMeteorTime > 3.2) {
        const inactive = this.shootingStars.find(m => !m.active);
        if (inactive) {
          inactive.active = true;
          inactive.spawnTime = now;
          inactive.x = Math.random() * w * 0.8;
          inactive.y = Math.random() * h * 0.35;
          inactive.len = 100 + Math.random() * 140;
          inactive.speed = 900 + Math.random() * 500;
          inactive.angle = (Math.PI / 4) + (Math.random() - 0.5) * 0.25;
          this.lastMeteorTime = now;
        }
      }

      for (const m of this.shootingStars) {
        if (!m.active) continue;
        const elapsed = now - m.spawnTime;
        const duration = 0.75;
        if (elapsed > duration) {
          m.active = false;
          continue;
        }

        const p = elapsed / duration;
        const curDist = elapsed * m.speed;
        const tailDist = Math.max(0, curDist - m.len);

        const headX = m.x + Math.cos(m.angle) * curDist;
        const headY = m.y + Math.sin(m.angle) * curDist;
        const tailX = m.x + Math.cos(m.angle) * tailDist;
        const tailY = m.y + Math.sin(m.angle) * tailDist;

        const meteorAlpha = Math.sin(p * Math.PI) * 0.9;

        g.moveTo(tailX, tailY);
        g.lineTo(headX, headY);
        g.stroke({ color: 0xddeeff, width: 2.2, alpha: meteorAlpha });

        // 流星头部光球
        g.circle(headX, headY, 3.5);
        g.fill({ color: 0xffffff, alpha: meteorAlpha });
        g.circle(headX, headY, 8);
        g.fill({ color: 0x88ccff, alpha: meteorAlpha * 0.4 });
      }
    }
  }
}
