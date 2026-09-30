import J from './jizuraLib.js';

export const STYLE_ALIAS_MAP = {
  'blueInk': 'blueprint',
  'blue-structure': 'blueprint',
  'ruler': 'caution',
  'geometric': 'caution',
  'rainCity': 'noir',
  'rain-city': 'noir',
  'yorushika': 'specimen',
  'mono': 'mono',
  'calm-villain': 'mono',
  'sweetPink': 'magenta',
  'sweet-pink': 'magenta',
  'yozakura': 'sakura',
  'sakura': 'sakura',
  'popArt': 'magenta',
  'pop-art': 'magenta',
  'shinkuu': 'hud',
  'fly-me-to-the-moon': 'hud',
  'kawaiPixel': 'mint',
  'zasshi': 'paper',
  'cinemaTeal': 'noir',
  'custom': 'noir',
  'p5': 'crimson',
  'cityPop': 'sunset',
  'city-pop': 'sunset',
  'neonNight': 'noir',
  'neon-night': 'noir',
  'tasogare': 'sunset',
  'lemonSoda': 'mint',
  'lemon-soda': 'mint',
  'kiri': 'specimen',
  'umi': 'ocean',
  'film': 'noir',
  'battle': 'crimson',
  'cyber': 'hud',
  'digitalImpression': 'hud',
  'glitch': 'crimson',
  'holoScope': 'hud',
  'silhouetteClean': 'mono',
  'evaAlert': 'crimson',
  'cyberpunk2077': 'crimson'
};

export const PLACEHOLDER_PATTERNS = [
  /暂无歌词/,
  /当前暂无歌词/,
  /没有获取对应歌词/,
  /没有找到匹配歌词/,
  /请欣赏音乐/,
  /纯音乐[，,\s]*请欣赏/,
  /纯音乐/,
  /享受音乐/,
  /^作词\s*[:：]\s*(无|暂无)?$/i,
  /^作曲\s*[:：]\s*(无|暂无)?$/i
];

export function isPlaceholderLyricText(text = '') {
  const clean = String(text || '').trim();
  if (!clean) return true;
  return PLACEHOLDER_PATTERNS.some(re => re.test(clean));
}

/**
 * 将歌曲的 lyrics 数组转换为包含标准 LRC 时间标签的文本（自动过滤占位符与非歌词行）
 */
export function formatLyricsToLrc(lyrics = []) {
  if (!Array.isArray(lyrics) || lyrics.length === 0) return '';
  const rows = [];
  for (const item of lyrics) {
    if (!item) continue;
    const text = (item.text || '').trim();
    if (!text || isPlaceholderLyricText(text)) continue;
    const rawTime = item.time ?? item.start ?? item.startTime ?? item.startSec;
    const t = Number.isFinite(Number(rawTime)) && Number(rawTime) >= 0 ? Number(rawTime) : 0;
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    const ms = Math.floor((t % 1) * 100);
    const timeTag = `[${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(ms).padStart(2, '0')}]`;
    rows.push(`${timeTag}${text}`);
  }
  return rows.join('\n');
}

/**
 * 依据歌曲信息与传入配置构建 JIZURA Project 对象
 */
export function buildJizuraProject({
  lyrics = [],
  songMeta = {},
  style = 'noir',
  mood = null,
  themeId = null,
  seed = null,
  aspect = '16:9',
  fxConfig = {}
}) {
  const defaultProj = J.defaultProject ? J.defaultProject() : {};
  const rawLrc = formatLyricsToLrc(lyrics);
  const hasRealLyrics = Boolean(rawLrc && rawLrc.trim().length > 0);

  // 映射风格名称
  const resolvedStyle = J.STYLES[style] ? style : (STYLE_ALIAS_MAP[style] || 'noir');

  // 计算或继承种子
  let finalSeed = seed;
  if (!finalSeed || typeof finalSeed !== 'number') {
    const seedSource = songMeta.id
      ? String(songMeta.id)
      : `${songMeta.title || 'song'}_${songMeta.artist || 'artist'}`;
    finalSeed = J.sid ? J.sid(seedSource) : 20260930;
  }

  const project = {
    ...defaultProj,
    version: 1,
    title: songMeta.title || '',
    artist: songMeta.artist || '',
    // 若暂无真实歌词，优雅走 JIZURA 间奏模式（全息标题卡+声波光影+背景装饰），绝不展示生硬占位符
    lyrics: hasRealLyrics ? rawLrc : '[00:00.00][间奏 999]',
    style: resolvedStyle,
    mood: mood || null,
    themeId: themeId || null,
    seed: finalSeed,
    aspect: aspect || '16:9',
    res: 1080,
    fps: 24,
    extra: true,
    wa: true,
    typo: true,
    kinetic: true,
    horror: mood === 'horror' || themeId === 'horror',
    typeset: true,
    unify: true,
    fx: {
      ...(defaultProj.fx || {}),
      motion: fxConfig.motion ?? 0.7,
      glitch: fxConfig.glitch ?? 0.55,
      chroma: fxConfig.chroma ?? 0.7,
      texture: fxConfig.texture ?? 0.6,
      bgSwitch: 0.35,
      flash: true,
      onTwos: fxConfig.onTwos ?? true,
      koma: fxConfig.koma ?? 12,
      hud: 'auto'
    },
    timing: {
      bpm: 0,
      offset: 0.1,
      snap: true,
      tail: 0.9,
      lineTimes: {},
      lineScale: 1
    }
  };

  return project;
}

/**
 * 生成可直接供 J.Renderer 绘制的 plan
 */
export function createJizuraPlan(project, audioBeats = null) {
  if (!J.plan) return null;
  const audio = audioBeats ? { beats: audioBeats } : null;
  return J.plan(project, audio);
}

export default {
  STYLE_ALIAS_MAP,
  PLACEHOLDER_PATTERNS,
  isPlaceholderLyricText,
  formatLyricsToLrc,
  buildJizuraProject,
  createJizuraPlan
};
