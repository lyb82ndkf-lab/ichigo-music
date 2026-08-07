import { DEFAULT_PROFILE } from '../src/utils/settingsProfile.js';
import { IMMERSIVE_MODE_IDS, IMMERSIVE_MODE_PARAMETER_KEYS, normalizeImmersiveMode } from '../src/utils/immersiveModes.js';
import { IMMERSIVE_PRESETS } from '../src/utils/immersivePresets.js';

const fail = (message) => {
  throw new Error(`[immersive-config] ${message}`);
};

if (new Set(IMMERSIVE_MODE_IDS).size !== IMMERSIVE_MODE_IDS.length) fail('mode ids must be unique');
for (const mode of IMMERSIVE_MODE_IDS) {
  const keys = IMMERSIVE_MODE_PARAMETER_KEYS[mode];
  if (!Array.isArray(keys)) fail(`missing parameter metadata for ${mode}`);
  for (const key of keys) {
    if (!(key in DEFAULT_PROFILE.immersiveLyrics)) fail(`${mode}.${key} has no default value`);
  }
}

const presetKeys = new Set(['showGlow', 'fade', 'scale', 'showDecor', 'wordSweepFps', 'backgroundBlur', 'backgroundDarken']);
for (const preset of IMMERSIVE_PRESETS) {
  if (!preset.value || !preset.label || !preset.description) fail('preset metadata is incomplete');
  for (const key of Object.keys(preset.values)) {
    if (!presetKeys.has(key)) fail(`preset ${preset.value} writes unsupported key ${key}`);
  }
}

if (normalizeImmersiveMode('__unknown__') !== 'regular') fail('unknown mode fallback must be regular');
console.log(`[immersive-config] OK: ${IMMERSIVE_MODE_IDS.length} modes, ${IMMERSIVE_PRESETS.length} presets`);
