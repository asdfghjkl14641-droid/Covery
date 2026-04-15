import React, { useState, useEffect } from 'react'
import { ArrowLeft, Play, Radio } from 'lucide-react'
import { usePlayerStore } from '../store/usePlayerStore'
import { fetchArtistSongs, fetchSongCovers } from '../api/client'
import SongCard from '../components/Shared/SongCard'

const ArtistSongs = ({ artistName, artistId, onBack, onNavigateToCovers, onNavigateToSinger }) => {
  const { setQueue, startBGMMode } = usePlayerStore()
  const [apiSongs, setApiSongs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!artistId) { setLoading(false); return }
    let cancelled = false
    fetchArtistSongs(artistId).then(res => {
      if (cancelled) return
      const songs = (res?.songs || []).map(s => ({
        id: s.id, title: s.title, originalArtist: s.artistName || artistName,
        coverCount: s.coverCount || 0, covers: [],
      }))
      console.log(`[Covery] API: ${songs.length} songs for artist ${artistId}`)
      setApiSongs(songs)
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [artistId])

  const handlePlayAll = async () => {
    const tracks = []
    for (const s of apiSongs.slice(0, 20)) {
      try {
        const res = await fetchSongCovers(s.id)
        const c = res?.covers?.[0]
        if (c) tracks.push({
          id: `api_${c.videoId}`, videoId: c.videoId,
          title: s.title, originalArtist: s.originalArtist,
          singerName: c.channelName || 'Unknown',
          thumbnailUrl: c.thumbnailUrl || `https://img.youtube.com/vi/${c.videoId}/hqdefault.jpg`,
        })
      } catch (_) {}
    }
    if (tracks.length > 0) setQueue(tracks, 0)
  }

  const handleBGM = async () => {
    const tracks = []
    for (const s of apiSongs) {
      try {
        const res = await fetchSongCovers(s.id)
        const covers = res?.covers || []
        const pick = covers[Math.floor(Math.random() * covers.length)]
        if (pick) tracks.push({
          id: `api_${pick.videoId}`, videoId: pick.videoId,
          title: s.title, originalArtist: s.originalArtist,
          singerName: pick.channelName || 'Unknown',
          thumbnailUrl: pick.thumbnailUrl || `https://img.youtube.com/vi/${pick.videoId}/hqdefault.jpg`,
        })
      } catch (_) {}
    }
    if (tracks.length > 0) startBGMMode(artistName, tracks)
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
        <ArtistAvatar name={artistName} size={56} />
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 800, margin: 0 }}>{artistName}</h1>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '2px 0 0' }}>
            {apiSongs.length}曲
          </p>
        </div>
      </div>

      {!loading && apiSongs.length === 0 && (
        <p style={{ color: '#94a3b8', textAlign: 'center', marginTop: 60, fontSize: 16 }}>
          コンテンツを準備中です
        </p>
      )}

      {/* Actions */}
      {apiSongs.length > 0 && (
        <div style={{ display: 'flex', gap: 12, marginBottom: '28px', flexWrap: 'wrap' }}>
          <button onClick={handlePlayAll} style={{
            background: 'var(--primary)', color: 'white', border: 'none',
            borderRadius: 24, padding: '12px 24px', fontSize: 14, fontWeight: 'bold',
            display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer'
          }}>
            <Play size={18} fill="white" />
            全て再生
          </button>
          <button onClick={handleBGM} style={{
            background: 'rgba(255,255,255,0.08)', color: 'white',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: 24, padding: '12px 24px', fontSize: 14, fontWeight: 'bold',
            display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer'
          }}>
            <Radio size={18} />
            BGMモード
          </button>
        </div>
      )}

      {apiSongs.length > 0 && (
        <>
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, color: 'var(--text-secondary)' }}>
            カバー動画あり ({apiSongs.length})
          </h2>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
            gap: '20px', marginBottom: '32px'
          }}>
            {apiSongs.map(song => (
              <SongCard
                key={song.id}
                song={song}
                contextSongs={apiSongs}
                onNavigateToCovers={(title) => onNavigateToCovers?.(title, song.id)}
                onNavigateToSinger={onNavigateToSinger}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

const ArtistAvatar = ({ name, size = 56 }) => {
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
