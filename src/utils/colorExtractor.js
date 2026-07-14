// colorExtractor.js - Extract warm and cold colors from cover images

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;

  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100)
  };
}

function hslToHex(h, s, l) {
  l /= 100;
  const a = (s * Math.min(l, 1 - l)) / 100;
  const f = n => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

function getHueDistance(a, b) {
  const diff = Math.abs(a - b);
  return Math.min(diff, 360 - diff);
}

// Convert a hex color string to HSL
function hexToHsl(hex) {
  hex = hex.replace(/^#/, '');
  if (hex.length === 3) {
    hex = hex.split('').map(x => x + x).join('');
  }
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return rgbToHsl(r, g, b);
}

// Normalize color: ensure it is neither too dark/muddy nor too bright
function normalizeColor(hex, targetL = 52) {
  try {
    const hsl = hexToHsl(hex);
    // Ensure saturation is healthy (vibrant but not burning)
    const s = Math.max(65, Math.min(90, hsl.s));
    // Lightness should be suitable for a dark/immersive overlay
    const l = Math.max(45, Math.min(68, hsl.l));
    return hslToHex(hsl.h, s, l);
  } catch (e) {
    return hex;
  }
}

export const extractWarmColdColors = async (imageUrl) => {
  return new Promise((resolve) => {
    if (!imageUrl) {
      resolve({
        warm: '#ff4081', // strawberry fallback
        cold: '#00b0ff', // ocean fallback
        dominant: '#ff4081'
      });
      return;
    }

    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.src = imageUrl;

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) {
          throw new Error('No canvas context');
        }

        const size = 40;
        canvas.width = size;
        canvas.height = size;
        ctx.drawImage(img, 0, 0, size, size);

        const imgData = ctx.getImageData(0, 0, size, size).data;
        const colorSamples = [];

        // Sample pixels
        for (let i = 0; i < imgData.length; i += 16) {
          const r = imgData[i];
          const g = imgData[i + 1];
          const b = imgData[i + 2];
          const a = imgData[i + 3];

          if (a < 180) continue; // ignore transparent pixels

          const hsl = rgbToHsl(r, g, b);
          colorSamples.push({ r, g, b, hsl, hex: hslToHex(hsl.h, hsl.s, hsl.l) });
        }

        if (colorSamples.length === 0) {
          throw new Error('No valid color samples');
        }

        // Group into distinct clusters/colors
        const distinctColors = [];
        const minDistance = 25;

        for (const sample of colorSamples) {
          const isDistinct = distinctColors.every(dc => {
            const d = Math.sqrt(
              Math.pow(sample.r - dc.r, 2) +
              Math.pow(sample.g - dc.g, 2) +
              Math.pow(sample.b - dc.b, 2)
            );
            return d > minDistance;
          });
          if (isDistinct || distinctColors.length === 0) {
            distinctColors.push(sample);
            if (distinctColors.length >= 10) break;
          }
        }

        // Find dominant color
        const dominant = distinctColors[0]?.hex || '#ff4081';

        // Filter and score colors for warmth/coldness
        let bestWarm = null;
        let bestWarmScore = -1;
        let bestCold = null;
        let bestColdScore = -1;

        // Take top 30 colors to evaluate
        const topColors = sortedColors.slice(0, 30).map(hex => ({
          hex,
          hsl: hexToHsl(hex)
        }));

        topColors.forEach(c => {
          const { h, s, l } = c.hsl;
          // Warm score: closer to Hue = 25 (Orange/Red)
          const distWarm = getHueDistance(h, 25);
          const warmScore = Math.max(0, 1 - distWarm / 100) * (s / 100);
          if (warmScore > bestWarmScore && l > 20 && l < 85) {
            bestWarmScore = warmScore;
            bestWarm = c.hex;
          }

          // Cold score: closer to Hue = 210 (Cyan/Blue)
          const distCold = getHueDistance(h, 210);
          const coldScore = Math.max(0, 1 - distCold / 100) * (s / 100);
          if (coldScore > bestColdScore && l > 20 && l < 85) {
            bestColdScore = coldScore;
            bestCold = c.hex;
          }
        });

        // Resolve warm color (fallback if none found or grayscale cover)
        let resolvedWarm = bestWarm;
        if (!resolvedWarm) {
          const baseHsl = hexToHsl(dominant);
          if (baseHsl.s < 12) {
            resolvedWarm = '#ff6b6b'; // fallback red
          } else {
            // Shift to warm hue (e.g. 20)
            resolvedWarm = hslToHex(20, Math.max(75, baseHsl.s), 52);
          }
        } else {
          resolvedWarm = normalizeColor(resolvedWarm, 52);
        }

        // Resolve cold color (fallback if none found or grayscale cover)
        let resolvedCold = bestCold;
        if (!resolvedCold) {
          const baseHsl = hexToHsl(dominant);
          if (baseHsl.s < 12) {
            resolvedCold = '#3399ff'; // fallback blue
          } else {
            // Shift to cold hue (e.g. 210)
            resolvedCold = hslToHex(210, Math.max(75, baseHsl.s), 56);
          }
        } else {
          resolvedCold = normalizeColor(resolvedCold, 56);
        }

        resolve({
          warm: resolvedWarm,
          cold: resolvedCold,
          dominant: normalizeColor(dominant, 52)
        });
      } catch (err) {
        console.warn('Failed to extract warm/cold colors, using fallbacks.', err);
        resolve({
          warm: '#ff6b6b',
          cold: '#3399ff',
          dominant: '#ff4081'
        });
      }
    };

    img.onerror = () => {
      clearTimeout(timeoutId);
      resolve({
        warm: '#ff6b6b',
        cold: '#3399ff',
        dominant: '#ff4081'
      });
    };

    // Add a 3 second timeout in case the URL hangs (e.g. expired Netease token)
    timeoutId = setTimeout(() => {
      console.warn('Color extraction timed out for', coverUrl);
      img.src = '';
      resolve({
        warm: '#ff6b6b',
        cold: '#3399ff',
        dominant: '#ff4081'
      });
    }, 3000);

    img.src = coverUrl;
  });
};
