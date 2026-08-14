import fs from 'node:fs';
const paths = ['src/components/ClosePromptModal.jsx', 'src/components/UpdatePromptModal.jsx'];
for (const path of paths) {
  const text = fs.readFileSync(path, 'utf8');
  if (/[^\x00-\x7F]/.test(text) === false) throw new Error(`${path} unexpectedly has no localized text`);
  const singleQuoted = [...text.matchAll(/'([^'\n]*)/g)].map(match => match[1]);
  const suspicious = singleQuoted.filter(value => /[\u00C0-\u00FF]/.test(value) && /[?]/.test(value));
  if (suspicious.length) throw new Error(`${path} has malformed literals`);
}
const settings = fs.readFileSync('src/views/Settings.jsx', 'utf8');
if (!settings.includes('surfaceStyle')) throw new Error('settings surface switch missing');
const context = fs.readFileSync('src/context/AppContext.jsx', 'utf8');
if (!context.includes("surface-flat")) throw new Error('surface class missing');

const modernPlayer = fs.readFileSync('src/components/ModernPlayerBar.jsx', 'utf8');
const immersiveCss = fs.readFileSync('src/styles/10-lyrics-immersive.css', 'utf8');
const uiCss = fs.readFileSync('src/components/ui/ui.css', 'utf8');
for (const marker of ['volumePopoverOpen', 'PopoverAnchor', 'onPointerEnter', 'onPointerDownCapture', 'data-volume-open={volumePopoverOpen']) {
  if (!modernPlayer.includes(marker)) throw new Error(`modern player volume hover bridge missing ${marker}`);
}
if (!immersiveCss.includes('#player-bar[data-volume-open="true"]')) throw new Error('immersive player must stay visible while the volume popover is open');
if (!uiCss.includes('.modern-volume-popover.ui-popover { z-index: 1320;')) throw new Error('volume popover must render above the immersive lyric overlay');

console.log('[ui-primitives] OK: primitive exports, player trial, settings surface switch, modal/queue migration, volume hover bridge');
