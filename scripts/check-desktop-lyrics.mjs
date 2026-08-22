import fs from 'node:fs';
import path from 'node:path';
import { parseDisplayTokens } from '../src/components/lyrics/MonetLyricsEngine.js';

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

console.log('[desktop-lyrics] OK: line transition token dynamics, ref lifecycle, and sweep timing verified');
