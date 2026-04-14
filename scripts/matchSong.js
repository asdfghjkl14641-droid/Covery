// Shared song title matching logic

// Full-width → half-width, lowercase
function normalize(text) {
  return (text || '')
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0))
    .toLowerCase()
    .trim()
}

const SEPARATORS = /[\/／\-ー\s【】（）\[\]\(\)「」『』｜|×x・,、。~～!！?？♪♫\n\r]+/

// Artist aliases for short-title verification
const ARTIST_ALIASES = {
  'BUMP OF CHICKEN': ['bump', 'バンプ', 'boc'],
  'ONE OK ROCK': ['ワンオク', 'oor', 'ワンオクロック'],
  'Official髭男dism': ['ヒゲダン', '髭男', 'hige'],
  'Mrs. GREEN APPLE': ['ミセス', 'ミセスグリーンアップル', 'mrs'],
  'back number': ['バックナンバー', 'バクナン'],
  'RADWIMPS': ['ラッド', 'ラッドウィンプス', 'rad'],
  'King Gnu': ['キングヌー', 'kinggnu'],
  '米津玄師': ['kenshi yonezu', '米津', 'yonezu'],
  'あいみょん': ['aimyon'],
  'YOASOBI': ['ヨアソビ'],
  'Ado': ['アド'],
  'スピッツ': ['spitz'],
  'Mr.Children': ['ミスチル', 'mrchildren'],
  'サザンオールスターズ': ['サザン', 'southern'],
  'ヨルシカ': ['yorushika'],
  '藤井風': ['fujii kaze', 'fujii'],
  'LiSA': ['りさ'],
  'Aimer': ['エメ'],
  'Vaundy': ['バウンディ'],
}

function getAliases(artistName) {
  const key = Object.keys(ARTIST_ALIASES).find(k => normalize(k) === normalize(artistName))
  const aliases = key ? ARTIST_ALIASES[key] : []
  return [artistName, ...aliases].map(normalize)
}

/**
 * Match a YouTube video title against a catalog song title + artist.
 * Returns true if the video is likely a cover of this song.
 */
export function matchSongTitle(videoTitle, songTitle, artistName) {
  const nVideo = normalize(videoTitle)
  const nSong = normalize(songTitle)

  if (!nSong || nSong.length === 0) return false

  // Split video title into parts by separators
  const parts = nVideo.split(SEPARATORS).map(p => p.trim()).filter(p => p.length > 0)

  // Check: does any part exactly equal the song title?
  const exactPartMatch = parts.some(p => p === nSong)

  if (!exactPartMatch) return false

  // For short song titles (≤3 chars normalized), require artist name presence
  if (nSong.length <= 3) {
    const artistAliases = getAliases(artistName)
    const hasArtist = artistAliases.some(alias => nVideo.includes(alias))
    if (!hasArtist) return false
  }

  // For medium titles (4 chars), prefer artist presence but don't require
  // For long titles (5+), exact part match is sufficient

  return true
}

/**
 * Find the best matching song from catalog for a video title.
 * Returns { title, artist } or null.
 */
export function findBestMatch(videoTitle, catalogEntries) {
  // catalogEntries: [{title, artist}]
  // Try longest titles first to avoid short-title false positives
  const sorted = [...catalogEntries].sort((a, b) => b.title.length - a.title.length)

  for (const entry of sorted) {
    if (matchSongTitle(videoTitle, entry.title, entry.artist)) {
      return entry
    }
  }
  return null
}
