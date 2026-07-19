import React, { useEffect, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';

export default function AudioPlayer() {
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
  const zeroTimeRecoveryRef = useRef({ key: '', attempts: 0 });
  const urlRefreshAttemptRef = useRef({ songId: null, count: 0 });

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
    const cachedAt = Number(currentSong?.urlCachedAt || 0);
    const hasFreshUrl = currentSong?.url && cachedAt && Date.now() - cachedAt < 15 * 60 * 1000;
    if (currentSong && hasFreshUrl) {
      setProgress(0);
      setDuration(0);
      zeroTimeRecoveryRef.current = { key: currentSong.url, attempts: 0 };
      setAudioSource(currentSong.url);
      setCrossOriginMode('anonymous');
    } else {
      setAudioSource('');
    }
  }, [currentSong]);

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
      if (stillLoading && !audio.error) return;

      const key = `${audioSource}|${crossOriginMode ?? 'no-cors'}`;
      const recovery = zeroTimeRecoveryRef.current;
      if (recovery.key !== key) {
        recovery.key = key;
        recovery.attempts = 0;
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
    if (!audioRef.current || crossOriginMode === null) return;

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

  useEffect(() => {
    if (!isPlaying || !audioSource || crossOriginMode === null) return;
    setupWebAudio();
  }, [isPlaying, audioSource, crossOriginMode]);

  // Eagerly initialize or resume Web Audio API on first user gesture
  useEffect(() => {
    const handleGesture = () => {
      if (audioContextRef.current && audioContextRef.current.state === 'running') return;
      setupWebAudio();
    };

    window.addEventListener('click', handleGesture, { capture: true });
    window.addEventListener('keydown', handleGesture, { capture: true });
    window.addEventListener('touchstart', handleGesture, { capture: true });

    return () => {
      window.removeEventListener('click', handleGesture, { capture: true });
      window.removeEventListener('keydown', handleGesture, { capture: true });
      window.removeEventListener('touchstart', handleGesture, { capture: true });
    };
  }, [crossOriginMode]);

  // When play starts, setup audio analyser
  const handlePlay = () => {
    setIsPlaying(true);
    setupWebAudio();
  };

  const handlePause = () => {
    setIsPlaying(false);
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setProgress(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      const mediaDuration = Number.isFinite(audioRef.current.duration) ? audioRef.current.duration : 0;
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
      onCanPlay={() => { if (isPlaying) { setupWebAudio(); safePlay(); } }}
      onError={handleAudioError}
      onEnded={handleEnded}
      preload="auto"
      style={{ display: 'none' }}
    />
  );
}
