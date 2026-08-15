import React from 'react';
import { Download, AlertCircle, CheckCircle } from 'lucide-react';
import { Button, Modal, ModalContent, ModalDescription, ModalFooter, ModalHeader, ModalTitle } from './ui';

export default function UpdatePromptModal({ currentVersion, latestVersion, updateInfo = {}, onClose, onUpdate, onInstall }) {
  const { downloading, downloaded, progress = 0, error, notes } = updateInfo;

  return (
    <Modal open onOpenChange={(open) => !open && onClose?.()}>
      <ModalContent className="app-prompt-modal" showClose={!downloading} aria-describedby="update-prompt-description">
        <ModalHeader>
          <div className="app-prompt-header-wrap">
            <div className={`app-prompt-icon-badge update-badge ${downloaded ? 'downloaded' : ''}`}>
              {downloaded ? <CheckCircle size={22} /> : <Download size={22} />}
            </div>
            <div className="app-prompt-header-text">
              <div className="app-prompt-title-row">
                <ModalTitle className="ui-modal-title">发现新版本</ModalTitle>
                <span className="app-version-pill">{latestVersion || '最新版'}</span>
              </div>
              <ModalDescription id="update-prompt-description" className="ui-modal-desc">
                当前版本为 <strong>{currentVersion}</strong>，新版本已准备就绪。
              </ModalDescription>
            </div>
          </div>
        </ModalHeader>

        {notes && (
          <div className="app-update-notes-container">
            <div className="app-update-notes-title">更新说明</div>
            <pre className="app-update-notes">{notes}</pre>
          </div>
        )}

        {error && <p className="app-update-error">{error}</p>}

        {downloading && (
          <div className="app-update-progress">
            <div><i style={{ width: `${progress}%` }} /></div>
            <span>正在下载更新包 {progress}%</span>
          </div>
        )}

        <ModalFooter className="app-prompt-footer">
          <Button
            variant="ghost"
            size="md"
            className="app-prompt-cancel-btn"
            onClick={onClose}
            disabled={downloading}
          >
            稍后提醒
          </Button>
          <Button
            variant="primary"
            size="md"
            className="app-prompt-confirm-btn"
            onClick={downloaded ? onInstall : onUpdate}
            disabled={downloading}
          >
            <Download size={16} />
            {downloading ? '正在下载…' : downloaded ? '立即安装并重启' : '立即下载更新'}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
