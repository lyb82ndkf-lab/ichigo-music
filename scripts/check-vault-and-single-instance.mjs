import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

console.log('🧪 Testing Single Instance Lock and C-Drive History Vault...');

// 1. Verify main-electron.js implementation
const mainSrc = fs.readFileSync(path.join(root, 'main-electron.js'), 'utf8');

if (!mainSrc.includes('app.requestSingleInstanceLock()') || !mainSrc.includes('gotTheLock')) {
  throw new Error('main-electron.js must implement app.requestSingleInstanceLock()');
}

if (!mainSrc.includes('dialog.showMessageBoxSync') || !mainSrc.includes('ICHIGOMusic 已在运行中')) {
  throw new Error('main-electron.js must show a warning dialog when repeat launch is detected');
}

if (!mainSrc.includes("app.on('second-instance'")) {
  throw new Error('main-electron.js must listen for second-instance to focus existing window');
}

if (!mainSrc.includes('getListeningVaultPaths') || !mainSrc.includes('readListeningVaultFromDisk') || !mainSrc.includes('writeListeningVaultToDisk')) {
  throw new Error('main-electron.js must implement durable C-Drive listening vault helpers');
}

if (!mainSrc.includes('get-listening-history-vault') || !mainSrc.includes('save-listening-history-vault') || !mainSrc.includes('append-listening-history-vault')) {
  throw new Error('main-electron.js must register listening history vault IPC handlers');
}

// 2. Verify preload-electron.cjs IPC bridge
const preloadSrc = fs.readFileSync(path.join(root, 'preload-electron.cjs'), 'utf8');
if (!preloadSrc.includes('getListeningHistoryVault') || !preloadSrc.includes('saveListeningHistoryVault') || !preloadSrc.includes('appendListeningHistoryVault')) {
  throw new Error('preload-electron.cjs must expose getListeningHistoryVault, saveListeningHistoryVault, and appendListeningHistoryVault');
}

// 3. Verify listeningHeatmap.js and listeningStats.js integration
const heatmapSrc = fs.readFileSync(path.join(root, 'src/utils/listeningHeatmap.js'), 'utf8');
const statsSrc = fs.readFileSync(path.join(root, 'src/utils/listeningStats.js'), 'utf8');

if (!heatmapSrc.includes('getListeningHistoryVault')) {
  throw new Error('listeningHeatmap.js must pull from getListeningHistoryVault before computing heatmap');
}

if (!statsSrc.includes('saveListeningHistoryVault') || !statsSrc.includes('appendListeningHistoryVault')) {
  throw new Error('listeningStats.js must persist into disk vault on playback and save');
}

console.log('✅ [check:vault-and-single-instance] All Single Instance Lock and C-Drive History Vault checks passed successfully!');
