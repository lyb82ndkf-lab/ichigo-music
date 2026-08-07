// 只覆盖跨模式的沉浸参数；模式专属参数由各模式自己的设置和默认值管理。
export const IMMERSIVE_PRESETS = [
  {
    value: 'balanced',
    label: '均衡体验',
    description: '默认推荐，在流畅度和氛围效果之间保持平衡。',
    values: { showGlow: false, fade: true, scale: true, showDecor: true, wordSweepFps: 60, backgroundBlur: 32, backgroundDarken: 50 }
  },
  {
    value: 'cinematic',
    label: '影院氛围',
    description: '强化辉光、背景和装饰，适合大屏沉浸播放。',
    values: { showGlow: true, fade: true, scale: true, showDecor: true, wordSweepFps: 60, backgroundBlur: 44, backgroundDarken: 42 }
  },
  {
    value: 'performance',
    label: '流畅优先',
    description: '降低复杂效果和刷新频率，适合低配置设备。',
    values: { showGlow: false, fade: true, scale: false, showDecor: false, wordSweepFps: 30, backgroundBlur: 18, backgroundDarken: 64 }
  }
];

export const IMMERSIVE_PRESET_MAP = Object.fromEntries(IMMERSIVE_PRESETS.map(preset => [preset.value, preset]));




