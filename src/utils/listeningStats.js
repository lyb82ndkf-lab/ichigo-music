// src/utils/listeningStats.js - Personal Listening Analytics & Genre Radar Engine
import { api } from './api.js';

export const STATS_STORAGE_KEY = 'ichigo_listening_history_stats';
export const MAX_LOCAL_RECORDS = 50000;
// 8 Major Genre Categories & Comprehensive Keyword Lexicon
export const GENRE_CATEGORIES = [
  { key: 'pop', name: '流行 (Pop)', color: '#ff4081', glow: 'rgba(255, 64, 129, 0.4)' },
  { key: 'rock', name: '摇滚 (Rock)', color: '#ff6b35', glow: 'rgba(255, 107, 53, 0.4)' },
  { key: 'electronic', name: '电子 (Electronic)', color: '#00d4ff', glow: 'rgba(0, 212, 255, 0.4)' },
  { key: 'acg', name: 'ACG / 动漫', color: '#9d4edd', glow: 'rgba(157, 78, 221, 0.4)' },
  { key: 'folk', name: '民谣 (Folk)', color: '#52b788', glow: 'rgba(82, 183, 136, 0.4)' },
  { key: 'hiphop', name: '说唱 (Hip-Hop)', color: '#f72585', glow: 'rgba(247, 37, 133, 0.4)' },
  { key: 'jazz', name: '爵士 / R&B', color: '#e0aaff', glow: 'rgba(224, 170, 255, 0.4)' },
  { key: 'classical', name: '古典 / 纯音', color: '#4cc9f0', glow: 'rgba(76, 201, 240, 0.4)' }
];

const JAPANESE_CHAR_REGEX = /[\u3040-\u309f\u30a0-\u30ff]/;
const KOREAN_CHAR_REGEX = /[\uac00-\ud7af\u1100-\u11ff]/;
const CHINESE_CHAR_REGEX = /[\u4e00-\u9fa5]/;

const ACG_JAPANESE_ARTISTS = [
  'yoasobi', 'yorushika', 'zutomayo', 'ado', 'aimer', 'lisa', 'eve', 'mafumafu',
  'radwimps', 'one ok rock', 'king gnu', 'official髭男dism', 'official hige dandism', 'back number',
  'vaundy', 'yuuri', 'kenshi yonezu', 'yonezu', 'hikaru utada', 'utada', 'miku', 'hatsune miku',
  'vocaloid', 'deco*27', 'kanaria', 'pinocchiop', 'jin', 'nayutan', 'tuyu', 'honeyworks',
  'claris', 'garnidelia', 'fripside', 'kalafina', 'egoist', 'supercell', 'sawano', 'sawano hiroyuki',
  'hiroyuki sawano', 'yuki kajiura', 'kajiura', 'monaca', 'satoru kosaki', 'joe hisaishi', 'hisaishi',
  'yoko kanno', 'kano', 'reol', 'ryokuoushoku shakai', 'macaroni empitsu', 'saucy dog',
  'mrs. green apple', 'wanima', 'man with a mission', 'spyair', 'uverworld', 'flow',
  'unison square garden', 'granrodeo', 'oldcodex', 'my first story', 'fear, and loathing in las vegas',
  'babymetal', 'coldrain', 'the oral cigarettes', 'polkadot stingray', 'hololive', 'nijisanji',
  'hoshimachi suisei', 'mori calliope', 'usada pekora', 'minato aqua', 'inori minase', 'kana hanazawa',
  'saori hayami', 'maaya uchida', 'amamiya sora', 'akari kito', 'aoi yuuki', 'ayane sakura',
  'risa taneda', 'ai kayano', 'rie kugimiya', 'maaya sakamoto', 'yui ogura', 'sumire uesaka',
  'rie takahashi', 'nana mizuki', 'megumi hayashibara', 'mika nakashima', 'mai kuraki',
  'ayumi hamasaki', 'namie amuro', 'ringo sheena', 'sheena ringo', 'miyuki nakajima',
  'koji tamaki', 'shinji tanimura', 'tatsuro yamashita', 'mariya takeuchi', 'ryuichi sakamoto',
  'genshin', 'honkai', 'arknights', 'azur lane', 'blue archive', 'fate', 'fgo', 'touhou',
  'typemoon', 'key', 'clannad', 'air', 'kanon', 'angel beats', 'charlotte', 'summer pockets',
  '米津玄師', '宇多田ヒカル', 'ずっと真夜中でいいのに', 'ヨルシカ', 'ツユ', '優里', '緑黄色社会',
  'マカロニえんぴつ', '初音ミク', '鏡音', '巡音', '花譜', '星街すいせい', '水瀬いのり', '花澤香菜',
  '早見沙織', '内田真礼', '雨宮天', '鬼頭明里', '悠木碧', '佐倉綾音', '種田梨沙', '茅野愛衣',
  '釘宮理恵', '坂本真綾', '小倉唯', '上坂すみれ', '高橋李依', '水樹奈々', '林原めぐみ', '中島美嘉',
  '倉木麻衣', '浜崎あゆみ', '安室奈美恵', '椎名林檎', '中島みゆき', '玉置浩二', '谷村新司',
  '山下達郎', '竹内まりや', '坂本龍一', '久石譲', '菅野よう子', '澤野弘之', '梶浦由記', '神前暁'
];

const GENRE_KEYWORDS = {
  pop: [
    'pop', '流行', '华语流行', '欧美流行', '日韩流行', 'k-pop', 'c-pop',
    '抒情', '芭乐', 'ballad', 'love', '情歌', 'vocal', '甜美', '伤感', '治愈'
  ],
  rock: [
    'rock', '摇滚', '金属', 'metal', '朋克', 'punk', 'hard rock', 'heavy metal',
    'post-rock', '后摇', 'indie rock', '独立摇滚', 'alternative', '另类摇滚', 'grunge',
    'progressive', '核', 'core', 'screamo', 'britpop', '英伦摇滚', 'guitar', 'j-rock', 'band', '乐队'
  ],
  electronic: [
    'electronic', '电子', '电音', 'edm', 'synthwave', 'synth', 'future bass', 'house',
    'techno', 'trance', 'dubstep', 'drum and bass', 'dnb', 'ambient', 'chillout',
    'lo-fi', 'lofi', 'vaporwave', '蒸汽波', 'cyberpunk', '赛博朋克', 'bass', 'club', 'dance', '舞曲'
  ],
  acg: [
    'acg', '动漫', '动画', '二次元', 'vocaloid', '初音', '初音未来', 'miku', 'kagamine',
    'touhou', '东方', '原神', 'genshin', '崩坏', 'honkai', 'arknights', '明日方舟',
    '游戏原声', 'game ost', 'op', 'ed', 'insert song', 'character song', '角色歌',
    'cv', '声优', '术力口', 'anisong', 'j-pop', 'jpop', 'anime', 'animation',
    'doujin', '同人', 'キャラソン', 'ボカロ', 'ボーカロイド', 'アニソン', 'アニメ',
    '主題歌', '挿入歌', '声優', '音游', 'bgm'
  ],
  folk: [
    'folk', '民谣', 'acoustic', '原声吉他', '指弹', 'country', '乡村', 'indie folk',
    '民歌', '校园民谣', '城市民谣', '吟唱', '吉他弹唱', '民乐', '古风', '国风', '戏腔', '诗'
  ],
  hiphop: [
    'hip-hop', 'hiphop', '说唱', 'rap', 'trap', 'drill', 'boom bap', 'flow', 'rhyme',
    'freestyle', 'cypher', 'beat', '808', 'urban', 'hardcore rap', 'melodic rap', '街头'
  ],
  jazz: [
    'jazz', '爵士', 'r&b', 'rnb', '节奏布鲁斯', 'soul', '灵魂乐', 'blues', '蓝调',
    'funk', '放克', 'city pop', '都市流行', 'neo-soul', 'bossa nova', '波萨诺瓦', 'groove'
  ],
  classical: [
    'classical', '古典', '纯音乐', 'instrumental', 'piano', '钢琴', 'violin', '小提琴',
    'cello', '大提琴', 'symphony', '交响', 'orchestra', '管弦乐', 'concerto', '协奏曲',
    'sonata', '奏鸣曲', 'soundtrack', 'ost', '原声', 'new age', '新世纪', 'meditation', '冥想', '白噪音'
  ]
};

// Classify genre and language for a song
export function classifySongGenre(song) {
  if (!song) return { scores: { pop: 1 }, lang: 'other' };
  const rawTitle = song.name || song.title || '';
  const rawArtist = song.artist || (Array.isArray(song.ar) ? song.ar.map(a => a.name).join(' ') : '') || (Array.isArray(song.artists) ? song.artists.map(a => a.name).join(' ') : '');
  const rawAlbum = song.album?.name || song.al?.name || '';
  const rawAlia = (Array.isArray(song.alia) ? song.alia.join(' ') : '') + ' ' + (Array.isArray(song.tns) ? song.tns.join(' ') : '');

  const fullRawText = `${rawTitle} ${rawArtist} ${rawAlbum} ${rawAlia}`;
  const str = fullRawText.toLowerCase();

  // Detect language
  const isJapaneseChar = JAPANESE_CHAR_REGEX.test(fullRawText);
  const isKoreanChar = KOREAN_CHAR_REGEX.test(fullRawText);
  const isJapaneseArtist = ACG_JAPANESE_ARTISTS.some(a => str.includes(a.toLowerCase()));
  const isJapanese = isJapaneseChar || isJapaneseArtist;
  const lang = isJapanese ? 'ja' : (isKoreanChar ? 'ko' : (CHINESE_CHAR_REGEX.test(fullRawText) ? 'zh' : 'en'));

  const scores = { pop: 0, rock: 0, electronic: 0, acg: 0, folk: 0, hiphop: 0, jazz: 0, classical: 0 };
  let totalScore = 0;

  // Japanese / ACG boost
  if (isJapanese) {
    scores.acg += 6;
    totalScore += 6;
  }

  for (const [cat, keywords] of Object.entries(GENRE_KEYWORDS)) {
    let score = 0;
    for (const kw of keywords) {
      if (str.includes(kw.toLowerCase())) {
        score += kw.length > 3 ? 2 : 1;
      }
    }
    scores[cat] += score;
    totalScore += score;
  }

  // Sub-genre shaping for Japanese music
  if (isJapanese) {
    if (str.includes('rock') || str.includes('band') || str.includes('ロック') || str.includes('ギター') || str.includes('metal') || str.includes('one ok rock') || str.includes('radwimps') || str.includes('king gnu') || str.includes('spyair') || str.includes('uverworld')) {
      scores.rock += 4;
    }
    if (str.includes('synth') || str.includes('vocaloid') || str.includes('miku') || str.includes('edm') || str.includes('electronic') || str.includes('ボカロ') || str.includes('電音')) {
      scores.electronic += 4;
    }
    if (str.includes('ost') || str.includes('soundtrack') || str.includes('piano') || str.includes('orchestra') || str.includes('symphony') || str.includes('sawano') || str.includes('hisaishi')) {
      scores.classical += 4;
    }
    if (scores.pop === 0 && scores.rock === 0 && scores.electronic === 0) {
      scores.pop += 2;
    }
  }

  // If no specific genre matched at all
  if (totalScore === 0) {
    if (isJapanese) {
      scores.acg = 5;
      scores.pop = 2;
    } else {
      scores.pop = 2;
      scores.classical = 1;
    }
  }

  return {
    ...scores,
    scores,
    lang
  };
}
// Local Storage Helper
export function getLocalLogs() {
  try {
    const raw = localStorage.getItem(STATS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveLocalLogs(logs) {
  try {
    const trimmed = logs.slice(-MAX_LOCAL_RECORDS);
    localStorage.setItem(STATS_STORAGE_KEY, JSON.stringify(trimmed));
    if (window.electronAPI?.saveListeningHistoryVault) {
      window.electronAPI.saveListeningHistoryVault(trimmed).catch(() => {});
    }
  } catch (err) {
    console.warn('Failed to save listening stats log:', err);
  }
}

// Record a playback event into persistent local analytics & disk vault
export function recordPlayEvent({ song, playedSeconds, totalDuration }) {
  if (!song?.id || !playedSeconds || playedSeconds < 3) return;
  const duration = Math.min(Math.round(playedSeconds), totalDuration > 0 ? Math.round(totalDuration) : 600);
  const artistName = Array.isArray(song.ar)
    ? song.ar.map(a => a.name).join(' / ')
    : (Array.isArray(song.artists) ? song.artists.map(a => a.name).join(' / ') : (song.artist || '未知艺术家'));

  const now = Date.now();
  const logs = getLocalLogs();

  // Anti-duplicate protection: If the latest logged entry is the same song within 180s (3 min), update duration instead of pushing duplicate!
  const lastEntry = logs[logs.length - 1];
  if (lastEntry && String(lastEntry.id) === String(song.id) && Math.abs(now - Number(lastEntry.timestamp || 0)) <= 180000) {
    lastEntry.seconds = Math.max(Number(lastEntry.seconds || 0), duration);
    lastEntry.duration = lastEntry.seconds;
    lastEntry.timestamp = Math.max(Number(lastEntry.timestamp || 0), now);
    saveLocalLogs(logs);
    return;
  }

  const entry = {
    id: song.id,
    name: song.name || '未知曲目',
    artist: artistName,
    artists: (song.ar || song.artists || []).map(a => ({ id: a.id, name: a.name })),
    album: song.al?.name || song.album?.name || '',
    coverUrl: song.al?.picUrl || song.album?.picUrl || song.coverUrl || '',
    seconds: duration,
    duration: duration,
    timestamp: now,
    date: new Date(now).toISOString().slice(0, 10)
  };

  logs.push(entry);
  saveLocalLogs(logs);
  if (window.electronAPI?.appendListeningHistoryVault) {
    window.electronAPI.appendListeningHistoryVault(entry).catch(() => {});
  }
}
// Export full listening history to JSON Blob for backup
export function exportListeningHistoryJSON() {
  const logs = getLocalLogs();
  const exportPayload = {
    version: '2.8.0',
    exportedAt: new Date().toISOString(),
    totalRecords: logs.length,
    logs
  };
  const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ichigomusic-footprints-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Import and merge listening history from JSON string or object
export function importListeningHistoryJSON(jsonContent) {
  try {
    const data = typeof jsonContent === 'string' ? JSON.parse(jsonContent) : jsonContent;
    const importedLogs = Array.isArray(data) ? data : (Array.isArray(data?.logs) ? data.logs : []);
    if (importedLogs.length === 0) return { success: false, count: 0, message: '未检测到有效的听歌记录数据' };

    const currentLogs = getLocalLogs();
    const seen = new Set();
    const merged = [];

    [...currentLogs, ...importedLogs].forEach(entry => {
      if (!entry || !entry.id) return;
      const ts = Number(entry.timestamp) || Date.now();
      const key = `${entry.id}_${Math.floor(ts / 60000)}`;
      if (!seen.has(key)) {
        seen.add(key);
        merged.push({
          id: entry.id,
          name: entry.name || '未知曲目',
          artist: entry.artist || '未知艺术家',
          album: entry.album || '',
          coverUrl: entry.coverUrl || '',
          seconds: Number(entry.seconds) || 180,
          timestamp: ts
        });
      }
    });

    merged.sort((a, b) => a.timestamp - b.timestamp);
    saveLocalLogs(merged);
    return {
      success: true,
      count: merged.length,
      newAdded: Math.max(0, merged.length - currentLogs.length)
    };
  } catch (err) {
    return { success: false, count: 0, message: err?.message || '解析导入文件失败' };
  }
}

// Calculate Local Analytics
export function getLocalListeningStats() {
  const logs = getLocalLogs();
  const now = Date.now();
  const todayStart = new Date().setHours(0, 0, 0, 0);

  let totalSeconds = 0;
  let todaySeconds = 0;
  const artistCounts = {};
  const songCounts = {};
  const genreTotals = { pop: 0, rock: 0, electronic: 0, acg: 0, folk: 0, hiphop: 0, jazz: 0, classical: 0 };
  const langCounts = { ja: 0, zh: 0, en: 0, ko: 0, other: 0 };

  logs.forEach((item) => {
    const s = item.seconds || 0;
    totalSeconds += s;
    if (item.timestamp >= todayStart) {
      todaySeconds += s;
    }

    // Artist Stats
    const art = item.artist || '未知艺术家';
    if (!artistCounts[art]) {
      artistCounts[art] = { name: art, count: 0, seconds: 0, coverUrl: item.coverUrl };
    }
    artistCounts[art].count += 1;
    artistCounts[art].seconds += s;

    // Song Stats
    const songKey = `${item.id}-${item.name}`;
    if (!songCounts[songKey]) {
      songCounts[songKey] = { id: item.id, name: item.name, artist: art, coverUrl: item.coverUrl, count: 0, seconds: 0 };
    }
    songCounts[songKey].count += 1;
    songCounts[songKey].seconds += s;

    // Genre & Language Stats
    const { scores: genreScore, lang } = classifySongGenre(item);
    if (langCounts[lang] !== undefined) {
      langCounts[lang] += 1;
    }
    for (const [k, v] of Object.entries(genreScore || {})) {
      if (genreTotals[k] !== undefined) {
        genreTotals[k] += v * (s > 30 ? 2 : 1);
      }
    }
  });

  // Sort Top Artists
  const topArtists = Object.values(artistCounts)
    .sort((a, b) => b.count - a.count || b.seconds - a.seconds)
    .slice(0, 10);

  // Sort Top Songs
  const topSongs = Object.values(songCounts)
    .sort((a, b) => b.count - a.count || b.seconds - a.seconds)
    .slice(0, 10);

  // Compute Genre Distribution Percentages
  let totalGenreScore = Object.values(genreTotals).reduce((a, b) => a + b, 0);
  if (totalGenreScore === 0) totalGenreScore = 1;

  const genreDistribution = GENRE_CATEGORIES.map(cat => {
    const raw = genreTotals[cat.key] || 0;
    const pct = Math.round((raw / totalGenreScore) * 100);
    return {
      ...cat,
      score: raw,
      percentage: pct
    };
  });

  const totalLogged = Math.max(1, logs.length);
  const languageStats = {
    jaRatio: (langCounts.ja || 0) / totalLogged,
    zhRatio: (langCounts.zh || 0) / totalLogged,
    enRatio: (langCounts.en || 0) / totalLogged,
    koRatio: (langCounts.ko || 0) / totalLogged
  };

  return {
    totalSeconds,
    todaySeconds,
    totalPlays: logs.length,
    topArtists,
    topSongs,
    genreDistribution,
    languageStats
  };
}

// Generate Personalized Music Persona Label based on top genres & language distribution
export function getMusicPersona(genreDistribution = [], languageStats = { jaRatio: 0, zhRatio: 0, enRatio: 0, koRatio: 0 }) {
  if (!genreDistribution || genreDistribution.length === 0) return '多元音律探索者';
  const sorted = [...genreDistribution].sort((a, b) => b.percentage - a.percentage);
  const top1 = sorted[0];
  const top2 = sorted[1];
  const isJapaneseDominant = languageStats.jaRatio >= 0.35 || top1?.key === 'acg';

  if (isJapaneseDominant) {
    if (top1?.key === 'acg') {
      if (top2?.key === 'electronic') return '二次元电音先锋';
      if (top2?.key === 'rock') return '日系摇滚激流巡礼者';
      if (top2?.key === 'classical') return '新海诚风纯音造梦师';
      if (top2?.key === 'folk') return '日系治愈物语品鉴家';
      return 'J-Pop 霓虹次元物语家';
    }
    if (top1?.key === 'pop') {
      if (top2?.key === 'rock') return 'J-Rock 流行摇滚热血客';
      if (top2?.key === 'electronic') return 'J-Pop 电音律动玩家';
      return 'J-Pop 霓虹流行品鉴官';
    }
    if (top1?.key === 'rock') return '日系摇滚激流巡礼者';
    if (top1?.key === 'electronic') return '二次元电音先锋';
    if (top1?.key === 'classical') return '新海诚风纯音造梦师';
    if (top1?.key === 'folk') return '日系治愈物语品鉴家';
    if (top1?.key === 'jazz') return 'City Pop 霓虹夜行客';
    return '二次元与 J-Pop 挚友';
  }

  if (top1.key === 'acg') return top2?.key === 'electronic' ? '二次元电音先锋' : '幻境次元物语家';
  if (top1.key === 'electronic') return top2?.key === 'rock' ? '重低音脉冲制造机' : '未来合成波巡航员';
  if (top1.key === 'rock') return top2?.key === 'folk' ? '独立摇滚行吟诗人' : '高能硬核摇滚客';
  if (top1.key === 'pop') {
    if (languageStats.enRatio >= 0.5) return '欧美流行旋律猎手';
    if (languageStats.koRatio >= 0.4) return 'K-Pop 舞台律动潮人';
    return top2?.key === 'jazz' ? '都市流行律动精粹' : '华语抒情金曲挚友';
  }
  if (top1.key === 'folk') return '山海民谣游吟者';
  if (top1.key === 'hiphop') return '硬核说唱节奏律动家';
  if (top1.key === 'jazz') return '复古爵士蓝调夜行客';
  if (top1.key === 'classical') return '殿堂交响与纯音行者';

  return `${top1.name.split(' ')[0]}偏好者`;
}

// Fetch Full Comprehensive Stats (Remote API + Local Scrobble Hybrid)
export async function getComprehensiveListeningStats(user = null) {
  const local = getLocalListeningStats();
  
  let remoteTopSongs = [];
  let userDetail = null;
  let totalListenSongsCount = local.totalPlays;
  let cloudDurationHours = 0;

  if (user?.userId) {
    try {
      const [recordRes, detailRes, listenTotalRes] = await Promise.allSettled([
        api.getUserRecord(user.userId, 0),
        api.getUserDetail(user.userId),
        api.getListenDataTotal().catch(() => null)
      ]);

      if (recordRes.status === 'fulfilled' && recordRes.value?.allData) {
        remoteTopSongs = recordRes.value.allData.map(item => {
          const song = item.song || {};
          return {
            id: song.id,
            name: song.name,
            artist: Array.isArray(song.ar) ? song.ar.map(a => a.name).join(' / ') : (song.artist || '未知艺术家'),
            coverUrl: song.al?.picUrl || song.coverUrl || '',
            playCount: item.playCount || item.score || 1,
            score: item.score || 0
          };
        });
      }

      if (detailRes.status === 'fulfilled' && detailRes.value) {
        userDetail = detailRes.value;
        if (detailRes.value.listenSongs) {
          totalListenSongsCount = Math.max(totalListenSongsCount, detailRes.value.listenSongs);
        }
      }

      if (listenTotalRes.status === 'fulfilled' && listenTotalRes.value?.data?.totalTime) {
        cloudDurationHours = Math.round(listenTotalRes.value.data.totalTime / 3600);
      }
    } catch (err) {
      console.warn('Failed to fetch remote user stats:', err);
    }
  }

  // Combine top songs and genres
  const combinedTopSongs = remoteTopSongs.length > 0 ? remoteTopSongs.slice(0, 10) : local.topSongs;

  // Enhance genre radar with remote top songs
  const genreTotals = { pop: 0, rock: 0, electronic: 0, acg: 0, folk: 0, hiphop: 0, jazz: 0, classical: 0 };
  
  // Factor in local logs
  local.genreDistribution.forEach(g => {
    genreTotals[g.key] = (genreTotals[g.key] || 0) + (g.score || 0);
  });

  // Factor in remote top songs
  const combinedLangCounts = {
    ja: (local.languageStats?.jaRatio || 0) * (local.totalPlays || 1),
    zh: (local.languageStats?.zhRatio || 0) * (local.totalPlays || 1),
    en: (local.languageStats?.enRatio || 0) * (local.totalPlays || 1),
    ko: (local.languageStats?.koRatio || 0) * (local.totalPlays || 1)
  };

  // Factor in remote top songs
  remoteTopSongs.forEach(song => {
    const { scores: gScore, lang } = classifySongGenre(song);
    const weight = Math.max(1, Math.min(20, Math.round(song.playCount / 5)));
    if (combinedLangCounts[lang] !== undefined) {
      combinedLangCounts[lang] += weight;
    }
    for (const [k, v] of Object.entries(gScore || {})) {
      if (genreTotals[k] !== undefined) {
        genreTotals[k] += v * weight;
      }
    }
  });

  let totalGenreScore = Object.values(genreTotals).reduce((a, b) => a + b, 0);
  if (totalGenreScore === 0) totalGenreScore = 1;

  const mergedGenreDistribution = GENRE_CATEGORIES.map(cat => {
    const raw = genreTotals[cat.key] || 0;
    const pct = Math.round((raw / totalGenreScore) * 100);
    return {
      ...cat,
      score: raw,
      percentage: pct
    };
  });

  // Extract top artists from remote or local
  let topArtists = [...local.topArtists];
  if (remoteTopSongs.length > 0) {
    const artistMap = {};
    remoteTopSongs.forEach(s => {
      const art = s.artist || '未知艺术家';
      if (!artistMap[art]) artistMap[art] = { name: art, count: 0, coverUrl: s.coverUrl };
      artistMap[art].count += s.playCount || 1;
    });
    topArtists = Object.values(artistMap).sort((a, b) => b.count - a.count).slice(0, 10);
  }

  const totalLangWeight = Math.max(1, Object.values(combinedLangCounts).reduce((a, b) => a + b, 0));
  const finalLanguageStats = {
    jaRatio: combinedLangCounts.ja / totalLangWeight,
    zhRatio: combinedLangCounts.zh / totalLangWeight,
    enRatio: combinedLangCounts.en / totalLangWeight,
    koRatio: combinedLangCounts.ko / totalLangWeight
  };

  const persona = getMusicPersona(mergedGenreDistribution, finalLanguageStats);

  // Total Hours calculation (Local + Cloud hybrid)
  const localHours = Math.round((local.totalSeconds / 3600) * 10) / 10;
  const estimatedHours = cloudDurationHours > 0
    ? cloudDurationHours
    : Math.max(localHours, Math.round((totalListenSongsCount * 3.6) / 60));

  return {
    totalHours: estimatedHours,
    todayMinutes: Math.round(local.todaySeconds / 60),
    totalListenSongs: totalListenSongsCount,
    level: userDetail?.level || user?.level || 0,
    createDays: userDetail?.createDays || 0,
    topArtists,
    topSongs: combinedTopSongs,
    genreDistribution: mergedGenreDistribution,
    persona
  };
}
