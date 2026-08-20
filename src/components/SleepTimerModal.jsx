import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Moon, Clock, Check, X, Bell, Play, Pause } from 'lucide-react';

export default function SleepTimerModal({ isOpen, onClose }) {
  const { isPlaying, setIsPlaying, audioElement, volume, setVolume } = useApp();

  const [timerMode, setTimerMode] = useState('minutes'); // 'minutes' | 'endOfSong'
  const [selectedMinutes, setSelectedMinutes] = useState(30);
  const [customMinutes, setCustomMinutes] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(0);

  // Read / write to global window session for persistent background countdown
  useEffect(() => {
    const checkState = () => {
      const state = window.__ICHIGO_SLEEP_TIMER__;
      if (state && state.active && state.targetTime > Date.now()) {
        setIsRunning(true);
        setRemainingSeconds(Math.max(0, Math.round((state.targetTime - Date.now()) / 1000)));
      } else if (state && state.active && state.endOfSong) {
        setIsRunning(true);
        setTimerMode('endOfSong');
      } else {
        setIsRunning(false);
        setRemainingSeconds(0);
      }
    };
    checkState();
    const interval = setInterval(checkState, 1000);
    return () => clearInterval(interval);
  }, [isOpen]);

  if (!isOpen) return null;

  const handleStartTimer = () => {
    const mins = customMinutes ? Number(customMinutes) : selectedMinutes;
    if (timerMode === 'minutes') {
      if (!mins || mins <= 0) return;
      const targetTime = Date.now() + mins * 60 * 1000;
      window.__ICHIGO_SLEEP_TIMER__ = {
        active: true,
        endOfSong: false,
        targetTime,
        originalVolume: volume
      };
      setIsRunning(true);
      setRemainingSeconds(mins * 60);
    } else {
      window.__ICHIGO_SLEEP_TIMER__ = {
        active: true,
        endOfSong: true,
        targetTime: 0,
        originalVolume: volume
      };
      setIsRunning(true);
    }
    onClose();
  };

  const handleCancelTimer = () => {
    window.__ICHIGO_SLEEP_TIMER__ = null;
    setIsRunning(false);
    setRemainingSeconds(0);
  };

  const formatRemaining = (sec) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'rgba(0,0,0,0.65)',
      backdropFilter: 'blur(12px)',
      animation: 'fadeIn 0.2s ease-out'
    }} onClick={onClose}>
      <div style={{
        width: '440px',
        maxWidth: '92vw',
        background: 'rgba(24, 28, 38, 0.95)',
        border: '1px solid rgba(255, 255, 255, 0.16)',
        borderRadius: '16px',
        boxShadow: '0 24px 48px rgba(0,0,0,0.5)',
        color: '#fff',
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px'
      }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: 'rgba(255, 64, 129, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--primary)'
            }}>
              <Moon size={20} />
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: '16px' }}>睡眠定时器</div>
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>停止播放并在结束前自动渐弱音量</div>
            </div>
          </div>
          <button type="button" onClick={onClose} style={{
            background: 'transparent',
            border: 'none',
            color: 'rgba(255,255,255,0.5)',
            cursor: 'pointer'
          }}>
            <X size={18} />
          </button>
        </div>

        {/* Current running banner */}
        {isRunning && (
          <div style={{
            padding: '14px 16px',
            background: 'rgba(255, 64, 129, 0.12)',
            border: '1px solid rgba(255, 64, 129, 0.3)',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div>
              <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)' }}>定时关闭运行中</div>
              <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--primary)' }}>
                {timerMode === 'endOfSong' ? '播完本曲后停止' : formatRemaining(remainingSeconds)}
              </div>
            </div>
            <button type="button" onClick={handleCancelTimer} style={{
              padding: '6px 12px',
              borderRadius: '6px',
              background: 'rgba(244, 67, 54, 0.2)',
              border: '1px solid rgba(244, 67, 54, 0.4)',
              color: '#ff8a80',
              cursor: 'pointer',
              fontSize: '12px'
            }}>
              取消定时
            </button>
          </div>
        )}

        {/* Presets grid */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)' }}>选择定时时长：</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
            {[15, 30, 45, 60, 90].map((mins) => (
              <button
                key={mins}
                type="button"
                onClick={() => {
                  setTimerMode('minutes');
                  setSelectedMinutes(mins);
                  setCustomMinutes('');
                }}
                style={{
                  padding: '12px 8px',
                  borderRadius: '10px',
                  border: '1px solid',
                  borderColor: (timerMode === 'minutes' && selectedMinutes === mins && !customMinutes) ? 'var(--primary)' : 'rgba(255,255,255,0.12)',
                  background: (timerMode === 'minutes' && selectedMinutes === mins && !customMinutes) ? 'rgba(255, 64, 129, 0.2)' : 'rgba(255,255,255,0.05)',
                  color: '#fff',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: 500,
                  transition: 'all 0.15s'
                }}
              >
                {mins} 分钟
              </button>
            ))}

            <button
              type="button"
              onClick={() => setTimerMode('endOfSong')}
              style={{
                padding: '12px 8px',
                borderRadius: '10px',
                border: '1px solid',
                borderColor: timerMode === 'endOfSong' ? 'var(--primary)' : 'rgba(255,255,255,0.12)',
                background: timerMode === 'endOfSong' ? 'rgba(255, 64, 129, 0.2)' : 'rgba(255,255,255,0.05)',
                color: '#fff',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: 500,
                transition: 'all 0.15s'
              }}
            >
              播完本曲后
            </button>
          </div>
        </div>

        {/* Action Button */}
        <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              flex: 1,
              padding: '10px',
              borderRadius: '8px',
              border: '1px solid rgba(255,255,255,0.15)',
              background: 'transparent',
              color: 'rgba(255,255,255,0.8)',
              cursor: 'pointer',
              fontSize: '13px'
            }}
          >
            关闭
          </button>
          <button
            type="button"
            onClick={handleStartTimer}
            style={{
              flex: 2,
              padding: '10px',
              borderRadius: '8px',
              border: 'none',
              background: 'var(--primary)',
              color: '#fff',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 600,
              boxShadow: '0 4px 12px rgba(255, 64, 129, 0.3)'
            }}
          >
            {isRunning ? '更新并重新开始' : '开启定时关闭'}
          </button>
        </div>
      </div>
    </div>
  );
}
