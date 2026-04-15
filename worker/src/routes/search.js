import { jsonResponse, errorResponse } from '../utils/cors.js'

export async function handleSearch(request, env) {
  const url = new URL(request.url)
  const q = url.searchParams.get('q')?.trim()
  if (!q) return jsonResponse({ results: [] })

  const like = `%${q}%`
  try {
    const { results } = await env.DB.prepare(`
      SELECT 'song' AS type, s.id, s.title AS name, a.name AS detail
      FROM songs s JOIN artists a ON s.artist_id = a.id
      WHERE s.title LIKE ?
      UNION ALL
      SELECT 'artist' AS type, a.id, a.name, COALESCE(a.reading, '') AS detail
      FROM artists a
      WHERE a.name LIKE ?
      UNION ALL
      SELECT 'channel' AS type, ch.id, ch.channel_name AS name, ch.channel_id AS detail
      FROM channels ch
      WHERE ch.channel_name LIKE ? AND ch.status = 'approved'
      LIMIT 30
    `).bind(like, like, like).all()

    return jsonResponse({
      results: results.map(r => ({ type: r.type, id: r.id, name: r.name, detail: r.detail })),
    })
  } catch (e) {
    return errorResponse(e.message)
  }
}
