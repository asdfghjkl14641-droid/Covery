import dotenv from 'dotenv'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { ytFetch, getKeyStatus } from './youtubeApiKeys.js'
import { loadCache, saveCache, getCached, setCache, printCacheStats } from './cacheManager.js'

dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const CATALOG_FILE = path.join(__dirname, '../src/data/songCatalog.json')
const OUTPUT_FILE = path.join(__dirname, '../src/data/previewChannels.json')

const EXCLUDE_KEYWORDS = [
  'カラオケ', 'karaoke', 'joysound', 'dam', '練習', '一発撮り', '弾き語り',
  'shorts', '#shorts', 'short', '切り抜き', 'ライブ', 'live', 'LIVE',
  '配信', '生放送', 'アーカイブ', 'リアクション', 'reaction', '比較', 'まとめ',
  '歌枠', 'ゲーム', '雑談', '踊ってみた', 'off vocal', 'offvocal', 'instrumental', 'inst'
]
const MAX_SAMPLES = 3
const sleep = (ms) => new Promise(r => setTimeout(r, ms))

async function fetchPreview() {
  console.log('=== Covery Preview Fetcher ===\n')
  const catalog = JSON.parse(fs.readFileSync(CATALOG_FILE, 'utf8'))
  loadCache()

  // Load existing
  let existing = { channels: [] }
  if (fs.existsSync(OUTPUT_FILE)) existing = JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf8'))
  const channelsMap = new Map()
  existing.channels.forEach(c => channelsMap.set(c.channelId, c))

  let quotaExhausted = false
  let searchCount = 0
  const needsThumb = new Set()
  const needsDuration = []

  const artistsToProcess = catalog.artists.slice(0, 50)

  for (const artist of artistsToProcess) {
    if (quotaExhausted) break
    const songsToSearch = artist.songs.slice(0, 5)

    for (const song of songsToSearch) {
      if (quotaExhausted) break
      const cacheKey = `${song.title} 歌ってみた`

      let items = getCached('youtubeSearches', cacheKey)
      if (!items) {
        const query = encodeURIComponent(cacheKey)
        try {
          const data = await ytFetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&q=${query}&type=video&videoDuration=medium&maxResults=5`)
          items = data.items || []
          setCache('youtubeSearches', cacheKey, items)
          searchCount++
        } catch (e) {
          if (e.message === 'ALL_KEYS_EXHAUSTED') {
            console.error(`全キー上限到達 (${getKeyStatus()}).`)
            quotaExhausted = true; break
          }
          continue
        }
        await sleep(300)
      }

      for (const item of items) {
        const title = item.snippet?.title || ''
        const lower = title.toLowerCase()
        if (EXCLUDE_KEYWORDS.some(k => lower.includes(k.toLowerCase()))) continue
        if (!['歌ってみた', 'cover', 'カバー'].some(k => lower.includes(k))) continue

        const channelId = item.snippet?.channelId
        const videoId = item.id?.videoId || item.videoId
        if (!channelId || !videoId) continue

        if (!channelsMap.has(channelId)) {
          channelsMap.set(channelId, {
            channelId, channelName: item.snippet.channelTitle, thumbnailUrl: '', subscriberCount: 0,
            sampleCovers: [], totalFound: 0,
          })
          needsThumb.add(channelId)
        }
        const ch = channelsMap.get(channelId)
        ch.totalFound++
        if (ch.sampleCovers.length < MAX_SAMPLES && !ch.sampleCovers.some(sc => sc.videoId === videoId)) {
          const sc = { videoId, title: song.title, originalArtist: artist.name, publishedAt: item.snippet.publishedAt?.split('T')[0] || '' }
          ch.sampleCovers.push(sc)
          needsDuration.push(sc)
        }
      }
    }
    if (searchCount > 0 && searchCount % 20 === 0) console.log(`  検索: ${searchCount}, チャンネル: ${channelsMap.size}`)
  }

  // Batch fetch durations (cached)
  const uncachedVideos = needsDuration.filter(sc => !sc.duration && !getCached('youtubeVideos', sc.videoId)?.duration)
  if (uncachedVideos.length > 0 && !quotaExhausted) {
    console.log(`\n動画情報取得: ${uncachedVideos.length}件...`)
    for (let i = 0; i < uncachedVideos.length; i += 50) {
      const batch = uncachedVideos.slice(i, i + 50)
      const ids = batch.map(sc => sc.videoId).join(',')
      try {
        const data = await ytFetch(`https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${ids}`)
        for (const item of (data.items || [])) {
          const m = item.contentDetails?.duration?.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
          if (m) {
            const h = parseInt(m[1] || 0), min = parseInt(m[2] || 0), sec = parseInt(m[3] || 0)
            const dur = h > 0 ? `${h}:${String(min).padStart(2,'0')}:${String(sec).padStart(2,'0')}` : `${min}:${String(sec).padStart(2,'0')}`
            setCache('youtubeVideos', item.id, { duration: dur })
          }
        }
      } catch { break }
      await sleep(300)
    }
  }
  // Apply cached durations
  for (const ch of channelsMap.values()) {
    for (const sc of ch.sampleCovers) {
      if (!sc.duration) {
        const cached = getCached('youtubeVideos', sc.videoId)
        if (cached?.duration) sc.duration = cached.duration
      }
    }
  }

  // Batch fetch channel info (cached)
  const uncachedChannels = [...needsThumb].filter(id => !getCached('youtubeChannels', id))
  if (uncachedChannels.length > 0 && !quotaExhausted) {
    console.log(`チャンネル情報取得: ${uncachedChannels.length}件...`)
    for (let i = 0; i < uncachedChannels.length; i += 50) {
      const batch = uncachedChannels.slice(i, i + 50).join(',')
      try {
        const data = await ytFetch(`https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&id=${batch}`)
        for (const item of (data.items || [])) {
          setCache('youtubeChannels', item.id, {
            channelName: item.snippet?.title, thumbnailUrl: item.snippet?.thumbnails?.default?.url || '',
            subscriberCount: parseInt(item.statistics?.subscriberCount || '0', 10),
          })
        }
      } catch { break }
      await sleep(300)
    }
  }
  // Apply cached channel info
  for (const ch of channelsMap.values()) {
    const cached = getCached('youtubeChannels', ch.channelId)
    if (cached) {
      if (!ch.thumbnailUrl && cached.thumbnailUrl) ch.thumbnailUrl = cached.thumbnailUrl
      if (!ch.subscriberCount && cached.subscriberCount) ch.subscriberCount = cached.subscriberCount
    }
  }

  const result = { channels: [...channelsMap.values()].sort((a, b) => b.totalFound - a.totalFound) }
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(result, null, 2))
  saveCache()

  console.log(`\n=== 完了 ===`)
  console.log(`チャンネル: ${result.channels.length}`)
  console.log(`API検索: ${searchCount}`)
  printCacheStats()
}

fetchPreview().catch(e => console.error('FATAL:', e.message))
