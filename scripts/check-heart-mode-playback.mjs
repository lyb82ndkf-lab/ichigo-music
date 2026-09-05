// scripts/check-heart-mode-playback.mjs
import assert from 'node:assert/strict';

// Simulate Heart Mode Playback Engine
function createHeartModeEngine(initialSongs = []) {
  let playlist = [...initialSongs];
  let playlistIndex = 0;
  let playMode = 'sequence';
  let currentSong = null;

  const originalPlaylistBackup = [...initialSongs];
  const heartBasePool = [...initialSongs];
  const heartDiscoveryPool = [];
  let heartDiscoveryStep = 0;
  let heartBaseCountSinceLastRec = 0;
  const heartPlayedBaseIds = new Set();
  const playbackHistory = [];
  let historyIndex = -1;
  let isNavigatingHistory = false;

  const sameSongId = (a, b) => String(a ?? '') === String(b ?? '');

  function recordPlayHistory(song) {
    if (!song?.id) return;
    if (isNavigatingHistory) return;
    const currentIdx = historyIndex;
    const trimmed = currentIdx >= 0 && currentIdx < playbackHistory.length - 1
      ? playbackHistory.slice(0, currentIdx + 1)
      : [...playbackHistory];
    if (trimmed.length > 0 && sameSongId(trimmed[trimmed.length - 1]?.id, song.id)) {
      historyIndex = trimmed.length - 1;
      return;
    }
    trimmed.push(song);
    if (trimmed.length > 100) trimmed.shift();
    playbackHistory.length = 0;
    playbackHistory.push(...trimmed);
    historyIndex = trimmed.length - 1;
  }

  function playSong(song, newQueue = null) {
    if (!song) return;
    if (newQueue) {
      playlist = [...newQueue];
      playlistIndex = newQueue.findIndex(item => sameSongId(item.id, song.id));
    } else {
      const existingIdx = playlist.findIndex(item => sameSongId(item.id, song.id));
      if (existingIdx !== -1) {
        playlistIndex = existingIdx;
      } else {
        const currentIdx = playlistIndex;
        const insertIdx = currentIdx >= 0 && currentIdx < playlist.length ? currentIdx + 1 : playlist.length;
        const updatedPlaylist = [...playlist];
        updatedPlaylist.splice(insertIdx, 0, song);
        playlist = updatedPlaylist;
        playlistIndex = insertIdx;
      }
    }
    currentSong = song;
    recordPlayHistory(song);
  }

  function startHeartMode(startSong = null) {
    if (playlist.length === 0) return;
    heartPlayedBaseIds.clear();
    playbackHistory.length = 0;
    historyIndex = -1;
    heartBaseCountSinceLastRec = 0;
    heartDiscoveryStep = 0;

    const seed = startSong || playlist[0];
    heartPlayedBaseIds.add(String(seed.id));
    heartBaseCountSinceLastRec = 1;

    const seedIdx = playlist.findIndex(s => sameSongId(s.id, seed.id));
    playMode = 'heart';
    playlistIndex = seedIdx >= 0 ? seedIdx : 0;
    playSong(seed, playlist);
  }

  function addRecommendations(recs) {
    heartDiscoveryPool.push(...recs);
  }

  function playNext() {
    if (playlist.length === 0) return;

    // 1. History replay forward
    if (historyIndex >= 0 && historyIndex < playbackHistory.length - 1) {
      historyIndex += 1;
      const targetSong = playbackHistory[historyIndex];
      if (targetSong) {
        isNavigatingHistory = true;
        try {
          const songIdx = playlist.findIndex(item => sameSongId(item.id, targetSong.id));
          if (songIdx !== -1) playlistIndex = songIdx;
          playSong(targetSong);
        } finally {
          isNavigatingHistory = false;
        }
        return;
      }
    }

    if (playMode === 'heart') {
      heartDiscoveryStep += 1;
      const baseSongs = heartBasePool.length > 0 ? heartBasePool : playlist.filter(s => !s.isHeartRecommend);

      // Pacing for recommendation insertion
      const shouldDiscover = (heartBaseCountSinceLastRec >= 2) || (heartDiscoveryStep % 3 === 0);

      if (shouldDiscover && heartDiscoveryPool.length > 0) {
        const surpriseTrack = heartDiscoveryPool.shift();
        if (surpriseTrack) {
          surpriseTrack.isHeartRecommend = true;
          const currentIdx = playlist.findIndex(item => sameSongId(item.id, currentSong?.id));
          const baseIndex = currentIdx !== -1 ? currentIdx : playlistIndex;
          const insertIdx = baseIndex >= 0 ? baseIndex + 1 : playlist.length;
          const updatedPlaylist = [...playlist];
          updatedPlaylist.splice(insertIdx, 0, surpriseTrack);

          heartBaseCountSinceLastRec = 0;
          playSong(surpriseTrack, updatedPlaylist);
          return;
        }
      }

      // Pick next base song via TRUE RANDOM from songs unplayed in current cycle
      let unplayedBase = baseSongs.filter(s => !heartPlayedBaseIds.has(String(s.id)));
      if (unplayedBase.length === 0) {
        heartPlayedBaseIds.clear();
        if (currentSong?.id) heartPlayedBaseIds.add(String(currentSong.id));
        unplayedBase = baseSongs.filter(s => String(s.id) !== String(currentSong?.id));
      }

      const nextBaseSong = unplayedBase.length > 0
        ? unplayedBase[Math.floor(Math.random() * unplayedBase.length)]
        : (baseSongs.find(s => String(s.id) !== String(currentSong?.id)) || baseSongs[0]);

      if (nextBaseSong) {
        heartPlayedBaseIds.add(String(nextBaseSong.id));
        heartBaseCountSinceLastRec += 1;

        const nextIdx = playlist.findIndex(item => sameSongId(item.id, nextBaseSong.id));
        if (nextIdx !== -1) {
          playlistIndex = nextIdx;
          playSong(nextBaseSong);
        } else {
          const currentIdx = playlist.findIndex(item => sameSongId(item.id, currentSong?.id));
          const baseIndex = currentIdx !== -1 ? currentIdx : playlistIndex;
          const insertIdx = baseIndex >= 0 ? baseIndex + 1 : playlist.length;
          const updatedPlaylist = [...playlist];
          updatedPlaylist.splice(insertIdx, 0, nextBaseSong);
          playSong(nextBaseSong, updatedPlaylist);
        }
      }
    }
  }

  function playPrev() {
    if (playlist.length === 0) return;
    if (historyIndex > 0) {
      historyIndex -= 1;
      const targetSong = playbackHistory[historyIndex];
      if (targetSong) {
        isNavigatingHistory = true;
        try {
          const songIdx = playlist.findIndex(item => sameSongId(item.id, targetSong.id));
          if (songIdx !== -1) playlistIndex = songIdx;
          playSong(targetSong);
        } finally {
          isNavigatingHistory = false;
        }
      }
    }
  }

  return {
    getState: () => ({
      playlist: [...playlist],
      playlistIndex,
      currentSong,
      history: [...playbackHistory],
      historyIndex
    }),
    startHeartMode,
    addRecommendations,
    playNext,
    playPrev,
    playSong
  };
}

// TEST 1: User scenario: Playlist [1, 2, 3, 4, 5], start heart mode, play 1, play 2, insert 6, play next -> MUST NOT play 1!
const songs = [
  { id: 1, name: 'Song 1' },
  { id: 2, name: 'Song 2' },
  { id: 3, name: 'Song 3' },
  { id: 4, name: 'Song 4' },
  { id: 5, name: 'Song 5' }
];

const engine = createHeartModeEngine(songs);

// Start Heart Mode on Song 1
engine.startHeartMode(songs[0]);
assert.equal(engine.getState().currentSong.id, 1, 'Should start on Song 1');
assert.deepEqual(engine.getState().playlist.map(s => s.id), [1, 2, 3, 4, 5], 'Playlist order should NOT be scrambled');

// Add a recommended song 6
engine.addRecommendations([{ id: 6, name: 'Smart Rec 6' }]);

// Play next: base count was 1, so plays another base song (e.g. 2)
engine.playNext();
const secondSongId = engine.getState().currentSong.id;
assert.notEqual(secondSongId, 1, 'Second song should be an unplayed base song');
assert([2, 3, 4, 5].includes(secondSongId), 'Second song must be one of [2, 3, 4, 5]');

// Play next: base count is now 2, so smart recommendation 6 should be inserted!
engine.playNext();
assert.equal(engine.getState().currentSong.id, 6, 'Should play recommended Song 6');
assert.equal(engine.getState().currentSong.isHeartRecommend, true, 'Song 6 should be marked as heart recommend');
assert(engine.getState().playlist.map(s => s.id).includes(6), 'Song 6 must be in the playlist');

// Next step: the bug was that song 6 was at end of queue and wrapped to song 1 (1 -> 2 -> 6 -> 1)!
// Now, play next MUST pick from unplayed base songs, NOT jump back to 1!
engine.playNext();
const fourthSongId = engine.getState().currentSong.id;
assert.notEqual(fourthSongId, 1, 'After recommendation 6, MUST NOT jump back to Song 1!');
assert.notEqual(fourthSongId, secondSongId, 'Must not immediately repeat second song');
assert([2, 3, 4, 5].includes(fourthSongId), 'Must play an unplayed base song');

// Test playPrev
engine.playPrev();
assert.equal(engine.getState().currentSong.id, 6, 'playPrev should return to recommended Song 6');
engine.playPrev();
assert.equal(engine.getState().currentSong.id, secondSongId, 'playPrev should return to second played song');
engine.playPrev();
assert.equal(engine.getState().currentSong.id, 1, 'playPrev should return to Song 1');

// Test playNext after playPrev
engine.playNext();
assert.equal(engine.getState().currentSong.id, secondSongId, 'playNext should replay forward from history');

console.log('✅ [check-heart-mode-playback] All heart mode playback & 1-2-6-1 bug tests passed!');
