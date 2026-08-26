import React, { useEffect, useState, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { Play, ListMusic, HeartPulse } from 'lucide-react';
import { Button, EmptyState, IconButton, ScrollArea } from './ui';

export default function MiniQueuePopover({ isOpen, onClose }) {
  const { playlist, currentSong, playSong, playMode } = useApp();
  const [visibleCount, setVisibleCount] = useState(100);
  const activeItemRef = useRef(null);

  const songs = playlist || [];
  const isHeart = playMode === 'heart';

  useEffect(() => {
    if (isOpen) {
      const activeIndex = songs.findIndex((song) => String(song?.id) === String(currentSong?.id));
      if (activeIndex >= 0 && activeIndex >= 100) {
        setVisibleCount(Math.max(100, Math.ceil((activeIndex + 25) / 50) * 50));
      } else {
        setVisibleCount(100);
      }
    }
  }, [isOpen, songs.length, currentSong?.id]);

  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => {
      if (activeItemRef.current) {
        activeItemRef.current.scrollIntoView({
          behavior: 'smooth',
          block: 'center'
        });
      }
    }, 60);
    return () => clearTimeout(timer);
  }, [isOpen, currentSong?.id]);

  if (!isOpen) return null;
  return <>
    <button type="button" className="modern-queue-overlay open" aria-label="关闭播放队列" onClick={onClose} />
    <aside className={`modern-queue-sidebar open ${isHeart ? 'is-heart-sidebar' : ''}`} aria-label="当前播放队列">
      <header className="modern-queue-header">
        <div>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            {isHeart ? <>心动模式 <HeartPulse size={16} color="var(--primary)" className="heart-mode-icon" /></> : '播放队列'}
          </span>
          <small>{songs.length} 首{isHeart ? ' · 智能推荐中' : ''}</small>
        </div>
        <IconButton label="关闭播放队列" size="sm" onClick={onClose}>×</IconButton>
      </header>
      {songs.length ? <ScrollArea className="modern-queue-scroll"><div className="queue-list-container">{playlist.slice(0, visibleCount).map((song, index) => {
        const isNow = String(currentSong?.id) === String(song.id);
        const coverUrl = song?.coverUrl || song?.al?.picUrl || '';
        return <button
          ref={isNow ? activeItemRef : null}
          type="button"
          key={`${song.id}-${index}`}
          className={`modern-queue-item ${isNow ? 'now' : ''}`}
          onClick={() => !isNow && playSong(song, songs)}
        >
          <span className="queue-cover" style={coverUrl ? { backgroundImage: `url(${coverUrl})` } : undefined} />
          <span className="queue-info">
            <b className="queue-name">
              {song.name}
              {song.isHeartRecommend && <span className="queue-heart-pill">心动推荐</span>}
            </b>
            <small className="queue-artist">{song.ar?.[0]?.name || song.artists?.[0]?.name || song.artist || '未知艺术家'}</small>
          </span>
          {isNow && <Play size={14} fill="currentColor" />}
        </button>;
      })}{visibleCount < songs.length && <Button variant="ghost" size="sm" block onClick={() => setVisibleCount((count) => Math.min(songs.length, count + 100))}>加载更多</Button>}</div></ScrollArea> : <EmptyState icon={<ListMusic size={26} />} title="播放队列为空" description="从歌单或搜索结果中选择一首歌开始播放。" />}
    </aside>
  </>;
}


