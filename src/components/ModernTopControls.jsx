import React, { useRef } from 'react';
import { useApp } from '../context/AppContext';
import { Home, Settings, User as UserIcon, Search, Minus, Square, X } from 'lucide-react';

export default function ModernTopControls() {
  const { navigateTo, user } = useApp();
  const searchInputRef = useRef(null);

  const handleSearch = (e) => {
    if (e.key === 'Enter' && e.target.value.trim()) {
      navigateTo('search', { keyword: e.target.value.trim() });
      e.target.blur();
    }
  };

  return (
    <div id="modern-unified-topbar">
      <div className="topbar-left">
        <span className="desktop-app-title">ICHIGOMUSIC</span>
      </div>
      
      <div className="topbar-center">
        <button className="modern-glass-btn icon-btn" title="主页" onClick={() => navigateTo('home')}>
          <Home size={18} />
        </button>
        
        <div id="unified-search-box">
          <Search size={16} color="rgba(255,255,255,0.4)" style={{ marginLeft: 14 }} />
          <input 
            ref={searchInputRef}
            type="text" 
            placeholder="搜索音乐、歌手、歌词..." 
            onKeyDown={handleSearch}
            className="unified-search-input"
          />
        </div>

        <button className="modern-glass-btn icon-btn" title="设置" onClick={() => navigateTo('settings')}>
          <Settings size={18} />
        </button>
        
        <button className="modern-glass-btn icon-btn user-btn" title={user ? user.nickname : '登录'} onClick={() => navigateTo('settings', { tab: 'account' })}>
          {user ? (
            <img src={user.avatarUrl} alt="avatar" style={{ width: 22, height: 22, borderRadius: '50%', objectFit: 'cover' }} />
          ) : (
            <UserIcon size={18} />
          )}
        </button>
      </div>

      <div className="topbar-right desktop-window-controls">
        <button className="desktop-window-btn" onClick={() => window.electronAPI?.minimize?.()} title="最小化">
          <Minus size={16} />
        </button>
        <button className="desktop-window-btn" onClick={() => window.electronAPI?.maximize?.()} title="最大化">
          <Square size={14} />
        </button>
        <button className="desktop-window-btn close" onClick={() => window.electronAPI?.close?.()} title="关闭">
          <X size={18} />
        </button>
      </div>
    </div>
  );
}
