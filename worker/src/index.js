import { corsResponse, jsonResponse, errorResponse } from './utils/cors.js'
import { handleSongs, handleSongCovers } from './routes/songs.js'
import { handleArtists, handleArtistSongs } from './routes/artists.js'
import { handleChannelCovers, handleSingers, handleSimilarSingers } from './routes/channels.js'
import { handleSearch } from './routes/search.js'
import {
  handleLogin, handleAdminChannels, handleAdminChannelCovers,
  handleApproveChannel, handleRejectChannel, handleResetChannel,
  handleRejectCover, handleApproveCover, handleAdminStats,
  handleSpotifySearch, handleAddSong,
} from './routes/admin.js'

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return corsResponse()

    const url = new URL(request.url)
    const path = url.pathname
    const method = request.method

    try {
      // Root
      if (path === '/' || path === '/api') {
        return jsonResponse({ status: 'ok', message: 'Covery API is running', version: '1.0' })
      }

      // ── Public API ──
      if (path === '/api/songs' && method === 'GET') return await handleSongs(request, env)

      const songCoversMatch = path.match(/^\/api\/songs\/(\d+)\/covers$/)
      if (songCoversMatch && method === 'GET') return await handleSongCovers(request, env, parseInt(songCoversMatch[1]))

      if (path === '/api/artists' && method === 'GET') return await handleArtists(request, env)

      const artistSongsMatch = path.match(/^\/api\/artists\/(\d+)\/songs$/)
      if (artistSongsMatch && method === 'GET') return await handleArtistSongs(request, env, parseInt(artistSongsMatch[1]))

      if (path === '/api/singers' && method === 'GET') return await handleSingers(request, env)

      const channelCoversMatch = path.match(/^\/api\/channels\/([^\/]+)\/covers$/)
      if (channelCoversMatch && method === 'GET') return await handleChannelCovers(request, env, channelCoversMatch[1])

      const similarMatch = path.match(/^\/api\/similar-singers\/([^\/]+)$/)
      if (similarMatch && method === 'GET') return await handleSimilarSingers(request, env, similarMatch[1])

      if (path === '/api/search' && method === 'GET') return await handleSearch(request, env)

      // ── Admin API ──
      if (path === '/api/admin/login' && method === 'POST') return await handleLogin(request, env)

      if (path === '/api/admin/channels' && method === 'GET') return await handleAdminChannels(request, env)

      const adminChCoversMatch = path.match(/^\/api\/admin\/channels\/([^\/]+)\/covers$/)
      if (adminChCoversMatch && method === 'GET') return await handleAdminChannelCovers(request, env, adminChCoversMatch[1])

      const approveChMatch = path.match(/^\/api\/admin\/channels\/([^\/]+)\/approve$/)
      if (approveChMatch && method === 'PUT') return await handleApproveChannel(request, env, approveChMatch[1])

      const rejectChMatch = path.match(/^\/api\/admin\/channels\/([^\/]+)\/reject$/)
      if (rejectChMatch && method === 'PUT') return await handleRejectChannel(request, env, rejectChMatch[1])

      const resetChMatch = path.match(/^\/api\/admin\/channels\/([^\/]+)\/reset$/)
      if (resetChMatch && method === 'PUT') return await handleResetChannel(request, env, resetChMatch[1])

      const rejectCoverMatch = path.match(/^\/api\/admin\/covers\/([^\/]+)\/reject$/)
      if (rejectCoverMatch && method === 'PUT') return await handleRejectCover(request, env, rejectCoverMatch[1])

      const approveCoverMatch = path.match(/^\/api\/admin\/covers\/([^\/]+)\/approve$/)
      if (approveCoverMatch && method === 'PUT') return await handleApproveCover(request, env, approveCoverMatch[1])

      if (path === '/api/admin/stats' && method === 'GET') return await handleAdminStats(request, env)

      if (path === '/api/admin/spotify-search' && method === 'POST') return await handleSpotifySearch(request, env)

      if (path === '/api/admin/add-song' && method === 'POST') return await handleAddSong(request, env)

      return errorResponse('Not Found', 404)
    } catch (e) {
      return errorResponse(e.message, 500)
    }
  },
}
