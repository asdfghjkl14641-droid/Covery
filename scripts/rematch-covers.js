import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { matchSongTitle } from './matchSong.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const METADATA_FILE = path.join(__dirname, '../src/data/metadata.json')
const CACHE_FILE = path.join(__dirname, '../src/data/apiCache.json')
const CATALOG_FILE = path.join(__dirname, '../src/data/songCatalog.json')

console.log('=== Covery Cover Re-matcher ===\n')

const metadata = JSON.parse(fs.readFileSync(METADATA_FILE, 'utf8'))
const catalog = JSON.parse(fs.readFileSync(CATALOG_FILE, 'utf8'))

// Load apiCache for original video titles
let cache = { youtubeSearches: {} }
try { cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8')) } catch {}

// Build video title lookup from cache
const videoTitleMap = new Map()
for (const [, entry] of Object.entries(cache.youtubeSearches || {})) {
  if (entry?.data && Array.isArray(entry.data)) {
    for (const item of entry.data) {
      const vid = item.id?.videoId || item.videoId
      const title = item.snippet?.title
      if (vid && title) videoTitleMap.set(vid, title)
    }
  }
}
console.log(`キャッシュから動画タイトル: ${videoTitleMap.size}件\n`)

const beforeSongs = metadata.songs.length
let removed = 0
let kept = 0
const removedExamples = []

// For each song, check if its covers actually match the claimed title
const newSongs = []
for (const song of metadata.songs) {
  const validCovers = []

  for (const cover of song.covers) {
    const cachedTitle = videoTitleMap.get(cover.videoId)

    if (!cachedTitle) {
      // No cached title — keep it (can't verify)
      validCovers.push(cover)
      kept++
      continue
    }

    // Re-match using strict logic
    if (matchSongTitle(cachedTitle, song.title, song.originalArtist)) {
      validCovers.push(cover)
      kept++
    } else {
      removed++
      if (removedExamples.length < 20) {
        removedExamples.push(`  "${cachedTitle}" was tagged as "${song.title}" (${song.originalArtist}) → REMOVED`)
      }
    }
  }

  if (validCovers.length > 0) {
    newSongs.push({ ...song, covers: validCovers })
  }
}

metadata.songs = newSongs

// Rebuild singers
const activeSingerIds = new Set()
metadata.songs.forEach(s => s.covers.forEach(c => activeSingerIds.add(c.singerId)))
metadata.singers = metadata.singers.filter(s => activeSingerIds.has(s.channelId))

fs.writeFileSync(METADATA_FILE, JSON.stringify(metadata, null, 2))

console.log(`再マッチング前: ${beforeSongs}曲`)
console.log(`正当なカバー: ${kept}件`)
console.log(`誤マッチ除外: ${removed}件`)
console.log(`再マッチング後: ${metadata.songs.length}曲`)
console.log(`歌い手: ${metadata.singers.length}人`)

if (removedExamples.length > 0) {
  console.log(`\n除外例:`)
  removedExamples.forEach(e => console.log(e))
}

// Show problem titles stats
const titleCounts = new Map()
metadata.songs.forEach(s => titleCounts.set(s.title, (titleCounts.get(s.title) || 0) + 1))
const top = [...titleCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)
console.log('\nカバー数TOP10:')
top.forEach(([t, c]) => console.log(`  ${t}: ${c}件`))
