import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const CACHE_PATH = path.join(__dirname, '../src/data/apiCache.json')

const CATEGORIES = ['youtubeSearches', 'youtubeChannels', 'youtubeVideos', 'deezerTracks', 'spotifyArtists']

let _cache = null
let _hits = 0
let _misses = 0

export function loadCache() {
  if (_cache) return _cache
  try {
    _cache = JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8'))
  } catch {
    _cache = {}
  }
  for (const k of CATEGORIES) {
    if (!_cache[k]) _cache[k] = {}
  }
  return _cache
}

export function saveCache() {
  if (!_cache) return
  fs.writeFileSync(CACHE_PATH, JSON.stringify(_cache, null, 2))
}

export function getCached(category, key) {
  const entry = _cache?.[category]?.[key]
  if (!entry) { _misses++; return null }
  _hits++
  return entry.data
}

export function setCache(category, key, data) {
  if (!_cache) loadCache()
  if (!_cache[category]) _cache[category] = {}
  _cache[category][key] = { data, fetchedAt: new Date().toISOString() }
}

export function getCacheStats() {
  const total = _hits + _misses
  const rate = total > 0 ? Math.round((_hits / total) * 100) : 0
  return { hits: _hits, misses: _misses, total, rate }
}

export function printCacheStats() {
  const s = getCacheStats()
  console.log(`\n📊 キャッシュ: ${s.hits}ヒット / ${s.misses}新規取得 / 節約率${s.rate}%`)
}
