import dotenv from 'dotenv'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { ytFetch, getKeyStatus } from './youtubeApiKeys.js'
import { loadCache, saveCache, getCached, setCache, printCacheStats } from './cacheManager.js'

dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const METADATA_FILE = path.join(__dirname, '../src/data/metadata.json')

const sleep = (ms) => new Promise(r => setTimeout(r, ms))

// Parse ISO 8601 duration (PT3M45S) to seconds
function parseDuration(iso) {
  if (!iso) return -1
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!m) return -1
  return (parseInt(m[1] || 0) * 3600) + (parseInt(m[2] || 0) * 60) + parseInt(m[3] || 0)
}

async function main() {
  console.log('=== Covery Duration Cleanup ===\n')
  loadCache()

  const metadata = JSON.parse(fs.readFileSync(METADATA_FILE, 'utf8'))
  console.log(`対象: ${metadata.songs.length}曲\n`)

  // Collect all videoIds
  const allVideoIds = []
  const videoToSong = new Map()
  for (const song of metadata.songs) {
    for (const c of song.covers) {
      allVideoIds.push(c.videoId)
      videoToSong.set(c.videoId, song)
    }
  }

  // Fetch durations (cached first, then API)
  const durations = new Map() // videoId → seconds
  let apiCalls = 0
  const uncached = []

  for (const vid of allVideoIds) {
    const cached = getCached('youtubeVideos', vid)
    if (cached?.duration) {
      const secs = typeof cached.duration === 'number' ? cached.duration : parseDuration(cached.duration)
      if (secs > 0) { durations.set(vid, secs); continue }
    }
    if (cached?.durationSec) { durations.set(vid, cached.durationSec); continue }
    uncached.push(vid)
  }

  console.log(`キャッシュ済み: ${durations.size}件, 未取得: ${uncached.length}件`)

  // Batch fetch from API
  for (let i = 0; i < uncached.length; i += 50) {
    const batch = uncached.slice(i, i + 50)
    const ids = batch.join(',')
    try {
      const data = await ytFetch(`https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${ids}`)
      apiCalls++
      for (const item of (data.items || [])) {
        const secs = parseDuration(item.contentDetails?.duration)
        if (secs > 0) {
          durations.set(item.id, secs)
          setCache('youtubeVideos', item.id, { durationSec: secs, duration: item.contentDetails.duration })
        }
      }
    } catch (e) {
      if (e.message === 'ALL_KEYS_EXHAUSTED') {
        console.error(`全キー上限到達 (${getKeyStatus()}). 取得済み分で処理続行...`)
        break
      }
    }
    await sleep(300)
    if (apiCalls % 5 === 0) console.log(`  API: ${apiCalls}回, duration取得: ${durations.size}件`)
  }

  saveCache()
  console.log(`\nDuration取得完了: ${durations.size}/${allVideoIds.length}件 (API ${apiCalls}回)\n`)

  // Filter
  let shortCount = 0   // ≤90s
  let longCount = 0     // ≥360s
  let grayCount = 0     // 90-180s without cover keywords
  let unknownKept = 0   // duration unknown, kept

  const beforeCount = metadata.songs.length

  metadata.songs = metadata.songs.filter(song => {
    const c = song.covers?.[0]
    if (!c) return false

    const secs = durations.get(c.videoId)
    if (secs === undefined) { unknownKept++; return true } // Unknown duration → keep

    // ≤90s → short, delete
    if (secs <= 90) { shortCount++; return false }

    // ≥360s → too long, delete
    if (secs >= 360) { longCount++; return false }

    // 90-180s → check for cover keywords
    if (secs <= 180) {
      const title = (song.singerName + ' ' + (song.title || '')).toLowerCase()
      const hasKeyword = ['歌ってみた', 'cover', 'カバー'].some(k => title.includes(k))
      if (!hasKeyword) {
        // Also check original video title from cache
        const cached = getCached('youtubeVideos', c.videoId)
        const origTitle = (cached?.title || '').toLowerCase()
        const origHas = ['歌ってみた', 'cover', 'カバー'].some(k => origTitle.includes(k))
        if (!origHas) { grayCount++; return false }
      }
    }

    return true
  })

  // Rebuild singers
  const activeIds = new Set()
  metadata.songs.forEach(s => s.covers.forEach(c => activeIds.add(c.singerId)))
  metadata.singers = metadata.singers.filter(s => activeIds.has(s.channelId))

  fs.writeFileSync(METADATA_FILE, JSON.stringify(metadata, null, 2))

  console.log(`=== 結果 ===`)
  console.log(`90秒以下のショート: ${shortCount}件（削除）`)
  console.log(`6分以上の長尺: ${longCount}件（削除）`)
  console.log(`90〜180秒で歌ってみたでない: ${grayCount}件（削除）`)
  console.log(`Duration不明（保持）: ${unknownKept}件`)
  console.log(`合計削除: ${beforeCount - metadata.songs.length}件`)
  console.log(`残り: ${metadata.songs.length}曲, ${metadata.singers.length}歌い手`)
  printCacheStats()
}

main().catch(e => console.error('FATAL:', e.message))
