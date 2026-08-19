// PV Tool — Copyright (c) 2026 DanteAlighieri13210914
// Licensed under Non-Commercial License. See LICENSE for terms.

import * as PIXI from 'pixi.js';

let sharedBlobTexture: PIXI.Texture | null = null;

/** Soft radial blob texture (white center → transparent), shared across
 *  effects (meshGradient, dustParticles, ...). 256 px is plenty — the blob
 *  is always rendered heavily blurred by design. */
export function getSoftBlobTexture(): PIXI.Texture {
  if (sharedBlobTexture) return sharedBlobTexture;
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const c = canvas.getContext('2d')!;
  const grad = c.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.35, 'rgba(255,255,255,0.55)');
  grad.addColorStop(0.7, 'rgba(255,255,255,0.16)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = grad;
  c.fillRect(0, 0, size, size);
  sharedBlobTexture = PIXI.Texture.from(canvas);
  return sharedBlobTexture;
}
