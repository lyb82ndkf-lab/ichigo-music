import React from 'react';
import { useApp } from '../context/AppContext';
import { Play } from 'lucide-react';

export default function MiniQueuePopover({ isOpen, onClose }) {
  const { playlist, currentSong, playSong } = useApp();

  return (
    <>
      <div 
        className={`modern-queue-overlay ${isOpen ? 'open' : ''}`} 
        onClick={onClose}
      />
      <div className={`modern-queue-sidebar ${isOpen ? 'open' : ''}`}>
        <div style={{ padding: '0 8px 16px', fontSize: '15px', fontWeight: 700, color: 'rgba(255,255,255,0.9)', borderBottom: '1px solid rgba(255,255,255,0.1)', marginBottom: '12px' }}>
          当前播放队列 ({playlist?.length || 0})
        </div>
        <div className="queue-list-container" style={{ display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto', flex: 1, paddingRight: '4px' }}>
          {playlist && playlist.map((song, idx) => {
            const isNow = currentSong?.id === song.id;
            const coverUrl = song?.coverUrl || song?.al?.picUrl || 'https://p2.music.126.net/UeTuwE7Cx877Y2gCGIseYg==/109951163026279185.jpg';
            return (
              <div 
                key={`${song.id}-${idx}`} 
                className={`modern-queue-item ${isNow ? 'now' : ''}`}
                onClick={() => {
                  if (!isNow) playSong(song, playlist);
                }}
              >
                <div 
                  className="queue-cover" 
                  style={{ backgroundImage: `url(${coverUrl})`, backgroundSize: 'cover' }} 
                />
                <div className="queue-info">
                  <div className="queue-name">{song.name}</div>
                  <div className="queue-artist">{song.ar?.[0]?.name || song.artists?.[0]?.name || song.artist || '未知艺术家'}</div>
                </div>
                {isNow && <Play size={14} fill="currentColor" color="rgba(255,255,255,0.9)" />}
              </div>
            );
          })}
          {(!playlist || playlist.length === 0) && (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'rgba(255,255,255,0.4)', fontSize: '13px' }}>
              播放列表为空
            </div>
          )}
        </div>
      </div>
    </>
  );
}
