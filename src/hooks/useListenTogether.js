import { useCallback, useEffect, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import { api } from '../utils/api';
import { listenApi } from '../utils/listenApi';

const LISTEN_SOCKET_URL = `${(import.meta.env.VITE_LISTEN_SERVER_URL || 'http://8.137.169.120:16666').replace(/^http/, 'ws').replace(/\/$/, '')}/listen`;

const guestUser = { userId: `guest-${Math.random().toString(36).slice(2, 8)}`, nickname: '访客', avatarUrl: '' };
const normalizeUser = (user) => user ? {
  userId: user.userId || user.id || `guest-${Date.now()}`,
  nickname: user.nickname || user.name || '访客',
  avatarUrl: user.avatarUrl || ''
} : guestUser;

export function useListenTogether() {
  const { user, currentSong, isPlaying, progress, playSong, togglePlay, playlist, audioElement } = useApp();
  const [roomId, setRoomId] = useState(null);
  const [inviterId, setInviterId] = useState(null);
  const [isHost, setIsHost] = useState(false);
  const [roomUsers, setRoomUsers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [isConnecting, setIsConnecting] = useState(false);
  const [syncStatus, setSyncStatus] = useState('idle');
  const [message, setMessage] = useState('');
  const stateRef = useRef({});
  const lastMessageIdRef = useRef(0);
  const lastRemoteSongRef = useRef(null);
  const remoteActionRef = useRef(false);

  stateRef.current = { roomId, user, currentSong, isPlaying, progress, playlist, isHost, audioElement, sourceUrl: audioElement?.currentSrc || audioElement?.src || currentSong?.url || '' };

  const refreshRoomStatus = useCallback(async () => {
    const { roomId: activeRoom, user: activeUser } = stateRef.current;
    if (!activeRoom) return null;
    const res = await listenApi.checkRoom(activeRoom, normalizeUser(activeUser));
    if (res.data?.users) setRoomUsers(res.data.users);
    return res.data;
  }, []);

  const applyRemoteState = useCallback(async (remote) => {
    const state = remote?.playState;
    if (!state || stateRef.current.isHost || !state.currentSongId) return;
    const songId = String(state.currentSongId);
    const localId = String(stateRef.current.currentSong?.id || '');
    const sourceUrl = String(state.sourceUrl || '');
    const localSourceUrl = String(stateRef.current.currentSong?.url || '');
    const sourceNeedsUpdate = sourceUrl && sourceUrl !== localSourceUrl;
    if ((songId !== localId || sourceNeedsUpdate) && (songId !== String(lastRemoteSongRef.current || '') || sourceNeedsUpdate)) {
      lastRemoteSongRef.current = songId;
      const result = await api.getSongDetails(songId).catch(() => null);
      const song = result?.songs?.[0];
      if (song) {
        remoteActionRef.current = true;
        await playSong(sourceUrl ? { ...song, url: sourceUrl, urlCachedAt: Date.now() } : song, null, Number(state.progress || 0), { remoteSync: true });
        remoteActionRef.current = false;
      }
      return;
    }
    const audio = stateRef.current.audioElement;
    if (audio && Math.abs(Number(audio.currentTime || 0) - Number(state.progress || 0)) > 2) {
      audio.currentTime = Number(state.progress || 0);
    }
    const shouldPlay = String(state.playStatus).toUpperCase() === 'PLAY';
    if (shouldPlay !== Boolean(stateRef.current.isPlaying) && !remoteActionRef.current) {
      remoteActionRef.current = true;
      togglePlay();
      setTimeout(() => { remoteActionRef.current = false; }, 100);
    }
  }, [playSong, togglePlay]);

  const pollRoom = useCallback(async () => {
    const { roomId: activeRoom, user: activeUser } = stateRef.current;
    if (!activeRoom) return;
    try {
      const status = await listenApi.getStatus(activeRoom, normalizeUser(activeUser));
      if (status.data?.users) setRoomUsers(status.data.users);
      if (!stateRef.current.isHost) await applyRemoteState(status.data);
      const chat = await listenApi.getChat(activeRoom, lastMessageIdRef.current);
      if (Array.isArray(chat.data?.messages) && chat.data.messages.length) {
        setMessages(prev => [...prev, ...chat.data.messages]);
        lastMessageIdRef.current = chat.data.messages[chat.data.messages.length - 1].id;
      }
    } catch (error) {
      setSyncStatus('error');
    }
  }, [applyRemoteState]);

  useEffect(() => {
    if (!roomId) return undefined;
    const timer = setInterval(pollRoom, 1200);
    pollRoom();
    return () => clearInterval(timer);
  }, [roomId, pollRoom]);

  useEffect(() => {
    if (!roomId) return undefined;
    const timer = setInterval(() => {
      const { currentSong: song, isPlaying: playing, progress: currentProgress, user: activeUser } = stateRef.current;
      listenApi.sendHeartbeat({
        roomId,
        user: normalizeUser(activeUser),
        songId: song?.id || 0,
        playStatus: playing ? 'PLAY' : 'PAUSE',
        progress: Number(currentProgress || 0),
        sourceUrl: stateRef.current.sourceUrl || activeUser?.sourceUrl || ''
      }).catch(() => {});
    }, 1800);
    return () => clearInterval(timer);
  }, [roomId]);

  useEffect(() => {
    if (!roomId || typeof WebSocket === 'undefined') return undefined;
    const activeUser = normalizeUser(user);
    const params = new URLSearchParams({ roomId, userId: activeUser.userId, nickname: activeUser.nickname });
    const socket = new WebSocket(`${LISTEN_SOCKET_URL}?${params.toString()}`);
    socket.onmessage = event => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === 'snapshot') {
          if (payload.data?.users) setRoomUsers(payload.data.users);
          if (Array.isArray(payload.data?.messages) && payload.data.messages.length) {
            setMessages(payload.data.messages);
            lastMessageIdRef.current = payload.data.messages[payload.data.messages.length - 1].id;
          }
          if (!stateRef.current.isHost) applyRemoteState(payload.data);
        }
        if (payload.type === 'playback' && !stateRef.current.isHost) applyRemoteState({ playState: payload.data });
        if (payload.type === 'chat' && payload.data && payload.data.id > lastMessageIdRef.current) {
          setMessages(prev => [...prev, payload.data]);
          lastMessageIdRef.current = payload.data.id;
        }
        if (payload.type === 'room-ended') setMessage('房主已结束房间');
      } catch (_) {}
    };
    return () => socket.close();
  }, [roomId, user, applyRemoteState]);

  const createRoom = useCallback(async () => {
    setIsConnecting(true);
    setMessage('正在创建听歌房间...');
    try {
      const res = await listenApi.createRoom(normalizeUser(user));
      const id = res.data?.roomId || res.data?.roomInfo?.roomId;
      if (!id) throw new Error(res.msg || '创建房间失败');
      setRoomId(id);
      setInviterId(user?.userId || null);
      setIsHost(true);
      setSyncStatus('host');
      setMessage('房间已创建，邀请朋友加入吧');
      await listenApi.sendHeartbeat({ roomId: id, user: normalizeUser(user), songId: currentSong?.id || 0, playStatus: isPlaying ? 'PLAY' : 'PAUSE', progress, sourceUrl: stateRef.current.sourceUrl || currentSong?.url || '' });
      if (playlist.length) listenApi.syncPlaylist({ roomId: id, userId: user?.userId, displayList: playlist.map(song => song.id), randomList: playlist.map(song => song.id) }).catch(() => {});
      return id;
    } catch (error) {
      setMessage(error.message || '创建房间失败');
      return null;
    } finally { setIsConnecting(false); }
  }, [user, currentSong, isPlaying, progress, playlist]);

  const joinRoom = useCallback(async (targetRoomId, targetInviterId = '') => {
    if (!targetRoomId) return false;
    setIsConnecting(true);
    setMessage('正在加入房间...');
    try {
      const result = await listenApi.acceptInvitation(targetRoomId, targetInviterId, normalizeUser(user));
      if (result.code && result.code !== 200) throw new Error(result.msg || '加入房间失败');
      setRoomId(targetRoomId);
      setInviterId(targetInviterId || null);
      setIsHost(false);
      setSyncStatus('follower');
      setMessage('已加入房间，正在同步播放');
      await refreshRoomStatus();
      return true;
    } catch (error) {
      setMessage(error.message || '加入房间失败');
      return false;
    } finally { setIsConnecting(false); }
  }, [user, refreshRoomStatus]);

  const sendPlayCommand = useCallback((commandType, targetSongId = null) => {
    const state = stateRef.current;
    if (!state.roomId || !state.isHost) return;
    return listenApi.sendPlayCommand({
      roomId: state.roomId,
      user: normalizeUser(state.user),
      commandType,
      targetSongId: targetSongId || state.currentSong?.id,
      progress: state.progress,
      playStatus: commandType === 'PAUSE' ? 'PAUSE' : 'PLAY',
      sourceUrl: state.sourceUrl || state.currentSong?.url || ''
    });
  }, []);

  const sendChat = useCallback(async (text) => {
    const state = stateRef.current;
    const clean = String(text || '').trim();
    if (!state.roomId || !clean) return false;
    await listenApi.sendChat({ roomId: state.roomId, user: normalizeUser(state.user), text: clean });
    await pollRoom();
    return true;
  }, [pollRoom]);

  const exitRoom = useCallback(async () => {
    const activeRoom = stateRef.current.roomId;
    if (activeRoom && stateRef.current.isHost) await listenApi.endRoom(activeRoom).catch(() => {});
    setRoomId(null); setInviterId(null); setIsHost(false); setRoomUsers([]); setMessages([]); setSyncStatus('idle'); setMessage(''); lastMessageIdRef.current = 0;
  }, []);

  const getShareUrl = useCallback(() => roomId ? `http://8.137.169.120:16666/?listenRoom=${encodeURIComponent(roomId)}&inviterId=${encodeURIComponent(inviterId || user?.userId || '')}` : '', [roomId, inviterId, user]);

  return {
    roomId, inviterId, isHost, roomUsers, messages, isConnecting, syncStatus, message,
    createRoom, joinRoom, exitRoom, refreshRoomStatus, sendPlayCommand, sendChat, getShareUrl
  };
}
