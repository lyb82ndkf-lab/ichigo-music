import React, { useEffect, useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import {
  Compass, TrendingUp, Heart, History, Settings, Play, Pause, Music,
  Radio, HardDrive, Sparkles, Sun, Moon, Sunrise, Sunset, Search, Disc,
  Flame, ListMusic, ChevronRight, Mic2, ExternalLink
} from 'lucide-react';
import ResilientCover from '../components/ResilientCover';
import CachedCover, { useCachedCoverUrl } from '../components/CachedCover';
import { useLyricEngine } from '../hooks/useLyricEngine';

function getGreetingInfo() {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 11) {
    return {
      period: '早安',
      en: 'GOOD MORNING',
      Icon: Sunrise,
      title: '清晨的第一缕微光，伴着旋律开启活力一天',
      sub: '精选晨间咖啡与舒缓旋律，为你注入满满元气'
    };
  } else if (hour >= 11 && hour < 14) {
    return {
      period: '午安',
      en: 'GOOD NOON',
      Icon: Sun,
      title: '阳光正盛，让轻松的慢时光抚平思绪',
      sub: '探索流行精选与治愈小调，享受片刻惬意'
    };
  } else if (hour >= 14 && hour < 18) {
    return {
      period: '下午好',
      en: 'GOOD AFTERNOON',
      Icon: Sun,
      title: '专注或小憩，每一刻都有好歌相伴',
      sub: '为你准备了时下热门榜单与宝藏专辑'
    };
  } else if (hour >= 18 && hour < 23) {
    return {
      period: '晚上好',
      en: 'GOOD EVENING',
      Icon: Sunset,
      title: '卸下一天的疲倦，沉浸在专属音乐世界',
      sub: '聆听你的私人珍藏，重温每一个心动旋律'
    };
  } else {
    return {
      period: '夜深了',
      en: 'LATE NIGHT',
      Icon: Moon,
      title: '夜色静谧，愿温柔清澈的音符伴你安然入梦',
      sub: '轻柔慢速歌单与疗愈旋律，伴你安睡'
    };
  }
}

function CompactRecentSongItem({ song, onPlay, onNavigateArtist }) {
  const { resolveSongCover } = useApp();
  const directCover = song?.coverUrl || song?.al?.picUrl || '';
  const [coverUrl, setCoverUrl] = useState('');
  const primaryArtist = song?.ar?.[0] || song?.artists?.[0] || null;

  useEffect(() => {
    let cancelled = false;
    setCoverUrl('');
    resolveSongCover(song).then(result => {
      if (!cancelled) setCoverUrl(result?.url || directCover);
    }).catch(() => {
      if (!cancelled) setCoverUrl(directCover);
    });
    return () => { cancelled = true; };
  }, [song?.id, directCover, resolveSongCover]);

  return (
    <div className="compact-song-item" onClick={() => onPlay(song)}>
      <ResilientCover src={coverUrl} alt={song.name || 'cover'} className="compact-song-cover" />
      <div className="compact-song-info">
        <div className="compact-song-name" title={song.name}>{song.name}</div>
        <div
          className="compact-song-artist"
          title={primaryArtist?.name || '未知艺术家'}
          onClick={(e) => {
            e.stopPropagation();
            if (primaryArtist?.id) onNavigateArtist(primaryArtist.id);
          }}
          style={{ cursor: primaryArtist?.id ? 'pointer' : 'default' }}
        >
          {primaryArtist?.name || '未知艺术家'}
        </div>
      </div>
      <button className="compact-play-trigger" aria-label="播放">
        <Play size={14} fill="currentColor" />
      </button>
    </div>
  );
}

export default function ModernHome() {
  const {
    currentSong, isPlaying, togglePlay, navigateTo, recentlyPlayed,
    audioElement, userPlaylists, advancedLyricConfig, likedSongIds,
    user, playSong, setIsLyricsOpen, seekTo
  } = useApp();

  const greeting = useMemo(() => getGreetingInfo(), []);
  const resolvedCurrentCoverUrl = useCachedCoverUrl(currentSong);
  const { lyrics, activeLineIndex } = useLyricEngine(
    currentSong?.id,
    audioElement,
    currentSong,
    advancedLyricConfig?.lyricSources || 'amll,qq,kugou'
  );

  const openSearch = () => {
    navigateTo('search');
  };

  const coverUrl = resolvedCurrentCoverUrl
    || currentSong?.originalCoverUrl
    || currentSong?.al?.picUrl
    || currentSong?.album?.picUrl
    || '';

  const activeLyric = (activeLineIndex >= 0 && lyrics?.[activeLineIndex]?.text)
    ? lyrics[activeLineIndex].text
    : '';

  const currentPrimaryArtist = currentSong?.ar?.[0] || currentSong?.artists?.[0] || null;
  const currentAlbumName = currentSong?.al?.name || currentSong?.album?.name || '未知专辑';
  const GreetingIcon = greeting.Icon;

  const recentSongs = useMemo(() => {
    return (recentlyPlayed || []).slice(0, 10);
  }, [recentlyPlayed]);

  const compactPlaylists = useMemo(() => {
    return (userPlaylists || []).slice(0, 4);
  }, [userPlaylists]);
  return (
    <div className="view-container modern-home">
      {/* ================= LEFT: VINYL POSTER & NOW PLAYING STAGE ================= */}
      <div className="home-left-stage">
        <div className="hero-ambient-glow" />

        {/* 1. Top Graphic: Large Album Poster or Idle Graphic */}
        {currentSong ? (
          <div className="stage-poster-box">
            <CachedCover song={currentSong} alt="cover" className="stage-poster-img" />
            {coverUrl && (
              <div className="stage-poster-glow" style={{ backgroundImage: `url(${coverUrl})` }} />
            )}
          </div>
        ) : (
          <div className="idle-stage-graphic">
            <GreetingIcon size={64} style={{ color: 'rgba(255, 255, 255, 0.9)', filter: 'drop-shadow(0 8px 20px rgba(0,0,0,0.4))' }} />
          </div>
        )}

        {/* 2. Middle: Centered Typography */}
        <div className="stage-meta-center">
          {currentSong ? (
            <>
              <div className="stage-kicker">
                <Disc size={12} />
                <span>NOW PLAYING</span>
              </div>
              <div className="stage-song-title" title={currentSong.name}>
                {currentSong.name}
              </div>
              <div className="stage-song-sub" title={`${currentPrimaryArtist?.name || '未知艺术家'} · ${currentAlbumName}`}>
                <span
                  className="stage-artist-link"
                  onClick={() => currentPrimaryArtist?.id && navigateTo('artist-detail', { id: currentPrimaryArtist.id })}
                  style={{ cursor: currentPrimaryArtist?.id ? 'pointer' : 'default' }}
                >
                  {currentPrimaryArtist?.name || '未知艺术家'}
                </span>
                {' · '}
                <span
                  onClick={() => (currentSong?.al?.id || currentSong?.album?.id) && navigateTo('album-detail', { id: currentSong?.al?.id || currentSong?.album?.id })}
                  style={{ cursor: (currentSong?.al?.id || currentSong?.album?.id) ? 'pointer' : 'default' }}
                >
                  {currentAlbumName}
                </span>
              </div>
            </>
          ) : (
            <>
              <div className="stage-kicker">
                <GreetingIcon size={12} />
                <span>{greeting.en}</span>
              </div>
              <div className="stage-song-title">
                {user?.nickname ? `${greeting.period}，${user.nickname}` : `${greeting.period}，音乐人`}
              </div>
              <div className="stage-song-sub">
                {greeting.title}
              </div>
            </>
          )}
        </div>

        {/* 3. Floating Dynamic Live Lyric Capsule */}
        <div className="stage-lyric-capsule">
          <div className="lyric-wave-bars">
            <span />
            <span />
            <span />
            <span />
          </div>
          <div className="stage-lyric-capsule-text" title={activeLyric || (currentSong ? '♪ 沉醉在纯净旋律里' : greeting.sub)}>
            {activeLyric ? `♪ ${activeLyric}` : (currentSong ? '♪ 沉醉在纯净旋律里，尽享高保真音质' : `✨ ${greeting.sub}`)}
          </div>
        </div>

        {/* 4. Action Island at Bottom */}
        <div className="stage-action-row">
          {currentSong ? (
            <>
              <button className="stage-action-pill primary" onClick={togglePlay}>
                {isPlaying ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
                <span>{isPlaying ? '暂停' : '播放'}</span>
              </button>
              <button className="stage-action-pill" onClick={() => setIsLyricsOpen(true)}>
                <Mic2 size={13} />
                <span>沉浸模式</span>
              </button>
            </>
          ) : (
            <>
              <button className="stage-action-pill primary" onClick={() => navigateTo('discover')}>
                <Compass size={14} />
                <span>探索今日音乐</span>
              </button>
              <button className="stage-action-pill" onClick={() => navigateTo('liked')}>
                <Heart size={13} />
                <span>我的喜欢 ({likedSongIds?.size || 0})</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* ================= RIGHT: COMPACT OBSIDIAN HUB ================= */}
      <div className="home-right-hub">
        {/* Section 1: Quick Navigation Pills */}
        <div className="quick-nav-pills">
          <button className="nav-pill-btn" onClick={() => navigateTo('discover')}>
            <Compass size={15} className="nav-pill-icon" />
            <span>发现音乐</span>
          </button>
          <button className="nav-pill-btn" onClick={() => navigateTo('liked')}>
            <Heart size={15} className="nav-pill-icon" />
            <span>我的喜欢 ({likedSongIds?.size || 0})</span>
          </button>
          <button className="nav-pill-btn" onClick={() => navigateTo('local')}>
            <HardDrive size={15} className="nav-pill-icon" />
            <span>本地曲库</span>
          </button>
          <button className="nav-pill-btn" onClick={() => navigateTo('leaderboards')}>
            <TrendingUp size={15} className="nav-pill-icon" />
            <span>排行榜单</span>
          </button>
          <button className="nav-pill-btn" onClick={() => navigateTo('listen-together')}>
            <Radio size={15} className="nav-pill-icon" />
            <span>一起听</span>
          </button>
          <button className="nav-pill-btn" onClick={() => navigateTo('settings')}>
            <Settings size={15} className="nav-pill-icon" />
            <span>设置</span>
          </button>
        </div>

        {/* Section 2: Compact Recent Songs Stream */}
        <div className="compact-recent-stream">
          <div className="compact-stream-head">
            <div className="compact-stream-title">
              <History size={16} />
              <span>继续聆听 / 最近播放</span>
            </div>
            <span className="compact-stream-tag">{recentlyPlayed?.length || 0} 首足迹</span>
          </div>

          <div className="compact-song-list">
            {recentSongs && recentSongs.length > 0 ? (
              recentSongs.map(song => (
                <CompactRecentSongItem
                  key={song.id}
                  song={song}
                  onPlay={playSong}
                  onNavigateArtist={(artistId) => navigateTo('artist-detail', { id: artistId })}
                />
              ))
            ) : (
              <div style={{ padding: '24px 0', textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: '13px' }}>
                暂无最近播放记录，快去探索好歌吧
              </div>
            )}
          </div>
        </div>

        {/* Section 3: Compact Playlists Grid */}
        <div className="compact-playlists-section">
          <div className="compact-stream-head" style={{ marginBottom: 0 }}>
            <div className="compact-stream-title">
              <ListMusic size={16} />
              <span>我的歌单 / 收藏精选</span>
            </div>
            <span className="compact-stream-tag">{userPlaylists?.length || 0} 个歌单</span>
          </div>

          <div className="compact-playlists-grid">
            {compactPlaylists && compactPlaylists.length > 0 ? (
              compactPlaylists.map(playlist => (
                <div
                  key={playlist.id}
                  className="compact-playlist-card"
                  onClick={() => navigateTo('playlist-detail', { id: playlist.id })}
                >
                  <img
                    src={playlist.coverImgUrl || 'https://p2.music.126.net/UeTuwE7Cx877Y2gCGIseYg==/109951163026279185.jpg'}
                    alt={playlist.name || 'cover'}
                    className="compact-playlist-cover"
                    loading="lazy"
                  />
                  <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <div className="compact-playlist-name" title={playlist.name}>{playlist.name}</div>
                    <div className="compact-playlist-count">{playlist.trackCount || 0} 首歌曲</div>
                  </div>
                </div>
              ))
            ) : (
              <div
                className="compact-playlist-card"
                style={{ gridColumn: 'span 4', textAlign: 'center', padding: '18px 0', color: 'rgba(255,255,255,0.4)', fontSize: '13px' }}
                onClick={() => navigateTo('discover')}
              >
                暂无自建歌单，点击前往探索推荐歌单 →
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
