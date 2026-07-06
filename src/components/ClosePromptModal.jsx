import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '../context/AppContext';
import { Minus, Power } from 'lucide-react';
import './close-prompt-modal.css';

export default function ClosePromptModal() {
  const { isClosePromptOpen, setIsClosePromptOpen, updateProfile, profile } = useApp();
  const [doNotPromptAgain, setDoNotPromptAgain] = useState(false);

  if (!isClosePromptOpen) return null;

  const handleAction = (actionType) => {
    if (doNotPromptAgain) {
      updateProfile({
        appearance: {
          ...(profile.appearance || {}),
          closeBehavior: actionType
        }
      });
    }

    setIsClosePromptOpen(false);

    if (actionType === 'hide') {
      window.electronAPI?.hide?.();
    } else if (actionType === 'close') {
      window.electronAPI?.close?.();
    }
  };

  return (
    <div className="close-prompt-overlay" onClick={() => setIsClosePromptOpen(false)}>
      <motion.div 
        className="close-prompt-modal"
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        onClick={e => e.stopPropagation()}
      >
        <div className="close-prompt-header">
          <h3 className="close-prompt-title">关闭提示</h3>
        </div>
        
        <div className="close-prompt-content">
          <p className="close-prompt-desc">
            您点击了关闭按钮，请问您希望隐藏到系统托盘继续播放，还是直接退出应用？
          </p>
          <div className="close-prompt-actions">
            <button className="close-prompt-btn" onClick={() => handleAction('hide')}>
              <Minus size={16} /> 隐藏到系统托盘
            </button>
            <button className="close-prompt-btn danger" onClick={() => handleAction('close')}>
              <Power size={16} /> 退出应用
            </button>
          </div>
        </div>

        <div className="close-prompt-footer">
          <label className="close-prompt-checkbox">
            <input 
              type="checkbox" 
              checked={doNotPromptAgain}
              onChange={(e) => setDoNotPromptAgain(e.target.checked)}
            />
            不再提示
          </label>
          <button className="close-prompt-cancel" onClick={() => setIsClosePromptOpen(false)}>
            取消
          </button>
        </div>
      </motion.div>
    </div>
  );
}
