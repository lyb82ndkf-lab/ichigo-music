import React from 'react';
import { motion } from 'framer-motion';
import { Download, AlertCircle } from 'lucide-react';
import './close-prompt-modal.css';

export default function UpdatePromptModal({ currentVersion, latestVersion, onClose, onUpdate }) {
  return (
    <div className="close-prompt-overlay" onClick={onClose}>
      <motion.div 
        className="close-prompt-modal"
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        onClick={e => e.stopPropagation()}
      >
        <div className="close-prompt-header" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertCircle size={20} style={{ color: 'var(--primary)' }} />
          <h3 className="close-prompt-title">检测到新版本</h3>
        </div>
        
        <div className="close-prompt-content">
          <p className="close-prompt-desc">
            ICHIGOMusic 已发布最新版本 <strong>{latestVersion}</strong>（当前版本为 <strong>{currentVersion}</strong>）。建议您立即更新以获得更佳的播放体验与全新功能！
          </p>
          <div className="close-prompt-actions" style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
            <button 
              className="close-prompt-btn" 
              style={{ flex: 1, background: 'var(--primary)', color: '#ffffff', border: 'none' }} 
              onClick={onUpdate}
            >
              <Download size={16} /> 立即更新
            </button>
            <button className="close-prompt-btn" style={{ flex: 1 }} onClick={onClose}>
              稍后提醒
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
