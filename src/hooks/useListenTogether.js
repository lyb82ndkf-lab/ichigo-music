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
const serializeSong = (song) => song?.id ? {
  id: song.id,
  name: song.name || song.title || '',
  title: song.title || song.name || '',
  artist: song.artist || song.ar?.map(item => item.name).join(' / ') || song.artists?.map(item => item.name).join(' / ') || '',
  coverUrl: song.coverUrl || song.al?.picUrl || song.album?.picUrl || '',
  durationMs: song.durationMs || song.dt || song.duration || 0
} : null;
const mergeMessages = (previous, incoming) => {
  const byId = new Map((previous || []).map(item => [item.id, item]));
  (incoming || []).forEach(item => {
    if (item?.id !== undefined) byId.set(item.id, item);
  });
  return Array.from(byId.values()).sort((a, b) => Number(a.id || 0) - Number(b.id || 0));
};

export function useListenTogether() {
  const { user, currentSong, isPlaying, progress, playSong, setIsPlaying, playlist, audioElement } = useApp();
  const [roomId, setRoomId] = useState(null);
  const [roomToken, setRoomToken] = useState(null);
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
  const lastRemoteUpdatedAtRef = useRef(0);
  const socketConnectedRef = useRef(false);

  stateRef.current = { roomId, roomToken, user, currentSong, isPlaying, progress, playlist, isHost, audioElement, sourceUrl: currentSong?.url || audioElement?.currentSrc || audioElement?.src || '' };

  const refreshRoomStatus = useCallback(async () => {
    const { roomId: activeRoom, user: activeUser } = stateRef.current;
    if (!activeRoom) return null;
    const res = await listenApi.checkRoom(activeRoom, normalizeUser(activeUser), stateRef.current.roomToken || '');
    if (res.data?.users) setRoomUsers(res.data.users);
    return res.data;
  }, []);

  const applyRemoteState = useCallback(async (remote) => {
    const state = remote?.playState;
    if (!state || stateRef.current.isHost || !state.currentSongId) return;
    const updatedAt = Number(state.updatedAt || 0);
    if (updatedAt && updatedAt < lastRemoteUpdatedAtRef.current) return;
    if (updatedAt) lastRemoteUpdatedAtRef.current = updatedAt;
    const songId = String(state.currentSongId);
    const localId = String(stateRef.current.currentSong?.id || '');
    const sourceUrl = String(state.sourceUrl || '');
    const localSourceUrl = String(stateRef.current.currentSong?.url || '');
    const sourceNeedsUpdate = sourceUrl && sourceUrl !== localSourceUrl;
    if ((songId !== localId || sourceNeedsUpdate) && (songId !== String(lastRemoteSongRef.current || '') || sourceNeedsUpdate)) {
      const result = state.song?.id ? null : await api.getSongDetails(songId).catch(() => null);
      const song = state.song?.id ? state.song : result?.songs?.[0];
      if (song) {
        lastRemoteSongRef.current = songId;
        remoteActionRef.current = true;
        const elapsed = String(state.playStatus).toUpperCase() === 'PLAY'
          ? Math.max(0, (Date.now() - Number(state.updatedAt || Date.now())) / 1000)
          : 0;
        const syncedProgress = Number(state.progress || 0) + elapsed;
        try {
          await playSong(sourceUrl ? { ...song, url: sourceUrl, urlCachedAt: Date.now() } : song, null, syncedProgress, { remoteSync: true });
          const shouldPlay = String(state.playStatus).toUpperCase() === 'PLAY';
          setIsPlaying(shouldPlay);
          if (!shouldPlay) stateRef.current.audioElement?.pause?.();
          else window.setTimeout(() => {
            const request = stateRef.current.audioElement?.play?.();
            request?.catch?.(() => {});
          }, 80);
        } finally {
          remoteActionRef.current = false;
        }
      }
      return;
    }
    const audio = stateRef.current.audioElement;
    const elapsed = String(state.playStatus).toUpperCase() === 'PLAY'
      ? Math.max(0, (Date.now() - Number(state.updatedAt || Date.now())) / 1000)
      : 0;
    const syncedProgress = Number(state.progress || 0) + elapsed;
    if (audio && Math.abs(Number(audio.currentTime || 0) - syncedProgress) > 2) {
      audio.currentTime = syncedProgress;
    }
    const shouldPlay = String(state.playStatus).toUpperCase() === 'PLAY';
    if (!remoteActionRef.current) {
      if (shouldPlay) {
        setIsPlaying(true);
        if (audio && audio.paused) {
          const request = audio.play?.();
          request?.catch?.(() => {});
        }
      } else {
        audio?.pause?.();
        setIsPlaying(false);
      }
    }
  }, [playSong, setIsPlaying]);

  const pollRoom = useCallback(async () => {
    const { roomId: activeRoom, user: activeUser } = stateRef.current;
    if (!activeRoom || socketConnectedRef.current) return;
    try {
      const status = await listenApi.getStatus(activeRoom, normalizeUser(activeUser), stateRef.current.roomToken || '');
      if (status.data?.users) setRoomUsers(status.data.users);
      if (!stateRef.current.isHost) await applyRemoteState(status.data);
      const chat = await listenApi.getChat(activeRoom, lastMessageIdRef.current, stateRef.current.roomToken || '');
      if (Array.isArray(chat.data?.messages) && chat.data.messages.length) {
        setMessages(prev => mergeMessages(prev, chat.data.messages));
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
      const { currentSong: song, isPlaying: playing, progress: currentProgress, user: activeUser, isHost: host } = stateRef.current;
      const payload = { roomId, roomToken: stateRef.current.roomToken || '', user: normalizeUser(activeUser) };
      if (host) Object.assign(payload, {
        songId: song?.id || 0,
        playStatus: playing ? 'PLAY' : 'PAUSE',
        progress: Number(currentProgress || 0),
        sourceUrl: stateRef.current.sourceUrl || '',
        song: serializeSong(song)
      });
      listenApi.sendHeartbeat(payload).catch(() => {});
    }, 1800);
    return () => clearInterval(timer);
  }, [roomId]);

  // Publish song/play-pause changes immediately; the heartbeat remains as a
  // recovery channel for reconnects and progress drift.
  useEffect(() => {
    const state = stateRef.current;
    if (!roomId || !isHost || !currentSong?.id) return undefined;
    const timer = window.setTimeout(() => {
      listenApi.sendHeartbeat({
        roomId,
        roomToken: stateRef.current.roomToken || '',
        user: normalizeUser(user),
        songId: currentSong.id,
        playStatus: isPlaying ? 'PLAY' : 'PAUSE',
        progress: Number(progress || 0),
        sourceUrl: state.sourceUrl || currentSong.url || '',
        song: serializeSong(currentSong)
      }).catch(() => {});
    }, 80);
    return () => window.clearTimeout(timer);
  }, [roomId, isHost, currentSong?.id, currentSong?.url, isPlaying]);

  useEffect(() => {
    if (!roomId || typeof WebSocket === 'undefined') return undefined;
    const activeUser = normalizeUser(user);
    const params = new URLSearchParams({ roomId, roomToken: stateRef.current.roomToken || '', userId: activeUser.userId, nickname: activeUser.nickname });
    const socket = new WebSocket(`${LISTEN_SOCKET_URL}?${params.toString()}`);
    socket.onopen = () => {
      socketConnectedRef.current = true;
      setSyncStatus(stateRef.current.isHost ? 'host' : 'follower');
    };
    socket.onerror = () => {
      socketConnectedRef.current = false;
    };
    socket.onclose = () => {
      socketConnectedRef.current = false;
    };
    socket.onmessage = event => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === 'snapshot') {
          if (payload.data?.users) setRoomUsers(payload.data.users);
          if (Array.isArray(payload.data?.messages) && payload.data.messages.length) {
            setMessages(prev => mergeMessages(prev, payload.data.messages));
            lastMessageIdRef.current = payload.data.messages[payload.data.messages.length - 1].id;
          }
          if (!stateRef.current.isHost) applyRemoteState(payload.data);
        }
        if (payload.type === 'playback' && !stateRef.current.isHost) applyRemoteState({ playState: payload.data });
        if (payload.type === 'chat' && payload.data && payload.data.id > lastMessageIdRef.current) {
          setMessages(prev => mergeMessages(prev, [payload.data]));
          lastMessageIdRef.current = payload.data.id;
        }
        if (payload.type === 'room-ended') setMessage('房主已结束房间');
      } catch (_) {}
    };
    return () => {
      socketConnectedRef.current = false;
      socket.close();
    };
  }, [roomId, user, applyRemoteState]);

  const createRoom = useCallback(async () => {
    setIsConnecting(true);
    setMessage('正在创建听歌房间...');
    try {
      const res = await listenApi.createRoom(normalizeUser(user));
      const id = res.data?.roomId || res.data?.roomInfo?.roomId;
      const token = res.data?.roomToken || res.data?.roomInfo?.roomToken || '';
      if (!id) throw new Error(res.msg || '创建房间失败');
      setRoomId(id);
      setRoomToken(token);
      setInviterId(user?.userId || null);
      setIsHost(true);
      setSyncStatus('host');
      setMessage('房间已创建，邀请朋友加入吧');
      await listenApi.sendHeartbeat({ roomId: id, roomToken: token, user: normalizeUser(user), songId: currentSong?.id || 0, playStatus: isPlaying ? 'PLAY' : 'PAUSE', progress, sourceUrl: stateRef.current.sourceUrl || currentSong?.url || '', song: serializeSong(currentSong) });
      if (playlist.length) listenApi.syncPlaylist({ roomId: id, roomToken: token, user: normalizeUser(user), displayList: playlist.map(song => song.id), randomList: playlist.map(song => song.id) }).catch(() => {});
      return id;
    } catch (error) {
      setMessage(error.message || '创建房间失败');
      return null;
    } finally { setIsConnecting(false); }
  }, [user, currentSong, isPlaying, progress, playlist]);

  const joinRoom = useCallback(async (targetRoomId, targetInviterId = '', targetRoomToken = '') => {
    if (!targetRoomId) return false;
    setIsConnecting(true);
    setMessage('正在加入房间...');
    try {
      const result = await listenApi.acceptInvitation(targetRoomId, targetInviterId, normalizeUser(user), targetRoomToken);
      if (result.code && result.code !== 200) throw new Error(result.msg || '加入房间失败');
      setRoomId(targetRoomId);
      setRoomToken(targetRoomToken || '');
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
      roomToken: state.roomToken || '',
      user: normalizeUser(state.user),
      commandType,
      targetSongId: targetSongId || state.currentSong?.id,
      progress: state.progress,
      playStatus: commandType === 'PAUSE' ? 'PAUSE' : 'PLAY',
      sourceUrl: state.sourceUrl || state.currentSong?.url || '',
      song: serializeSong(state.currentSong)
    });
  }, []);

  const sendChat = useCallback(async (text) => {
    const state = stateRef.current;
    const clean = String(text || '').trim();
    if (!state.roomId || !clean) return false;
    await listenApi.sendChat({ roomId: state.roomId, roomToken: state.roomToken || '', user: normalizeUser(state.user), text: clean });
    await pollRoom();
    return true;
  }, [pollRoom]);

  const exitRoom = useCallback(async () => {
    const activeRoom = stateRef.current.roomId;
    if (activeRoom && stateRef.current.isHost) await listenApi.endRoom(activeRoom, normalizeUser(stateRef.current.user), stateRef.current.roomToken || '').catch(() => {});
    setRoomId(null); setRoomToken(null); setInviterId(null); setIsHost(false); setRoomUsers([]); setMessages([]); setSyncStatus('idle'); setMessage(''); lastMessageIdRef.current = 0; lastRemoteUpdatedAtRef.current = 0; lastRemoteSongRef.current = null;
  }, []);

  const getShareUrl = useCallback(() => roomId ? `http://8.137.169.120:16666/?listenRoom=${encodeURIComponent(roomId)}&roomToken=${encodeURIComponent(roomToken || '')}&inviterId=${encodeURIComponent(inviterId || user?.userId || '')}` : '', [roomId, roomToken, inviterId, user]);

  return {
    roomId, roomToken, inviterId, isHost, roomUsers, messages, isConnecting, syncStatus, message,
    createRoom, joinRoom, exitRoom, refreshRoomStatus, sendPlayCommand, sendChat, getShareUrl
  };
}
