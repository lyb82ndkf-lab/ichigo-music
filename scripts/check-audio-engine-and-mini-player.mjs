import fs from 'node:fs';
import path from 'node:path';
import {
  EQ_BAND_FREQUENCIES,
  EQ_BAND_LABELS,
  EQ_PRESETS,
  EQ_PRESET_NAMES,
  DEFAULT_PROFILE,
  loadProfile,
  saveProfile
} from '../src/utils/settingsProfile.js';

const root = process.cwd();

// 1. Verify 10 Equalizer Frequencies and Labels
const expectedFreqs = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
const expectedLabels = ['31Hz', '62Hz', '125Hz', '250Hz', '500Hz', '1kHz', '2kHz', '4kHz', '8kHz', '16kHz'];

if (JSON.stringify(EQ_BAND_FREQUENCIES) !== JSON.stringify(expectedFreqs)) {
  throw new Error(`EQ_BAND_FREQUENCIES mismatch: expected ${JSON.stringify(expectedFreqs)}, got ${JSON.stringify(EQ_BAND_FREQUENCIES)}`);
}

if (JSON.stringify(EQ_BAND_LABELS) !== JSON.stringify(expectedLabels)) {
  throw new Error(`EQ_BAND_LABELS mismatch: expected ${JSON.stringify(expectedLabels)}, got ${JSON.stringify(EQ_BAND_LABELS)}`);
}

// 2. Verify 12 Presets
const expectedPresets = [
  'none', 'pop', 'rock', 'dance', 'classical', 'vocalBoost',
  'bassBoost', 'pureTreble', 'jazz', 'hiphop', 'electronic', 'acoustic'
];

if (Object.keys(EQ_PRESETS).length < 12) {
  throw new Error(`Expected at least 12 presets, got ${Object.keys(EQ_PRESETS).length}`);
}

for (const key of expectedPresets) {
  if (!EQ_PRESETS[key]) {
    throw new Error(`Missing required preset: ${key}`);
  }
  if (!Array.isArray(EQ_PRESETS[key]) || EQ_PRESETS[key].length !== 10) {
    throw new Error(`Preset ${key} must have exactly 10 band values`);
  }
  for (const db of EQ_PRESETS[key]) {
    if (typeof db !== 'number' || db < -12 || db > 12) {
      throw new Error(`Preset ${key} contains invalid dB value: ${db} (must be between -12 and +12)`);
    }
  }
  if (!EQ_PRESET_NAMES[key]) {
    throw new Error(`Missing localized display name for preset: ${key}`);
  }
}

// 3. Verify AudioPlayer Equalizer and Crossfade Implementation
const audioPlayerSrc = fs.readFileSync(path.join(root, 'src/components/AudioPlayer.jsx'), 'utf8');

if (!audioPlayerSrc.includes('eqFiltersRef') || !audioPlayerSrc.includes('createBiquadFilter')) {
  throw new Error('AudioPlayer must construct Web Audio BiquadFilter nodes');
}

if (!audioPlayerSrc.includes('lowshelf') || !audioPlayerSrc.includes('highshelf') || !audioPlayerSrc.includes('peaking')) {
  throw new Error('AudioPlayer must configure lowshelf, highshelf, and peaking filters');
}

if (!audioPlayerSrc.includes('gainNodeRef') || !audioPlayerSrc.includes('crossfadeDur')) {
  throw new Error('AudioPlayer must support GainNode crossfade smooth mixing');
}

// 4. Verify EqualizerPanel and Settings Integration
const eqPanelSrc = fs.readFileSync(path.join(root, 'src/components/EqualizerPanel.jsx'), 'utf8');
const settingsSrc = fs.readFileSync(path.join(root, 'src/views/Settings.jsx'), 'utf8');

if (!eqPanelSrc.includes('canvasRef') || !eqPanelSrc.includes('requestAnimationFrame')) {
  throw new Error('EqualizerPanel must include real-time canvas spectrum and response curve visualizer');
}
if (!eqPanelSrc.includes('handleSaveCustomPreset') || !eqPanelSrc.includes('handleDeleteCustomPreset')) {
  throw new Error('EqualizerPanel must support saving and deleting custom presets');
}
if (!eqPanelSrc.includes('isLight') || !eqPanelSrc.includes('colorMode')) {
  throw new Error('EqualizerPanel must support dark and light theme adaptations');
}
if (!settingsSrc.includes('<EqualizerPanel')) {
  throw new Error('Settings.jsx must embed EqualizerPanel directly in Audio tab');
}

// 5. Verify Island Mini Player View and Controls
const miniPlayerSrc = fs.readFileSync(path.join(root, 'src/views/IslandMiniPlayer.jsx'), 'utf8');
if (!miniPlayerSrc.includes('mini-vinyl-disc') || !miniPlayerSrc.includes('rotate(')) {
  throw new Error('IslandMiniPlayer must include rotating vinyl disc and needle tonearm');
}
if (!miniPlayerSrc.includes('currentLyricLine') || !miniPlayerSrc.includes('handleTogglePlay')) {
  throw new Error('IslandMiniPlayer must include dynamic single-line lyrics and playback controls');
}
if (!miniPlayerSrc.includes('isLight') || !miniPlayerSrc.includes('colorMode')) {
  throw new Error('IslandMiniPlayer must adapt to dark and light mode');
}
if (!miniPlayerSrc.includes('transparent')) {
  throw new Error('IslandMiniPlayer must enforce transparent window background');
}

// 6. Verify IPC in main-electron.js and preload-electron.cjs
const mainElectronSrc = fs.readFileSync(path.join(root, 'main-electron.js'), 'utf8');
const preloadSrc = fs.readFileSync(path.join(root, 'preload-electron.cjs'), 'utf8');
if (!mainElectronSrc.includes('toggleMiniPlayer') || !mainElectronSrc.includes('miniPlayerWindow')) {
  throw new Error('main-electron.js must implement toggleMiniPlayer and miniPlayerWindow');
}
if (!mainElectronSrc.includes('mainWindow.hide()')) {
  throw new Error('main-electron.js must hide main window when mini player opens');
}
if (!preloadSrc.includes('toggleMiniPlayer') || !preloadSrc.includes('sendMiniPlayerUpdate') || !preloadSrc.includes('onMiniPlayerAction')) {
  throw new Error('preload-electron.cjs must expose mini player IPC APIs');
}

// 7. Verify Play Queue Auto-Scroll in MiniQueuePopover and PlayerBar
const miniQueueSrc = fs.readFileSync(path.join(root, 'src/components/MiniQueuePopover.jsx'), 'utf8');
const playerBarSrc = fs.readFileSync(path.join(root, 'src/components/PlayerBar.jsx'), 'utf8');

if (!miniQueueSrc.includes('scrollIntoView') || !miniQueueSrc.includes('activeItemRef')) {
  throw new Error('MiniQueuePopover must implement auto-scroll into view for current active song');
}

if (!playerBarSrc.includes('scrollIntoView') || !playerBarSrc.includes('activeQueueItemRef')) {
  throw new Error('PlayerBar queue drawer must implement auto-scroll into view for current active song');
}

console.log('✅ [check:audio-engine-and-mini-player] All Equalizer, Crossfade, Island Mini Player, and Play Queue auto-scroll checks passed successfully!');
