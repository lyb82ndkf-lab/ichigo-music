import React, { useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import MonetPosterLayout from './lyrics/MonetPosterLayout';
import { wordRegistry } from './lyrics/MonetWordSweep';

export default function LyricsView({ engineRef, lyrics = [], activeLineIndex = -1, currentTime, coverUrl, audioAnalyser }) {
  const { currentSong, isPlaying, advancedLyricConfig, immersiveColor } = useApp();
  
  // 建立最高优先级、无状态锁的 requestAnimationFrame 全局循环
  // 该循环唯一的任务就是查当前播放时间，并通知所有活着的 MonetWordSweep 自主推进
  useEffect(() => {
    let animationId = 0;
    let lastFrame = 0;
    const maxFps = advancedLyricConfig?.wordSweepFps || 60;
    const minFrameMs = maxFps > 0 ? 1000 / maxFps : 0;

    const tick = (now = performance.now()) => {
      const lyricTime = (engineRef.current?.getCurrentTime() || 0) + (advancedLyricConfig?.globalOffset || 0);
      wordRegistry.forEach(updater => updater(lyricTime));
      lastFrame = now;
    };

    const loop = (now) => {
      if (minFrameMs > 0 && now - lastFrame < minFrameMs) {
        animationId = requestAnimationFrame(loop);
        return;
      }
      tick(now);
      animationId = requestAnimationFrame(loop);
    };

    if (isPlaying) {
      animationId = requestAnimationFrame(loop);
    } else {
      // Push one deterministic frame on pause/seek without keeping a hot loop.
      tick();
    }

    return () => {
      if (animationId) cancelAnimationFrame(animationId);
    };
  }, [isPlaying, engineRef, advancedLyricConfig?.globalOffset, advancedLyricConfig?.wordSweepFps]);

  // ? MonetPosterLayout ??????????????????
  // ???? Layout ??? React render?
  const timeRef = useRef(0);
  useEffect(() => {
    timeRef.current = (engineRef.current?.getCurrentTime() || 0) + (advancedLyricConfig?.globalOffset || 0);
  }, [activeLineIndex, engineRef, advancedLyricConfig?.globalOffset]);

  return (
    <MonetPosterLayout 
      lyrics={lyrics}
      activeLineIndex={activeLineIndex}
      currentSong={currentSong}
      isPlaying={isPlaying}
      currentTimeRef={timeRef}
      coverUrl={coverUrl || currentSong?.coverUrl}
      audioAnalyser={audioAnalyser}
      themeColor={immersiveColor}
      engineRef={engineRef}
    />
  );
}
