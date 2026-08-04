// src/components/ListenTogetherModal.jsx
// 一起听 (Listen Together) 毛玻璃控制与同步弹窗

import React, { useState } from 'react';
import {
  Users,
  X,
  Radio,
  Share2,
  Copy,
  Check,
  LogOut,
  RefreshCw,
  PlusCircle,
  LogIn,
  Music2,
  ShieldCheck
} from 'lucide-react';
import CachedCover from './CachedCover';

export default function ListenTogetherModal({
  isOpen,
  onClose,
  listenState,
  currentSong
}) {
  const {
    roomId,
    inviterId,
    isHost,
    roomUsers,
    isConnecting,
    message,
    createRoom,
    joinRoom,
    exitRoom,
    refreshRoomStatus,
    getShareUrl
  } = listenState;

  const [inputRoomId, setInputRoomId] = useState('');
  const [inputInviterId, setInputInviterId] = useState('');
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState('join'); // 'create' | 'join'

  if (!isOpen) return null;

  const handleCopyLink = () => {
    const link = getShareUrl();
    if (!link) return;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleJoin = async (e) => {
    e.preventDefault();
    if (!inputRoomId.trim()) return;
    await joinRoom(inputRoomId.trim(), inputInviterId.trim());
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md transition-all animate-fade-in">
      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl bg-neutral-900/85 border border-white/10 p-6 text-white shadow-2xl backdrop-blur-xl">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-pink-500 to-rose-400 shadow-lg shadow-pink-500/30">
              <Radio className="h-5 w-5 text-white animate-pulse" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                一起听模式
                {roomId && (
                  <span className="text-xs font-normal px-2 rounded-full bg-pink-500/20 text-pink-400 border border-pink-500/30">
                    {isHost ? '房主' : '成员'}
                  </span>
                )}
              </h3>
              <p className="text-xs text-neutral-400">实时同步音乐与进度，共享听歌时光</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/5 text-neutral-400 hover:bg-white/10 hover:text-white transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Message Banner */}
        {message && (
          <div className="mt-4 rounded-xl bg-pink-500/10 border border-pink-500/20 px-4 py-2.5 text-xs text-pink-300 flex items-center justify-between">
            <span>{message}</span>
            {isConnecting && <RefreshCw className="h-3.5 w-3.5 animate-spin text-pink-400" />}
          </div>
        )}

        {/* Content */}
        <div className="mt-5">
          {roomId ? (
            /* 已在房间内部界面 */
            <div className="space-y-5">
              {/* Current Playing Context */}
              {currentSong && (
                <div className="flex items-center gap-3.5 p-3 rounded-xl bg-white/5 border border-white/5">
                  <CachedCover
                    src={currentSong.coverUrl || currentSong.al?.picUrl}
                    alt={currentSong.name}
                    className="h-12 w-12 rounded-lg object-cover shadow"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{currentSong.name}</p>
                    <p className="text-xs text-neutral-400 truncate">
                      {currentSong.ar?.map(a => a.name).join('/') || currentSong.artists?.map(a => a.name).join('/')}
                    </p>
                  </div>
                  <Music2 className="h-5 w-5 text-pink-400 animate-bounce" />
                </div>
              )}

              {/* Share Link Card */}
              <div className="rounded-xl bg-white/5 border border-white/5 p-4 space-y-2">
                <div className="flex items-center justify-between text-xs text-neutral-400">
                  <span className="flex items-center gap-1.5">
                    <Share2 className="h-3.5 w-3.5 text-pink-400" />
                    房间 ID: <strong className="text-white font-mono">{roomId}</strong>
                  </span>
                  <span>使用网易云 App 或本播放器加入</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={getShareUrl()}
                    className="flex-1 rounded-lg bg-black/40 border border-white/10 px-3 py-2 text-xs font-mono text-neutral-300 focus:outline-none select-all"
                  />
                  <button
                    onClick={handleCopyLink}
                    className="flex items-center gap-1.5 rounded-lg bg-pink-500 hover:bg-pink-600 px-3.5 py-2 text-xs font-medium text-white transition-colors shadow-lg shadow-pink-500/20"
                  >
                    {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    {copied ? '已复制' : '复制'}
                  </button>
                </div>
              </div>

              {/* Room Online Users */}
              <div>
                <div className="flex items-center justify-between text-xs text-neutral-400 mb-2.5">
                  <span className="flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5 text-pink-400" />
                    在线用户 ({roomUsers.length})
                  </span>
                  <button
                    onClick={refreshRoomStatus}
                    className="flex items-center gap-1 text-pink-400 hover:text-pink-300 transition-colors"
                  >
                    <RefreshCw className="h-3 w-3" />
                    刷新
                  </button>
                </div>

                {roomUsers.length > 0 ? (
                  <div className="grid grid-cols-2 gap-2.5 max-h-36 overflow-y-auto pr-1">
                    {roomUsers.map((user) => (
                      <div
                        key={user.userId}
                        className="flex items-center gap-2.5 rounded-xl bg-white/5 border border-white/5 p-2"
                      >
                        <img
                          src={user.avatarUrl}
                          alt={user.nickname}
                          className="h-8 w-8 rounded-full object-cover border border-white/10"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-white truncate">{user.nickname}</p>
                          <p className="text-[10px] text-neutral-400">在线</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl bg-white/5 border border-white/5 p-4 text-center text-xs text-neutral-400">
                    目前只有你一个人在房间里，快邀请朋友加入吧～
                  </div>
                )}
              </div>

              {/* Bottom Actions */}
              <div className="pt-2">
                <button
                  onClick={exitRoom}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30 py-2.5 text-xs font-medium transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                  {isHost ? '解散一起听房间' : '退出一起听房间'}
                </button>
              </div>
            </div>
          ) : (
            /* 未加入房间 - 选项页 */
            <div>
              <div className="flex rounded-xl bg-white/5 p-1 mb-5">
                <button
                  onClick={() => setActiveTab('join')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium rounded-lg transition-all ${
                    activeTab === 'join'
                      ? 'bg-pink-500 text-white shadow-md'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  <LogIn className="h-3.5 w-3.5" />
                  加入房间
                </button>
                <button
                  onClick={() => setActiveTab('create')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium rounded-lg transition-all ${
                    activeTab === 'create'
                      ? 'bg-pink-500 text-white shadow-md'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  <PlusCircle className="h-3.5 w-3.5" />
                  创建房间
                </button>
              </div>

              {activeTab === 'create' ? (
                <div className="space-y-4 py-2">
                  <div className="rounded-xl bg-white/5 border border-white/5 p-4 space-y-2 text-xs text-neutral-300">
                    <p className="flex items-center gap-2 text-white font-medium">
                      <ShieldCheck className="h-4 w-4 text-pink-400" />
                      创建后你将成为房主
                    </p>
                    <p className="text-neutral-400">
                      你可以自由切歌、控制播放与同步播放队列，房间成员将实时同步你的听歌状态。
                    </p>
                  </div>
                  <button
                    onClick={createRoom}
                    disabled={isConnecting}
                    className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white py-3 text-sm font-semibold transition-all shadow-lg shadow-pink-500/25 disabled:opacity-50"
                  >
                    <Radio className="h-4 w-4" />
                    立即创建一起听房间
                  </button>
                </div>
              ) : (
                <form onSubmit={handleJoin} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-neutral-400 mb-1.5">房间 ID (Room ID)</label>
                    <input
                      type="text"
                      placeholder="请输入房间 ID"
                      value={inputRoomId}
                      onChange={(e) => setInputRoomId(e.target.value)}
                      className="w-full rounded-xl bg-black/40 border border-white/10 px-3.5 py-2.5 text-xs text-white placeholder-neutral-500 focus:border-pink-500 focus:outline-none transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-neutral-400 mb-1.5">邀请者 ID (可选)</label>
                    <input
                      type="text"
                      placeholder="可选，从分享链接中获取"
                      value={inputInviterId}
                      onChange={(e) => setInputInviterId(e.target.value)}
                      className="w-full rounded-xl bg-black/40 border border-white/10 px-3.5 py-2.5 text-xs text-white placeholder-neutral-500 focus:border-pink-500 focus:outline-none transition-colors"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isConnecting || !inputRoomId.trim()}
                    className="w-full flex items-center justify-center gap-2 rounded-xl bg-pink-500 hover:bg-pink-600 text-white py-3 text-sm font-semibold transition-all shadow-lg shadow-pink-500/25 disabled:opacity-50"
                  >
                    <LogIn className="h-4 w-4" />
                    加入房间
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
