// Extract adaptive warm/cold accent colors from album covers.

function rgbToHsl(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
  }

  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

function hslToHex(h, s, l) {
  const hue = ((h % 360) + 360) % 360;
  l /= 100;
  const a = (s * Math.min(l, 1 - l)) / 100;
  const f = (n) => {
    const k = (n + hue / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

function hexToHsl(hex) {
  let value = String(hex || '').replace(/^#/, '');
  if (value.length === 3) value = value.split('').map(ch => ch + ch).join('');
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return rgbToHsl(r, g, b);
}

function hslDistance(a, b) {
  const diff = Math.abs(a - b);
  return Math.min(diff, 360 - diff);
}

function normalizeAccent(hex, targetL = 56) {
  const hsl = hexToHsl(hex);
  const s = Math.max(52, Math.min(88, hsl.s));
  const l = Math.max(45, Math.min(68, targetL || hsl.l));
  return hslToHex(hsl.h, s, l);
}

function scoreSample(sample, preferredHue, fallbackWeight = 0) {
  const { h, s, l } = sample.hsl;
  if (l < 14 || l > 88 || s < 8) return -1;
  const hueScore = Math.max(0, 1 - hslDistance(h, preferredHue) / 130);
  const saturationScore = Math.min(1, s / 70);
  const lightScore = 1 - Math.abs(l - 54) / 54;
  return hueScore * 1.8 + saturationScore * 0.8 + lightScore * 0.45 + sample.count * fallbackWeight;
}

function buildAccentFromDominant(dominant, hueShift, lightness) {
  const hsl = hexToHsl(dominant);
  const hue = hsl.s < 10 ? hueShift : hsl.h + hueShift;
  return hslToHex(hue, Math.max(55, Math.min(82, hsl.s + 8)), lightness);
}

function extractSamples(imageData) {
  const buckets = new Map();
  for (let i = 0; i < imageData.length; i += 16) {
    const r = imageData[i];
    const g = imageData[i + 1];
    const b = imageData[i + 2];
    const a = imageData[i + 3];
    if (a < 180) continue;

    const hsl = rgbToHsl(r, g, b);
    if (hsl.l < 8 || hsl.l > 94) continue;

    const key = `${Math.round(r / 18)}-${Math.round(g / 18)}-${Math.round(b / 18)}`;
    const item = buckets.get(key) || { r: 0, g: 0, b: 0, count: 0 };
    item.r += r;
    item.g += g;
    item.b += b;
    item.count += 1;
    buckets.set(key, item);
  }

  return Array.from(buckets.values()).map(item => {
    const r = Math.round(item.r / item.count);
    const g = Math.round(item.g / item.count);
    const b = Math.round(item.b / item.count);
    const hsl = rgbToHsl(r, g, b);
    return { r, g, b, count: item.count, hsl, hex: hslToHex(hsl.h, hsl.s, hsl.l) };
  }).sort((a, b) => b.count - a.count);
}

export const extractWarmColdColors = async (imageUrl) => new Promise((resolve) => {
  const fallback = { warm: '#ff6b6b', cold: '#3399ff', dominant: '#ff4081' };
  if (!imageUrl) {
    resolve(fallback);
    return;
  }

  let settled = false;
  const done = (colors) => {
    if (settled) return;
    settled = true;
    resolve(colors);
  };

  const img = new Image();
  const timeoutId = window.setTimeout(() => {
    img.src = '';
    done(fallback);
  }, 3000);

  img.crossOrigin = 'anonymous';
  img.onload = () => {
    window.clearTimeout(timeoutId);
    try {
      const size = 48;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) throw new Error('No canvas context');

      ctx.drawImage(img, 0, 0, size, size);
      const samples = extractSamples(ctx.getImageData(0, 0, size, size).data);
      if (!samples.length) throw new Error('No valid color samples');

      const dominantSample = samples.find(sample => sample.hsl.s > 10) || samples[0];
      const dominant = normalizeAccent(dominantSample.hex, 54);
      const weighted = samples.slice(0, 24);

      const warmCandidate = weighted
        .map(sample => ({ sample, score: scoreSample(sample, 28, 0.012) }))
        .sort((a, b) => b.score - a.score)[0];
      const coldCandidate = weighted
        .map(sample => ({ sample, score: scoreSample(sample, 205, 0.012) }))
        .sort((a, b) => b.score - a.score)[0];

      const warm = warmCandidate && warmCandidate.score > 0.55
        ? normalizeAccent(warmCandidate.sample.hex, 55)
        : normalizeAccent(buildAccentFromDominant(dominant, 18, 55), 55);
      const cold = coldCandidate && coldCandidate.score > 0.55
        ? normalizeAccent(coldCandidate.sample.hex, 58)
        : normalizeAccent(buildAccentFromDominant(dominant, 150, 58), 58);

      done({ warm, cold, dominant });
    } catch (err) {
      console.warn('Failed to extract warm/cold colors, using fallbacks.', err);
      done(fallback);
    }
  };

  img.onerror = () => {
    window.clearTimeout(timeoutId);
    done(fallback);
  };

  img.src = imageUrl;
});
