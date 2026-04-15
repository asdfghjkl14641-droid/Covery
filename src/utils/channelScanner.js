import catalogData from '../data/songCatalog.json'
import { ytFetch } from './youtubeApiKeys.js'

const EXCLUDE_KEYWORDS = [
  'カラオケ', 'karaoke', 'joysound', 'dam', '練習', '一発撮り', '弾き語り',
  'shorts', '#shorts', 'short', '切り抜き', 'ライブ', 'live', 'LIVE',
  '配信', '生放送', 'アーカイブ', 'リアクション', 'reaction', '比較', 'まとめ',
  '歌枠', 'ゲーム', '雑談', '踊ってみた', 'off vocal', 'offvocal', 'instrumental', 'inst'
]

// Build catalog entries for matching (sorted by title length descending)
const catalogEntries = []
for (const artist of catalogData.artists) {
  for (const song of artist.songs) {
    catalogEntries.push({ title: song.title, artist: artist.name })
  }
}
catalogEntries.sort((a, b) => b.title.length - a.title.length)

// Strict matching: split video title by separators, check exact part match
const SEPS = /[\/／\-ー\s【】（）\[\]\(\)「」『』｜|×x・,、。~～!！?？♪♫]+/
function _normalize(t) { return (t||'').replace(/[Ａ-Ｚａ-ｚ０-９]/g,s=>String.fromCharCode(s.charCodeAt(0)-0xFEE0)).toLowerCase().trim() }
function strictMatch(videoTitle, songTitle, artistName) {
  const nv = _normalize(videoTitle), ns = _normalize(songTitle)
  if (!ns) return false
  const parts = nv.split(SEPS).filter(p => p)
  if (!parts.some(p => p === ns)) return false
  if (ns.length <= 3) {
    const na = _normalize(artistName)
    if (!nv.includes(na) && !nv.includes(na.split(' ')[0])) return false
  }
  return true
}

function findCatalogMatch(videoTitle) {
  for (const e of catalogEntries) {
    if (strictMatch(videoTitle, e.title, e.artist)) return e
  }
  return null
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

      // Match to catalog (strict) — skip if no match
      const match = findCatalogMatch(title)
      if (!match) continue
      const matchedTitle = match.title
      const matchedArtist = match.artist

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

// Build flat song list for random picking
const allSongs = []
for (const artist of catalogData.artists) {
  for (const song of artist.songs) {
    allSongs.push({ title: song.title, artist: artist.name })
  }
}

/**
 * Discover new channels not yet in knownIds.
 * @param {number} count - How many new channels to find
 * @param {Set} knownIds - channelIds already in preview list
 * @param {function} onProgress - ({found, target, current}) => void
 * @returns {Promise<Array>} New channel objects ready for previewChannels
 */
export async function discoverNewChannels(count, knownIds, onProgress = () => {}) {
  const newChannels = new Map()
  const maxAttempts = count * 5 // Don't loop forever
  let attempts = 0

  while (newChannels.size < count && attempts < maxAttempts) {
    attempts++
    // Pick random song
    const song = allSongs[Math.floor(Math.random() * allSongs.length)]
    const query = encodeURIComponent(`${song.title} ${song.artist} 歌ってみた`)

    let items
    try {
      const data = await ytFetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&q=${query}&type=video&maxResults=10`)
      items = data.items || []
    } catch (e) {
      if (e.message === 'ALL_KEYS_EXHAUSTED') throw e
      continue
    }

    for (const item of items) {
      if (newChannels.size >= count) break
      const chId = item.snippet?.channelId
      if (!chId || knownIds.has(chId) || newChannels.has(chId)) continue

      const lower = (item.snippet?.title || '').toLowerCase()
      if (EXCLUDE_KEYWORDS.some(k => lower.includes(k.toLowerCase()))) continue
      if (!['歌ってみた', 'cover', 'カバー'].some(k => lower.includes(k))) continue

      const videoId = item.id?.videoId
      newChannels.set(chId, {
        channelId: chId,
        channelName: item.snippet.channelTitle,
        channelUrl: `https://www.youtube.com/channel/${chId}`,
        thumbnailUrl: '',
        subscriberCount: 0,
        sampleCovers: [{
          videoId,
          title: song.title,
          originalArtist: song.artist,
          publishedAt: item.snippet.publishedAt?.split('T')[0] || '',
          thumbnailUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
        }],
        totalFound: 1,
        fetchedAt: new Date().toISOString(),
      })

      onProgress({ found: newChannels.size, target: count, current: item.snippet.channelTitle })
    }

    await sleep(300)
  }

  // Batch fetch channel details (thumbnail + subscriber count)
  const ids = [...newChannels.keys()]
  for (let i = 0; i < ids.length; i += 50) {
    const batch = ids.slice(i, i + 50).join(',')
    try {
      const data = await ytFetch(`https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&id=${batch}`)
      for (const item of (data.items || [])) {
        const ch = newChannels.get(item.id)
        if (ch) {
          ch.thumbnailUrl = item.snippet?.thumbnails?.medium?.url || item.snippet?.thumbnails?.default?.url || ''
          ch.subscriberCount = parseInt(item.statistics?.subscriberCount || '0', 10)
        }
      }
    } catch { /* ignore */ }
    await sleep(300)
  }

  onProgress({ found: newChannels.size, target: count, current: '完了' })
  return [...newChannels.values()]
}
