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
const OUTPUT_FILE = path.join(__dirname, '../src/data/metadata.json')

const EXCLUDE_KEYWORDS = [
  'カラオケ', 'karaoke', 'joysound', 'dam', '練習', '一発撮り', '弾き語り',
  'shorts', '#shorts', 'short', '切り抜き', 'ライブ', 'live', 'LIVE',
  '配信', '生放送', 'アーカイブ', 'リアクション', 'reaction', '比較', 'まとめ',
  '歌枠', 'ゲーム', '雑談', '踊ってみた', 'off vocal', 'offvocal', 'instrumental', 'inst'
]

const sleep = (ms) => new Promise(r => setTimeout(r, ms))

async function fetchData() {
  console.log('=== Covery Data Fetcher ===\n')
  const catalog = JSON.parse(fs.readFileSync(CATALOG_FILE, 'utf8'))
  loadCache()

  // Load existing metadata
  let existing = { songs: [], singers: [] }
  if (fs.existsSync(OUTPUT_FILE)) existing = JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf8'))

  const allVideoIds = new Set()
  existing.songs.forEach(s => s.covers.forEach(c => allVideoIds.add(c.videoId)))
  const existingArtists = new Set(existing.songs.map(s => s.originalArtist))

  const songsList = [...existing.songs]
  const singersMap = new Map()
  existing.singers.forEach(s => singersMap.set(s.channelId, s))

  const needsThumb = new Set()
  let quotaExhausted = false
  let addedTotal = 0
  let saveCounter = 0

  console.log(`既存: ${existing.songs.length} covers, ${existing.singers.length} singers`)

  for (const artist of catalog.artists) {
    if (existingArtists.has(artist.name)) continue
    if (quotaExhausted) break
    console.log(`\nArtist: ${artist.name}`)

    for (const song of artist.songs) {
      if (quotaExhausted) break
      const cacheKey = `${song.title} ${artist.name} 歌ってみた`

      // Check cache first
      let items = getCached('youtubeSearches', cacheKey)
      if (!items) {
        const query = encodeURIComponent(cacheKey)
        try {
          const data = await ytFetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&q=${query}&type=video&videoDuration=medium&maxResults=8`)
          items = data.items || []
          setCache('youtubeSearches', cacheKey, items)
        } catch (e) {
          if (e.message === 'ALL_KEYS_EXHAUSTED') {
            console.error(`\n全キー上限到達 (${getKeyStatus()}). 保存中...`)
            quotaExhausted = true; break
          }
          continue
        }
        await sleep(500)
      }

      let addedCount = 0
      for (const item of items) {
        if (addedCount >= 3) break
        const videoId = item.id?.videoId || item.videoId
        if (!videoId || allVideoIds.has(videoId)) continue

        const title = item.snippet?.title || ''
        const lower = title.toLowerCase()
        const isExcluded = EXCLUDE_KEYWORDS.some(k => lower.includes(k.toLowerCase()))
        const hasPositive = ['歌ってみた', 'cover', 'カバー'].some(k => lower.includes(k))
        if (!hasPositive || isExcluded) continue

        const channelId = item.snippet?.channelId
        const channelTitle = item.snippet?.channelTitle || ''

        if (channelId && !singersMap.has(channelId)) {
          singersMap.set(channelId, { channelId, name: channelTitle, thumbnailUrl: '' })
          needsThumb.add(channelId)
        }

        // Cache video info
        setCache('youtubeVideos', videoId, {
          title, channelId, channelName: channelTitle,
          publishedAt: item.snippet?.publishedAt?.split('T')[0] || '',
        })

        songsList.push({
          id: `song_${videoId}`, title: song.title, originalArtist: artist.name,
          singerName: channelTitle, genre: ['J-POP'],
          covers: [{ videoId, singerId: channelId, publishedAt: item.snippet?.publishedAt?.split('T')[0] || '', thumbnailUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` }]
        })
        allVideoIds.add(videoId)
        addedCount++; addedTotal++
      }
      if (addedCount > 0) console.log(`  ${song.title}: +${addedCount}`)

      // Periodic save every 50 additions
      saveCounter += addedCount
      if (saveCounter >= 50) {
        saveCounter = 0
        fs.writeFileSync(OUTPUT_FILE, JSON.stringify({ songs: songsList, singers: [...singersMap.values()] }, null, 2))
        saveCache()
        console.log(`  💾 中間保存: ${songsList.length} covers`)
      }
    }
  }

  // Batch fetch thumbnails for new channels
  const thumbIds = [...needsThumb].filter(id => !getCached('youtubeChannels', id))
  if (thumbIds.length > 0 && !quotaExhausted) {
    console.log(`\nサムネイル取得: ${thumbIds.length}チャンネル...`)
    for (let i = 0; i < thumbIds.length; i += 50) {
      const batch = thumbIds.slice(i, i + 50).join(',')
      try {
        const data = await ytFetch(`https://www.googleapis.com/youtube/v3/channels?part=snippet&id=${batch}`)
        for (const item of (data.items || [])) {
          const thumb = item.snippet?.thumbnails?.default?.url || ''
          setCache('youtubeChannels', item.id, { channelName: item.snippet?.title, thumbnailUrl: thumb })
          const ch = singersMap.get(item.id)
          if (ch) ch.thumbnailUrl = thumb
        }
      } catch { break }
      await sleep(300)
    }
  }
  // Also apply cached thumbnails
  for (const [id, ch] of singersMap) {
    if (!ch.thumbnailUrl) {
      const cached = getCached('youtubeChannels', id)
      if (cached?.thumbnailUrl) ch.thumbnailUrl = cached.thumbnailUrl
    }
  }

  // Save
  const finalData = { songs: songsList, singers: [...singersMap.values()] }
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(finalData, null, 2))
  saveCache()

  console.log(`\n=== 完了 ===`)
  console.log(`Covers: ${songsList.length} (+${addedTotal})`)
  console.log(`Singers: ${finalData.singers.length}`)
  printCacheStats()
}

fetchData().catch(e => console.error('FATAL:', e.message))
