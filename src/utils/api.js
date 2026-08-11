// api.js - NetEase Cloud Music API service interface
const BASE_URL = '/api';

export const apiCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export function getCachedData(endpoint) {
  const cached = apiCache.get(endpoint);
  if (cached && Date.now() - cached.time < CACHE_TTL_MS) {
    return cached.data;
  }
  return null;
}

// Helper for fetch requests
async function performRequest(endpoint, options = {}) {
  const isCacheable = !endpoint.includes('/login/') && 
                      !endpoint.includes('/logout') && 
                      !endpoint.includes('/like') && 
                      !endpoint.includes('timestamp=');

  if (isCacheable) {
    const data = getCachedData(endpoint);
    if (data) return data;
  }

  const url = `${BASE_URL}${endpoint}`;
  const { timeout = 10000, signal, ...fetchOptions } = options;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(new Error(`API timeout after ${timeout}ms`)), timeout);

  if (signal) {
    if (signal.aborted) controller.abort(signal.reason);
    else signal.addEventListener('abort', () => controller.abort(signal.reason), { once: true });
  }
  
  // Set default credentials to 'include' to ensure cookies are sent and received
  fetchOptions.credentials = fetchOptions.credentials || 'include';
  fetchOptions.headers = {
    'Content-Type': 'application/json',
    ...fetchOptions.headers,
  };
  fetchOptions.signal = controller.signal;

  try {
    const response = await fetch(url, fetchOptions);
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `API error: ${response.status}`);
    }
    const data = await response.json();
    
    if (isCacheable) {
      apiCache.set(endpoint, { data, time: Date.now() });
      if (apiCache.size > 200) {
        const firstKey = apiCache.keys().next().value;
        apiCache.delete(firstKey);
      }
    }
    
    return data;
  } catch (error) {
    console.error(`API Request Error on ${endpoint}:`, error);
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

// Several views can request the same metadata during startup. Share one
// in-flight GET instead of opening duplicate API connections. Requests with
// caller-owned AbortSignals remain independent.
const inFlightRequests = new Map();
async function request(endpoint, options = {}) {
  const method = String(options.method || 'GET').toUpperCase();
  if (method !== 'GET' || options.signal) return performRequest(endpoint, options);
  const existing = inFlightRequests.get(endpoint);
  if (existing) return existing;
  const pending = performRequest(endpoint, options).finally(() => {
    if (inFlightRequests.get(endpoint) === pending) inFlightRequests.delete(endpoint);
  });
  inFlightRequests.set(endpoint, pending);
  return pending;
}

export const api = {
  // Login State & User Status
  getLoginStatus: () => request('/login/status'),
  getUserPlaylists: (uid) => request(`/user/playlist?uid=${uid}&timestamp=${Date.now()}`),
  
  // QR Code Login Flows
  getQRKey: () => request(`/login/qr/key?timestamp=${Date.now()}`),
  createQRImage: (key) => request(`/login/qr/create?key=${key}&qrimg=true&timestamp=${Date.now()}`),
  checkQRStatus: (key) => request(`/login/qr/check?key=${key}&timestamp=${Date.now()}`),
  logout: () => request(`/logout?timestamp=${Date.now()}`),

  // Song details & URLs
  getSongUrls: (ids, level = 'exhigh') => request(`/song/url/v1?id=${ids}&level=${level}&timestamp=${Date.now()}`),
  // Legacy feedback endpoint: this is the endpoint used by the official
  // desktop/web clients to update recent-play and listening statistics.
  scrobble: ({ id, time, sourceid }) => {
    const params = new URLSearchParams({
      id: String(id),
      sourceid: String(sourceid || id),
      time: String(Math.max(1, Math.round(Number(time) || 0))),
      timestamp: String(Date.now())
    });
    return request(`/scrobble?${params.toString()}`, { timeout: 12000 });
  },
  // NCBL desktop-client report. Keep this as a fallback for servers/accounts
  // where the legacy feedback endpoint is temporarily unavailable.
  scrobbleV1: ({ id, time, total, sourceid, name, artist, level = 'exhigh' }) => {
    const params = new URLSearchParams({
      id: String(id),
      time: String(Math.max(1, Math.round(Number(time) || 0))),
      total: String(Math.max(1, Math.round(Number(total) || Number(time) || 1))),
      sourceid: String(sourceid || id),
      name: String(name || ''),
      artist: String(artist || ''),
      level: String(level),
      timestamp: String(Date.now())
    });
    return request(`/scrobble/v1?${params.toString()}`, { timeout: 12000 });
  },
  getRecentSongs: (limit = 100) => request(`/record/recent/song?limit=${Math.max(1, Math.min(200, Number(limit) || 100))}&timestamp=${Date.now()}`, { timeout: 12000 }),
  getSongDetails: (ids) => request(`/song/detail?ids=${ids}`),
  getLyrics: (id) => request(`/lyric?id=${id}`),
  getMatchedLyrics: ({ id, title, artist, album, durationMs, sources = 'amll,qq,kugou' }) => {
    const params = new URLSearchParams();
    if (id !== undefined && id !== null) params.set('id', id);
    if (title) params.set('title', title);
    if (artist) params.set('artist', artist);
    if (album) params.set('album', album);
    if (durationMs) params.set('durationMs', durationMs);
    if (sources) params.set('sources', sources);
    return request(`/lyric/match?${params.toString()}`, { timeout: 12000 });
  },
  likeSong: (id, like = true) => request(`/like?id=${id}&like=${like}&timestamp=${Date.now()}`),
  getLikedList: (uid) => request(`/likelist?uid=${uid}&timestamp=${Date.now()}`),

  // Playlist & Album Details
  getPlaylistDetail: (id) => request(`/playlist/detail?id=${id}`),
  getPlaylistTracks: (id, limit = 500, offset = 0) => 
    request(`/playlist/track/all?id=${id}&limit=${limit}&offset=${offset}`),
  getAlbumDetail: (id) => request(`/album?id=${id}`),

  // Artist info
  getArtistDetail: (id) => request(`/artists?id=${id}`),
  getArtistSongs: (id) => request(`/artist/songs?id=${id}`),
  getArtistAlbums: (id, limit = 50) => request(`/artist/album?id=${id}&limit=${limit}`),
  getArtistMVs: (id) => request(`/artist/mv?id=${id}`),

  // MV player
  getMVDetail: (mvid) => request(`/mv/detail?mvid=${mvid}`),
  getMVUrl: (id) => request(`/mv/url?id=${id}`),

  // Leaderboard Directory
  getLeaderboards: () => request('/toplist'),

  // Comments
  getComments: (id, limit = 40, offset = 0) => 
    request(`/comment/music?id=${id}&limit=${limit}&offset=${offset}`),

  // Search Features
  search: (keywords, type = 1, limit = 30, offset = 0) => 
    request(`/search?keywords=${encodeURIComponent(keywords)}&type=${type}&limit=${limit}&offset=${offset}`),
  getHotSearch: () => request('/search/hot/detail'),

  // Discover Features
  getBanners: () => request('/banner'),
  getPersonalized: (limit = 12) => request(`/personalized?limit=${limit}`),
};
