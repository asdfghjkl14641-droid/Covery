const API_BASE = 'https://covery-api.asdfghjkl14641.workers.dev'

async function apiFetch(endpoint, options = {}) {
  try {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...options.headers },
    })
    if (!res.ok) throw new Error(`API error: ${res.status}`)
    return await res.json()
  } catch (error) {
    console.error(`[Covery API] Failed: ${endpoint}`, error)
    return null
  }
}

// ── Public API ──
export async function fetchSongs(limit = 20, random = true) {
  return apiFetch(`/api/songs?limit=${limit}&random=${random}`)
}

export async function fetchSongCovers(songId) {
  return apiFetch(`/api/songs/${songId}/covers`)
}

export async function fetchArtists() {
  return apiFetch('/api/artists')
}

export async function fetchArtistSongs(artistId) {
  return apiFetch(`/api/artists/${artistId}/songs`)
}

export async function fetchSingers(limit = 10) {
  return apiFetch(`/api/singers?limit=${limit}`)
}

export async function fetchChannelCovers(channelId) {
  return apiFetch(`/api/channels/${channelId}/covers`)
}

export async function fetchSimilarSingers(channelId) {
  return apiFetch(`/api/similar-singers/${channelId}`)
}

export async function searchAll(query) {
  return apiFetch(`/api/search?q=${encodeURIComponent(query)}`)
}

// ── Admin API ──
export async function adminLogin(password) {
  return apiFetch('/api/admin/login', {
    method: 'POST',
    body: JSON.stringify({ password }),
  })
}

export async function fetchAdminChannels(token, status = null, search = null) {
  let endpoint = '/api/admin/channels?limit=50'
  if (status) endpoint += `&status=${status}`
  if (search) endpoint += `&search=${encodeURIComponent(search)}`
  return apiFetch(endpoint, { headers: { Authorization: `Bearer ${token}` } })
}

export async function fetchAdminChannelCovers(token, channelId) {
  return apiFetch(`/api/admin/channels/${channelId}/covers`, {
    headers: { Authorization: `Bearer ${token}` },
  })
}

export async function approveChannel(token, channelId) {
  return apiFetch(`/api/admin/channels/${channelId}/approve`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}` },
  })
}

export async function rejectChannel(token, channelId) {
  return apiFetch(`/api/admin/channels/${channelId}/reject`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}` },
  })
}

export async function resetChannel(token, channelId) {
  return apiFetch(`/api/admin/channels/${channelId}/reset`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}` },
  })
}

export async function rejectCover(token, videoId) {
  return apiFetch(`/api/admin/covers/${videoId}/reject`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}` },
  })
}

export async function approveCover(token, videoId) {
  return apiFetch(`/api/admin/covers/${videoId}/approve`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}` },
  })
}

export async function fetchAdminStats(token) {
  return apiFetch('/api/admin/stats', {
    headers: { Authorization: `Bearer ${token}` },
  })
}
