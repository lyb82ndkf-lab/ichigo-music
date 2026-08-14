import test from 'node:test';
import assert from 'node:assert/strict';
import { assessLyricQuality, choosePrimaryLyricLines } from './useLyricEngine.js';
import { computeLineDurations } from '../utils/lyrics/lyricParser.js';

test('accepts short line-timed lyrics without word timing', () => {
  const lines = [
    { time: 0, duration: 1.8, text: 'first line' },
    { time: 2, duration: 1.8, text: 'second line' }
  ];
  const quality = assessLyricQuality(lines, 4.2);
  assert.equal(quality.lineTimed, true);
  assert.equal(quality.wordTimed, false);
  assert.equal(quality.lowQuality, false);
});

test('accepts serialized timestamps from matched lyric providers', () => {
  const lines = [
    { time: '0.0', duration: '2.4', text: '第一句' },
    { time: '2.6', duration: '2.4', text: '第二句' },
    { time: '5.2', duration: '2.4', text: '第三句' }
  ];
  const quality = assessLyricQuality(lines, 8.4);
  assert.equal(quality.lineTimed, true);
  assert.equal(quality.lowQuality, false);
});

test('still rejects a sparse credit-only response', () => {
  const quality = assessLyricQuality([
    { time: 0, duration: 2, text: '作词：TEST' },
    { time: 3, duration: 2, text: '作曲：TEST' }
  ], 180);
  assert.equal(quality.lowQuality, true);
});

test('falls back from partial YRC to a complete line-timed LRC', () => {
  const partialYrc = [
    { time: 0, duration: 1, text: 'partial', words: [{ text: 'partial', startSec: 0, endSec: 1, durationSec: 1 }] },
    { time: 1.2, duration: 1, text: 'snippet', words: [{ text: 'snippet', startSec: 1.2, endSec: 2.2, durationSec: 1 }] }
  ];
  const completeLrc = Array.from({ length: 10 }, (_, index) => ({
    time: index * 4,
    duration: 3.2,
    text: `line ${index + 1}`
  }));
  const computedYrc = computeLineDurations(partialYrc);
  const computedLrc = computeLineDurations(completeLrc);
  assert.equal(assessLyricQuality(computedYrc, 45).likelyPartialWordTiming, true);
  assert.equal(choosePrimaryLyricLines(computedYrc, computedLrc, 45), computedLrc);
});
