import React, { useRef } from 'react';
import { useApp } from '../context/AppContext';
import { Home, Settings, User as UserIcon, Search, Minus, Square, X } from 'lucide-react';
import { IconButton, Input, Tooltip, TooltipProvider } from './ui';

export default function ModernTopControls() {
  const { navigateTo, user, requestAppClose, currentView, viewData } = useApp();
  const searchInputRef = useRef(null);
  const handleSearch = (event) => {
    if (event.key === 'Enter' && event.target.value.trim()) {
      navigateTo('search', { keyword: event.target.value.trim() });
      event.target.blur();
    }
  };
  React.useEffect(() => {
    if (currentView === 'search' && viewData?.keyword && searchInputRef.current) searchInputRef.current.value = viewData.keyword;
  }, [currentView, viewData?.keyword]);

  return (
    <TooltipProvider>
      <div id="modern-unified-topbar">
        <div className="topbar-left"><span className="desktop-app-title">ICHIGOMUSIC</span></div>
        <div className="topbar-center">
          <Tooltip content="主页"><IconButton className="modern-glass-btn" label="主页" size="sm" onClick={() => navigateTo('home')}><Home size={18} /></IconButton></Tooltip>
          <Input className="modern-search-input" ref={searchInputRef} icon={<Search size={16} />} type="search" placeholder="搜索音乐、歌手、歌词…" onKeyDown={handleSearch} />
          <Tooltip content="设置"><IconButton className="modern-glass-btn" label="设置" size="sm" onClick={() => navigateTo('settings')}><Settings size={18} /></IconButton></Tooltip>
          <Tooltip content={user?.nickname || '登录'}><IconButton className="modern-glass-btn user-btn" label={user?.nickname || '登录'} size="sm" onClick={() => navigateTo('settings', { tab: 'account' })}>{user ? <img src={user.avatarUrl} alt="用户头像" className="modern-user-avatar" /> : <UserIcon size={18} />}</IconButton></Tooltip>
        </div>
        <div className="topbar-right desktop-window-controls">
          <Tooltip content="最小化"><IconButton className="desktop-window-btn" label="最小化" size="sm" onClick={() => window.electronAPI?.minimize?.()}><Minus size={16} /></IconButton></Tooltip>
          <Tooltip content="最大化"><IconButton className="desktop-window-btn" label="最大化" size="sm" onClick={() => window.electronAPI?.maximize?.()}><Square size={14} /></IconButton></Tooltip>
          <Tooltip content="关闭"><IconButton className="desktop-window-btn close" label="关闭" size="sm" onClick={requestAppClose}><X size={18} /></IconButton></Tooltip>
        </div>
      </div>
    </TooltipProvider>
  );
}
