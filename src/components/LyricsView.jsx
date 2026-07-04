import React, { useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import MonetPosterLayout from './lyrics/MonetPosterLayout';
import { wordRegistry } from './lyrics/MonetWordSweep';

export default function LyricsView({ engineRef, lyrics = [], activeLineIndex = -1, currentTime, coverUrl, audioAnalyser }) {
  const { currentSong, isPlaying, advancedLyricConfig } = useApp();
  
  // 建立最高优先级、无状态锁的 requestAnimationFrame 全局循环
  // 该循环唯一的任务就是查当前播放时间，并通知所有活着的 MonetWordSweep 自主推进
  useEffect(() => {
    let animationId;
    
    const loop = () => {
      // 通过 useLyricEngine 暴露的引擎接口，拿到极为精准的播放器系统时间
      const currentTime = (engineRef.current?.getCurrentTime() || 0) + (advancedLyricConfig?.globalOffset || 0);
      
      // 执行 O(N) 极速更新 (N 通常小于 30)
      wordRegistry.forEach(updater => {
        updater(currentTime);
      });
      
      animationId = requestAnimationFrame(loop);
    };
    
    if (isPlaying) {
      animationId = requestAnimationFrame(loop);
    } else {
      // 暂停时强制推一帧，确保状态定格正确
      wordRegistry.forEach(updater => {
        updater((engineRef.current?.getCurrentTime() || 0) + (advancedLyricConfig?.globalOffset || 0));
      });
    }
    
    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }, [isPlaying, engineRef, advancedLyricConfig?.globalOffset]);

  // 给 MonetPosterLayout 提供的静态时间锚点，只在切行时更新，
  // 避免引起 Layout 的高频 React render。
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
      currentTime={currentTime}
      coverUrl={coverUrl || currentSong?.coverUrl}
      audioAnalyser={audioAnalyser}
      themeColor="var(--primary)"
      engineRef={engineRef}
    />
  );
}
