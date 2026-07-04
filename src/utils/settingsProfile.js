const PROFILE_KEY = 'ichigomusic_profile_v2';
const PROFILE_VERSION = 2;

const LEGACY_KEYS = [
  'ichigo_quality',
  'ichigo_progress',
  'ichigo_duration',
  'ichigo_current_song',
  'ichigo_playlist',
  'ichigo_playlist_index',
  'ichigo_volume',
  'ichigo_playmode',
  'ichigo_layout_mode',
  'ichigo_colormode',
  'ichigo_theme',
  'ichigo_custom_colors',
  'ichigo_navbar_config',
  'ichigo_lyric_style',
  'ichigo_visualizer_mode',
  'ichigo_appearance_config',
  'ichigo_cover_config',
  'ichigo_background_config',
  'ichigo_advanced_lyric_config',
  'ichigo_visualizer_config',
  'ichigo_desktop_lyrics_config',
  'ichigo_desktop_lyrics_x',
  'ichigo_desktop_lyrics_y',
  'ichigo_recently_played'
];

export const EQ_PRESETS = {
  none: { '32': 0, '64': 0, '125': 0, '250': 0, '500': 0, '1k': 0, '2k': 0, '4k': 0, '8k': 0, '16k': 0 },
  pop: { '32': -1, '64': 2, '125': 4, '250': 3, '500': 0, '1k': -1, '2k': 2, '4k': 4, '8k': 3, '16k': 1 },
  rock: { '32': 5, '64': 4, '125': 2, '250': -1, '500': -2, '1k': 1, '2k': 3, '4k': 5, '8k': 4, '16k': 2 },
  jazz: { '32': 2, '64': 3, '125': 1, '250': 2, '500': -1, '1k': -1, '2k': 1, '4k': 3, '8k': 4, '16k': 3 },
  classical: { '32': 3, '64': 2, '125': 1, '250': 0, '500': 0, '1k': 0, '2k': 1, '4k': 2, '8k': 3, '16k': 4 },
  electronic: { '32': 6, '64': 5, '125': 2, '250': 0, '500': -2, '1k': 0, '2k': 1, '4k': 3, '8k': 5, '16k': 4 },
  hiphop: { '32': 6, '64': 5, '125': 4, '250': 2, '500': -1, '1k': -1, '2k': 1, '4k': 2, '8k': 3, '16k': 2 }
};

const DEFAULT_BANDS = EQ_PRESETS.none;

const CANONICAL_NAV_NAMES = {
  discover: '发现音乐',
  search: '搜索音乐',
  leaderboards: '排行榜',
  liked: '我喜欢的音乐',
  recent: '最近播放',
  settings: '设置'
};

function isCorruptedText(value) {
  return typeof value !== 'string' || !value.trim() || /[?]{2,}|[\uFFFD]/.test(value);
}

export const DEFAULT_PROFILE = {
  version: PROFILE_VERSION,

  theme: 'strawberry',
  colorMode: 'dark',
  layoutMode: 'classic',

  customTheme: {
    primary: '#ff4081',
    bgStart: '#120c1f',
    bgEnd: '#05020a'
  },

  navbarItems: [
    { key: 'discover', name: '发现音乐', show: true },
    { key: 'search', name: '搜索音乐', show: true },
    { key: 'leaderboards', name: '排行榜', show: true },
    { key: 'liked', name: '我喜欢的音乐', show: true },
    { key: 'recent', name: '最近播放', show: true },
    { key: 'settings', name: '设置', show: true }
  ],

  lyricStyle: {
    fontFamily: 'var(--font-title)',
    fontSize: '1.5rem',
    color: 'var(--text-muted)',
    activeColor: 'var(--primary)',
    showTranslation: true,
    alignment: 'center'
  },

  appearance: {
    display: 'all',
    immersiveTheme: 'vivid',
    textShadow: true,
    textGlow: true,
    autoHideBottomBar: false,
    progressBarBottom: false
  },

  desktopLyrics: {
    show: false,
    locked: true,
    fontSize: 36,
    fontFamily: 'Inter',
    fontWeight: 700,
    bold: true,
    alignment: 'center',
    lineCount: 3,
    showTranslation: true,
    translationSize: 22,
    playedColor: '#ff3366',
    unplayedColor: '#ffffff',
    playedColorMode: 'preset',
    unplayedColorMode: 'preset',
    color: 'theme',
    textStroke: { enabled: false, width: 0.5, color: '#000000' },
    textShadow: { enabled: true, color: '#ff336680', blur: 12, offsetX: 0, offsetY: 0 },
    glow: { enabled: false, intensity: 0.6 },
    windowX: null,
    windowY: null,
    alwaysOnTop: true,
    opacity: 1
  },

  immersiveLyrics: {
    alignment: 'center',
    fontSize: 28,
    translationSize: 18,
    visibleLines: 5,
    position: 'center',
    animationCurve: 'smooth',
    fade: true,
    scale: true,
    blur: false,
    rotation: false,
    showGlow: false,
    longNoteGlow: false,
    showCover: true,
    backgroundMode: 'cover',
    backgroundBlur: 32,
    backgroundDarken: 50,
    visualizerStyle: 'bars',
    globalOffset: 0,
    inactiveLyricBlur: 0.8,
    showDecor: false,
    wordSweepFps: 60,
    boldFirstLine: true,
    rubySize: 14,
    wordAnimation: 'float',
    staggeredScroll: true,
    fontFamily: 'Inter',
    titleFontFamily: 'Outfit',
    lyricsPositionY: 42,
    showTranslation: true,
    animationMode: 'regular',
    colorPreference: 'warm'
  },

  cover: {
    showCover: true,
    horizontalAlign: 'center',
    verticalAlign: 'center',
    squareCover: true,
    resolution: 400,
    coverResolution: 400,
    shadow: true,
    coverShadow: true
  },

  background: {
    bgType: 'fluid',
    blurAmount: 40,
    darkenAmount: 50
  },

  visualizer: {
    mode: 'circular',
    style: 'circular',
    color: 'var(--primary)',
    rotation: true
  },

  audio: {
    quality: 'exhigh',
    volume: 0.8,
    muted: false,
    equalizer: {
      enabled: false,
      preset: 'none',
      bands: DEFAULT_BANDS
    },
    reverb: {
      enabled: false,
      preset: 'none',
      mix: 0.3,
      decay: 1.5
    },
    compressor: {
      enabled: false,
      threshold: -24,
      ratio: 4,
      attack: 5,
      release: 50,
      makeupGain: 0
    },
    spatial: {
      enabled: false,
      mode: 'stereo',
      crossfeedAmount: 0.3
    }
  },

  playback: {
    playMode: 'sequence',
    gaplessPlayback: true,
    autoPlayOnStart: true,
    resumeOnStart: true,
    fadeOnPause: true,
    fadeDuration: 300,
    crossfade: false,
    crossfadeDuration: 2000
  },

  rendering: {
    audioBackend: 'web audio',
    decoderMode: 'auto',
    sampleRate: 0,
    bufferSize: 0,
    latencyHint: 'interactive',
    visualizerFps: 30,
    hardwareAcceleration: true
  },

  shortcuts: {
    playPause: 'Space',
    nextTrack: 'ControlRight',
    prevTrack: 'ControlLeft',
    volumeUp: 'ControlUp',
    volumeDown: 'ControlDown',
    toggleMute: 'KeyM',
    toggleLyrics: 'KeyL',
    toggleDesktopLyrics: 'ControlL',
    toggleSearch: 'KeyF',
    seekForward: 'ArrowRight',
    seekBack: 'ArrowLeft',
    likeTrack: 'ControlH',
    cyclePlayMode: 'KeyR',
    goHome: 'ControlD'
  },

  account: {
    provider: null,
    userId: null,
    nickname: null,
    avatarUrl: null,
    lastLoginAt: null
  },

  lastSession: {
    currentSong: null,
    playlist: [],
    playlistIndex: -1,
    progress: 0,
    duration: 0,
    resumeTime: null
  },

  recentlyPlayed: []
};

function hasStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function safeJsonParse(value, fallback) {
  try {
    if (value === null || value === undefined || value === '') return fallback;
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function readLegacyValue(key, fallback = null) {
  if (!hasStorage()) return fallback;
  const raw = window.localStorage.getItem(key);
  return raw === null ? fallback : raw;
}

function readLegacyJson(key, fallback) {
  return safeJsonParse(readLegacyValue(key), fallback);
}

export function deepMerge(target = {}, source = {}) {
  const base = Array.isArray(target) ? [...target] : { ...target };
  if (!source || typeof source !== 'object') return base;

  for (const key of Object.keys(source)) {
    const sourceValue = source[key];
    const targetValue = base[key];

    if (Array.isArray(sourceValue)) {
      base[key] = sourceValue.map(item => (item && typeof item === 'object' ? deepMerge({}, item) : item));
    } else if (sourceValue && typeof sourceValue === 'object') {
      base[key] = deepMerge(
        targetValue && typeof targetValue === 'object' && !Array.isArray(targetValue) ? targetValue : {},
        sourceValue
      );
    } else {
      base[key] = sourceValue;
    }
  }
  return base;
}

function migrateLegacyLocalStorage() {
  const migrated = clone(DEFAULT_PROFILE);

  migrated.audio.quality = readLegacyValue('ichigo_quality', migrated.audio.quality);
  migrated.audio.volume = Number(readLegacyValue('ichigo_volume', migrated.audio.volume)) || migrated.audio.volume;
  migrated.playback.playMode = readLegacyValue('ichigo_playmode', migrated.playback.playMode);
  migrated.lastSession.progress = Number(readLegacyValue('ichigo_progress', migrated.lastSession.progress)) || 0;
  migrated.lastSession.duration = Number(readLegacyValue('ichigo_duration', migrated.lastSession.duration)) || 0;
  migrated.lastSession.resumeTime = migrated.lastSession.progress || null;
  migrated.lastSession.currentSong = readLegacyJson('ichigo_current_song', migrated.lastSession.currentSong);
  migrated.lastSession.playlist = readLegacyJson('ichigo_playlist', migrated.lastSession.playlist);
  migrated.lastSession.playlistIndex = Number(readLegacyValue('ichigo_playlist_index', migrated.lastSession.playlistIndex));
  if (!Number.isFinite(migrated.lastSession.playlistIndex)) migrated.lastSession.playlistIndex = -1;

  migrated.layoutMode = readLegacyValue('ichigo_layout_mode', migrated.layoutMode);
  migrated.colorMode = readLegacyValue('ichigo_colormode', migrated.colorMode);
  migrated.theme = readLegacyValue('ichigo_theme', migrated.theme);
  migrated.customTheme = readLegacyJson('ichigo_custom_colors', migrated.customTheme);
  migrated.navbarItems = readLegacyJson('ichigo_navbar_config', migrated.navbarItems);
  migrated.lyricStyle = readLegacyJson('ichigo_lyric_style', migrated.lyricStyle);
  migrated.visualizer.mode = readLegacyValue('ichigo_visualizer_mode', migrated.visualizer.mode);
  migrated.appearance = readLegacyJson('ichigo_appearance_config', migrated.appearance);
  migrated.cover = readLegacyJson('ichigo_cover_config', migrated.cover);
  migrated.background = readLegacyJson('ichigo_background_config', migrated.background);
  migrated.immersiveLyrics = readLegacyJson('ichigo_advanced_lyric_config', migrated.immersiveLyrics);
  migrated.visualizer = deepMerge(migrated.visualizer, readLegacyJson('ichigo_visualizer_config', migrated.visualizer));
  migrated.desktopLyrics = readLegacyJson('ichigo_desktop_lyrics_config', migrated.desktopLyrics);

  const legacyX = readLegacyValue('ichigo_desktop_lyrics_x');
  const legacyY = readLegacyValue('ichigo_desktop_lyrics_y');
  if (legacyX !== null) migrated.desktopLyrics.windowX = Number(legacyX);
  if (legacyY !== null) migrated.desktopLyrics.windowY = Number(legacyY);

  migrated.recentlyPlayed = readLegacyJson('ichigo_recently_played', migrated.recentlyPlayed);
  migrated.version = PROFILE_VERSION;
  return normalizeProfile(migrated);
}

function cleanupLegacyKeys() {
  if (!hasStorage()) return;
  LEGACY_KEYS.forEach(key => window.localStorage.removeItem(key));
  for (let i = window.localStorage.length - 1; i >= 0; i -= 1) {
    const key = window.localStorage.key(i);
    if (key?.startsWith('ichigo_') && key !== PROFILE_KEY) {
      window.localStorage.removeItem(key);
    }
  }
}

function normalizeProfile(profile) {
  const normalized = deepMerge(clone(DEFAULT_PROFILE), profile || {});
  normalized.version = PROFILE_VERSION;

  if (normalized.desktopLyrics.color && normalized.desktopLyrics.color !== 'theme') {
    normalized.desktopLyrics.playedColor = normalized.desktopLyrics.playedColor || normalized.desktopLyrics.color;
  }
  if (normalized.desktopLyrics.bold !== undefined && normalized.desktopLyrics.fontWeight === undefined) {
    normalized.desktopLyrics.fontWeight = normalized.desktopLyrics.bold ? 700 : 500;
  }

  normalized.cover.coverResolution = normalized.cover.coverResolution || normalized.cover.resolution;
  normalized.cover.resolution = normalized.cover.resolution || normalized.cover.coverResolution;
  normalized.cover.coverShadow = normalized.cover.coverShadow ?? normalized.cover.shadow;
  normalized.cover.shadow = normalized.cover.shadow ?? normalized.cover.coverShadow;

  normalized.visualizer.mode = normalized.visualizer.mode || normalized.visualizer.style || 'circular';
  normalized.visualizer.style = normalized.visualizer.style || normalized.visualizer.mode || 'circular';

  normalized.navbarItems = (Array.isArray(normalized.navbarItems) ? normalized.navbarItems : DEFAULT_PROFILE.navbarItems)
    .map((item) => ({
      ...item,
      name: CANONICAL_NAV_NAMES[item?.key] || item.name
    }));

  return normalized;
}

function migrateProfile(stored, fromVersion = 1) {
  let migrated = deepMerge(clone(DEFAULT_PROFILE), stored || {});

  if (fromVersion < 2) {
    migrated.desktopLyrics = deepMerge(DEFAULT_PROFILE.desktopLyrics, migrated.desktopLyrics || {});
    migrated.audio = deepMerge(DEFAULT_PROFILE.audio, migrated.audio || {});
    migrated.shortcuts = deepMerge(DEFAULT_PROFILE.shortcuts, migrated.shortcuts || {});
    migrated.rendering = deepMerge(DEFAULT_PROFILE.rendering, migrated.rendering || {});
  }

  return normalizeProfile(migrated);
}

export function loadProfile() {
  if (!hasStorage()) return clone(DEFAULT_PROFILE);

  try {
    const raw = window.localStorage.getItem(PROFILE_KEY);
    if (!raw) {
      const migrated = migrateLegacyLocalStorage();
      window.localStorage.setItem(PROFILE_KEY, JSON.stringify(migrated));
      cleanupLegacyKeys();
      return migrated;
    }

    const stored = JSON.parse(raw);
    const loaded = stored.version < PROFILE_VERSION
      ? migrateProfile(stored, stored.version, PROFILE_VERSION)
      : normalizeProfile(stored);

    window.localStorage.setItem(PROFILE_KEY, JSON.stringify(loaded));
    cleanupLegacyKeys();
    return loaded;
  } catch (error) {
    console.warn('Failed to load ichigomusic profile, falling back to defaults:', error);
    return clone(DEFAULT_PROFILE);
  }
}

export function saveProfile(partialOrProfile) {
  if (!hasStorage()) return normalizeProfile(partialOrProfile);

  const current = loadProfile();
  const merged = normalizeProfile(deepMerge(current, partialOrProfile || {}));
  window.localStorage.setItem(PROFILE_KEY, JSON.stringify(merged));
  cleanupLegacyKeys();
  return merged;
}

export function writeProfile(profile) {
  if (!hasStorage()) return normalizeProfile(profile);
  const normalized = normalizeProfile(profile);
  window.localStorage.setItem(PROFILE_KEY, JSON.stringify(normalized));
  cleanupLegacyKeys();
  return normalized;
}

export function exportProfile() {
  const profile = loadProfile();
  const blob = new Blob([JSON.stringify(profile, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ichigomusic-profile-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function importProfile(jsonStr) {
  const imported = typeof jsonStr === 'string' ? JSON.parse(jsonStr) : jsonStr;
  const safe = clone(DEFAULT_PROFILE);
  Object.keys(safe).forEach(key => {
    if (Object.prototype.hasOwnProperty.call(imported, key)) {
      safe[key] = imported[key];
    }
  });
  return writeProfile(safe);
}

export function resetProfile() {
  if (!hasStorage()) return clone(DEFAULT_PROFILE);
  window.localStorage.removeItem(PROFILE_KEY);
  cleanupLegacyKeys();
  const defaults = clone(DEFAULT_PROFILE);
  window.localStorage.setItem(PROFILE_KEY, JSON.stringify(defaults));
  return defaults;
}

export function getProfileKey() {
  return PROFILE_KEY;
}

export function getProfileVersion() {
  return PROFILE_VERSION;
}
