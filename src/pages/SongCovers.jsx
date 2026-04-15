import React, { useState, useMemo, useEffect } from 'react'
import { ArrowLeft, Play, Shuffle, Clock, ArrowUpDown, Dice5 } from 'lucide-react'
import { usePlayerStore } from '../store/usePlayerStore'
import { fetchSongCovers } from '../api/client'

const SongCovers = ({ songTitle, songId, onBack, onNavigateToSinger }) => {
  const { setQueue, currentTrack, isPlaying } = usePlayerStore()
  const [sortMode, setSortMode] = useState('random')
  const [apiSong, setApiSong] = useState(null)
  const [apiCovers, setApiCovers] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!songId) { setLoading(false); return }
    let cancelled = false
    fetchSongCovers(songId).then(res => {
      if (cancelled) return
      if (res?.covers) {
        console.log(`[Covery] API: ${res.covers.length} covers loaded for song ${songId}`)
        setApiSong(res.song)
        setApiCovers(res.covers.map(c => ({
          videoId: c.videoId,
          singerId: c.channelId,
          channelName: c.channelName,
          thumbnailUrl: c.thumbnailUrl || `https://img.youtube.com/vi/${c.videoId}/hqdefault.jpg`,
          publishedAt: c.publishedAt || '',
        })))
      }
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [songId])

  const resolvedTitle = apiSong?.title || songTitle || 'Covers'
  const resolvedArtist = apiSong?.artistName || ''
  const heroVideoId = apiCovers[0]?.videoId

  // Initial random order (stable per mount)
  const [randomOrder, setRandomOrder] = useState([])
  useEffect(() => {
    setRandomOrder([...apiCovers].sort(() => Math.random() - 0.5))
  }, [apiCovers])

  const sortedCovers = useMemo(() => {
    if (sortMode === 'random') return randomOrder
    const arr = [...apiCovers]
    if (sortMode === 'recent') {
      arr.sort((a, b) => (b.publishedAt || '').localeCompare(a.publishedAt || ''))
    }
    return arr
  }, [apiCovers, sortMode, randomOrder])

  const buildTrack = (cover) => ({
    id: `api_${cover.videoId}`,
    videoId: cover.videoId,
    title: resolvedTitle,
    originalArtist: resolvedArtist,
    singerName: cover.channelName || 'Unknown',
    thumbnailUrl: cover.thumbnailUrl,
  })

  const handlePlayCover = (cover, index) => {
    const queue = sortedCovers.map(buildTrack)
    if (queue.length > 0) setQueue(queue, index)
  }

  const handlePlayAll = () => {
    const queue = sortedCovers.map(buildTrack)
    if (queue.length > 0) setQueue(queue, 0)
  }

  const handleShufflePlay = () => {
    const queue = sortedCovers.map(buildTrack).sort(() => Math.random() - 0.5)
    if (queue.length > 0) setQueue(queue, 0)
  }

  if (!loading && apiCovers.length === 0) {
    return (
      <div style={{ color: 'white', padding: '40px 20px' }}>
        <button onClick={onBack} style={{
          background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%',
          width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'white', cursor: 'pointer', marginBottom: 20
        }}>
          <ArrowLeft size={24} />
        </button>
        <p style={{ color: '#94a3b8', textAlign: 'center', fontSize: 16, marginTop: 60 }}>
          コンテンツを準備中です
        </p>
      </div>
    )
  }

  return (
    <div style={{ color: 'white', animation: 'fadeIn 0.4s ease-out' }}>
      {/* Hero header */}
      <div style={{ position: 'relative', margin: '-0px -24px 0', padding: '0 24px', overflow: 'hidden' }}>
        {heroVideoId && (
          <img src={`https://img.youtube.com/vi/${heroVideoId}/maxresdefault.jpg`} alt=""
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', filter: 'blur(20px) brightness(0.3)', transform: 'scale(1.2)' }}
            onError={e => { e.target.src = `https://img.youtube.com/vi/${heroVideoId}/hqdefault.jpg` }}
          />
        )}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent, var(--background))' }} />

        <div style={{ position: 'relative', zIndex: 1, padding: '20px 0 32px' }}>
          <button onClick={onBack} style={{
            background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%',
            width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'white', cursor: 'pointer', marginBottom: 20
          }}>
            <ArrowLeft size={24} />
          </button>

          <div style={{ display: 'flex', gap: 20, alignItems: 'flex-end' }}>
            {heroVideoId && (
              <img src={`https://img.youtube.com/vi/${heroVideoId}/hqdefault.jpg`} alt=""
                style={{ width: 140, height: 105, borderRadius: 12, objectFit: 'cover', boxShadow: '0 8px 30px rgba(0,0,0,0.5)', transform: 'scale(1.05)', flexShrink: 0 }}
              />
            )}
            <div>
              <h1 style={{ fontSize: 24, fontWeight: 800, margin: '0 0 4px' }}>{resolvedTitle}</h1>
              <div style={{ fontSize: 15, color: '#6366f1', fontWeight: 600, marginBottom: 4 }}>
                {resolvedArtist}
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                {apiCovers.length}人がカバー
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
        <button onClick={handleShufflePlay} disabled={apiCovers.length === 0} style={{
          background: 'var(--primary)', color: 'white', border: 'none', borderRadius: 24,
          padding: '12px 20px', fontSize: 14, fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 8,
          cursor: apiCovers.length > 0 ? 'pointer' : 'not-allowed', opacity: apiCovers.length > 0 ? 1 : 0.5
        }}>
          <Shuffle size={18} />
          シャッフル再生
        </button>
        <button onClick={handlePlayAll} disabled={apiCovers.length === 0} style={{
          background: 'rgba(255,255,255,0.08)', color: 'white', border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 24, padding: '12px 20px', fontSize: 14, fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 8,
          cursor: apiCovers.length > 0 ? 'pointer' : 'not-allowed', opacity: apiCovers.length > 0 ? 1 : 0.5
        }}>
          <Play size={18} fill="white" />
          順番に再生
        </button>
      </div>

      {/* Sort toggle + count */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.05em' }}>
          すべてのカバー ({apiCovers.length})
        </div>
        <button
          onClick={() => setSortMode(s => s === 'random' ? 'default' : s === 'default' ? 'recent' : 'random')}
          style={{
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 16, padding: '5px 12px', fontSize: 12, fontWeight: 600,
            color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer'
          }}
        >
          {sortMode === 'random' ? <Dice5 size={12} /> : sortMode === 'default' ? <ArrowUpDown size={12} /> : <Clock size={12} />}
          {sortMode === 'random' ? 'ランダム' : sortMode === 'default' ? '再生回数順' : '新着順'}
        </button>
      </div>

      {/* Cover list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {sortedCovers.map((cover, index) => {
          const isCurrentlyPlaying = currentTrack?.videoId === cover.videoId
          return (
            <div
              key={`sc-${cover.videoId}-${index}`}
              onClick={() => handlePlayCover(cover, index)}
              style={{
                display: 'flex', alignItems: 'center', padding: '10px 12px', borderRadius: 12,
                cursor: 'pointer', transition: 'background 0.2s', gap: 14,
                background: isCurrentlyPlaying ? 'rgba(99,102,241,0.12)' : 'transparent',
              }}
              onMouseEnter={e => { if (!isCurrentlyPlaying) e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
              onMouseLeave={e => { if (!isCurrentlyPlaying) e.currentTarget.style.background = 'transparent' }}
            >
              <div style={{ width: 28, textAlign: 'center', fontSize: 13, fontWeight: 500, color: isCurrentlyPlaying ? '#6366f1' : 'var(--text-secondary)' }}>
                {isCurrentlyPlaying && isPlaying ? <EqAnimation /> : index + 1}
              </div>
              <SingerIcon src={cover.thumbnailUrl} name={cover.channelName || '?'} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  onClick={(e) => { e.stopPropagation(); if (cover.singerId) onNavigateToSinger?.(cover.singerId) }}
                  style={{
                    fontWeight: 600, fontSize: 14, color: isCurrentlyPlaying ? '#6366f1' : 'white',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    cursor: 'pointer', transition: 'color 0.2s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.textDecoration = 'underline' }}
                  onMouseLeave={e => { e.currentTarget.style.textDecoration = 'none' }}
                >
                  {cover.channelName || 'Unknown'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  {cover.publishedAt || ''}
                </div>
              </div>
              <Play size={14} color={isCurrentlyPlaying ? '#6366f1' : 'var(--text-secondary)'} style={{ flexShrink: 0 }} />
            </div>
          )
        })}
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes eqBounce1 { 0%,100%{height:4px} 50%{height:14px} }
        @keyframes eqBounce2 { 0%,100%{height:8px} 50%{height:4px} }
        @keyframes eqBounce3 { 0%,100%{height:6px} 50%{height:16px} }
      `}</style>
    </div>
  )
}

const SingerIcon = ({ src, name }) => {
  const [err, setErr] = React.useState(false)
  if (!src || err) {
    return (
      <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, flexShrink: 0 }}>
        {(name || '?').charAt(0)}
      </div>
    )
  }
  return <img src={src} alt="" onError={() => setErr(true)} style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
}

const EqAnimation = () => (
  <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 2, height: 16 }}>
    <div style={{ width: 3, background: '#6366f1', borderRadius: 1, animation: 'eqBounce1 0.6s ease infinite' }} />
    <div style={{ width: 3, background: '#6366f1', borderRadius: 1, animation: 'eqBounce2 0.5s ease infinite 0.1s' }} />
    <div style={{ width: 3, background: '#6366f1', borderRadius: 1, animation: 'eqBounce3 0.7s ease infinite 0.2s' }} />
  </div>
)

export default SongCovers
