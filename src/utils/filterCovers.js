import { useAdminStore } from '../store/useAdminStore'
import metadata from '../data/metadata.json'

/**
 * Get all songs visible to users.
 * devMode=true → show all from metadata.json
 * devMode=false → show only approved channels (metadata + scanResults merged)
 */
export function getApprovedSongs() {
  const { approvedIds, devMode, scanResults } = useAdminStore.getState()

  if (devMode) return metadata.songs
  if (!approvedIds || approvedIds.size === 0) return metadata.songs // fallback: 0 approved = show all

  // Filter metadata songs to approved channels
  const songs = metadata.songs
    .map(s => ({
      ...s,
      covers: (s.covers || []).filter(c => approvedIds.has(c.singerId))
    }))
    .filter(s => s.covers.length > 0)

  // Merge scanResults covers
  const existingVideoIds = new Set()
  songs.forEach(s => s.covers.forEach(c => existingVideoIds.add(c.videoId)))

  for (const [channelId, result] of Object.entries(scanResults || {})) {
    if (!approvedIds.has(channelId) || !result?.covers) continue
    for (const cover of result.covers) {
      if (existingVideoIds.has(cover.videoId)) continue
      existingVideoIds.add(cover.videoId)

      const existing = songs.find(s => s.title === cover.title && s.originalArtist === cover.originalArtist)
      const coverEntry = {
        videoId: cover.videoId,
        singerId: cover.channelId || channelId,
        publishedAt: cover.publishedAt || '',
        thumbnailUrl: cover.thumbnailUrl || `https://img.youtube.com/vi/${cover.videoId}/hqdefault.jpg`,
      }

      if (existing) {
        existing.covers.push(coverEntry)
      } else {
        songs.push({
          id: `song_${cover.videoId}`,
          title: cover.title || '不明',
          originalArtist: cover.originalArtist || '不明',
          singerName: cover.channelName || '',
          genre: ['J-POP'],
          covers: [coverEntry],
        })
      }
    }
  }

  return songs
}

/**
 * Get singers visible to users.
 */
export function getApprovedSingers() {
  const { approvedIds, devMode } = useAdminStore.getState()

  if (devMode) return metadata.singers
  if (!approvedIds || approvedIds.size === 0) return metadata.singers

  return metadata.singers.filter(s => approvedIds.has(s.channelId))
}

// Legacy wrappers (used by pages that pass approvedIds/devMode as args)
export function filterSongs(songs, approvedIds, devMode) {
  if (devMode) return songs
  if (!approvedIds || approvedIds.size === 0) return songs
  return songs.filter(s => {
    const singerId = s.covers?.[0]?.singerId
    return singerId && approvedIds.has(singerId)
  })
}

export function filterSingers(singers, approvedIds, devMode) {
  if (devMode) return singers
  if (!approvedIds || approvedIds.size === 0) return singers
  return singers.filter(s => approvedIds.has(s.channelId))
}
