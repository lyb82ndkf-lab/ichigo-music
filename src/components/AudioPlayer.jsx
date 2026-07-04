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
    setResumeTime
  } = useApp();

  const audioRef = useRef(null);
  const [crossOriginMode, setCrossOriginMode] = useState('anonymous');
  const [audioSource, setAudioSource] = useState('');

  // Audio Context and Analyzer references
  const audioContextRef = useRef(null);
  const sourceNodeRef = useRef(null);
  const analyserNodeRef = useRef(null);

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

  // Sync volume
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  // Sync play/pause
  useEffect(() => {
    if (!audioRef.current || !audioSource) return;

    if (isPlaying) {
      const playPromise = audioRef.current.play();
      if (playPromise !== undefined) {
        playPromise.catch(error => {
          console.warn("Playback prevented or error occurred:", error);
          // If the play request was interrupted by a new load, ignore AbortError
          if (error.name !== 'AbortError') {
            setIsPlaying(false);
          }
        });
      }
    } else {
      audioRef.current.pause();
    }
  }, [isPlaying, audioSource]);

  // Handle song change
  useEffect(() => {
    if (currentSong && currentSong.url) {
      setProgress(0);
      setDuration(0);
      setAudioSource(currentSong.url);
      setCrossOriginMode('anonymous');

      // Explicitly load the new source immediately
      if (audioRef.current) {
        audioRef.current.load();
      }
    } else {
      setAudioSource('');
    }
  }, [currentSong]);

  // Handle crossOriginMode changes
  useEffect(() => {
    if (audioRef.current && audioSource) {
      audioRef.current.load();
      if (isPlaying) {
        audioRef.current.play().catch(err => {
          if (err.name !== 'AbortError') {
            setIsPlaying(false);
          }
        });
      }
    }
  }, [crossOriginMode]);

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
        audioCtx.resume();
      }

      // If source node is already created for this audio element, reuse it
      if (sourceNodeRef.current) {
        return;
      }

      let analyser = analyserNodeRef.current;
      if (!analyser) {
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        analyserNodeRef.current = analyser;
        window.ichigoAnalyser = analyser;
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
      setDuration(audioRef.current.duration);
      if (resumeTime !== null) {
        audioRef.current.currentTime = resumeTime;
        setResumeTime(null);
      }
    }
  };

  // If the audio source fails to load, handle CORS or skip to next song
  const handleAudioError = (e) => {
    console.error("Audio playback error event:", e);
    const code = audioRef.current?.error?.code;
    
    if (crossOriginMode === 'anonymous' && (code === 4 || code === 2 || code === 3)) {
      console.warn("CORS issue detected. Retrying playback without Web Audio API analysis...");
      setCrossOriginMode(null); // Disable crossOrigin
      
      // Force reload the source
      setTimeout(() => {
        if (audioRef.current) {
          audioRef.current.load();
          if (isPlaying) {
            audioRef.current.play().catch(err => console.error("Retry play failed:", err));
          }
        }
      }, 100);
      
      // Clean up analyser since CORS prevents drawing anyway
      window.ichigoAnalyser = null;
    } else if (code) {
      console.error(`Fatal audio error code ${code}. Skipping to next song in 1.5 seconds...`);
      setIsPlaying(false);
      setTimeout(() => {
        playNext();
      }, 1500);
    }
  };

  const handleEnded = () => {
    if (playMode === 'single') {
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(() => setIsPlaying(false));
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
      onError={handleAudioError}
      onEnded={handleEnded}
      preload="auto"
      style={{ display: 'none' }}
    />
  );
}
