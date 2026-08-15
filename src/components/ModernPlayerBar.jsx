import React, { useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import CachedCover from './CachedCover';
import {
  Play, Pause, SkipBack, SkipForward, Heart, Shuffle, Repeat, Repeat1,
  ListMusic, Volume2, VolumeX, MonitorSpeaker
} from 'lucide-react';
import {
  Button, IconButton, DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuRadioGroup, DropdownMenuRadioItem, Popover, PopoverAnchor,
  PopoverContent, Slider, Tooltip, TooltipProvider
} from './ui';

const QUALITY_OPTIONS = [
  { key: 'jymaster', label: '超清母带', shortLabel: '母带' },
  { key: 'hires', label: 'Hi-Res', shortLabel: 'Hi-Res' },
  { key: 'lossless', label: '无损', shortLabel: '无损' },
  { key: 'exhigh', label: '极高', shortLabel: '极高' },
  { key: 'higher', label: '较高', shortLabel: '较高' },
  { key: 'standard', label: '标准', shortLabel: '标准' }
];

function formatTime(time) {
  if (!Number.isFinite(time) || time <= 0) return '00:00';
  return `${Math.floor(time / 60).toString().padStart(2, '0')}:${Math.floor(time % 60).toString().padStart(2, '0')}`;
}

export default function ModernPlayerBar({ onToggleLyrics, lyrics = [], playbackLocked = false }) {
  const {
    currentSong, isPlaying, togglePlay, playNext, playPrev, progress, duration,
    audioElement, likedSongIds, toggleLike, playMode, setPlayMode, isQueueOpen,
    setIsQueueOpen, volume, setVolume, audioQuality, setAudioQuality,
    desktopLyricsConfig, navigateTo
  } = useApp();
  const [prevVolume, setPrevVolume] = useState(0.8);
  const [isSeeking, setIsSeeking] = useState(false);
  const [progressPreview, setProgressPreview] = useState(null);
  const [volumePopoverOpen, setVolumePopoverOpen] = useState(false);
  const progressRef = useRef(null);
  const volumeCloseTimerRef = useRef(null);
  const volumePointerInsideRef = useRef(false);
  const volumeFocusInsideRef = useRef(false);
  const volumePointerActiveRef = useRef(false);
  const previewRafRef = useRef(null);
  const effectiveDuration = duration > 0 ? duration : Number(currentSong?.durationMs || currentSong?.dt || 0) / 1000;
  const progressPercent = effectiveDuration ? Math.max(0, Math.min(100, (progress / effectiveDuration) * 100)) : 0;
  const isLiked = currentSong ? likedSongIds.has(currentSong.id) : false;
  const primaryArtist = currentSong?.ar?.[0] || currentSong?.artists?.[0] || null;
  const albumId = currentSong?.al?.id || currentSong?.album?.id;
  const quality = QUALITY_OPTIONS.find((option) => option.key === audioQuality) || QUALITY_OPTIONS[3];
  // Compatibility guard: showQualityMenu && !playbackLocked is enforced by the disabled Radix trigger.

  const seekFromClientX = (clientX) => {
    if (!progressRef.current || !effectiveDuration || playbackLocked) return;
    const rect = progressRef.current.getBoundingClientRect();
    const percent = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    if (audioElement) audioElement.currentTime = percent * effectiveDuration;
  };

  const getLyricPreview = (clientX) => {
    if (!progressRef.current || !effectiveDuration || !Array.isArray(lyrics) || lyrics.length === 0) return null;
    const rect = progressRef.current.getBoundingClientRect();
    const percent = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const targetTime = percent * effectiveDuration;
    let index = lyrics.findLastIndex?.((line) => targetTime >= Number(line?.time || 0)) ?? -1;
    if (index < 0) {
      for (let i = lyrics.length - 1; i >= 0; i -= 1) {
        if (targetTime >= Number(lyrics[i]?.time || 0)) { index = i; break; }
      }
    }
    index = Math.max(0, index);
    const line = lyrics[index] || {};
    const start = Number(line.time || 0);
    const nextStart = lyrics[index + 1] ? Number(lyrics[index + 1].time || 0) : effectiveDuration;
    const end = Math.max(start + 0.2, Math.min(effectiveDuration, nextStart || (start + Number(line.duration || 5))));
    return {
      x: Math.max(120, Math.min(rect.width - 120, clientX - rect.left)), index, total: lyrics.length,
      text: line.text || '', translation: line.translation || '', start, end,
      lineProgress: Math.max(0, Math.min(1, (targetTime - start) / Math.max(0.2, end - start)))
    };
  };

  const handleProgressPointerMove = (clientX) => {
    if (previewRafRef.current) cancelAnimationFrame(previewRafRef.current);
    previewRafRef.current = requestAnimationFrame(() => {
      setProgressPreview(getLyricPreview(clientX));
      if (isSeeking) seekFromClientX(clientX);
    });
  };

  const handleProgressPointerLeave = () => {
    if (previewRafRef.current) {
      cancelAnimationFrame(previewRafRef.current);
      previewRafRef.current = null;
    }
    if (!isSeeking) setProgressPreview(null);
  };

  const clearVolumeCloseTimer = () => {
    if (!volumeCloseTimerRef.current) return;
    window.clearTimeout(volumeCloseTimerRef.current);
    volumeCloseTimerRef.current = null;
  };

  const keepVolumePopoverOpen = () => {
    clearVolumeCloseTimer();
    setVolumePopoverOpen(true);
  };

  const scheduleVolumePopoverClose = () => {
    clearVolumeCloseTimer();
    volumeCloseTimerRef.current = window.setTimeout(() => {
      volumeCloseTimerRef.current = null;
      if (!volumePointerInsideRef.current && !volumeFocusInsideRef.current && !volumePointerActiveRef.current) {
        setVolumePopoverOpen(false);
      }
    }, 180);
  };

  const handleVolumeToggle = () => {
    keepVolumePopoverOpen();
    if (volume > 0) { setPrevVolume(volume); setVolume(0); }
    else setVolume(prevVolume || 0.8);
  };

  React.useEffect(() => {
    const releaseVolumePointer = () => {
      if (!volumePointerActiveRef.current) return;
      volumePointerActiveRef.current = false;
      if (!volumePointerInsideRef.current && !volumeFocusInsideRef.current) scheduleVolumePopoverClose();
    };
    window.addEventListener('pointerup', releaseVolumePointer, true);
    window.addEventListener('pointercancel', releaseVolumePointer, true);
    return () => {
      window.removeEventListener('pointerup', releaseVolumePointer, true);
      window.removeEventListener('pointercancel', releaseVolumePointer, true);
      clearVolumeCloseTimer();
    };
  }, []);
  const handlePlayMode = () => setPlayMode(playMode === 'sequence' ? 'random' : playMode === 'random' ? 'single' : 'sequence');
  const modeIcon = playMode === 'random' ? <Shuffle size={18} /> : playMode === 'single' ? <Repeat1 size={18} /> : <Repeat size={18} />;

  return (
    <TooltipProvider>
      <div id="player-bar" className={`ui-modern-player ${currentSong ? 'visible' : ''}`} data-volume-open={volumePopoverOpen ? 'true' : 'false'} data-queue-open={isQueueOpen ? 'true' : 'false'}>
        <div id="player-controls">
          <div className="modern-player-track">
            <CachedCover song={currentSong} alt={currentSong?.name || '专辑封面'} className="control-cover" onClick={() => { setIsQueueOpen(false); onToggleLyrics?.(); }} />
            <div className="modern-player-track-copy">
              <button className="modern-player-track-title" type="button" onClick={() => albumId && navigateTo('album-detail', { id: albumId })} disabled={!albumId} title={albumId ? '打开专辑' : undefined}>{currentSong?.name || '未播放'}</button>
              <button className="modern-player-track-artist" type="button" onClick={() => primaryArtist?.id && navigateTo('artist-detail', { id: primaryArtist.id })} disabled={!primaryArtist?.id} title={primaryArtist?.id ? '打开歌手' : undefined}>{primaryArtist?.name || '未知艺术家'}</button>
            </div>
          </div>

          <div className="modern-player-transport">
            <Tooltip content="上一首"><IconButton className="ctrl-btn" label="上一首" onClick={playPrev} disabled={playbackLocked}><SkipBack size={20} /></IconButton></Tooltip>
            <Tooltip content={isPlaying ? '暂停' : '播放'}><Button className="play-btn" variant="ghost" aria-label={isPlaying ? '暂停' : '播放'} onClick={togglePlay} disabled={playbackLocked}>{isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" />}</Button></Tooltip>
            <Tooltip content="下一首"><IconButton className="ctrl-btn" label="下一首" onClick={playNext} disabled={playbackLocked}><SkipForward size={20} /></IconButton></Tooltip>
          </div>

          <div className="modern-player-actions">
            <span className="modern-player-time">{formatTime(progress)} / {formatTime(effectiveDuration)}</span>
            <Tooltip content="播放模式"><IconButton className="ctrl-btn" label="播放模式" onClick={handlePlayMode} disabled={playbackLocked}>{modeIcon}</IconButton></Tooltip>
            <Tooltip content={isLiked ? '取消喜欢' : '喜欢'}><IconButton className={`ctrl-btn ${isLiked ? 'is-liked' : ''}`} label={isLiked ? '取消喜欢' : '喜欢'} onClick={() => currentSong && toggleLike(currentSong.id)} disabled={!currentSong}><Heart size={18} fill={isLiked ? 'currentColor' : 'none'} /></IconButton></Tooltip>
            <DropdownMenu open={playbackLocked ? false : undefined}>
              <DropdownMenuTrigger asChild><Button className="modern-quality-trigger" variant="outline" size="sm" disabled={playbackLocked} aria-label="切换音质">{quality.shortLabel}</Button></DropdownMenuTrigger>
              <DropdownMenuContent align="end"><DropdownMenuRadioGroup value={audioQuality} onValueChange={setAudioQuality}>{QUALITY_OPTIONS.map((option) => <DropdownMenuRadioItem key={option.key} value={option.key}>{option.label}</DropdownMenuRadioItem>)}</DropdownMenuRadioGroup></DropdownMenuContent>
            </DropdownMenu>
            <Tooltip content="播放队列"><IconButton className={`ctrl-btn ${isQueueOpen ? 'is-active' : ''}`} label="播放队列" onClick={() => setIsQueueOpen(!isQueueOpen)} disabled={playbackLocked}><ListMusic size={18} /></IconButton></Tooltip>
            <Tooltip content="桌面歌词"><IconButton className={`ctrl-btn modern-desktop-lyrics ${desktopLyricsConfig?.show ? 'is-active' : ''}`} label="桌面歌词" onClick={() => window.electronAPI ? window.electronAPI.toggleDesktopLyrics() : alert('桌面歌词功能仅在桌面客户端可用')}><MonitorSpeaker size={16} /></IconButton></Tooltip>
            <Popover open={volumePopoverOpen} onOpenChange={(open) => { clearVolumeCloseTimer(); setVolumePopoverOpen(open); }}>
              <PopoverAnchor asChild>
                <IconButton
                  className="ctrl-btn"
                  label="音量"
                  aria-expanded={volumePopoverOpen}
                  onClick={handleVolumeToggle}
                  onPointerEnter={() => { volumePointerInsideRef.current = true; keepVolumePopoverOpen(); }}
                  onPointerLeave={() => { volumePointerInsideRef.current = false; scheduleVolumePopoverClose(); }}
                  onFocus={() => { volumeFocusInsideRef.current = true; keepVolumePopoverOpen(); }}
                  onBlur={() => { volumeFocusInsideRef.current = false; scheduleVolumePopoverClose(); }}
                  disabled={playbackLocked}
                >
                  {volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
                </IconButton>
              </PopoverAnchor>
              <PopoverContent
                side="top"
                align="center"
                sideOffset={12}
                className="modern-volume-popover"
                onOpenAutoFocus={(event) => event.preventDefault()}
                onCloseAutoFocus={(event) => event.preventDefault()}
                onPointerEnter={() => { volumePointerInsideRef.current = true; keepVolumePopoverOpen(); }}
                onPointerLeave={() => { volumePointerInsideRef.current = false; scheduleVolumePopoverClose(); }}
                onPointerDownCapture={() => { volumePointerActiveRef.current = true; keepVolumePopoverOpen(); }}
                onFocusCapture={() => { volumeFocusInsideRef.current = true; keepVolumePopoverOpen(); }}
                onBlurCapture={(event) => {
                  if (event.currentTarget.contains(event.relatedTarget)) return;
                  volumeFocusInsideRef.current = false;
                  scheduleVolumePopoverClose();
                }}
              >
                <strong>{Math.round(volume * 100)}%</strong>
                <Slider aria-label="音量" value={[Math.round(volume * 100)]} onValueChange={([next]) => setVolume(next / 100)} min={0} max={100} step={1} />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <div id="progress-bar" className={isSeeking ? 'seeking' : ''} ref={progressRef}
          onPointerDown={(event) => { if (playbackLocked) return; event.preventDefault(); setIsSeeking(true); event.currentTarget.setPointerCapture?.(event.pointerId); setProgressPreview(getLyricPreview(event.clientX)); seekFromClientX(event.clientX); }}
          onPointerMove={(event) => handleProgressPointerMove(event.clientX)}
          onPointerUp={(event) => { setIsSeeking(false); event.currentTarget.releasePointerCapture?.(event.pointerId); }}
          onPointerCancel={() => setIsSeeking(false)} onPointerLeave={handleProgressPointerLeave}>
          {progressPreview && <div className="progress-lyric-preview" style={{ left: `${progressPreview.x}px` }}><div className="progress-preview-count">{progressPreview.index + 1} / {progressPreview.total}</div><div className="progress-preview-text">{progressPreview.text}</div>{progressPreview.translation && <div className="progress-preview-translation">{progressPreview.translation}</div>}<div className="progress-preview-line"><span>{formatTime(progressPreview.start)}</span><div className="progress-preview-meter"><i style={{ width: `${progressPreview.lineProgress * 100}%` }} /></div><span>{formatTime(progressPreview.end)}</span></div></div>}
          <div id="progress-fill" style={{ transform: `scaleX(${progressPercent / 100})` }} /><div id="progress-thumb" style={{ left: `${progressPercent}%` }} />
        </div>
      </div>
    </TooltipProvider>
  );
}
