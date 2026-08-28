// src/utils/listeningHeatmap.js - Listening Heatmap and Calendar Analytics Utility
import { api } from './api.js';
import { saveLocalLogs } from './listeningStats.js';
export function getLocalListeningLogs() {
  try {
    const raw = localStorage.getItem(STATS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// Convert Date or timestamp to 'YYYY-MM-DD'
export function formatToDateKey(timestamp) {
  const d = new Date(timestamp);
  if (isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function formatDateChinese(dateKey) {
  if (!dateKey) return '';
  const [y, m, d] = dateKey.split('-');
  const dateObj = new Date(Number(y), Number(m) - 1, Number(d));
  const weekDays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
  const weekName = weekDays[dateObj.getDay()] || '';
  return `${y}年${Number(m)}月${Number(d)}日 ${weekName}`;
}

export function getLevelFromCount(count) {
  if (!count || count <= 0) return 0;
  if (count <= 3) return 1;
  if (count <= 8) return 2;
  if (count <= 15) return 3;
  return 4;
}

// Fetch Remote Recent Songs and normalize to footprint records
export async function fetchRemoteRecentTracks(limit = 100) {
  try {
    const res = await api.getRecentSongs(limit);
    const list = res?.data?.list || res?.list || [];
    return list.map(item => {
      const songData = item.data || item.song || item;
      const playTime = item.playTime || item.timestamp || Date.now();
      return {
        id: songData.id,
        name: songData.name || songData.title || '未知歌曲',
        artist: songData.ar?.map(a => a.name).join(' / ') || songData.artists?.map(a => a.name).join(' / ') || songData.artist || '未知歌手',
        album: songData.al?.name || songData.album?.name || '',
        coverUrl: songData.al?.picUrl || songData.album?.picUrl || songData.coverUrl || '',
        duration: Math.round((songData.dt || songData.duration || 0) / 1000) || 180,
        seconds: Math.round((songData.dt || songData.duration || 0) / 1000) || 180,
        timestamp: playTime,
        date: formatToDateKey(playTime)
      };
    }).filter(t => t.id && t.date);
  } catch (err) {
    console.debug('Failed to fetch remote recent songs for heatmap:', err);
    return [];
  }
}

// Aggregate All Listening Footprints (Local Logs + Remote Records)
export async function getListeningHeatmapData(selectedYear = new Date().getFullYear()) {
  const localLogs = getLocalListeningLogs();
  const remoteLogs = await fetchRemoteRecentTracks(150);

  // Normalize local logs
  const normalizedLocal = localLogs.map(item => ({
    id: item.id,
    name: item.name || '未知歌曲',
    artist: item.artist || '未知歌手',
    album: item.album || '',
    coverUrl: item.coverUrl || '',
    duration: item.seconds || 180,
    seconds: item.seconds || 180,
    timestamp: item.timestamp || Date.now(),
    date: formatToDateKey(item.timestamp || Date.now())
  })).filter(t => t.id && t.date);

  // Merge unique logs
  const seen = new Set();
  const allLogs = [];

  [...normalizedLocal, ...remoteLogs].forEach(entry => {
    // Unique key combines songId and timestamp bucket (approx 1 minute window)
    const key = `${entry.id}_${Math.floor(entry.timestamp / 60000)}`;
    if (!seen.has(key)) {
      seen.add(key);
      allLogs.push(entry);
    }
  });

  // Sort logs by timestamp ascending
  allLogs.sort((a, b) => a.timestamp - b.timestamp);
  saveLocalLogs(allLogs);

  // Group by Date Key (YYYY-MM-DD)
  const dateMap = new Map();
  let maxDailyPlays = 0;
  let maxDay = null;

  allLogs.forEach(entry => {
    const d = entry.date;
    if (!dateMap.has(d)) {
      dateMap.set(d, {
        date: d,
        count: 0,
        totalSeconds: 0,
        songs: [],
        songFreq: {}
      });
    }

    const dayData = dateMap.get(d);
    dayData.count += 1;
    dayData.totalSeconds += (entry.seconds || 0);
    dayData.songs.push(entry);

    const songKey = `${entry.id}_${entry.name}`;
    if (!dayData.songFreq[songKey]) {
      dayData.songFreq[songKey] = {
        id: entry.id,
        name: entry.name,
        artist: entry.artist,
        album: entry.album,
        coverUrl: entry.coverUrl,
        duration: entry.duration,
        count: 0
      };
    }
    dayData.songFreq[songKey].count += 1;
  });

  // Determine top song and level for each day
  for (const [d, dayData] of dateMap.entries()) {
    const topSong = Object.values(dayData.songFreq).sort((a, b) => b.count - a.count)[0] || null;
    dayData.topSong = topSong;
    dayData.level = getLevelFromCount(dayData.count);

    if (dayData.count > maxDailyPlays) {
      maxDailyPlays = dayData.count;
      maxDay = d;
    }
  }

  // Calculate Streaks
  const allDateKeys = Array.from(dateMap.keys()).sort();
  let currentStreak = 0;
  let longestStreak = 0;
  let tempStreak = 0;
  let prevDate = null;

  const todayKey = formatToDateKey(Date.now());
  const yesterdayKey = formatToDateKey(Date.now() - 86400000);

  // Active days count
  const activeDays = allDateKeys.length;
  const totalSongs = allLogs.length;

  allDateKeys.forEach(dateStr => {
    if (!prevDate) {
      tempStreak = 1;
    } else {
      const prevTime = new Date(prevDate).getTime();
      const currTime = new Date(dateStr).getTime();
      const diffDays = Math.round((currTime - prevTime) / 86400000);
      if (diffDays === 1) {
        tempStreak += 1;
      } else if (diffDays > 1) {
        tempStreak = 1;
      }
    }
    if (tempStreak > longestStreak) {
      longestStreak = tempStreak;
    }
    prevDate = dateStr;
  });

  // Calculate current streak
  if (dateMap.has(todayKey)) {
    let checkDate = new Date();
    currentStreak = 0;
    while (true) {
      const key = formatToDateKey(checkDate.getTime());
      if (dateMap.has(key)) {
        currentStreak += 1;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }
  } else if (dateMap.has(yesterdayKey)) {
    let checkDate = new Date(Date.now() - 86400000);
    currentStreak = 0;
    while (true) {
      const key = formatToDateKey(checkDate.getTime());
      if (dateMap.has(key)) {
        currentStreak += 1;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }
  }

  const availableYears = Array.from(new Set([
    new Date().getFullYear(),
    ...allDateKeys.map(d => parseInt(d.split('-')[0], 10))
  ])).sort((a, b) => b - a);

  return {
    dateMap,
    allLogs,
    activeDays,
    totalSongs,
    maxDailyPlays,
    maxDay,
    currentStreak,
    longestStreak,
    availableYears,
    selectedYear
  };
}

// Generate 52/53 Weeks Grid for Year View (GitHub Contribution Graph Style)
export function generateYearGrid(year, dateMap) {
  const startDate = new Date(year, 0, 1);
  const endDate = new Date(year, 11, 31);
  // Align start to the nearest preceding Sunday (or Monday)
  // Day of week: 0 = Sun, 1 = Mon, ..., 6 = Sat
  const dayOffset = startDate.getDay(); // Sunday is 0
  const adjustedStart = new Date(startDate);
  adjustedStart.setDate(startDate.getDate() - dayOffset);

  const weeks = [];
  let currentWeek = [];
  const monthLabels = [];
  let currentMonth = -1;

  const walker = new Date(adjustedStart);
  let weekIndex = 0;

  while (walker <= endDate || currentWeek.length > 0) {
    const dateKey = formatToDateKey(walker.getTime());
    const dayData = dateMap.get(dateKey) || {
      date: dateKey,
      count: 0,
      totalSeconds: 0,
      songs: [],
      topSong: null,
      level: 0
    };

    const isCurrentYearDay = walker.getFullYear() === year;
    const isFuture = walker > new Date();

    currentWeek.push({
      ...dayData,
      date: dateKey,
      dayOfMonth: walker.getDate(),
      month: walker.getMonth(),
      year: walker.getFullYear(),
      dayOfWeek: walker.getDay(),
      isCurrentYearDay,
      isFuture
    });

    // Check for new month label position
    if (walker.getFullYear() === year && walker.getMonth() !== currentMonth && walker.getDate() <= 7) {
      currentMonth = walker.getMonth();
      const monthNames = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
      monthLabels.push({
        month: currentMonth,
        name: monthNames[currentMonth],
        weekIndex
      });
    }

    if (currentWeek.length === 7) {
      weeks.push(currentWeek);
      currentWeek = [];
      weekIndex += 1;
    }

    walker.setDate(walker.getDate() + 1);

    // Stop condition: passed end date and finished current week
    if (walker > endDate && currentWeek.length === 0) {
      break;
    }
  }

  if (currentWeek.length > 0) {
    while (currentWeek.length < 7) {
      const dateKey = formatToDateKey(walker.getTime());
      currentWeek.push({
        date: dateKey,
        count: 0,
        songs: [],
        topSong: null,
        level: 0,
        isCurrentYearDay: walker.getFullYear() === year,
        isFuture: true
      });
      walker.setDate(walker.getDate() + 1);
    }
    weeks.push(currentWeek);
  }

  return {
    weeks,
    monthLabels,
    weekDayLabels: ['日', '一', '二', '三', '四', '五', '六']
  };
}

// Generate Month Calendar Grid for Month View
export function generateMonthGrid(year, month, dateMap) {
  // month is 0-indexed (0 = Jan, 11 = Dec)
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const totalDays = lastDay.getDate();

  const startDayOfWeek = firstDay.getDay(); // 0 = Sun
  const weeks = [];
  let currentWeek = [];

  // Pad previous month days
  for (let i = 0; i < startDayOfWeek; i++) {
    const prevDate = new Date(year, month, 1 - (startDayOfWeek - i));
    const dateKey = formatToDateKey(prevDate.getTime());
    const dayData = dateMap.get(dateKey) || { date: dateKey, count: 0, songs: [], topSong: null, level: 0 };
    currentWeek.push({
      ...dayData,
      day: prevDate.getDate(),
      isCurrentMonth: false,
      isFuture: prevDate > new Date()
    });
  }

  // Current month days
  for (let day = 1; day <= totalDays; day++) {
    const currentDate = new Date(year, month, day);
    const dateKey = formatToDateKey(currentDate.getTime());
    const dayData = dateMap.get(dateKey) || { date: dateKey, count: 0, songs: [], topSong: null, level: 0 };

    currentWeek.push({
      ...dayData,
      day,
      isCurrentMonth: true,
      isFuture: currentDate > new Date()
    });

    if (currentWeek.length === 7) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
  }

  // Pad next month days
  if (currentWeek.length > 0) {
    let nextDay = 1;
    while (currentWeek.length < 7) {
      const nextDate = new Date(year, month + 1, nextDay);
      const dateKey = formatToDateKey(nextDate.getTime());
      const dayData = dateMap.get(dateKey) || { date: dateKey, count: 0, songs: [], topSong: null, level: 0 };
      currentWeek.push({
        ...dayData,
        day: nextDay,
        isCurrentMonth: false,
        isFuture: true
      });
      nextDay += 1;
    }
    weeks.push(currentWeek);
  }

  return {
    weeks,
    year,
    month,
    monthName: `${year}年 ${month + 1}月`,
    weekDayLabels: ['日', '一', '二', '三', '四', '五', '六']
  };
}
