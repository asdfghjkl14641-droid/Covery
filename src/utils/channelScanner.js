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

// ══════════════════════════════════════════════════════════
//  Worker API helpers for Stage 2/3
// ══════════════════════════════════════════════════════════
async function fetchPopularSongsFromD1(limit = 200) {
  try {
    const r = await fetch(`${API_BASE}/api/songs?limit=${limit}&random=false`)
    if (!r.ok) return []
    const d = await r.json()
    return (d?.songs || []).map(s => ({
      id: s.id, title: s.title, artistName: s.artistName,
    }))
  } catch (_) { return [] }
}

async function addCoverViaWorker(token, { videoId, songId, channelId, youtubeTitle, viewCount, publishedAt }) {
  try {
    const r = await fetch(`${API_BASE}/api/admin/add-cover`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ videoId, songId, channelId, youtubeTitle, viewCount, publishedAt }),
    })
    if (!r.ok) return null
    return await r.json()
  } catch (_) { return null }
}

async function identifySongViaClaude(token, videoTitle, channelName) {
  try {
    const r = await fetch(`${API_BASE}/api/admin/identify-song`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ videoTitle, channelName }),
    })
    if (!r.ok) return null
    return await r.json()
  } catch (_) { return null }
}

// Search YouTube for "{title} {artist} {channelName}" — returns videos with channelId
async function youtubeSearchQuery(query, maxResults = 3) {
  try {
    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)}&type=video&maxResults=${maxResults}`
    const d = await ytFetch(url)
    return (d.items || []).map(item => ({
      videoId: item.id?.videoId,
      channelId: item.snippet?.channelId,
      title: item.snippet?.title || '',
      publishedAt: item.snippet?.publishedAt?.split('T')[0] || '',
    })).filter(v => v.videoId)
  } catch (_) { return [] }
}

/**
 * 3-stage channel scan:
 *   Stage 1: (already done — channel approved before this runs)
 *   Stage 2: Reverse-search. For each popular song in D1, YouTube-search
 *            "{title} {artist} {channelName}" and pick the result whose
 *            channelId matches the approved channel.
 *   Stage 3: Fetch remaining channel videos, ask Claude API to identify
 *            song/artist, verify via Spotify, add to D1 catalog + covers.
 *
 * @param {string} channelId
 * @param {string} channelName
 * @param {function} onProgress - ({stage, message, matched?, current?}) => void
 * @param {string} [adminToken] - Required for Stage 2/3 (they call Worker APIs)
 * @returns {Promise<{covers, stage2Matched, stage3Matched, skipped, alreadyExists, total, skippedVideos}>}
 */
export async function scanChannel(channelId, channelName, onProgress = () => {}, adminToken = null) {
  const covers = []               // for backwards-compat with Admin store
  const coveredVideoIds = new Set()
  const coveredSongIds = new Set()
  let stage2Matched = 0
  let stage3Matched = 0
  let skipped = 0
  const skippedVideos = []

  // If no admin token, fall back to minimal behaviour: fetch titles but don't sync
  if (!adminToken) {
    onProgress({ stage: 'error', message: 'Admin token required for 3-stage scan' })
    return {
      covers: [], stage2Matched: 0, stage3Matched: 0,
      skipped: 0, alreadyExists: 0, total: 0, skippedVideos: [],
    }
  }

  // ════════════════════════════════════════
  //  Stage 2: Reverse-search
  // ════════════════════════════════════════
  onProgress({ stage: 'reverse-search', message: '逆引き検索中... (Stage 2)' })
  const popularSongs = await fetchPopularSongsFromD1(200)
  console.log(`[Covery] Stage 2: ${popularSongs.length}曲でチャンネル内逆引き検索`)

  // Cap how many songs we probe to conserve YT quota (100 searches ≈ 10k units)
  const SONGS_TO_PROBE = Math.min(popularSongs.length, 100)
  for (let i = 0; i < SONGS_TO_PROBE; i++) {
    const song = popularSongs[i]
    if (coveredSongIds.has(song.id)) continue
    const query = `${song.title} ${song.artistName} ${channelName}`
    const hits = await youtubeSearchQuery(query, 3)
    const match = hits.find(h => h.channelId === channelId)
    if (match && !coveredVideoIds.has(match.videoId)) {
      // Insert cover into D1
      const res = await addCoverViaWorker(adminToken, {
        videoId: match.videoId,
        songId: song.id,
        channelId,
        youtubeTitle: match.title,
        viewCount: 0,
        publishedAt: match.publishedAt,
      })
      if (res) {
        stage2Matched++
        coveredVideoIds.add(match.videoId)
        coveredSongIds.add(song.id)
        covers.push({
          videoId: match.videoId,
          title: song.title,
          originalArtist: song.artistName,
          channelId, channelName,
          publishedAt: match.publishedAt,
        })
        onProgress({
          stage: 'reverse-search', matched: stage2Matched,
          current: `${song.title} / ${song.artistName}`,
        })
        console.log(`[Stage2] 一致: "${song.title}" / "${song.artistName}" (videoId=${match.videoId})`)
      }
    }
    await sleep(250) // polite to YouTube API
  }

  // ════════════════════════════════════════
  //  Stage 3: Claude API identification
  // ════════════════════════════════════════
  onProgress({ stage: 'ai-identify', message: 'AI判定中... (Stage 3)' })
  // Fetch the channel's 歌ってみた videos
  const channelVideos = []
  let pageToken = ''
  for (let page = 0; page < 3; page++) {
    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&q=歌ってみた&type=video&maxResults=50${pageToken ? `&pageToken=${pageToken}` : ''}`
    let data
    try { data = await ytFetch(url) } catch { break }
    const items = data.items || []
    for (const item of items) {
      const title = item.snippet?.title || ''
      const lower = title.toLowerCase()
      if (EXCLUDE_KEYWORDS.some(k => lower.includes(k.toLowerCase()))) continue
      const videoId = item.id?.videoId
      if (!videoId || coveredVideoIds.has(videoId)) continue
      channelVideos.push({
        videoId, title,
        publishedAt: item.snippet?.publishedAt?.split('T')[0] || '',
      })
    }
    pageToken = data.nextPageToken || ''
    if (!pageToken) break
    await sleep(400)
  }

  console.log(`[Covery] Stage 3: ${channelVideos.length}曲をAIで判定`)

  for (const video of channelVideos) {
    const result = await identifySongViaClaude(adminToken, video.title, channelName)
    // Claude disabled (no API key) → skip cleanly
    if (!result || result.skipped) {
      skipped++
      skippedVideos.push({
        youtubeTitle: video.title, searchQuery: '',
        reason: result?.reason || 'claude_api_error',
      })
      continue
    }
    if (!result.songTitle || !result.artistName) {
      skipped++
      console.log(`[Stage3 スキップ] "${video.title}" → Claude判定不能`)
      skippedVideos.push({
        youtubeTitle: video.title, searchQuery: '',
        reason: 'claude_returned_null',
      })
      continue
    }

    // Verify via Spotify before trusting Claude's output, then add to D1
    const verification = await spotifySearchViaWorker(`${result.songTitle} ${result.artistName}`, adminToken)
    let canonicalTitle = result.songTitle
    let canonicalArtist = result.artistName
    let spotifyId = ''
    if (verification && verification.length > 0) {
      const best = pickBestTrack(verification, `${result.songTitle} ${result.artistName}`)
      if (best) {
        canonicalTitle = best.name
        canonicalArtist = best.artist
        spotifyId = best.spotifyId
      }
    }

    const added = await addSongViaWorker(canonicalTitle, canonicalArtist, spotifyId, adminToken)
    if (!added) {
      skipped++
      skippedVideos.push({
        youtubeTitle: video.title,
        searchQuery: `${result.songTitle} / ${result.artistName}`,
        reason: 'add_song_failed',
      })
      continue
    }

    const cres = await addCoverViaWorker(adminToken, {
      videoId: video.videoId,
      songId: added.songId,
      channelId,
      youtubeTitle: video.title,
      viewCount: 0,
      publishedAt: video.publishedAt,
    })
    if (!cres) {
      skipped++
      skippedVideos.push({
        youtubeTitle: video.title,
        searchQuery: `${canonicalTitle} / ${canonicalArtist}`,
        reason: 'add_cover_failed',
      })
      continue
    }

    stage3Matched++
    coveredVideoIds.add(video.videoId)
    covers.push({
      videoId: video.videoId,
      title: canonicalTitle,
      originalArtist: canonicalArtist,
      channelId, channelName,
      publishedAt: video.publishedAt,
    })
    console.log(`[Stage3] 追加: "${video.title}" → "${canonicalTitle}" / "${canonicalArtist}" (confidence=${result.confidence})`)
    onProgress({
      stage: 'ai-identify', matched: stage3Matched,
      current: `${canonicalTitle} / ${canonicalArtist}`,
    })
    await sleep(300) // rate-limit Claude + Spotify
  }

  const total = stage2Matched + stage3Matched
  onProgress({
    stage: 'done',
    message: `スキャン完了: 逆引き${stage2Matched}曲 + AI判定${stage3Matched}曲 + スキップ${skipped}曲`,
  })
  console.log(`[Covery] スキャン完了: Stage2=${stage2Matched}, Stage3=${stage3Matched}, skipped=${skipped}, total=${total}`)

  return {
    covers,
    stage2Matched,
    stage3Matched,
    skipped,
    alreadyExists: 0,
    total,
    skippedVideos,
    // Backwards-compat fields (Admin UI / store consumes these)
    totalFound: total + skipped,
    totalFiltered: total,
    catalogMatched: stage2Matched,
    spotifyAdded: stage3Matched,
    unmatchedSkipped: skipped,
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
