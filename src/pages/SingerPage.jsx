import React, { useMemo, useState, useEffect } from 'react'
import { ArrowLeft, Play, Shuffle } from 'lucide-react'
import { usePlayerStore } from '../store/usePlayerStore'
import { fetchChannelCovers, fetchSimilarSingers } from '../api/client'

const SingerPage = ({ singerId, onBack, onNavigateToCovers, onNavigateToSinger }) => {
  const { setQueue } = usePlayerStore()

  const [apiCovers, setApiCovers] = useState(null)
  const [apiSimilar, setApiSimilar] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!singerId) { setLoading(false); return }
    let cancelled = false
    fetchChannelCovers(singerId).then(res => {
      if (cancelled) return
      if (res?.covers) {
        console.log(`[Covery] API: ${res.covers.length} covers for channel ${singerId}`)
        setApiCovers(res)
      }
      setLoading(false)
    })
    fetchSimilarSingers(singerId).then(res => {
      if (cancelled) return
      if (res?.similar) {
        console.log(`[Covery] API: ${res.similar.length} similar singers`)
        setApiSimilar(res.similar)
      }
    })
    return () => { cancelled = true }
  }, [singerId])

  const singer = apiCovers?.channel
    ? { channelId: apiCovers.channel.channelId, name: apiCovers.channel.channelName, thumbnailUrl: apiCovers.channel.thumbnailUrl }
    : null
  const singerName = singer?.name || 'Unknown'

  const songs = useMemo(() => {
    if (!apiCovers?.covers?.length) return []
    return apiCovers.covers.map(c => ({
      id: `api_${c.videoId}`,
      title: c.songTitle,
      originalArtist: c.artistName,
      singerName,
      covers: [{
        videoId: c.videoId, singerId,
        publishedAt: c.publishedAt || '',
        thumbnailUrl: `https://img.youtube.com/vi/${c.videoId}/hqdefault.jpg`,
      }],
    }))
  }, [apiCovers, singerName, singerId])

  const similarSingers = useMemo(() =>
    apiSimilar.map(s => ({
      channelId: s.channelId, name: s.channelName, thumb: s.thumbnailUrl,
      jaccard: s.jaccard / 100, overlapCount: s.overlapCount,
    }))
  , [apiSimilar])

  const buildTrack = (song) => {
    const cover = song.covers[0]
    if (!cover) return null
    return {
      id: song.id, videoId: cover.videoId, title: song.title,
      originalArtist: song.originalArtist, singerName,
      thumbnailUrl: `https://img.youtube.com/vi/${cover.videoId}/hqdefault.jpg`
    }
  }

  const handlePlay = (song) => {
    const queue = songs.map(buildTrack).filter(Boolean)
    const idx = queue.findIndex(t => t.id === song.id)
    if (queue.length > 0) setQueue(queue, idx >= 0 ? idx : 0)
  }

  const handleShuffleAll = () => {
    const queue = songs.map(buildTrack).filter(Boolean).sort(() => Math.random() - 0.5)
    if (queue.length > 0) setQueue(queue, 0)
  }

  if (!loading && songs.length === 0) {
    return (
      <div style={{ color: 'white', padding: '40px 20px' }}>
        <button onClick={onBack} style={backBtnStyle}><ArrowLeft size={24} /></button>
        <p style={{ color: '#94a3b8', textAlign: 'center', fontSize: 16, marginTop: 60 }}>
          コンテンツを準備中です
        </p>
      </div>
    )
  }

  return (
    <div style={{ color: 'white', animation: 'fadeIn 0.4s ease-out' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <button onClick={onBack} style={backBtnStyle}>
          <ArrowLeft size={24} />
        </button>
        <SingerAvatar src={singer?.thumbnailUrl} name={singerName} size={80} />
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>{singerName}</h1>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '2px 0 0' }}>
            {songs.length}曲カバー
          </p>
        </div>
      </div>

      {songs.length > 0 && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 28 }}>
          <button onClick={handleShuffleAll} style={{ ...actionBtnStyle, background: 'var(--primary)' }}>
            <Shuffle size={18} /> シャッフル再生
          </button>
        </div>
      )}

      <div style={{ marginBottom: 40 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.05em', marginBottom: 12 }}>
          この歌い手のカバー曲 ({songs.length})
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {songs.map((song, index) => {
            const cover = song.covers[0]
            return (
              <div
                key={`${song.id}-${index}`}
                onClick={() => handlePlay(song)}
                style={rowStyle}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <div style={{ width: 28, textAlign: 'center', opacity: 0.5, fontSize: 13, fontWeight: 500 }}>
                  {index + 1}
                </div>
                <img
                  src={`https://img.youtube.com/vi/${cover.videoId}/mqdefault.jpg`}
                  alt={song.title}
                  style={{ width: 50, height: 50, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    onClick={(e) => { e.stopPropagation(); onNavigateToCovers?.(song.title) }}
                    style={{ fontWeight: 600, fontSize: 14, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'pointer', transition: 'color 0.2s' }}
                    onMouseEnter={e => { e.currentTarget.style.color = '#6366f1'; e.currentTarget.style.textDecoration = 'underline' }}
                    onMouseLeave={e => { e.currentTarget.style.color = 'white'; e.currentTarget.style.textDecoration = 'none' }}
                  >
                    {song.title}
                  </div>
                  <div style={{ fontSize: 12, color: '#6366f1' }}>
                    {song.originalArtist}
                  </div>
                </div>
                <Play size={14} color="var(--text-secondary)" style={{ flexShrink: 0 }} />
              </div>
            )
          })}
        </div>
      </div>

      {similarSingers.length > 0 && (
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.05em', marginBottom: 12 }}>
            似た歌い手
          </div>
          <div style={{
            display: 'flex', gap: 16, overflowX: 'auto', paddingBottom: 16,
            scrollbarWidth: 'none', margin: '0 -20px', padding: '0 20px 16px',
          }} className="no-scrollbar">
            {similarSingers.map(s => (
              <div
                key={s.channelId}
                onClick={() => onNavigateToSinger?.(s.channelId)}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, minWidth: 80, cursor: 'pointer' }}
              >
                <SingerAvatar src={s.thumb} name={s.name} size={56} />
                <span style={{ fontSize: 12, textAlign: 'center', fontWeight: 500, maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {s.name}
                </span>
                <span style={{
                  fontSize: 10, fontWeight: 700, color: 'white',
                  background: '#6366f1', borderRadius: 10, padding: '2px 8px',
                }}>
                  類似度{Math.round(s.jaccard * 100)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}

const backBtnStyle = {
  background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%',
  width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center',
  color: 'white', cursor: 'pointer', flexShrink: 0,
}

const actionBtnStyle = {
  color: 'white', border: 'none', borderRadius: 24,
  padding: '12px 20px', fontSize: 14, fontWeight: 'bold',
  display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
}

const rowStyle = {
  display: 'flex', alignItems: 'center', gap: 14,
  padding: '10px 12px', borderRadius: 12, cursor: 'pointer',
  transition: 'background 0.2s',
}

const SingerAvatar = ({ src, name, size = 80 }) => {
  const [error, setError] = React.useState(false)
  if (!src || error) {
    const hue = (name || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 360
    return (
      <div style={{
        width: size, height: size, borderRadius: '50%',
        background: `hsl(${hue}, 50%, 35%)`, color: 'white',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: size * 0.3, fontWeight: 'bold', flexShrink: 0,
      }}>
        {(name || '?').charAt(0)}
      </div>
    )
  }
  return (
    <img src={src} alt={name} onError={() => setError(true)}
      style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--surface)', flexShrink: 0 }}
    />
  )
}

export default SingerPage
