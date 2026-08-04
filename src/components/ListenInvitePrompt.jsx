import React from 'react';
import { ClipboardCheck, LogIn, X } from 'lucide-react';

export default function ListenInvitePrompt({ invite, onJoin, onDismiss }) {
  if (!invite) return null;
  return (
    <div className="listen-invite-backdrop" role="dialog" aria-modal="true" aria-label="一起听邀请">
      <div className="listen-invite-prompt">
        <button className="listen-invite-close" onClick={onDismiss} aria-label="关闭"><X size={17} /></button>
        <div className="listen-invite-icon"><ClipboardCheck size={25} /></div>
        <span className="listen-eyebrow">LISTEN TOGETHER</span>
        <h3>发现一起听邀请</h3>
        <p><strong>{invite.roomId}</strong> 邀请你加入听歌房间，是否现在进入？</p>
        <div className="listen-invite-actions">
          <button className="listen-invite-secondary" onClick={onDismiss}>稍后再说</button>
          <button className="listen-invite-primary" onClick={onJoin}><LogIn size={16} />加入房间</button>
        </div>
      </div>
    </div>
  );
}
