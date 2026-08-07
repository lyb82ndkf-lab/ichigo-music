const LISTEN_SERVER_URL = (import.meta.env.VITE_LISTEN_SERVER_URL || 'http://8.137.169.120:16666').replace(/\/$/, '');

async function listenRequest(endpoint, options = {}) {
  const response = await fetch(`${LISTEN_SERVER_URL}/api${endpoint}`, {
    credentials: 'include',
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.msg || data.message || `API Error: ${response.status}`);
  return data;
}

const post = (endpoint, body) => listenRequest(endpoint, {
  method: 'POST',
  body: JSON.stringify(body)
});

export const listenApi = {
  createRoom: (user) => post('/listentogether/room/create', { user }),
  checkRoom: (roomId, user, roomToken = '') => post('/listentogether/room/check', { roomId, roomToken, user }),
  getStatus: (roomId, user, roomToken = '') => post(`/listentogether/status?timestamp=${Date.now()}`, { roomId, roomToken, user }),
  sendHeartbeat: (payload) => post('/listentogether/heatbeat', payload),
  sendPlayCommand: (payload) => post('/listentogether/play/command', payload),
  syncPlaylist: (payload) => post('/listentogether/sync/list/command', payload),
  getRoomPlaylist: (roomId, roomToken = '') => post('/listentogether/sync/playlist/get', { roomId, roomToken }),
  acceptInvitation: (roomId, inviterId, user, roomToken = '') => post('/listentogether/accept', { roomId, roomToken, inviterId, user }),
  endRoom: (roomId, user, roomToken = '') => post('/listentogether/end', { roomId, roomToken, user }),
  sendChat: ({ roomId, roomToken = '', user, text }) => post('/listentogether/chat/send', { roomId, roomToken, user, text }),
  getChat: (roomId, since = 0, roomToken = '') => listenRequest(`/listentogether/chat/messages?roomId=${encodeURIComponent(roomId)}&since=${since}&roomToken=${encodeURIComponent(roomToken)}`)
};
