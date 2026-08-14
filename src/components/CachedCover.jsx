import { useEffect, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import { getRemoteSongCoverUrl, isLocalCoverUrl } from '../utils/songCover';
import ResilientCover from './ResilientCover';

function getRemoteCoverFallback(song) {
  const directCover = song?.coverUrl || '';
  return getRemoteSongCoverUrl(song)
    || (!isLocalCoverUrl(directCover) ? directCover : '')
    || directCover;
}

export function useCachedCoverUrl(song, forceRefresh = false) {
  const { resolveSongCover } = useApp();
  const [resolved, setResolved] = useState({ songId: null, url: '' });
  const lastUsableUrlRef = useRef('');

  const fallbackUrl = getRemoteCoverFallback(song);

  // Keep a usable cover visible while the cache lookup/download is in flight.
  // Clearing the URL here caused the player bar to briefly render a broken
  // image after a track switch, then a late cache response could leave it blank.
  const coverUrl = resolved.songId === song?.id
    ? (resolved.url || fallbackUrl || lastUsableUrlRef.current)
    : (fallbackUrl || lastUsableUrlRef.current);

  useEffect(() => {
    let cancelled = false;
    if (!song?.id) {
      setResolved({ songId: null, url: '' });
      return () => { cancelled = true; };
    }

    // Prefer this song's metadata immediately. If it has no remote cover yet,
    // retain the last usable image instead of flashing the global placeholder.
    setResolved({ songId: song.id, url: fallbackUrl || lastUsableUrlRef.current });
    if (fallbackUrl) lastUsableUrlRef.current = fallbackUrl;

    resolveSongCover(song, forceRefresh).then(result => {
      if (!cancelled && result?.url) {
        lastUsableUrlRef.current = result.url;
        setResolved({ songId: song.id, url: result.url });
      }
    }).catch(() => {
      // The metadata fallback remains visible; cover caching must never blank
      // the player while audio continues to play.
    });

    return () => { cancelled = true; };
  }, [song?.id, fallbackUrl, resolveSongCover, forceRefresh]);

  return coverUrl;
}

export default function CachedCover({ song, alt = '', className = '', style, onClick }) {
  const [retryNonce, setRetryNonce] = useState(0);
  const coverUrl = useCachedCoverUrl(song, retryNonce > 0);
  const fallbackUrl = getRemoteCoverFallback(song);
  const refreshCover = () => {
    if (song) setRetryNonce(value => value + 1);
  };
  return <ResilientCover
    src={coverUrl}
    fallbackSrc={fallbackUrl}
    alt={alt}
    className={className}
    style={style}
    onClick={onClick}
    onRetry={refreshCover}
  />;
}
