import React, { useEffect, useState } from 'react';
import { ImageOff } from 'lucide-react';

const DISMISS_KEY = 'ichigomusic_cover_retry_prompt_disabled';

export default function ResilientCover({ src, alt = '', className = '', style, onClick }) {
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setAttempt(0);
    setFailed(false);
  }, [src]);

  const retryUrl = src && attempt > 0
    ? `${src}${src.includes('?') ? '&' : '?'}ichigo_retry=${attempt}`
    : src;

  const handleError = () => {
    if (attempt === 0 && localStorage.getItem(DISMISS_KEY) !== '1') {
      if (window.confirm('专辑封面加载失败，是否重新加载？')) {
        setAttempt(1);
        return;
      }
      if (window.confirm('以后封面加载失败时不再提示吗？')) {
        localStorage.setItem(DISMISS_KEY, '1');
      }
    }
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
