// scripts/check-heatmap-and-audio-match.mjs - Verification test suite
import assert from 'assert';
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');

console.log('🧪 Starting Listening Heatmap and Audio Match Verification...\n');

// 1. Test listeningHeatmap utility functions
import {
  formatToDateKey,
  formatDateChinese,
  getLevelFromCount,
  generateYearGrid,
  generateMonthGrid
} from '../src/utils/listeningHeatmap.js';

console.log('1️⃣ Testing Listening Heatmap Utility...');
const testDate = new Date('2026-08-28T12:00:00Z').getTime();
const dateKey = formatToDateKey(testDate);
assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(dateKey), `Invalid date key: ${dateKey}`);
console.log(`  ✔ formatToDateKey: ${dateKey}`);

const zhDate = formatDateChinese('2026-08-28');
assert.ok(zhDate.includes('2026年8月28日'), `Invalid chinese date format: ${zhDate}`);
console.log(`  ✔ formatDateChinese: ${zhDate}`);

assert.strictEqual(getLevelFromCount(0), 0);
assert.strictEqual(getLevelFromCount(2), 1);
assert.strictEqual(getLevelFromCount(6), 2);
assert.strictEqual(getLevelFromCount(12), 3);
assert.strictEqual(getLevelFromCount(25), 4);
console.log('  ✔ getLevelFromCount thresholds (0, 1, 2, 3, 4) verified');

// Test Year Grid Generation
const mockDateMap = new Map();
mockDateMap.set('2026-08-28', { date: '2026-08-28', count: 15, level: 3, topSong: { name: 'Test Song' } });
mockDateMap.set('2026-08-27', { date: '2026-08-27', count: 5, level: 2 });

const yearGrid = generateYearGrid(2026, mockDateMap);
assert.ok(yearGrid.weeks.length >= 52, `Year grid should have >= 52 weeks, got ${yearGrid.weeks.length}`);
assert.ok(yearGrid.monthLabels.length >= 8, `Month labels missing: ${yearGrid.monthLabels.length}`);
console.log(`  ✔ generateYearGrid generated ${yearGrid.weeks.length} weeks and ${yearGrid.monthLabels.length} month headers`);

// Test Month Grid Generation
const monthGrid = generateMonthGrid(2026, 7, mockDateMap); // August
assert.ok(monthGrid.weeks.length >= 5, `Month grid should have >= 5 weeks, got ${monthGrid.weeks.length}`);
console.log(`  ✔ generateMonthGrid for August 2026: ${monthGrid.weeks.length} weeks`);

// 2. Test Audio Fingerprint WASM Extraction
console.log('\n2️⃣ Testing Audio Fingerprint WASM Engine...');
const wasmPath = path.join(root, 'public/afp/afp.wasm.js');
const afpPath = path.join(root, 'public/afp/afp.js');
const recPath = path.join(root, 'public/afp/rec.js');

assert.ok(fs.existsSync(wasmPath), 'afp.wasm.js missing in public/afp');
assert.ok(fs.existsSync(afpPath), 'afp.js missing in public/afp');
assert.ok(fs.existsSync(recPath), 'rec.js missing in public/afp');

const wasmCode = fs.readFileSync(wasmPath, 'utf8');
const afpCode = fs.readFileSync(afpPath, 'utf8');

const ctx = {
  console,
  atob: (s) => Buffer.from(s, 'base64').toString('binary'),
  btoa: (b) => Buffer.from(b, 'binary').toString('base64'),
  setTimeout,
  clearTimeout,
  setInterval,
  clearInterval
};
vm.createContext(ctx);
vm.runInContext(wasmCode, ctx);
vm.runInContext(afpCode, ctx);

assert.strictEqual(typeof ctx.GenerateFP, 'function', 'GenerateFP is not exported in WASM context');

const dummyPCM = new Float32Array(8000 * 3);
for (let i = 0; i < dummyPCM.length; i++) {
  dummyPCM[i] = Math.sin(2 * Math.PI * 440 * (i / 8000)); // 440Hz Sine Tone
}

const fpResult = await ctx.GenerateFP(dummyPCM);
assert.ok(typeof fpResult === 'string' && fpResult.length > 50, `Invalid audio fingerprint: ${fpResult}`);
console.log(`  ✔ WASM Fingerprint generated successfully: ${fpResult.slice(0, 32)}... (len: ${fpResult.length})`);

// 3. Test Component and API wiring
console.log('\n3️⃣ Testing Component & Endpoint Wiring...');
import { api } from '../src/utils/api.js';
assert.strictEqual(typeof api.audioMatch, 'function', 'api.audioMatch endpoint function is missing');
assert.strictEqual(typeof api.getRecentSongs, 'function', 'api.getRecentSongs endpoint function is missing');
console.log('  ✔ api.audioMatch and api.getRecentSongs available');

const modernControlsCode = fs.readFileSync(path.join(root, 'src/components/ModernTopControls.jsx'), 'utf8');
assert.ok(modernControlsCode.includes('setIsAudioMatchOpen'), 'ModernTopControls missing setIsAudioMatchOpen');
assert.ok(modernControlsCode.includes('听歌识曲'), 'ModernTopControls missing 听歌识曲 button');
console.log('  ✔ ModernTopControls has search box Audio Match button');

const searchViewCode = fs.readFileSync(path.join(root, 'src/views/Search.jsx'), 'utf8');
assert.ok(searchViewCode.includes('setIsAudioMatchOpen'), 'Search view missing setIsAudioMatchOpen');
assert.ok(searchViewCode.includes('听歌识曲'), 'Search view missing 听歌识曲 button');
console.log('  ✔ Search view has search bar Audio Match button');

const recentlyPlayedCode = fs.readFileSync(path.join(root, 'src/views/RecentlyPlayed.jsx'), 'utf8');
assert.ok(recentlyPlayedCode.includes('ListeningHeatmap'), 'RecentlyPlayed missing ListeningHeatmap component');
assert.ok(recentlyPlayedCode.includes('听歌历史足迹日历'), 'RecentlyPlayed missing 听歌历史足迹日历 tab');
console.log('  ✔ RecentlyPlayed has Listening Heatmap calendar tab');

const appCode = fs.readFileSync(path.join(root, 'src/App.jsx'), 'utf8');
assert.ok(appCode.includes('AudioMatchModal'), 'App.jsx missing AudioMatchModal');
assert.ok(appCode.includes('isAudioMatchOpen'), 'App.jsx missing isAudioMatchOpen state');
console.log('  ✔ App.jsx wires AudioMatchModal');

console.log('\n🎉 ALL 3 VERIFICATION STAGES PASSED!\n');
