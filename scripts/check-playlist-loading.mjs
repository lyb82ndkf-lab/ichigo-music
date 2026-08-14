import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const liked = fs.readFileSync(path.join(root, 'src/views/MyLiked.jsx'), 'utf8');
const detail = fs.readFileSync(path.join(root, 'src/views/PlaylistDetail.jsx'), 'utf8');
const miniQueue = fs.readFileSync(path.join(root, 'src/components/MiniQueuePopover.jsx'), 'utf8');
const playerBar = fs.readFileSync(path.join(root, 'src/components/PlayerBar.jsx'), 'utf8');
const serverModule = fs.readFileSync(path.join(root, 'server/module/playlist_track_all.js'), 'utf8');

const checks = [
  ['favourites use a bounded first page', /const pageSize = 500/u.test(liked)],
  ['favourites continue from the returned offset', /getPlaylistTracks\(likedPlaylistId, pageSize, offset\)/u.test(liked)],
  ['favourites do not refetch on every liked-id Set identity change', /\}, \[user\?\.userId, likedPlaylistId\]\);/u.test(liked)],
  ['favourites render only the visible window', /songs\.slice\(0, visibleCount\)/u.test(liked)],
  ['playlist detail uses bounded pages', /const pageSize = 500;/u.test(detail)],
  ['modern queue renders a visible window', /playlist\.slice\(0, visibleCount\)/u.test(miniQueue)],
  ['classic queue renders a visible window', /playlist\.slice\(0, queueVisibleCount\)/u.test(playerBar)],
  ['server splits detail requests into bounded batches', /const batchSize = 500/u.test(serverModule) && /for \(let start = 0; start < selected\.length; start \+= batchSize\)/u.test(serverModule)],
  ['server preserves the complete queue response', /res\.body\.playlist\.tracks = songs/u.test(serverModule) && /res\.body\.songs = songs/u.test(serverModule)],
];

const failed = checks.filter(([, passed]) => !passed).map(([label]) => label);
if (failed.length) {
  console.error(`[playlist-loading] FAILED: ${failed.join('; ')}`);
  process.exit(1);
}

console.log(`[playlist-loading] OK: ${checks.length} large-list loading invariants`);
