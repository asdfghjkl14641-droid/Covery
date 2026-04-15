import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const METADATA_FILE = path.join(__dirname, '../src/data/metadata.json')
const CATALOG_FILE = path.join(__dirname, '../src/data/songCatalog.json')

console.log('=== Covery Re-matcher: Spotify名に統一 ===\n')

const metadata = JSON.parse(fs.readFileSync(METADATA_FILE, 'utf8'))
const catalog = JSON.parse(fs.readFileSync(CATALOG_FILE, 'utf8'))

// Build catalog: title → set of valid artists
const catalogTitles = new Set()
const titleToArtists = new Map() // title → Set of artist names
for (const artist of catalog.artists) {
  for (const song of artist.songs) {
    catalogTitles.add(song.title)
    if (!titleToArtists.has(song.title)) titleToArtists.set(song.title, new Set())
    titleToArtists.get(song.title).add(artist.name)
  }
}

const beforeCount = metadata.songs.length
let removedNotInCatalog = 0
let fixedArtist = 0

// 1. Remove songs not in catalog
metadata.songs = metadata.songs.filter(song => {
  if (catalogTitles.has(song.title)) return true
  removedNotInCatalog++
  console.log(`  除外: "${song.title}" (${song.originalArtist}) — カタログに存在しない`)
  return false
})

// 2. Fix artist names — only if current artist is NOT valid for this title
for (const song of metadata.songs) {
  const validArtists = titleToArtists.get(song.title)
  if (!validArtists) continue
  if (validArtists.has(song.originalArtist)) continue // Already correct
  if (song.originalArtist === '不明' && validArtists.size === 1) {
    const correct = [...validArtists][0]
    console.log(`  アーティスト修正: "${song.title}" 不明 → ${correct}`)
    song.originalArtist = correct
    fixedArtist++
  }
  // If multiple artists have this title, keep current (was set at search time with artist context)
}

// 3. Rebuild singers
const activeIds = new Set()
metadata.songs.forEach(s => s.covers.forEach(c => activeIds.add(c.singerId)))
const beforeSingers = metadata.singers.length
metadata.singers = metadata.singers.filter(s => activeIds.has(s.channelId))

fs.writeFileSync(METADATA_FILE, JSON.stringify(metadata, null, 2))

console.log(`\n=== 結果 ===`)
console.log(`曲: ${beforeCount} → ${metadata.songs.length} (${removedNotInCatalog}件除外)`)
console.log(`アーティスト名修正: ${fixedArtist}件`)
console.log(`歌い手: ${beforeSingers} → ${metadata.singers.length}`)

// Verify: no unknown artists remain
const unknowns = metadata.songs.filter(s => s.originalArtist === '不明')
console.log(`アーティスト不明: ${unknowns.length}件`)
