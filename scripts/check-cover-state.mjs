import assert from 'node:assert/strict';
import {
  getPersistentSongCoverUrl,
  getRemoteSongCoverUrl,
  getSongCoverUrl
} from '../src/utils/songCover.js';

const remote = 'https://example.test/cover.jpg';
const cached = 'file:///C:/cache/covers/42.jpg';

assert.equal(getSongCoverUrl({ coverUrl: remote }, true), remote);
assert.equal(getRemoteSongCoverUrl({ coverUrl: cached, originalCoverUrl: remote }), remote);
assert.equal(getRemoteSongCoverUrl({ coverUrl: cached, originalCoverUrl: cached }), '');
assert.equal(
  getPersistentSongCoverUrl({ id: 42, coverUrl: remote }, { url: cached, remoteUrl: '' }),
  remote,
  'a cache hit must not replace the existing remote cover'
);
assert.equal(
  getPersistentSongCoverUrl({ id: 42, coverUrl: cached }, { url: cached, remoteUrl: remote }),
  remote,
  'a repaired detail URL must replace legacy file-only metadata'
);
assert.equal(
  getPersistentSongCoverUrl({ id: 42, coverUrl: cached }, { url: cached, remoteUrl: '' }),
  '',
  'file URLs must never be persisted as the only cover fallback'
);

console.log('[cover-state] OK: cached files never overwrite durable cover metadata');
