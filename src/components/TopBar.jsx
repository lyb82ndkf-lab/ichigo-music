import React from 'react';
import { useApp } from '../context/AppContext';
import { LogOut, LogIn, Maximize2, Minimize2, X } from 'lucide-react';

export default function TopBar() {
  const { user, navigateTo, logout, requestAppClose } = useApp();

  return (
    <div className="title-bar" style={{
      height: '48px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      WebkitAppRegion: 'drag',
      background: 'transparent',
      paddingLeft: '16px',
      zIndex: 9999,
      flexShrink: 0
    }}>
      {/* Left: Brand Logo & App Name */}
      <div className="brand" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span className="brand-logo" style={{ fontSize: '20px', animation: 'float 4s ease-in-out infinite' }}>🍓</span>
        <span className="brand-name" style={{
          fontFamily: 'var(--font-title)',
          fontWeight: 800,
          fontSize: '15px',
          letterSpacing: '1px',
          background: 'linear-gradient(to right, var(--text-active), var(--primary))',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent'
        }}>
          ICHIGOMusic
        </span>
      </div>

      {/* Right: User Profile & Window Controls */}
      <div style={{ display: 'flex', alignItems: 'center', WebkitAppRegion: 'no-drag', height: '100%' }}>
        
        {/* User Login Section */}
        <div style={{ display: 'flex', alignItems: 'center', marginRight: '16px', gap: '12px' }}>
          {user ? (
            <div 
              style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', padding: '4px 10px', borderRadius: '20px', background: 'var(--glass-bg)', transition: 'background 0.2s' }}
              onClick={() => navigateTo('settings')}
            >
              <img src={user.avatarUrl} alt="avatar" style={{ width: 24, height: 24, borderRadius: '50%' }} />
              <span style={{ fontSize: '12px', color: 'var(--text-main)', fontWeight: 600 }}>{user.nickname}</span>
              <button 
                onClick={(e) => { e.stopPropagation(); logout(); }}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', marginLeft: 4 }}
                title="退出登录"
              >
                <LogOut size={14} />
              </button>
            </div>
          ) : (
            <div 
              style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', padding: '6px 12px', borderRadius: '20px', background: 'var(--glass-bg)', transition: 'background 0.2s' }}
              onClick={() => navigateTo('settings')}
            >
              <LogIn size={14} color="var(--primary)" />
              <span style={{ fontSize: '12px', color: 'var(--text-main)', fontWeight: 600 }}>未登录</span>
            </div>
          )}
        </div>

        {/* Window Controls */}
        <div className="title-bar-controls" style={{ display: 'flex', height: '100%' }}>
          <button className="window-btn" onClick={() => window.electronAPI?.minimize()} title="最小化">
            <svg width="12" height="12" viewBox="0 0 12 12"><rect fill="currentColor" width="10" height="1" x="1" y="6"></rect></svg>
          </button>
          <button className="window-btn" onClick={() => window.electronAPI?.maximize()} title="最大化">
            <svg width="12" height="12" viewBox="0 0 12 12"><rect width="9" height="9" x="1.5" y="1.5" fill="none" stroke="currentColor"></rect></svg>
          </button>
          <button className="window-btn close-btn" onClick={requestAppClose} title="关闭">
            <svg width="12" height="12" viewBox="0 0 12 12"><polygon fill="currentColor" fillRule="evenodd" points="11 1.576 6.583 6 11 10.424 10.424 11 6 6.583 1.576 11 1 10.424 5.417 6 1 1.576 1.576 1 6 5.417 10.424 1"></polygon></svg>
          </button>
        </div>
      </div>
    </div>
  );
}
