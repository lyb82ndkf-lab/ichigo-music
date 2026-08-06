import { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import ResilientCover from './ResilientCover';

export function useCachedCoverUrl(song, forceRefresh = false) {
  const { resolveSongCover } = useApp();
  const [coverUrl, setCoverUrl] = useState('');

  useEffect(() => {
    let cancelled = false;
    setCoverUrl('');
    if (!song) return () => { cancelled = true; };

    resolveSongCover(song, forceRefresh).then(result => {
      if (!cancelled) setCoverUrl(result?.url || '');
    }).catch(() => {
      if (!cancelled) setCoverUrl('');
    });

    return () => { cancelled = true; };
  }, [song?.id, song?.coverUrl, song?.originalCoverUrl, resolveSongCover, forceRefresh]);

  return coverUrl;
}

export default function CachedCover({ song, alt = '', className = '', style, onClick }) {
  const [retryNonce, setRetryNonce] = useState(0);
  const coverUrl = useCachedCoverUrl(song, retryNonce > 0);
  const refreshCover = () => {
    if (song) setRetryNonce(value => value + 1);
  };
  return <ResilientCover src={coverUrl} alt={alt} className={className} style={style} onClick={onClick} onRetry={refreshCover} />;
}
