import React, { useMemo, useState, useEffect } from 'react'
import { ArrowLeft, Play, Shuffle, Users, Ban } from 'lucide-react'
import { usePlayerStore } from '../store/usePlayerStore'
import { useAdminStore } from '../store/useAdminStore'
import { fetchChannelCovers, fetchSimilarSingers } from '../api/client'
import data from '../data/metadata.json'

const SingerPage = ({ singerId, onBack, onNavigateToCovers, onNavigateToSinger }) => {
  const { setQueue } = usePlayerStore()
  const approvedIds = useAdminStore(s => s.approvedIds)
  const devMode = useAdminStore(s => s.devMode)
  const isHidden = !devMode && approvedIds.size > 0 && !approvedIds.has(singerId)

  const [apiCovers, setApiCovers] = useState(null)
  const [apiSimilar, setApiSimilar] = useState(null)

  useEffect(() => {
    if (!singerId || isHidden) return
    fetchChannelCovers(singerId).then(res => {
      if (res?.covers?.length) {
        console.log(`[Covery] API: ${res.covers.length} covers for channel ${singerId}`)
        setApiCovers(res)
      }
    })
    fetchSimilarSingers(singerId).then(res => {
      if (res?.similar) {
        console.log(`[Covery] API: ${res.similar.length} similar singers`)
        setApiSimilar(res.similar)
      }
    })
  }, [singerId, isHidden])

  const singer = apiCovers?.channel
    ? { channelId: apiCovers.channel.channelId, name: apiCovers.channel.channelName, thumbnailUrl: apiCovers.channel.thumbnailUrl }
    : (data?.singers || []).find(s => s.channelId === singerId)
  const singerName = singer?.name || 'Unknown'

  if (isHidden) {
    return (
      <div style={{ color: 'white', animation: 'fadeIn 0.4s ease-out', textAlign: 'center', paddingTop: 80 }}>
        <button onClick={onBack} style={{ position: 'absolute', top: 24, left: 24, background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%', width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', cursor: 'pointer' }}>
          <ArrowLeft size={24} />
        </button>
        <Ban size={48} color="var(--text-secondary)" style={{ marginBottom: 16 }} />
        <p style={{ color: 'var(--text-secondary)', fontSize: 15 }}>このチャンネルは現在非表示です</p>
      </div>
    )
  }

  // All songs this singer covers — prefer API
  const songs = useMemo(() => {
    if (apiCovers?.covers?.length) {
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
    }
    return (data?.songs || []).filter(s => s.covers.some(c => c.singerId === singerId))
  }, [singerId, apiCovers, singerName])

  // "似た歌い手" — prefer API (Jaccard done server-side), fallback to local calc
  const similarSingers = useMemo(() => {
    if (apiSimilar) {
      return apiSimilar.map(s => ({
        channelId: s.channelId, name: s.channelName, thumb: s.thumbnailUrl,
        jaccard: s.jaccard / 100, overlapCount: s.overlapCount,
      }))
    }
    // Local Jaccard fallback
    const myTitles = new Set(songs.map(s => s.title))
    const myCount = myTitles.size
    const otherTitles = new Map()
    const otherInfo = new Map()

    for (const song of data.songs) {
      for (const c of song.covers) {
        if (c.singerId === singerId) continue
        if (!devMode && approvedIds.size > 0 && !approvedIds.has(c.singerId)) continue
        if (!otherTitles.has(c.singerId)) {
          otherTitles.set(c.singerId, new Set())
          const s = data.singers.find(si => si.channelId === c.singerId)
          otherInfo.set(c.singerId, { name: s?.name || 'Unknown', thumb: s?.thumbnailUrl || '' })
        }
        otherTitles.get(c.singerId).add(song.title)
      }
    }

    const results = []
    for (const [cid, titles] of otherTitles) {
      let overlapCount = 0
      for (const t of titles) { if (myTitles.has(t)) overlapCount++ }
      if (overlapCount === 0) continue
      const union = myCount + titles.size - overlapCount
      const jaccard = union > 0 ? overlapCount / union : 0
      if (jaccard < 0.1) continue
      const info = otherInfo.get(cid)
      results.push({ channelId: cid, name: info.name, thumb: info.thumb, jaccard, overlapCount })
    }

    return results.sort((a, b) => b.jaccard - a.jaccard).slice(0, 10)
  }, [apiSimilar, singerId, songs, devMode, approvedIds])

  const buildTrack = (song) => {
    const cover = song.covers.find(c => c.singerId === singerId) || song.covers[0]
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

      {/* Actions */}
      {songs.length > 0 && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 28 }}>
          <button onClick={handleShuffleAll} style={{ ...actionBtnStyle, background: 'var(--primary)' }}>
            <Shuffle size={18} /> シャッフル再生
          </button>
        </div>
      )}

      {/* Song list */}
      <div style={{ marginBottom: 40 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.05em', marginBottom: 12 }}>
          この歌い手のカバー曲 ({songs.length})
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {songs.map((song, index) => {
            const cover = song.covers.find(c => c.singerId === singerId) || song.covers[0]
            if (!cover) return null
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

      {/* Similar singers */}
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

      {songs.length === 0 && (
        <p style={{ color: 'var(--text-secondary)', textAlign: 'center', marginTop: 60 }}>
          カバー動画が見つかりませんでした。
        </p>
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
