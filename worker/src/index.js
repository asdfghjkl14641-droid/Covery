import { corsResponse, jsonResponse, errorResponse } from './utils/cors.js'
import { handleSongs, handleSongCovers } from './routes/songs.js'
import { handleArtists, handleArtistSongs } from './routes/artists.js'
import { handleChannelCovers, handleSingers, handleSimilarSingers } from './routes/channels.js'
import { handleSearch } from './routes/search.js'

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return corsResponse()

    const url = new URL(request.url)
    const path = url.pathname

    try {
      // GET /
      if (path === '/' || path === '/api') {
        return jsonResponse({ status: 'ok', message: 'Covery API is running', version: '1.0' })
      }

      // GET /api/songs
      if (path === '/api/songs' && request.method === 'GET') {
        return await handleSongs(request, env)
      }

      // GET /api/songs/:songId/covers
      const songCoversMatch = path.match(/^\/api\/songs\/(\d+)\/covers$/)
      if (songCoversMatch && request.method === 'GET') {
        return await handleSongCovers(request, env, parseInt(songCoversMatch[1]))
      }

      // GET /api/artists
      if (path === '/api/artists' && request.method === 'GET') {
        return await handleArtists(request, env)
      }

      // GET /api/artists/:artistId/songs
      const artistSongsMatch = path.match(/^\/api\/artists\/(\d+)\/songs$/)
      if (artistSongsMatch && request.method === 'GET') {
        return await handleArtistSongs(request, env, parseInt(artistSongsMatch[1]))
      }

      // GET /api/singers
      if (path === '/api/singers' && request.method === 'GET') {
        return await handleSingers(request, env)
      }

      // GET /api/channels/:channelId/covers
      const channelCoversMatch = path.match(/^\/api\/channels\/([^\/]+)\/covers$/)
      if (channelCoversMatch && request.method === 'GET') {
        return await handleChannelCovers(request, env, channelCoversMatch[1])
      }

      // GET /api/similar-singers/:channelId
      const similarMatch = path.match(/^\/api\/similar-singers\/([^\/]+)$/)
      if (similarMatch && request.method === 'GET') {
        return await handleSimilarSingers(request, env, similarMatch[1])
      }

      // GET /api/search?q=...
      if (path === '/api/search' && request.method === 'GET') {
        return await handleSearch(request, env)
      }

      return errorResponse('Not Found', 404)
    } catch (e) {
      return errorResponse(e.message, 500)
    }
  },
}
