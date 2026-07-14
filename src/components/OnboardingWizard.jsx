import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '../context/AppContext';
import { Check, ArrowRight, ArrowLeft, Sparkles } from 'lucide-react';
import ShortcutRow from './ShortcutRow';
import './onboarding-wizard.css';
import logoImg from '../assets/logo.png';

const STEPS = ['welcome', 'layout', 'theme', 'shortcuts'];

export default function OnboardingWizard() {
  const { 
    isFirstTimeSetupComplete, 
    updateProfile, 
    layoutMode, 
    setLayoutMode, 
    colorMode, 
    setColorMode,
    shortcuts,
    saveShortcuts,
    profile
  } = useApp();

  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [enableGlobalShortcuts, setEnableGlobalShortcuts] = useState(profile?.enableGlobalShortcuts || false);

  if (isFirstTimeSetupComplete) {
    return null;
  }

  const step = STEPS[currentStepIndex];

  const finishSetup = () => {
    updateProfile({ isFirstTimeSetupComplete: true, enableGlobalShortcuts });
  };

  const nextStep = () => {
    if (currentStepIndex < STEPS.length - 1) {
      setCurrentStepIndex(i => i + 1);
    } else {
      finishSetup();
    }
  };

  const prevStep = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(i => i - 1);
    }
  };

  const updateShortcut = (key, value) => {
    saveShortcuts({ ...shortcuts, [key]: value });
  };

  return (
    <div className="onboarding-overlay">
      <motion.div 
        className="onboarding-modal"
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
      >
        
        {step !== 'welcome' && (
          <div className="onboarding-header">
            <h2 className="onboarding-title">
              {step === 'layout' && '选择界面布局'}
              {step === 'theme' && '选择外观主题'}
              {step === 'shortcuts' && '配置快捷键'}
            </h2>
            <p className="onboarding-subtitle">
              {step === 'layout' && '您可以随时在设置中更改此选项。背景会实时预览您的选择。'}
              {step === 'theme' && '选择深色或浅色模式。背景会实时预览您的选择。'}
              {step === 'shortcuts' && '自定义您常用的快捷键，提升操作效率。'}
            </p>
          </div>
        )}

        <div className="onboarding-content">
          <AnimatePresence mode="wait">
            {step === 'welcome' && (
              <motion.div 
                key="welcome"
                className="onboarding-welcome"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <div className="onboarding-welcome-icon" style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
                  <img src={logoImg} alt="logo" style={{ width: 80, height: 80, borderRadius: 16, boxShadow: '0 8px 24px rgba(255, 64, 129, 0.3)' }} />
                </div>
                <div>
                  <h2 className="onboarding-title" style={{ fontSize: 36, marginBottom: 12 }}>欢迎使用 ICHIGOMusic</h2>
                  <p className="onboarding-subtitle" style={{ fontSize: 16 }}>在开始沉浸式音乐体验之前，让我们先进行一些基础设置。</p>
                </div>
              </motion.div>
            )}

            {step === 'layout' && (
              <motion.div 
                key="layout"
                className="onboarding-cards-grid"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <div 
                  className={`selection-card ${layoutMode === 'classic' ? 'active' : ''}`}
                  onClick={() => setLayoutMode('classic')}
                >
                  <div className="selection-card-check"><Check size={14} /></div>
                  <div className="selection-card-preview">
                    <div className="preview-classic">
                      <div className="preview-classic-header"></div>
                      <div className="preview-classic-body">
                        <div className="preview-classic-sidebar"></div>
                        <div className="preview-classic-main"></div>
                      </div>
                      <div className="preview-classic-footer"></div>
                    </div>
                  </div>
                  <div className="selection-card-title">经典布局 (Classic)</div>
                </div>

                <div 
                  className={`selection-card ${layoutMode === 'modern' ? 'active' : ''}`}
                  onClick={() => setLayoutMode('modern')}
                >
                  <div className="selection-card-check"><Check size={14} /></div>
                  <div className="selection-card-preview">
                    <div className="preview-modern">
                      <div className="preview-modern-sidebar"></div>
                      <div className="preview-modern-main">
                        <div className="preview-modern-player"></div>
                      </div>
                    </div>
                  </div>
                  <div className="selection-card-title">现代布局 (Modern)</div>
                </div>
              </motion.div>
            )}

            {step === 'theme' && (
              <motion.div 
                key="theme"
                className="onboarding-cards-grid"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <div 
                  className={`selection-card ${colorMode === 'dark' ? 'active' : ''}`}
                  onClick={() => setColorMode('dark')}
                  style={{ background: '#121212', border: colorMode === 'dark' ? '2px solid var(--primary)' : '2px solid #333' }}
                >
                  <div className="selection-card-check"><Check size={14} /></div>
                  <div className="selection-card-preview" style={{ background: '#1e1e1e', borderColor: '#333' }}>
                    <div style={{ color: '#fff', fontSize: 24, fontWeight: 700 }}>Aa</div>
                  </div>
                  <div className="selection-card-title" style={{ color: '#fff' }}>深色 (Dark)</div>
                </div>

                <div 
                  className={`selection-card ${colorMode === 'light' ? 'active' : ''}`}
                  onClick={() => setColorMode('light')}
                  style={{ background: '#ffffff', border: colorMode === 'light' ? '2px solid var(--primary)' : '2px solid #eaeaea' }}
                >
                  <div className="selection-card-check"><Check size={14} /></div>
                  <div className="selection-card-preview" style={{ background: '#f5f5f5', borderColor: '#eaeaea' }}>
                    <div style={{ color: '#111', fontSize: 24, fontWeight: 700 }}>Aa</div>
                  </div>
                  <div className="selection-card-title" style={{ color: '#111' }}>浅色 (Light)</div>
                </div>
              </motion.div>
            )}

            {step === 'shortcuts' && (
              <motion.div 
                key="shortcuts"
                className="onboarding-shortcuts-list"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <ShortcutRow
                  label="播放/暂停"
                  value={shortcuts?.playPause}
                  onChange={(val) => updateShortcut('playPause', val)}
                />
                <ShortcutRow
                  label="上一首"
                  value={shortcuts?.prevTrack}
                  onChange={(val) => updateShortcut('prevTrack', val)}
                />
                <ShortcutRow
                  label="下一首"
                  value={shortcuts?.nextTrack}
                  onChange={(val) => updateShortcut('nextTrack', val)}
                />
                <ShortcutRow
                  label="沉浸式歌词"
                  description="切换全屏沉浸式歌词界面"
                  value={shortcuts?.toggleLyrics}
                  onChange={(val) => updateShortcut('toggleLyrics', val)}
                />
                <ShortcutRow
                  label="桌面歌词"
                  description="开启或关闭桌面歌词窗口"
                  value={shortcuts?.toggleDesktopLyrics}
                  onChange={(val) => updateShortcut('toggleDesktopLyrics', val)}
                />
                <div style={{ marginTop: '20px', padding: '16px', background: 'var(--surface-hover)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontWeight: 'bold', fontSize: '15px' }}>全局快捷键</div>
                    <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>开启后，即使应用在后台运行，依然可以使用上面的快捷键</div>
                  </div>
                  <label className="switch" style={{ position: 'relative', display: 'inline-block', width: '40px', height: '24px' }}>
                    <input 
                      type="checkbox" 
                      checked={enableGlobalShortcuts} 
                      onChange={(e) => setEnableGlobalShortcuts(e.target.checked)} 
                      style={{ opacity: 0, width: 0, height: 0 }}
                    />
                    <span className="slider" style={{ position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: enableGlobalShortcuts ? 'var(--primary)' : 'var(--border)', transition: '.4s', borderRadius: '34px' }}>
                      <span style={{ position: 'absolute', content: '""', height: '16px', width: '16px', left: '4px', bottom: '4px', backgroundColor: 'white', transition: '.4s', borderRadius: '50%', transform: enableGlobalShortcuts ? 'translateX(16px)' : 'none' }}></span>
                    </span>
                  </label>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="onboarding-footer">
          {step === 'welcome' ? (
            <>
              <button className="onboarding-btn onboarding-btn-text" onClick={finishSetup}>
                稍后再说
              </button>
              <button className="onboarding-btn onboarding-btn-primary" onClick={nextStep}>
                开始设置 <ArrowRight size={16} />
              </button>
            </>
          ) : (
            <>
              <div>
                <button className="onboarding-btn onboarding-btn-secondary" onClick={prevStep}>
                  <ArrowLeft size={16} /> 上一步
                </button>
              </div>
              
              <div className="onboarding-step-indicator">
                {STEPS.slice(1).map((s, i) => (
                  <div key={s} className={`step-dot ${currentStepIndex - 1 === i ? 'active' : ''}`} />
                ))}
              </div>

              <div>
                <button className="onboarding-btn onboarding-btn-primary" onClick={nextStep}>
                  {step === 'shortcuts' ? '完成设置' : '下一步'} {step !== 'shortcuts' && <ArrowRight size={16} />}
                </button>
              </div>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
