import React from 'react';
import { Download, AlertCircle, CheckCircle } from 'lucide-react';
import { Button, Modal, ModalContent, ModalDescription, ModalFooter, ModalHeader, ModalTitle } from './ui';

export default function UpdatePromptModal({ currentVersion, latestVersion, updateInfo = {}, onClose, onUpdate, onInstall }) {
  const { downloading, downloaded, progress = 0, error, notes } = updateInfo;
  return <Modal open onOpenChange={(open) => !open && onClose?.()}><ModalContent className="app-prompt-modal" showClose={!downloading} aria-describedby="update-prompt-description"><ModalHeader><span className="app-prompt-status-icon">{downloaded ? <CheckCircle size={20} /> : <AlertCircle size={20} />}</span><ModalTitle className="ui-modal-title">发现新版本</ModalTitle></ModalHeader><ModalDescription id="update-prompt-description" className="ui-modal-desc">ICHIGOMusic 已发布 <strong>{latestVersion}</strong>，当前版本为 <strong>{currentVersion}</strong>。</ModalDescription>{notes && <pre className="app-update-notes">{notes}</pre>}{error && <p className="app-update-error">{error}</p>}{downloading && <div className="app-update-progress"><div><i style={{ width: `${progress}%` }} /></div><span>正在下载更新包 {progress}%</span></div>}<ModalFooter className="app-prompt-actions"><Button block onClick={downloaded ? onInstall : onUpdate} disabled={downloading}><Download size={16} />{downloading ? '正在下载…' : downloaded ? '立即安装并重启' : '下载更新'}</Button><Button variant="outline" block onClick={onClose} disabled={downloading}>稍后提醒</Button></ModalFooter></ModalContent></Modal>;
}
