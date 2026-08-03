import { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import ResilientCover from './ResilientCover';

export function useCachedCoverUrl(song) {
  const { resolveSongCover } = useApp();
  const [coverUrl, setCoverUrl] = useState('');

  useEffect(() => {
    let cancelled = false;
    setCoverUrl('');
    if (!song) return () => { cancelled = true; };

    resolveSongCover(song).then(result => {
      if (!cancelled) setCoverUrl(result?.url || '');
    }).catch(() => {
      if (!cancelled) setCoverUrl('');
    });

    return () => { cancelled = true; };
  }, [song?.id, song?.coverUrl, song?.originalCoverUrl, resolveSongCover]);

  return coverUrl;
}

export default function CachedCover({ song, alt = '', className = '', style, onClick }) {
  const coverUrl = useCachedCoverUrl(song);
  return <ResilientCover src={coverUrl} alt={alt} className={className} style={style} onClick={onClick} />;
}
