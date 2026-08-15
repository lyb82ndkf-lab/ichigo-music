import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Minus, Power, Music2 } from 'lucide-react';
import { Button, Modal, ModalContent, ModalDescription, ModalFooter, ModalHeader, ModalTitle, Switch } from './ui';

export default function ClosePromptModal() {
  const { isClosePromptOpen, setIsClosePromptOpen, updateProfile, profile } = useApp();
  const [doNotPromptAgain, setDoNotPromptAgain] = useState(false);

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
    if (actionType === 'hide') window.electronAPI?.hide?.();
    if (actionType === 'close') window.electronAPI?.close?.();
  };

  return (
    <Modal open={isClosePromptOpen} onOpenChange={setIsClosePromptOpen}>
      <ModalContent className="app-prompt-modal" showClose={true} aria-describedby="close-prompt-description">
        <ModalHeader>
          <div className="app-prompt-header-wrap">
            <div className="app-prompt-icon-badge close-badge">
              <Music2 size={22} />
            </div>
            <div className="app-prompt-header-text">
              <ModalTitle className="ui-modal-title">关闭提示</ModalTitle>
              <ModalDescription id="close-prompt-description" className="ui-modal-desc">
                关闭主窗口后，请选择应用的运行方式
              </ModalDescription>
            </div>
          </div>
        </ModalHeader>

        <div className="app-prompt-options">
          <button
            type="button"
            className="app-prompt-card"
            onClick={() => handleAction('hide')}
          >
            <div className="app-prompt-card-icon tray-icon">
              <Minus size={18} />
            </div>
            <div className="app-prompt-card-content">
              <div className="app-prompt-card-title">最小化到系统托盘</div>
              <div className="app-prompt-card-subtitle">保持音乐在后台继续播放</div>
            </div>
          </button>

          <button
            type="button"
            className="app-prompt-card danger"
            onClick={() => handleAction('close')}
          >
            <div className="app-prompt-card-icon power-icon">
              <Power size={18} />
            </div>
            <div className="app-prompt-card-content">
              <div className="app-prompt-card-title">直接退出应用</div>
              <div className="app-prompt-card-subtitle">停止播放并退出 ICHIGOMusic</div>
            </div>
          </button>
        </div>

        <div className="app-prompt-preference">
          <label htmlFor="close-behavior-switch">记住我的选择，不再提示</label>
          <Switch
            id="close-behavior-switch"
            checked={doNotPromptAgain}
            onCheckedChange={setDoNotPromptAgain}
          />
        </div>

        <ModalFooter className="app-prompt-footer">
          <Button
            variant="ghost"
            size="md"
            className="app-prompt-cancel-btn"
            onClick={() => setIsClosePromptOpen(false)}
          >
            取消
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
