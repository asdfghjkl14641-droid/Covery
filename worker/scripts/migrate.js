// D1データベース移行スクリプト
//
// 実行手順:
// 1. cd worker
// 2. npx wrangler d1 create covery-db
// 3. 表示されるdatabase_idをwrangler.tomlに記入
// 4. npx wrangler d1 execute covery-db --local --file=schema.sql
// 5. node scripts/migrate.js          ← このスクリプト（migration.sql生成）
// 6. npx wrangler d1 execute covery-db --local --file=scripts/migration.sql
//
// 本番環境にデプロイするときは --local を外す:
//   npx wrangler d1 execute covery-db --remote --file=scripts/migration.sql

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT = path.resolve(__dirname, '../..')

const CATALOG_FILE = path.join(ROOT, 'src/data/songCatalog.json')
const METADATA_FILE = path.join(ROOT, 'src/data/metadata.json')
const CACHE_FILE = path.join(ROOT, 'src/data/apiCache.json')
const OUTPUT_FILE = path.join(__dirname, 'migration.sql')

// SQL string escape (single quote → double single quote)
function esc(v) {
  if (v === null || v === undefined) return 'NULL'
  if (typeof v === 'number') return String(v)
  if (typeof v === 'boolean') return v ? '1' : '0'
  return "'" + String(v).replace(/'/g, "''") + "'"
}

console.log('=== Covery D1 Migration SQL Generator ===\n')

const catalog = JSON.parse(fs.readFileSync(CATALOG_FILE, 'utf8'))
const metadata = JSON.parse(fs.readFileSync(METADATA_FILE, 'utf8'))
let cache = { youtubeSearches: {}, youtubeChannels: {}, youtubeVideos: {}, deezerTracks: {}, spotifyArtists: {} }
if (fs.existsSync(CACHE_FILE)) cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'))

const lines = []
lines.push('-- Covery D1 Migration (auto-generated)')
lines.push('-- Do not edit manually — regenerate via `node scripts/migrate.js`')
lines.push('')
lines.push('BEGIN TRANSACTION;')
lines.push('')

// ── 1. artists ──
let artistCount = 0
lines.push('-- Artists')
for (const artist of catalog.artists) {
  lines.push(
    `INSERT OR IGNORE INTO artists (name, spotify_id, reading) VALUES (${esc(artist.name)}, ${esc(artist.spotifyId || null)}, ${esc(artist.reading || null)});`
  )
  artistCount++
}
lines.push('')

// ── 2. songs (need artist_id lookup, done via subquery) ──
let songCount = 0
lines.push('-- Songs')
// We need to deduplicate by (title, artist) since catalog may have repeats
const songKeys = new Set()
for (const artist of catalog.artists) {
  for (const song of (artist.songs || [])) {
    const key = `${artist.name}|||${song.title}`
    if (songKeys.has(key)) continue
    songKeys.add(key)
    lines.push(
      `INSERT OR IGNORE INTO songs (title, artist_id, deezer_rank, genre) ` +
      `SELECT ${esc(song.title)}, id, ${esc(song.deezerRank || 0)}, ${esc('J-POP')} FROM artists WHERE name = ${esc(artist.name)};`
    )
    songCount++
  }
}
lines.push('')

// ── 3. channels (singers from metadata) ──
let channelCount = 0
lines.push('-- Channels (singers)')
for (const singer of (metadata.singers || [])) {
  lines.push(
    `INSERT OR IGNORE INTO channels (channel_id, channel_name, channel_url, thumbnail_url, subscriber_count, status) VALUES (` +
    `${esc(singer.channelId)}, ${esc(singer.name)}, ${esc(`https://www.youtube.com/channel/${singer.channelId}`)}, ` +
    `${esc(singer.thumbnailUrl || null)}, ${esc(singer.subscriberCount || 0)}, ${esc('pending')});`
  )
  channelCount++
}
lines.push('')

// ── 4. covers ──
let coverCount = 0
lines.push('-- Covers')
for (const song of (metadata.songs || [])) {
  for (const cover of (song.covers || [])) {
    if (!cover.videoId || !cover.singerId) continue
    // Look up song_id by (title, artist name) and channel_id by channel_id string
    lines.push(
      `INSERT OR IGNORE INTO covers (video_id, song_id, channel_id, youtube_title, view_count, published_at, status) ` +
      `SELECT ${esc(cover.videoId)}, s.id, c.id, ${esc(song.singerName || null)}, ${esc(cover.viewCount || 0)}, ` +
      `${esc(cover.publishedAt || null)}, ${esc('approved')} ` +
      `FROM songs s JOIN artists a ON s.artist_id = a.id, channels c ` +
      `WHERE s.title = ${esc(song.title)} AND a.name = ${esc(song.originalArtist)} AND c.channel_id = ${esc(cover.singerId)};`
    )
    coverCount++
  }
}
lines.push('')

// ── 5. api_cache ──
let cacheCount = 0
lines.push('-- API cache')
for (const category of Object.keys(cache)) {
  const entries = cache[category] || {}
  for (const [key, entry] of Object.entries(entries)) {
    const cacheKey = `${category}:${key}`
    const dataJson = JSON.stringify(entry?.data ?? entry)
    const fetchedAt = entry?.fetchedAt || new Date().toISOString()
    lines.push(
      `INSERT OR IGNORE INTO api_cache (cache_key, category, data, fetched_at) VALUES (` +
      `${esc(cacheKey)}, ${esc(category)}, ${esc(dataJson)}, ${esc(fetchedAt)});`
    )
    cacheCount++
  }
}
lines.push('')

lines.push('COMMIT;')
lines.push('')

fs.writeFileSync(OUTPUT_FILE, lines.join('\n'))

console.log(`アーティスト: ${artistCount}件をINSERT`)
console.log(`曲: ${songCount}件をINSERT`)
console.log(`チャンネル: ${channelCount}件をINSERT`)
console.log(`カバー: ${coverCount}件をINSERT`)
console.log(`APIキャッシュ: ${cacheCount}件をINSERT`)
console.log(`\n生成先: ${OUTPUT_FILE}`)
console.log(`\n次のコマンドで実行:`)
console.log(`  cd worker && npx wrangler d1 execute covery-db --local --file=scripts/migration.sql`)
