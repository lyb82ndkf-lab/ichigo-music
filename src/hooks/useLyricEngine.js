import { useState, useEffect, useRef } from 'react';
import { parseLrc, parseYrc, mergeTranslation, computeLineDurations } from '../utils/lyrics/lyricParser';
import { api } from '../utils/api';

function getDurationSec(songMeta) {
  const raw = songMeta?.durationMs ?? songMeta?.duration ?? songMeta?.dt ?? 0;
  const value = Number(raw || 0);
  return value > 1000 ? value / 1000 : value;
}

function hasWordTimedLyrics(lines) {
  return (lines || []).some(line => line?.isYrc && Array.isArray(line.words) && line.words.length >= 2);
}

function getRealLyricLines(lines) {
  return (lines || []).filter(line => line && line.text && !/^\.+$/.test(line.text.trim()));
}

function assessLyricQuality(lines, durationSec = 0) {
  const realLines = getRealLyricLines(lines);
  const creditPrefixes = ['\u4f5c\u8bcd', '\u4f5c\u66f2', '\u7f16\u66f2', '\u8bcd', '\u66f2', 'composer', 'lyricist', 'lyrics'];
  const isCreditLine = (line) => {
    const text = line.text.trim().toLowerCase();
    return creditPrefixes.some(prefix => text.startsWith(prefix.toLowerCase() + ':') || text.startsWith(prefix.toLowerCase() + '\uff1a'))
      || /^(?:\u76d1\u5236|\u5236\u4f5c\u4eba|\u6df7\u97f3|\u5f55\u97f3|\u5409\u4ed6|\u94a2\u7434|\u8d1d\u65af|\u6bcd\u5e26|arranger|producer|mix|mastering|vocal)\s*[:\uff1a]/i.test(text);
  };
  const creditLineCount = realLines.filter(isCreditLine).length;
  const creditOnly = realLines.length > 0 && realLines.length <= 8 && creditLineCount / realLines.length >= 0.6;
  const instrumentalLike = realLines.length <= 3 && realLines.some(line => /\u7eaf\u97f3\u4e50|instrumental|off\s*vocal|karaoke|\u8bf7\u6b23\u8d4f|\u7eaf\u97f3|\u65e0\u4eba\u58f0/i.test(line.text));

  const wordTimed = hasWordTimedLyrics(realLines);
  const lastEnd = realLines.reduce((max, line) => Math.max(max, Number(line.time || 0) + Number(line.duration || 0)), 0);
  const firstStart = realLines.reduce((min, line) => Math.min(min, Number(line.time || 0)), Number.POSITIVE_INFINITY);
  const coverage = durationSec > 0 ? lastEnd / durationSec : 1;
  const timeSpread = Number.isFinite(firstStart) ? Math.max(0, lastEnd - firstStart) : 0;
  const timedLineCount = realLines.filter(line => Number.isFinite(line.time) && line.time >= 0).length;

  let score = 0;
  score += Math.min(30, realLines.length * 1.4);
  if (wordTimed) score += 45;
  if (durationSec > 0) {
    if (coverage >= 0.55) score += 15;
    else if (coverage >= 0.35) score += 8;
    else score -= 18;
    if (lastEnd > durationSec + 15) score -= 16;
  }
  if (timedLineCount >= 3 && timeSpread > 10) score += 10;
  if (creditOnly && !instrumentalLike) score -= 100;
  if (realLines.length < 10 && !instrumentalLike) score -= 60;

  const lowQuality = !instrumentalLike && (realLines.length === 0
    || creditOnly
    || realLines.length < 10
    || (durationSec >= 90 && realLines.length <= 4)
    || (durationSec >= 90 && coverage > 0 && coverage < 0.28 && realLines.length < 10)
    || (timedLineCount >= 2 && timeSpread < 5));

  return { lowQuality, score, wordTimed, realLineCount: realLines.length, coverage, lastEnd, instrumentalLike, creditLineCount };
}

function isLowQualityLyric(lines, durationSec = 0) {
  return assessLyricQuality(lines, durationSec).lowQuality;
}

function normalizeMatchedLines(result) {
  const lines = result?.data?.lines || result?.lines || [];
  const source = result?.data?.source || result?.source || 'matched';
  return Array.isArray(lines)
    ? lines.map(line => ({ ...line, lyricSource: line.lyricSource || source }))
    : [];
}

function getSongField(songMeta, keys) {
  for (const key of keys) {
    const value = songMeta?.[key];
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return '';
}

function getArtistName(songMeta) {
  const artists = songMeta?.artists || songMeta?.ar || songMeta?.singer;
  if (Array.isArray(artists)) return artists.map(a => a?.name || a).filter(Boolean).join('/');
  return artists || songMeta?.artist || '';
}


export function useLyricEngine(songId, audioElement, songMeta = null, lyricSources = 'amll,qq,kugou') {
  const [lyrics, setLyrics] = useState([]);
  const [activeLineIndex, setActiveLineIndex] = useState(-1);
  const [isLoading, setIsLoading] = useState(false);
  
  // engineRef holds mutable state that shouldn't trigger re-renders
  const engineRef = useRef({
    lyrics: [],
    activeIndex: -1,
    currentTime: 0,
    getLineProgress: () => 0,
    getWordProgress: () => 0
  });

  // Attach helper methods to the ref.  The visual word-sweep rAF needs the
  // media element's live clock, not the lower-frequency active-line snapshot.
  // Falling back to the snapshot keeps lyrics usable before the element exists.
  engineRef.current.getCurrentTime = () => {
    const mediaTime = audioElement?.currentTime;
    return Number.isFinite(mediaTime) ? mediaTime : (engineRef.current.currentTime || 0);
  };

  engineRef.current.getLineProgress = (lineIndex) => {
    const line = engineRef.current.lyrics[lineIndex];
    if (!line) return 0;
    const t = engineRef.current.currentTime;
    if (t < line.time) return 0;
    if (t >= line.time + line.duration) return 100;
    return Math.max(0, Math.min(100, ((t - line.time) / line.duration) * 100));
  };

  engineRef.current.getWordProgress = (lineIndex, wordIndex) => {
    const line = engineRef.current.lyrics[lineIndex];
    if (!line || !line.isYrc || !line.words[wordIndex]) return 0;
    const word = line.words[wordIndex];
    const t = engineRef.current.currentTime;
    if (t < word.startSec) return 0;
    if (t >= word.endSec) return 100;
    return Math.max(0, Math.min(100, ((t - word.startSec) / word.durationSec) * 100));
  };

  // Fetch and parse lyrics
  useEffect(() => {
    if (!songId) return;

    let isMounted = true;
    setIsLoading(true);

    const fetchLyrics = async () => {
      const durationSec = getDurationSec(songMeta || {});
      const durationMs = durationSec > 0 ? Math.round(durationSec * 1000) : undefined;
      const cacheKey = `lyrics_cache_v5_${songId}_${lyricSources || 'auto'}_${durationMs || 0}`;
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        try {
          const parsedCache = JSON.parse(cached);
          const cacheQuality = assessLyricQuality(parsedCache, durationSec);
          const cacheCanSatisfy = !cacheQuality.lowQuality && (lyricSources === 'netease' || cacheQuality.wordTimed || cacheQuality.instrumentalLike);
          if (cacheCanSatisfy) {
            if (isMounted) {
              setLyrics(parsedCache);
              engineRef.current.lyrics = parsedCache;
              engineRef.current.activeIndex = -1;
              setActiveLineIndex(-1);
              setIsLoading(false);
            }
            return;
          }
          localStorage.removeItem(cacheKey);
        } catch (e) {
          localStorage.removeItem(cacheKey);
        }
      }

      try {
        const res = await api.getLyrics(songId);
        if (!isMounted) return;

        let neteaseLines = [];
        if (res.yrc && res.yrc.lyric) neteaseLines = parseYrc(res.yrc.lyric);
        if (neteaseLines.length === 0 && res.lrc && res.lrc.lyric) neteaseLines = parseLrc(res.lrc.lyric);
        if (res.tlyric && res.tlyric.lyric && neteaseLines.length > 0) {
          neteaseLines = mergeTranslation(neteaseLines, res.tlyric.lyric);
        }
        neteaseLines = computeLineDurations(neteaseLines).map(line => ({ ...line, lyricSource: line.lyricSource || 'netease' }));

        let bestLines = neteaseLines;
        let bestQuality = assessLyricQuality(neteaseLines, durationSec);
        const allowMatchedSources = lyricSources !== 'netease';
        const shouldTryMatched = allowMatchedSources && (bestQuality.lowQuality || !bestQuality.wordTimed);

        if (shouldTryMatched && songMeta) {
          try {
            const matched = await api.getMatchedLyrics({
              id: songId,
              title: getSongField(songMeta, ['name', 'title']),
              artist: getArtistName(songMeta),
              album: songMeta?.album?.name || songMeta?.al?.name || songMeta?.album || '',
              durationMs,
              sources: lyricSources || 'amll,qq,kugou'
            });
            const matchedLines = computeLineDurations(normalizeMatchedLines(matched));
            const matchedQuality = assessLyricQuality(matchedLines, durationSec);
            if (matchedLines.length > 0 && !matchedQuality.lowQuality && (bestQuality.lowQuality || matchedQuality.wordTimed || matchedQuality.score > bestQuality.score + 8)) {
              bestLines = matchedLines;
              bestQuality = matchedQuality;
            }
          } catch (matchErr) {
            console.warn('Failed to match enhanced lyrics:', matchErr);
          }
        }

        if (bestLines.length > 0 && !bestQuality.lowQuality && (lyricSources === 'netease' || bestQuality.wordTimed || bestQuality.instrumentalLike)) {
          try {
            localStorage.setItem(cacheKey, JSON.stringify(bestLines));
          } catch (e) {
            console.warn('Failed to cache lyrics', e);
          }
        }

        if (bestQuality.lowQuality && !bestQuality.instrumentalLike) {
          bestLines = [];
        }

        if (bestLines.length === 0) {
          bestLines = [{
            time: 0,
            duration: durationSec > 0 ? durationSec : 999999,
            text: '暂时没有获取对应歌词',
            isYrc: false
          }];
        }

        if (isMounted) {
          setLyrics(bestLines);
          engineRef.current.lyrics = bestLines;
          engineRef.current.activeIndex = -1;
          setActiveLineIndex(-1);
          setIsLoading(false);
        }
      } catch (err) {
        console.error('Failed to fetch lyrics:', err);
        if (isMounted) setIsLoading(false);
      }
    };

    fetchLyrics();

    return () => {
      isMounted = false;
    };
  }, [songId, songMeta, lyricSources]);

  // Main synchronization loop: line-level sync does not need a per-frame rAF
  useEffect(() => {
    if (!audioElement || lyrics.length === 0) return;

    const findActiveIndex = (currentTime, currentLyrics, preferredIndex) => {
      if (preferredIndex >= 0 && preferredIndex < currentLyrics.length) {
        const line = currentLyrics[preferredIndex];
        if (currentTime >= line.time && currentTime < line.time + line.duration) {
          return preferredIndex;
        }

        const nextIndex = preferredIndex + 1;
        const nextLine = currentLyrics[nextIndex];
        if (nextLine && currentTime >= nextLine.time && currentTime < nextLine.time + nextLine.duration) {
          return nextIndex;
        }
      }

      let low = 0;
      let high = currentLyrics.length - 1;
      let result = -1;
      while (low <= high) {
        const mid = (low + high) >> 1;
        if (currentTime >= currentLyrics[mid].time) {
          result = mid;
          low = mid + 1;
        } else {
          high = mid - 1;
        }
      }
      return result;
    };

    const updateActiveLine = () => {
      const currentTime = audioElement.currentTime || 0;
      engineRef.current.currentTime = currentTime;

      const currentLyrics = engineRef.current.lyrics;
      if (currentLyrics.length > 0) {
        const newIndex = findActiveIndex(currentTime, currentLyrics, engineRef.current.activeIndex);

        if (newIndex !== engineRef.current.activeIndex) {
          engineRef.current.activeIndex = newIndex;
          setActiveLineIndex(newIndex);
        }
      }
    };

    updateActiveLine();
    const intervalId = window.setInterval(updateActiveLine, 80);
    audioElement.addEventListener('seeked', updateActiveLine);
    audioElement.addEventListener('timeupdate', updateActiveLine);

    return () => {
      window.clearInterval(intervalId);
      audioElement.removeEventListener('seeked', updateActiveLine);
      audioElement.removeEventListener('timeupdate', updateActiveLine);
    };
  }, [audioElement, lyrics]);

  return { lyrics, activeLineIndex, isLoading, engineRef };
}
