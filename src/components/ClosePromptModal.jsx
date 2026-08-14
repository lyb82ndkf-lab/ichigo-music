import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Minus, Power } from 'lucide-react';
import { Button, Modal, ModalContent, ModalDescription, ModalFooter, ModalHeader, ModalTitle, Switch } from './ui';

export default function ClosePromptModal() {
  const { isClosePromptOpen, setIsClosePromptOpen, updateProfile, profile } = useApp();
  const [doNotPromptAgain, setDoNotPromptAgain] = useState(false);
  const handleAction = (actionType) => {
    if (doNotPromptAgain) updateProfile({ appearance: { ...(profile.appearance || {}), closeBehavior: actionType } });
    setIsClosePromptOpen(false);
    if (actionType === 'hide') window.electronAPI?.hide?.();
    if (actionType === 'close') window.electronAPI?.close?.();
  };
  return <Modal open={isClosePromptOpen} onOpenChange={setIsClosePromptOpen}><ModalContent className="app-prompt-modal" showClose={false} aria-describedby="close-prompt-description"><ModalHeader><ModalTitle className="ui-modal-title">关闭提示</ModalTitle></ModalHeader><ModalDescription id="close-prompt-description" className="ui-modal-desc">关闭主窗口后，您可以继续让音乐在系统托盘中播放，或直接退出 ICHIGOMusic。</ModalDescription><ModalFooter className="app-prompt-actions"><Button variant="subtle" onClick={() => handleAction('hide')}><Minus size={16} />隐藏到系统托盘</Button><Button variant="danger" onClick={() => handleAction('close')}><Power size={16} />退出应用</Button></ModalFooter><div className="app-prompt-preference"><label htmlFor="close-behavior-switch">记住这次选择</label><Switch id="close-behavior-switch" checked={doNotPromptAgain} onCheckedChange={setDoNotPromptAgain} /></div><Button variant="ghost" size="sm" onClick={() => setIsClosePromptOpen(false)}>取消</Button></ModalContent></Modal>;
}
