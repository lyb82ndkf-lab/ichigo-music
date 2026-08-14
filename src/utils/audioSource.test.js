import test from 'node:test';
import assert from 'node:assert/strict';
import { isLegacyFileMediaSource, isLocalMediaSource } from './audioSource.js';

test('recognizes cached file URLs as local media sources', () => {
  assert.equal(isLocalMediaSource('file:///D:/ichigo-cache/audio/123.mp3'), true);
  assert.equal(isLocalMediaSource('ichigo-cache://audio/abc123'), true);
  assert.equal(isLocalMediaSource('https://music.example.test/123.mp3'), false);
  assert.equal(isLocalMediaSource(''), false);
  assert.equal(isLegacyFileMediaSource('file:///D:/ichigo-cache/audio/123.mp3'), true);
  assert.equal(isLegacyFileMediaSource('ichigo-cache://audio/abc123'), false);
});
