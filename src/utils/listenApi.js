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
  checkRoom: (roomId, user) => post('/listentogether/room/check', { roomId, user }),
  getStatus: (roomId, user) => post(`/listentogether/status?timestamp=${Date.now()}`, { roomId, user }),
  sendHeartbeat: (payload) => post('/listentogether/heatbeat', payload),
  sendPlayCommand: (payload) => post('/listentogether/play/command', payload),
  syncPlaylist: (payload) => post('/listentogether/sync/list/command', payload),
  getRoomPlaylist: (roomId) => post('/listentogether/sync/playlist/get', { roomId }),
  acceptInvitation: (roomId, inviterId, user) => post('/listentogether/accept', { roomId, inviterId, user }),
  endRoom: (roomId) => post('/listentogether/end', { roomId }),
  sendChat: ({ roomId, user, text }) => post('/listentogether/chat/send', { roomId, user, text }),
  getChat: (roomId, since = 0) => listenRequest(`/listentogether/chat/messages?roomId=${encodeURIComponent(roomId)}&since=${since}`)
};
