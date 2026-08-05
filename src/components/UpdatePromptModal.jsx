import React from 'react';
import { motion } from 'framer-motion';
import { Download, AlertCircle, CheckCircle } from 'lucide-react';
import './close-prompt-modal.css';

export default function UpdatePromptModal({ currentVersion, latestVersion, updateInfo = {}, onClose, onUpdate, onInstall }) {
  const { downloading, downloaded, progress = 0, error, notes } = updateInfo;

  return (
    <div className="close-prompt-overlay" onClick={onClose}>
      <motion.div
        className="close-prompt-modal"
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        onClick={event => event.stopPropagation()}
      >
        <div className="close-prompt-header" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {downloaded ? <CheckCircle size={20} style={{ color: 'var(--primary)' }} /> : <AlertCircle size={20} style={{ color: 'var(--primary)' }} />}
          <h3 className="close-prompt-title">发现新版本</h3>
        </div>
        <div className="close-prompt-content">
          <p className="close-prompt-desc">
            ICHIGOMusic 已发布 <strong>{latestVersion}</strong>，当前版本为 <strong>{currentVersion}</strong>。
          </p>
          {notes && <div style={{ maxHeight: 120, overflowY: 'auto', margin: '8px 0', padding: '8px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.05)', whiteSpace: 'pre-wrap', fontSize: 12, color: 'var(--text-secondary)' }}>{notes}</div>}
          {error && <p style={{ color: '#ff5b7f', fontSize: 12, margin: '8px 0' }}>{error}</p>}
          {downloading && <div style={{ margin: '10px 0' }}><div style={{ height: 6, borderRadius: 99, background: 'rgba(255,255,255,0.12)', overflow: 'hidden' }}><div style={{ width: `${progress}%`, height: '100%', background: 'var(--primary)', transition: 'width .2s' }} /></div><div style={{ marginTop: 6, fontSize: 12, textAlign: 'center', color: 'var(--text-secondary)' }}>正在下载更新包 {progress}%</div></div>}
          <div className="close-prompt-actions" style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
            <button className="close-prompt-btn" style={{ flex: 1, background: 'var(--primary)', color: '#ffffff', border: 'none' }} onClick={downloaded ? onInstall : onUpdate} disabled={downloading}>
              <Download size={16} /> {downloading ? '正在下载…' : downloaded ? '立即安装并重启' : '下载更新'}
            </button>
            <button className="close-prompt-btn" style={{ flex: 1 }} onClick={onClose} disabled={downloading}>稍后提醒</button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
