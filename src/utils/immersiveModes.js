// 单一模式目录：设置页只负责选择，具体渲染由各模式组件负责。
const MODE_DESCRIPTIONS = {
  regular: '将正在播放的歌词稳定对齐到封面中心，适合长时间阅读。',
  talk: '以逐字填充、构图切换和前后句残影呈现整首歌的文字 PV。',
  streamer: '把歌词变成流动气泡，适合节奏明显、氛围感强的歌曲。',
  cloudstep: '歌词以阶梯式布局展开，适合观察上下句的关系。',
  spatial: '将歌词放入全屏空间画布，强调景深和空间移动。',
  vinyl: '以唱片旋转为视觉核心，适合复古或器乐类歌曲。',
  filmstrip: '歌词以电影胶片帧呈现，当前句像镜头一样被聚焦。'
  // spotlight: '当前歌词像舞台聚光灯一样突出，上下句柔和退场。',
  // starfield: '星点和歌词形成缓慢星轨，适合夜晚或氛围音乐。',
  // inkflow: '背景墨迹随歌词呼吸扩散，适合中文和抒情歌曲。'
};

export const IMMERSIVE_MODE_OPTIONS = [
  { value: 'regular', label: '常规滚动' },
  { value: 'talk', label: 'KTV · 文字 PV' },
  { value: 'streamer', label: '气泡模式' },
  { value: 'cloudstep', label: '云阶模式' },
  { value: 'spatial', label: '空间画布' },
  { value: 'vinyl', label: '黑胶光碟' },
  { value: 'filmstrip', label: '胶片模式' }
  // { value: 'spotlight', label: '聚光灯舞台' },
  // { value: 'starfield', label: '星轨模式' },
  // { value: 'inkflow', label: '水墨流动' }
].map(item => ({ ...item, description: MODE_DESCRIPTIONS[item.value] }));

export const IMMERSIVE_MODE_PARAMETER_KEYS = {
  regular: ['ringStyle', 'ringBarCount', 'ringMaxAmplitude', 'ringInnerOffset', 'ringLineWidth', 'ringColorMode', 'ringRotationSpeed', 'ringRotationBeatSync', 'ringGlowIntensity', 'ringGlowPulse', 'ringSmoothing', 'ringTrailDecay', 'ringOpacity'],
  talk: ['ktvPreset', 'ktvPresetPool', 'ktvSongTemplates', 'ktvTextEffect', 'ktvBackdrop', 'ktvComposition', 'ktvMotion', 'ktvCameraZoom', 'ktvCameraTilt', 'ktvCameraShake', 'ktvRenderQuality', 'ktvAccent', 'ktvCustomColor', 'ktvShowTranslation', 'ktvUseCoverTexture', 'ktvBeatReactive', 'ktvPreviewEnabled', 'ktvShowTitleCard', 'ktvShowLyricIndex'],
  streamer: ['streamerBarHeight', 'streamerBarMaxHeight', 'streamerBarOpacity', 'streamerBarGlowSpread', 'streamerBarFlowSpeed', 'streamerBarColorMode', 'streamerBarCustomColor', 'streamerBarSmoothing', 'bubbleAlign'],
  cloudstep: ['cloudWaveBlur', 'cloudWaveHeight', 'cloudWaveOpacity', 'cloudWaveSmoothing', 'cloudWaveColorMode', 'cloudWaveCustomColor', 'cloudWaveVerticalSpread', 'cloudWaveSyncToLines', 'cloudStepSpacing'],
  spatial: ['spatialParticleCount', 'spatialParticleSize', 'spatialParticleOpacity', 'spatialSpreadX', 'spatialSpreadY', 'spatialSpreadZ', 'spatialConnectLines', 'spatialConnectOpacity', 'spatialColorMode', 'spatialCustomColor', 'spatialDepthBlur'],
  vinyl: ['vinylGrooveCount', 'vinylGrooveWidth', 'vinylGrooveMaxWidth', 'vinylGrooveOpacity', 'vinylGrooveColorMode', 'vinylStylusGlowStrength', 'vinylStylusGlowSize', 'vinylEdgeReflection', 'vinylEdgeReflectionIntensity', 'vinylSmoothing', 'vinylTiltAngle', 'vinylLineSpacing'],
  filmstrip: ['filmFrameGap', 'filmOpacity', 'filmActiveScale', 'filmShowTranslation'],
  // spotlight: ['spotlightLineGap', 'spotlightDimOpacity', 'spotlightScale', 'spotlightShowTranslation', 'spotlightShowGlow', 'spotlightEffect', 'spotlightMotion'],
  // starfield: ['starDensity', 'starSpeed', 'starDepth', 'starShowTranslation'],
  // inkflow: ['inkSpread', 'inkOpacity', 'inkSpeed', 'inkShowTranslation'],
  universalVisualizer: ['visualizerEnabled', 'visualizerStyle', 'visualizerStyleByMode', 'visualizerIntensity', 'visualizerOpacity', 'visualizerSmoothing', 'visualizerOffsetY', 'visualizerScale']
};

export const IMMERSIVE_MODE_IDS = IMMERSIVE_MODE_OPTIONS.map(item => item.value);
export const normalizeImmersiveMode = (value) => IMMERSIVE_MODE_IDS.includes(value) ? value : 'regular';

// “跟随模式”不是通用的底部柱状图，而是为每种沉浸模式选择一套专属的视觉语言。
// 保留 bars/wave/circle/off 作为用户手动覆盖项，只有 mode 才会走下面的专属实现。
export const DEFAULT_VISUALIZER_BY_MODE = {
  regular: 'circle',
  talk: 'mode',
  streamer: 'bars',
  cloudstep: 'wave',
  spatial: 'mode',
  vinyl: 'circle',
  filmstrip: 'filmstrip'
  // spotlight: 'spotlight',
  // starfield: 'starfield',
  // inkflow: 'inkflow'
};

export function getVisualizerStyleForMode(config = {}, mode = 'regular') {
  const normalized = normalizeImmersiveMode(mode);
  if (config?.visualizerEnabled === false) return 'off';
  const explicit = config?.visualizerStyleByMode?.[normalized];
  const hasDedicatedRenderer = ['filmstrip'].includes(normalized);
  // 1.8.0 之前这些模式经常把 bars 写入逐模式配置，导致升级后四个
  // 模式看起来完全一样。把这个旧默认值升级为专属渲染；wave/circle/off
  // 仍然保留为真正的手动覆盖。
  if (explicit && !(hasDedicatedRenderer && explicit === 'bars')) return explicit;
  // bars 是旧版本的全局默认值。没有逐模式设置时将其解释为“跟随模式”，
  // 避免升级后所有新模式继续渲染成同一条底部柱状图。
  if (!config?.visualizerStyle || config.visualizerStyle === 'bars' || config.visualizerStyle === 'mode') {
    return DEFAULT_VISUALIZER_BY_MODE[normalized] || 'bars';
  }
  return config.visualizerStyle;
}




