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

// ══════════════════════════════════════════════════════════
//  Spotify-via-Worker lookup (adds unknown songs to D1 catalog)
// ══════════════════════════════════════════════════════════
const API_BASE = 'https://covery-api.asdfghjkl14641.workers.dev'

// Normalize: full-width → half-width, strip symbols, collapse whitespace
function normalize(text) {
  if (!text) return ''
  return String(text)
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0))
    .replace(/　/g, ' ')
    .replace(/[【】（）\[\]()「」『』""''・、。!！?？♪♫★☆♡♥※●◯◎▲△▼▽◆◇]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function toHiragana(text) {
  return (text || '').replace(/[\u30A1-\u30F6]/g, m => String.fromCharCode(m.charCodeAt(0) - 0x60))
}
function toKatakana(text) {
  return (text || '').replace(/[\u3041-\u3096]/g, m => String.fromCharCode(m.charCodeAt(0) + 0x60))
}

// Extract a clean "title artist" query from a video title.
// Returns an array of candidate queries in order of preference.
function extractSpotifyQueries(videoTitle) {
  let q = videoTitle || ''
  // Strip bracketed annotations entirely
  q = q.replace(/【[^】]*】/g, ' ')
  q = q.replace(/\[[^\]]*\]/g, ' ')
  q = q.replace(/[(（][^)）]*[)）]/g, ' ')
  q = q.replace(/「[^」]*」/g, ' ')
  q = q.replace(/『[^』]*』/g, ' ')
  // Strip "covered by X" / "cover by X" tails
  q = q.replace(/covered\s*by\s+.+$/i, ' ')
  q = q.replace(/cover(?:ed)?\s+by\s+.+$/i, ' ')
  q = q.replace(/(?:歌|唄)って(?:みた|みました)\s*[byBY]?\s*.+$/i, ' ')
  // Strip annotation keywords
  q = q.replace(/\b(covered|cover|カバー|歌ってみた|唄ってみた|歌った|弾き語り|acoustic|アコギ|ピアノ|piano|guitar|MV|music\s*video|full\s*ver|full\s*version|short\s*ver|tv\s*size|pv|shorts?|live|ver\.|version|アレンジ|arrange|official)\b/gi, ' ')
  q = q.replace(/\bfeat\.?\s+[^\/／|｜\-—–]+/gi, ' ')
  q = q.replace(/\bft\.?\s+[^\/／|｜\-—–]+/gi, ' ')
  // Remove hashtag/short indicators like #shorts, #123
  q = q.replace(/#\S+/g, ' ')
  // Remove emoji (basic ranges)
  q = q.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, ' ')
  // Normalize separators to spaces
  q = q.replace(/[\/／|｜・×x]/g, ' ')

  const cleaned = normalize(q).trim()

  const candidates = []
  if (cleaned) candidates.push(cleaned)

  // Split by common separators and take first substantial part
  const originalParts = (videoTitle || '')
    .replace(/【[^】]*】/g, ' ').replace(/\[[^\]]*\]/g, ' ')
    .replace(/[(（][^)）]*[)）]/g, ' ')
    .split(/[\/／|｜\-—–]/)
    .map(p => normalize(p))
    .filter(p => p.length >= 2)

  if (originalParts[0] && !candidates.includes(originalParts[0])) candidates.push(originalParts[0])

  // First word of cleaned (often the song title alone)
  const firstWord = cleaned.split(/\s+/)[0]
  if (firstWord && firstWord.length >= 2 && !candidates.includes(firstWord)) {
    candidates.push(firstWord)
  }

  return candidates
}

async function spotifySearchViaWorker(query, token, market = 'JP') {
  try {
    const res = await fetch(`${API_BASE}/api/admin/spotify-search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ query, market, limit: 10 }),
    })
    if (!res.ok) return null
    const data = await res.json()
    return data?.tracks || []
  } catch (_) { return null }
}

async function addSongViaWorker(title, artistName, spotifyId, token) {
  try {
    const res = await fetch(`${API_BASE}/api/admin/add-song`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ title, artistName, spotifyId }),
    })
    if (!res.ok) return null
    return await res.json()
  } catch (_) { return null }
}

// Pick the best track from Spotify results for a given video title.
// Uses multi-way scoring: exact, kana-converted, word-level match.
function pickBestTrack(tracks, videoTitle) {
  const nv = normalize(videoTitle)
  const nvLower = nv.toLowerCase()
  const nvHira = toHiragana(nv)
  const nvKata = toKatakana(nv)

  let best = null; let bestScore = 0
  for (const t of tracks) {
    const name = normalize(t.name)
    const artist = normalize(t.artist || '')
    if (!name) continue

    let score = 0
    const nameLower = name.toLowerCase()
    const artistLower = artist.toLowerCase()

    // Exact substring
    if (nv.includes(name)) score += 10
    // Case-insensitive substring (catches "LEMON" vs "Lemon")
    else if (nvLower.includes(nameLower)) score += 9
    // Kana-converted substring (catches ひらがな⇄カタカナ)
    else if (nvHira.includes(toHiragana(name))) score += 8
    else if (nvKata.includes(toKatakana(name))) score += 8

    // Artist match (bonus)
    if (artist && nvLower.includes(artistLower)) score += 5

    // Word-level fallback
    const titleWords = nameLower.split(/\s+/).filter(w => w.length >= 2)
    if (titleWords.length > 0) {
      const matched = titleWords.filter(w => nvLower.includes(w)).length
      score += (matched / titleWords.length) * 7
    }

    // Prefer more specific (longer) track names on ties
    score += Math.min(name.length, 20) * 0.05

    if (score > bestScore) { bestScore = score; best = t; best._score = score }
  }

  // Threshold 3 keeps some leeway; below that is likely noise
  return bestScore >= 3 ? best : null
}

// Multi-stage Spotify lookup: tries queries in order, then global market as final fallback.
// Returns { track, query, stage } or null.
async function lookupSongOnSpotify(videoTitle, token) {
  const queries = extractSpotifyQueries(videoTitle)
  const markets = ['JP', 'none'] // first try JP, then global

  for (const market of markets) {
    for (let i = 0; i < queries.length; i++) {
      const q = queries[i]
      if (!q) continue
      const tracks = await spotifySearchViaWorker(q, token, market)
      if (!tracks || tracks.length === 0) continue
      const best = pickBestTrack(tracks, videoTitle)
      if (best) {
        return { track: best, query: q, stage: `${market}:query${i + 1}` }
      }
      await sleep(150)
    }
  }
  return null
}

/**
 * Scan a channel for cover videos.
 * @param {string} channelId
 * @param {string} channelName
 * @param {function} onProgress - ({found, filtered, current, newlyAdded?}) => void
 * @param {string} [adminToken] - If provided, unknown songs are looked up via Spotify and added to D1
 * @returns {Promise<{covers, totalFound, totalFiltered, catalogMatched, spotifyAdded, unmatchedSkipped}>}
 */
export async function scanChannel(channelId, channelName, onProgress = () => {}, adminToken = null) {
  const covers = []
  const unknownVideos = []   // videos that didn't match local catalog — will be probed via Spotify
  let totalFound = 0
  let pageToken = ''
  let catalogMatched = 0

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

      // Match to local catalog (fast path)
      const match = findCatalogMatch(title)
      if (match) {
        catalogMatched++
        covers.push({
          videoId,
          title: match.title,
          originalArtist: match.artist,
          channelId,
          channelName,
          publishedAt: item.snippet.publishedAt?.split('T')[0] || '',
        })
        onProgress({ found: totalFound, filtered: covers.length, current: match.title })
      } else if (adminToken) {
        // Queue for Spotify lookup after page-scan completes
        unknownVideos.push({
          videoId, title,
          publishedAt: item.snippet.publishedAt?.split('T')[0] || '',
        })
      }
    }

    pageToken = data.nextPageToken || ''
    if (!pageToken) break
    await sleep(500)
  }

  // ── Spotify lookup for unknown videos ──
  let spotifyAdded = 0
  let unmatchedSkipped = 0
  const skippedVideos = []  // for debug display

  if (adminToken && unknownVideos.length > 0) {
    onProgress({
      found: totalFound, filtered: covers.length,
      current: `Spotifyで${unknownVideos.length}曲検索中...`,
    })
    for (const v of unknownVideos) {
      const queries = extractSpotifyQueries(v.title)
      if (queries.length === 0) {
        unmatchedSkipped++
        console.log(`[スキップ] YouTube: "${v.title}" → 検索クエリ抽出できず`)
        skippedVideos.push({ youtubeTitle: v.title, searchQuery: '', reason: 'no_query_extracted' })
        continue
      }

      const result = await lookupSongOnSpotify(v.title, adminToken)
      if (!result) {
        unmatchedSkipped++
        console.log(`[スキップ] YouTube: "${v.title}" → Spotify検索クエリ: ${queries.map(q => `"${q}"`).join(', ')} → 該当なし`)
        skippedVideos.push({
          youtubeTitle: v.title,
          searchQuery: queries.join(' | '),
          reason: 'no_spotify_match',
        })
        continue
      }

      const { track: best, query: usedQuery, stage } = result
      const added = await addSongViaWorker(best.name, best.artist, best.spotifyId, adminToken)
      if (!added) {
        unmatchedSkipped++
        console.log(`[スキップ] YouTube: "${v.title}" → 曲検出できたがD1追加失敗 (${best.name} / ${best.artist})`)
        skippedVideos.push({
          youtubeTitle: v.title,
          searchQuery: usedQuery,
          reason: 'add_song_failed',
        })
        continue
      }

      spotifyAdded++
      console.log(`[追加] YouTube: "${v.title}" → Spotify: "${added.title}" / "${added.artistName}" (stage=${stage})`)
      covers.push({
        videoId: v.videoId,
        title: added.title,
        originalArtist: added.artistName,
        channelId, channelName,
        publishedAt: v.publishedAt,
      })
      onProgress({
        found: totalFound, filtered: covers.length,
        current: `+ ${added.title} (${added.artistName}) をカタログに追加`,
        newlyAdded: { title: added.title, artist: added.artistName },
      })
      await sleep(200)
    }
  } else if (unknownVideos.length > 0) {
    unmatchedSkipped += unknownVideos.length
    for (const v of unknownVideos) {
      skippedVideos.push({ youtubeTitle: v.title, searchQuery: '', reason: 'no_admin_token' })
    }
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
  console.log(`[Covery] スキャン完了: ${totalFound}曲発見 / カタログ一致: ${catalogMatched}曲 / Spotify追加: ${spotifyAdded}曲 / スキップ: ${unmatchedSkipped}曲`)
  if (skippedVideos.length > 0) {
    console.log(`[Covery] スキップされた ${skippedVideos.length} 曲:`, skippedVideos)
  }
  return {
    covers, totalFound, totalFiltered: covers.length,
    catalogMatched, spotifyAdded, unmatchedSkipped,
    skippedVideos,
  }
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
