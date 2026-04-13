import axios from 'axios'
import dotenv from 'dotenv'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const CATALOG_FILE = path.join(__dirname, '../src/data/songCatalog.json')
const APPROVED_FILE = path.join(__dirname, '../src/data/approvedChannels.json')
const OUTPUT_FILE = path.join(__dirname, '../src/data/metadata.json')
const API_KEY = process.env.YOUTUBE_API_KEY || 'AIzaSyDdSK0JD-v9ql2HkXwILCVLX2RBpxe-GiQ'

const EXCLUDE_KEYWORDS = [
  'カラオケ', 'karaoke', 'joysound', 'dam', '練習', '一発撮り', '弾き語り',
  'shorts', '#shorts', 'short', '切り抜き', 'ライブ', 'live', 'LIVE',
  '配信', '生放送', 'アーカイブ', 'リアクション', 'reaction', '比較', 'まとめ',
  '歌枠', 'ゲーム', '雑談', '踊ってみた', 'off vocal', 'offvocal', 'instrumental', 'inst'
]

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))

async function fetchApproved() {
  console.log('=== Covery Approved Fetcher (Stage 2) ===\n')

  if (!fs.existsSync(APPROVED_FILE)) {
    console.error('Error: approvedChannels.json not found.')
    console.error('Export from Admin dashboard or create manually.')
    return
  }
  if (!fs.existsSync(CATALOG_FILE)) {
    console.error('Error: songCatalog.json not found.')
    return
  }

  const approved = JSON.parse(fs.readFileSync(APPROVED_FILE, 'utf8'))
  const catalog = JSON.parse(fs.readFileSync(CATALOG_FILE, 'utf8'))

  // Build song title lookup from catalog
  const catalogTitles = new Set()
  const titleToArtist = new Map()
  for (const artist of catalog.artists) {
    for (const song of artist.songs) {
      catalogTitles.add(song.title.toLowerCase())
      titleToArtist.set(song.title.toLowerCase(), artist.name)
    }
  }

  // Load existing metadata to merge
  let existing = { songs: [], singers: [] }
  if (fs.existsSync(OUTPUT_FILE)) {
    existing = JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf8'))
  }
  const songsList = [...existing.songs]
  const singersMap = new Map()
  existing.singers.forEach(s => singersMap.set(s.channelId, s))

  // Track existing videoIds to avoid duplicates
  const existingVideoIds = new Set()
  songsList.forEach(s => s.covers.forEach(c => existingVideoIds.add(c.videoId)))

  const channelIds = approved.channels || approved // Support both array and {channels:[]} format
  const channelList = Array.isArray(channelIds) ? channelIds : []

  console.log(`Approved channels: ${channelList.length}`)
  console.log(`Existing songs: ${songsList.length}`)
  console.log(`Catalog titles: ${catalogTitles.size}\n`)

  let added = 0

  for (const ch of channelList) {
    const channelId = ch.channelId || ch
    const channelName = ch.channelName || channelId
    console.log(`\nProcessing: ${channelName} (${channelId})`)

    // Search this channel's cover videos
    let pageToken = ''
    let channelAdded = 0

    for (let page = 0; page < 3; page++) { // Max 3 pages = 150 results
      const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&q=歌ってみた&type=video&maxResults=50&key=${API_KEY}${pageToken ? `&pageToken=${pageToken}` : ''}`

      try {
        const res = await axios.get(url)
        const items = res.data.items || []

        for (const item of items) {
          const videoId = item.id.videoId
          if (existingVideoIds.has(videoId)) continue

          const title = item.snippet.title
          const lowerTitle = title.toLowerCase()
          const isExcluded = EXCLUDE_KEYWORDS.some(k => lowerTitle.includes(k.toLowerCase()))
          if (isExcluded) continue

          // Match to catalog song
          let matchedTitle = null
          let matchedArtist = '不明'
          for (const ct of catalogTitles) {
            if (lowerTitle.includes(ct)) {
              matchedTitle = ct
              matchedArtist = titleToArtist.get(ct) || '不明'
              break
            }
          }
          // Use video title if no catalog match
          const songTitle = matchedTitle
            ? [...titleToArtist.keys()].find(k => k.toLowerCase() === matchedTitle) || title
            : title.replace(/【.*?】/g, '').replace(/歌ってみた/g, '').trim() || title

          // Ensure singer is in map
          if (!singersMap.has(channelId)) {
            singersMap.set(channelId, {
              channelId,
              name: channelName,
              thumbnailUrl: ch.thumbnailUrl || ''
            })
          }

          songsList.push({
            id: `song_${videoId}`,
            title: matchedTitle ? songTitle : songTitle,
            originalArtist: matchedArtist,
            singerName: channelName,
            genre: ['J-POP'],
            covers: [{
              videoId,
              singerId: channelId,
              publishedAt: item.snippet.publishedAt?.split('T')[0] || '',
              thumbnailUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
            }]
          })
          existingVideoIds.add(videoId)
          channelAdded++
          added++
        }

        pageToken = res.data.nextPageToken || ''
        if (!pageToken) break
      } catch (e) {
        if (e.response?.status === 403) {
          console.error('API quota exhausted. Saving progress...')
          break
        }
        console.warn(`  ! Search failed`)
        break
      }

      await sleep(500)
    }

    console.log(`  Added ${channelAdded} covers`)
  }

  // Save
  const finalData = {
    songs: songsList,
    singers: [...singersMap.values()]
  }
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(finalData, null, 2))
  console.log(`\n=== Done! ===`)
  console.log(`Total songs: ${finalData.songs.length} (+${added} new)`)
  console.log(`Total singers: ${finalData.singers.length}`)
}

fetchApproved().catch(e => console.error('FATAL:', e.message))
