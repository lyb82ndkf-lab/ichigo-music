import fs from 'node:fs';
import path from 'node:path';
import { parseDisplayTokens, buildGraphemeOffsets } from '../src/components/lyrics/MonetLyricsEngine.js';
import { toRubyHtml } from '../src/utils/lyrics/furiganaHelper.js';

const root = process.cwd();
const desktopLyricsSrc = fs.readFileSync(path.join(root, 'src/views/DesktopLyrics.jsx'), 'utf8');

// 1. Verify that DesktopLyrics eliminates the dangerous useEffect clear of DOM tokens
if (desktopLyricsSrc.includes('activeWordsMapRef.current.clear()') && desktopLyricsSrc.includes('useEffect(() => {\n    lastClipPathsRef.current = [];\n    activeWordsMapRef.current.clear();\n  }, [localActiveIdx])')) {
  throw new Error('DesktopLyrics must not clear activeWordsMap in a useEffect dependency on localActiveIdx; this deletes freshly mounted token refs and causes line switch stutter');
}

// 2. Verify scoped token registration mechanism
if (!desktopLyricsSrc.includes('computeTokenClipPath') || !desktopLyricsSrc.includes('paintTokensAtTime')) {
  throw new Error('DesktopLyrics must implement direct pure calculation for token clip path and paint');
}

// 3. Test token continuity during simulated line switch
const sampleLines = [
  {
    time: 10.0,
    duration: 3.0,
    text: '第一句歌词测试',
    dynamicWords: [
      { text: '第一句', startTime: 10.0, endTime: 11.2 },
      { text: '歌词', startTime: 11.2, endTime: 12.0 },
      { text: '测试', startTime: 12.0, endTime: 13.0 }
    ]
  },
  {
    time: 13.0,
    duration: 3.0,
    text: '第二句开始逐字',
    dynamicWords: [
      { text: '第二句', startTime: 13.0, endTime: 14.0 },
      { text: '开始', startTime: 14.0, endTime: 15.0 },
      { text: '逐字', startTime: 15.0, endTime: 16.0 }
    ]
  }
];

const tokensLine0 = parseDisplayTokens(sampleLines[0]);
const tokensLine1 = parseDisplayTokens(sampleLines[1]);

if (tokensLine0.length === 0 || tokensLine1.length === 0) {
  throw new Error(`Expected non-empty tokens per line, got ${tokensLine0.length} and ${tokensLine1.length}`);
}
// Verify that at transition point 13.05s, Line 1 Token 0 has immediate non-zero progress
const line1Token0 = tokensLine1[0];
const switchTime = 13.05;
const duration = line1Token0.endTime - line1Token0.startTime;
const progress = Math.max(0, Math.min(1, (switchTime - line1Token0.startTime) / duration));
if (progress <= 0 || progress > 0.2) {
  throw new Error(`Expected immediate non-zero progress at switch time 13.05s, got ${progress}`);
}
// 4. Verify Furigana Annotation Accuracy for complex phrases
const testPhrase = '自分自身いつだって最優先';
const rubyOutput = toRubyHtml(testPhrase, true);
if (!rubyOutput.includes('じ') || !rubyOutput.includes('ぶん') || !rubyOutput.includes('しん') || !rubyOutput.includes('さい') || !rubyOutput.includes('ゆう') || !rubyOutput.includes('せん')) {
  throw new Error(`Furigana failed to accurately annotate "${testPhrase}", got: ${rubyOutput}`);
}
const inflectedPhrase = '優しい思い出を抱きしめる';
const inflectedOutput = toRubyHtml(inflectedPhrase, true);
if (!inflectedOutput.includes('やさ') || !inflectedOutput.includes('おも') || !inflectedOutput.includes('で') || !inflectedOutput.includes('だ')) {
  throw new Error(`Furigana failed on inflected verbs, got: ${inflectedOutput}`);
}
const userPhrase = 'そんな人達で世界は回る';
const lineObj = { time: 0, text: userPhrase };
const displayTokens = parseDisplayTokens(lineObj);

const joinedRuby = displayTokens.map(t => t.rubyHtml || t.text).join('');
if (!joinedRuby.includes('ひと') || !joinedRuby.includes('たち') || !joinedRuby.includes('せ') || !joinedRuby.includes('かい') || !joinedRuby.includes('まわ')) {
  throw new Error(`Furigana token mapping failed for "${userPhrase}", got: ${joinedRuby}`);
}

// 5. Verify MonetWordSweep fill layer contains rubyHtml to prevent baseline jump
const monetSweepSrc = fs.readFileSync(path.join(root, 'src/components/lyrics/MonetWordSweep.jsx'), 'utf8');
if (!monetSweepSrc.includes('className="monet-word-fill"') || !monetSweepSrc.includes('dangerouslySetInnerHTML={{ __html: rubyHtml }}')) {
  throw new Error('MonetWordSweep monet-word-fill must render rubyHtml to align character baseline with base layer');
}

// 6. Verify MonetLyricsEngine measurements execution
const offsets = buildGraphemeOffsets('そんな人達で世界は回る', 36, 'sans-serif');
if (!Array.isArray(offsets) || offsets.length === 0) {
  throw new Error('buildGraphemeOffsets failed to compute offsets');
}

console.log('[desktop-lyrics] OK: line transition token dynamics, line-to-token furigana mapping, sweep baseline, and engine offsets verified');
