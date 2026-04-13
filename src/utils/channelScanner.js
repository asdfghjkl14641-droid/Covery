import catalogData from '../data/songCatalog.json'
import { ytFetch } from './youtubeApiKeys.js'

const EXCLUDE_KEYWORDS = [
  'カラオケ', 'karaoke', 'joysound', 'dam', '練習', '一発撮り', '弾き語り',
  'shorts', '#shorts', 'short', '切り抜き', 'ライブ', 'live', 'LIVE',
  '配信', '生放送', 'アーカイブ', 'リアクション', 'reaction', '比較', 'まとめ',
  '歌枠', 'ゲーム', '雑談', '踊ってみた', 'off vocal', 'offvocal', 'instrumental', 'inst'
]

// Build title lookup from catalog
const catalogTitles = new Map()
for (const artist of catalogData.artists) {
  for (const song of artist.songs) {
    catalogTitles.set(song.title.toLowerCase(), { title: song.title, artist: artist.name })
  }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

/**
 * Scan a channel for cover videos.
 * @param {string} channelId
 * @param {string} channelName
 * @param {function} onProgress - ({found, filtered, current}) => void
 * @returns {Promise<{covers: Array, totalFound: number, totalFiltered: number}>}
 */
export async function scanChannel(channelId, channelName, onProgress = () => {}) {
  const covers = []
  let totalFound = 0
  let pageToken = ''

  // Up to 3 pages (150 results max)
  for (let page = 0; page < 3; page++) {
    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&q=歌ってみた&type=video&maxResults=50${pageToken ? `&pageToken=${pageToken}` : ''}`

    const data = await ytFetch(url)
    const items = data.items || []
    totalFound += items.length

    for (const item of items) {
      const title = item.snippet.title
      const lower = title.toLowerCase()
      const isExcluded = EXCLUDE_KEYWORDS.some(k => lower.includes(k.toLowerCase()))
      if (isExcluded) continue

      const videoId = item.id.videoId

      // Match to catalog
      let matchedTitle = title
      let matchedArtist = '不明'
      for (const [key, val] of catalogTitles) {
        if (lower.includes(key)) {
          matchedTitle = val.title
          matchedArtist = val.artist
          break
        }
      }

      covers.push({
        videoId,
        title: matchedTitle,
        originalArtist: matchedArtist,
        channelId,
        channelName,
        publishedAt: item.snippet.publishedAt?.split('T')[0] || '',
      })

      onProgress({ found: totalFound, filtered: covers.length, current: matchedTitle })
    }

    pageToken = data.nextPageToken || ''
    if (!pageToken) break
    await sleep(500)
  }

  // Batch fetch view counts (50 at a time)
  for (let i = 0; i < covers.length; i += 50) {
    const batch = covers.slice(i, i + 50)
    const ids = batch.map(c => c.videoId).join(',')
    try {
      const data = await ytFetch(`https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${ids}`)
      for (const item of (data.items || [])) {
        const cover = batch.find(c => c.videoId === item.id)
        if (cover) cover.viewCount = parseInt(item.statistics?.viewCount || '0', 10)
      }
    } catch (_) { /* ignore stats errors */ }
    await sleep(300)
  }

  onProgress({ found: totalFound, filtered: covers.length, current: '完了' })
  return { covers, totalFound, totalFiltered: covers.length }
}
