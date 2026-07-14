import React, { useState, useEffect } from 'react';
import { useApp, APP_VERSION } from '../context/AppContext';
import { api } from '../utils/api';
import Login from './Login';
import ShortcutRow from '../components/ShortcutRow';
import { DEFAULT_PROFILE, EQ_PRESETS, exportProfile, importProfile, resetProfile } from '../utils/settingsProfile';
import { Airplay, CheckCircle, Command, Image, Menu, Monitor, Music4, Palette, Power, Sliders, UserCheck } from 'lucide-react';

const T = {
  title: 'ICHIGOMusic \u8bbe\u7f6e',
  themeTab: '\u754c\u9762\u4e0e\u4e3b\u9898', desktopTab: '\u684c\u9762\u6b4c\u8bcd', immersiveTab: '\u6c89\u6d78\u6b4c\u8bcd', audioTab: '\u97f3\u9891', shortcutsTab: '\u5feb\u6377\u952e', navbarTab: '\u5bfc\u822a\u680f', accountTab: '\u8d26\u53f7',
  layoutColor: '\u5e03\u5c40\u4e0e\u8272\u5f69', layout: '\u6574\u4f53\u5e03\u5c40', classic: '\u7ecf\u5178\u5e03\u5c40', modern: '\u73b0\u4ee3\u5e03\u5c40', colorMode: '\u8272\u5f69\u6a21\u5f0f', dark: '\u6df1\u8272', light: '\u6d45\u8272', system: '\u8ddf\u968f\u7cfb\u7edf', accent: '\u5f3a\u8c03\u8272', customTheme: '\u81ea\u5b9a\u4e49\u4e3b\u9898', primary: '\u4e3b\u8272', bgStart: '\u80cc\u666f\u8d77\u70b9', bgEnd: '\u80cc\u666f\u7ec8\u70b9', applyCustom: '\u5e94\u7528\u81ea\u5b9a\u4e49\u4e3b\u9898',
  profile: '\u914d\u7f6e\u6587\u4ef6\u7ba1\u7406', export: '\u5bfc\u51fa\u914d\u7f6e', import: '\u5bfc\u5165\u914d\u7f6e', reset: '\u91cd\u7f6e\u6240\u6709\u8bbe\u7f6e', profileDesc: '\u5bfc\u51fa\u6216\u5bfc\u5165\u6240\u6709\u8bbe\u7f6e\uff0c\u5305\u542b\u4e3b\u9898\u3001\u6b4c\u8bcd\u3001\u97f3\u9891\u3001\u5feb\u6377\u952e\u548c\u64ad\u653e\u72b6\u6001\u3002',
  desktopWindow: '\u684c\u9762\u6b4c\u8bcd\u7a97\u53e3', floatingLyrics: '\u60ac\u6d6e\u6b4c\u8bcd', running: '\u6b63\u5728\u8fd0\u884c\uff08\u70b9\u51fb\u5173\u95ed\uff09', startNow: '\u7acb\u5373\u5f00\u542f', lockWindow: '\u9501\u5b9a\u7a97\u53e3', topMost: '\u59cb\u7ec8\u7f6e\u9876', opacity: '\u7a97\u53e3\u900f\u660e\u5ea6', fontLayoutColor: '\u5b57\u4f53\u3001\u5e03\u5c40\u4e0e\u989c\u8272', fontFamily: '\u5b57\u4f53\u65cf', fontSize: '\u5b57\u53f7', fontWeight: '\u5b57\u91cd', align: '\u5bf9\u9f50\u65b9\u5f0f', left: '\u5de6', center: '\u4e2d', right: '\u53f3', lineCount: '\u663e\u793a\u884c\u6570', oneLine: '\u5355\u884c', twoLines: '\u53cc\u884c', threeLines: '\u4e09\u884c', showTranslation: '\u663e\u793a\u7ffb\u8bd1', translationSize: '\u7ffb\u8bd1\u5b57\u53f7', playedColor: '\u5df2\u64ad\u653e\u989c\u8272', unplayedColor: '\u672a\u64ad\u653e\u989c\u8272', stroke: '\u6587\u5b57\u63cf\u8fb9', strokeWidth: '\u63cf\u8fb9\u5bbd\u5ea6', shadow: '\u6587\u5b57\u9634\u5f71', shadowBlur: '\u9634\u5f71\u6a21\u7cca', glow: '\u53d1\u5149\u6548\u679c',
  immersive: '\u6c89\u6d78\u6b4c\u8bcd', lyricSize: '\u6b4c\u8bcd\u5b57\u53f7', visibleLines: '\u663e\u793a\u884c\u6570', position: '\u4f4d\u7f6e', top: '\u9876\u90e8', curve: '\u52a8\u753b\u66f2\u7ebf', smooth: '\u987a\u6ed1', rapid: '\u8fc5\u6377', gentle: '\u67d4\u548c', fade: '\u6de1\u5165\u6de1\u51fa', scale: '\u7f29\u653e\u52a8\u753b', lyricGlow: '\u8f89\u5149\u6548\u679c', offset: '\u6b4c\u8bcd\u65f6\u95f4\u504f\u79fb', coverBgViz: '\u5c01\u9762\u3001\u80cc\u666f\u4e0e\u53ef\u89c6\u5316', showCover: '\u663e\u793a\u5c01\u9762', showSongInfo: '\u663e\u793a\u6b4c\u66f2\u4fe1\u606f', coverShape: '\u5c01\u9762\u5f62\u72b6', square: '\u6b63\u65b9\u5f62', rounded: '\u5706\u89d2', bgBlur: '\u80cc\u666f\u6a21\u7cca', bgMode: '\u80cc\u666f\u6a21\u5f0f', cover: '\u5c01\u9762', gradient: '\u6e10\u53d8', solid: '\u7eaf\u8272', none: '\u65e0', visualizer: '\u53ef\u89c6\u5316\u6837\u5f0f', bars: '\u5f8b\u52a8\u6761', waveform: '\u6ce2\u5f62', particle: '\u7c92\u5b50', circular: '\u73af\u5f62', off: '\u5173\u95ed',
  qualityEq: '\u97f3\u8d28\u4e0e\u5747\u8861\u5668', quality: '\u97f3\u8d28\u4f18\u5148\u7ea7', standard: '\u6807\u51c6', higher: '\u8f83\u9ad8', exhigh: '\u6781\u9ad8', lossless: '\u65e0\u635f', master: '\u8d85\u6e05\u6bcd\u5e26', enableEq: '\u542f\u7528 EQ', eqPreset: 'EQ \u9884\u8bbe', reverbRender: '\u6df7\u54cd\u3001\u538b\u7f29\u4e0e\u6e32\u67d3', reverb: '\u6df7\u54cd', reverbPreset: '\u6df7\u54cd\u9884\u8bbe', mix: '\u5e72\u6e7f\u6bd4', decay: '\u8870\u51cf', compressor: '\u52a8\u6001\u538b\u7f29', spatial: '\u7a7a\u95f4\u6a21\u5f0f', stereo: '\u7acb\u4f53\u58f0', crossfeed: '\u4ea4\u53c9\u9988\u9001', mono: '\u5355\u58f0\u9053', backend: '\u97f3\u9891\u540e\u7aef', decoder: '\u89e3\u7801\u6a21\u5f0f', fps: '\u53ef\u89c6\u5316 FPS',
  shortcutsTitle: '\u5feb\u6377\u952e\u7ed1\u5b9a', resetShortcuts: '\u91cd\u7f6e\u5168\u90e8\u5feb\u6377\u952e', navItems: '\u4fa7\u8fb9\u5bfc\u822a\u9879\u76ee', account: '\u8d26\u53f7', uid: '\u8d26\u53f7 UID', logout: '\u9000\u51fa\u767b\u5f55', cookieLogin: '\u5907\u7528\u767b\u5f55\uff1a\u7c98\u8d34 Cookie', cookieDesc: '\u5982\u679c\u626b\u7801\u5f02\u5e38\uff0c\u53ef\u7c98\u8d34\u7f51\u6613\u4e91\u97f3\u4e50 Cookie\uff08\u987b\u5305\u542b MUSIC_U\uff09\u5efa\u7acb\u957f\u6548\u767b\u5f55\u3002', importCookie: '\u5bfc\u5165 Cookie \u9a8c\u8bc1\u767b\u5f55'
};

const themeOptions = [
  { id: 'strawberry', name: '\u8349\u8393\u7ea2', color: '#ff4081' },
  { id: 'sakura', name: '\u6a31\u82b1\u7c89', color: '#f48fb1' },
  { id: 'matcha', name: '\u62b9\u8336\u7eff', color: '#8bc34a' },
  { id: 'ocean', name: '\u6d77\u6d0b\u84dd', color: '#03a9f4' },
  { id: 'purple', name: '\u8d5b\u535a\u7d2b', color: '#9c27b0' },
  { id: 'dark', name: '\u6781\u5ba2\u7070', color: '#9e9e9e' },
  { id: 'custom', name: '\u81ea\u5b9a\u4e49', color: 'conic-gradient(from 0deg, red, yellow, lime, aqua, blue, magenta, red)' }
];
const swatches = ['#ff3366', '#ff66b2', '#4caf50', '#00b0ff', '#ab47bc', '#111827', '#ffffff', '#f4d28a'];
const eqBands = ['32', '64', '125', '250', '500', '1k', '2k', '4k', '8k', '16k'];
const shortcutLabels = [
  ['playPause', '\u64ad\u653e / \u6682\u505c', '\u5207\u6362\u5f53\u524d\u6b4c\u66f2\u64ad\u653e\u72b6\u6001'], ['nextTrack', '\u4e0b\u4e00\u9996', '\u8df3\u5230\u64ad\u653e\u961f\u5217\u4e0b\u4e00\u9996'], ['prevTrack', '\u4e0a\u4e00\u9996', '\u8df3\u5230\u64ad\u653e\u961f\u5217\u4e0a\u4e00\u9996'], ['volumeUp', '\u97f3\u91cf\u589e\u52a0', '\u6bcf\u6b21\u589e\u52a0 5%'], ['volumeDown', '\u97f3\u91cf\u964d\u4f4e', '\u6bcf\u6b21\u964d\u4f4e 5%'], ['toggleMute', '\u9759\u97f3\u5207\u6362', '\u9759\u97f3\u6216\u6062\u590d\u9ed8\u8ba4\u97f3\u91cf'], ['toggleLyrics', '\u6c89\u6d78\u6b4c\u8bcd', '\u6253\u5f00 / \u5173\u95ed\u5168\u5c4f\u6b4c\u8bcd'], ['toggleDesktopLyrics', '\u684c\u9762\u6b4c\u8bcd', '\u6253\u5f00 / \u5173\u95ed\u60ac\u6d6e\u6b4c\u8bcd\u7a97\u53e3'], ['toggleSearch', '\u641c\u7d22', '\u5feb\u901f\u8fdb\u5165\u641c\u7d22\u9875'], ['seekForward', '\u5feb\u8fdb', '\u5411\u540e\u8df3\u8f6c 5 \u79d2'], ['seekBack', '\u5feb\u9000', '\u5411\u524d\u8df3\u8f6c 5 \u79d2'], ['likeTrack', '\u559c\u6b22\u6b4c\u66f2', '\u6536\u85cf / \u53d6\u6d88\u6536\u85cf\u5f53\u524d\u6b4c\u66f2'], ['cyclePlayMode', '\u5faa\u73af\u64ad\u653e\u6a21\u5f0f', '\u987a\u5e8f / \u968f\u673a / \u5355\u66f2'], ['goHome', '\u56de\u5230\u9996\u9875', '\u8fdb\u5165\u53d1\u73b0\u97f3\u4e50\u6216\u73b0\u4ee3\u9996\u9875']
];

function SettingRow({ label, hint, children }) {
  return <div className="settings-field"><div className="settings-field-label"><strong>{label}</strong>{hint && <span>{hint}</span>}</div><div className="settings-field-control">{children}</div></div>;
}
function Toggle({ checked, onChange }) { return <input type="checkbox" checked={!!checked} onChange={(e) => onChange(e.target.checked)} style={{ width: 20, height: 20, cursor: 'pointer' }} />; }
function Segment({ options, value, onChange }) { return <div className="segmented-control">{options.map((item) => { const optionValue = typeof item === 'object' ? item.value : item; const label = typeof item === 'object' ? item.label : item; return <button key={String(optionValue)} type="button" className={value === optionValue ? 'active' : ''} onClick={() => onChange(optionValue)}>{label}</button>; })}</div>; }

export default function Settings() {
  const { user, logout, profile, theme, setTheme, colorMode, setColorMode, layoutMode, setLayoutMode, customThemeColors, saveCustomThemeColors, navbarConfig, saveNavbarConfig, advancedLyricConfig, saveAdvancedLyricConfig, coverConfig, saveCoverConfig, desktopLyricsConfig, saveDesktopLyricsConfig, audioConfig, saveAudioConfig, renderingConfig, saveRenderingConfig, shortcuts, saveShortcuts, audioQuality, setAudioQuality, viewData, appearanceConfig, saveAppearanceConfig } = useApp();
  const [activeTab, setActiveTab] = useState(() => viewData?.tab || (user ? 'theme' : 'account'));

  useEffect(() => {
    if (viewData?.tab) {
      setActiveTab(viewData.tab);
    }
  }, [viewData]);

  const [customPrimary, setCustomPrimary] = useState(customThemeColors.primary);
  const [customBgStart, setCustomBgStart] = useState(customThemeColors.bgStart);
  const [customBgEnd, setCustomBgEnd] = useState(customThemeColors.bgEnd);
  const [cookieInput, setCookieInput] = useState('');
  const updateDesktop = (patch) => saveDesktopLyricsConfig({ ...desktopLyricsConfig, ...patch });
  const updateImmersive = (patch) => saveAdvancedLyricConfig({ ...advancedLyricConfig, ...patch });
  const updateCover = (patch) => saveCoverConfig({ ...coverConfig, ...patch });
  const updateAudio = (patch) => saveAudioConfig({ ...audioConfig, ...patch });
  const updateRendering = (patch) => saveRenderingConfig({ ...renderingConfig, ...patch });
  const tabs = [{ key: 'theme', label: T.themeTab, icon: Palette }, { key: 'desktop', label: T.desktopTab, icon: Airplay }, { key: 'audio', label: T.audioTab, icon: Sliders }, { key: 'shortcuts', label: T.shortcutsTab, icon: Command }, { key: 'navbar', label: T.navbarTab, icon: Menu }, { key: 'account', label: T.accountTab, icon: UserCheck }];

  const handleApplyCustomTheme = () => { setTheme('custom'); saveCustomThemeColors({ primary: customPrimary, bgStart: customBgStart, bgEnd: customBgEnd }); };
  const handleToggleNavbarItem = (index) => { const next = [...navbarConfig]; next[index] = { ...next[index], show: !next[index].show }; saveNavbarConfig(next); };
  const handleToggleDesktopLyrics = () => { window.electronAPI?.toggleDesktopLyrics?.(); updateDesktop({ show: !desktopLyricsConfig.show }); };
  const handleCookieLogin = async () => { if (!cookieInput.trim()) { alert('\u8bf7\u8f93\u5165\u6709\u6548\u7684 Cookie \u5b57\u7b26\u4e32'); return; } try { cookieInput.split(';').forEach(item => { const index = item.indexOf('='); if (index !== -1) { const key = item.substring(0, index).trim(); const val = item.substring(index + 1).trim(); if (key && val) document.cookie = `${key}=${val}; path=/; max-age=31536000`; } }); alert('\u624b\u52a8 Cookie \u5199\u5165\u6210\u529f\uff01\u6b63\u5728\u540c\u6b65\u9a8c\u8bc1\u72b6\u6001...'); await checkUserLogin(); setCookieInput(''); } catch (error) { console.error(error); alert('Cookie \u5199\u5165\u5931\u8d25\uff0c\u8bf7\u68c0\u67e5\u683c\u5f0f'); } };
  const handleImportProfile = (event) => { const file = event.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => { try { importProfile(reader.result); alert('\u914d\u7f6e\u5bfc\u5165\u6210\u529f\uff0c\u5373\u5c06\u5237\u65b0\u5e94\u7528\u3002'); window.location.reload(); } catch (err) { console.error(err); alert('\u914d\u7f6e\u6587\u4ef6\u683c\u5f0f\u9519\u8bef\uff0c\u5bfc\u5165\u5931\u8d25\u3002'); } }; reader.readAsText(file); event.target.value = ''; };
  const resetAll = () => { if (window.confirm('\u786e\u8ba4\u91cd\u7f6e\u6240\u6709\u8bbe\u7f6e\u4e3a\u9ed8\u8ba4\u503c\uff1f\u6b64\u64cd\u4f5c\u4e0d\u53ef\u64a4\u9500\u3002')) { resetProfile(); window.location.reload(); } };

  const { checkForUpdates } = useApp();
  const [checking, setChecking] = useState(false);

  const handleManualCheck = async () => {
    setChecking(true);
    await checkForUpdates(true);
    setChecking(false);
  };

  const renderVersionUpdateSection = () => (
    <div className="settings-section">
      <h3 className="settings-title">
        <CheckCircle size={18} /> 应用版本与更新
      </h3>
      <div className="settings-content">
        <SettingRow label="当前应用版本">
          <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-main)' }}>{APP_VERSION}</span>
        </SettingRow>
        <SettingRow label="检查最新更新" hint="获取 GitHub releases 页面最新版本">
          <button 
            className={`setting-btn ${checking ? '' : 'active'}`} 
            onClick={handleManualCheck}
            disabled={checking}
          >
            {checking ? '正在检查...' : '立即检查更新'}
          </button>
        </SettingRow>
      </div>
    </div>
  );

  const renderProfileTools = () => <div className="settings-section"><h3 className="settings-title"><CheckCircle size={18} />{T.profile}</h3><div className="settings-content"><p className="settings-desc">{T.profileDesc}</p><div className="settings-actions-row"><button className="setting-btn" onClick={exportProfile}>{T.export}</button><button className="setting-btn" onClick={() => document.getElementById('import-file-input')?.click()}>{T.import}</button><button className="setting-btn danger" onClick={resetAll}>{T.reset}</button><input id="import-file-input" type="file" accept=".json,application/json" hidden onChange={handleImportProfile} /></div><p className="settings-desc">{`\u5f53\u524d\u914d\u7f6e\u7248\u672c\uff1av${profile.version}\uff0c\u5b58\u50a8 Key\uff1a`}<code>ichigomusic_profile_v2</code></p></div></div>;
  const renderThemeTab = () => <div className="settings-stack"><div className="settings-section"><h3 className="settings-title"><Monitor size={18} />{T.layoutColor}</h3><div className="settings-content"><SettingRow label={T.layout} hint="Classic / Modern"><Segment options={[{ value: 'classic', label: T.classic }, { value: 'modern', label: T.modern }]} value={layoutMode} onChange={setLayoutMode} /></SettingRow><SettingRow label={T.colorMode}><Segment options={[{ value: 'dark', label: T.dark }, { value: 'light', label: T.light }, { value: 'system', label: T.system }]} value={colorMode} onChange={setColorMode} /></SettingRow><SettingRow label="关闭主面板"><Segment options={[{ value: 'prompt', label: '弹出提示' }, { value: 'hide', label: '隐藏到托盘' }, { value: 'close', label: '退出应用' }]} value={appearanceConfig.closeBehavior || 'prompt'} onChange={(v) => saveAppearanceConfig({ ...appearanceConfig, closeBehavior: v })} /></SettingRow></div></div><div className="settings-section"><h3 className="settings-title"><Palette size={18} />{T.accent}</h3><div className="theme-selector">{themeOptions.map(t => <button key={t.id} className={`theme-btn ${theme === t.id ? 'active' : ''}`} onClick={() => setTheme(t.id)} style={{ background: t.color }} title={t.name} />)}</div></div><div className="settings-section"><h3 className="settings-title"><Palette size={18} />{T.customTheme}</h3><div className="settings-content settings-grid-3"><SettingRow label={T.primary}><input type="color" value={customPrimary} onChange={(e) => setCustomPrimary(e.target.value)} /></SettingRow><SettingRow label={T.bgStart}><input type="color" value={customBgStart} onChange={(e) => setCustomBgStart(e.target.value)} /></SettingRow><SettingRow label={T.bgEnd}><input type="color" value={customBgEnd} onChange={(e) => setCustomBgEnd(e.target.value)} /></SettingRow></div><button className="setting-btn active" onClick={handleApplyCustomTheme}>{T.applyCustom}</button></div>{renderProfileTools()}{renderVersionUpdateSection()}</div>;
  const renderDesktopTab = () => <div className="settings-stack"><div className="settings-section"><h3 className="settings-title"><Airplay size={18} />{T.desktopWindow}</h3><div className="settings-content"><SettingRow label={T.floatingLyrics} hint="Electron"><button className={`setting-btn ${desktopLyricsConfig.show ? 'active' : ''}`} onClick={handleToggleDesktopLyrics}>{desktopLyricsConfig.show ? T.running : T.startNow}</button></SettingRow><SettingRow label={T.lockWindow}><Toggle checked={desktopLyricsConfig.locked} onChange={(v) => updateDesktop({ locked: v })} /></SettingRow><SettingRow label={T.topMost}><Toggle checked={desktopLyricsConfig.alwaysOnTop !== false} onChange={(v) => updateDesktop({ alwaysOnTop: v })} /></SettingRow><SettingRow label={`${T.opacity}\uff1a${Number(desktopLyricsConfig.opacity ?? 1).toFixed(2)}`}><input className="setting-slider" type="range" min="0.3" max="1" step="0.05" value={desktopLyricsConfig.opacity ?? 1} onChange={(e) => updateDesktop({ opacity: Number(e.target.value) })} /></SettingRow></div></div><div className="settings-section"><h3 className="settings-title"><Palette size={18} />{T.fontLayoutColor}</h3><div className="settings-content"><SettingRow label={T.fontFamily}><select className="setting-select" value={desktopLyricsConfig.fontFamily || 'Inter'} onChange={(e) => updateDesktop({ fontFamily: e.target.value })}><option value="Inter">Inter</option><option value="Noto Sans SC">Noto Sans SC</option><option value="Outfit">Outfit</option><option value="JetBrains Mono">JetBrains Mono</option><option value="system-ui">system-ui</option><option value="Microsoft YaHei">Microsoft YaHei</option></select></SettingRow><SettingRow label={`${T.fontSize}\uff1a${desktopLyricsConfig.fontSize || 36}px`}><input className="setting-slider" type="range" min="24" max="72" value={desktopLyricsConfig.fontSize || 36} onChange={(e) => updateDesktop({ fontSize: Number(e.target.value) })} /></SettingRow><SettingRow label={`${T.fontWeight}\uff1a${desktopLyricsConfig.fontWeight || 700}`}><Segment options={[300,400,500,600,700,800,900]} value={desktopLyricsConfig.fontWeight || 700} onChange={(v) => updateDesktop({ fontWeight: v, bold: v >= 700 })} /></SettingRow><SettingRow label={T.align}><Segment options={[{value:'left',label:T.left},{value:'center',label:T.center},{value:'right',label:T.right}]} value={desktopLyricsConfig.alignment || 'center'} onChange={(v)=>updateDesktop({alignment:v})}/></SettingRow><SettingRow label={T.lineCount}><Segment options={[{value:1,label:T.oneLine},{value:2,label:T.twoLines},{value:3,label:T.threeLines}]} value={desktopLyricsConfig.lineCount || 3} onChange={(v)=>updateDesktop({lineCount:v})}/></SettingRow><SettingRow label={T.showTranslation}><Toggle checked={desktopLyricsConfig.showTranslation !== false} onChange={(v)=>updateDesktop({showTranslation:v})}/></SettingRow><SettingRow label={`${T.translationSize}\uff1a${desktopLyricsConfig.translationSize || 22}px`}><input className="setting-slider" type="range" min="12" max="36" value={desktopLyricsConfig.translationSize || 22} onChange={(e)=>updateDesktop({translationSize:Number(e.target.value)})}/></SettingRow><SettingRow label="配色方案"><select className="setting-select" value={desktopLyricsConfig.colorPreset || 'strawberry'} onChange={(e) => updateDesktop({ colorPreset: e.target.value })}><option value="strawberry">草莓甜心</option><option value="aurora">极光绿野</option><option value="ocean">深海晴空</option><option value="purple">霓虹紫梦</option><option value="gold">灿烂暖金</option><option value="sakura">玫瑰樱粉</option><option value="dark">极简暗黑</option><option value="custom">自定义颜色</option></select></SettingRow>{(desktopLyricsConfig.colorPreset === 'custom') && (<><SettingRow label={T.playedColor}><div className="color-row"><input type="color" value={desktopLyricsConfig.playedColor || '#ff3366'} onChange={(e)=>updateDesktop({playedColor:e.target.value,color:e.target.value})}/>{swatches.map(c=><button key={`p-${c}`} className="swatch" style={{background:c}} onClick={()=>updateDesktop({playedColor:c,color:c})}/>)}</div></SettingRow><SettingRow label={T.unplayedColor}><div className="color-row"><input type="color" value={desktopLyricsConfig.unplayedColor || '#ffffff'} onChange={(e)=>updateDesktop({unplayedColor:e.target.value})}/>{swatches.map(c=><button key={`u-${c}`} className="swatch" style={{background:c}} onClick={()=>updateDesktop({unplayedColor:c})}/>)}</div></SettingRow><SettingRow label="描边颜色"><div className="color-row"><input type="color" value={desktopLyricsConfig.textStroke?.color || '#000000'} onChange={(e)=>updateDesktop({textStroke:{...(desktopLyricsConfig.textStroke || {}),color:e.target.value}})}/>{swatches.map(c=><button key={`s-${c}`} className="swatch" style={{background:c}} onClick={()=>updateDesktop({textStroke:{...(desktopLyricsConfig.textStroke || {}),color:c}})}/>)}</div></SettingRow></>)}<SettingRow label={T.stroke}><Toggle checked={desktopLyricsConfig.textStroke?.enabled} onChange={(v)=>updateDesktop({textStroke:{...desktopLyricsConfig.textStroke,enabled:v}})}/></SettingRow><SettingRow label={`${T.strokeWidth}\uff1a${desktopLyricsConfig.textStroke?.width ?? 0.5}px`}><input className="setting-slider" type="range" min="0" max="3" step="0.1" value={desktopLyricsConfig.textStroke?.width ?? 0.5} onChange={(e)=>updateDesktop({textStroke:{...desktopLyricsConfig.textStroke,width:Number(e.target.value)}})}/></SettingRow><SettingRow label={T.shadow}><Toggle checked={desktopLyricsConfig.textShadow?.enabled !== false} onChange={(v)=>updateDesktop({textShadow:{...desktopLyricsConfig.textShadow,enabled:v}})}/></SettingRow><SettingRow label={`${T.shadowBlur}\uff1a${desktopLyricsConfig.textShadow?.blur ?? 12}px`}><input className="setting-slider" type="range" min="0" max="30" value={desktopLyricsConfig.textShadow?.blur ?? 12} onChange={(e)=>updateDesktop({textShadow:{...desktopLyricsConfig.textShadow,blur:Number(e.target.value)}})}/></SettingRow><SettingRow label={T.glow}><Toggle checked={desktopLyricsConfig.glow?.enabled} onChange={(v)=>updateDesktop({glow:{...desktopLyricsConfig.glow,enabled:v}})}/></SettingRow></div></div></div>;
  const renderImmersiveTab = () => (
    <div className="settings-stack">
      <div className="settings-section">
        <h3 className="settings-title"><Music4 size={18} />{T.immersive}</h3>
        <div className="settings-content">
          <SettingRow label="歌词模式">
            <Segment options={[
              { value: 'regular', label: '常规逐字' },
              { value: 'talk', label: '混乱模式' },
              { value: 'streamer', label: '气泡模式' },
              { value: 'cloudstep', label: '云阶模式' },
              { value: 'spatial', label: '空间画布' },
              { value: 'vinyl', label: '黑胶光碟' }
            ]} value={advancedLyricConfig.lyricsMode || 'regular'} onChange={(v) => updateImmersive({ lyricsMode: v })} />
          </SettingRow>
          <SettingRow label={`${T.lyricSize}：${advancedLyricConfig.fontSize || 28}px`}><input className="setting-slider" type="range" min="18" max="52" value={advancedLyricConfig.fontSize || 28} onChange={(e)=>updateImmersive({fontSize:Number(e.target.value)})}/></SettingRow>
          <SettingRow label={`${T.translationSize}：${advancedLyricConfig.translationSize || 18}px`}><input className="setting-slider" type="range" min="12" max="36" value={advancedLyricConfig.translationSize || 18} onChange={(e)=>updateImmersive({translationSize:Number(e.target.value)})}/></SettingRow>
          <SettingRow label={`${T.visibleLines}：${advancedLyricConfig.visibleLines || 5}`}><input className="setting-slider" type="range" min="1" max="9" step="2" value={advancedLyricConfig.visibleLines || 5} onChange={(e)=>updateImmersive({visibleLines:Number(e.target.value)})}/></SettingRow>
          <SettingRow label={T.position}><Segment options={[{value:'top',label:T.top},{value:'center',label:T.center}]} value={advancedLyricConfig.position || 'center'} onChange={(v)=>updateImmersive({position:v})}/></SettingRow>
          <SettingRow label={T.curve}><Segment options={[{value:'smooth',label:T.smooth},{value:'rapid',label:T.rapid},{value:'gentle',label:T.gentle}]} value={advancedLyricConfig.animationCurve || 'smooth'} onChange={(v)=>updateImmersive({animationCurve:v})}/></SettingRow>
          <SettingRow label={T.fade}><Toggle checked={advancedLyricConfig.fade !== false} onChange={(v)=>updateImmersive({fade:v})}/></SettingRow>
          <SettingRow label={T.scale}><Toggle checked={advancedLyricConfig.scale !== false} onChange={(v)=>updateImmersive({scale:v})}/></SettingRow>
          <SettingRow label={T.lyricGlow}><Toggle checked={advancedLyricConfig.showGlow === true} onChange={(v)=>updateImmersive({showGlow:v})}/></SettingRow>
          <SettingRow label={`${T.offset}：${Number(advancedLyricConfig.globalOffset || 0).toFixed(2)}s`}><input className="setting-slider" type="range" min="-3" max="3" step="0.05" value={advancedLyricConfig.globalOffset || 0} onChange={(e)=>updateImmersive({globalOffset:Number(e.target.value)})}/></SettingRow>
        </div>
      </div>
      <div className="settings-section">
        <h3 className="settings-title"><Image size={18} />{T.coverBgViz}</h3>
        <div className="settings-content">
          <SettingRow label={T.showCover}><Toggle checked={coverConfig.showCover !== false && advancedLyricConfig.showCover !== false} onChange={(v)=>{updateCover({showCover:v}); updateImmersive({showCover:v});}}/></SettingRow>
          <SettingRow label={T.showSongInfo}><Toggle checked={advancedLyricConfig.showSongInfo !== false} onChange={(v)=>updateImmersive({showSongInfo:v})}/></SettingRow>
          <SettingRow label={T.coverShape}><Segment options={[{value:true,label:T.square},{value:false,label:T.rounded}]} value={coverConfig.squareCover !== false} onChange={(v)=>updateCover({squareCover:v})}/></SettingRow>
          <SettingRow label={`${T.bgBlur}：${advancedLyricConfig.backgroundBlur || 32}`}><input className="setting-slider" type="range" min="0" max="60" value={advancedLyricConfig.backgroundBlur || 32} onChange={(e)=>updateImmersive({backgroundBlur:Number(e.target.value)})}/></SettingRow>
          <SettingRow label={T.bgMode}><Segment options={[{value:'cover',label:T.cover},{value:'gradient',label:T.gradient},{value:'solid',label:T.solid},{value:'none',label:T.none}]} value={advancedLyricConfig.backgroundMode || 'cover'} onChange={(v)=>updateImmersive({backgroundMode:v})}/></SettingRow>
        </div>
      </div>
      <div className="settings-section">
        <h3 className="settings-title"><Sliders size={18} />沉浸特效与参数化控制</h3>
        <div className="settings-content">
          <SettingRow label="气泡模式对齐方式">
            <Segment options={[{value:'alternate',label:'左右交替'},{value:'left',label:'全局居左'},{value:'right',label:'全局居右'}]} value={advancedLyricConfig.bubbleAlign || 'alternate'} onChange={(v)=>updateImmersive({bubbleAlign:v})}/>
          </SettingRow>
          <SettingRow label={`云阶模式行间距：${advancedLyricConfig.cloudStepSpacing || 1}`}>
            <input className="setting-slider" type="range" min="0.5" max="2" step="0.1" value={advancedLyricConfig.cloudStepSpacing || 1} onChange={(e)=>updateImmersive({cloudStepSpacing:Number(e.target.value)})}/>
          </SettingRow>
          <SettingRow label={`黑胶旋转行间距：${advancedLyricConfig.vinylLineSpacing ?? 0.7}`}>
            <input className="setting-slider" type="range" min="0.5" max="2" step="0.1" value={advancedLyricConfig.vinylLineSpacing ?? 0.7} onChange={(e)=>updateImmersive({vinylLineSpacing:Number(e.target.value)})}/>
          </SettingRow>
          <SettingRow label={`黑胶旋转倾斜角：${advancedLyricConfig.vinylTiltAngle ?? 0}°`}>
            <input className="setting-slider" type="range" min="-60" max="60" step="5" value={advancedLyricConfig.vinylTiltAngle ?? 0} onChange={(e)=>updateImmersive({vinylTiltAngle:Number(e.target.value)})}/>
          </SettingRow>
          <SettingRow label="背景悬浮粒子装饰 (Floating Decor)" hint="漂浮星空微粒装饰效果"><Toggle checked={advancedLyricConfig.showDecor === true} onChange={(v)=>updateImmersive({showDecor:v})}/></SettingRow>
          {advancedLyricConfig.showDecor === true && (
            <>
              <SettingRow label={`浮动粒子发射数：${advancedLyricConfig.decorParticleAmount ?? 40}`}><input className="setting-slider" type="range" min="10" max="150" step="5" value={advancedLyricConfig.decorParticleAmount ?? 40} onChange={(e)=>updateImmersive({decorParticleAmount:Number(e.target.value)})}/></SettingRow>
              <SettingRow label={`粒子浮游运动速度：${(advancedLyricConfig.decorSpeed ?? 1.0).toFixed(1)}x`}><input className="setting-slider" type="range" min="0.1" max="3.0" step="0.1" value={advancedLyricConfig.decorSpeed ?? 1.0} onChange={(e)=>updateImmersive({decorSpeed:Number(e.target.value)})}/></SettingRow>
              <SettingRow label={`粒子发光微调半径：${(advancedLyricConfig.decorSize ?? 1.0).toFixed(1)}x`}><input className="setting-slider" type="range" min="0.3" max="3.0" step="0.1" value={advancedLyricConfig.decorSize ?? 1.0} onChange={(e)=>updateImmersive({decorSize:Number(e.target.value)})}/></SettingRow>
              <SettingRow label={`粒子底噪基础透明：${(advancedLyricConfig.decorOpacity ?? 0.6).toFixed(2)}`}><input className="setting-slider" type="range" min="0.1" max="1.0" step="0.05" value={advancedLyricConfig.decorOpacity ?? 0.6} onChange={(e)=>updateImmersive({decorOpacity:Number(e.target.value)})}/></SettingRow>
              <SettingRow label="随音乐节奏闪烁喷涌" hint="关闭后微粒将保持匀速平静漂流"><Toggle checked={advancedLyricConfig.decorTwinkle === true} onChange={(v)=>updateImmersive({decorTwinkle:v})}/></SettingRow>
            </>
          )}
          <SettingRow label="背景水印与装饰符" hint="漂浮音符、十字星与水印"><Toggle checked={advancedLyricConfig.backgroundDecor !== false} onChange={(v)=>updateImmersive({backgroundDecor:v})}/></SettingRow>
          <SettingRow label="动态音阶描边" hint="视觉残影与霓虹拖影效果"><Toggle checked={advancedLyricConfig.dynamicOutlines !== false} onChange={(v)=>updateImmersive({dynamicOutlines:v})}/></SettingRow>

          {/* ================= 常规滚动模式 (regular) 可视化参数 ================= */}
          {advancedLyricConfig.lyricsMode === 'regular' && (
            <>
              <h4 style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--primary)', marginTop: '24px', marginBottom: '12px', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '6px' }}>环形频谱可视化（封面后方）</h4>
              <SettingRow label="环形样式">
                <Segment 
                  options={[
                    { value: 'radial', label: '辐射线条' },
                    { value: 'particle', label: '发光粒子' },
                    { value: 'wave', label: '连续波环' }
                  ]} 
                  value={advancedLyricConfig.ringStyle || 'radial'} 
                  onChange={(v) => updateImmersive({ ringStyle: v })} 
                />
              </SettingRow>
              <SettingRow label={`采样精度 (线条/粒子数)：${advancedLyricConfig.ringBarCount ?? 180}`}>
                <input className="setting-slider" type="range" min="60" max="360" step="10" value={advancedLyricConfig.ringBarCount ?? 180} onChange={(e) => updateImmersive({ ringBarCount: Number(e.target.value) })} />
              </SettingRow>
              <SettingRow label={`最大延伸振幅：${advancedLyricConfig.ringMaxAmplitude ?? 80}px`}>
                <input className="setting-slider" type="range" min="20" max="200" step="5" value={advancedLyricConfig.ringMaxAmplitude ?? 80} onChange={(e) => updateImmersive({ ringMaxAmplitude: Number(e.target.value) })} />
              </SettingRow>
              <SettingRow label={`唱片边缘间距偏差：${advancedLyricConfig.ringInnerOffset ?? 5}px`}>
                <input className="setting-slider" type="range" min="-50" max="100" step="1" value={advancedLyricConfig.ringInnerOffset ?? 5} onChange={(e) => updateImmersive({ ringInnerOffset: Number(e.target.value) })} />
              </SettingRow>
              <SettingRow label={`画笔/粒子线宽：${advancedLyricConfig.ringLineWidth ?? 2.5}px`}>
                <input className="setting-slider" type="range" min="1.0" max="8.0" step="0.5" value={advancedLyricConfig.ringLineWidth ?? 2.5} onChange={(e) => updateImmersive({ ringLineWidth: Number(e.target.value) })} />
              </SettingRow>
              <SettingRow label="配色方案">
                <Segment 
                  options={[
                    { value: 'adaptive', label: '封面自适应' },
                    { value: 'theme', label: '主题单色' },
                    { value: 'custom', label: '双色渐变' }
                  ]} 
                  value={advancedLyricConfig.ringColorMode || 'adaptive'} 
                  onChange={(v) => updateImmersive({ ringColorMode: v })} 
                />
              </SettingRow>
              {advancedLyricConfig.ringColorMode === 'custom' && (
                <SettingRow label="自定义渐变色">
                  <div style={{ display: 'flex', gap: '16px' }}>
                    <input type="color" value={advancedLyricConfig.ringCustomColor1 || '#17f700'} onChange={(e) => updateImmersive({ ringCustomColor1: e.target.value })} style={{ width: '48px', height: '32px', padding: '0', border: 'none', borderRadius: '4px', cursor: 'pointer' }} />
                    <input type="color" value={advancedLyricConfig.ringCustomColor2 || '#00d4ff'} onChange={(e) => updateImmersive({ ringCustomColor2: e.target.value })} style={{ width: '48px', height: '32px', padding: '0', border: 'none', borderRadius: '4px', cursor: 'pointer' }} />
                  </div>
                </SettingRow>
              )}
              <SettingRow label={`自转慢速慢转角：${advancedLyricConfig.ringRotationSpeed ?? 15}°/分`}>
                <input className="setting-slider" type="range" min="0" max="120" step="5" value={advancedLyricConfig.ringRotationSpeed ?? 15} onChange={(e) => updateImmersive({ ringRotationSpeed: Number(e.target.value) })} />
              </SettingRow>
              <SettingRow label="慢转角随声浪脉冲加速">
                <Toggle checked={advancedLyricConfig.ringRotationBeatSync === true} onChange={(v) => updateImmersive({ ringRotationBeatSync: v })} />
              </SettingRow>
              <SettingRow label={`发光辉光强度：${advancedLyricConfig.ringGlowIntensity ?? 0.6}`}>
                <input className="setting-slider" type="range" min="0.0" max="1.5" step="0.1" value={advancedLyricConfig.ringGlowIntensity ?? 0.6} onChange={(e) => updateImmersive({ ringGlowIntensity: Number(e.target.value) })} />
              </SettingRow>
              <SettingRow label="发光伴随节奏闪烁">
                <Toggle checked={advancedLyricConfig.ringGlowPulse !== false} onChange={(v) => updateImmersive({ ringGlowPulse: v })} />
              </SettingRow>
              <SettingRow label={`频谱上升平滑：${advancedLyricConfig.ringSmoothing ?? 0.25}`}>
                <input className="setting-slider" type="range" min="0.05" max="0.6" step="0.05" value={advancedLyricConfig.ringSmoothing ?? 0.25} onChange={(e) => updateImmersive({ ringSmoothing: Number(e.target.value) })} />
              </SettingRow>
              <SettingRow label={`残影回落时间：${advancedLyricConfig.ringTrailDecay ?? 0.85}`}>
                <input className="setting-slider" type="range" min="0.5" max="0.98" step="0.02" value={advancedLyricConfig.ringTrailDecay ?? 0.85} onChange={(e) => updateImmersive({ ringTrailDecay: Number(e.target.value) })} />
              </SettingRow>
              <SettingRow label={`频谱不透明度：${advancedLyricConfig.ringOpacity ?? 0.85}`}>
                <input className="setting-slider" type="range" min="0.1" max="1.0" step="0.05" value={advancedLyricConfig.ringOpacity ?? 0.85} onChange={(e) => updateImmersive({ ringOpacity: Number(e.target.value) })} />
              </SettingRow>
            </>
          )}

          {/* ================= 气泡模式 (streamer) 可视化参数 ================= */}
          {advancedLyricConfig.lyricsMode === 'streamer' && (
            <>
              <h4 style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--primary)', marginTop: '24px', marginBottom: '12px', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '6px' }}>底部流光氛围脉冲灯带</h4>
              <SettingRow label={`灯带基础高度：${advancedLyricConfig.streamerBarHeight ?? 16}px`}>
                <input className="setting-slider" type="range" min="5" max="80" step="1" value={advancedLyricConfig.streamerBarHeight ?? 16} onChange={(e) => updateImmersive({ streamerBarHeight: Number(e.target.value) })} />
              </SettingRow>
              <SettingRow label={`脉冲波动高度：${advancedLyricConfig.streamerBarMaxHeight ?? 80}px`}>
                <input className="setting-slider" type="range" min="20" max="250" step="2" value={advancedLyricConfig.streamerBarMaxHeight ?? 80} onChange={(e) => updateImmersive({ streamerBarMaxHeight: Number(e.target.value) })} />
              </SettingRow>
              <SettingRow label={`灯带不透明度：${advancedLyricConfig.streamerBarOpacity ?? 0.75}`}>
                <input className="setting-slider" type="range" min="0.2" max="1.0" step="0.05" value={advancedLyricConfig.streamerBarOpacity ?? 0.75} onChange={(e) => updateImmersive({ streamerBarOpacity: Number(e.target.value) })} />
              </SettingRow>
              <SettingRow label={`霓虹辉光扩散半径：${advancedLyricConfig.streamerBarGlowSpread ?? 20}px`}>
                <input className="setting-slider" type="range" min="0" max="50" step="2" value={advancedLyricConfig.streamerBarGlowSpread ?? 20} onChange={(e) => updateImmersive({ streamerBarGlowSpread: Number(e.target.value) })} />
              </SettingRow>
              <SettingRow label={`流光游动速度：${advancedLyricConfig.streamerBarFlowSpeed ?? 1.0}`}>
                <input className="setting-slider" type="range" min="0.1" max="3.0" step="0.1" value={advancedLyricConfig.streamerBarFlowSpeed ?? 1.0} onChange={(e) => updateImmersive({ streamerBarFlowSpeed: Number(e.target.value) })} />
              </SettingRow>
              <SettingRow label="配色模式">
                <Segment 
                  options={[
                    { value: 'theme', label: '应用主题色' },
                    { value: 'custom', label: '自定义颜色' }
                  ]} 
                  value={advancedLyricConfig.streamerBarColorMode || 'theme'} 
                  onChange={(v) => updateImmersive({ streamerBarColorMode: v })} 
                />
              </SettingRow>
              {advancedLyricConfig.streamerBarColorMode === 'custom' && (
                <SettingRow label="自定义灯带颜色">
                  <input type="color" value={advancedLyricConfig.streamerBarCustomColor || '#ff4081'} onChange={(e) => updateImmersive({ streamerBarCustomColor: e.target.value })} style={{ width: '48px', height: '32px', padding: '0', border: 'none', borderRadius: '4px', cursor: 'pointer' }} />
                </SettingRow>
              )}
            </>
          )}

          {/* ================= 混乱模式 (talk) 可视化参数 ================= */}
          {advancedLyricConfig.lyricsMode === 'talk' && (
            <>
              <h4 style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--primary)', marginTop: '24px', marginBottom: '12px', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '6px' }}>背景视差粒子与击鼓爆发特效</h4>
              <SettingRow label={`常驻星空粒子数：${advancedLyricConfig.talkParticleCount ?? 80}`}>
                <input className="setting-slider" type="range" min="20" max="200" step="10" value={advancedLyricConfig.talkParticleCount ?? 80} onChange={(e) => updateImmersive({ talkParticleCount: Number(e.target.value) })} />
              </SettingRow>
              <SettingRow label={`粒子发光半径：${advancedLyricConfig.talkParticleSize ?? 1.0}`}>
                <input className="setting-slider" type="range" min="0.3" max="3.0" step="0.1" value={advancedLyricConfig.talkParticleSize ?? 1.0} onChange={(e) => updateImmersive({ talkParticleSize: Number(e.target.value) })} />
              </SettingRow>
              <SettingRow label={`粒子底噪透明度：${advancedLyricConfig.talkParticleOpacity ?? 0.7}`}>
                <input className="setting-slider" type="range" min="0.2" max="1.0" step="0.05" value={advancedLyricConfig.talkParticleOpacity ?? 0.7} onChange={(e) => updateImmersive({ talkParticleOpacity: Number(e.target.value) })} />
              </SettingRow>
              <SettingRow label="常驻粒子形状">
                <Segment 
                  options={[
                    { value: 'triangle', label: '经典三角' },
                    { value: 'diamond', label: '华丽菱形' },
                    { value: 'dot', label: '圆点星辰' },
                    { value: 'line', label: '律动短线' }
                  ]} 
                  value={advancedLyricConfig.talkParticleShape || 'triangle'} 
                  onChange={(v) => updateImmersive({ talkParticleShape: v })} 
                />
              </SettingRow>
              <SettingRow label={`声浪冲击爆发阈值：${advancedLyricConfig.talkBurstThreshold ?? 200}`}>
                <input className="setting-slider" type="range" min="100" max="250" step="5" value={advancedLyricConfig.talkBurstThreshold ?? 200} onChange={(e) => updateImmersive({ talkBurstThreshold: Number(e.target.value) })} />
              </SettingRow>
              <SettingRow label={`冲击波喷涌强度：${advancedLyricConfig.talkBurstIntensity ?? 1.0}`}>
                <input className="setting-slider" type="range" min="0.3" max="2.0" step="0.1" value={advancedLyricConfig.talkBurstIntensity ?? 1.0} onChange={(e) => updateImmersive({ talkBurstIntensity: Number(e.target.value) })} />
              </SettingRow>
              <SettingRow label={`风向横向游移速度：${advancedLyricConfig.talkDriftSpeed ?? 1.0}`}>
                <input className="setting-slider" type="range" min="0" max="3.0" step="0.1" value={advancedLyricConfig.talkDriftSpeed ?? 1.0} onChange={(e) => updateImmersive({ talkDriftSpeed: Number(e.target.value) })} />
              </SettingRow>
              <SettingRow label={`空间微弱引力效应：${advancedLyricConfig.talkGravity ?? 0.05}`}>
                <input className="setting-slider" type="range" min="-0.2" max="0.2" step="0.02" value={advancedLyricConfig.talkGravity ?? 0.05} onChange={(e) => updateImmersive({ talkGravity: Number(e.target.value) })} />
              </SettingRow>
              <SettingRow label="配色方案">
                <Segment 
                  options={[
                    { value: 'adaptive', label: '自适应封面' },
                    { value: 'custom', label: '自定义颜色' }
                  ]} 
                  value={advancedLyricConfig.talkColorMode || 'adaptive'} 
                  onChange={(v) => updateImmersive({ talkColorMode: v })} 
                />
              </SettingRow>
              {advancedLyricConfig.talkColorMode === 'custom' && (
                <SettingRow label="自定义粒子颜色">
                  <input type="color" value={advancedLyricConfig.talkCustomColor || '#ff4081'} onChange={(e) => updateImmersive({ talkCustomColor: e.target.value })} style={{ width: '48px', height: '32px', padding: '0', border: 'none', borderRadius: '4px', cursor: 'pointer' }} />
                </SettingRow>
              )}
            </>
          )}

          {/* ================= 云阶模式 (cloudstep) 可视化参数 ================= */}
          {advancedLyricConfig.lyricsMode === 'cloudstep' && (
            <>
              <h4 style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--primary)', marginTop: '24px', marginBottom: '12px', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '6px' }}>层叠雾化波纹（背景云层）</h4>
              <SettingRow label={`雾层发散羽化值：${advancedLyricConfig.cloudWaveBlur ?? 23}px`}>
                <input className="setting-slider" type="range" min="5" max="60" step="1" value={advancedLyricConfig.cloudWaveBlur ?? 23} onChange={(e) => updateImmersive({ cloudWaveBlur: Number(e.target.value) })} />
              </SettingRow>
              <SettingRow label={`声浪最大起伏高度：${advancedLyricConfig.cloudWaveHeight ?? 30}px`}>
                <input className="setting-slider" type="range" min="10" max="80" step="2" value={advancedLyricConfig.cloudWaveHeight ?? 30} onChange={(e) => updateImmersive({ cloudWaveHeight: Number(e.target.value) })} />
              </SettingRow>
              <SettingRow label={`雾波底噪声透明度：${(advancedLyricConfig.cloudWaveOpacity ?? 0.39).toFixed(2)}`}>
                <input className="setting-slider" type="range" min="0.02" max="0.5" step="0.01" value={advancedLyricConfig.cloudWaveOpacity ?? 0.39} onChange={(e) => updateImmersive({ cloudWaveOpacity: Number(e.target.value) })} />
              </SettingRow>
              <SettingRow label={`多层错落垂直分散度：${advancedLyricConfig.cloudWaveVerticalSpread ?? 1.0}`}>
                <input className="setting-slider" type="range" min="0" max="3.0" step="0.1" value={advancedLyricConfig.cloudWaveVerticalSpread ?? 1.0} onChange={(e) => updateImmersive({ cloudWaveVerticalSpread: Number(e.target.value) })} />
              </SettingRow>
              <SettingRow label="配色方案">
                <Segment 
                  options={[
                    { value: 'theme', label: '跟随系统' },
                    { value: 'custom', label: '自定义颜色' }
                  ]} 
                  value={advancedLyricConfig.cloudWaveColorMode || 'theme'} 
                  onChange={(v) => updateImmersive({ cloudWaveColorMode: v })} 
                />
              </SettingRow>
              {advancedLyricConfig.cloudWaveColorMode === 'custom' && (
                <SettingRow label="自定义雾波颜色">
                  <input type="color" value={advancedLyricConfig.cloudWaveCustomColor || '#ff4081'} onChange={(e) => updateImmersive({ cloudWaveCustomColor: e.target.value })} style={{ width: '48px', height: '32px', padding: '0', border: 'none', borderRadius: '4px', cursor: 'pointer' }} />
                </SettingRow>
              )}
            </>
          )}

          {/* ================= 空间画布 (spatial) 可视化参数 ================= */}
          {advancedLyricConfig.lyricsMode === 'spatial' && (
            <>
              <h4 style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--primary)', marginTop: '24px', marginBottom: '12px', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '6px' }}>3D 空间声部扩散粒子场</h4>
              <SettingRow label={`空间星图粒子数量：${advancedLyricConfig.spatialParticleCount ?? 200}`}>
                <input className="setting-slider" type="range" min="50" max="500" step="10" value={advancedLyricConfig.spatialParticleCount ?? 200} onChange={(e) => updateImmersive({ spatialParticleCount: Number(e.target.value) })} />
              </SettingRow>
              <SettingRow label={`粒子发光放大系数：${advancedLyricConfig.spatialParticleSize ?? 1.0}`}>
                <input className="setting-slider" type="range" min="0.3" max="3.0" step="0.1" value={advancedLyricConfig.spatialParticleSize ?? 1.0} onChange={(e) => updateImmersive({ spatialParticleSize: Number(e.target.value) })} />
              </SettingRow>
              <SettingRow label={`星云粒子不透明度：${advancedLyricConfig.spatialParticleOpacity ?? 0.7}`}>
                <input className="setting-slider" type="range" min="0.2" max="1.0" step="0.05" value={advancedLyricConfig.spatialParticleOpacity ?? 0.7} onChange={(e) => updateImmersive({ spatialParticleOpacity: Number(e.target.value) })} />
              </SettingRow>
              <SettingRow label={`X轴低频声压扩散：${advancedLyricConfig.spatialSpreadX ?? 1.0}`}>
                <input className="setting-slider" type="range" min="0.5" max="3.0" step="0.1" value={advancedLyricConfig.spatialSpreadX ?? 1.0} onChange={(e) => updateImmersive({ spatialSpreadX: Number(e.target.value) })} />
              </SettingRow>
              <SettingRow label={`Y轴中频声压扩散：${advancedLyricConfig.spatialSpreadY ?? 1.0}`}>
                <input className="setting-slider" type="range" min="0.5" max="3.0" step="0.1" value={advancedLyricConfig.spatialSpreadY ?? 1.0} onChange={(e) => updateImmersive({ spatialSpreadY: Number(e.target.value) })} />
              </SettingRow>
              <SettingRow label={`Z轴高频声压扩散：${advancedLyricConfig.spatialSpreadZ ?? 1.0}`}>
                <input className="setting-slider" type="range" min="0.5" max="3.0" step="0.1" value={advancedLyricConfig.spatialSpreadZ ?? 1.0} onChange={(e) => updateImmersive({ spatialSpreadZ: Number(e.target.value) })} />
              </SettingRow>
              <SettingRow label={`焦外景深虚化系数：${advancedLyricConfig.spatialDepthBlur ?? 0.5}`}>
                <input className="setting-slider" type="range" min="0" max="2.0" step="0.1" value={advancedLyricConfig.spatialDepthBlur ?? 0.5} onChange={(e) => updateImmersive({ spatialDepthBlur: Number(e.target.value) })} />
              </SettingRow>
              <SettingRow label="配色方案">
                <Segment 
                  options={[
                    { value: 'adaptive', label: '星域自适应' },
                    { value: 'custom', label: '自定义颜色' }
                  ]} 
                  value={advancedLyricConfig.spatialColorMode || 'adaptive'} 
                  onChange={(v) => updateImmersive({ spatialColorMode: v })} 
                />
              </SettingRow>
              {advancedLyricConfig.spatialColorMode === 'custom' && (
                <SettingRow label="自定义星场颜色">
                  <input type="color" value={advancedLyricConfig.spatialCustomColor || '#ff4081'} onChange={(e) => updateImmersive({ spatialCustomColor: e.target.value })} style={{ width: '48px', height: '32px', padding: '0', border: 'none', borderRadius: '4px', cursor: 'pointer' }} />
                </SettingRow>
              )}
            </>
          )}

          {/* ================= 黑胶光碟 (vinyl) 可视化参数 ================= */}
          {advancedLyricConfig.lyricsMode === 'vinyl' && (
            <>
              <h4 style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--primary)', marginTop: '24px', marginBottom: '12px', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '6px' }}>黑胶盘面频谱刻槽与触针高频光圈</h4>
              <SettingRow label={`盘面频谱声部沟槽：${advancedLyricConfig.vinylGrooveCount ?? 12}圈`}>
                <input className="setting-slider" type="range" min="4" max="30" step="1" value={advancedLyricConfig.vinylGrooveCount ?? 12} onChange={(e) => updateImmersive({ vinylGrooveCount: Number(e.target.value) })} />
              </SettingRow>
              <SettingRow label={`刻线声部基础宽度：${advancedLyricConfig.vinylGrooveWidth ?? 1.0}`}>
                <input className="setting-slider" type="range" min="0.3" max="3.0" step="0.1" value={advancedLyricConfig.vinylGrooveWidth ?? 1.0} onChange={(e) => updateImmersive({ vinylGrooveWidth: Number(e.target.value) })} />
              </SettingRow>
              <SettingRow label={`低音共鸣最大振幅：${advancedLyricConfig.vinylGrooveMaxWidth ?? 4.0}`}>
                <input className="setting-slider" type="range" min="1.5" max="10.0" step="0.5" value={advancedLyricConfig.vinylGrooveMaxWidth ?? 4.0} onChange={(e) => updateImmersive({ vinylGrooveMaxWidth: Number(e.target.value) })} />
              </SettingRow>
              <SettingRow label={`声压不透明度占比：${advancedLyricConfig.vinylGrooveOpacity ?? 0.6}`}>
                <input className="setting-slider" type="range" min="0.2" max="1.0" step="0.05" value={advancedLyricConfig.vinylGrooveOpacity ?? 0.6} onChange={(e) => updateImmersive({ vinylGrooveOpacity: Number(e.target.value) })} />
              </SettingRow>
              <SettingRow label={`触点唱针光晕反射：${advancedLyricConfig.vinylStylusGlowStrength ?? 0.7}`}>
                <input className="setting-slider" type="range" min="0" max="1.5" step="0.1" value={advancedLyricConfig.vinylStylusGlowStrength ?? 0.7} onChange={(e) => updateImmersive({ vinylStylusGlowStrength: Number(e.target.value) })} />
              </SettingRow>
              <SettingRow label={`唱针漫散光圈直径：${advancedLyricConfig.vinylStylusGlowSize ?? 20}px`}>
                <input className="setting-slider" type="range" min="8" max="50" step="1" value={advancedLyricConfig.vinylStylusGlowSize ?? 20} onChange={(e) => updateImmersive({ vinylStylusGlowSize: Number(e.target.value) })} />
              </SettingRow>
              <SettingRow label="唱盘表面高反光偏振效果">
                <Toggle checked={advancedLyricConfig.vinylEdgeReflection !== false} onChange={(v) => updateImmersive({ vinylEdgeReflection: v })} />
              </SettingRow>
              <SettingRow label="配色方案">
                <Segment 
                  options={[
                    { value: 'theme', label: '跟随主题色' },
                    { value: 'white', label: '银白同心射线' }
                  ]} 
                  value={advancedLyricConfig.vinylGrooveColorMode || 'theme'} 
                  onChange={(v) => updateImmersive({ vinylGrooveColorMode: v })} 
                />
              </SettingRow>
            </>
          )}
        </div>
      </div>
    </div>
  );
  const applyEqPreset = (preset) => updateAudio({ equalizer: { ...audioConfig.equalizer, enabled: preset !== 'none', preset, bands: EQ_PRESETS[preset] || audioConfig.equalizer?.bands || EQ_PRESETS.none } });
  const renderAudioTab = () => <div className="settings-stack"><div className="settings-section"><h3 className="settings-title"><Sliders size={18} />{T.qualityEq}</h3><div className="settings-content"><SettingRow label={T.quality}><select className="setting-select" value={audioQuality} onChange={(e)=>setAudioQuality(e.target.value)}><option value="standard">{T.standard}</option><option value="higher">{T.higher}</option><option value="exhigh">{T.exhigh}</option><option value="lossless">{T.lossless}</option><option value="hires">Hi-Res</option><option value="jymaster">{T.master}</option></select></SettingRow><SettingRow label={T.enableEq}><Toggle checked={audioConfig.equalizer?.enabled} onChange={(v)=>updateAudio({equalizer:{...audioConfig.equalizer,enabled:v}})}/></SettingRow><SettingRow label={T.eqPreset}><Segment options={Object.keys(EQ_PRESETS).map(k=>({value:k,label:k==='none'?T.none:k}))} value={audioConfig.equalizer?.preset || 'none'} onChange={applyEqPreset}/></SettingRow><div className="eq-bands">{eqBands.map(band=><label key={band} className="eq-band"><span>{band}</span><input type="range" min="-12" max="12" step="1" value={audioConfig.equalizer?.bands?.[band] ?? 0} onChange={(e)=>updateAudio({equalizer:{...audioConfig.equalizer,preset:'custom',bands:{...(audioConfig.equalizer?.bands || EQ_PRESETS.none),[band]:Number(e.target.value)}}})}/><em>{audioConfig.equalizer?.bands?.[band] ?? 0}dB</em></label>)}</div></div></div><div className="settings-section"><h3 className="settings-title"><Sliders size={18} />{T.reverbRender}</h3><div className="settings-content"><SettingRow label={T.reverb}><Toggle checked={audioConfig.reverb?.enabled} onChange={(v)=>updateAudio({reverb:{...audioConfig.reverb,enabled:v}})}/></SettingRow><SettingRow label={T.reverbPreset}><Segment options={['none','hall','room','plate','spring','stadium']} value={audioConfig.reverb?.preset || 'none'} onChange={(v)=>updateAudio({reverb:{...audioConfig.reverb,enabled:v!=='none',preset:v}})}/></SettingRow><SettingRow label={`${T.mix}\uff1a${audioConfig.reverb?.mix ?? 0.3}`}><input className="setting-slider" type="range" min="0" max="1" step="0.05" value={audioConfig.reverb?.mix ?? 0.3} onChange={(e)=>updateAudio({reverb:{...audioConfig.reverb,mix:Number(e.target.value)}})}/></SettingRow><SettingRow label={`${T.decay}\uff1a${audioConfig.reverb?.decay ?? 1.5}s`}><input className="setting-slider" type="range" min="0.1" max="10" step="0.1" value={audioConfig.reverb?.decay ?? 1.5} onChange={(e)=>updateAudio({reverb:{...audioConfig.reverb,decay:Number(e.target.value)}})}/></SettingRow><SettingRow label={T.compressor}><Toggle checked={audioConfig.compressor?.enabled} onChange={(v)=>updateAudio({compressor:{...audioConfig.compressor,enabled:v}})}/></SettingRow><SettingRow label={T.spatial}><Segment options={[{value:'stereo',label:T.stereo},{value:'crossfeed',label:T.crossfeed},{value:'mono',label:T.mono}]} value={audioConfig.spatial?.mode || 'stereo'} onChange={(v)=>updateAudio({spatial:{...audioConfig.spatial,enabled:v!=='stereo',mode:v}})}/></SettingRow><SettingRow label={T.backend}><Segment options={[{value:'web audio',label:'Web Audio'},{value:'html5',label:'HTML5'}]} value={renderingConfig.audioBackend || 'web audio'} onChange={(v)=>updateRendering({audioBackend:v})}/></SettingRow><SettingRow label={T.decoder}><Segment options={['auto','wasm','native']} value={renderingConfig.decoderMode || 'auto'} onChange={(v)=>updateRendering({decoderMode:v})}/></SettingRow><SettingRow label={T.fps}><Segment options={[{value:24,label:'24'},{value:30,label:'30'},{value:60,label:'60'},{value:120,label:'120'},{value:0,label:'无限制'}]} value={renderingConfig.visualizerFps ?? 30} onChange={(v)=>updateRendering({visualizerFps:v})}/></SettingRow><SettingRow label="GPU 硬件加速" hint="开启以获得极低延迟与超高帧率渲染（需重启应用生效）"><Toggle checked={renderingConfig.hardwareAcceleration !== false} onChange={(v)=>{updateRendering({hardwareAcceleration:v}); window.electronAPI?.setHardwareAcceleration?.(v);}}/></SettingRow></div></div></div>;
  const renderShortcutsTab = () => <div className="settings-stack"><div className="settings-section"><h3 className="settings-title"><Command size={18} />{T.shortcutsTitle}</h3><div className="settings-content"><SettingRow label="启用快捷键" hint="全局开启或关闭快捷键绑定"><Toggle checked={shortcuts?.enabled !== false} onChange={(v) => saveShortcuts({ ...shortcuts, enabled: v })} /></SettingRow></div></div>{(shortcuts?.enabled !== false) && (<div className="settings-section"><h3 className="settings-title"><Command size={18} />快捷键绑定列表</h3><div className="settings-content shortcut-list">{shortcutLabels.map(([key,label,desc])=><ShortcutRow key={key} label={label} description={desc} value={shortcuts?.[key]} onChange={(value)=>saveShortcuts({...shortcuts,[key]:value})} onReset={()=>saveShortcuts({...shortcuts,[key]:DEFAULT_PROFILE.shortcuts[key]})}/>)}<button className="setting-btn danger" onClick={()=>saveShortcuts(DEFAULT_PROFILE.shortcuts)}>{T.resetShortcuts}</button></div></div>)}</div>;
  const renderNavbarTab = () => <div className="settings-section"><h3 className="settings-title"><Menu size={18} />{T.navItems}</h3><div className="settings-content">{navbarConfig.map((item,index)=><SettingRow key={item.key} label={item.name} hint={item.key}><Toggle checked={item.show} onChange={()=>handleToggleNavbarItem(index)}/></SettingRow>)}</div></div>;
  const renderAccountTab = () => <div className="settings-section"><h3 className="settings-title"><UserCheck size={18} />{T.account}</h3><div className="settings-content">{user ? <div className="account-card"><img src={user.avatarUrl} alt={user.nickname}/><div><h3>{user.nickname}</h3><p>{T.uid}: {user.userId}</p></div><button className="setting-btn danger" onClick={logout}><Power size={16}/>{T.logout}</button></div> : <div className="settings-stack"><Login onLoginSuccess={()=>setActiveTab('theme')}/><div className="settings-section inset"><h4>{T.cookieLogin}</h4><p className="settings-desc">{T.cookieDesc}</p><textarea className="settings-textarea" rows={4} value={cookieInput} onChange={(e)=>setCookieInput(e.target.value)} placeholder="MUSIC_U=xxxxx; __csrf=yyyyy;"/><button className="setting-btn active" onClick={handleCookieLogin}>{T.importCookie}</button></div></div>}</div></div>;
  const renderActiveTab = () => activeTab === 'theme' ? renderThemeTab() : activeTab === 'desktop' ? renderDesktopTab() : activeTab === 'audio' ? renderAudioTab() : activeTab === 'shortcuts' ? renderShortcutsTab() : activeTab === 'navbar' ? renderNavbarTab() : renderAccountTab();
  return <div className="view-container"><h2 style={{ fontFamily: 'var(--font-title)', fontSize: 20, fontWeight: 700, marginBottom: 24 }}>{T.title}</h2><div className="settings-shell"><aside className="settings-tabs">{tabs.map(tab=>{const Icon=tab.icon; return <button key={tab.key} className={activeTab===tab.key?'active':''} onClick={()=>setActiveTab(tab.key)}><Icon size={18}/><span>{tab.label}</span></button>;})}</aside><main className="settings-panel">{renderActiveTab()}</main></div></div>;
}
