import React, { useState, useEffect } from 'react'
import { Play, Clock, Users } from 'lucide-react'
import {
  fetchSongs as apiFetchSongs,
  fetchSingers as apiFetchSingers,
  fetchSongCovers as apiFetchSongCovers,
} from '../api/client'

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

const Home = ({ onNavigateToCovers, onNavigateToSinger }) => {
  const [songs, setSongs] = useState([])         // [{id, title, artistName, coverCount}]
  const [songSamples, setSongSamples] = useState({}) // { songId: { videoId, channelName, publishedAt, thumbnailUrl } }
  const [singers, setSingers] = useState([])     // [{channelId, channelName, thumbnailUrl}]
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const [songsRes, singersRes] = await Promise.all([
        apiFetchSongs(40, true),
        apiFetchSingers(10),
      ])
      if (cancelled) return
      const songList = songsRes?.songs || []
      const singerList = singersRes?.singers || []
      setSongs(songList)
      setSingers(singerList)

      // Fetch sample cover for each song (for thumbnails)
      if (songList.length > 0) {
        const samples = {}
        const picks = songList.slice(0, 30)
        await Promise.all(picks.map(async s => {
          try {
            const r = await apiFetchSongCovers(s.id)
            const first = r?.covers?.[0]
            if (first) samples[s.id] = {
              videoId: first.videoId,
              channelName: first.channelName,
              channelId: first.channelId,
              publishedAt: first.publishedAt || '',
              // Always use YouTube video thumbnail for song cards (not channel icon)
              thumbnailUrl: `https://img.youtube.com/vi/${first.videoId}/hqdefault.jpg`,
              channelThumb: first.thumbnailUrl || '',
            }
          } catch (_) {}
        }))
        if (!cancelled) setSongSamples(samples)
      }
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [])

  // Empty state: API returned nothing
  if (!loading && songs.length === 0 && singers.length === 0) {
    return (
      <div className="home-page" style={{ padding: '80px 20px', textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>🎵</div>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
          コンテンツを準備中です
        </h2>
        <p style={{ fontSize: 16, lineHeight: 1.7, color: '#94a3b8' }}>
          まだ承認された歌い手がいません。<br />
          しばらくお待ちください。
        </p>
      </div>
    )
  }

  // Derived lists — only from API data
  const songsWithSamples = songs.filter(s => songSamples[s.id])
  const popularRandom = shuffle(songsWithSamples).slice(0, 10)
  const pickups = shuffle(songsWithSamples.filter(s => (s.coverCount || 0) >= 3)).slice(0, 3)
  const recentRandom = shuffle(songsWithSamples).slice(0, 10)
  const recommended = songsWithSamples.slice(0, 20)

  return (
    <div className="home-page" style={{ paddingBottom: '40px', paddingTop: '20px' }}>
      {/* Section 0: おすすめの曲 */}
      {loading && recommended.length === 0 && (
        <section style={{ marginBottom: '40px' }}>
          <h2 style={{ marginBottom: '16px' }}>おすすめの曲</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '14px' }}>
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} style={{ background: 'var(--surface)', borderRadius: 12, overflow: 'hidden', animation: 'pulse 1.5s ease infinite' }}>
                <div style={{ width: '100%', aspectRatio: '4/3', background: 'rgba(255,255,255,0.04)' }} />
                <div style={{ padding: '10px 10px 12px' }}>
                  <div style={{ height: 13, background: 'rgba(255,255,255,0.08)', borderRadius: 4, marginBottom: 6 }} />
                  <div style={{ height: 11, background: 'rgba(255,255,255,0.05)', borderRadius: 4, width: '60%' }} />
                </div>
              </div>
            ))}
          </div>
          <style>{`@keyframes pulse { 0%,100% { opacity: 1 } 50% { opacity: 0.5 } }`}</style>
        </section>
      )}
      {recommended.length > 0 && (
        <section style={{ marginBottom: '40px' }}>
          <h2 style={{ marginBottom: '16px' }}>おすすめの曲</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '14px' }}>
            {recommended.map((song, i) => {
              const sample = songSamples[song.id]
              if (!sample) return null
              return (
                <div key={i} onClick={() => onNavigateToCovers(song.title, song.id)} style={{
                  background: 'var(--surface)', borderRadius: 12, overflow: 'hidden', cursor: 'pointer',
                  transition: 'transform 0.2s, background 0.2s',
                }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.background = 'var(--surface-hover)' }}
                  onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.background = 'var(--surface)' }}
                >
                  <div style={{ width: '100%', aspectRatio: '4/3', overflow: 'hidden', position: 'relative' }}>
                    <img src={sample.thumbnailUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scale(1.3)' }} />
                    {(song.coverCount || 0) >= 2 && (
                      <div style={{ position: 'absolute', top: 6, right: 6, background: '#6366f1', borderRadius: '50%', width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: 'white' }}>
                        {song.coverCount}
                      </div>
                    )}
                  </div>
                  <div style={{ padding: '10px 10px 12px' }}>
                    <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{song.title}</div>
                    <div style={{ fontSize: 11, color: '#6366f1', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 2 }}>{song.artistName}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sample.channelName || ''}</div>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* Section 1: Popular Cover Songs */}
      {popularRandom.length > 0 && (
        <section style={{ marginBottom: '40px' }}>
          <h2 style={{ marginBottom: '16px' }}>人気のカバー曲</h2>
          <div style={scrollRow} className="no-scrollbar">
            {popularRandom.map((song, i) => (
              <CoverSongCard key={i} song={song} sample={songSamples[song.id]} onClick={() => onNavigateToCovers(song.title, song.id)} />
            ))}
          </div>
        </section>
      )}

      {/* Section 2: Pickup feature cards */}
      {pickups.length > 0 && (
        <section style={{ marginBottom: '40px' }}>
          <h2 style={{ marginBottom: '16px' }}>聴き比べピックアップ</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {pickups.map((song, i) => (
              <PickupCard key={i} song={song} sample={songSamples[song.id]} onClick={() => onNavigateToCovers(song.title, song.id)} />
            ))}
          </div>
        </section>
      )}

      {/* Section 3: Recent covers */}
      {recentRandom.length > 0 && (
        <section style={{ marginBottom: '40px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <Clock size={18} color="var(--text-secondary)" />
            <h2>新着カバー</h2>
          </div>
          <div style={scrollRow} className="no-scrollbar">
            {recentRandom.map((song, i) => (
              <RecentCoverCard key={i} song={song} sample={songSamples[song.id]} onClick={() => onNavigateToCovers(song.title, song.id)} />
            ))}
          </div>
        </section>
      )}

      {/* Section 4: Popular singers */}
      {singers.length > 0 && (
        <section>
          <h2 style={{ marginBottom: '16px' }}>人気の歌い手</h2>
          <div style={scrollRow} className="no-scrollbar">
            {singers.map(s => (
              <div
                key={s.channelId}
                onClick={() => onNavigateToSinger && onNavigateToSinger(s.channelId)}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', minWidth: '100px', cursor: 'pointer' }}
              >
                <Avatar src={s.thumbnailUrl} name={s.channelName} />
                <span style={{ fontSize: '13px', textAlign: 'center', fontWeight: '500', maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.channelName}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

const scrollRow = {
  display: 'flex', gap: '16px', overflowX: 'auto', paddingBottom: '16px',
  scrollbarWidth: 'none', msOverflowStyle: 'none',
  margin: '0 -20px', padding: '0 20px 16px'
}

const CoverSongCard = ({ song, sample, onClick }) => (
  <div onClick={onClick} style={{
    minWidth: 180, width: 180, cursor: 'pointer', flexShrink: 0,
    background: 'var(--surface)', borderRadius: 12, overflow: 'hidden',
    transition: 'transform 0.2s, background 0.2s',
  }}
    onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.background = 'var(--surface-hover)' }}
    onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.background = 'var(--surface)' }}
  >
    <div style={{ width: '100%', height: 120, overflow: 'hidden', position: 'relative' }}>
      {sample?.videoId ? (
        <img src={sample.thumbnailUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scale(1.3)' }} />
      ) : (
        <div style={{ width: '100%', height: '100%', background: 'var(--surface-hover)' }} />
      )}
      <div style={{
        position: 'absolute', bottom: 8, right: 8,
        background: '#6366f1', borderRadius: 20, padding: '3px 10px',
        fontSize: 11, fontWeight: 700, color: 'white', display: 'flex', alignItems: 'center', gap: 4,
      }}>
        <Users size={11} />
        {song.coverCount || 0}人
      </div>
    </div>
    <div style={{ padding: '10px 12px' }}>
      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{song.title}</div>
      <div style={{ fontSize: 12, color: '#6366f1', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{song.artistName}</div>
    </div>
  </div>
)

const PickupCard = ({ song, sample, onClick }) => (
  <div onClick={onClick} style={{
    width: '100%', height: 180, borderRadius: 16, overflow: 'hidden',
    position: 'relative', cursor: 'pointer',
  }}>
    {sample?.videoId && (
      <img src={`https://img.youtube.com/vi/${sample.videoId}/maxresdefault.jpg`} alt=""
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', filter: 'blur(8px) brightness(0.4)', transform: 'scale(1.1)' }}
        onError={e => { e.target.src = sample.thumbnailUrl }}
      />
    )}
    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, rgba(99,102,241,0.3), rgba(10,14,39,0.8))' }} />
    <div style={{ position: 'relative', zIndex: 1, padding: '24px', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
      <div>
        <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>{song.title}</div>
        <div style={{ fontSize: 14, color: '#a5b4fc', fontWeight: 600 }}>{song.artistName}</div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.8)' }}>
          {song.coverCount || 0}人の歌い手が挑戦
        </span>
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

const RecentCoverCard = ({ song, sample, onClick }) => (
  <div onClick={onClick} style={{
    minWidth: 170, width: 170, cursor: 'pointer', flexShrink: 0,
    background: 'var(--surface)', borderRadius: 12, overflow: 'hidden',
    transition: 'transform 0.2s',
  }}
    onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-3px)'}
    onMouseLeave={e => e.currentTarget.style.transform = ''}
  >
    <div style={{ width: '100%', height: 110, overflow: 'hidden' }}>
      {sample?.videoId && (
        <img src={sample.thumbnailUrl} alt=""
          style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scale(1.3)' }} />
      )}
    </div>
    <div style={{ padding: '10px 12px' }}>
      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{song.title}</div>
      <div style={{ fontSize: 11, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 2 }}>
        {sample?.channelName || ''}
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-secondary)', opacity: 0.6 }}>
        {sample?.publishedAt || ''}
      </div>
    </div>
  </div>
)

const Avatar = ({ src, name }) => {
  const [error, setError] = React.useState(false)
  if (!src || error) {
    return (
      <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'var(--primary)', color: 'black', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 'bold' }}>
        {(name || '?').charAt(0)}
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
