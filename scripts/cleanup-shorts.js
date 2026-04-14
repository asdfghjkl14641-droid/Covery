import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const METADATA_FILE = path.join(__dirname, '../src/data/metadata.json')
const PREVIEW_FILE = path.join(__dirname, '../src/data/previewChannels.json')
const CACHE_FILE = path.join(__dirname, '../src/data/apiCache.json')

const SHORTS_PATTERNS = [
  '#shorts', '#short', '#Shorts', '#SHORT',
  'shorts', 'Shorts', 'SHORT',
]

function isShort(title) {
  if (!title) return false
  const lower = title.toLowerCase()
  // Check for #shorts hashtag
  if (lower.includes('#short')) return true
  // Check for standalone "shorts" in title (not part of another word)
  if (/\bshorts?\b/i.test(title)) return true
  return false
}

function isShortUrl(videoId) {
  // Can't determine from videoId alone, but all YouTube shorts have standard 11-char IDs
  // We rely on title-based detection
  return false
}

console.log('=== Covery Shorts Cleanup ===\n')

// 1. Clean metadata.json
const meta = JSON.parse(fs.readFileSync(METADATA_FILE, 'utf8'))
const beforeSongs = meta.songs.length
let removedCovers = 0

meta.songs = meta.songs.map(song => {
  const beforeLen = song.covers.length
  // Check song title and filter covers
  if (isShort(song.title)) {
    removedCovers += song.covers.length
    return { ...song, covers: [] }
  }
  // Also check singerName for shorts indicators
  if (isShort(song.singerName)) {
    removedCovers += song.covers.length
    return { ...song, covers: [] }
  }
  return song
}).filter(song => song.covers.length > 0)

const afterSongs = meta.songs.length
const removedSongs = beforeSongs - afterSongs

// Rebuild singers from remaining covers
const activeSingerIds = new Set()
meta.songs.forEach(s => s.covers.forEach(c => activeSingerIds.add(c.singerId)))
const beforeSingers = meta.singers.length
meta.singers = meta.singers.filter(s => activeSingerIds.has(s.channelId))

fs.writeFileSync(METADATA_FILE, JSON.stringify(meta, null, 2))
console.log(`metadata.json:`)
console.log(`  曲: ${beforeSongs} → ${afterSongs} (${removedSongs}曲削除)`)
console.log(`  歌い手: ${beforeSingers} → ${meta.singers.length}`)

// 2. Clean previewChannels.json
if (fs.existsSync(PREVIEW_FILE)) {
  const preview = JSON.parse(fs.readFileSync(PREVIEW_FILE, 'utf8'))
  let previewRemoved = 0
  for (const ch of preview.channels) {
    const before = ch.sampleCovers?.length || 0
    ch.sampleCovers = (ch.sampleCovers || []).filter(sc => !isShort(sc.title))
    previewRemoved += before - ch.sampleCovers.length
  }
  fs.writeFileSync(PREVIEW_FILE, JSON.stringify(preview, null, 2))
  console.log(`\npreviewChannels.json: ${previewRemoved}件のショート削除`)
}

// 3. Clean apiCache.json
if (fs.existsSync(CACHE_FILE)) {
  const cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'))
  let cacheRemoved = 0
  if (cache.youtubeSearches) {
    for (const [key, entry] of Object.entries(cache.youtubeSearches)) {
      if (entry?.data && Array.isArray(entry.data)) {
        const before = entry.data.length
        entry.data = entry.data.filter(item => !isShort(item.snippet?.title))
        cacheRemoved += before - entry.data.length
      }
    }
  }
  fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2))
  console.log(`apiCache.json: ${cacheRemoved}件のショート削除`)
}

console.log('\n=== 完了 ===')
