// api.js - NetEase Cloud Music API service interface
const BASE_URL = '/api';

const cache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// Helper for fetch requests
async function request(endpoint, options = {}) {
  const isCacheable = !endpoint.includes('/login/') && 
                      !endpoint.includes('/logout') && 
                      !endpoint.includes('/like') && 
                      !endpoint.includes('timestamp=');

  if (isCacheable) {
    const cached = cache.get(endpoint);
    if (cached && Date.now() - cached.time < CACHE_TTL_MS) {
      return cached.data;
    }
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
      cache.set(endpoint, { data, time: Date.now() });
      if (cache.size > 200) {
        const firstKey = cache.keys().next().value;
        cache.delete(firstKey);
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
  getSongDetails: (ids) => request(`/song/detail?ids=${ids}`),
  getLyrics: (id) => request(`/lyric?id=${id}`),
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
};
