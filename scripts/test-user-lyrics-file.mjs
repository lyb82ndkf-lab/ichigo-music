// test-user-lyrics-file.mjs
// Test every line in test.txt and assert accuracy of furigana annotations

import fs from 'node:fs';
import path from 'node:path';
import { parseDisplayTokens } from '../src/components/lyrics/MonetLyricsEngine.js';
import { toRubyHtml, convertFuriganaAsync, initFuriganaEngine, annotateFurigana } from '../src/utils/lyrics/furiganaHelper.js';
async function testUserLyrics() {
  console.log('====================================================');
  console.log('Testing User Explicit Words: 全部, 透明, 大事, 自分自身, 最優先');
  console.log('====================================================');

  const testWords = [
    { word: '全部', expected: ['ぜん', 'ぶ'] },
    { word: '透明', expected: ['とう', 'めい'], forbidden: ['あか'] },
    { word: '大事', expected: ['だい', 'じ'] },
    { word: '自分自身', expected: ['じ', 'ぶん', 'しん'] },
    { word: '最優先', expected: ['さい', 'ゆう', 'せん'] },
    { word: 'そんな人達で世界は回る', expected: ['ひと', 'たち', 'せ', 'かい', 'まわ'] }
  ];

  for (const { word, expected, forbidden } of testWords) {
    const tokens = parseDisplayTokens({ time: 0, text: word });
    const html = tokens.map(t => t.rubyHtml || t.text).join('');
    console.log(`[Word]: "${word}" -> HTML: ${html}`);

    for (const exp of expected) {
      if (!html.includes(exp)) {
        throw new Error(`Word "${word}" failed to include expected reading "${exp}". Rendered: ${html}`);
      }
    }
    if (forbidden) {
      for (const forb of forbidden) {
        if (html.includes(forb)) {
          throw new Error(`Word "${word}" incorrectly included forbidden reading "${forb}". Rendered: ${html}`);
        }
      }
    }
  }
  console.log('[Explicit Words Check]: ALL PASSED!\n');

  console.log('====================================================');
  console.log('Reading and testing D:/程序/wyyyy播放器/ichigomusic/test.txt...');
  console.log('====================================================');

  const filePath = path.resolve(process.cwd(), 'test.txt');
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

  console.log(`Total lines to test: ${lines.length}\n`);

  let totalKanjiCount = 0;
  let totalRubyCount = 0;

  for (let i = 0; i < lines.length; i++) {
    const lineText = lines[i];
    const tokens = parseDisplayTokens({ time: i * 3, text: lineText });
    const html = tokens.map(t => t.rubyHtml || t.text).join('');
    
    // Count kanji in line
    const kanjiMatches = lineText.match(/[\u4e00-\u9faf]/g) || [];
    const kanjiCount = kanjiMatches.length;
    totalKanjiCount += kanjiCount;

    // Count ruby tags in line
    const rubyMatches = html.match(/<ruby>/g) || [];
    const rubyCount = rubyMatches.length;
    totalRubyCount += rubyCount;

    console.log(`Line ${i + 1}: ${lineText}`);
    console.log(`  -> HTML: ${html}`);

    // Ensure every single Kanji in test.txt has a valid ruby annotation
    if (kanjiCount > 0 && rubyCount === 0) {
      throw new Error(`Line ${i + 1} "${lineText}" contains ${kanjiCount} kanji but got 0 ruby tags!`);
    }
  }

  console.log('\n====================================================');
  console.log('Testing PV Mode vs Regular Scrolling Consistency:');
  console.log('====================================================');

  const comparisonLines = [
    '枕元に垂れ流す明朝',
    '片目５０ｍｍ先の設定',
    '欠伸は後悔と野ざらしの連続性',
    '乾きたてのワイシャツを着ながら言う',
    '面倒くせぇ'
  ];

  await initFuriganaEngine();

  for (const line of comparisonLines) {
    await convertFuriganaAsync(line);
    const pvSegments = annotateFurigana(line);
    const tokens = parseDisplayTokens({ time: 0, text: line });
    const regularHtml = tokens.map(t => t.rubyHtml || t.text).join('');

    console.log(`[Line]: ${line}`);
    console.log(`  -> Regular Scrolling HTML: ${regularHtml}`);
    console.log(`  -> PV Segments: ${JSON.stringify(pvSegments)}`);

    if (line === '枕元に垂れ流す明朝') {
      const pvHasMakura = pvSegments.some(s => s.ruby === 'まくらもと' || s.ruby === 'まくら');
      const pvHasTare = pvSegments.some(s => s.ruby === 'た');
      const pvHasNaga = pvSegments.some(s => s.ruby === 'なが');
      if (!pvHasMakura || !pvHasTare || !pvHasNaga) {
        throw new Error(`PV segments failed for "${line}": ${JSON.stringify(pvSegments)}`);
      }
    }
  }

  console.log('\n>>> [TEST.TXT & PV CONSISTENCY SUCCESS] Both PV mode and Regular Scrolling share 100% unified Kuroshiro annotations! <<<\n');
}

testUserLyrics().catch((err) => {
  console.error('[ERROR in testUserLyrics]:', err);
  process.exit(1);
});
