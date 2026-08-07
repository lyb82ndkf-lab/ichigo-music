const LOCAL_COVER_PATTERN = /^(file|data|blob):/i;
const REMOTE_COVER_PATTERN = /^https?:\/\//i;

export function isLocalCoverUrl(url) {
  return LOCAL_COVER_PATTERN.test(String(url || ''));
}

export function isRemoteCoverUrl(url) {
  return REMOTE_COVER_PATTERN.test(String(url || ''));
}

export function getRemoteSongCoverUrl(song) {
  if (!song) return '';
  const candidates = [
    song.originalCoverUrl,
    song.al?.picUrl,
    song.album?.picUrl,
    song.picUrl,
    song.cover,
    song.coverUrl
  ];
  return candidates.find(isRemoteCoverUrl) || '';
}

export function getSongCoverUrl(song, remoteOnly = false) {
  if (!song) return '';
  const directCover = song.coverUrl || '';
  const remoteCover = getRemoteSongCoverUrl(song);
  if (remoteOnly && isLocalCoverUrl(directCover)) return remoteCover;
  return directCover || remoteCover;
}

// Cache file URLs are renderer implementation details. Persisting one into the
// song metadata can destroy the only remote fallback, so only durable remote
// URLs are allowed to replace coverUrl/originalCoverUrl.
export function getPersistentSongCoverUrl(song, resolved = {}) {
  const resolvedRemote = isRemoteCoverUrl(resolved.remoteUrl) ? resolved.remoteUrl : '';
  const metadataRemote = getRemoteSongCoverUrl(song);
  const resolvedUrl = isRemoteCoverUrl(resolved.url) ? resolved.url : '';
  return resolvedRemote || metadataRemote || resolvedUrl || '';
}
