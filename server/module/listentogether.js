// In-process room state for the listen-together API.
// The desktop app polls this state every 1.2 seconds so playback and chat stay responsive.
const rooms = new Map();
const ok = (body) => ({ status: 200, body });
const fail = (status, msg) => ({ status, body: { code: status, msg } });

const userOf = (query) => {
  const value = query?.user;
  if (!value) return { userId: `guest-${Date.now()}`, nickname: '访客', avatarUrl: '' };
  if (typeof value === 'string') {
    try { return JSON.parse(value); } catch { return { userId: value, nickname: value, avatarUrl: '' }; }
  }
  return { userId: value.userId || value.id || `guest-${Date.now()}`, nickname: value.nickname || value.name || '访客', avatarUrl: value.avatarUrl || '' };
};

function addUser(room, user) {
  const id = String(user.userId);
  const existing = room.users.find(item => String(item.userId) === id);
  if (existing) Object.assign(existing, user, { lastSeen: Date.now() });
  else room.users.push({ ...user, lastSeen: Date.now() });
}

function roomData(room) {
  const now = Date.now();
  room.users = room.users.filter(item => now - item.lastSeen < 12000);
  return {
    roomId: room.roomId,
    users: room.users.map(({ lastSeen, ...item }) => item),
    playState: room.playState,
    playlist: room.playlist,
    messages: room.messages.slice(-100),
    status: 'active'
  };
}

function getRoom(query) {
  const room = rooms.get(String(query?.roomId || ''));
  return room || null;
}

const api = {
  roomCreate(query) {
    const roomId = `room_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const room = {
      roomId,
      users: [],
      playState: { currentSongId: null, progress: 0, playStatus: 'PAUSE', updatedAt: Date.now() },
      playlist: { displayList: [], randomList: [], version: 0 },
      messages: [],
      nextMessageId: 1
    };
    addUser(room, userOf(query));
    rooms.set(roomId, room);
    return ok({ code: 200, msg: '房间创建成功', data: { roomId, status: 'waiting' } });
  },

  roomCheck(query) {
    const room = getRoom(query);
    if (!room) return fail(404, '房间不存在');
    addUser(room, userOf(query));
    return ok({ code: 200, data: roomData(room) });
  },

  statusGet(query) {
    const room = getRoom(query);
    if (!room) return fail(404, '房间不存在');
    addUser(room, userOf(query));
    return ok({ code: 200, data: roomData(room) });
  },

  heartbeat(query) {
    const room = getRoom(query);
    if (!room) return fail(404, '房间不存在');
    addUser(room, userOf(query));
    if (query.songId && String(query.songId) !== '0') room.playState.currentSongId = query.songId;
    room.playState.progress = Number(query.progress || 0);
    room.playState.playStatus = query.playStatus || room.playState.playStatus;
    room.playState.updatedAt = Date.now();
    return ok({ code: 200, data: roomData(room) });
  },

  playCommand(query) {
    const room = getRoom(query);
    if (!room) return fail(404, '房间不存在');
    addUser(room, userOf(query));
    room.playState.currentSongId = query.targetSongId || room.playState.currentSongId;
    room.playState.progress = Number(query.progress || 0);
    room.playState.playStatus = query.playStatus || (query.commandType === 'PAUSE' ? 'PAUSE' : 'PLAY');
    room.playState.commandType = query.commandType || 'PLAY';
    room.playState.updatedAt = Date.now();
    return ok({ code: 200, data: room.playState });
  },

  syncListCommand(query) {
    const room = getRoom(query);
    if (!room) return fail(404, '房间不存在');
    room.playlist = {
      displayList: String(query.displayList || '').split(',').filter(Boolean),
      randomList: String(query.randomList || '').split(',').filter(Boolean),
      version: Number(query.version || room.playlist.version + 1)
    };
    return ok({ code: 200, data: room.playlist });
  },

  syncPlaylistGet(query) {
    const room = getRoom(query);
    if (!room) return fail(404, '房间不存在');
    return ok({ code: 200, data: { playlist: room.playlist } });
  },

  accept(query) {
    const room = getRoom(query);
    if (!room) return fail(404, '房间不存在');
    addUser(room, userOf(query));
    return ok({ code: 200, data: roomData(room) });
  },

  end(query) {
    rooms.delete(String(query?.roomId || ''));
    return ok({ code: 200, msg: '房间已结束' });
  },

  chatSend(query) {
    const room = getRoom(query);
    if (!room) return fail(404, '房间不存在');
    const text = String(query.text || '').trim().slice(0, 500);
    if (!text) return fail(400, '消息不能为空');
    const user = userOf(query);
    addUser(room, user);
    const item = { id: room.nextMessageId++, userId: user.userId, nickname: user.nickname, avatarUrl: user.avatarUrl, text, createdAt: Date.now() };
    room.messages.push(item);
    return ok({ code: 200, data: item });
  },

  chatMessages(query) {
    const room = getRoom(query);
    if (!room) return fail(404, '房间不存在');
    const since = Number(query.since || 0);
    return ok({ code: 200, data: { messages: room.messages.filter(item => item.id > since) } });
  }
};

module.exports = api;
