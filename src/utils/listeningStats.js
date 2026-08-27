// src/utils/listeningStats.js - Personal Listening Analytics & Genre Radar Engine
import { api } from './api.js';

const STATS_STORAGE_KEY = 'ichigo_listening_history_stats';
const MAX_LOCAL_RECORDS = 1500;

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

const GENRE_KEYWORDS = {
  pop: [
    'pop', '流行', '华语流行', '欧美流行', '日韩流行', 'k-pop', 'j-pop', 'c-pop',
    '抒情', '芭乐', 'ballad', 'love', '恋', '爱', '情歌', 'vocal', '甜美', '伤感', '治愈'
  ],
  rock: [
    'rock', '摇滚', '金属', 'metal', '朋克', 'punk', 'hard rock', 'heavy metal',
    'post-rock', '后摇', 'indie rock', '独立摇滚', 'alternative', '另类摇滚', 'grunge',
    'progressive', '核', 'core', 'screamo', 'britpop', '英伦摇滚', 'guitar'
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
    'cv', '声优', 'mafumafu', 'eve', 'yoasobi', 'yorushika', 'zutomayo', 'ado', 'aimer', 'lisa',
    'sawano', '泽野弘之', '梶浦由记', '神前晓', '久石让', '术力口', 'anisong'
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

// Classify genre for a song
export function classifySongGenre(song) {
  if (!song) return { pop: 1 };
  const str = [
    song.name || '',
    song.title || '',
    song.artist || '',
    song.album?.name || song.al?.name || '',
    Array.isArray(song.ar) ? song.ar.map(a => a.name).join(' ') : '',
    Array.isArray(song.artists) ? song.artists.map(a => a.name).join(' ') : '',
    Array.isArray(song.tns) ? song.tns.join(' ') : '',
    Array.isArray(song.alia) ? song.alia.join(' ') : ''
  ].join(' ').toLowerCase();

  const scores = {};
  let totalScore = 0;

  for (const [cat, keywords] of Object.entries(GENRE_KEYWORDS)) {
    let score = 0;
    for (const kw of keywords) {
      if (str.includes(kw.toLowerCase())) {
        score += kw.length > 3 ? 2 : 1;
      }
    }
    scores[cat] = score;
    totalScore += score;
  }

  // If no specific genre matched, default to balanced/pop fallback
  if (totalScore === 0) {
    scores.pop = 2;
    scores.classical = 1;
    totalScore = 3;
  }

  return scores;
}

// Local Storage Helper
function getLocalLogs() {
  try {
    const raw = localStorage.getItem(STATS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveLocalLogs(logs) {
  try {
    const trimmed = logs.slice(-MAX_LOCAL_RECORDS);
    localStorage.setItem(STATS_STORAGE_KEY, JSON.stringify(trimmed));
  } catch (err) {
    console.warn('Failed to save listening stats log:', err);
  }
}

// Record a playback event into persistent local analytics
export function recordPlayEvent({ song, playedSeconds, totalDuration }) {
  if (!song?.id || !playedSeconds || playedSeconds < 3) return;
  const duration = Math.min(Math.round(playedSeconds), totalDuration > 0 ? Math.round(totalDuration) : 600);
  const artistName = Array.isArray(song.ar)
    ? song.ar.map(a => a.name).join(' / ')
    : (Array.isArray(song.artists) ? song.artists.map(a => a.name).join(' / ') : (song.artist || '未知艺术家'));

  const entry = {
    id: song.id,
    name: song.name || '未知曲目',
    artist: artistName,
    artists: (song.ar || song.artists || []).map(a => ({ id: a.id, name: a.name })),
    album: song.al?.name || song.album?.name || '',
    coverUrl: song.al?.picUrl || song.album?.picUrl || song.coverUrl || '',
    seconds: duration,
    timestamp: Date.now()
  };

  const logs = getLocalLogs();
  logs.push(entry);
  saveLocalLogs(logs);
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

    // Genre Stats
    const genreScore = classifySongGenre(item);
    for (const [k, v] of Object.entries(genreScore)) {
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

  return {
    totalSeconds,
    todaySeconds,
    totalPlays: logs.length,
    topArtists,
    topSongs,
    genreDistribution
  };
}

// Generate Personalized Music Persona Label based on top genres
export function getMusicPersona(genreDistribution = []) {
  if (!genreDistribution || genreDistribution.length === 0) return '多元音律探索者';
  const sorted = [...genreDistribution].sort((a, b) => b.percentage - a.percentage);
  const top1 = sorted[0];
  const top2 = sorted[1];

  if (!top1 || top1.percentage < 15) return '全景漫游品鉴官';

  if (top1.key === 'acg') return top2?.key === 'electronic' ? '二次元电音先锋' : '幻境次元物语家';
  if (top1.key === 'electronic') return top2?.key === 'rock' ? '重低音脉冲制造机' : '未来合成波巡航员';
  if (top1.key === 'rock') return top2?.key === 'folk' ? '独立摇滚行吟诗人' : '高能硬核摇滚客';
  if (top1.key === 'pop') return top2?.key === 'jazz' ? '都市流行律动精粹' : '华语抒情金曲挚友';
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
  remoteTopSongs.forEach(song => {
    const gScore = classifySongGenre(song);
    const weight = Math.max(1, Math.min(20, Math.round(song.playCount / 5)));
    for (const [k, v] of Object.entries(gScore)) {
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

  const persona = getMusicPersona(mergedGenreDistribution);

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
