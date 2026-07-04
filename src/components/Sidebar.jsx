import React from 'react';
import { useApp } from '../context/AppContext';
import { api } from '../utils/api';
import {
  Music,
  Search,
  ListMusic,
  Heart,
  History,
  Settings as SettingsIcon
} from 'lucide-react';

const navNameMap = {
  discover: '发现音乐',
  search: '搜索音乐',
  leaderboards: '排行榜',
  liked: '我喜欢的音乐',
  recent: '最近播放',
  settings: '设置'
};

function safeNavName(item) {
  if (!item?.name || /[?]{2,}|[\uFFFD]/.test(item.name)) {
    return navNameMap[item?.key] || item?.key || '';
  }
  return item.name;
}

const iconMap = {
  discover: Music,
  search: Search,
  leaderboards: ListMusic,
  liked: Heart,
  recent: History,
  settings: SettingsIcon
};

export default function Sidebar() {
  const {
    currentView,
    navigateTo,
    navbarConfig,
    user,
    userPlaylists,
    viewData
  } = useApp();

  return (
    <aside className="app-sidebar">
      <nav className="nav-menu" style={{ paddingTop: '10px' }}>
        {navbarConfig
          .filter(item => item.show)
          .map(item => {
            const IconComponent = iconMap[item.key] || Music;
            const isActive = currentView === item.key;

            return (
              <button
                key={item.key}
                className={`nav-item ${isActive ? 'active' : ''}`}
                onClick={() => navigateTo(item.key)}
              >
                <IconComponent size={18} />
                <span>{safeNavName(item)}</span>
              </button>
            );
          })}
      </nav>

      {user && userPlaylists && userPlaylists.length > 0 && (
        <div className="sidebar-playlists-section" style={{
          flex: 1,
          overflowY: 'auto',
          marginTop: '15px',
          borderTop: '1px solid var(--card-border)',
          paddingTop: '15px',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px'
        }}>
          <span style={{
            fontSize: '11px',
            fontWeight: 700,
            color: 'var(--text-muted)',
            padding: '0 16px 8px 16px',
            textTransform: 'uppercase',
            letterSpacing: '1px',
            userSelect: 'none'
          }}>
            {'我的歌单'}
          </span>
          <div className="sidebar-playlists-list" style={{ display: 'flex', flexDirection: 'column', gap: '2px', padding: '0 8px' }}>
            {userPlaylists.map(pl => {
              const isActive = currentView === 'playlist-detail' && viewData?.id === pl.id;
              return (
                <button
                  key={pl.id}
                  className={`nav-item ${isActive ? 'active' : ''}`}
                  style={{
                    padding: '8px 12px',
                    fontSize: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    width: '100%',
                    textAlign: 'left',
                    background: 'transparent',
                    border: 'none',
                    borderRadius: 'var(--border-radius-md)',
                    cursor: 'pointer',
                    color: isActive ? 'var(--primary)' : 'var(--text-main)',
                    transition: 'all 0.2s'
                  }}
                  onClick={() => navigateTo('playlist-detail', { id: pl.id })}
                >
                  <ListMusic size={14} style={{ flexShrink: 0 }} />
                  <span style={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    {pl.name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </aside>
  );
}
