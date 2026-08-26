import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useApp, APP_VERSION } from '../context/AppContext';
import { api } from '../utils/api';
import Login from './Login';
import ShortcutRow from '../components/ShortcutRow';
import { DEFAULT_PROFILE, EQ_PRESETS, EQ_PRESET_NAMES, EQ_BAND_LABELS, EQ_BAND_FREQUENCIES, exportProfile, importProfile, resetProfile } from '../utils/settingsProfile';
import {
  Airplay, CheckCircle, Command, Copy, FileText, HardDrive, Image, Menu,
  Monitor, Music4, Palette, Power, Sliders, Trash2, UserCheck, Sparkles,
  Volume2, Eye, RefreshCw, Layers, ShieldCheck, Zap, Download, Activity
} from 'lucide-react';
import LyricExportModal from '../components/LyricExportModal';
import EqualizerPanel from '../components/EqualizerPanel';
import { IMMERSIVE_MODE_OPTIONS, IMMERSIVE_MODE_PARAMETER_KEYS, normalizeImmersiveMode, KTV_TEMPLATE_GALLERY } from '../utils/immersiveModes';
import { IMMERSIVE_PRESETS, IMMERSIVE_PRESET_MAP } from '../utils/immersivePresets';
import { clearRuntimeLogs, formatRuntimeLogs, getRuntimeLogs, subscribeRuntimeLogs } from '../utils/runtimeLog';

const T = {
  title: '系统设置与偏好',
  themeTab: '界面与外观',
  desktopTab: '桌面歌词',
  immersiveTab: '沉浸歌词',
  audioTab: '音频与音效',
  cacheTab: '存储与缓存',
  shortcutsTab: '快捷键',
  navbarTab: '侧边导航',
  logsTab: '运行日志',
  accountTab: '账号中心',
};

const themeOptions = [
  { id: 'strawberry', name: '草莓红', color: '#ff3366' },
  { id: 'sakura', name: '樱花粉', color: '#ff66b2' },
  { id: 'matcha', name: '抹茶绿', color: '#4caf50' },
  { id: 'ocean', name: '海洋蓝', color: '#00b0ff' },
  { id: 'purple', name: '赛博紫', color: '#ab47bc' },
  { id: 'dark', name: '极客灰', color: '#9e9e9e' },
  { id: 'custom', name: '自定义', color: 'conic-gradient(from 0deg, red, yellow, lime, aqua, blue, magenta, red)' }
];

const desktopColorPresets = {
  strawberry: { label: '草莓红', played: '#ff3366', unplayed: '#ffffff', stroke: '#4a0e1c' },
  aurora: { label: '极光绿', played: '#00e676', unplayed: '#e0f7fa', stroke: '#003300' },
  ocean: { label: '海洋蓝', played: '#00b0ff', unplayed: '#e1f5fe', stroke: '#0d47a1' },
  purple: { label: '紫罗兰', played: '#ab47bc', unplayed: '#f3e5f5', stroke: '#310d3f' },
  gold: { label: '黑金', played: '#ffb300', unplayed: '#fffde7', stroke: '#3e2723' },
  sakura: { label: '樱花粉', played: '#ff66b2', unplayed: '#fff0f5', stroke: '#4d0026' },
  dark: { label: '极客暗灰', played: '#e0e0e0', unplayed: '#757575', stroke: '#1a1a1a' },
  custom: { label: '自定义配色' }
};

const shortcutLabels = [
  ['playPause', '播放 / 暂停', '切换当前歌曲播放状态'],
  ['nextTrack', '下一首', '跳到播放队列下一首'],
  ['prevTrack', '上一首', '跳到播放队列上一首'],
  ['volumeUp', '音量增加', '每次增加 5%'],
  ['volumeDown', '音量降低', '每次降低 5%'],
  ['toggleMute', '静音切换', '静音或恢复默认音量'],
  ['toggleLyrics', '沉浸歌词', '打开 / 关闭全屏歌词'],
  ['toggleDesktopLyrics', '桌面歌词', '打开 / 关闭悬浮歌词窗口'],
  ['seekForward', '快进 5 秒', '向前步进播放进度'],
  ['seekBack', '快退 5 秒', '向后回退播放进度']
];

function SettingRow({ label, hint, children }) {
  return (
    <div className="settings-field">
      <div className="settings-field-label">
        <strong>{label}</strong>
        {hint && <span>{hint}</span>}
      </div>
      <div className="settings-field-control">{children}</div>
    </div>
  );
}

function SmoothSwitch({ checked, onChange, disabled = false }) {
  return (
    <div
      className={`smooth-switch ${checked ? 'checked' : ''} ${disabled ? 'disabled' : ''}`}
      onClick={() => !disabled && onChange(!checked)}
      role="switch"
      aria-checked={checked}
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); !disabled && onChange(!checked); } }}
    >
      <div className="smooth-switch-thumb" />
    </div>
  );
}

function Segment({ options, value, onChange }) {
  return (
    <div className="segmented-control">
      {options.map((item) => {
        const optionValue = typeof item === 'object' ? item.value : item;
        const label = typeof item === 'object' ? item.label : item;
        return (
          <button
            key={String(optionValue)}
            type="button"
            className={value === optionValue ? 'active' : ''}
            onClick={() => onChange(optionValue)}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

/* ==========================================================================
   WYSIWYG DESKTOP LYRICS SANDBOX
   ========================================================================== */
function DesktopLyricsSandbox({ config }) {
  const [sweepProgress, setSweepProgress] = useState(0);
  const preset = desktopColorPresets[config.colorPreset || 'strawberry'] || desktopColorPresets.strawberry;
  const playedColor = config.colorPreset === 'custom' ? (config.playedColor || '#ff3366') : preset.played;
  const unplayedColor = config.colorPreset === 'custom' ? (config.unplayedColor || '#ffffff') : preset.unplayed;
  const strokeColor = config.colorPreset === 'custom' ? (config.textStroke?.color || '#000000') : (config.textStroke?.color || preset.stroke);
  const isStroke = config.textStroke?.enabled !== false;
  const strokeWidth = config.textStroke?.width ?? 0.6;
  const stroke = isStroke ? `${strokeWidth}px ${strokeColor}` : 'none';
  const shadow = config.textShadow?.enabled === false ? 'none' : `${config.textShadow?.offsetX || 0}px ${config.textShadow?.offsetY || 2}px ${config.textShadow?.blur ?? 12}px ${config.textShadow?.color || '#000000cc'}`;
  const glow = config.glow?.enabled ? `, 0 0 ${Math.round((config.glow?.intensity ?? 0.6) * 28)}px ${playedColor}aa` : '';
  const fontSize = Math.min(42, Math.max(18, config.fontSize || 36));
  const translationSize = Math.min(26, Math.max(12, config.translationSize || 20));
  const fontWeight = config.fontWeight || 700;
  const fontFamily = config.fontFamily || 'Inter';

  // Mock preview loop
  useEffect(() => {
    let raf;
    let start = performance.now();
    const loop = (now) => {
      const elapsed = (now - start) % 4000;
      const p = Math.min(1, elapsed / 2800);
      setSweepProgress(p);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const sampleText = "沉醉在旋律里，每一刻都心动";
  const sampleTrans = "Drunk in the melody, touched every moment";
  const clipPct = Math.round((1 - sweepProgress) * 100);

  return (
    <div className="desktop-lyrics-sandbox">
      <div className="sandbox-glow-bg" />
      <div style={{ position: 'relative', zIndex: 2, textAlign: config.alignment || 'center', width: '100%', padding: '0 20px' }}>
        <div
          style={{
            position: 'relative',
            display: 'inline-block',
            fontSize: `${fontSize}px`,
            fontWeight: fontWeight,
            fontFamily: `"${fontFamily}", "Microsoft YaHei", sans-serif`,
            whiteSpace: 'nowrap',
            color: unplayedColor,
            textShadow: `${shadow}${glow}`,
            WebkitTextStroke: stroke
          }}
        >
          {/* Base Unplayed */}
          <span style={{ opacity: 0.65 }}>{sampleText}</span>
          {/* Sweeping Foreground */}
          <span
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              color: playedColor,
              clipPath: `inset(0 ${clipPct}% 0 0)`,
              WebkitClipPath: `inset(0 ${clipPct}% 0 0)`
            }}
          >
            {sampleText}
          </span>
        </div>

        {config.showTranslation !== false && (
          <div
            style={{
              fontSize: `${translationSize}px`,
              fontWeight: Math.max(400, fontWeight - 100),
              fontFamily: `"${fontFamily}", "Microsoft YaHei", sans-serif`,
              color: playedColor,
              marginTop: '6px',
              opacity: 0.9,
              textShadow: `${shadow}${glow}`,
              WebkitTextStroke: stroke
            }}
          >
            {sampleTrans}
          </div>
        )}
      </div>
    </div>
  );
}

/* ==========================================================================
   STORAGE VISUALIZER BREAKDOWN COMPONENT
   ========================================================================== */
function StorageVisualizer({ stats, onClear, onSelectDir }) {
  const total = stats?.size || 0;
  const audio = stats?.audioSize || 0;
  const lyrics = stats?.lyricsSize || 0;
  const covers = stats?.coversSize || 0;

  const audioPct = total > 0 ? (audio / total) * 100 : 0;
  const lyricsPct = total > 0 ? (lyrics / total) * 100 : 0;
  const coversPct = total > 0 ? (covers / total) * 100 : 0;

  const formatBytes = (bytes = 0) => {
    if (bytes >= 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
    if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${bytes} B`;
  };

  return (
    <div className="storage-visual-wrapper">
      {/* Multi-segment progress track */}
      <div className="storage-bar-track">
        <div className="storage-segment-audio" style={{ width: `${Math.max(total > 0 ? 3 : 0, audioPct)}%` }} title={`音频文件: ${formatBytes(audio)}`} />
        <div className="storage-segment-lyrics" style={{ width: `${Math.max(total > 0 ? 2 : 0, lyricsPct)}%` }} title={`歌词缓存: ${formatBytes(lyrics)}`} />
        <div className="storage-segment-cover" style={{ width: `${Math.max(total > 0 ? 2 : 0, coversPct)}%` }} title={`封面图片: ${formatBytes(covers)}`} />
      </div>

      {/* Discrete 3-card stats */}
      <div className="storage-cards-grid">
        <div className="storage-card">
          <div className="storage-card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className="storage-card-dot" style={{ background: '#3b82f6' }} />
              <span>音频缓存</span>
            </div>
            <button className="setting-btn danger ghost" style={{ padding: '2px 8px', fontSize: 11 }} onClick={() => onClear('audio')}>清理</button>
          </div>
          <div className="storage-card-val">{formatBytes(audio)}</div>
        </div>

        <div className="storage-card">
          <div className="storage-card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className="storage-card-dot" style={{ background: '#10b981' }} />
              <span>逐字歌词</span>
            </div>
            <button className="setting-btn danger ghost" style={{ padding: '2px 8px', fontSize: 11 }} onClick={() => onClear('lyrics')}>清理</button>
          </div>
          <div className="storage-card-val">{formatBytes(lyrics)}</div>
        </div>

        <div className="storage-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className="storage-card-dot" style={{ background: '#f59e0b' }} />
              <span>封面图库</span>
            </div>
            <button className="setting-btn danger ghost" style={{ padding: '2px 8px', fontSize: 11 }} onClick={() => onClear('covers')}>清理</button>
          </div>
          <div className="storage-card-val">{formatBytes(covers)}</div>
        </div>
      </div>
    </div>
  );
}

/* ==========================================================================
   MAIN SETTINGS COMPONENT
   ========================================================================== */
export default function Settings() {
  const {
    user, logout, profile, theme, setTheme, colorMode, setColorMode,
    layoutMode, setLayoutMode, customThemeColors, saveCustomThemeColors,
    navbarConfig, saveNavbarConfig, advancedLyricConfig, saveAdvancedLyricConfig,
    coverConfig, saveCoverConfig, desktopLyricsConfig, saveDesktopLyricsConfig,
    audioConfig, saveAudioConfig, cacheConfig, saveCacheConfig,
    renderingConfig, saveRenderingConfig, shortcuts, saveShortcuts,
    audioQuality, setAudioQuality, viewData, checkForUpdates,
    appearanceConfig, saveAppearanceConfig, currentSong,
    isEqualizerOpen, setIsEqualizerOpen
  } = useApp();

  const [activeTab, setActiveTab] = useState(() => viewData?.tab || (user ? 'theme' : 'account'));
  const [runtimeLogs, setRuntimeLogs] = useState(() => getRuntimeLogs());
  const [logCopyState, setLogCopyState] = useState('');
  const [checking, setChecking] = useState(false);
  const [cacheStats, setCacheStats] = useState(null);
  const [defaultCacheDir, setDefaultCacheDir] = useState('');
  const [customPrimary, setCustomPrimary] = useState(customThemeColors?.primary || '#ff4081');
  const [customBgStart, setCustomBgStart] = useState(customThemeColors?.bgStart || '#120c1f');
  const [customBgEnd, setCustomBgEnd] = useState(customThemeColors?.bgEnd || '#05020a');
  const [cookieInput, setCookieInput] = useState('');
  const customColorTimerRef = useRef(null);

  useEffect(() => {
    setCustomPrimary(customThemeColors?.primary || '#ff4081');
    setCustomBgStart(customThemeColors?.bgStart || '#120c1f');
    setCustomBgEnd(customThemeColors?.bgEnd || '#05020a');
  }, [customThemeColors]);

  const handleCustomPrimaryChange = (val) => {
    setCustomPrimary(val);
    document.body.style.setProperty('--custom-primary-color', val);
    document.body.style.setProperty('--custom-primary-color-glow', `${val}59`);
    clearTimeout(customColorTimerRef.current);
    customColorTimerRef.current = setTimeout(() => {
      saveCustomThemeColors({ primary: val });
    }, 80);
  };

  const handleCustomBgStartChange = (val) => {
    setCustomBgStart(val);
    document.body.style.setProperty('--custom-bg-start', val);
    clearTimeout(customColorTimerRef.current);
    customColorTimerRef.current = setTimeout(() => {
      saveCustomThemeColors({ bgStart: val });
    }, 80);
  };

  const handleCustomBgEndChange = (val) => {
    setCustomBgEnd(val);
    document.body.style.setProperty('--custom-bg-end', val);
    clearTimeout(customColorTimerRef.current);
    customColorTimerRef.current = setTimeout(() => {
      saveCustomThemeColors({ bgEnd: val });
    }, 80);
  };

  const [isLyricExportOpen, setIsLyricExportOpen] = useState(false);
  useEffect(() => {
    if (viewData?.tab) setActiveTab(viewData.tab);
  }, [viewData]);

  useEffect(() => subscribeRuntimeLogs(setRuntimeLogs), []);

  useEffect(() => {
    window.electronAPI?.getDefaultCacheDirectory?.().then(dir => {
      setDefaultCacheDir(dir || '');
    }).catch(() => {});
  }, []);

  const refreshCacheStats = async () => {
    const stats = await window.electronAPI?.getCacheStats?.({ cacheDir: cacheConfig?.directory || '' }).catch(() => null);
    if (stats) setCacheStats(stats);
  };

  useEffect(() => {
    if (activeTab === 'cache') refreshCacheStats();
  }, [activeTab, cacheConfig?.directory]);

  const updateDesktop = (patch) => saveDesktopLyricsConfig({ ...desktopLyricsConfig, ...patch });
  const updateImmersive = (patch) => saveAdvancedLyricConfig({ ...advancedLyricConfig, ...patch });
  const updateCover = (patch) => saveCoverConfig({ ...coverConfig, ...patch });
  const updateAudio = (patch) => saveAudioConfig({ ...audioConfig, ...patch });
  const updateCache = (patch) => saveCacheConfig({ ...(cacheConfig || DEFAULT_PROFILE.audio.cache), ...patch });

  const selectedImmersiveMode = IMMERSIVE_MODE_OPTIONS.find(item => item.value === normalizeImmersiveMode(advancedLyricConfig.lyricsMode)) || IMMERSIVE_MODE_OPTIONS[0];

  const tabs = [
    { key: 'theme', label: T.themeTab, icon: Palette, badge: 'tab-badge-theme' },
    { key: 'desktop', label: T.desktopTab, icon: Airplay, badge: 'tab-badge-desktop' },
    { key: 'immersive', label: T.immersiveTab, icon: Music4, badge: 'tab-badge-immersive' },
    { key: 'audio', label: T.audioTab, icon: Sliders, badge: 'tab-badge-audio' },
    { key: 'cache', label: T.cacheTab, icon: HardDrive, badge: 'tab-badge-cache' },
    { key: 'shortcuts', label: T.shortcutsTab, icon: Command, badge: 'tab-badge-shortcuts' },
    { key: 'navbar', label: T.navbarTab, icon: Menu, badge: 'tab-badge-navbar' },
    { key: 'logs', label: '运行日志', icon: FileText, badge: 'tab-badge-logs' },
    { key: 'account', label: T.accountTab, icon: UserCheck, badge: 'tab-badge-account' }
  ];

  const handleManualCheck = async () => {
    setChecking(true);
    await checkForUpdates(true);
    setChecking(false);
  };

  const handleSelectCacheDir = async () => {
    const dir = await window.electronAPI?.selectCacheDirectory?.();
    if (dir) updateCache({ directory: dir });
  };

  const handleClearSpecificCache = async (type) => {
    const label = type === 'audio' ? '音频' : type === 'lyrics' ? '歌词' : type === 'covers' ? '封面' : '全部';
    if (!window.confirm(`确认清空${label}缓存吗？`)) return;
    if (window.electronAPI?.clearSpecificCache) {
      await window.electronAPI.clearSpecificCache({ cacheDir: cacheConfig?.directory || '', type });
    } else {
      await window.electronAPI?.clearAppCache?.({ cacheDir: cacheConfig?.directory || '' });
    }
    refreshCacheStats();
  };

  const handleToggleGlobalShortcuts = (enabled) => {
    saveShortcuts({ ...shortcuts, globalEnabled: enabled });
    window.electronAPI?.setGlobalShortcutsEnabled?.(enabled);
  };

  /* ================= 1. TAB: 界面与外观 ================= */
  const renderThemeTab = () => (
    <div className="settings-stack">
      <div className="settings-section">
        <h3 className="settings-title"><Monitor size={18} />界面布局与外观</h3>
        <div className="settings-content">
          <SettingRow label="整体布局模式" hint="选择经典紧凑侧边栏布局或现代化晶透 Bento 布局">
            <Segment
              options={[
                { value: 'modern', label: '现代化 Bento 布局' },
                { value: 'classic', label: '经典侧栏布局' }
              ]}
              value={layoutMode}
              onChange={setLayoutMode}
            />
          </SettingRow>
          <SettingRow label="色彩外观模式" hint="深色沉浸、清爽浅色或智能跟随系统">
            <Segment
              options={[
                { value: 'dark', label: '深色' },
                { value: 'light', label: '浅色' },
                { value: 'system', label: '跟随系统' }
              ]}
              value={colorMode}
              onChange={setColorMode}
            />
          </SettingRow>
          <SettingRow label="界面材质质感" hint="选择晶透毛玻璃质感或纯色扁平卡片质感">
            <Segment
              options={[
                { value: 'glass', label: '晶透毛玻璃 (Glass)' },
                { value: 'flat', label: '纯色扁平 (Flat)' }
              ]}
              value={appearanceConfig?.surfaceStyle || 'glass'}
              onChange={(v) => saveAppearanceConfig({ surfaceStyle: v })}
            />
          </SettingRow>
          <SettingRow label="关闭窗口行为" hint="点击主窗口右上角关闭按钮时的默认处理方式">
            <Segment
              options={[
                { value: 'prompt', label: '弹出提示' },
                { value: 'hide', label: '最小化到托盘' },
                { value: 'close', label: '直接退出' }
              ]}
              value={profile.appearance?.closeBehavior || 'prompt'}
              onChange={(v) => saveAppearanceConfig({ closeBehavior: v })}
            />
          </SettingRow>
        </div>
      </div>

      <div className="settings-section">
        <h3 className="settings-title"><Palette size={18} />主题配色与色彩风格</h3>
        <div className="settings-content">
          <SettingRow label="预设强调色" hint="选择预设品牌色彩或开启自定义渐变色">
            <div className="color-row">
              {themeOptions.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  className="swatch"
                  style={{ background: opt.color, borderColor: theme === opt.id ? '#ffffff' : 'rgba(255,255,255,0.18)' }}
                  onClick={() => setTheme(opt.id)}
                  title={opt.name}
                />
              ))}
            </div>
          </SettingRow>

          {theme === 'custom' && (
            <div className="settings-grid-3" style={{ marginTop: 12 }}>
              <SettingRow label="主品牌强调色" hint={customPrimary}>
                <div className="color-picker-control">
                  <input type="color" value={customPrimary} onChange={(e) => handleCustomPrimaryChange(e.target.value)} />
                  <span className="color-code-badge">{customPrimary}</span>
                </div>
              </SettingRow>
              <SettingRow label="背景渐变起点" hint={customBgStart}>
                <div className="color-picker-control">
                  <input type="color" value={customBgStart} onChange={(e) => handleCustomBgStartChange(e.target.value)} />
                  <span className="color-code-badge">{customBgStart}</span>
                </div>
              </SettingRow>
              <SettingRow label="背景渐变终点" hint={customBgEnd}>
                <div className="color-picker-control">
                  <input type="color" value={customBgEnd} onChange={(e) => handleCustomBgEndChange(e.target.value)} />
                  <span className="color-code-badge">{customBgEnd}</span>
                </div>
              </SettingRow>
            </div>
          )}
        </div>
      </div>

      <div className="settings-section">
        <h3 className="settings-title"><CheckCircle size={18} />应用版本与更新</h3>
        <div className="settings-content">
          <SettingRow label="当前应用版本">
            <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--primary)' }}>{APP_VERSION}</span>
          </SettingRow>
          <SettingRow label="软件在线更新" hint="检查最新发布版本并一键升级">
            <button className={`setting-btn ${checking ? '' : 'active'}`} onClick={handleManualCheck} disabled={checking}>
              {checking ? '正在检查…' : '立即检查更新'}
            </button>
          </SettingRow>
        </div>
      </div>
    </div>
  );

  /* ================= 2. TAB: 桌面歌词 ================= */
  const renderDesktopTab = () => {
    const customPaletteQuickSets = [
      { name: '樱花蜜桃', played: '#ff66b2', unplayed: '#fff0f5', stroke: '#4a0e2a' },
      { name: '荧光冰蓝', played: '#00f0ff', unplayed: '#e0f7fa', stroke: '#003366' },
      { name: '极光薄荷', played: '#00e676', unplayed: '#e8f5e9', stroke: '#003300' },
      { name: '曜石金灿', played: '#ffd600', unplayed: '#fffde7', stroke: '#3e2723' },
      { name: '赛博电紫', played: '#d500f9', unplayed: '#f3e5f5', stroke: '#2e003e' },
      { name: '烈焰暖橙', played: '#ff6d00', unplayed: '#fff3e0', stroke: '#4e1a00' },
      { name: '晶莹纯白', played: '#ffffff', unplayed: '#a0a5b5', stroke: '#1a1c23' }
    ];

    return (
      <div className="settings-stack">
        {/* WYSIWYG Live Preview Sandbox */}
        <DesktopLyricsSandbox config={desktopLyricsConfig} />

        <div className="settings-section">
          <h3 className="settings-title"><Airplay size={18} />桌面悬浮窗控制</h3>
          <div className="settings-content">
            <SettingRow label="桌面歌词开关" hint="在桌面任意位置显示透明悬浮歌词">
              <button className={`setting-btn ${desktopLyricsConfig.show ? 'active' : ''}`} onClick={() => { window.electronAPI?.toggleDesktopLyrics?.(); updateDesktop({ show: !desktopLyricsConfig.show }); }}>
                {desktopLyricsConfig.show ? '已开启（点击关闭）' : '立即开启'}
              </button>
            </SettingRow>
            <SettingRow label="锁定歌词窗口" hint="锁定后鼠标完全穿透至下层窗口或游戏，不影响游戏操作">
              <SmoothSwitch checked={desktopLyricsConfig.locked} onChange={(v) => updateDesktop({ locked: v })} />
            </SettingRow>
            <SettingRow label="始终置顶 (Screen-Saver 级)" hint="覆盖在无边框全屏游戏与窗口最前端">
              <SmoothSwitch checked={desktopLyricsConfig.alwaysOnTop !== false} onChange={(v) => updateDesktop({ alwaysOnTop: v })} />
            </SettingRow>
            <SettingRow label={`窗口透明度：${Math.round((desktopLyricsConfig.opacity ?? 1) * 100)}%`}>
              <input className="setting-slider" type="range" min="0.2" max="1.0" step="0.05" value={desktopLyricsConfig.opacity ?? 1} onChange={(e) => updateDesktop({ opacity: Number(e.target.value) })} />
            </SettingRow>
          </div>
        </div>

        <div className="settings-section">
          <h3 className="settings-title"><Palette size={18} />色彩与发光特效</h3>
          <div className="settings-content">
            <SettingRow label="配色方案预设" hint="选择经典预设色彩或切换为完全自定义配色">
              <select className="setting-select" value={desktopLyricsConfig.colorPreset || 'strawberry'} onChange={(e) => updateDesktop({ colorPreset: e.target.value })}>
                {Object.entries(desktopColorPresets).map(([key, item]) => (
                  <option key={key} value={key}>{item.label}</option>
                ))}
              </select>
            </SettingRow>

            {desktopLyricsConfig.colorPreset === 'custom' && (
              <div className="custom-color-panel" style={{ marginTop: 12, padding: '16px', borderRadius: '16px', background: 'var(--card-bg, rgba(255,255,255,0.04))', border: '1px solid var(--card-border, rgba(255,255,255,0.08))' }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main, #ffffff)', marginBottom: 10 }}>自定义歌词色彩搭配</div>
                <div className="settings-grid-3">
                  <SettingRow label="已播放高亮颜色" hint={desktopLyricsConfig.playedColor || '#ff3366'}>
                    <div className="color-picker-control">
                      <input
                        type="color"
                        value={desktopLyricsConfig.playedColor || '#ff3366'}
                        onChange={(e) => updateDesktop({ playedColor: e.target.value })}
                      />
                      <span className="color-code-badge">{desktopLyricsConfig.playedColor || '#ff3366'}</span>
                    </div>
                  </SettingRow>
                  <SettingRow label="未播放底色" hint={desktopLyricsConfig.unplayedColor || '#ffffff'}>
                    <div className="color-picker-control">
                      <input
                        type="color"
                        value={desktopLyricsConfig.unplayedColor || '#ffffff'}
                        onChange={(e) => updateDesktop({ unplayedColor: e.target.value })}
                      />
                      <span className="color-code-badge">{desktopLyricsConfig.unplayedColor || '#ffffff'}</span>
                    </div>
                  </SettingRow>
                  <SettingRow label="文字描边颜色" hint={desktopLyricsConfig.textStroke?.color || '#000000'}>
                    <div className="color-picker-control">
                      <input
                        type="color"
                        value={desktopLyricsConfig.textStroke?.color || '#000000'}
                        onChange={(e) => updateDesktop({ textStroke: { ...desktopLyricsConfig.textStroke, color: e.target.value } })}
                      />
                      <span className="color-code-badge">{desktopLyricsConfig.textStroke?.color || '#000000'}</span>
                    </div>
                  </SettingRow>
                </div>
                <div style={{ marginTop: 12 }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted, #9ca3af)', display: 'block', marginBottom: 8 }}>快速套用色彩模版：</span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {customPaletteQuickSets.map((ps) => (
                      <button
                        key={ps.name}
                        type="button"
                        className="setting-btn compact"
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', padding: '4px 10px' }}
                        onClick={() => updateDesktop({
                          playedColor: ps.played,
                          unplayedColor: ps.unplayed,
                          textStroke: { ...desktopLyricsConfig.textStroke, color: ps.stroke }
                        })}
                      >
                        <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: ps.played }} />
                        <span>{ps.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <SettingRow label="文字发光辉光" hint="开启柔和霓虹文字光效">
              <SmoothSwitch checked={desktopLyricsConfig.glow?.enabled === true} onChange={(v) => updateDesktop({ glow: { ...desktopLyricsConfig.glow, enabled: v } })} />
            </SettingRow>
            {desktopLyricsConfig.glow?.enabled && (
              <SettingRow label={`辉光光晕强度：${Math.round((desktopLyricsConfig.glow?.intensity ?? 0.6) * 100)}%`} hint="调节歌词边缘发光的扩散范围与光感厚度">
                <input
                  className="setting-slider"
                  type="range"
                  min="0.1"
                  max="1.0"
                  step="0.05"
                  value={desktopLyricsConfig.glow?.intensity ?? 0.6}
                  onChange={(e) => updateDesktop({ glow: { ...desktopLyricsConfig.glow, intensity: Number(e.target.value) } })}
                />
              </SettingRow>
            )}

            <SettingRow label="文字深色描边" hint="提高在浅色或复杂壁纸下的可读性">
              <SmoothSwitch checked={desktopLyricsConfig.textStroke?.enabled !== false} onChange={(v) => updateDesktop({ textStroke: { ...desktopLyricsConfig.textStroke, enabled: v } })} />
            </SettingRow>
            {desktopLyricsConfig.textStroke?.enabled !== false && (
              <>
                <SettingRow label={`描边粗细：${(desktopLyricsConfig.textStroke?.width ?? 0.6).toFixed(1)}px`} hint="调节歌词文字外轮廓描边线条宽度">
                  <input
                    className="setting-slider"
                    type="range"
                    min="0.2"
                    max="3.0"
                    step="0.1"
                    value={desktopLyricsConfig.textStroke?.width ?? 0.6}
                    onChange={(e) => updateDesktop({ textStroke: { ...desktopLyricsConfig.textStroke, width: Number(e.target.value) } })}
                  />
                </SettingRow>
                {desktopLyricsConfig.colorPreset !== 'custom' && (
                  <SettingRow label="描边自定义色彩" hint={desktopLyricsConfig.textStroke?.color || '默认预设色'}>
                    <div className="color-picker-control">
                      <input
                        type="color"
                        value={desktopLyricsConfig.textStroke?.color || '#000000'}
                        onChange={(e) => updateDesktop({ textStroke: { ...desktopLyricsConfig.textStroke, color: e.target.value } })}
                      />
                      <span className="color-code-badge">{desktopLyricsConfig.textStroke?.color || '#000000'}</span>
                    </div>
                  </SettingRow>
                )}
              </>
            )}

            <SettingRow label="文字立体阴影" hint="为歌词文字投射柔和立体阴影">
              <SmoothSwitch
                checked={desktopLyricsConfig.textShadow?.enabled !== false}
                onChange={(v) => updateDesktop({ textShadow: { ...desktopLyricsConfig.textShadow, enabled: v } })}
              />
            </SettingRow>
            {desktopLyricsConfig.textShadow?.enabled !== false && (
              <SettingRow label={`阴影模糊半径：${desktopLyricsConfig.textShadow?.blur ?? 12}px`}>
                <input
                  className="setting-slider"
                  type="range"
                  min="0"
                  max="24"
                  step="1"
                  value={desktopLyricsConfig.textShadow?.blur ?? 12}
                  onChange={(e) => updateDesktop({ textShadow: { ...desktopLyricsConfig.textShadow, blur: Number(e.target.value) } })}
                />
              </SettingRow>
            )}
          </div>
        </div>

        <div className="settings-section">
          <h3 className="settings-title"><Eye size={18} />排版、字号与对齐</h3>
          <div className="settings-content">
            <SettingRow label="字体选择">
              <select className="setting-select" value={desktopLyricsConfig.fontFamily || 'Inter'} onChange={(e) => updateDesktop({ fontFamily: e.target.value })}>
                <option value="Inter">Inter (现代无衬线)</option>
                <option value="Outfit">Outfit (圆润几何)</option>
                <option value="Microsoft YaHei">微软雅黑</option>
                <option value="Noto Sans SC">思源黑体</option>
                <option value="Noto Serif SC">思源宋体</option>
                <option value="KaiTi">楷体</option>
                <option value="LXGW WenKai">霞鹜文楷</option>
              </select>
            </SettingRow>
            <SettingRow label={`主歌词字号：${desktopLyricsConfig.fontSize || 36}px`}>
              <input className="setting-slider" type="range" min="18" max="64" step="2" value={desktopLyricsConfig.fontSize || 36} onChange={(e) => updateDesktop({ fontSize: Number(e.target.value) })} />
            </SettingRow>
            <SettingRow label={`翻译歌词字号：${desktopLyricsConfig.translationSize || 20}px`}>
              <input className="setting-slider" type="range" min="12" max="36" step="2" value={desktopLyricsConfig.translationSize || 20} onChange={(e) => updateDesktop({ translationSize: Number(e.target.value) })} />
            </SettingRow>
            <SettingRow label="字体粗细 (字重)">
              <Segment
                options={[
                  { value: 400, label: '常规 (400)' },
                  { value: 600, label: '中粗 (600)' },
                  { value: 700, label: '粗体 (700)' },
                  { value: 800, label: '极粗 (800)' }
                ]}
                value={Number(desktopLyricsConfig.fontWeight || 700)}
                onChange={(v) => updateDesktop({ fontWeight: Number(v) })}
              />
            </SettingRow>
            <SettingRow label="文字对齐">
              <Segment
                options={[
                  { value: 'left', label: '居左' },
                  { value: 'center', label: '居中' },
                  { value: 'right', label: '居右' }
                ]}
                value={desktopLyricsConfig.alignment || 'center'}
                onChange={(v) => updateDesktop({ alignment: v })}
              />
            </SettingRow>
            <SettingRow label="显示行数">
              <Segment
                options={[
                  { value: 1, label: '单行模式' },
                  { value: 2, label: '双行模式' },
                  { value: 3, label: '三行模式' }
                ]}
                value={Number(desktopLyricsConfig.lineCount || 3)}
                onChange={(v) => updateDesktop({ lineCount: Number(v) })}
              />
            </SettingRow>
            <SettingRow label="显示歌词翻译" hint="在主歌词下方显示对应翻译文本">
              <SmoothSwitch checked={desktopLyricsConfig.showTranslation !== false} onChange={(v) => updateDesktop({ showTranslation: v })} />
            </SettingRow>
          </div>
        </div>
      </div>
    );
  };

  /* ================= 3. TAB: 沉浸歌词 ================= */
  const renderImmersiveTab = () => {
    const currentMode = normalizeImmersiveMode(advancedLyricConfig.lyricsMode);
    return (
      <div className="settings-stack">
        <div className="settings-section">
          <h3 className="settings-title"><Music4 size={18} />沉浸式全屏歌词模式</h3>
          <div className="settings-content">
            <SettingRow label="视觉渲染模式" hint={selectedImmersiveMode.description}>
              <select
                className="setting-select"
                value={currentMode}
                onChange={(e) => updateImmersive({ lyricsMode: e.target.value })}
                style={{ minWidth: 200 }}
              >
                {IMMERSIVE_MODE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </SettingRow>
            <SettingRow label="歌词数据来源" hint="自动优先获取 AMLL/QQ/酷狗 高精逐字歌词">
              <select className="setting-select" value={advancedLyricConfig.lyricSources || 'amll,qq,kugou'} onChange={(e) => updateImmersive({ lyricSources: e.target.value })}>
                <option value="amll,qq,kugou">自动推荐：时长匹配 + 逐字优先</option>
                <option value="netease">网易云原始歌词</option>
                <option value="amll">AMLL TTML 逐字</option>
                <option value="qq">QQ 音乐逐字</option>
                <option value="kugou">酷狗音乐逐字</option>
              </select>
            </SettingRow>
            <SettingRow label={`主歌词字号：${advancedLyricConfig.fontSize || 28}px`}>
              <input className="setting-slider" type="range" min="18" max="52" value={advancedLyricConfig.fontSize || 28} onChange={(e) => updateImmersive({ fontSize: Number(e.target.value) })} />
            </SettingRow>
            <SettingRow label="显示翻译" hint="在主歌词下方呈现译文">
              <SmoothSwitch checked={advancedLyricConfig.showTranslation !== false} onChange={(v) => updateImmersive({ showTranslation: v })} />
            </SettingRow>
            <SettingRow label="日文假名注音 (ルビ)" hint="在日文汉字上方标注读音">
              <SmoothSwitch checked={advancedLyricConfig.showFurigana !== false} onChange={(v) => updateImmersive({ showFurigana: v })} />
            </SettingRow>
            <SettingRow label={`时间微调偏移：${Number(advancedLyricConfig.globalOffset || 0).toFixed(2)}s`}>
              <input className="setting-slider" type="range" min="-3" max="3" step="0.05" value={advancedLyricConfig.globalOffset || 0} onChange={(e) => updateImmersive({ globalOffset: Number(e.target.value) })} />
            </SettingRow>
            <SettingRow label="歌词导出与分享" hint={currentSong ? `将《${currentSong.name || currentSong.title || '当前歌曲'}》导出为 LRC / 双语 / 逐字 / TXT` : "将当前播放歌曲的歌词导出为标准 LRC、双语 LRC、逐字 YRC 或纯文本"}>
              <button
                type="button"
                className="setting-btn primary"
                onClick={() => setIsLyricExportOpen(true)}
                disabled={!currentSong}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 14px',
                  borderRadius: '8px',
                  background: 'linear-gradient(135deg, var(--primary, #ff4081), #9c27b0)',
                  color: '#fff',
                  border: 'none',
                  fontSize: '13px',
                  fontWeight: 500,
                  cursor: currentSong ? 'pointer' : 'not-allowed',
                  opacity: currentSong ? 1 : 0.6
                }}
              >
                <Download size={15} />
                <span>{currentSong ? '导出当前歌词' : '请先播放歌曲'}</span>
              </button>
            </SettingRow>
          </div>
        </div>
      </div>
    );
  };

  /* ================= 4. TAB: 音频与音效 ================= */
  const renderAudioTab = () => (
    <div className="settings-stack">
      <div className="settings-section">
        <h3 className="settings-title"><Volume2 size={18} />音频输出与解析</h3>
        <div className="settings-content">
          <SettingRow label="音质偏好选择" hint="优先获取无损高码率音频流">
            <select className="setting-select" value={audioQuality} onChange={(e) => setAudioQuality(e.target.value)}>
              <option value="standard">标准音质 (128kbps)</option>
              <option value="higher">较高音质 (192kbps)</option>
              <option value="exhigh">极高音质 (320kbps)</option>
              <option value="lossless">无损音质 (FLAC)</option>
              <option value="hires">Hi-Res 高解析母带</option>
              <option value="jymaster">超清母带 (Master)</option>
            </select>
          </SettingRow>
        </div>
      </div>

      <div className="settings-section" style={{ padding: 0, background: 'transparent', border: 'none', boxShadow: 'none' }}>
        <EqualizerPanel isModal={false} />
      </div>
    </div>
  );

  /* ================= 5. TAB: 存储与缓存 ================= */
  const renderCacheTab = () => {
    const cfg = cacheConfig || DEFAULT_PROFILE.audio.cache;
    return (
      <div className="settings-stack">
        <div className="settings-section">
          <h3 className="settings-title"><HardDrive size={18} />存储占用与深度管理</h3>
          <div className="settings-content">
            <StorageVisualizer stats={cacheStats} onClear={handleClearSpecificCache} onSelectDir={handleSelectCacheDir} />
            <SettingRow label="全部清空" hint="一键清空所有已下载的离线歌曲、歌词与封面图">
              <button className="setting-btn danger" onClick={() => handleClearSpecificCache('all')}>清空全部缓存</button>
            </SettingRow>
          </div>
        </div>

        <div className="settings-section">
          <h3 className="settings-title"><Zap size={18} />缓存路径与上限</h3>
          <div className="settings-content">
            <SettingRow label="启用离线缓存" hint="自动缓存已播放歌曲以加速二次播放并节省流量">
              <SmoothSwitch checked={cfg.enabled !== false} onChange={(v) => updateCache({ enabled: v })} />
            </SettingRow>
            <SettingRow label={`缓存上限容量：${cfg.maxSizeGb || 2} GB`}>
              <input className="setting-slider" type="range" min="1" max="20" step="1" value={cfg.maxSizeGb || 2} onChange={(e) => updateCache({ maxSizeGb: Number(e.target.value) })} />
            </SettingRow>
            <SettingRow label="自定义缓存目录" hint={cfg.directory || defaultCacheDir || '默认应用目录'}>
              <button className="setting-btn" onClick={handleSelectCacheDir}>更改目录</button>
            </SettingRow>
          </div>
        </div>
      </div>
    );
  };

  /* ================= 6. TAB: 快捷键 ================= */
  const renderShortcutsTab = () => (
    <div className="settings-stack">
      <div className="settings-section">
        <h3 className="settings-title"><Zap size={18} />全局系统级后台热键</h3>
        <div className="settings-content">
          <SettingRow label="启用全局后台热键" hint="在全屏游戏或使用其他软件时，随时按媒体键或 Alt+Shift 组合键切歌">
            <SmoothSwitch checked={shortcuts?.globalEnabled !== false} onChange={handleToggleGlobalShortcuts} />
          </SettingRow>
          <div className="settings-desc" style={{ marginTop: 4 }}>
            支持系统专用媒体键（Play/Next/Prev）以及全局快捷组合：<br />
            • <kbd>Alt + Shift + Space</kbd> : 播放 / 暂停<br />
            • <kbd>Alt + Shift + Right</kbd> : 下一首<br />
            • <kbd>Alt + Shift + Left</kbd> : 上一首
          </div>
        </div>
      </div>

      <div className="settings-section">
        <h3 className="settings-title"><Command size={18} />应用内快捷键</h3>
        <div className="settings-content shortcut-list">
          {shortcutLabels.map(([key, label, desc]) => (
            <ShortcutRow
              key={key}
              label={label}
              description={desc}
              value={shortcuts?.[key]}
              onChange={(val) => saveShortcuts({ ...shortcuts, [key]: val })}
              onReset={() => saveShortcuts({ ...shortcuts, [key]: DEFAULT_PROFILE.shortcuts[key] })}
            />
          ))}
        </div>
      </div>
    </div>
  );

  /* ================= 7. TAB: 侧边导航 ================= */
  const renderNavbarTab = () => (
    <div className="settings-section">
      <h3 className="settings-title"><Menu size={18} />侧边导航栏项定制</h3>
      <div className="settings-content">
        {navbarConfig.map((item, index) => (
          <SettingRow key={item.key} label={item.name} hint={item.key}>
            <SmoothSwitch
              checked={item.show}
              onChange={() => {
                const next = [...navbarConfig];
                next[index] = { ...next[index], show: !next[index].show };
                saveNavbarConfig(next);
              }}
            />
          </SettingRow>
        ))}
      </div>
    </div>
  );

  /* ================= 8. TAB: 运行日志 ================= */
  const renderLogsTab = () => (
    <div className="settings-stack">
      <div className="settings-section runtime-log-section">
        <div className="runtime-log-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <h3 className="settings-title" style={{ margin: 0 }}><FileText size={18} />运行时日志记录</h3>
            <p className="settings-desc" style={{ margin: '4px 0 0' }}>记录本次会话的播放器与网络状态，退出应用后自动销毁。</p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button className="setting-btn compact" onClick={async () => {
              await navigator.clipboard.writeText(formatRuntimeLogs(runtimeLogs));
              setLogCopyState('已复制');
              setTimeout(() => setLogCopyState(''), 1500);
            }}>
              <Copy size={14} /> {logCopyState || '复制日志'}
            </button>
            <button className="setting-btn danger compact" onClick={() => clearRuntimeLogs({ addMarker: true })}>
              <Trash2 size={14} /> 清空
            </button>
          </div>
        </div>
        <div className="runtime-log-list" style={{ maxHeight: 400, overflowY: 'auto' }}>
          {runtimeLogs.length === 0 ? (
            <div className="runtime-log-empty">暂无运行日志</div>
          ) : (
            runtimeLogs.map((entry) => (
              <div key={entry.id} className={`runtime-log-entry level-${entry.level}`}>
                <div className="runtime-log-meta">
                  <time>{new Date(entry.timestamp).toLocaleTimeString()}</time>
                  <span>{entry.level.toUpperCase()}</span>
                  <span>{entry.source}</span>
                </div>
                <div className="runtime-log-message">{entry.message}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );

  /* ================= 9. TAB: 账号中心 ================= */
  const renderAccountTab = () => (
    <div className="settings-stack">
      <div className="settings-section">
        <h3 className="settings-title"><UserCheck size={18} />账号登录与同步</h3>
        <div className="settings-content">
          {user ? (
            <div className="account-card">
              <img src={user.avatarUrl} alt={user.nickname} className="account-avatar" />
              <div className="account-info">
                <h3 className="account-name">{user.nickname}</h3>
                <p className="account-uid">网易云 UID: {user.userId}</p>
              </div>
              <button className="setting-btn danger" onClick={logout}><Power size={15} /> 退出登录</button>
            </div>
          ) : (
            <div className="settings-stack">
              <Login onLoginSuccess={() => setActiveTab('theme')} />
              <div className="settings-section inset">
                <h4>备用登录：粘贴 Cookie</h4>
                <p className="settings-desc">如扫码受限，可粘贴包含 MUSIC_U 的 Cookie 字符串建立长效登录。</p>
                <textarea className="settings-textarea" rows={3} value={cookieInput} onChange={(e) => setCookieInput(e.target.value)} placeholder="MUSIC_U=xxxxx; __csrf=yyyy..." />
                <button className="setting-btn" style={{ marginTop: 8 }} onClick={async () => {
                  if (!cookieInput.trim()) return alert('请输入有效 Cookie 字符串');
                  cookieInput.split(';').forEach(item => {
                    const idx = item.indexOf('=');
                    if (idx !== -1) document.cookie = `${item.substring(0, idx).trim()}=${item.substring(idx + 1).trim()}; path=/; max-age=31536000`;
                  });
                  alert('Cookie 导入成功！正在同步验证…');
                  setCookieInput('');
                }}>导入 Cookie 验证登录</button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="settings-section">
        <h3 className="settings-title"><ShieldCheck size={18} />配置文件备份与迁移</h3>
        <div className="settings-content">
          <p className="settings-desc">导出或导入所有设置，包括主题、桌面歌词、快捷键、均衡器与播放状态。</p>
          <div className="settings-actions-row">
            <button className="setting-btn" onClick={exportProfile}>导出配置文件</button>
            <button className="setting-btn" onClick={() => document.getElementById('import-file-input')?.click()}>导入配置文件</button>
            <button className="setting-btn danger" onClick={() => { if (window.confirm('确认重置所有设置为默认值吗？此操作不可逆。')) { resetProfile(); window.location.reload(); } }}>重置所有设置</button>
            <input id="import-file-input" type="file" accept=".json,application/json" hidden onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const reader = new FileReader();
              reader.onload = () => {
                try {
                  importProfile(reader.result);
                  alert('配置导入成功，即将刷新应用！');
                  window.location.reload();
                } catch (err) {
                  alert('配置文件格式错误，导入失败');
                }
              };
              reader.readAsText(file);
            }} />
          </div>
        </div>
      </div>
    </div>
  );

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'theme': return renderThemeTab();
      case 'desktop': return renderDesktopTab();
      case 'immersive': return renderImmersiveTab();
      case 'audio': return renderAudioTab();
      case 'cache': return renderCacheTab();
      case 'shortcuts': return renderShortcutsTab();
      case 'navbar': return renderNavbarTab();
      case 'logs': return renderLogsTab();
      case 'account': return renderAccountTab();
      default: return renderThemeTab();
    }
  };

  return (
    <div className={`view-container ${layoutMode === 'classic' ? 'classic-settings-view' : 'modern-settings-view'}`}>
      <div className={`settings-shell ${layoutMode === 'classic' ? 'classic-layout' : 'modern-layout'}`}>
        {layoutMode === 'classic' ? (
          /* Classic Top Navigation Bar */
          <nav className="settings-classic-nav" aria-label="设置导航">
            <div className="settings-classic-tabs">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    className={`settings-classic-tab-btn ${isActive ? 'active' : ''}`}
                    onClick={() => setActiveTab(tab.key)}
                  >
                    <Icon size={16} />
                    <span>{tab.label}</span>
                    {isActive && <div className="settings-classic-tab-indicator" />}
                  </button>
                );
              })}
            </div>
          </nav>
        ) : (
          /* Modern Left Sidebar Navigation (scrollbar-free) */
          <aside className="settings-tabs">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  className={isActive ? 'active' : ''}
                  onClick={() => setActiveTab(tab.key)}
                >
                  <div className={`tab-icon-badge ${tab.badge}`}>
                    <Icon size={15} />
                  </div>
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </aside>
        )}
        <main className="settings-panel">{renderActiveTab()}</main>
      </div>
      <LyricExportModal
        isOpen={isLyricExportOpen}
        onClose={() => setIsLyricExportOpen(false)}
        currentSong={currentSong}
      />
    </div>
  );
}
