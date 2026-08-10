import React, { useEffect, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import { isLocalMediaSource } from '../utils/audioSource';
import { api } from '../utils/api';
import { appendRuntimeLog } from '../utils/runtimeLog';

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
    playSong
  } = useApp();

  const audioRef = useRef(null);
  const [crossOriginMode, setCrossOriginMode] = useState('anonymous');
  const [audioSource, setAudioSource] = useState('');

  // Audio Context and Analyzer references
  const audioContextRef = useRef(null);
  const sourceNodeRef = useRef(null);
  const analyserNodeRef = useRef(null);
  const playRequestIdRef = useRef(0);
  const lastLoadedKeyRef = useRef('');
  const zeroTimeRecoveryRef = useRef({ key: '', attempts: 0, startedAt: 0 });
  const urlRefreshAttemptRef = useRef({ songId: null, count: 0 });
  const scrobbleRef = useRef({ songId: null, reported: false, inFlight: false });

  const reportScrobble = (playedSeconds, force = false) => {
    const song = currentSong;
    const audio = audioRef.current;
    if (!song?.id || !audio) return;
    if (scrobbleRef.current.songId !== song.id) {
      scrobbleRef.current = { songId: song.id, reported: false, inFlight: false };
    }
    const total = Number.isFinite(audio.duration) && audio.duration > 0
      ? audio.duration
      : Number(song.durationMs || song.dt || song.duration || 0) / 1000;
    const played = Math.max(0, Number(playedSeconds) || 0);
    const threshold = total > 0 ? Math.min(30, Math.max(1, total * 0.5)) : 30;
    if ((!force && played < threshold) || played <= 0 || scrobbleRef.current.reported || scrobbleRef.current.inFlight) return;
    scrobbleRef.current.inFlight = true;
    api.scrobble({
      id: song.id,
      time: Math.min(played, total > 0 ? total : played),
      total: total > 0 ? total : played,
      sourceid: song.id,
      name: song.name || song.title,
      artist: song.artist || song.ar?.map(item => item.name).join(' / ') || song.artists?.map(item => item.name).join(' / '),
      level: 'exhigh'
    }).catch(() => {}).finally(() => {
      scrobbleRef.current.inFlight = false;
      scrobbleRef.current.reported = true;
    });
  };

  // Clean up global window references on unmount
  useEffect(() => {
    return () => {
      if (sourceNodeRef.current) {
        try {
          sourceNodeRef.current.disconnect();
        } catch (err) {}
      }
      delete window.ichigoAnalyser;
      delete window.ichigoAudioContext;
    };
  }, []);

  const safePlay = () => {
    const audio = audioRef.current;
    if (!audio || !audioSource) return;

    appendRuntimeLog('debug', '请求播放音频', {
      songId: currentSong?.id || null,
      source: isLocalMediaSource(audioSource) ? 'local-cache' : 'remote',
      readyState: audio.readyState,
      networkState: audio.networkState
    }, 'audio');
    const localSourceUnavailable = (
      isLocalMediaSource(audioSource)
      && audio.readyState === HTMLMediaElement.HAVE_NOTHING
      && audio.networkState === HTMLMediaElement.NETWORK_NO_SOURCE
    );
    if (localSourceUnavailable && currentSong?.id) {
      const retry = urlRefreshAttemptRef.current;
      if (retry.count < 1) {
        urlRefreshAttemptRef.current = { songId: currentSong.id, count: retry.count + 1 };
        appendRuntimeLog('warn', '本地音频缓存不可用，立即切换在线播放源', {
          songId: currentSong.id,
          readyState: audio.readyState,
          networkState: audio.networkState
        }, 'audio');
        playSong(currentSong, null, audio.currentTime || 0, { forceRefreshUrl: true });
        return;
      }
    }
    const requestId = ++playRequestIdRef.current;
    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise.catch(error => {
        // load()/src changes legitimately abort older play() calls during song
        // switches. Treat only the latest non-abort failure as a real playback
        // failure. This prevents the app from flipping to a stuck paused/0.00
        // state during normal source replacement.
        if (requestId !== playRequestIdRef.current) return;
        if (error?.name === 'AbortError') return;
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
    }
  };

  // Sync volume
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  // Sync source loading and play/pause from one place, after React has
  // committed the <audio src/crossOrigin> attributes.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !audioSource) return;

    const loadKey = `${audioSource}|${crossOriginMode ?? 'no-cors'}`;
    if (lastLoadedKeyRef.current !== loadKey) {
      lastLoadedKeyRef.current = loadKey;
      playRequestIdRef.current += 1; // invalidate play() promises aborted by load()
      audio.load();
    }

    if (isPlaying) {
      safePlay();
    } else {
      audio.pause();
    }
  }, [isPlaying, audioSource, crossOriginMode]);

  // Handle song change
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current._hasRetriedUrl = false;
    }
    if (urlRefreshAttemptRef.current.songId !== currentSong?.id) {
      urlRefreshAttemptRef.current = { songId: currentSong?.id || null, count: 0 };
    }
    // 先使用已持久化的地址启动媒体元素，不要因为缓存时间过期而把
    // src 清空。地址刷新由 AppContext 在后台完成；清空 src 会让首曲
    // 必须等待网络请求结束，表现为封面/歌词已出现但进度条长时间为 0。
    if (currentSong?.url) {
      setProgress(0);
      setDuration(0);
      zeroTimeRecoveryRef.current = { key: currentSong.url, attempts: 0, startedAt: Date.now() };
      setAudioSource(currentSong.url);
      setCrossOriginMode(isLocalMediaSource(currentSong.url) ? null : 'anonymous');
      appendRuntimeLog('info', '音频源已提交', {
        songId: currentSong.id || null,
        source: isLocalMediaSource(currentSong.url) ? 'local-cache' : 'remote',
        hasResumeTime: resumeTime !== null
      }, 'audio');
    } else {
      setAudioSource('');
    }
  }, [currentSong?.url]);

  // Recovery for the intermittent 0.00s startup stall: if a source is
  // requested to play but the media clock never starts, retry once without CORS
  // analysis and then once with a reload.
  useEffect(() => {
    if (!isPlaying || !audioSource) return undefined;

    const timerId = window.setInterval(() => {
      const audio = audioRef.current;
      if (!audio || !isPlaying) return;
      const stuckAtStart = (audio.currentTime || 0) < 0.05;
      const stillLoading = audio.readyState < HTMLMediaElement.HAVE_CURRENT_DATA;
      if (!stuckAtStart) return;
      const elapsed = Date.now() - (zeroTimeRecoveryRef.current.startedAt || Date.now());
      if (stillLoading && !audio.error && elapsed < 4500) return;

      const key = `${audioSource}|${crossOriginMode ?? 'no-cors'}`;
      const recovery = zeroTimeRecoveryRef.current;
      if (recovery.key !== key) {
        recovery.key = key;
        recovery.attempts = 0;
        recovery.startedAt = Date.now();
      }

      if (audio.paused) {
        safePlay();
        return;
      }

      if (recovery.attempts === 0 && crossOriginMode === 'anonymous') {
        recovery.attempts += 1;
        window.ichigoAnalyser = null;
        setCrossOriginMode(null);
        return;
      }

      if (recovery.attempts < 2) {
        recovery.attempts += 1;
        playRequestIdRef.current += 1;
        audio.load();
        safePlay();
      }
    }, 1200);

    return () => window.clearInterval(timerId);
  }, [isPlaying, audioSource, crossOriginMode]);

  // Expose audio element to global context
  useEffect(() => {
    if (audioRef.current) {
      setAudioElement(audioRef.current);
    }
  }, []);

  // Initialize Web Audio API Analyser
  const setupWebAudio = () => {
    const localMedia = isLocalMediaSource(audioSource);
    if (!audioRef.current || (crossOriginMode === null && !localMedia)) return;

    try {
      let audioCtx = audioContextRef.current;
      if (!audioCtx) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        audioCtx = new AudioContextClass();
        audioContextRef.current = audioCtx;
        window.ichigoAudioContext = audioCtx;
      }

      // Resume context if suspended
      if (audioCtx.state === 'suspended') {
        audioCtx.resume().catch(() => {});
      }

      let analyser = analyserNodeRef.current;
      if (!analyser) {
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        analyserNodeRef.current = analyser;
      }
      window.ichigoAnalyser = analyser;
      window.ichigoAudioContext = audioCtx;

      // If source node is already created for this audio element, reuse it, but
      // still restore the global analyser refs. Last-session playback can reuse
      // the media element before immersive mode mounts.
      if (sourceNodeRef.current) {
        return;
      }

      // Create Media Element Source node only once
      const source = audioCtx.createMediaElementSource(audioRef.current);
      source.connect(analyser);
      analyser.connect(audioCtx.destination);

      sourceNodeRef.current = source;
    } catch (e) {
      console.warn("Web Audio API analyser setup failed:", e);
    }
  };

  // A gesture may resume an analyser that already exists, but it must not
  // create MediaElementSource before the audio source has proved playable.
  // Redirecting a failed/non-CORS first source through Web Audio produces a
  // silent media element until the whole app is restarted.
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

  // When play starts, setup audio analyser
  const handlePlay = () => {
    appendRuntimeLog('info', '音频开始播放', {
      songId: currentSong?.id || null,
      currentTime: audioRef.current?.currentTime || 0,
      readyState: audioRef.current?.readyState ?? -1
    }, 'audio');
    setIsPlaying(true);
    setupWebAudio();
  };

  const handlePause = () => {
    appendRuntimeLog('debug', '音频暂停', {
      songId: currentSong?.id || null,
      currentTime: audioRef.current?.currentTime || 0
    }, 'audio');
    setIsPlaying(false);
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setProgress(audioRef.current.currentTime);
      reportScrobble(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      const mediaDuration = Number.isFinite(audioRef.current.duration) ? audioRef.current.duration : 0;
      appendRuntimeLog('info', '音频元数据已加载', {
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

  // If the audio source fails to load, handle CORS or skip to next song
  const handleAudioError = (e) => {
    appendRuntimeLog('error', '音频元素加载失败', {
      songId: currentSong?.id || null,
      code: audioRef.current?.error?.code || 0,
      message: audioRef.current?.error?.message || '',
      readyState: audioRef.current?.readyState ?? -1,
      networkState: audioRef.current?.networkState ?? -1,
      source: isLocalMediaSource(audioSource) ? 'local-cache' : 'remote'
    }, 'audio');
    console.error("Audio playback error event:", e);
    const code = audioRef.current?.error?.code;
    
    const urlRetry = urlRefreshAttemptRef.current;
    if (isPlaying && code === 4 && currentSong && urlRetry.count < 1) {
      console.log("Attempting to refresh song URL before CORS fallback...");
      urlRefreshAttemptRef.current = { songId: currentSong.id, count: urlRetry.count + 1 };
      audioRef.current._hasRetriedUrl = true;
      playSong(currentSong, null, audioRef.current?.currentTime || 0, { forceRefreshUrl: true });
      return;
    }

    if (crossOriginMode === 'anonymous' && (code === 2 || code === 3)) {
      console.warn("CORS issue detected. Retrying playback without Web Audio API analysis...");
      // Disable CORS analysis; the unified source effect will reload and
      // continue playback after React removes the crossOrigin attribute.
      window.ichigoAnalyser = null;
      setCrossOriginMode(null);
    } else if (code) {
      console.error(`Fatal audio error code ${code}.`);
      if (isPlaying) {
        if (!canControlPlayback) {
          setIsPlaying(false);
          return;
        }
        // If it's a source not supported error, it might be an expired URL from cache.
        // Try to refresh the URL once before skipping to the next song.
        console.log("Skipping to next song in 1.5 seconds...");
        setIsPlaying(false);
        setTimeout(() => {
          playNext();
        }, 1500);
      } else {
        console.warn("Audio failed to load, but player is paused. Ignoring auto-skip to prevent auto-play loop.");
      }
    }
  };

  const handleEnded = () => {
    reportScrobble(audioRef.current?.currentTime || audioRef.current?.duration || 0, true);
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
      key="ichigo-audio-element" // Reuse static element to prevent decoding lockups in Chrome
      ref={audioRef}
      src={audioSource}
      crossOrigin={crossOriginMode}
      onPlay={handlePlay}
      onPause={handlePause}
      onTimeUpdate={handleTimeUpdate}
      onLoadedMetadata={handleLoadedMetadata}
      onDurationChange={handleDurationChange}
      onCanPlay={() => { if (isPlaying) safePlay(); }}
      onPlaying={() => appendRuntimeLog('info', '音频进入稳定播放状态', { songId: currentSong?.id || null, currentTime: audioRef.current?.currentTime || 0 }, 'audio')}
      onWaiting={() => appendRuntimeLog('warn', '音频等待数据', { songId: currentSong?.id || null, currentTime: audioRef.current?.currentTime || 0, readyState: audioRef.current?.readyState ?? -1 }, 'audio')}
      onStalled={() => appendRuntimeLog('warn', '音频网络读取停滞', { songId: currentSong?.id || null, networkState: audioRef.current?.networkState ?? -1 }, 'audio')}
      onError={handleAudioError}
      onEnded={handleEnded}
      preload="auto"
      style={{ display: 'none' }}
    />
  );
}
