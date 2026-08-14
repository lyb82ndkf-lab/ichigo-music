import React, { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { Play, ListMusic } from 'lucide-react';
import { Button, EmptyState, IconButton, ScrollArea } from './ui';

export default function MiniQueuePopover({ isOpen, onClose }) {
  const { playlist, currentSong, playSong } = useApp();
  const [visibleCount, setVisibleCount] = useState(100);
  useEffect(() => { if (isOpen) setVisibleCount(100); }, [isOpen, playlist?.length]);
  if (!isOpen) return null;
  const songs = playlist || [];
  // playlist.slice(0, visibleCount) is retained as the bounded render contract.
  return <>
    <button type="button" className="modern-queue-overlay open" aria-label="关闭播放队列" onClick={onClose} />
    <aside className="modern-queue-sidebar open" aria-label="当前播放队列">
      <header className="modern-queue-header"><div><span>播放队列</span><small>{songs.length} 首</small></div><IconButton label="关闭播放队列" size="sm" onClick={onClose}>×</IconButton></header>
      {songs.length ? <ScrollArea className="modern-queue-scroll"><div className="queue-list-container">{playlist.slice(0, visibleCount).map((song, index) => {
        const isNow = currentSong?.id === song.id;
        const coverUrl = song?.coverUrl || song?.al?.picUrl || '';
        return <button type="button" key={`${song.id}-${index}`} className={`modern-queue-item ${isNow ? 'now' : ''}`} onClick={() => !isNow && playSong(song, songs)}>
          <span className="queue-cover" style={coverUrl ? { backgroundImage: `url(${coverUrl})` } : undefined} />
          <span className="queue-info"><b className="queue-name">{song.name}</b><small className="queue-artist">{song.ar?.[0]?.name || song.artists?.[0]?.name || song.artist || '未知艺术家'}</small></span>
          {isNow && <Play size={14} fill="currentColor" />}
        </button>;
      })}{visibleCount < songs.length && <Button variant="ghost" size="sm" block onClick={() => setVisibleCount((count) => Math.min(songs.length, count + 100))}>加载更多</Button>}</div></ScrollArea> : <EmptyState icon={<ListMusic size={26} />} title="播放队列为空" description="从歌单或搜索结果中选择一首歌开始播放。" />}
    </aside>
  </>;
}


