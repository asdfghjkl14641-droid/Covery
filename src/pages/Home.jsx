import React, { useState, useMemo } from 'react'
import { Play, Clock, Users } from 'lucide-react'
import { usePlayerStore } from '../store/usePlayerStore'
import { useAdminStore } from '../store/useAdminStore'
import { filterSongs, filterSingers } from '../utils/filterCovers'
import data from '../data/metadata.json'

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

const Home = ({ onNavigateToCovers, onNavigateToSinger }) => {
  const approvedIds = useAdminStore(s => s.approvedIds)
  const devMode = useAdminStore(s => s.devMode)
  const songs = useMemo(() => filterSongs(data.songs, approvedIds, devMode), [approvedIds, devMode])
  const singers = useMemo(() => filterSingers(data.singers, approvedIds, devMode), [approvedIds, devMode])

  // Build cover song groups from filtered data
  const allCoverSongs = useMemo(() => {
    const map = new Map()
    for (const song of songs) {
      const key = `${song.title}|||${song.originalArtist}`
      if (!map.has(key)) map.set(key, { title: song.title, originalArtist: song.originalArtist, covers: [], firstVideoId: song.covers?.[0]?.videoId })
      const entry = map.get(key)
      for (const c of (song.covers || [])) entry.covers.push({ ...c, songId: song.id, singerName: song.singerName })
    }
    return [...map.values()].filter(e => e.covers.length >= 2)
  }, [songs])

  const [popularRandom] = useState(() => shuffle(allCoverSongs).slice(0, 10))
  const [pickups] = useState(() => shuffle(allCoverSongs.filter(e => e.covers.length >= 3)).slice(0, 3))
  const [recentRandom] = useState(() => {
    const all = []
    for (const song of songs) {
      for (const c of (song.covers || [])) all.push({ ...song, cover: c })
    }
    all.sort((a, b) => (b.cover.publishedAt || '').localeCompare(a.cover.publishedAt || ''))
    return shuffle(all.slice(0, 30)).slice(0, 10)
  })
  const [singersRandom] = useState(() => shuffle(singers).slice(0, 10))

  const { setQueue } = usePlayerStore()

  const playRecentCover = (item) => {
    const singer = data.singers.find(s => s.channelId === item.cover.singerId)
    setQueue([{
      id: item.id,
      videoId: item.cover.videoId,
      title: item.title,
      originalArtist: item.originalArtist,
      singerName: singer?.name || item.singerName || 'Unknown',
      thumbnailUrl: `https://img.youtube.com/vi/${item.cover.videoId}/hqdefault.jpg`
    }], 0)
  }

  return (
    <div className="home-page" style={{ paddingBottom: '40px', paddingTop: '20px' }}>

      {/* Section 1: Popular Cover Songs */}
      <section style={{ marginBottom: '40px' }}>
        <h2 style={{ marginBottom: '16px' }}>人気のカバー曲</h2>
        <div style={scrollRow} className="no-scrollbar">
          {popularRandom.map((entry, i) => (
            <CoverSongCard key={i} entry={entry} onClick={() => onNavigateToCovers(entry.title)} />
          ))}
        </div>
      </section>

      {/* Section 2: Pickup feature cards */}
      {pickups.length > 0 && (
        <section style={{ marginBottom: '40px' }}>
          <h2 style={{ marginBottom: '16px' }}>聴き比べピックアップ</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {pickups.map((entry, i) => (
              <PickupCard key={i} entry={entry} onClick={() => onNavigateToCovers(entry.title)} />
            ))}
          </div>
        </section>
      )}

      {/* Section 3: Recent covers */}
      <section style={{ marginBottom: '40px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <Clock size={18} color="var(--text-secondary)" />
          <h2>新着カバー</h2>
        </div>
        <div style={scrollRow} className="no-scrollbar">
          {recentRandom.map((item, i) => (
            <RecentCoverCard key={i} item={item} onClick={() => playRecentCover(item)} />
          ))}
        </div>
      </section>

      {/* Section 4: Popular singers (preserved) */}
      <section>
        <h2 style={{ marginBottom: '16px' }}>人気の歌い手</h2>
        <div style={scrollRow} className="no-scrollbar">
          {singersRandom.map(singer => (
            <div
              key={singer.channelId}
              onClick={() => onNavigateToSinger && onNavigateToSinger(singer.channelId)}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', minWidth: '100px', cursor: 'pointer' }}
            >
              <Avatar src={singer.thumbnailUrl} name={singer.name} />
              <span style={{ fontSize: '13px', textAlign: 'center', fontWeight: '500', maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{singer.name}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

const scrollRow = {
  display: 'flex', gap: '16px', overflowX: 'auto', paddingBottom: '16px',
  scrollbarWidth: 'none', msOverflowStyle: 'none',
  margin: '0 -20px', padding: '0 20px 16px'
}

// ── Cover Song Card (Section 1) ──
const CoverSongCard = ({ entry, onClick }) => {
  const videoId = entry.firstVideoId
  return (
    <div onClick={onClick} style={{
      minWidth: 180, width: 180, cursor: 'pointer', flexShrink: 0,
      background: 'var(--surface)', borderRadius: 12, overflow: 'hidden',
      transition: 'transform 0.2s, background 0.2s',
    }}
    onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.background = 'var(--surface-hover)' }}
    onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.background = 'var(--surface)' }}
    >
      <div style={{ width: '100%', height: 120, overflow: 'hidden', position: 'relative' }}>
        {videoId ? (
          <img src={`https://img.youtube.com/vi/${videoId}/hqdefault.jpg`} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scale(1.3)' }} />
        ) : (
          <div style={{ width: '100%', height: '100%', background: 'var(--surface-hover)' }} />
        )}
        <div style={{
          position: 'absolute', bottom: 8, right: 8,
          background: '#6366f1', borderRadius: 20, padding: '3px 10px',
          fontSize: 11, fontWeight: 700, color: 'white', display: 'flex', alignItems: 'center', gap: 4,
        }}>
          <Users size={11} />
          {entry.covers.length}人
        </div>
      </div>
      <div style={{ padding: '10px 12px' }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {entry.title}
        </div>
        <div style={{ fontSize: 12, color: '#6366f1', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {entry.originalArtist}
        </div>
      </div>
    </div>
  )
}

// ── Pickup Card (Section 2) ──
const PickupCard = ({ entry, onClick }) => {
  const videoId = entry.firstVideoId
  // Get up to 3 singer icons
  const singerIcons = entry.covers.slice(0, 3).map(c => {
    const singer = data.singers.find(s => s.channelId === c.singerId)
    return { name: singer?.name || '?', thumb: singer?.thumbnailUrl }
  })

  return (
    <div onClick={onClick} style={{
      width: '100%', height: 180, borderRadius: 16, overflow: 'hidden',
      position: 'relative', cursor: 'pointer',
    }}>
      {/* Background */}
      {videoId && (
        <img src={`https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`} alt=""
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', filter: 'blur(8px) brightness(0.4)', transform: 'scale(1.1)' }}
          onError={e => { e.target.src = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` }}
        />
      )}
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, rgba(99,102,241,0.3), rgba(10,14,39,0.8))' }} />

      {/* Content */}
      <div style={{ position: 'relative', zIndex: 1, padding: '24px', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>{entry.title}</div>
          <div style={{ fontSize: 14, color: '#a5b4fc', fontWeight: 600 }}>{entry.originalArtist}</div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ display: 'flex' }}>
              {singerIcons.map((s, i) => (
                <SingerMiniAvatar key={i} src={s.thumb} name={s.name} offset={i} />
              ))}
            </div>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.8)' }}>
              {entry.covers.length}人の歌い手が挑戦
            </span>
          </div>
          <div style={{
            background: 'rgba(255,255,255,0.15)', borderRadius: '50%',
            width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center',
            backdropFilter: 'blur(10px)'
          }}>
            <Play size={20} fill="white" />
          </div>
        </div>
      </div>
    </div>
  )
}

const SingerMiniAvatar = ({ src, name, offset }) => {
  const [err, setErr] = React.useState(false)
  const style = {
    width: 28, height: 28, borderRadius: '50%', border: '2px solid rgba(10,14,39,0.8)',
    marginLeft: offset > 0 ? -8 : 0, objectFit: 'cover', zIndex: 3 - offset,
    position: 'relative',
  }
  if (!src || err) {
    return <div style={{ ...style, background: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>{name.charAt(0)}</div>
  }
  return <img src={src} alt="" onError={() => setErr(true)} style={style} />
}

// ── Recent Cover Card (Section 3) ──
const RecentCoverCard = ({ item, onClick }) => {
  const singer = data.singers.find(s => s.channelId === item.cover.singerId)
  const videoId = item.cover.videoId
  return (
    <div onClick={onClick} style={{
      minWidth: 170, width: 170, cursor: 'pointer', flexShrink: 0,
      background: 'var(--surface)', borderRadius: 12, overflow: 'hidden',
      transition: 'transform 0.2s',
    }}
    onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-3px)'}
    onMouseLeave={e => e.currentTarget.style.transform = ''}
    >
      <div style={{ width: '100%', height: 110, overflow: 'hidden' }}>
        <img src={`https://img.youtube.com/vi/${videoId}/hqdefault.jpg`} alt=""
          style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scale(1.3)' }} />
      </div>
      <div style={{ padding: '10px 12px' }}>
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {item.title}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 2 }}>
          {singer?.name || item.singerName || 'Unknown'}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-secondary)', opacity: 0.6 }}>
          {item.cover.publishedAt || ''}
        </div>
      </div>
    </div>
  )
}

// ── Singer Avatar (preserved) ──
const Avatar = ({ src, name }) => {
  const [error, setError] = React.useState(false)
  if (!src || error) {
    return (
      <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'var(--primary)', color: 'black', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 'bold' }}>
        {name.charAt(0)}
      </div>
    )
  }
  return (
    <img src={src} alt={name} onError={() => setError(true)}
      style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--surface)', transition: 'transform 0.2s' }}
      onMouseEnter={e => e.target.style.transform = 'scale(1.05)'}
      onMouseLeave={e => e.target.style.transform = 'scale(1)'}
    />
  )
}

export default Home
