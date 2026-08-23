import assert from 'node:assert';
import {
  formatTimestamp,
  formatDuration,
  extractSongMeta,
  sanitizeFilename,
  formatAsStandardLrc,
  formatAsBilingualLrc,
  formatAsYrc,
  formatAsEnhancedLrc,
  formatAsPlainText,
  formatAsTtml,
  generateLyricExport
} from '../src/utils/lyrics/lyricExporter.js';
import { isJapaneseSong, isJapaneseText } from '../src/utils/lyrics/furiganaHelper.js';

console.log('Testing lyric export and language detection functions...');

// 1. Timestamp formatting
assert.strictEqual(formatTimestamp(0), '00:00.00');
assert.strictEqual(formatTimestamp(65.456), '01:05.46');
assert.strictEqual(formatTimestamp(65.456, 3), '01:05.456');
assert.strictEqual(formatDuration(125), '02:05');

// 2. Song metadata extraction
const songSample = {
  id: 12345,
  name: '群青',
  ar: [{ name: 'YOASOBI' }],
  al: { name: 'THE BOOK' },
  duration: 202000
};
const meta = extractSongMeta(songSample);
assert.strictEqual(meta.title, '群青');
assert.strictEqual(meta.artist, 'YOASOBI');
assert.strictEqual(meta.album, 'THE BOOK');
assert.strictEqual(meta.durationSec, 202);

// 3. Filename sanitation
assert.strictEqual(sanitizeFilename('群青', 'YOASOBI', 'lrc'), 'YOASOBI - 群青.lrc');
assert.strictEqual(sanitizeFilename('AC/DC: Highway to Hell?', 'AC/DC', 'txt'), 'AC_DC - AC_DC_ Highway to Hell_.txt');

// 4. Test Chinese Song Language Discrimination (MUST NOT be identified as Japanese or have furigana)
const chineseSongSample = {
  id: 67890,
  name: '晴天',
  ar: [{ name: '周杰伦' }],
  al: { name: '叶惠美' },
  duration: 269000
};
const chineseLines = [
  { time: 10.5, text: '故事的小黄花 从出生那年就飘着' },
  { time: 15.2, text: '童年的荡秋千 随记忆一直晃到现在' },
  { time: 20.1, text: '为你翘课的那一天 花落的那一天' }
];

assert.strictEqual(isJapaneseSong(chineseLines), false, 'Chinese song should NOT be identified as Japanese song');
assert.strictEqual(isJapaneseText('故事的小黄花 从出生那年就飘着'), false, 'Chinese text should NOT be identified as Japanese text');

const chineseExportedLrc = formatAsStandardLrc(chineseLines, {
  song: chineseSongSample,
  includeFurigana: true, // Even if requested, Chinese songs must never have furigana
  furiganaMode: 'inline'
});
console.log('--- Chinese Song Export (No Furigana) ---');
console.log(chineseExportedLrc);
assert(chineseExportedLrc.includes('[00:10.50]故事的小黄花 从出生那年就飘着'));
assert(!chineseExportedLrc.includes('('), 'Chinese song must not contain furigana brackets');
assert(!chineseExportedLrc.includes('<rt>'), 'Chinese song must not contain ruby tags');

// 5. Japanese Song Sample Lyric data
const sampleLines = [
  {
    time: 0.5,
    duration: 2.5,
    text: '......',
    isInterlude: true
  },
  {
    time: 3.0,
    duration: 4.5,
    text: 'あぁ いつもの様に',
    translation: '啊 宛如往常那般',
    romaji: 'aa itsumo no you ni',
    words: [
      { startSec: 3.0, durationSec: 1.0, endSec: 4.0, text: 'あぁ ' },
      { startSec: 4.0, durationSec: 3.5, endSec: 7.5, text: 'いつもの様に' }
    ]
  },
  {
    time: 7.8,
    duration: 3.2,
    text: '過ぎてゆく日々の中で',
    translation: '在流逝而去的日子里',
    romaji: 'sugite yuku hibi no naka de',
    words: [
      { startSec: 7.8, durationSec: 1.5, endSec: 9.3, text: '過ぎてゆく' },
      { startSec: 9.3, durationSec: 1.7, endSec: 11.0, text: '日々の中で' }
    ]
  }
];

assert.strictEqual(isJapaneseSong(sampleLines), true, 'Japanese song should be identified as Japanese song');

// Test Standard LRC
const standardLrc = formatAsStandardLrc(sampleLines, { song: songSample, includeMeta: true });
console.log('--- Standard LRC Output ---');
console.log(standardLrc);
assert(standardLrc.includes('[ti:群青]'));
assert(standardLrc.includes('[ar:YOASOBI]'));
assert(standardLrc.includes('[00:03.00]あぁ いつもの様に'));
assert(standardLrc.includes('[00:07.80]過ぎてゆく日々の中で'));
assert(!standardLrc.includes('......'), 'Interlude placeholders should be filtered');

// Test Japanese LRC with Inline Furigana
const furiganaInlineLrc = formatAsStandardLrc(sampleLines, {
  song: songSample,
  includeFurigana: true,
  furiganaMode: 'inline'
});
console.log('--- Japanese LRC with Inline Furigana ---');
console.log(furiganaInlineLrc);
assert(furiganaInlineLrc.includes('様(よう)'), 'Japanese Kanji should have inline furigana annotation');

// Test Japanese LRC with Separate Furigana Lines
const furiganaSeparateLrc = formatAsStandardLrc(sampleLines, {
  song: songSample,
  includeFurigana: true,
  furiganaMode: 'separate'
});
console.log('--- Japanese LRC with Separate Furigana Lines ---');
console.log(furiganaSeparateLrc);
assert(furiganaSeparateLrc.includes('[00:03.00]あぁ いつもの様に'));
assert(furiganaSeparateLrc.includes('[00:03.00]あぁ いつものように'));

// Test Bilingual LRC (interleaved)
const bilingualInterleaved = formatAsBilingualLrc(sampleLines, { song: songSample, bilingualMode: 'interleaved' });
console.log('--- Bilingual Interleaved Output ---');
console.log(bilingualInterleaved);
assert(bilingualInterleaved.includes('[00:03.00]あぁ いつもの様に'));
assert(bilingualInterleaved.includes('[00:03.00]啊 宛如往常那般'));

// Test Bilingual LRC (combined)
const bilingualCombined = formatAsBilingualLrc(sampleLines, { song: songSample, bilingualMode: 'combined' });
console.log('--- Bilingual Combined Output ---');
console.log(bilingualCombined);
assert(bilingualCombined.includes('[00:03.00]あぁ いつもの様に (啊 宛如往常那般)'));

// Test YRC verbatim format
const yrcOutput = formatAsYrc(sampleLines, { song: songSample });
console.log('--- YRC Output ---');
console.log(yrcOutput);
assert(yrcOutput.includes('[3000,4500](3000,1000,0)あぁ (4000,3500,0)いつもの様に'));

// Test Enhanced LRC format
const enhancedLrc = formatAsEnhancedLrc(sampleLines, { song: songSample });
console.log('--- Enhanced LRC Output ---');
console.log(enhancedLrc);
assert(enhancedLrc.includes('[00:03.00]<00:03.00>あぁ <00:04.00>いつもの様に'));

// Test Plain Text format with Furigana
const plainText = formatAsPlainText(sampleLines, {
  song: songSample,
  includeTranslation: true,
  includeFurigana: true,
  furiganaMode: 'inline'
});
console.log('--- Plain Text Output ---');
console.log(plainText);
assert(plainText.includes('歌名：群青'));
assert(plainText.includes('あぁ いつもの様(よう)に'));
assert(plainText.includes('啊 宛如往常那般'));

// Test TTML format with Furigana
const ttmlOutput = formatAsTtml(sampleLines, { song: songSample, includeFurigana: true });
console.log('--- TTML Output ---');
console.log(ttmlOutput);
assert(ttmlOutput.includes('<ttm:title>群青</ttm:title>'));

// Test Universal Dispatcher
assert.strictEqual(generateLyricExport(sampleLines, 'lrc', { song: songSample }), standardLrc);
assert.strictEqual(generateLyricExport(sampleLines, 'yrc', { song: songSample }), yrcOutput);
assert.strictEqual(generateLyricExport([], 'lrc'), '暂无可用歌词数据');

console.log('All lyric export and language discrimination test assertions passed successfully!');
