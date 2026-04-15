import { jsonResponse, errorResponse } from '../utils/cors.js'

export async function handleSongs(request, env) {
  const url = new URL(request.url)
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 100)
  const random = url.searchParams.get('random') !== 'false'
  const artistId = url.searchParams.get('artist_id')

  try {
    let query = `
      SELECT s.id, s.title, s.deezer_rank, a.name AS artist_name,
        (SELECT COUNT(*) FROM covers c
         JOIN channels ch ON c.channel_id = ch.id
         WHERE c.song_id = s.id AND ch.status = 'approved' AND c.status = 'approved'
        ) AS cover_count
      FROM songs s
      JOIN artists a ON s.artist_id = a.id
    `
    const params = []
    if (artistId) {
      query += ` WHERE s.artist_id = ?`
      params.push(parseInt(artistId))
    }
    query += ` HAVING cover_count > 0 ORDER BY ${random ? 'RANDOM()' : 's.deezer_rank DESC'} LIMIT ?`
    params.push(limit)

    const { results } = await env.DB.prepare(query).bind(...params).all()
    return jsonResponse({ songs: results.map(r => ({
      id: r.id, title: r.title, artistName: r.artist_name,
      coverCount: r.cover_count, deezerRank: r.deezer_rank,
    })) })
  } catch (e) {
    return errorResponse(e.message)
  }
}

export async function handleSongCovers(request, env, songId) {
  try {
    const songRow = await env.DB.prepare(
      `SELECT s.id, s.title, a.name AS artist_name FROM songs s JOIN artists a ON s.artist_id = a.id WHERE s.id = ?`
    ).bind(songId).first()
    if (!songRow) return errorResponse('Song not found', 404)

    const { results } = await env.DB.prepare(`
      SELECT c.video_id, c.view_count, c.published_at, c.youtube_title,
        ch.channel_name, ch.channel_id AS yt_channel_id, ch.thumbnail_url
      FROM covers c
      JOIN channels ch ON c.channel_id = ch.id
      WHERE c.song_id = ? AND ch.status = 'approved' AND c.status = 'approved'
      ORDER BY c.view_count DESC
    `).bind(songId).all()

    return jsonResponse({
      song: { id: songRow.id, title: songRow.title, artistName: songRow.artist_name },
      covers: results.map(r => ({
        videoId: r.video_id, channelName: r.channel_name, channelId: r.yt_channel_id,
        thumbnailUrl: r.thumbnail_url, viewCount: r.view_count, publishedAt: r.published_at,
        youtubeTitle: r.youtube_title,
      })),
    })
  } catch (e) {
    return errorResponse(e.message)
  }
}
