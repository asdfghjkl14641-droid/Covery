/**
 * Filter songs to only approved channels.
 * devMode=true → show all (bypass filter).
 * devMode=false + approvedIds has entries → show only approved.
 * devMode=false + approvedIds empty → show nothing.
 */
export function filterSongs(songs, approvedIds, devMode) {
  if (devMode) return songs
  if (!approvedIds || approvedIds.size === 0) return []
  return songs.filter(s => {
    const singerId = s.covers?.[0]?.singerId
    return singerId && approvedIds.has(singerId)
  })
}

export function filterSingers(singers, approvedIds, devMode) {
  if (devMode) return singers
  if (!approvedIds || approvedIds.size === 0) return []
  return singers.filter(s => approvedIds.has(s.channelId))
}
