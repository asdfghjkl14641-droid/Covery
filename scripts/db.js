// ══════════════════════════════════════════════════════════
//  D1 Database Helper (common for all data-collection scripts)
// ══════════════════════════════════════════════════════════
// Writes Node-side data directly to the remote Cloudflare D1 database
// via `wrangler d1 execute`. Batches SQL into temporary files for
// performance (single statements are very slow per round-trip).
//
// Usage:
//   const db = require('./db');
//   db.batchInsertArtists([{name, reading, spotifyId, imageUrl}, ...]);
//   db.batchInsertSongs([{title, artistName, deezerRank, genre}, ...]);
//   db.batchInsertChannels([{channelId, channelName, ...}], 'pending');
//   db.batchInsertCovers([{videoId, songTitle, artistName, channelId, ...}]);
// ══════════════════════════════════════════════════════════

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const WORKER_DIR = path.join(__dirname, '..', 'worker');
const BATCH_SIZE = 50;

function esc(s) {
  return String(s == null ? '' : s).replace(/'/g, "''");
}

// Execute raw SQL via wrangler (single short command)
function executeSQL(sql) {
  try {
    const result = execSync(
      `npx wrangler d1 execute covery-db --remote --command="${sql.replace(/"/g, '\\"')}"`,
      { cwd: WORKER_DIR, encoding: 'utf8', timeout: 60000, stdio: ['ignore', 'pipe', 'pipe'] }
    );
    return result;
  } catch (error) {
    console.error('[D1] SQL execute failed:', error.message?.slice(0, 200));
    return null;
  }
}

// Execute an SQL file via wrangler
function executeSQLFile(filePath) {
  try {
    const result = execSync(
      `npx wrangler d1 execute covery-db --remote --file="${filePath}"`,
      { cwd: WORKER_DIR, encoding: 'utf8', timeout: 120000, stdio: ['ignore', 'pipe', 'pipe'] }
    );
    return result;
  } catch (error) {
    console.error('[D1] SQL file execute failed:', error.message?.slice(0, 200));
    return null;
  }
}

// Batch execute statements by writing chunks to a temp .sql file
function batchExecute(statements, label = 'batch') {
  if (!statements || statements.length === 0) return 0;
  let ok = 0;
  for (let i = 0; i < statements.length; i += BATCH_SIZE) {
    const chunk = statements.slice(i, i + BATCH_SIZE);
    const body = chunk.map(s => s.endsWith(';') ? s : s + ';').join('\n');
    const tmp = path.join(os.tmpdir(), `covery_${label}_${Date.now()}_${i}.sql`);
    fs.writeFileSync(tmp, body);
    const res = executeSQLFile(tmp);
    try { fs.unlinkSync(tmp); } catch (_) {}
    if (res !== null) {
      ok += chunk.length;
      console.log(`[D1] ${label} batch ${Math.floor(i / BATCH_SIZE) + 1}: ${chunk.length} statements`);
    }
  }
  return ok;
}

// ── Artists ──
function batchInsertArtists(artists) {
  const stmts = artists.map(a => {
    const name = esc(a.name);
    const reading = esc(a.reading || '');
    return `INSERT OR IGNORE INTO artists (name, reading) VALUES ('${name}', '${reading}')`;
  });
  return batchExecute(stmts, 'artists');
}

// ── Songs ──
function batchInsertSongs(songs) {
  const stmts = songs.map(s => {
    const title = esc(s.title);
    const artist = esc(s.artistName);
    const rank = parseInt(s.deezerRank || 0, 10) || 0;
    return `INSERT OR IGNORE INTO songs (title, artist_id, deezer_rank) VALUES ('${title}', (SELECT id FROM artists WHERE name = '${artist}'), ${rank})`;
  });
  return batchExecute(stmts, 'songs');
}

// ── Channels ──
// status = 'pending' | 'approved' etc.; existing rows are not overwritten (INSERT OR IGNORE)
function batchInsertChannels(channels, status = 'pending') {
  const stmts = channels.map(c => {
    const cid = esc(c.channelId);
    const name = esc(c.channelName || c.name || '');
    const thumb = esc(c.thumbnailUrl || '');
    const subs = parseInt(c.subscriberCount || 0, 10) || 0;
    const st = esc(status);
    return `INSERT OR IGNORE INTO channels (channel_id, channel_name, channel_url, thumbnail_url, subscriber_count, status) VALUES ('${cid}', '${name}', 'https://www.youtube.com/channel/${cid}', '${thumb}', ${subs}, '${st}')`;
  });
  return batchExecute(stmts, 'channels');
}

// ── Covers ──
function batchInsertCovers(covers) {
  const stmts = covers.map(c => {
    const vid = esc(c.videoId);
    const songTitle = esc(c.songTitle);
    const artist = esc(c.artistName);
    const channelId = esc(c.channelId);
    const ytTitle = esc(c.youtubeTitle || '');
    const views = parseInt(c.viewCount || 0, 10) || 0;
    const published = esc(c.publishedAt || '');
    const duration = parseInt(c.duration || 0, 10) || 0;
    return `INSERT OR IGNORE INTO covers (video_id, song_id, channel_id, youtube_title, view_count, published_at, duration) VALUES ('${vid}', (SELECT id FROM songs WHERE title = '${songTitle}' AND artist_id = (SELECT id FROM artists WHERE name = '${artist}')), (SELECT id FROM channels WHERE channel_id = '${channelId}'), '${ytTitle}', ${views}, '${published}', ${duration})`;
  });
  return batchExecute(stmts, 'covers');
}

// Check whether wrangler/auth are available — returns true if we can run against D1
function isAvailable() {
  if (process.env.COVERY_SKIP_D1 === '1') return false;
  try {
    execSync('npx wrangler --version', { cwd: WORKER_DIR, stdio: 'ignore', timeout: 15000 });
    return true;
  } catch (_) { return false; }
}

export {
  executeSQL,
  executeSQLFile,
  batchExecute,
  esc as escape,
  batchInsertArtists,
  batchInsertSongs,
  batchInsertChannels,
  batchInsertCovers,
  isAvailable,
};

export default {
  executeSQL,
  executeSQLFile,
  batchExecute,
  escape: esc,
  batchInsertArtists,
  batchInsertSongs,
  batchInsertChannels,
  batchInsertCovers,
  isAvailable,
};
