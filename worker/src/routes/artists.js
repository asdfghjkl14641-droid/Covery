import { jsonResponse, errorResponse } from '../utils/cors.js'

export async function handleArtists(request, env) {
  try {
    const { results } = await env.DB.prepare(`
      SELECT a.id, a.name, a.reading, a.image_url, a.genre,
        (SELECT COUNT(*) FROM songs s WHERE s.artist_id = a.id) AS song_count
      FROM artists a
      ORDER BY
        CASE WHEN a.reading GLOB '[0-9]*' THEN 0
             WHEN a.reading GLOB '[A-Za-z]*' THEN 1
             ELSE 2 END,
        a.reading COLLATE NOCASE
    `).all()
    return jsonResponse({
      artists: results.map(r => ({
        id: r.id, name: r.name, reading: r.reading,
        imageUrl: r.image_url || '', genre: r.genre || '',
        songCount: r.song_count,
      })),
    })
  } catch (e) {
    return errorResponse(e.message)
  }
}

export async function handleArtistSongs(request, env, artistId) {
  try {
    const artist = await env.DB.prepare(`SELECT id, name FROM artists WHERE id = ?`).bind(artistId).first()
    if (!artist) return errorResponse('Artist not found', 404)

    const { results } = await env.DB.prepare(`
      SELECT s.id, s.title, s.deezer_rank,
        (SELECT COUNT(*) FROM covers c
         JOIN channels ch ON c.channel_id = ch.id
         WHERE c.song_id = s.id AND ch.status = 'approved' AND c.status = 'approved'
        ) AS cover_count
      FROM songs s
      WHERE s.artist_id = ?
      ORDER BY s.deezer_rank DESC
    `).bind(artistId).all()

    return jsonResponse({
      artist: { id: artist.id, name: artist.name },
      songs: results.map(r => ({ id: r.id, title: r.title, deezerRank: r.deezer_rank, coverCount: r.cover_count })),
    })
  } catch (e) {
    return errorResponse(e.message)
  }
}
