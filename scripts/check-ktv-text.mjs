import { mergeTimedMixedTokens, segmentLyricPhrase, segmentMixedTokens } from '../src/utils/ktvText.js';

const phraseCases = [
  ['大人になって分かったこと', 'ja', ['大人になって', '分かったこと']],
  ['誰かを怒らせちゃうこと', 'ja', ['誰かを', '怒らせちゃうこと']],
  ['「もういいよ」の本当の気持ちを', 'ja', ['「もういいよ」の', '本当の', '気持ちを']],
  ['短い歌', 'ja', ['短い歌']],
  ['hello world', 'en', ['hello world']]
];

for (const [text, locale, expected] of phraseCases) {
  const actual = segmentLyricPhrase(text, locale);
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`[ktv-text] ${text}: expected ${expected.join(' / ')}, got ${actual.join(' / ')}`);
  }
}

const tokenCases = [
  ['hello world', ['hello ', 'world']],
  ['Hello, world!', ['Hello, ', 'world!']],
  ['「Hello world」日本語', ['「Hello ', 'world」', '日', '本', '語']],
  ['안녕 hello world', ['안녕 ', 'hello ', 'world']],
  ['日本語English한국어', ['日', '本', '語', 'English', '한국어']],
  ['한국어 English 日本語', ['한국어 ', 'English ', '日', '本', '語']],
  ['한국English', ['한국', 'English']]
];

const timedMerge = mergeTimedMixedTokens('hello 世界', [
  { text: 'h', start: 0, end: 0.1 }, { text: 'e', start: 0.1, end: 0.2 },
  { text: 'l', start: 0.2, end: 0.3 }, { text: 'l', start: 0.3, end: 0.4 },
  { text: 'o', start: 0.4, end: 0.5 }, { text: ' ', start: 0.5, end: 0.55 },
  { text: '世', start: 0.55, end: 0.75 }, { text: '界', start: 0.75, end: 0.95 }
]);
if (JSON.stringify(timedMerge.map(token => token.text)) !== JSON.stringify(['hello ', '世', '界'])) {
  throw new Error(`[ktv-text-timed] expected hello / 世 / 界 got ${timedMerge.map(token => token.text).join(' / ')}`);
}

for (const [text, expected] of tokenCases) {
  const actual = segmentMixedTokens(text).map(token => token.text);
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`[ktv-text-tokens] ${text}: expected ${expected.join(' / ')}, got ${actual.join(' / ')}`);
  }
}

console.log(`[ktv-text] OK: ${phraseCases.length} phrase and ${tokenCases.length} mixed-script token cases`);
