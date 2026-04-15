import { jsonResponse, errorResponse } from '../utils/cors.js'

export async function handleChannelCovers(request, env, ytChannelId) {
  try {
    const channel = await env.DB.prepare(
      `SELECT id, channel_id, channel_name, thumbnail_url, subscriber_count FROM channels WHERE channel_id = ? AND status = 'approved'`
    ).bind(ytChannelId).first()
    if (!channel) return errorResponse('Channel not found or not approved', 404)

    const { results } = await env.DB.prepare(`
      SELECT c.video_id, c.view_count, c.published_at,
        s.id AS song_id, s.title AS song_title, a.name AS artist_name
      FROM covers c
      JOIN songs s ON c.song_id = s.id
      JOIN artists a ON s.artist_id = a.id
      WHERE c.channel_id = ? AND c.status = 'approved'
      ORDER BY c.view_count DESC
    `).bind(channel.id).all()

    return jsonResponse({
      channel: {
        channelId: channel.channel_id, channelName: channel.channel_name,
        thumbnailUrl: channel.thumbnail_url, subscriberCount: channel.subscriber_count,
      },
      covers: results.map(r => ({
        videoId: r.video_id, viewCount: r.view_count, publishedAt: r.published_at,
        songId: r.song_id, songTitle: r.song_title, artistName: r.artist_name,
      })),
    })
  } catch (e) {
    return errorResponse(e.message)
  }
}

export async function handleSingers(request, env) {
  const url = new URL(request.url)
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '10'), 100)

  try {
    const { results } = await env.DB.prepare(`
      SELECT ch.channel_id, ch.channel_name, ch.thumbnail_url, ch.subscriber_count,
        (SELECT COUNT(*) FROM covers c WHERE c.channel_id = ch.id AND c.status = 'approved') AS cover_count
      FROM channels ch
      WHERE ch.status = 'approved'
      ORDER BY RANDOM()
      LIMIT ?
    `).bind(limit).all()

    return jsonResponse({
      singers: results.map(r => ({
        channelId: r.channel_id, channelName: r.channel_name,
        thumbnailUrl: r.thumbnail_url, subscriberCount: r.subscriber_count, coverCount: r.cover_count,
      })),
    })
  } catch (e) {
    return errorResponse(e.message)
  }
}

export async function handleSimilarSingers(request, env, ytChannelId) {
  try {
    // Get this channel's internal ID and song IDs
    const me = await env.DB.prepare(`SELECT id FROM channels WHERE channel_id = ?`).bind(ytChannelId).first()
    if (!me) return errorResponse('Channel not found', 404)

    const myCovers = await env.DB.prepare(
      `SELECT DISTINCT song_id FROM covers WHERE channel_id = ? AND status = 'approved'`
    ).bind(me.id).all()
    const mySongIds = new Set(myCovers.results.map(r => r.song_id))
    if (mySongIds.size === 0) return jsonResponse({ similar: [] })

    // Get all other channels covering same songs
    const placeholders = [...mySongIds].map(() => '?').join(',')
    const { results: candidates } = await env.DB.prepare(`
      SELECT ch.id, ch.channel_id, ch.channel_name, ch.thumbnail_url, ch.subscriber_count,
        c.song_id
      FROM covers c
      JOIN channels ch ON c.channel_id = ch.id
      WHERE c.song_id IN (${placeholders}) AND ch.id != ? AND ch.status = 'approved' AND c.status = 'approved'
    `).bind(...mySongIds, me.id).all()

    // Group by channel, count overlap
    const overlapMap = new Map()
    for (const r of candidates) {
      if (!overlapMap.has(r.id)) {
        overlapMap.set(r.id, {
          channelId: r.channel_id, channelName: r.channel_name,
          thumbnailUrl: r.thumbnail_url, subscriberCount: r.subscriber_count,
          overlap: new Set(),
        })
      }
      overlapMap.get(r.id).overlap.add(r.song_id)
    }

    // Get total cover counts per candidate channel
    const candIds = [...overlapMap.keys()]
    if (candIds.length === 0) return jsonResponse({ similar: [] })
    const phs = candIds.map(() => '?').join(',')
    const { results: counts } = await env.DB.prepare(
      `SELECT channel_id, COUNT(DISTINCT song_id) AS total FROM covers WHERE channel_id IN (${phs}) AND status = 'approved' GROUP BY channel_id`
    ).bind(...candIds).all()
    const totalMap = new Map(counts.map(r => [r.channel_id, r.total]))

    // Calculate Jaccard
    const myCount = mySongIds.size
    const similar = []
    for (const [chId, info] of overlapMap) {
      const overlap = info.overlap.size
      const total = totalMap.get(chId) || overlap
      const union = myCount + total - overlap
      const jaccard = union > 0 ? overlap / union : 0
      if (jaccard < 0.1) continue
      similar.push({
        channelId: info.channelId, channelName: info.channelName,
        thumbnailUrl: info.thumbnailUrl, subscriberCount: info.subscriberCount,
        jaccard: Math.round(jaccard * 100), overlapCount: overlap,
      })
    }
    similar.sort((a, b) => b.jaccard - a.jaccard)

    return jsonResponse({ similar: similar.slice(0, 10) })
  } catch (e) {
    return errorResponse(e.message)
  }
}
