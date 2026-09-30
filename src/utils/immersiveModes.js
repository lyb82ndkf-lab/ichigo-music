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

export const KTV_TEMPLATE_GALLERY = [
  ['auto', '自动匹配', 'linear-gradient(135deg, #4f46e5 0%, #ec4899 100%)', '智能推荐', '按封面智能选型', ['#4f46e5', '#ec4899', '#ffffff']],
  ['blueInk', '蓝色构成', 'linear-gradient(135deg, #d0defb 0%, #416be2 100%)', '现代建筑·几何线条', '横向建筑标尺与几何线框展开', ['#0a1931', '#416be2', '#ffffff']],
  ['ruler', '几何', 'linear-gradient(135deg, #2b220e 0%, #d89f28 100%)', '标尺构图·精准刻度', '坐标刻度与黄金比例几何', ['#1a150a', '#d89f28', '#ffffff']],
  ['rainCity', '黑客帝国', 'linear-gradient(135deg, #05260f 0%, #20b85a 100%)', '终端代码雨·字符解密', '荧光绿乱码实时解密与闪烁光标', ['#040804', '#20ff66', '#003b00']],
  ['yorushika', '错落文字', 'linear-gradient(135deg, #1b2636 0%, #7696c2 100%)', 'ヨルシカ·诗意错落', '微错落横排层级与黄昏浮尘', ['#141c26', '#7696c2', '#ffffff']],
  ['mono', '冷静反派', 'linear-gradient(135deg, #071732 0%, #205ae2 100%)', '冷调映画·深邃无边', '深蓝极夜与冷峻高对比字形', ['#071732', '#205ae2', '#ffffff']],
  ['sweetPink', '少女云朵', 'linear-gradient(135deg, #fff0f6 0%, #ff85b3 100%)', '棉花糖云·粉嫩少女', '梦幻草莓牛奶云朵与爱心星芒', ['#fff0f6', '#ff85b3', '#5c3349']],
  ['yozakura', '春日影', 'linear-gradient(135deg, #eef6fc 0%, #ffd0de 100%)', '秒速5厘米·春日落樱', '日系秒速5厘米晴空落樱与柔和水彩', ['#edf4fb', '#ffd0de', '#22384f']],
  ['popArt', '格子花边', 'linear-gradient(135deg, #ffc9dc 0%, #ff3b77 100%)', '波普艺术·漫画弹跳', '高饱和度半色调网点与粗描边弹跳', ['#ff3b77', '#ffde59', '#000000']],
  ['shinkuu', 'Fly Me to the Moon', 'linear-gradient(135deg, #050d1a 0%, #305890 100%)', '深空真空·月光金辉', '黑金星轨与优雅罗马衬线', ['#050d1a', '#66a6ff', '#ffffff']],
  ['kawaiPixel', 'Kawaii 像素', 'linear-gradient(135deg, #d3f3fa 0%, #f6b9cf 100%)', '8-bit点阵·复古打字机', '像素字体与阶梯跳跃打印', ['#fef0f5', '#ffb3d9', '#5a3a5a']],
  ['zasshi', '纸艺剪贴', 'linear-gradient(135deg, #ffe5d4 0%, #ff753a 100%)', '日系杂志·拼贴剪报', '胶带纸片撕裂与杂志排版', ['#ffe5d4', '#ff753a', '#222222']],
  ['p5', 'P5怪盗红黑', 'linear-gradient(135deg, #1f0000 0%, #ED1C24 100%)', '红黑贴纸·漫画盖章', 'Persona 5 风格粗边贴纸与盖章拍击', ['#d6001c', '#ffea00', '#111111']],
  ['cityPop', '都市蓝调', 'linear-gradient(135deg, #1a0b2e 0%, #ff2975 100%)', '80s复古·日落落日', 'City Pop 太阳与霓虹晚霞', ['#1a0b2e', '#ff2975', '#ffd319']],
  ['neonNight', '霓虹夜市', 'linear-gradient(135deg, #080811 0%, #ff2a6d 100%)', '灯管闪烁·赛博雨夜', '霓虹通电打火闪烁与透视地网', ['#080811', '#ff2a6d', '#00f0ff']],
  ['tasogare', '黄昏晚霞', 'linear-gradient(135deg, #1f1424 0%, #ff7e5f 100%)', '黄昏暮色·暖光渐变', '落日紫橙渐变与暮光粒子', ['#1f1424', '#ff7e5f', '#feb47b']],
  ['lemonSoda', '柠檬苏打', 'linear-gradient(135deg, #0e1e24 0%, #f5d847 100%)', '清爽气泡·夏日黄绿', '苏打上升气泡与柠檬明黄', ['#0e1e24', '#f5d847', '#50e3c2']],
  ['kiri', '晨雾迷朦', 'linear-gradient(135deg, #1c2024 0%, #8ea0a8 100%)', '薄雾轻拂·清冷意境', '雾气弥漫与空灵冷灰', ['#1c2024', '#8ea0a8', '#ffffff']],
  ['umi', '深海波澜', 'linear-gradient(135deg, #040e1a 0%, #20a0b0 100%)', '幽蓝深海·光影涟漪', '深海光柱与水流波动', ['#040e1a', '#20a0b0', '#00e5ff']],
  ['film', '复古胶片', 'linear-gradient(135deg, #1a1816 0%, #d8c4a0 100%)', '暖调噪点·老电影院', '复古胶片齿孔与暖黄颗粒', ['#1a1816', '#d8c4a0', '#ffffff']],
  ['battle', '战场冲击', 'linear-gradient(135deg, #1a1a1e 0%, #5577aa 100%)', '金属重装·战术目视', '机械蓝灰与重装装甲质感', ['#1a1a1e', '#5577aa', '#ffcc00']],
  ['cyber', '赛博矩阵', 'linear-gradient(135deg, #0a0e1a 0%, #00ccff 100%)', '全息数据·网格空间', '透视地网与数据监控视窗', ['#0a0e1a', '#00ccff', '#ff0055']],
  ['digitalImpression', '数字印象', 'linear-gradient(135deg, #0c1028 0%, #44ddaa 100%)', '数码波束·电波阵列', '数码声波柱与粒子流动', ['#0c1028', '#44ddaa', '#6c5ce7']],
  ['glitch', '故障艺术', 'linear-gradient(135deg, #0a0a0a 0%, #ff00ff 100%)', 'RGB色散·信号撕裂', '高频 RGB 通道位移与数码切片', ['#0a0a0a', '#00f0ff', '#ff003c']],
  ['holoScope', '全息目镜', 'linear-gradient(135deg, #0a0a14 0%, #00f0ff 100%)', '科幻准星·全息 HUD', '瞄准标线与全息扫描光环', ['#04121a', '#00d4ff', '#00ffcc']],
  ['silhouetteClean', '极简剪影', 'linear-gradient(135deg, #ffffff 0%, #333333 100%)', '宽银幕留白·纯粹电影', '2.35:1 电影遮罩与极简十字标', ['#0d0d0d', '#ffffff', '#888888']],
  ['evaAlert', 'EVA 警报', 'linear-gradient(135deg, #180a0e 0%, #ff1836 100%)', '红色蜂窝·紧急事态', '新世纪福音战士黑红高对比与战术封条', ['#180a0e', '#ff1836', '#ffffff']],
  ['cyberpunk2077', '赛博朋克 2077', 'linear-gradient(135deg, #080811 0%, #fcee0a 100%)', '夜之城·极速公路', '荧光黄与创伤小组青、透视公路与数码解密', ['#080811', '#fcee0a', '#00f0ff']],
  ['cinemaTeal', 'Custom 自定义', 'linear-gradient(135deg, #1d172e 0%, #5044dc 100%)', '青蓝电影·宽屏颗粒', '宽画幅青蓝电影感底图', ['#0b141c', '#79a8b8', '#d8c9a3']]
];

export const JIZURA_GALLERY_STYLES = [
  { key: 'paper', name: '纸墨残像', en: 'Paper', tag: '纸墨质感', desc: '粗糙纸纹 · 墨韵弥散 · 拼贴杂志', gradient: 'linear-gradient(135deg, #e8dfd5 0%, #a89887 100%)', textColor: '#1a1816', palette: ['#2b2b2b', '#c2a68c', '#efe6dd'] },
  { key: 'noir', name: '暗黑电影', en: 'Noir', tag: '宽幅光影', desc: '颗粒胶片 · 剧场质感 · 电影黑白', gradient: 'linear-gradient(135deg, #18181b 0%, #3f3f46 100%)', textColor: '#ffffff', palette: ['#ffffff', '#71717a', '#18181b'] },
  { key: 'sakura', name: '和风落樱', en: 'Sakura', tag: '浪漫诗意', desc: '樱瓣轻抚 · 水彩晕染 · 柔和春日', gradient: 'linear-gradient(135deg, #f43f5e 0%, #fda4af 100%)', textColor: '#ffffff', palette: ['#fff1f2', '#fb7185', '#9f1239'] },
  { key: 'ocean', name: '幽蓝深海', en: 'Ocean', tag: '波动流体', desc: '蔚蓝水纹 · 深海气泡 · 沉浸呼吸', gradient: 'linear-gradient(135deg, #0284c7 0%, #0c4a6e 100%)', textColor: '#ffffff', palette: ['#38bdf8', '#0284c7', '#0c4a6e'] },
  { key: 'sunset', name: '夕阳暮光', en: 'Sunset', tag: '黄金晚霞', desc: '暮色黄昏 · 暖色辉光 · 治愈微醺', gradient: 'linear-gradient(135deg, #f97316 0%, #db2777 100%)', textColor: '#ffffff', palette: ['#fde047', '#fb923c', '#be185d'] },
  { key: 'crimson', name: '深红数据', en: 'Crimson', tag: '高燃节拍', desc: '绯红机能 · 锐利冲击 · 极速变焦', gradient: 'linear-gradient(135deg, #dc2626 0%, #7f1d1d 100%)', textColor: '#ffffff', palette: ['#ffffff', '#ef4444', '#7f1d1d'] },
  { key: 'caution', name: '亮黄警戒', en: 'Caution', tag: '工业机能', desc: '警戒条纹 · 警示醒目 · 速度线条', gradient: 'linear-gradient(135deg, #eab308 0%, #ca8a04 100%)', textColor: '#1a150a', palette: ['#000000', '#facc15', '#422006'] },
  { key: 'hud', name: '极夜目镜', en: 'Dark HUD', tag: '战术全息', desc: '扫描瞄准 · 空间准星 · 数据界面', gradient: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', textColor: '#38bdf8', palette: ['#38bdf8', '#22d3ee', '#0f172a'] },
  { key: 'blueprint', name: '建筑蓝图', en: 'Blueprint', tag: '理性几何', desc: '坐标网格 · 标尺规整 · 严谨工笔', gradient: 'linear-gradient(135deg, #1e3a8a 0%, #1d4ed8 100%)', textColor: '#ffffff', palette: ['#93c5fd', '#3b82f6', '#172554'] },
  { key: 'specimen', name: '冷调标本', en: 'Specimen', tag: '极简纯粹', desc: '纯净冷灰 · 标本框线 · 现代排版', gradient: 'linear-gradient(135deg, #334155 0%, #475569 100%)', textColor: '#ffffff', palette: ['#f8fafc', '#94a3b8', '#1e293b'] },
  { key: 'magenta', name: '波普粉紫', en: 'Magenta', tag: '复古蒸汽', desc: '炫彩波普 · 甜酷霓虹 · 动感波点', gradient: 'linear-gradient(135deg, #d946ef 0%, #8b5cf6 100%)', textColor: '#ffffff', palette: ['#fdf4ff', '#e879f9', '#701a75'] },
  { key: 'mint', name: '薄荷苏打', en: 'Mint', tag: '清新夏日', desc: '清爽薄荷 · 荧光水绿 · 灵动像素', gradient: 'linear-gradient(135deg, #10b981 0%, #06b6d4 100%)', textColor: '#ffffff', palette: ['#ccfbf1', '#2dd4bf', '#0f766e'] },
  { key: 'rouge', name: '胭脂赤黑', en: 'Rouge', tag: '新国潮律', desc: '东方水墨 · 漆黑朱红 · 浓烈戏剧', gradient: 'linear-gradient(135deg, #991b1b 0%, #1c1917 100%)', textColor: '#ffffff', palette: ['#fecaca', '#dc2626', '#1c1917'] },
  { key: 'transit', name: '城市地铁', en: 'Transit', tag: '都市通勤', desc: '路线拓扑 · 站点穿梭 · 速度与光', gradient: 'linear-gradient(135deg, #059669 0%, #0284c7 100%)', textColor: '#ffffff', palette: ['#a7f3d0', '#10b981', '#065f46'] },
];





export const IMMERSIVE_MODE_OPTIONS = [
  { value: 'regular', label: '常规滚动' },
  { value: 'talk', label: 'PV 歌词' },
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
  talk: ['ktvPreset', 'ktvPresetPool', 'ktvSongTemplates', 'ktvSpeed', 'ktvMotion', 'ktvBgOpacity', 'ktvUseCoverTexture', 'ktvBeatReactive', 'ktvPreviewEnabled', 'ktvShowTitleCard', 'ktvShowLyricIndex', 'ktvCustomColor', 'ktvShowTranslation', 'ktvShowPreviousLine', 'jizuraStyle', 'jizuraMood', 'jizuraTheme', 'jizuraMotion', 'jizuraGlitch', 'jizuraTexture', 'jizuraKoma'],
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




