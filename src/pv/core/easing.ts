// PV Tool — Copyright (c) 2026 DanteAlighieri13210914
// Licensed under Non-Commercial License. See LICENSE for terms.

/**
 * Shared easing + math helpers for motion design.
 * All easings take p in [0,1] and return eased progress.
 */

export function clamp01(p: number): number {
  return p < 0 ? 0 : p > 1 ? 1 : p;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Smooth framerate-independent exponential approach factor.
 *  Usage: value += (target - value) * damp(rate, deltaTime) */
export function damp(rate: number, deltaTime: number): number {
  return 1 - Math.exp(-rate * deltaTime);
}

export function easeOutCubic(p: number): number {
  const q = 1 - clamp01(p);
  return 1 - q * q * q;
}

export function easeInCubic(p: number): number {
  const q = clamp01(p);
  return q * q * q;
}

export function easeInOutCubic(p: number): number {
  const q = clamp01(p);
  return q < 0.5 ? 4 * q * q * q : 1 - Math.pow(-2 * q + 2, 3) / 2;
}

export function easeOutQuart(p: number): number {
  const q = 1 - clamp01(p);
  return 1 - q * q * q * q;
}

export function easeInQuart(p: number): number {
  const q = clamp01(p);
  return q * q * q * q;
}

export function easeOutExpo(p: number): number {
  const q = clamp01(p);
  return q >= 1 ? 1 : 1 - Math.pow(2, -10 * q);
}

export function easeOutBack(p: number, overshoot = 1.70158): number {
  const q = clamp01(p) - 1;
  return 1 + (overshoot + 1) * q * q * q + overshoot * q * q;
}

export function easeOutQuad(p: number): number {
  const q = clamp01(p);
  return 1 - (1 - q) * (1 - q);
}

export function easeInQuad(p: number): number {
  const q = clamp01(p);
  return q * q;
}

export function easeInOutSine(p: number): number {
  return -(Math.cos(Math.PI * clamp01(p)) - 1) / 2;
}

/** Deterministic pseudo-random from an index seed (stable per char/particle). */
export function seededRandom(seed: number): number {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}
