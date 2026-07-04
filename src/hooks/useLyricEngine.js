import { useState, useEffect, useRef } from 'react';
import { parseLrc, parseYrc, mergeTranslation, computeLineDurations } from '../utils/lyrics/lyricParser';
import { api } from '../utils/api';

export function useLyricEngine(songId, audioElement) {
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

  // Attach helper methods to the ref
  engineRef.current.getCurrentTime = () => engineRef.current.currentTime || audioElement?.currentTime || 0;

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
      // 1. Try local cache
      const cacheKey = `lyrics_cache_${songId}`;
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        try {
          const parsedCache = JSON.parse(cached);
          if (isMounted) {
            setLyrics(parsedCache);
            engineRef.current.lyrics = parsedCache;
            engineRef.current.activeIndex = -1;
            setActiveLineIndex(-1);
            setIsLoading(false);
          }
          // We can return early to avoid API call, but we might want to refresh. Let's return.
          return;
        } catch (e) {
          // ignore cache error
        }
      }

      // 2. Fetch from API
      try {
        const res = await api.getLyrics(songId);
        if (!isMounted) return;

        let parsedLines = [];
        
        // Prefer YRC if available
        if (res.yrc && res.yrc.lyric) {
          parsedLines = parseYrc(res.yrc.lyric);
        }
        
        // Fallback to LRC
        if (parsedLines.length === 0 && res.lrc && res.lrc.lyric) {
          parsedLines = parseLrc(res.lrc.lyric);
        }

        // Merge translations
        if (res.tlyric && res.tlyric.lyric && parsedLines.length > 0) {
          parsedLines = mergeTranslation(parsedLines, res.tlyric.lyric);
        }

        // Compute durations & interludes
        parsedLines = computeLineDurations(parsedLines);

        // Cache result
        if (parsedLines.length > 0) {
          try {
            localStorage.setItem(cacheKey, JSON.stringify(parsedLines));
          } catch (e) {
            console.warn('Failed to cache lyrics', e);
          }
        }

        if (isMounted) {
          setLyrics(parsedLines);
          engineRef.current.lyrics = parsedLines;
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
  }, [songId]);

  // Main synchronization loop (rAF)
  useEffect(() => {
    if (!audioElement || lyrics.length === 0) return;

    let rafId;
    const updateActiveLine = () => {
      const currentTime = audioElement.currentTime;
      engineRef.current.currentTime = currentTime;

      const currentLyrics = engineRef.current.lyrics;
      if (currentLyrics.length > 0) {
        let newIndex = -1;
        const currIdx = engineRef.current.activeIndex;
        
        // Fast path: still in the same line
        if (currIdx >= 0 && currIdx < currentLyrics.length) {
          const line = currentLyrics[currIdx];
          if (currentTime >= line.time && currentTime < line.time + line.duration) {
            newIndex = currIdx;
          }
        }

        // Slow path: linear search backward (handles seeking)
        if (newIndex === -1) {
          for (let i = currentLyrics.length - 1; i >= 0; i--) {
            if (currentTime >= currentLyrics[i].time) {
              newIndex = i;
              break;
            }
          }
        }

        // Only trigger React state update if the index actually changed
        if (newIndex !== engineRef.current.activeIndex) {
          engineRef.current.activeIndex = newIndex;
          setActiveLineIndex(newIndex);
        }
      }

      rafId = requestAnimationFrame(updateActiveLine);
    };

    rafId = requestAnimationFrame(updateActiveLine);

    return () => {
      cancelAnimationFrame(rafId);
    };
  }, [audioElement, lyrics]);

  return { lyrics, activeLineIndex, isLoading, engineRef };
}
