import React, { useEffect, useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import {
  Compass, TrendingUp, Heart, History, Settings, Play, Pause, Music,
  Radio, HardDrive, Sparkles, Sun, Moon, Sunrise, Sunset, Search, Disc,
  Flame, ListMusic, ChevronRight
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

function GlassTile({ song }) {
  const { playSong, navigateTo, resolveSongCover } = useApp();
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
    <div className="home-glass-tile" onClick={() => playSong(song)}>
      <div className="tile-cover-wrapper">
        <ResilientCover src={coverUrl} alt={song.name || 'cover'} className="tile-cover" />
        <button className="tile-play-btn" aria-label="播放">
          <Play size={18} fill="currentColor" />
        </button>
      </div>
      <div className="tile-info">
        <div className="tile-name" title={song.name}>{song.name}</div>
        <div
          className="tile-artist"
          title={primaryArtist?.name || '未知艺术家'}
          onClick={(e) => {
            e.stopPropagation();
            if (primaryArtist?.id) navigateTo('artist-detail', { id: primaryArtist.id });
          }}
          style={{ cursor: primaryArtist?.id ? 'pointer' : 'default' }}
        >
          {primaryArtist?.name || '未知艺术家'}
        </div>
      </div>
    </div>
  );
}

function GlassPlaylistTile({ playlist }) {
  const { navigateTo } = useApp();
  const coverUrl = playlist?.coverImgUrl || 'https://p2.music.126.net/UeTuwE7Cx877Y2gCGIseYg==/109951163026279185.jpg';
  
  return (
    <div className="home-glass-tile" onClick={() => navigateTo('playlist-detail', { id: playlist.id })}>
      <div className="tile-cover-wrapper">
        <img src={coverUrl} alt={playlist.name || 'cover'} className="tile-cover" loading="lazy" />
        <button className="tile-play-btn" aria-label="查看歌单">
          <ListMusic size={18} />
        </button>
      </div>
      <div className="tile-info">
        <div className="tile-name" title={playlist.name}>{playlist.name}</div>
        <div className="tile-artist">{playlist.trackCount || 0} 首歌曲</div>
      </div>
    </div>
  );
}

export default function ModernHome() {
  const {
    currentSong, isPlaying, togglePlay, navigateTo, recentlyPlayed,
    audioElement, userPlaylists, advancedLyricConfig, likedSongIds,
    user, playSong
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

  return (
    <div className="view-container modern-home">
      {/* Liquid Glass Hero Section */}
      <div className="glass-hero">
        <div className="hero-ambient-glow" />
        <div className="home-hero-inner" style={{ display: 'flex', alignItems: 'center', gap: '36px' }}>
          {currentSong ? (
            // 正在播放/有歌曲时的封面展示
            <div className="hero-cover-container" style={{ flexShrink: 0, position: 'relative' }}>
              <CachedCover
                song={currentSong}
                alt="cover"
                className="hero-cover-img"
              />
              {coverUrl && (
                <div 
                  className="hero-cover-glow" 
                  style={{ backgroundImage: `url(${coverUrl})` }} 
                />
              )}
              <div className="hero-cover-badge">
                <span className="playing-dot" />
                <span>{isPlaying ? '正在播放' : '已暂停'}</span>
              </div>
            </div>
          ) : (
            // 未播放时的精美徽标图形
            <div className="hero-cover-container" style={{ flexShrink: 0, position: 'relative' }}>
              <div
                className="hero-cover-img"
                style={{
                  background: 'linear-gradient(135deg, rgba(255, 51, 102, 0.22) 0%, rgba(99, 102, 241, 0.28) 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backdropFilter: 'blur(20px)'
                }}
              >
                <GreetingIcon size={64} style={{ color: 'rgba(255, 255, 255, 0.85)', filter: 'drop-shadow(0 8px 16px rgba(0,0,0,0.3))' }} />
              </div>
              <div
                className="hero-cover-glow"
                style={{
                  background: 'linear-gradient(135deg, #ff3366, #6366f1)',
                  opacity: 0.45
                }}
              />
            </div>
          )}
          
          <div className="hero-info" style={{ flex: 1, minWidth: 0 }}>
            {currentSong ? (
              <>
                <div className="home-kicker">
                  <Disc size={13} />
                  <span>NOW PLAYING · ICHIGOMUSIC</span>
                </div>
                <div className="home-title" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {currentSong.name}
                </div>
                <div className="home-sub" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  <span
                    className="artist-link"
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
                
                {activeLyric ? (
                  <div className="hero-lyric-pill">
                    <div className="lyric-wave-bars">
                      <span />
                      <span />
                      <span />
                      <span />
                    </div>
                    <span className="hero-lyric-text">{activeLyric}</span>
                  </div>
                ) : (
                  <div style={{ height: '38px', marginBottom: '18px' }} />
                )}

                <div className="home-quick-row">
                  <button className="home-chip home-accent-chip" onClick={togglePlay}>
                    {isPlaying ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
                    <span>{isPlaying ? '暂停播放' : '继续播放'}</span>
                  </button>
                  <button className="home-chip" onClick={openSearch}>
                    <Search size={15} />
                    <span>搜索音乐</span>
                  </button>
                  <button className="home-chip" onClick={() => navigateTo('discover')}>
                    <Sparkles size={15} />
                    <span>发现更多</span>
                  </button>
                </div>
              </>
            ) : (
              // 未播放状态：个性化时间问候
              <>
                <div className="home-kicker">
                  <GreetingIcon size={13} />
                  <span>{greeting.en} · ICHIGOMUSIC</span>
                </div>
                <div className="home-title">
                  {user?.nickname ? `${greeting.period}，${user.nickname}` : `${greeting.period}，音乐人`}
                </div>
                <div className="home-sub" style={{ fontSize: '16px', lineHeight: '1.5' }}>
                  {greeting.title}。{greeting.sub}
                </div>

                <div className="home-quick-row" style={{ marginTop: '22px' }}>
                  <button className="home-chip home-accent-chip" onClick={() => navigateTo('discover')}>
                    <Compass size={16} />
                    <span>探索今日音乐</span>
                  </button>
                  <button className="home-chip" onClick={() => navigateTo('liked')}>
                    <Heart size={16} />
                    <span>我的喜欢 ({likedSongIds?.size || 0})</span>
                  </button>
                  <button className="home-chip" onClick={openSearch}>
                    <Search size={16} />
                    <span>搜索歌曲</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Bento Grid Navigation System */}
      <div className="home-bento-grid">
        {/* 大主卡：发现音乐 */}
        <div className="bento-card bento-discover" onClick={() => navigateTo('discover')}>
          <div className="bento-top">
            <div>
              <div className="bento-label">DISCOVER</div>
              <div className="bento-title">探索音乐天地</div>
              <div className="bento-sub">每日推荐、新歌首发与专属雷达专题</div>
              <div className="bento-badge">
                <Sparkles size={12} />
                <span>发现新旋律</span>
              </div>
            </div>
          </div>
          <div className="bento-art">
            <Compass size={56} />
          </div>
        </div>

        {/* 中卡：我喜欢的音乐 */}
        <div className="bento-card bento-liked" onClick={() => navigateTo('liked')}>
          <div className="bento-top">
            <div>
              <div className="bento-label">FAVORITES</div>
              <div className="bento-title">我喜欢的音乐</div>
              <div className="bento-sub">你的私人专属红心珍藏</div>
              <div className="bento-badge">
                <Heart size={12} fill="currentColor" />
                <span>{likedSongIds?.size || 0} 首珍藏</span>
              </div>
            </div>
          </div>
          <div className="bento-art">
            <Heart size={48} />
          </div>
        </div>

        {/* 中卡：本地音乐 */}
        <div className="bento-card bento-local" onClick={() => navigateTo('local')}>
          <div className="bento-top">
            <div>
              <div className="bento-label">LOCAL MUSIC</div>
              <div className="bento-title">本地音乐</div>
              <div className="bento-sub">高保真无损曲库与扫描</div>
              <div className="bento-badge">
                <HardDrive size={12} />
                <span>Hi-Res 无损</span>
              </div>
            </div>
          </div>
          <div className="bento-art">
            <HardDrive size={44} />
          </div>
        </div>

        {/* 中卡：排行榜 */}
        <div className="bento-card bento-leaderboard" onClick={() => navigateTo('leaderboards')}>
          <div className="bento-top">
            <div>
              <div className="bento-label">LEADERBOARDS</div>
              <div className="bento-title">排行榜单</div>
              <div className="bento-sub">飙升榜、热歌榜与风向标</div>
              <div className="bento-badge">
                <Flame size={12} />
                <span>实时热度</span>
              </div>
            </div>
          </div>
          <div className="bento-art">
            <TrendingUp size={44} />
          </div>
        </div>

        {/* 中卡：最近播放 */}
        <div className="bento-card bento-recent" onClick={() => navigateTo('recent')}>
          <div className="bento-top">
            <div>
              <div className="bento-label">TIMELINE</div>
              <div className="bento-title">最近播放</div>
              <div className="bento-sub">时光留声机，重温足迹</div>
              <div className="bento-badge">
                <History size={12} />
                <span>{recentlyPlayed?.length || 0} 首记录</span>
              </div>
            </div>
          </div>
          <div className="bento-art">
            <History size={44} />
          </div>
        </div>

        {/* 小卡：一起听 */}
        <div className="bento-card bento-listen" onClick={() => navigateTo('listen-together')}>
          <div className="bento-top">
            <div>
              <div className="bento-label">LISTEN TOGETHER</div>
              <div className="bento-title">一起听</div>
              <div className="bento-sub">创建房间，和好友天涯共听同一首歌</div>
              <div className="bento-badge">
                <Radio size={12} />
                <span>双人实时同步</span>
              </div>
            </div>
          </div>
          <div className="bento-art">
            <Radio size={40} />
          </div>
        </div>

        {/* 小卡：设置（置于最后） */}
        <div className="bento-card bento-settings" onClick={() => navigateTo('settings')}>
          <div className="bento-top">
            <div>
              <div className="bento-label">PREFERENCES</div>
              <div className="bento-title">应用设置</div>
              <div className="bento-sub">音频输出、快捷键、外观与歌词偏好</div>
              <div className="bento-badge">
                <Settings size={12} />
                <span>系统偏好</span>
              </div>
            </div>
          </div>
          <div className="bento-art">
            <Settings size={40} />
          </div>
        </div>
      </div>

      {/* Content Rails: 最近播放 */}
      {recentlyPlayed && recentlyPlayed.length > 0 && (
        <div className="home-rail">
          <div className="home-section-head">
            <div className="home-section-title">
              <span>最近播放</span>
              <span className="home-section-tag">{recentlyPlayed.length} 首</span>
            </div>
          </div>
          <div className="home-tile-row">
            {recentlyPlayed.slice(0, 8).map(song => (
              <GlassTile key={song.id} song={song} />
            ))}
          </div>
        </div>
      )}

      {/* Content Rails: 我的歌单 */}
      {userPlaylists && userPlaylists.length > 0 && (
        <div className="home-rail" style={{ marginTop: '12px' }}>
          <div className="home-section-head">
            <div className="home-section-title">
              <span>我的歌单</span>
              <span className="home-section-tag">{userPlaylists.length} 个歌单</span>
            </div>
          </div>
          <div className="home-tile-row">
            {userPlaylists.map(playlist => (
              <GlassPlaylistTile key={playlist.id} playlist={playlist} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
