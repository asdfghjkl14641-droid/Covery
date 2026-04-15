import { useAdminStore } from '../store/useAdminStore'
import metadata from '../data/metadata.json'

/**
 * Get all songs visible to users.
 * devMode=true → show all (bypass all filters)
 * devMode=false → approved channels only, excluding individually rejected covers
 */
export function getApprovedSongs() {
  const { approvedIds, devMode, scanResults, coverDecisions } = useAdminStore.getState()

  // Dev mode: show everything
  if (devMode) return metadata.songs

  // No approved channels: return empty (D1/API is source of truth; UI shows "準備中")
  if (!approvedIds || approvedIds.size === 0) return []

  const rejectedVideoIds = new Set(
    Object.entries(coverDecisions || {}).filter(([, v]) => v === 'rejected').map(([k]) => k)
  )

  // Filter metadata songs to approved channels + not individually rejected
  const songs = metadata.songs
    .map(s => ({
      ...s,
      covers: (s.covers || []).filter(c =>
        approvedIds.has(c.singerId) && !rejectedVideoIds.has(c.videoId)
      )
    }))
    .filter(s => s.covers.length > 0)

  // Merge scanResults covers from approved channels
  const existingVideoIds = new Set()
  songs.forEach(s => s.covers.forEach(c => existingVideoIds.add(c.videoId)))

  for (const [channelId, result] of Object.entries(scanResults || {})) {
    if (!approvedIds.has(channelId) || !result?.covers) continue
    for (const cover of result.covers) {
      if (existingVideoIds.has(cover.videoId)) continue
      if (rejectedVideoIds.has(cover.videoId)) continue
      existingVideoIds.add(cover.videoId)

      const coverEntry = {
        videoId: cover.videoId,
        singerId: cover.channelId || channelId,
        publishedAt: cover.publishedAt || '',
        thumbnailUrl: cover.thumbnailUrl || `https://img.youtube.com/vi/${cover.videoId}/hqdefault.jpg`,
      }

      const existing = songs.find(s => s.title === cover.title && s.originalArtist === cover.originalArtist)
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

  console.log(`[Covery] 承認チャンネル: ${approvedIds.size}件, 表示曲: ${songs.length}曲`)
  return songs
}

export function getApprovedSingers() {
  const { approvedIds, devMode } = useAdminStore.getState()
  if (devMode) return metadata.singers
  if (!approvedIds || approvedIds.size === 0) return []
  return metadata.singers.filter(s => approvedIds.has(s.channelId))
}

// Legacy wrappers
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
