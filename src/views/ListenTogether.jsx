import React, { useEffect, useMemo, useState } from 'react';
import { Copy, LogIn, LogOut, MessageCircle, Play, Radio, Send, Share2, Users, UserPlus, X } from 'lucide-react';
import CachedCover from '../components/CachedCover';

const artistName = (song) => song?.ar?.map(item => item.name).join(' / ') || song?.artists?.map(item => item.name).join(' / ') || song?.artist || '未知艺术家';

function SetupPanel({ listenState }) {
  const [roomInput, setRoomInput] = useState('');
  const [roomTokenInput, setRoomTokenInput] = useState('');
  const [inviterInput, setInviterInput] = useState('');
  const [copied, setCopied] = useState(false);
  const { createRoom, joinRoom, isConnecting, message, getShareUrl } = listenState;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const room = params.get('listenRoom');
    if (room) {
      setRoomInput(room);
      const inviter = params.get('inviterId') || '';
      const roomToken = params.get('roomToken') || '';
      setInviterInput(inviter);
      setRoomTokenInput(roomToken);
      joinRoom(room, inviter, roomToken);
    }
  }, [joinRoom]);

  const copyRoomLink = async () => {
    const link = getShareUrl();
    if (!link) return;
    await navigator.clipboard?.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className="listen-empty-state">
      <div className="listen-empty-orb"><Radio size={32} /></div>
      <span className="listen-eyebrow">LISTEN TOGETHER</span>
      <h2>和朋友一起听</h2>
      <p>同步播放进度，分享正在听的歌，也可以在房间里实时聊天。</p>
      {message && <div className="listen-status-message">{message}</div>}
      <div className="listen-setup-actions">
        <button className="listen-primary-btn" onClick={createRoom} disabled={isConnecting}><Radio size={17} />{isConnecting ? '正在创建...' : '创建听歌房间'}</button>
        <div className="listen-join-row">
          <input value={roomInput} onChange={event => setRoomInput(event.target.value)} placeholder="输入房间 ID" aria-label="房间 ID" />
          <input value={roomTokenInput} onChange={event => setRoomTokenInput(event.target.value)} placeholder="Room Token" aria-label="Room Token" />
          <input value={inviterInput} onChange={event => setInviterInput(event.target.value)} placeholder="邀请者 ID（可选）" aria-label="邀请者 ID" />
          <button className="listen-secondary-btn" onClick={() => joinRoom(roomInput.trim(), inviterInput.trim(), roomTokenInput.trim())} disabled={!roomInput.trim() || isConnecting}><LogIn size={16} />加入</button>
        </div>
      </div>
      {getShareUrl() && <button className="listen-copy-btn" onClick={copyRoomLink}><Copy size={14} />{copied ? '已复制房间链接' : '复制房间链接'}</button>}
    </div>
  );
}

function ChatPanel({ listenState }) {
  const [draft, setDraft] = useState('');
  const send = async (event) => {
    event.preventDefault();
    if (!draft.trim()) return;
    await listenState.sendChat(draft);
    setDraft('');
  };
  return (
    <section className="listen-chat-panel">
      <div className="listen-panel-title"><MessageCircle size={17} />实时聊天</div>
      <div className="listen-chat-list">
        {listenState.messages.length === 0 && <div className="listen-chat-empty">还没有消息，打个招呼吧</div>}
        {listenState.messages.map(item => <div className="listen-chat-message" key={item.id}><strong>{item.nickname}</strong><span>{item.text}</span><time>{new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time></div>)}
      </div>
      <form className="listen-chat-composer" onSubmit={send}><input value={draft} onChange={event => setDraft(event.target.value)} maxLength={500} placeholder="说点什么..." /><button type="submit" title="发送消息"><Send size={16} /></button></form>
    </section>
  );
}

export default function ListenTogether({ listenState, currentSong, lyrics = [], currentTime = 0 }) {
  const { roomId, isHost, roomUsers, syncStatus, message, exitRoom, getShareUrl } = listenState;
  const [copied, setCopied] = useState(false);
  const connectionLabel = syncStatus === 'error' ? '连接不稳定' : isHost ? '房主同步中' : '已连接';
  const share = async () => {
    await navigator.clipboard?.writeText(getShareUrl());
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };
  const roomTitle = useMemo(() => roomId ? `房间 ${roomId}` : '准备一起听', [roomId]);
  const currentLyric = useMemo(() => {
    if (!Array.isArray(lyrics) || lyrics.length === 0) return null;
    let active = null;
    for (const line of lyrics) {
      if (Number(line?.time || 0) <= Number(currentTime || 0)) active = line;
      else break;
    }
    return active;
  }, [lyrics, currentTime]);

  return (
    <div className="listen-together-page">
      <div className="listen-page-header">
        <div><span className="listen-eyebrow">SOCIAL LISTENING</span><h1>{roomTitle}</h1><p>{roomId ? '播放状态会自动同步给房间里的每个人。' : '创建一个房间，和朋友一起分享一段音乐时光。'}</p></div>
        {roomId && <div className={`listen-connection ${syncStatus === 'error' ? 'is-error' : ''}`}><span />{connectionLabel}</div>}
      </div>

      {!roomId ? <SetupPanel listenState={listenState} /> : (
        <div className="listen-room-layout">
          <main className="listen-room-main">
            <section className="listen-now-playing">
              <div className="listen-now-art"><CachedCover song={currentSong} alt="当前歌曲封面" /></div>
              <div className="listen-now-copy"><span className="listen-eyebrow">NOW PLAYING</span><h2>{currentSong?.name || '等待房主开始播放'}</h2><p>{artistName(currentSong)}</p><div className="listen-now-lyric" title={currentLyric?.translation || ''}>{currentLyric?.text || '正在准备歌词...'}</div><div className="listen-sync-line"><span className="listen-sync-dot" />{isHost ? '你正在主持同步播放' : '正在跟随房主播放'}</div></div>
              <div className="listen-now-icon"><Play size={22} fill="currentColor" /></div>
            </section>
            <ChatPanel listenState={listenState} />
          </main>
          <aside className="listen-room-side">
            <section className="listen-side-section"><div className="listen-panel-title"><Users size={17} />房间成员 <span>{roomUsers.length}</span></div><div className="listen-member-list">{roomUsers.map(member => <div className="listen-member" key={member.userId}><div className="listen-member-avatar">{member.avatarUrl ? <img src={member.avatarUrl} alt="" /> : (member.nickname || '?').slice(0, 1)}</div><div><strong>{member.nickname}</strong><small>{member.userId === roomUsers[0]?.userId ? '房主' : '已加入'}</small></div></div>)}</div></section>
            <section className="listen-side-section listen-invite-section"><div className="listen-panel-title"><UserPlus size={17} />邀请朋友</div><p>把房间链接发给朋友，他们加入后就能看到同步播放和聊天。</p><button className="listen-secondary-btn wide" onClick={share}><Share2 size={15} />{copied ? '链接已复制' : '复制邀请链接'}</button></section>
            {message && <div className="listen-status-message">{message}</div>}
            <button className="listen-leave-btn" onClick={exitRoom}><LogOut size={15} />{isHost ? '结束房间' : '退出房间'}</button>
          </aside>
        </div>
      )}
    </div>
  );
}
