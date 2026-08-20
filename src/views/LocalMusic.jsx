import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { FolderOpen, Music, Play, RefreshCw, Search, Plus, Trash2, HardDrive, FileAudio } from 'lucide-react';

export default function LocalMusic() {
  const { playSong, setPlaylist, currentSong, isPlaying } = useApp();

  const [folderPath, setFolderPath] = useState(() => localStorage.getItem('ichigo_local_music_folder') || '');
  const [songs, setSongs] = useState(() => {
    try {
      const saved = localStorage.getItem('ichigo_local_music_songs');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [scanning, setScanning] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('default'); // 'default' | 'title' | 'artist'

  const handleSelectFolder = async () => {
    if (!window.electronAPI?.selectLocalMusicFolder) {
      alert('本地音乐扫描仅在桌面客户端环境下可用。');
      return;
    }
    const selected = await window.electronAPI.selectLocalMusicFolder();
    if (selected) {
      setFolderPath(selected);
      localStorage.setItem('ichigo_local_music_folder', selected);
      performScan(selected);
    }
  };

  const performScan = async (path) => {
    const target = path || folderPath;
    if (!target || !window.electronAPI?.scanLocalMusicFolder) return;
    setScanning(true);
    try {
      const scanned = await window.electronAPI.scanLocalMusicFolder(target);
      setSongs(scanned || []);
      localStorage.setItem('ichigo_local_music_songs', JSON.stringify(scanned || []));
    } catch (err) {
      console.warn('Scan failed:', err);
      alert('扫描失败：' + (err.message || '未知错误'));
    } finally {
      setScanning(false);
    }
  };

  const handlePlayAll = () => {
    if (filteredSongs.length === 0) return;
    setPlaylist(filteredSongs);
    playSong(filteredSongs[0], filteredSongs);
  };

  const handlePlaySong = (song) => {
    setPlaylist(filteredSongs);
    playSong(song, filteredSongs);
  };

  const formatSize = (bytes) => {
    if (!bytes) return '--';
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  const filteredSongs = songs.filter(s => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (s.name || '').toLowerCase().includes(q) || (s.artist || '').toLowerCase().includes(q);
  }).sort((a, b) => {
    if (sortBy === 'title') return (a.name || '').localeCompare(b.name || '');
    if (sortBy === 'artist') return (a.artist || '').localeCompare(b.artist || '');
    return 0;
  });

  return (
    <div className="view-container local-music-view" style={{ padding: '24px 32px', color: '#fff' }}>
      {/* Header Banner */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '24px',
        background: 'linear-gradient(135deg, rgba(255, 64, 129, 0.12) 0%, rgba(30, 40, 60, 0.4) 100%)',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        borderRadius: '16px',
        backdropFilter: 'blur(20px)',
        marginBottom: '24px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '14px',
            background: 'linear-gradient(135deg, var(--primary) 0%, #ff80ab 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 8px 20px rgba(255, 64, 129, 0.35)'
          }}>
            <HardDrive size={28} color="#fff" />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 700 }}>本地无损音乐</h2>
            <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.65)', marginTop: '4px' }}>
              {folderPath ? `当前路径：${folderPath}（共 ${songs.length} 首歌曲）` : '尚未选择本地音乐文件夹'}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            type="button"
            onClick={handleSelectFolder}
            style={{
              padding: '10px 18px',
              borderRadius: '10px',
              border: '1px solid rgba(255,255,255,0.2)',
              background: 'rgba(255,255,255,0.08)',
              color: '#fff',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <FolderOpen size={16} />
            {folderPath ? '更改扫描目录' : '选择音乐目录'}
          </button>

          {folderPath && (
            <button
              type="button"
              onClick={() => performScan()}
              disabled={scanning}
              style={{
                padding: '10px 18px',
                borderRadius: '10px',
                border: 'none',
                background: 'var(--primary)',
                color: '#fff',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                opacity: scanning ? 0.6 : 1
              }}
            >
              <RefreshCw size={16} className={scanning ? 'spin' : ''} />
              {scanning ? '正在扫描...' : '刷新曲库'}
            </button>
          )}
        </div>
      </div>

      {/* Controls Bar */}
      {songs.length > 0 && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '16px',
          gap: '16px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              type="button"
              onClick={handlePlayAll}
              style={{
                padding: '10px 22px',
                borderRadius: '24px',
                border: 'none',
                background: 'var(--primary)',
                color: '#fff',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 4px 14px rgba(255, 64, 129, 0.3)'
              }}
            >
              <Play size={16} fill="#fff" /> 全部播放 ({filteredSongs.length})
            </button>

            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
              style={{
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid rgba(255,255,255,0.12)',
                background: 'rgba(255,255,255,0.06)',
                color: '#fff',
                fontSize: '12px',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              <option value="default" style={{ background: '#1c2028' }}>默认排序</option>
              <option value="title" style={{ background: '#1c2028' }}>按歌名排序</option>
              <option value="artist" style={{ background: '#1c2028' }}>按歌手排序</option>
            </select>
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: '20px',
            padding: '6px 14px',
            width: '260px'
          }}>
            <Search size={14} color="rgba(255,255,255,0.5)" />
            <input
              type="text"
              placeholder="搜索本地曲目..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#fff',
                fontSize: '12px',
                outline: 'none',
                width: '100%'
              }}
            />
          </div>
        </div>
      )}

      {/* Song List Table */}
      {filteredSongs.length > 0 ? (
        <div style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '12px',
          overflow: 'hidden'
        }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '48px 2fr 1.5fr 1fr 60px',
            padding: '12px 16px',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            fontSize: '12px',
            color: 'rgba(255,255,255,0.45)',
            fontWeight: 500
          }}>
            <span>#</span>
            <span>标题</span>
            <span>歌手</span>
            <span>文件大小</span>
            <span style={{ textAlign: 'right' }}>操作</span>
          </div>

          <div style={{ maxHeight: 'calc(100vh - 360px)', overflowY: 'auto' }}>
            {filteredSongs.map((s, idx) => {
              const isCurrent = currentSong?.id === s.id;
              return (
                <div
                  key={s.id || idx}
                  onDoubleClick={() => handlePlaySong(s)}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '48px 2fr 1.5fr 1fr 60px',
                    alignItems: 'center',
                    padding: '10px 16px',
                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                    background: isCurrent ? 'rgba(255, 64, 129, 0.12)' : 'transparent',
                    fontSize: '13px',
                    cursor: 'pointer',
                    transition: 'background 0.15s'
                  }}
                  className="song-row-hover"
                >
                  <span style={{ color: isCurrent ? 'var(--primary)' : 'rgba(255,255,255,0.4)', fontSize: '12px' }}>
                    {idx + 1}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, paddingRight: '12px' }}>
                    <FileAudio size={16} color={isCurrent ? 'var(--primary)' : 'rgba(255,255,255,0.5)'} />
                    <span style={{
                      fontWeight: isCurrent ? 600 : 400,
                      color: isCurrent ? 'var(--primary)' : '#fff',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      {s.name}
                    </span>
                  </div>
                  <span style={{
                    color: 'rgba(255,255,255,0.65)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    {s.artist}
                  </span>
                  <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: '12px' }}>
                    {formatSize(s.fileSize)}
                  </span>
                  <div style={{ textAlign: 'right' }}>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePlaySong(s);
                      }}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: isCurrent ? 'var(--primary)' : 'rgba(255,255,255,0.7)',
                        cursor: 'pointer',
                        padding: '4px'
                      }}
                    >
                      <Play size={14} fill={isCurrent ? 'var(--primary)' : 'currentColor'} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div style={{
          textAlign: 'center',
          padding: '60px 20px',
          color: 'rgba(255,255,255,0.5)'
        }}>
          <Music size={48} style={{ opacity: 0.3, marginBottom: '16px' }} />
          <div style={{ fontSize: '15px', color: '#fff', marginBottom: '6px' }}>
            {folderPath ? '当前文件夹下未扫描到音频文件' : '尚未选择本地音乐文件夹'}
          </div>
          <div style={{ fontSize: '12px', marginBottom: '20px' }}>
            支持 MP3, FLAC, WAV, OGG, M4A, AAC, OPUS, APE 等无损格式
          </div>
          <button
            type="button"
            onClick={handleSelectFolder}
            style={{
              padding: '10px 24px',
              borderRadius: '8px',
              border: 'none',
              background: 'var(--primary)',
              color: '#fff',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 600
            }}
          >
            选择本地文件夹
          </button>
        </div>
      )}
    </div>
  );
}
