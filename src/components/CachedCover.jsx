import { useEffect, useState } from 'react';
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

  const fallbackUrl = getRemoteCoverFallback(song);

  // Keep a usable cover visible while the cache lookup/download is in flight.
  // Clearing the URL here caused the player bar to briefly render a broken
  // image after a track switch, then a late cache response could leave it blank.
  const coverUrl = resolved.songId === song?.id
    ? (resolved.url || fallbackUrl)
    : fallbackUrl;

  useEffect(() => {
    let cancelled = false;
    if (!song?.id) {
      setResolved({ songId: null, url: '' });
      return () => { cancelled = true; };
    }

    // Switch immediately to this song's own metadata cover, never the
    // previous song's resolved file URL.
    setResolved({ songId: song.id, url: fallbackUrl });

    resolveSongCover(song, forceRefresh).then(result => {
      if (!cancelled && result?.url) setResolved({ songId: song.id, url: result.url });
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
