import React, { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { api } from '../utils/api';
import { Search as SearchIcon, Play, Trash2, Clock, Music, FolderHeart, Award, User, Video } from 'lucide-react';

const tabs = [
  { key: 'songs', type: 1, name: '单曲', icon: Music },
  { key: 'playlists', type: 1000, name: '歌单', icon: FolderHeart },
  { key: 'albums', type: 10, name: '专辑', icon: Award },
  { key: 'artists', type: 100, name: '歌手', icon: User },
  { key: 'mvs', type: 1004, name: 'MV', icon: Video }
];

export default function Search() {
  const { navigateTo, playSong } = useApp();
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState(tabs[0]);
  const [hotSearches, setHotSearches] = useState([]);
  const [history, setHistory] = useState([]);
  const [results, setResults] = useState({ songs: [], playlists: [], albums: [], artists: [], mvs: [] });
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // Initial load hot search list and local history
  useEffect(() => {
    const fetchHot = async () => {
      try {
        const res = await api.getHotSearch();
        if (res.data) setHotSearches(res.data.slice(0, 10));
      } catch (err) {
        console.error('Failed to load hot search:', err);
      }
    };
    fetchHot();

    const localHistory = localStorage.getItem('search_history');
    if (localHistory) {
      setHistory(JSON.parse(localHistory));
    }
  }, []);

  // Trigger search when tab changes if keyword is present
  useEffect(() => {
    if (hasSearched && query) {
      executeSearch(query, activeTab.type);
    }
  }, [activeTab]);

  const executeSearch = async (keyword, searchType = activeTab.type) => {
    if (!keyword.trim()) return;
    setLoading(true);
    setHasSearched(true);
    setQuery(keyword);
    
    // Save to history list
    const updatedHistory = [keyword, ...history.filter(h => h !== keyword)].slice(0, 10);
    setHistory(updatedHistory);
    localStorage.setItem('search_history', JSON.stringify(updatedHistory));

    try {
      const res = await api.search(keyword, searchType, 30);
      const dataKey = activeTab.key;
      
      let parsedResults = [];
      if (searchType === 1) parsedResults = res.result?.songs || [];
      else if (searchType === 10) parsedResults = res.result?.albums || [];
      else if (searchType === 100) parsedResults = res.result?.artists || [];
      else if (searchType === 1000) parsedResults = res.result?.playlists || [];
      else if (searchType === 1004) parsedResults = res.result?.mvs || [];

      setResults(prev => ({
        ...prev,
        [dataKey]: parsedResults
      }));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleClearHistory = () => {
    setHistory([]);
    localStorage.removeItem('search_history');
  };

  const handleRemoveHistoryItem = (item, e) => {
    e.stopPropagation();
    const updatedHistory = history.filter(h => h !== item);
    setHistory(updatedHistory);
    localStorage.setItem('search_history', JSON.stringify(updatedHistory));
  };


  const getSongTitle = (song) => song?.name || song?.title || '\u672a\u77e5';
  const getSongArtists = (song) => song?.ar || song?.artists || [];
  const getSongAlbum = (song) => song?.al || song?.album || null;
  const safeSongs = results.songs.filter(Boolean);

  const formatDuration = (ms) => {
    const s = Math.floor(ms / 1000);
    const min = Math.floor(s / 60).toString().padStart(2, '0');
    const sec = Math.floor(s % 60).toString().padStart(2, '0');
    return `${min}:${sec}`;
  };

  return (
    <div className="view-container">
      {/* Search Bar Input */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
        <div className="search-input-wrap">
          <SearchIcon size={18} color="var(--text-muted)" />
          <input
            type="text"
            className="search-input"
            placeholder="搜索音乐、歌单、专辑、歌手、MV..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && executeSearch(query)}
          />
        </div>
      </div>

      {/* Tabs */}
      {hasSearched && (
        <div className="search-tabs">
          {tabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab.key === tab.key;
            return (
              <button
                key={tab.key}
                className={`search-tab-btn ${isActive ? 'active' : ''}`}
                onClick={() => setActiveTab(tab)}
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <Icon size={14} />
                <span>{tab.name}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Landing State: Hot Queries & History */}
      {!hasSearched && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px', marginTop: '10px' }}>
          {/* Hot searches */}
          <div>
            <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '16px', color: 'var(--text-main)' }}>热搜榜</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {hotSearches.map((item, index) => (
                <div
                  key={index}
                  onClick={() => executeSearch(item.searchWord)}
                  style={{ display: 'flex', alignItems: 'center', gap: '14px', cursor: 'pointer', padding: '6px', borderRadius: 'var(--border-radius-md)', transition: 'background 0.2s' }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'var(--surface-bg)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <span style={{ fontSize: '14px', fontWeight: 700, color: index < 3 ? 'var(--primary)' : 'var(--text-muted)', width: '20px', textAlign: 'center' }}>
                    {index + 1}
                  </span>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)' }}>{item.searchWord}</span>
                      {item.iconUrl && <img src={item.iconUrl} alt="" style={{ height: '12px', objectFit: 'contain' }} />}
                    </div>
                    {item.content && <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{item.content}</div>}
                  </div>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{item.score.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Search History */}
          <div>
            <div className="flex-between" style={{ marginBottom: '16px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-main)' }}>搜索历史</h3>
              {history.length > 0 && (
                <button
                  onClick={handleClearHistory}
                  style={{ background: 'none', border: 'none', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', cursor: 'pointer' }}
                >
                  <Trash2 size={12} /> 清空历史
                </button>
              )}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
              {history.map((item, index) => (
                <div
                  key={index}
                  onClick={() => executeSearch(item)}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 14px', borderRadius: '99px', background: 'var(--surface-bg)', border: '1px solid var(--card-border)', cursor: 'pointer', transition: 'all 0.2s', fontSize: '12px' }}
                  onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--glass-bg-strong)'}
                  onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--card-border)'}
                >
                  <Clock size={12} color="var(--text-muted)" />
                  <span style={{ color: 'var(--text-main)' }}>{item}</span>
                  <button
                    onClick={(e) => handleRemoveHistoryItem(item, e)}
                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', padding: 0 }}
                  >
                    ×
                  </button>
                </div>
              ))}
              {history.length === 0 && (
                <div style={{ color: 'var(--text-muted)', fontSize: '12px', padding: '10px 0' }}>暂无搜索历史记录</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Loading overlay spinner */}
      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
          🍓 搜索中...
        </div>
      )}

      {/* Results Rendering */}
      {!loading && hasSearched && (
        <div>
          {/* Songs Results */}
          {activeTab.key === 'songs' && (
            <table className="songs-table">
              <thead>
                <tr>
                  <th>歌名</th>
                  <th>歌手</th>
                  <th>专辑</th>
                  <th>时长</th>
                </tr>
              </thead>
              <tbody>
                {safeSongs.map((song) => {
                  const artists = getSongArtists(song);
                  const album = getSongAlbum(song);
                  return (
                  <tr key={song.id} className="song-row" onDoubleClick={() => playSong(song, safeSongs)}>
                    <td>
                      <div className="song-title-cell">
                        <button
                          className="play-pause-btn"
                          style={{ width: '26px', height: '26px', boxShadow: 'none' }}
                          onClick={() => playSong(song, safeSongs)}
                        >
                          <Play size={10} fill="currentColor" style={{ marginLeft: 1 }} />
                        </button>
                        <div className="song-row-info">
                          <div className="song-row-name" onClick={() => playSong(song, safeSongs)}>
                            {getSongTitle(song)}
                          </div>
                          {song.alia?.length > 0 && (
                            <div className="song-row-artist" style={{ fontSize: '10px' }}>
                              {song.alia.join(' / ')}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="song-row-artists">
                        {artists.length > 0 ? artists.map((artist, idx) => (
                          <React.Fragment key={artist.id || artist.name || idx}>
                            {idx > 0 && ' / '}
                            <span onClick={() => artist.id && navigateTo('artist-detail', { id: artist.id })}>
                              {artist.name || '\u672a\u77e5'}
                            </span>
                          </React.Fragment>
                        )) : <span>{'\u672a\u77e5'}</span>}
                      </div>
                    </td>
                    <td>
                      <span 
                        onClick={() => album?.id && navigateTo('album-detail', { id: album.id })}
                        style={{ cursor: 'pointer', color: 'var(--text-muted)' }}
                        onMouseEnter={(e) => e.target.style.color = 'var(--text-active)'}
                        onMouseLeave={(e) => e.target.style.color = 'var(--text-muted)'}
                      >
                        {album?.name || '\u672a\u77e5'}
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-muted)' }}>{formatDuration(song.dt || song.duration || song.durationMs || 0)}</td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {/* Playlists results */}
          {activeTab.key === 'playlists' && (
            <div className="grid-6">
              {results.playlists.map(playlist => (
                <div
                  key={playlist.id}
                  className="music-card"
                  onClick={() => navigateTo('playlist-detail', { id: playlist.id })}
                >
                  <div className="card-image-wrap">
                    <img src={playlist.coverImgUrl} alt="" className="card-image" />
                  </div>
                  <div className="card-title">{playlist.name}</div>
                  <div className="card-desc">{playlist.trackCount}首音乐 · {Math.floor(playlist.playCount / 10000)}万播放</div>
                </div>
              ))}
            </div>
          )}

          {/* Albums results */}
          {activeTab.key === 'albums' && (
            <div className="grid-6">
              {results.albums.map(album => (
                <div
                  key={album.id}
                  className="music-card"
                  onClick={() => navigateTo('album-detail', { id: album.id })}
                >
                  <div className="card-image-wrap">
                    <img src={album.picUrl} alt="" className="card-image" />
                  </div>
                  <div className="card-title">{album.name}</div>
                  <div className="card-desc">{album.artist?.name || '未知歌手'}</div>
                </div>
              ))}
            </div>
          )}

          {/* Artists results */}
          {activeTab.key === 'artists' && (
            <div className="grid-6">
              {results.artists.map(artist => (
                <div
                  key={artist.id}
                  className="music-card"
                  onClick={() => navigateTo('artist-detail', { id: artist.id })}
                >
                  <div className="card-image-wrap" style={{ borderRadius: '50%' }}>
                    <img src={artist.img1v1Url || artist.picUrl} alt="" className="card-image" />
                  </div>
                  <div className="card-title" style={{ textAlign: 'center' }}>{artist.name || '\u672a\u77e5'}</div>
                  {artist.alias?.length > 0 && <div className="card-desc" style={{ textAlign: 'center' }}>{artist.alias[0]}</div>}
                </div>
              ))}
            </div>
          )}

          {/* MVs results */}
          {activeTab.key === 'mvs' && (
            <div className="grid-6">
              {results.mvs.map(mv => (
                <div
                  key={mv.id}
                  className="music-card"
                  onClick={() => navigateTo('mv-player', { id: mv.id })}
                >
                  <div className="card-image-wrap" style={{ aspectRatio: '16/9' }}>
                    <img src={mv.cover} alt="" className="card-image" />
                  </div>
                  <div className="card-title">{mv.name}</div>
                  <div className="card-desc">by {mv.artistName} · {formatDuration(mv.duration)}</div>
                </div>
              ))}
            </div>
          )}

          {/* Empty search fallback */}
          {(!results[activeTab.key] || results[activeTab.key].length === 0) && (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)', fontSize: '13px' }}>
              没有找到相关结果，换个词试试吧🍓
            </div>
          )}
        </div>
      )}
    </div>
  );
}
