import React, { useMemo } from 'react'
import { ArrowLeft, Play, Music, Radio } from 'lucide-react'
import { usePlayerStore } from '../store/usePlayerStore'
import { useAdminStore } from '../store/useAdminStore'
import { getApprovedSongs } from '../utils/filterCovers'
import data from '../data/metadata.json'
import catalog from '../data/songCatalog.json'
import SongCard from '../components/Shared/SongCard'

const ArtistSongs = ({ artistName, onBack, onNavigateToCovers, onNavigateToSinger }) => {
  const { setQueue, startBGMMode } = usePlayerStore()
  const approvedIds = useAdminStore(s => s.approvedIds)
  const devMode = useAdminStore(s => s.devMode)
  const scanResults = useAdminStore(s => s.scanResults)

  const songs = useMemo(() =>
    getApprovedSongs().filter(s => s.originalArtist === artistName)
  , [artistName, approvedIds, devMode, scanResults])

  // Deduplicate by title (multiple covers of same song exist)
  const uniqueSongs = []
  const seenTitles = new Set()
  for (const song of songs) {
    if (!seenTitles.has(song.title)) {
      seenTitles.add(song.title)
      uniqueSongs.push(song)
    }
  }

  // Also get songs from catalog that aren't in metadata yet
  const catalogArtist = catalog.artists.find(a => a.name === artistName)
  const catalogOnlySongs = []
  if (catalogArtist) {
    for (const cs of catalogArtist.songs) {
      if (!seenTitles.has(cs.title)) {
        seenTitles.add(cs.title)
        catalogOnlySongs.push(cs)
      }
    }
  }

  // Avatar from Spotify
  const spotifyImage = catalogArtist?.imageUrl || ''

  const handlePlayAll = () => {
    const queue = uniqueSongs.map(s => {
      const c = s.covers?.[0]
      if (!c) return null
      const sig = (data?.singers || []).find(si => si.channelId === c.singerId)
      return {
        id: s.id,
        videoId: c.videoId,
        title: s.title,
        originalArtist: s.originalArtist,
        singerName: sig?.name || c.singerId || 'Unknown',
        thumbnailUrl: `https://img.youtube.com/vi/${c.videoId}/hqdefault.jpg`
      }
    }).filter(Boolean)
    if (queue.length > 0) setQueue(queue, 0)
  }

  return (
    <div style={{ color: 'white', animation: 'fadeIn 0.4s ease-out' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
        <button
          onClick={onBack}
          style={{
            background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%',
            width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'white', cursor: 'pointer', flexShrink: 0
          }}
        >
          <ArrowLeft size={24} />
        </button>
        <ArtistAvatar src={spotifyImage} name={artistName} size={56} />
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 800, margin: 0 }}>{artistName}</h1>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '2px 0 0' }}>
            {uniqueSongs.length + catalogOnlySongs.length}曲
          </p>
        </div>
      </div>

      {/* Actions */}
      {uniqueSongs.length > 0 && (
        <div style={{ display: 'flex', gap: 12, marginBottom: '28px', flexWrap: 'wrap' }}>
          <button
            onClick={handlePlayAll}
            style={{
              background: 'var(--primary)', color: 'white', border: 'none',
              borderRadius: 24, padding: '12px 24px', fontSize: 14, fontWeight: 'bold',
              display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer'
            }}
          >
            <Play size={18} fill="white" />
            全て再生
          </button>
          <button
            onClick={() => {
              const tracks = uniqueSongs.map(s => {
                // Pick a random cover for each song
                const covers = data.songs.filter(ds => ds.title === s.title)
                const pick = covers[Math.floor(Math.random() * covers.length)]
                const c = pick?.covers?.[0]
                if (!c) return null
                const sig = (data?.singers || []).find(si => si.channelId === c.singerId)
                return {
                  id: pick.id, videoId: c.videoId, title: pick.title,
                  originalArtist: pick.originalArtist,
                  singerName: sig?.name || c.singerId || 'Unknown',
                  thumbnailUrl: `https://img.youtube.com/vi/${c.videoId}/hqdefault.jpg`
                }
              }).filter(Boolean)
              if (tracks.length > 0) startBGMMode(artistName, tracks)
            }}
            style={{
              background: 'rgba(255,255,255,0.08)', color: 'white',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: 24, padding: '12px 24px', fontSize: 14, fontWeight: 'bold',
              display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer'
            }}
          >
            <Radio size={18} />
            BGMモード
          </button>
        </div>
      )}

      {/* Songs with covers (playable) */}
      {uniqueSongs.length > 0 && (
        <>
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, color: 'var(--text-secondary)' }}>
            カバー動画あり ({uniqueSongs.length})
          </h2>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
            gap: '20px',
            marginBottom: '32px'
          }}>
            {uniqueSongs.map(song => (
              <SongCard
                key={song.id}
                song={song}
                contextSongs={uniqueSongs}
                onNavigateToCovers={onNavigateToCovers}
                onNavigateToSinger={onNavigateToSinger}
              />
            ))}
          </div>
        </>
      )}

      {/* Songs from catalog only (no covers yet) */}
      {catalogOnlySongs.length > 0 && (
        <>
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, color: 'var(--text-secondary)' }}>
            その他の曲 ({catalogOnlySongs.length})
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {catalogOnlySongs.map((song, i) => (
              <div key={`cat-${i}`} style={{
                display: 'flex', alignItems: 'center', gap: 14,
                padding: '10px 12px', borderRadius: 10,
                background: 'var(--surface)', opacity: 0.6
              }}>
                <Music size={18} color="var(--text-secondary)" />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{song.title}</div>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>カバー未収集</div>
              </div>
            ))}
          </div>
        </>
      )}

      {uniqueSongs.length === 0 && catalogOnlySongs.length === 0 && (
        <p style={{ color: 'var(--text-secondary)', textAlign: 'center', marginTop: 60 }}>
          楽曲データがありません。
        </p>
      )}
    </div>
  )
}

const ArtistAvatar = ({ src, name, size = 56 }) => {
  const [error, setError] = React.useState(false)
  if (src && !error) {
    return (
      <img
        src={src} alt={name} onError={() => setError(true)}
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
      />
    )
  }
  const ch = (name || '?').charAt(0).toUpperCase()
  const hue = (name || '').split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: `hsl(${hue}, 50%, 35%)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.4, fontWeight: 700, color: 'white', flexShrink: 0
    }}>
      {ch}
    </div>
  )
}

export default ArtistSongs
