import React, { useEffect, useState } from 'react';
import { ImageOff } from 'lucide-react';

export default function ResilientCover({ src, alt = '', className = '', style, onClick, onRetry }) {
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setAttempt(0);
    setFailed(false);
  }, [src]);

  useEffect(() => {
    if (!src || !failed || attempt >= 3) return undefined;
    const timer = window.setTimeout(() => {
      setFailed(false);
      setAttempt(value => value + 1);
    }, 700 * (attempt + 1));
    return () => window.clearTimeout(timer);
  }, [src, failed, attempt]);

  const retryUrl = src && attempt > 0
    ? `${src}${src.includes('?') ? '&' : '?'}ichigo_retry=${attempt}`
    : src;

  const handleError = () => {
    // Never block playback with a modal. Retry in the background and keep a
    // stable placeholder if the remote image remains unavailable.
    if (attempt < 2) onRetry?.();
    setFailed(true);
  };

  if (!src || failed) {
    return (
      <div className={`cover-placeholder ${className}`} style={style} onClick={onClick} role="img" aria-label={alt || '封面占位图'}>
        <ImageOff size="42%" />
      </div>
    );
  }

  return <img src={retryUrl} alt={alt} className={className} style={style} onClick={onClick} onError={handleError} />;
}
