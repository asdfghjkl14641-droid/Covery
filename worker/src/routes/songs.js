import { jsonResponse, errorResponse } from '../utils/cors.js'

export async function handleSongsBatch(request, env) {
  const url = new URL(request.url)
  const idsParam = url.searchParams.get('ids') || ''
  const ids = idsParam
    .split(',')
    .map(s => parseInt(s.trim(), 10))
    .filter(n => Number.isInteger(n) && n > 0)

  if (ids.length === 0) return jsonResponse({ songs: [] })
  if (ids.length > 100) return errorResponse('Too many ids (max 100)', 400)

  try {
    const placeholders = ids.map(() => '?').join(',')

    const songsResult = await env.DB.prepare(`
      SELECT s.id AS song_id, s.title, s.deezer_rank, s.genre,
        a.id AS artist_id, a.name AS artist_name, a.image_url AS artist_image_url, a.genre AS artist_genre
      FROM songs s
      JOIN artists a ON a.id = s.artist_id
      WHERE s.id IN (${placeholders})
    `).bind(...ids).all()

    const coversResult = await env.DB.prepare(`
      SELECT c.video_id, c.song_id, c.youtube_title, c.view_count, c.published_at, c.duration,
        ch.channel_id AS yt_channel_id, ch.channel_name, ch.thumbnail_url AS channel_thumbnail
      FROM covers c
      JOIN channels ch ON ch.id = c.channel_id
      WHERE c.song_id IN (${placeholders})
        AND c.status = 'approved' AND ch.status = 'approved'
      ORDER BY c.view_count DESC
    `).bind(...ids).all()

    const coversBySongId = {}
    for (const cov of (coversResult.results || [])) {
      if (!coversBySongId[cov.song_id]) coversBySongId[cov.song_id] = []
      coversBySongId[cov.song_id].push({
        videoId: cov.video_id,
        youtubeTitle: cov.youtube_title,
        viewCount: cov.view_count,
        publishedAt: cov.published_at,
        duration: cov.duration,
        channel: {
          channelId: cov.yt_channel_id,
          channelName: cov.channel_name,
          thumbnailUrl: cov.channel_thumbnail,
        },
      })
    }

    const songs = (songsResult.results || []).map(row => ({
      id: row.song_id,
      title: row.title,
      deezerRank: row.deezer_rank,
      genre: row.genre || row.artist_genre || '',
      artist: {
        id: row.artist_id,
        name: row.artist_name,
        imageUrl: row.artist_image_url || '',
        genre: row.artist_genre || '',
      },
      covers: coversBySongId[row.song_id] || [],
    }))

    // Preserve requested id order (user's favorites order)
    const songsById = Object.fromEntries(songs.map(s => [s.id, s]))
    const orderedSongs = ids.map(id => songsById[id]).filter(Boolean)

    return jsonResponse({ songs: orderedSongs })
  } catch (e) {
    return errorResponse(e.message)
  }
}

export async function handleSongs(request, env) {
  const url = new URL(request.url)
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 100)
  const random = url.searchParams.get('random') !== 'false'
  const artistId = url.searchParams.get('artist_id')

  try {
    // Wrap in subquery so we can filter on cover_count
    let query = `
      SELECT * FROM (
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
    query += ` ) WHERE cover_count > 0 ORDER BY ${random ? 'RANDOM()' : 'deezer_rank DESC'} LIMIT ?`
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
