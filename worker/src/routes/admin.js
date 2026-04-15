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
        ch.subscriber_count, ch.status, ch.created_at, ch.updated_at,
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
        coverCount: r.cover_count, createdAt: r.created_at, updatedAt: r.updated_at,
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
    `UPDATE channels SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE channel_id = ?`
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
