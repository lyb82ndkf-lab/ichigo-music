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
    playSong,
    refreshRecentlyPlayed
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
  // One report is emitted at the end of a listening session.  The old code
  // reported at 50%/30 seconds and then permanently marked the song as sent;
  // consequently a four-minute song was recorded as only 30 seconds.
  const scrobbleRef = useRef({ songId: null, lastTime: 0, reported: false, inFlight: false });

  const reportScrobble = (playedSeconds, force = false) => {
    const song = currentSong;
    const audio = audioRef.current;
    if (!song?.id || !audio) return;
    if (scrobbleRef.current.songId !== song.id) {
      scrobbleRef.current = { songId: song.id, lastTime: 0, reported: false, inFlight: false };
    }
    const total = Number.isFinite(audio.duration) && audio.duration > 0
      ? audio.duration
      : Number(song.durationMs || song.dt || song.duration || 0) / 1000;
    const played = Math.max(scrobbleRef.current.lastTime, Number(playedSeconds) || 0);
    scrobbleRef.current.lastTime = played;
    const minimum = total > 0 ? Math.min(30, Math.max(3, total * 0.1)) : 3;
    if (played < minimum || scrobbleRef.current.reported || scrobbleRef.current.inFlight) return;
    // Do not send a partial checkpoint while playback is still running.  A
    // pause, track switch, ended event, or app shutdown passes force=true.
    if (!force && total > 0 && played < total * 0.95) return;

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
    // The legacy endpoint is the one that emits startplay/play feedback and
    // updates the account's recent-play list.  Fall back to the NCBL endpoint
    // for servers where that route is unavailable.
    const markSynced = (endpoint, extra = {}) => {
      // A queue skip can replace the shared tracker while this request is in
      // flight.  Never let the previous song's response mark the new song as
      // reported or overwrite its retry state.
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
          // Keep the item eligible for a later retry instead of marking a
          // failed request as reported (the previous finally() did that).
          appendRuntimeLog('warn', '浜戠鎾斁璁板綍鍚屾澶辫触锛屽皢鍦ㄤ笅娆″垏姝屾椂閲嶈瘯', {
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

  // Flush the previous track when React replaces the current song or when the
  // audio component is torn down.  This covers window close, route changes and
  // queue skips where Chromium may reset currentTime before dispatching pause.
  useEffect(() => {
    const songId = currentSong?.id;
    return () => {
      if (songId && scrobbleRef.current.songId === songId) {
        reportScrobble(scrobbleRef.current.lastTime, true);
      }
    };
  }, [currentSong?.id]);

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

    appendRuntimeLog('debug', '璇锋眰鎾斁闊抽', {
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
    // 鍏堜娇鐢ㄥ凡鎸佷箙鍖栫殑鍦板潃鍚姩濯掍綋鍏冪礌锛屼笉瑕佸洜涓虹紦瀛樻椂闂磋繃鏈熻€屾妸
    // src 娓呯┖銆傚湴鍧€鍒锋柊鐢?AppContext 鍦ㄥ悗鍙板畬鎴愶紱娓呯┖ src 浼氳棣栨洸
    // 蹇呴』绛夊緟缃戠粶璇锋眰缁撴潫锛岃〃鐜颁负灏侀潰/姝岃瘝宸插嚭鐜颁絾杩涘害鏉￠暱鏃堕棿涓?0銆?
    if (currentSong?.url) {
      setProgress(0);
      setDuration(0);
      zeroTimeRecoveryRef.current = { key: currentSong.url, attempts: 0, startedAt: Date.now() };
      setAudioSource(currentSong.url);
      setCrossOriginMode(isLocalMediaSource(currentSong.url) ? null : 'anonymous');
      appendRuntimeLog('info', '闊抽婧愬凡鎻愪氦', {
        songId: currentSong.id || null,
        source: isLocalMediaSource(currentSong.url) ? 'local-cache' : 'remote',
        hasResumeTime: resumeTime !== null
      }, 'audio');
    } else {
      // Do not leave an empty src attribute on the persistent element. Chromium
      // reports it as MEDIA_ERR_SRC_NOT_SUPPORTED, even though it is merely the
      // short interval before AppContext resolves a restored session URL.
      lastLoadedKeyRef.current = '';
      playRequestIdRef.current += 1;
      setAudioSource('');
      setCrossOriginMode('anonymous');
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
    // A pause/resume starts a new report window for the same track.  This
    // allows a short pause checkpoint to be replaced by the later, longer
    // duration instead of freezing the account at the first pause position.
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
  };

  const handlePause = () => {
    reportScrobble(audioRef.current?.currentTime || 0, true);
    appendRuntimeLog('debug', '闊抽鏆傚仠', {
      songId: currentSong?.id || null,
      currentTime: audioRef.current?.currentTime || 0
    }, 'audio');
    setIsPlaying(false);
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setProgress(audioRef.current.currentTime);
      if (currentSong?.id) {
        if (scrobbleRef.current.songId !== currentSong.id) {
          scrobbleRef.current = {
            songId: currentSong.id,
            lastTime: audioRef.current.currentTime || 0,
            reported: false,
            inFlight: false
          };
        } else {
          scrobbleRef.current.lastTime = Math.max(scrobbleRef.current.lastTime, audioRef.current.currentTime || 0);
        }
      }
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      const mediaDuration = Number.isFinite(audioRef.current.duration) ? audioRef.current.duration : 0;
      appendRuntimeLog('info', '闊抽鍏冩暟鎹凡鍔犺浇', {
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
    const audio = audioRef.current;
    const attributeSource = audio?.getAttribute('src') || '';
    // Ignore the browser's synthetic empty-source error. It is emitted while a
    // restored session is resolving its first playable URL, not a failure of a
    // track. Treating it as a real code-4 failure previously muted the first
    // song until a manual next-track action replaced the element source.
    if (!attributeSource || !audioSource) {
      appendRuntimeLog('debug', '蹇界暐闊抽婧愬噯澶囬樁娈电殑绌哄湴鍧€浜嬩欢', {
        songId: currentSong?.id || null,
        readyState: audio?.readyState ?? -1,
        networkState: audio?.networkState ?? -1
      }, 'audio');
      return;
    }
    appendRuntimeLog('error', '闊抽鍏冪礌鍔犺浇澶辫触', {
      songId: currentSong?.id || null,
      code: audio?.error?.code || 0,
      message: audio?.error?.message || '',
      readyState: audio?.readyState ?? -1,
      networkState: audio?.networkState ?? -1,
      source: isLocalMediaSource(audioSource) ? 'local-cache' : 'remote'
    }, 'audio');
    console.error("Audio playback error event:", e);
    const code = audio?.error?.code;
    
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
      src={audioSource || undefined}
      crossOrigin={crossOriginMode}
      onPlay={handlePlay}
      onPause={handlePause}
      onTimeUpdate={handleTimeUpdate}
      onLoadedMetadata={handleLoadedMetadata}
      onDurationChange={handleDurationChange}
      onCanPlay={() => { if (isPlaying) safePlay(); }}
      onPlaying={() => appendRuntimeLog('info', 'Audio entered stable playback', { songId: currentSong?.id || null, currentTime: audioRef.current?.currentTime || 0 }, 'audio')}
      onWaiting={() => appendRuntimeLog('warn', '闊抽绛夊緟鏁版嵁', { songId: currentSong?.id || null, currentTime: audioRef.current?.currentTime || 0, readyState: audioRef.current?.readyState ?? -1 }, 'audio')}
      onStalled={() => appendRuntimeLog('warn', '闊抽缃戠粶璇诲彇鍋滄粸', { songId: currentSong?.id || null, networkState: audioRef.current?.networkState ?? -1 }, 'audio')}
      onError={handleAudioError}
      onEnded={handleEnded}
      preload="auto"
      style={{ display: 'none' }}
    />
  );
}


