// src/utils/listeningHeatmap.js - Listening Heatmap and Calendar Analytics Utility
import { api } from './api.js';
import { saveLocalLogs, getLocalLogs, STATS_STORAGE_KEY } from './listeningStats.js';

export function getLocalListeningLogs() {
  return getLocalLogs();
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

// Fetch Remote Recent Songs and normalize to footprint records from multiple Cloud & PC endpoints
export async function fetchRemoteRecentTracks(limit = 300) {
  const rawEntries = [];

  // 1. Fetch from standard cloud recent songs endpoint (/record/recent/song)
  try {
    const res = await api.getRecentSongs(limit);
    const list = res?.data?.list || res?.list || [];
    if (Array.isArray(list)) {
      list.forEach(item => {
        const songData = item.data || item.song || item;
        const playTime = item.playTime || item.timestamp || Date.now();
        if (songData?.id) {
          rawEntries.push({
            id: songData.id,
            name: songData.name || songData.title || '未知歌曲',
            artist: songData.ar?.map(a => a.name).join(' / ') || songData.artists?.map(a => a.name).join(' / ') || songData.artist || '未知歌手',
            album: songData.al?.name || songData.album?.name || '',
            coverUrl: songData.al?.picUrl || songData.album?.picUrl || songData.coverUrl || '',
            duration: Math.round((songData.dt || songData.duration || 0) / 1000) || 180,
            seconds: Math.round((songData.dt || songData.duration || 0) / 1000) || 180,
            timestamp: playTime,
            date: formatToDateKey(playTime)
          });
        }
      });
    }
  } catch (err) {
    console.debug('Failed to fetch remote recent songs:', err);
  }

  // 2. Fetch from PC client recent listen list (/recent/listen/list) for extra historical coverage
  try {
    const pcRes = await api.getRecentListenList();
    const pcList = pcRes?.data?.list || pcRes?.list || pcRes?.data || [];
    if (Array.isArray(pcList)) {
      pcList.forEach(item => {
        const songData = item.song || item.data || item;
        const playTime = item.playTime || item.timestamp || item.time || Date.now();
        if (songData?.id) {
          rawEntries.push({
            id: songData.id,
            name: songData.name || songData.title || '未知歌曲',
            artist: songData.ar?.map(a => a.name).join(' / ') || songData.artists?.map(a => a.name).join(' / ') || songData.artist || '未知歌手',
            album: songData.al?.name || songData.album?.name || '',
            coverUrl: songData.al?.picUrl || songData.album?.picUrl || songData.coverUrl || '',
            duration: Math.round((songData.dt || songData.duration || 0) / 1000) || 180,
            seconds: Math.round((songData.dt || songData.duration || 0) / 1000) || 180,
            timestamp: playTime,
            date: formatToDateKey(playTime)
          });
        }
      });
    }
  } catch (err) {
    console.debug('Failed to fetch PC recent listen list:', err);
  }

  return rawEntries.filter(t => t.id && t.date);
}
// Aggregate All Listening Footprints (Local Logs + Remote Records)
export async function getListeningHeatmapData(selectedYear = new Date().getFullYear()) {
  let localLogs = getLocalListeningLogs();

  // Pull from C-Drive Durable Disk Vault (survives uninstall & web cache clears)
  if (window.electronAPI?.getListeningHistoryVault) {
    try {
      const diskVaultLogs = await window.electronAPI.getListeningHistoryVault();
      if (Array.isArray(diskVaultLogs) && diskVaultLogs.length > 0) {
        const tempSeen = new Set();
        const mergedFromVault = [];
        [...diskVaultLogs, ...localLogs].forEach(item => {
          if (!item || !item.id) return;
          const ts = Number(item.timestamp) || Date.now();
          const key = `${item.id}_${Math.floor(ts / 60000)}`;
          if (!tempSeen.has(key)) {
            tempSeen.add(key);
            mergedFromVault.push(item);
          }
        });
        localLogs = mergedFromVault;
      }
    } catch (err) {
      console.warn('Failed to read durable listening vault from disk:', err);
    }
  }

  const remoteLogs = await fetchRemoteRecentTracks(300);

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

  // Merge and deduplicate records: songs with same id within 180s are treated as 1 single play session
  const sortedRaw = [...normalizedLocal, ...remoteLogs]
    .filter(entry => entry && entry.id)
    .sort((a, b) => (Number(a.timestamp) || 0) - (Number(b.timestamp) || 0));

  const allLogs = [];
  for (const entry of sortedRaw) {
    const ts = Number(entry.timestamp) || Date.now();
    const songId = String(entry.id);
    const last = allLogs[allLogs.length - 1];

    if (last && String(last.id) === songId && Math.abs(ts - (Number(last.timestamp) || 0)) <= 180000) {
      last.seconds = Math.max(Number(last.seconds || 0), Number(entry.seconds || 0));
      last.duration = last.seconds;
      last.timestamp = Math.max(Number(last.timestamp || 0), ts);
      last.date = last.date || entry.date || formatToDateKey(ts);
    } else {
      allLogs.push({
        ...entry,
        timestamp: ts,
        date: entry.date || formatToDateKey(ts)
      });
    }
  }

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
