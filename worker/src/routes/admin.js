import { jsonResponse, errorResponse } from '../utils/cors.js'
import { signJWT, verifyAuth } from '../utils/auth.js'

const TOKEN_TTL_SEC = 24 * 60 * 60 // 24 hours

export async function handleLogin(request, env) {
  try {
    const body = await request.json()
    const password = body?.password
    const expected = env.ADMIN_PASSWORD || 'covery2026'
    if (password !== expected) {
      return errorResponse('パスワードが違います', 401)
    }
    const exp = Math.floor(Date.now() / 1000) + TOKEN_TTL_SEC
    const token = await signJWT({ role: 'admin', exp }, env.JWT_SECRET || 'covery-jwt-secret-2026')
    return jsonResponse({ token, expiresIn: TOKEN_TTL_SEC })
  } catch (e) {
    return errorResponse(e.message)
  }
}

async function requireAuth(request, env) {
  const payload = await verifyAuth(request, env)
  if (!payload || payload.role !== 'admin') {
    return errorResponse('Unauthorized', 401)
  }
  return null
}

export async function handleAdminChannels(request, env) {
  const unauth = await requireAuth(request, env); if (unauth) return unauth
  const url = new URL(request.url)
  const status = url.searchParams.get('status')
  const search = url.searchParams.get('search')
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 200)
  const offset = parseInt(url.searchParams.get('offset') || '0')

  try {
    let where = ''
    const params = []
    const conditions = []
    if (status) { conditions.push('ch.status = ?'); params.push(status) }
    if (search) { conditions.push("ch.channel_name LIKE '%' || ? || '%'"); params.push(search) }
    if (conditions.length) where = 'WHERE ' + conditions.join(' AND ')

    const { results } = await env.DB.prepare(`
      SELECT ch.id, ch.channel_id, ch.channel_name, ch.channel_url, ch.thumbnail_url,
        ch.subscriber_count, ch.status, ch.created_at,
        (SELECT COUNT(*) FROM covers c WHERE c.channel_id = ch.id) AS cover_count
      FROM channels ch
      ${where}
      ORDER BY ch.created_at DESC
      LIMIT ? OFFSET ?
    `).bind(...params, limit, offset).all()

    // Stats
    const stats = await env.DB.prepare(`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) AS approved,
        SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) AS rejected,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending,
        SUM(CASE WHEN status = 'scanning' THEN 1 ELSE 0 END) AS scanning
      FROM channels
    `).first()

    return jsonResponse({
      channels: results.map(r => ({
        id: r.id, channelId: r.channel_id, channelName: r.channel_name,
        channelUrl: r.channel_url, thumbnailUrl: r.thumbnail_url,
        subscriberCount: r.subscriber_count, status: r.status,
        coverCount: r.cover_count, createdAt: r.created_at,
      })),
      total: stats.total,
      stats,
    })
  } catch (e) { return errorResponse(e.message) }
}

export async function handleAdminChannelCovers(request, env, ytChannelId) {
  const unauth = await requireAuth(request, env); if (unauth) return unauth
  try {
    const { results } = await env.DB.prepare(`
      SELECT c.video_id, c.youtube_title, c.view_count, c.published_at, c.duration, c.status,
        s.title AS song_title, a.name AS artist_name
      FROM covers c
      JOIN songs s ON c.song_id = s.id
      JOIN artists a ON s.artist_id = a.id
      JOIN channels ch ON c.channel_id = ch.id
      WHERE ch.channel_id = ?
      ORDER BY c.view_count DESC
    `).bind(ytChannelId).all()

    return jsonResponse({
      covers: results.map(r => ({
        videoId: r.video_id, youtubeTitle: r.youtube_title, viewCount: r.view_count,
        publishedAt: r.published_at, duration: r.duration, status: r.status,
        songTitle: r.song_title, artistName: r.artist_name,
      })),
    })
  } catch (e) { return errorResponse(e.message) }
}

async function setChannelStatus(env, ytChannelId, status) {
  const result = await env.DB.prepare(
    `UPDATE channels SET status = ? WHERE channel_id = ?`
  ).bind(status, ytChannelId).run()
  return result.meta?.changes > 0
}

export async function handleApproveChannel(request, env, ytChannelId) {
  const unauth = await requireAuth(request, env); if (unauth) return unauth
  try {
    const ok = await setChannelStatus(env, ytChannelId, 'approved')
    if (!ok) return errorResponse('Channel not found', 404)
    return jsonResponse({ success: true, channelId: ytChannelId, status: 'approved' })
  } catch (e) { return errorResponse(e.message) }
}

export async function handleRejectChannel(request, env, ytChannelId) {
  const unauth = await requireAuth(request, env); if (unauth) return unauth
  try {
    const ok = await setChannelStatus(env, ytChannelId, 'rejected')
    if (!ok) return errorResponse('Channel not found', 404)
    return jsonResponse({ success: true, channelId: ytChannelId, status: 'rejected' })
  } catch (e) { return errorResponse(e.message) }
}

export async function handleResetChannel(request, env, ytChannelId) {
  const unauth = await requireAuth(request, env); if (unauth) return unauth
  try {
    const ok = await setChannelStatus(env, ytChannelId, 'pending')
    if (!ok) return errorResponse('Channel not found', 404)
    return jsonResponse({ success: true, channelId: ytChannelId, status: 'pending' })
  } catch (e) { return errorResponse(e.message) }
}

async function setCoverStatus(env, videoId, status) {
  const result = await env.DB.prepare(
    `UPDATE covers SET status = ? WHERE video_id = ?`
  ).bind(status, videoId).run()
  return result.meta?.changes > 0
}

export async function handleRejectCover(request, env, videoId) {
  const unauth = await requireAuth(request, env); if (unauth) return unauth
  try {
    const ok = await setCoverStatus(env, videoId, 'rejected')
    if (!ok) return errorResponse('Cover not found', 404)
    return jsonResponse({ success: true, videoId, status: 'rejected' })
  } catch (e) { return errorResponse(e.message) }
}

export async function handleApproveCover(request, env, videoId) {
  const unauth = await requireAuth(request, env); if (unauth) return unauth
  try {
    const ok = await setCoverStatus(env, videoId, 'approved')
    if (!ok) return errorResponse('Cover not found', 404)
    return jsonResponse({ success: true, videoId, status: 'approved' })
  } catch (e) { return errorResponse(e.message) }
}

// ══════════════════════════════════════════════════════════
//  Spotify integration — proxies through Worker to avoid CORS
// ══════════════════════════════════════════════════════════
// Simple in-memory token cache keyed by Worker instance lifetime
let _spotifyTokenCache = null // { token, expiresAt }

async function getSpotifyToken(env) {
  const now = Date.now()
  if (_spotifyTokenCache && _spotifyTokenCache.expiresAt > now + 30_000) {
    return _spotifyTokenCache.token
  }
  const id = env.SPOTIFY_CLIENT_ID
  const secret = env.SPOTIFY_CLIENT_SECRET
  if (!id || !secret) throw new Error('Spotify credentials not configured')
  const basic = btoa(`${id}:${secret}`)
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${basic}`,
    },
    body: 'grant_type=client_credentials',
  })
  if (!res.ok) throw new Error(`Spotify auth failed: ${res.status}`)
  const data = await res.json()
  _spotifyTokenCache = {
    token: data.access_token,
    expiresAt: now + (data.expires_in || 3600) * 1000,
  }
  return _spotifyTokenCache.token
}

export async function handleSpotifySearch(request, env) {
  const unauth = await requireAuth(request, env); if (unauth) return unauth
  try {
    const body = await request.json()
    const query = (body?.query || '').trim()
    if (!query) return errorResponse('query required', 400)
    // Optional: market=JP (default) or market=none for global search
    const market = body?.market === 'none' ? null : (body?.market || 'JP')
    const limit = Math.min(parseInt(body?.limit || 10, 10) || 10, 20)
    const token = await getSpotifyToken(env)
    const params = [
      `q=${encodeURIComponent(query)}`,
      `type=track`,
      `limit=${limit}`,
    ]
    if (market) params.push(`market=${market}`)
    const url = `https://api.spotify.com/v1/search?${params.join('&')}`
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    if (!res.ok) return errorResponse(`Spotify search failed: ${res.status}`, res.status)
    const data = await res.json()
    const tracks = (data?.tracks?.items || []).map(t => ({
      name: t.name,
      artist: t.artists?.[0]?.name || '',
      spotifyId: t.id,
      duration: Math.round((t.duration_ms || 0) / 1000),
    }))
    return jsonResponse({ tracks })
  } catch (e) { return errorResponse(e.message) }
}

export async function handleAddSong(request, env) {
  const unauth = await requireAuth(request, env); if (unauth) return unauth
  try {
    const body = await request.json()
    const title = (body?.title || '').trim()
    const artistName = (body?.artistName || '').trim()
    const spotifyId = (body?.spotifyId || '').trim()
    if (!title || !artistName) return errorResponse('title and artistName required', 400)

    // Insert artist (ignore if exists)
    await env.DB.prepare(`INSERT OR IGNORE INTO artists (name) VALUES (?)`).bind(artistName).run()
    const artistRow = await env.DB.prepare(`SELECT id FROM artists WHERE name = ?`).bind(artistName).first()
    if (!artistRow) return errorResponse('Failed to create/find artist', 500)

    // Insert song (ignore if exists)
    await env.DB.prepare(
      `INSERT OR IGNORE INTO songs (title, artist_id) VALUES (?, ?)`
    ).bind(title, artistRow.id).run()
    const songRow = await env.DB.prepare(
      `SELECT id FROM songs WHERE title = ? AND artist_id = ?`
    ).bind(title, artistRow.id).first()
    if (!songRow) return errorResponse('Failed to create/find song', 500)

    return jsonResponse({
      songId: songRow.id,
      artistId: artistRow.id,
      title,
      artistName,
      spotifyId,
    })
  } catch (e) { return errorResponse(e.message) }
}

// ══════════════════════════════════════════════════════════
//  Cover insert — used by Stage 2/3 of the 3-stage scanner
// ══════════════════════════════════════════════════════════
export async function handleAddCover(request, env) {
  const unauth = await requireAuth(request, env); if (unauth) return unauth
  try {
    const body = await request.json()
    const videoId = (body?.videoId || '').trim()
    const songId = parseInt(body?.songId, 10)
    const channelId = (body?.channelId || '').trim() // YouTube channel ID string
    const youtubeTitle = (body?.youtubeTitle || '').trim()
    const viewCount = parseInt(body?.viewCount || 0, 10) || 0
    const publishedAt = (body?.publishedAt || '').trim()
    if (!videoId || !songId || !channelId) {
      return errorResponse('videoId, songId, channelId required', 400)
    }

    // Resolve the channel's internal row id (must exist)
    const chRow = await env.DB.prepare(
      `SELECT id FROM channels WHERE channel_id = ?`
    ).bind(channelId).first()
    if (!chRow) return errorResponse('Channel not found in DB', 404)

    await env.DB.prepare(
      `INSERT OR IGNORE INTO covers
       (video_id, song_id, channel_id, youtube_title, view_count, published_at, status)
       VALUES (?, ?, ?, ?, ?, ?, 'approved')`
    ).bind(videoId, songId, chRow.id, youtubeTitle, viewCount, publishedAt).run()

    return jsonResponse({ success: true, videoId, songId })
  } catch (e) { return errorResponse(e.message) }
}

// ══════════════════════════════════════════════════════════
//  Claude-based song identification (Stage 3)
// ══════════════════════════════════════════════════════════
export async function handleIdentifySong(request, env) {
  const unauth = await requireAuth(request, env); if (unauth) return unauth
  const apiKey = env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return jsonResponse({
      songTitle: null, artistName: null, confidence: null,
      skipped: true, reason: 'ANTHROPIC_API_KEY_not_configured',
    })
  }
  try {
    const body = await request.json()
    const videoTitle = (body?.videoTitle || '').trim()
    const channelName = (body?.channelName || '').trim()
    if (!videoTitle) return errorResponse('videoTitle required', 400)

    const prompt = `以下のYouTube動画タイトルから、カバーされている原曲の曲名とアーティスト名を判定してください。歌ってみた（カバー）動画のタイトルです。

動画タイトル: "${videoTitle}"
チャンネル名: "${channelName}"

以下のJSON形式のみで回答してください。判定できない場合は両方nullを返してください。説明文やMarkdownコードブロックは一切含めないでください。
{"songTitle": "曲名", "artistName": "アーティスト名", "confidence": "high|medium|low"}`

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 200,
        messages: [{ role: 'user', content: prompt }],
      }),
    })
    if (!res.ok) {
      const errText = await res.text()
      return errorResponse(`Anthropic API error ${res.status}: ${errText.slice(0, 200)}`, res.status)
    }
    const data = await res.json()
    const text = data?.content?.[0]?.text || ''
    // Try to parse JSON out of Claude's response
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return jsonResponse({ songTitle: null, artistName: null, confidence: null, skipped: true, reason: 'parse_error', rawText: text })
    }
    let parsed
    try { parsed = JSON.parse(jsonMatch[0]) } catch {
      return jsonResponse({ songTitle: null, artistName: null, confidence: null, skipped: true, reason: 'json_parse_error' })
    }
    return jsonResponse({
      songTitle: parsed.songTitle || null,
      artistName: parsed.artistName || null,
      confidence: parsed.confidence || null,
    })
  } catch (e) { return errorResponse(e.message) }
}

export async function handleAdminStats(request, env) {
  const unauth = await requireAuth(request, env); if (unauth) return unauth
  try {
    const channelStats = await env.DB.prepare(`
      SELECT COUNT(*) AS total,
        SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) AS approved,
        SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) AS rejected,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending,
        SUM(CASE WHEN status = 'scanning' THEN 1 ELSE 0 END) AS scanning
      FROM channels
    `).first()

    const coverStats = await env.DB.prepare(`
      SELECT COUNT(*) AS total,
        SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) AS approved,
        SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) AS rejected
      FROM covers
    `).first()

    const artists = await env.DB.prepare(`SELECT COUNT(*) AS c FROM artists`).first()
    const songs = await env.DB.prepare(`SELECT COUNT(*) AS c FROM songs`).first()

    return jsonResponse({
      channels: channelStats,
      covers: coverStats,
      artists: artists.c,
      songs: songs.c,
    })
  } catch (e) { return errorResponse(e.message) }
}
