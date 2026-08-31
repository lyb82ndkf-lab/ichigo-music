import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { isLegacyFileMediaSource, isLocalMediaSource, isStreamMediaSource } from '../utils/audioSource';
import { api } from '../utils/api';
import { recordPlayEvent } from '../utils/listeningStats';
import { appendRuntimeLog } from '../utils/runtimeLog';
import { EQ_BAND_FREQUENCIES } from '../utils/settingsProfile';
function isWebAudioEligibleSource(source) {
  if (!source) return false;
  if (isLocalMediaSource(source) || isStreamMediaSource(source)) return true;
  try {
    return new URL(source, window.location.href).origin === window.location.origin;
  } catch {
    return false;
  }
}

export default function AudioPlayer({ canControlPlayback = true }) {
  const {
    currentSong,
    isPlaying,
    setIsPlaying,
    volume,
    setProgress,
    setDuration,
    playNext,
    setAudioElement,
    playMode,
    resumeTime,
    setResumeTime,
    playSong,
    refreshRecentlyPlayed,
    audioConfig
  } = useApp();

  const audioRef = useRef(null);
  const [crossOriginMode, setCrossOriginMode] = useState('anonymous');
  const [audioSource, setAudioSource] = useState('');

  // Audio Context, Equalizer, Analyzer and Fader references
  const audioContextRef = useRef(null);
  const sourceNodeRef = useRef(null);
  const sourceElementRef = useRef(null);
  const eqFiltersRef = useRef([]);
  const gainNodeRef = useRef(null);
  const analyserNodeRef = useRef(null);
  const playRequestIdRef = useRef(0);
  const playPendingRef = useRef(null);
  const lastLoadedKeyRef = useRef('');
  const zeroTimeRecoveryRef = useRef({ key: '', attempts: 0, startedAt: 0 });
  const urlRefreshAttemptRef = useRef({ songId: null, count: 0 });
  const playbackIntentRef = useRef(isPlaying);
  const currentSongRef = useRef(currentSong);
  const sourceTransitionRef = useRef(false);
  const errorSkipTimerRef = useRef(null);
  const sourceSongIdRef = useRef(null);
  // The raw (non-proxied) source for the current track. When the local stream
  // proxy fails we fall back to this URL so playback is never blocked by the
  // visualizer layer.
  const rawSourceRef = useRef('');
  // One report is emitted at the end of a listening session.
  const scrobbleRef = useRef({ songId: null, lastTime: 0, reported: false, inFlight: false });

  playbackIntentRef.current = isPlaying;
  currentSongRef.current = currentSong;

  const reportScrobble = (playedSeconds, force = false) => {
    const song = currentSong;
    const audio = audioRef.current;
    if (!song?.id || !audio) return;
    if (scrobbleRef.current.songId !== song.id) {
      scrobbleRef.current = { songId: song.id, lastTime: 0, reported: false, inFlight: false, localLogged: false };
    }
    const total = Number.isFinite(audio.duration) && audio.duration > 0
      ? audio.duration
      : Number(song.durationMs || song.dt || song.duration || 0) / 1000;
    const played = Math.max(scrobbleRef.current.lastTime, Number(playedSeconds) || 0);
    scrobbleRef.current.lastTime = played;
    const minimum = total > 0 ? Math.min(30, Math.max(3, total * 0.1)) : 3;
    if (played < minimum || scrobbleRef.current.reported || scrobbleRef.current.inFlight) return;
    if (!force && total > 0 && played < total * 0.95) return;

    // Record into local permanent history exactly once per song play
    if (!scrobbleRef.current.localLogged) {
      scrobbleRef.current.localLogged = true;
      recordPlayEvent({ song, playedSeconds: played, totalDuration: total });
    }
    const sourceid = song.sourceid || song.sourceId || song.playlistId
      || song.al?.id || song.album?.id || song.id;
    const payload = {
      id: song.id,
      time: Math.min(played, total > 0 ? total : played),
      total: total > 0 ? total : played,
      sourceid,
      name: song.name || song.title,
      artist: song.artist || song.ar?.map(item => item.name).join(' / ') || song.artists?.map(item => item.name).join(' / '),
      level: 'exhigh'
    };
    scrobbleRef.current.inFlight = true;
    const assertScrobbleResponse = (result) => {
      const codes = [
        result?.code,
        result?.details?.startplay?.code,
        result?.details?.play?.code,
        result?.details?.plv?.code,
        result?.details?.pld?.code
      ].filter(code => code !== undefined && code !== null).map(Number);
      if (codes.some(code => Number.isFinite(code) && code !== 200)) {
        throw new Error(`scrobble response code ${codes.find(code => code !== 200)}`);
      }
      return result;
    };
    const markSynced = (endpoint, extra = {}) => {
      if (scrobbleRef.current.songId !== song.id) return;
      scrobbleRef.current.reported = true;
      appendRuntimeLog('info', 'Cloud playback record synced', {
        songId: song.id,
        playedSeconds: payload.time,
        totalSeconds: payload.total,
        endpoint,
        ...extra
      }, 'audio');
      window.setTimeout(() => refreshRecentlyPlayed?.(), 1800);
    };
    api.scrobble(payload)
      .then(result => {
        assertScrobbleResponse(result);
        markSynced('/scrobble');
      })
      .catch(async (legacyError) => {
        try {
          const result = await api.scrobbleV1(payload);
          assertScrobbleResponse(result);
          markSynced('/scrobble/v1', { fallback: true });
        } catch (fallbackError) {
          appendRuntimeLog('warn', '云端播放记录同步失败，将在下次切歌时重试', {
            songId: song.id,
            playedSeconds: payload.time,
            legacyError: legacyError?.message || String(legacyError || ''),
            fallbackError: fallbackError?.message || String(fallbackError || '')
          }, 'audio');
        }
      })
      .finally(() => {
        if (scrobbleRef.current.songId === song.id) {
          scrobbleRef.current.inFlight = false;
        }
      });
  };

  useEffect(() => {
    const songId = currentSong?.id;
    return () => {
      if (songId && scrobbleRef.current.songId === songId) {
        reportScrobble(scrobbleRef.current.lastTime, true);
      }
    };
  }, [currentSong?.id]);

  useEffect(() => {
    return () => {
      if (sourceNodeRef.current) {
        try {
          sourceNodeRef.current.disconnect();
        } catch (err) {}
      }
      eqFiltersRef.current.forEach((filter) => {
        try { filter.disconnect(); } catch (err) {}
      });
      eqFiltersRef.current = [];
      if (gainNodeRef.current) {
        try { gainNodeRef.current.disconnect(); } catch (err) {}
      }
      gainNodeRef.current = null;
      sourceNodeRef.current = null;
      sourceElementRef.current = null;
      delete window.ichigoAnalyser;
      delete window.ichigoAudioContext;
    };
  }, []);
  const safePlay = () => {
    const audio = audioRef.current;
    if (!audio || !audioSource || !playbackIntentRef.current) return;
    const requestKey = `${currentSong?.id || ''}|${audioSource}|${crossOriginMode ?? 'no-cors'}`;
    if (playPendingRef.current?.key === requestKey) return;
    if (!audio.paused && !audio.ended) return;

    appendRuntimeLog('debug', '请求播放音频', {
      songId: currentSong?.id || null,
      source: isLocalMediaSource(audioSource) ? 'local-cache' : 'remote',
      readyState: audio.readyState,
      networkState: audio.networkState
    }, 'audio');
    const localSourceUnavailable = (
      isLocalMediaSource(audioSource)
      && Boolean(audio.error)
      && audio.readyState === HTMLMediaElement.HAVE_NOTHING
      && audio.networkState === HTMLMediaElement.NETWORK_NO_SOURCE
    );
    if (localSourceUnavailable && currentSong?.id) {
      const retry = urlRefreshAttemptRef.current;
      if (retry.count < 1) {
        urlRefreshAttemptRef.current = { songId: currentSong.id, count: retry.count + 1 };
        appendRuntimeLog('warn', 'Local audio cache unavailable; refreshing source', {
          songId: currentSong.id,
          readyState: audio.readyState,
          networkState: audio.networkState
        }, 'audio');
        playSong(currentSong, null, audio.currentTime || 0, { forceRefreshUrl: true });
        return;
      }
    }
    const requestId = ++playRequestIdRef.current;
    playPendingRef.current = { key: requestKey, requestId };
    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise.then(() => {
        if (playPendingRef.current?.requestId === requestId) playPendingRef.current = null;
      }).catch(error => {
        if (playPendingRef.current?.requestId === requestId) playPendingRef.current = null;
        if (requestId !== playRequestIdRef.current) return;
        if (error?.name === 'AbortError') return;
        if (!playbackIntentRef.current || sourceTransitionRef.current) return;
        console.warn('Playback prevented or error occurred:', error);
        const mediaCode = audio.error?.code;
        const retry = urlRefreshAttemptRef.current;
        const sourceRejected = error?.name === 'NotSupportedError' || mediaCode === 2 || mediaCode === 3 || mediaCode === 4;
        if (sourceRejected && currentSong?.id && retry.count < 1) {
          urlRefreshAttemptRef.current = { songId: currentSong.id, count: retry.count + 1 };
          playSong(currentSong, null, audio.currentTime || 0, { forceRefreshUrl: true });
          return;
        }
        setIsPlaying(false);
      });
    } else {
      playPendingRef.current = null;
    }
  };

  // Sync volume
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume, audioSource]);

  // Sync source loading and play/pause from one place
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !audioSource) return;

    const loadKey = `${audioSource}|${crossOriginMode ?? 'no-cors'}`;
    if (lastLoadedKeyRef.current !== loadKey) {
      lastLoadedKeyRef.current = loadKey;
      playPendingRef.current = null;
      playRequestIdRef.current += 1;
      sourceTransitionRef.current = true;
      audio.load();
    }

    if (playbackIntentRef.current) {
      safePlay();
    } else {
      audio.pause();
    }
  }, [isPlaying, audioSource, crossOriginMode]);

  // Handle song change
  useEffect(() => {
    playPendingRef.current = null;
    if (audioRef.current) {
      audioRef.current._hasRetriedUrl = false;
    }
    if (urlRefreshAttemptRef.current.songId !== currentSong?.id) {
      urlRefreshAttemptRef.current = { songId: currentSong?.id || null, count: 0 };
    }
    if (currentSong?.url) {
      sourceTransitionRef.current = true;
      const isNewSong = sourceSongIdRef.current !== currentSong.id;
      sourceSongIdRef.current = currentSong.id;
      if (isNewSong && audioRef.current) {
        try {
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
        } catch {}
      }
      setProgress(0);
      setDuration(0);
      const persistedSource = isLegacyFileMediaSource(currentSong.url) ? '' : currentSong.url;
      if (!persistedSource) {
        lastLoadedKeyRef.current = '';
        playRequestIdRef.current += 1;
        setAudioSource('');
        setCrossOriginMode('anonymous');
        appendRuntimeLog('info', '音频源已提交', {
          songId: currentSong.id || null,
          source: 'legacy-file',
          hasResumeTime: resumeTime !== null
        }, 'audio');
        return;
      }
      zeroTimeRecoveryRef.current = { key: persistedSource, attempts: 0, startedAt: Date.now() };
      rawSourceRef.current = persistedSource;
      const canProxy = !isLegacyFileMediaSource(persistedSource) && !!window.electronAPI?.getAudioStreamUrl;
      setCrossOriginMode(canProxy ? 'anonymous' : null);
      if (!canProxy) window.ichigoAnalyser = null;
      let cancelled = false;
      const commitSource = (src) => {
        if (!cancelled) setAudioSource(src);
      };
      if (!canProxy) {
        commitSource(persistedSource);
      } else {
        window.electronAPI.getAudioStreamUrl(persistedSource)
          .then(proxied => commitSource(proxied || persistedSource))
          .catch(() => commitSource(persistedSource));
      }
      appendRuntimeLog('info', '音频源已提交', {
        songId: currentSong.id || null,
        source: isLocalMediaSource(currentSong.url) ? 'local-cache' : 'remote',
        hasResumeTime: resumeTime !== null
      }, 'audio');
      return () => { cancelled = true; };
    } else {
      lastLoadedKeyRef.current = '';
      playRequestIdRef.current += 1;
      sourceSongIdRef.current = null;
      if (audioRef.current) {
        try {
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
        } catch {}
      }
      setAudioSource('');
      setCrossOriginMode('anonymous');
    }
  }, [currentSong?.url]);

  useEffect(() => {
    if (errorSkipTimerRef.current) {
      window.clearTimeout(errorSkipTimerRef.current);
      errorSkipTimerRef.current = null;
    }
    return () => {
      if (errorSkipTimerRef.current) {
        window.clearTimeout(errorSkipTimerRef.current);
        errorSkipTimerRef.current = null;
      }
    };
  }, [currentSong?.id]);

  // Recovery for startup stalls: if requested to play but media clock never starts,
  // first bypass the local stream proxy and fall back to raw CDN source, then reload,
  // and finally force-refresh/unblock the song URL.
  useEffect(() => {
    if (!isPlaying || !audioSource) return undefined;

    const timerId = window.setInterval(() => {
      const audio = audioRef.current;
      if (!audio || !isPlaying) return;
      const stuckAtStart = (audio.currentTime || 0) < 0.05;
      const stillLoading = audio.readyState < HTMLMediaElement.HAVE_CURRENT_DATA;
      if (!stuckAtStart) return;
      const elapsed = Date.now() - (zeroTimeRecoveryRef.current.startedAt || Date.now());
      if (stillLoading && !audio.error && elapsed < 3500) return;

      const key = `${audioSource}|${crossOriginMode ?? 'no-cors'}`;
      const recovery = zeroTimeRecoveryRef.current;
      if (recovery.key !== key) {
        recovery.key = key;
        recovery.attempts = 0;
        recovery.startedAt = Date.now();
      }

      if (audio.paused) {
        if (recovery.attempts >= 2) return;
        safePlay();
        return;
      }

      // Step 1: Fallback from stream proxy to direct CDN URL
      if (recovery.attempts === 0 && (crossOriginMode === 'anonymous' || isStreamMediaSource(audioSource))) {
        recovery.attempts += 1;
        window.ichigoAnalyser = null;
        setCrossOriginMode(null);
        if (rawSourceRef.current && audioSource !== rawSourceRef.current) {
          appendRuntimeLog('warn', '音频流代理无响应，已自动切换为直连直出', {
            songId: currentSong?.id || null,
            rawSource: rawSourceRef.current.slice(0, 80)
          }, 'audio');
          setAudioSource(rawSourceRef.current);
        }
        return;
      }

      // Step 2: Reload and retry playback directly
      if (recovery.attempts < 2) {
        recovery.attempts += 1;
        sourceTransitionRef.current = true;
        playRequestIdRef.current += 1;
        audio.load();
        safePlay();
        return;
      }

      // Step 3: Force refresh and unblock audio source
      if (recovery.attempts === 2 && currentSong?.id && urlRefreshAttemptRef.current.count < 1) {
        recovery.attempts += 1;
        urlRefreshAttemptRef.current = { songId: currentSong.id, count: urlRefreshAttemptRef.current.count + 1 };
        appendRuntimeLog('warn', '音频长时间停滞，正在强制刷新音频地址与智能解灰', {
          songId: currentSong.id
        }, 'audio');
        playSong(currentSong, null, 0, { forceRefreshUrl: true });
        return;
      }
    }, 1200);

    return () => window.clearInterval(timerId);
  }, [isPlaying, audioSource, crossOriginMode, playSong, currentSong]);

  const audioRoutingMode = isWebAudioEligibleSource(audioSource) ? 'web-audio' : 'direct';
  const effectiveCrossOriginMode = audioRoutingMode === 'direct' ? null : crossOriginMode;

  // Expose audio element to global context
  useEffect(() => {
    if (audioRef.current) {
      setAudioElement(audioRef.current);
    }
  }, [setAudioElement]);

  // Apply Equalizer 10-Band Gains
  const applyEqBands = useCallback(() => {
    const audioCtx = audioContextRef.current;
    if (!audioCtx || eqFiltersRef.current.length === 0) return;
    const eq = audioConfig?.equalizer;
    const isEnabled = eq?.enabled === true;
    const bands = Array.isArray(eq?.bands)
      ? eq.bands
      : Object.values(eq?.bands || {});

    eqFiltersRef.current.forEach((filter, idx) => {
      if (!filter) return;
      const rawGain = isEnabled ? Number(bands[idx] ?? 0) : 0;
      const targetGain = Math.max(-12, Math.min(12, Number.isFinite(rawGain) ? rawGain : 0));
      try {
        if (audioCtx.state === 'running') {
          filter.gain.setTargetAtTime(targetGain, audioCtx.currentTime, 0.02);
        } else {
          filter.gain.value = targetGain;
        }
      } catch {
        filter.gain.value = targetGain;
      }
    });
  }, [audioConfig?.equalizer]);

  useEffect(() => {
    applyEqBands();
  }, [applyEqBands]);

  // Initialize Web Audio API Analyser, 10-Band EQ & Gain Node
  const setupWebAudio = () => {
    const audio = audioRef.current;
    if (!audio) return;

    try {
      let audioCtx = audioContextRef.current;
      if (!audioCtx) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        audioCtx = new AudioContextClass();
        audioContextRef.current = audioCtx;
        window.ichigoAudioContext = audioCtx;
      }

      if (audioCtx.state === 'suspended') {
        audioCtx.resume().catch(() => {});
      }

      // 1. Build 10 BiquadFilterNodes (31Hz ~ 16kHz)
      if (eqFiltersRef.current.length !== EQ_BAND_FREQUENCIES.length) {
        eqFiltersRef.current.forEach((f) => { try { f.disconnect(); } catch {} });
        eqFiltersRef.current = EQ_BAND_FREQUENCIES.map((freq, idx) => {
          const filter = audioCtx.createBiquadFilter();
          filter.frequency.value = freq;
          if (idx === 0) {
            filter.type = 'lowshelf';
          } else if (idx === EQ_BAND_FREQUENCIES.length - 1) {
            filter.type = 'highshelf';
          } else {
            filter.type = 'peaking';
            filter.Q.value = 1.414;
          }
          filter.gain.value = 0;
          return filter;
        });

        for (let i = 0; i < eqFiltersRef.current.length - 1; i += 1) {
          eqFiltersRef.current[i].connect(eqFiltersRef.current[i + 1]);
        }
      }

      // 2. Build Master / Fader Gain Node for Crossfade
      let gainNode = gainNodeRef.current;
      if (!gainNode) {
        gainNode = audioCtx.createGain();
        gainNode.gain.value = 1;
        gainNodeRef.current = gainNode;
      }

      const lastFilter = eqFiltersRef.current[eqFiltersRef.current.length - 1];
      if (lastFilter) {
        try { lastFilter.disconnect(); } catch {}
        lastFilter.connect(gainNode);
      }

      // 3. Build Analyser
      let analyser = analyserNodeRef.current;
      if (!analyser) {
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.8;
        analyserNodeRef.current = analyser;
        window.ichigoAnalyser = analyser;
      }

      try { gainNode.disconnect(); } catch {}
      gainNode.connect(analyser);
      try { analyser.disconnect(); } catch {}
      analyser.connect(audioCtx.destination);

      // 4. Connect source element to first filter in chain (safely reuse node attached to element)
      let sourceNode = audio.__ichigoSourceNode || sourceNodeRef.current;
      if (!sourceNode) {
        sourceNode = audioCtx.createMediaElementSource(audio);
        audio.__ichigoSourceNode = sourceNode;
        sourceNodeRef.current = sourceNode;
        sourceElementRef.current = audio;
      }

      const firstFilter = eqFiltersRef.current[0];
      try { sourceNode.disconnect(); } catch {}
      if (firstFilter) {
        sourceNode.connect(firstFilter);
      } else {
        sourceNode.connect(gainNode);
      }

      applyEqBands();
    } catch (err) {
      console.warn("Web Audio API setup notice:", err);
    }
  };
  useEffect(() => {
    const handleGesture = () => {
      const audioContext = audioContextRef.current;
      if (audioContext?.state === 'suspended') audioContext.resume().catch(() => {});
    };

    window.addEventListener('click', handleGesture, { capture: true });
    window.addEventListener('keydown', handleGesture, { capture: true });
    window.addEventListener('touchstart', handleGesture, { capture: true });

    return () => {
      window.removeEventListener('click', handleGesture, { capture: true });
      window.removeEventListener('keydown', handleGesture, { capture: true });
      window.removeEventListener('touchstart', handleGesture, { capture: true });
    };
  }, []);

  const handlePlay = () => {
    playPendingRef.current = null;
    if (!playbackIntentRef.current) {
      audioRef.current?.pause();
      return;
    }
    sourceTransitionRef.current = false;
    if (currentSong?.id) {
      if (scrobbleRef.current.songId !== currentSong.id) {
        scrobbleRef.current = {
          songId: currentSong.id,
          lastTime: audioRef.current?.currentTime || 0,
          reported: false,
          inFlight: false
        };
      } else {
        scrobbleRef.current.reported = false;
      }
    }
    appendRuntimeLog('info', 'Audio playback started', {
      songId: currentSong?.id || null,
      currentTime: audioRef.current?.currentTime || 0,
      readyState: audioRef.current?.readyState ?? -1
    }, 'audio');
    setIsPlaying(true);
    setupWebAudio();
    const crossfadeDur = Math.max(0, Math.min(10, Number(audioConfig?.crossfade ?? 1.0)));
    const audioCtx = audioContextRef.current;
    const gainNode = gainNodeRef.current;
    if (audioCtx && gainNode) {
      try {
        if (crossfadeDur > 0.05) {
          const fadeTime = Math.min(crossfadeDur, 3.0);
          gainNode.gain.cancelScheduledValues(audioCtx.currentTime);
          gainNode.gain.setValueAtTime(0.01, audioCtx.currentTime);
          gainNode.gain.linearRampToValueAtTime(1.0, audioCtx.currentTime + fadeTime);
        } else {
          gainNode.gain.cancelScheduledValues(audioCtx.currentTime);
          gainNode.gain.setValueAtTime(1.0, audioCtx.currentTime);
        }
      } catch (err) {}
    }
  };

  const handlePause = () => {
    playPendingRef.current = null;
    const audio = audioRef.current;
    const songSource = currentSong?.url || '';
    const sourceChanging = sourceTransitionRef.current
      || (songSource && audioSource && songSource !== audioSource);
    if (sourceChanging && playbackIntentRef.current) return;
    reportScrobble(audioRef.current?.currentTime || 0, true);
    appendRuntimeLog('debug', 'audio paused', {
      songId: currentSong?.id || null,
      currentTime: audio?.currentTime || 0
    }, 'audio');
    setIsPlaying(false);
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      const curTime = audioRef.current.currentTime || 0;
      setProgress(curTime);

      // 睡眠定时器：检查到期与最后 15 秒平滑音量渐弱 (Sleep Timer Fade Out)
      const sleepState = (typeof window !== 'undefined' ? window.__ICHIGO_SLEEP_TIMER__ : null);
      if (sleepState && sleepState.active && !sleepState.endOfSong && sleepState.targetTime) {
        const remainingMs = sleepState.targetTime - Date.now();
        if (remainingMs <= 0) {
          window.__ICHIGO_SLEEP_TIMER__ = null;
          audioRef.current.pause();
          audioRef.current.volume = volume;
          setIsPlaying(false);
          return;
        } else if (remainingMs <= 15000) {
          const fadeFrac = Math.max(0.02, remainingMs / 15000);
          audioRef.current.volume = volume * fadeFrac;
        } else {
          audioRef.current.volume = volume;
        }
      }

      if (currentSong?.id) {
        if (scrobbleRef.current.songId !== currentSong.id) {
          scrobbleRef.current = {
            songId: currentSong.id,
            lastTime: curTime,
            reported: false,
            inFlight: false
          };
        } else {
          scrobbleRef.current.lastTime = Math.max(scrobbleRef.current.lastTime, curTime);
        }
      }
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      if (!playbackIntentRef.current) sourceTransitionRef.current = false;
      const mediaDuration = Number.isFinite(audioRef.current.duration) ? audioRef.current.duration : 0;
      appendRuntimeLog('info', '音频元素数据已加载', {
        songId: currentSong?.id || null,
        duration: mediaDuration,
        readyState: audioRef.current.readyState
      }, 'audio');
      setDuration(mediaDuration);
      if (resumeTime !== null) {
        const requestedResume = Number(resumeTime) || 0;
        const clampedResume = mediaDuration > 0
          ? Math.max(0, Math.min(requestedResume, Math.max(0, mediaDuration - 0.25)))
          : Math.max(0, requestedResume);
        if (clampedResume > 0.05) {
          audioRef.current.currentTime = clampedResume;
        }
        setResumeTime(null);
      }
    }
  };

  const handleDurationChange = () => {
    const mediaDuration = Number(audioRef.current?.duration);
    if (Number.isFinite(mediaDuration) && mediaDuration > 0) setDuration(mediaDuration);
  };

  const handleAudioError = (e) => {
    const audio = audioRef.current;
    const attributeSource = audio?.getAttribute('src') || '';
    if (!attributeSource || !audioSource) {
      appendRuntimeLog('debug', '忽略音频源准备阶段的空地址事件', {
        songId: currentSong?.id || null,
        readyState: audio?.readyState ?? -1,
        networkState: audio?.networkState ?? -1
      }, 'audio');
      return;
    }
    appendRuntimeLog('error', '音频元素加载失败', {
      songId: currentSong?.id || null,
      code: audio?.error?.code || 0,
      message: audio?.error?.message || '',
      readyState: audio?.readyState ?? -1,
      networkState: audio?.networkState ?? -1,
      source: isLocalMediaSource(audioSource) ? 'local-cache' : 'remote'
    }, 'audio');
    console.error("Audio playback error event:", e);
    const code = audio?.error?.code;
    sourceTransitionRef.current = false;

    if (code && isStreamMediaSource(audioSource) && rawSourceRef.current && rawSourceRef.current !== audioSource) {
      console.warn(`Stream proxy failed (code ${code}); falling back to direct source`);
      appendRuntimeLog('warn', '音频流代理加载失败，已回退到直连地址', {
        songId: currentSong?.id || null,
        code
      }, 'audio');
      window.ichigoAnalyser = null;
      sourceTransitionRef.current = true;
      setCrossOriginMode(null);
      setAudioSource(rawSourceRef.current);
      return;
    }

    const urlRetry = urlRefreshAttemptRef.current;
    if (isPlaying && code === 4 && currentSong && urlRetry.count < 1) {
      console.log("Attempting to refresh song URL before CORS fallback...");
      urlRefreshAttemptRef.current = { songId: currentSong.id, count: urlRetry.count + 1 };
      audio._hasRetriedUrl = true;
      playSong(currentSong, null, audio?.currentTime || 0, { forceRefreshUrl: true });
      return;
    }

    if (crossOriginMode === 'anonymous' && (code === 2 || code === 3)) {
      console.warn("CORS issue detected. Retrying playback without Web Audio API analysis...");
      window.ichigoAnalyser = null;
      setCrossOriginMode(null);
    } else if (code) {
      console.error(`Fatal audio error code ${code}.`);
      if (isPlaying) {
        if (!canControlPlayback) {
          setIsPlaying(false);
          return;
        }
        console.log("Skipping to next song in 1.5 seconds...");
        setIsPlaying(false);
        if (!errorSkipTimerRef.current) {
          const failedSongId = currentSong.id;
          errorSkipTimerRef.current = setTimeout(() => {
            errorSkipTimerRef.current = null;
            if (currentSongRef.current?.id === failedSongId) playNext();
          }, 1500);
        }
      } else {
        console.warn("Audio failed to load, but player is paused. Ignoring auto-skip to prevent auto-play loop.");
      }
    }
  };

  const handleEnded = () => {
    reportScrobble(audioRef.current?.currentTime || audioRef.current?.duration || 0, true);
    
    // 睡眠定时器：播完本曲后停止
    const sleepState = (typeof window !== 'undefined' ? window.__ICHIGO_SLEEP_TIMER__ : null);
    if (sleepState && sleepState.active && sleepState.endOfSong) {
      window.__ICHIGO_SLEEP_TIMER__ = null;
      setIsPlaying(false);
      return;
    }

    if (!canControlPlayback) {
      setIsPlaying(false);
      return;
    }
    if (playMode === 'single') {
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        safePlay();
      }
    } else {
      playNext();
    }
  };

  return (
    <audio
      ref={audioRef}
      src={audioSource || undefined}
      crossOrigin={effectiveCrossOriginMode}
      onPlay={handlePlay}
      onPause={handlePause}
      onTimeUpdate={handleTimeUpdate}
      onLoadedMetadata={handleLoadedMetadata}
      onDurationChange={handleDurationChange}
      onCanPlay={() => {
        if (playbackIntentRef.current) safePlay();
        else sourceTransitionRef.current = false;
      }}
      onPlaying={() => {
        sourceTransitionRef.current = false;
        appendRuntimeLog('info', 'Audio entered stable playback', { songId: currentSong?.id || null, currentTime: audioRef.current?.currentTime || 0 }, 'audio');
      }}
      onWaiting={() => appendRuntimeLog('warn', '音频等待数据', { songId: currentSong?.id || null, currentTime: audioRef.current?.currentTime || 0, readyState: audioRef.current?.readyState ?? -1 }, 'audio')}
      onStalled={() => appendRuntimeLog('warn', '音频网络读取停滞', { songId: currentSong?.id || null, networkState: audioRef.current?.networkState ?? -1 }, 'audio')}
      onError={handleAudioError}
      onEnded={handleEnded}
      preload="auto"
      style={{ display: 'none' }}
    />
  );
}
