import React, { useState, useRef, useMemo, useEffect } from 'react'
import { Search as SearchIcon, X, ChevronRight } from 'lucide-react'
import data from '../data/metadata.json'
import catalog from '../data/songCatalog.json'
import SongCard from '../components/Shared/SongCard'
import { useAdminStore } from '../store/useAdminStore'
import { getApprovedSongs } from '../utils/filterCovers'

// 50-on grouping — matched against reading (hiragana)
const KANA_GROUPS = [
  { label: 'あ', chars: 'あいうえお' },
  { label: 'か', chars: 'かきくけこがぎぐげご' },
  { label: 'さ', chars: 'さしすせそざじずぜぞ' },
  { label: 'た', chars: 'たちつてとだぢづでど' },
  { label: 'な', chars: 'なにぬねの' },
  { label: 'は', chars: 'はひふへほばびぶべぼぱぴぷぺぽ' },
  { label: 'ま', chars: 'まみむめも' },
  { label: 'や', chars: 'やゆよ' },
  { label: 'ら', chars: 'らりるれろ' },
  { label: 'わ', chars: 'わをんゔ' },
]

const ALPHA_TABS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')
const KANA_TABS = KANA_GROUPS.map(g => g.label)
const ALL_TABS = ['#', ...ALPHA_TABS, ...KANA_TABS]

function getSectionKey(reading) {
  const first = (reading || '').charAt(0)
  // Numbers → #
  if (/[0-9]/.test(first)) return '#'
  // Latin → uppercase letter
  if (/[A-Za-z]/.test(first)) return first.toUpperCase()
  // Hiragana → find kana group
  for (const g of KANA_GROUPS) {
    if (g.chars.includes(first)) return g.label
  }
  // Fallback
  return 'わ'
}

function getSectionLabel(key) {
  if (key === '#') return '#'
  if (KANA_TABS.includes(key)) return `${key}行`
  return key
}

const Search = ({ onNavigateToCovers, onNavigateToArtist, onNavigateToSinger }) => {
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(null)
  const [apiArtists, setApiArtists] = useState(null)
  const sectionRefs = useRef({})

  // Fetch artists from API (with JSON fallback)
  useEffect(() => {
    import('../api/client').then(async ({ fetchArtists }) => {
      const res = await fetchArtists()
      if (res?.artists?.length) {
        console.log(`[Covery] API: ${res.artists.length} artists loaded`)
        // Cross-reference catalog for imageUrl
        const merged = res.artists.map(a => {
          const catEntry = catalog.artists.find(c => c.name === a.name)
          return { name: a.name, id: a.id, reading: a.reading || a.name, imageUrl: catEntry?.imageUrl || '', songCount: a.songCount }
        })
        setApiArtists(merged)
      }
    })
  }, [])

  // Artist list: prefer API, fallback to JSON catalog
  const artists = useMemo(() => {
    if (apiArtists) return apiArtists
    return catalog.artists.map(a => ({
      name: a.name,
      id: null,
      reading: a.reading || a.name,
      imageUrl: a.imageUrl || '',
      songCount: a.songs.length,
    }))
  }, [apiArtists])

  // Filter by query
  const filteredArtists = useMemo(() => {
    if (!query) return artists
    const q = query.toLowerCase()
    return artists.filter(a =>
      a.name.toLowerCase().includes(q) || a.reading.toLowerCase().includes(q)
    )
  }, [artists, query])

  // Sort by reading: # first, then A-Z, then あ-わ (50-on)
  const sortedArtists = useMemo(() => {
    const nums = filteredArtists.filter(a => /^[0-9]/.test(a.reading))
    const latin = filteredArtists.filter(a => /^[A-Za-z]/.test(a.reading))
    const kana = filteredArtists.filter(a => /^[\u3040-\u309F]/.test(a.reading))
    // Anything else goes at end
    const other = filteredArtists.filter(a =>
      !/^[0-9A-Za-z\u3040-\u309F]/.test(a.reading)
    )
    nums.sort((a, b) => a.reading.localeCompare(b.reading, 'en'))
    latin.sort((a, b) => a.reading.localeCompare(b.reading, 'en', { sensitivity: 'base' }))
    kana.sort((a, b) => a.reading.localeCompare(b.reading, 'ja'))
    return [...nums, ...latin, ...kana, ...other]
  }, [filteredArtists])

  // Group into sections
  const sections = useMemo(() => {
    const map = new Map()
    for (const artist of sortedArtists) {
      const key = getSectionKey(artist.reading)
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(artist)
    }
    return map
  }, [sortedArtists])

  const activeSections = useMemo(() => new Set(sections.keys()), [sections])

  const handleIndexClick = (tab) => {
    if (!activeSections.has(tab)) return
    setActiveIndex(tab)
    const el = sectionRefs.current[tab]
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  // Song search results (filtered by admin approvals)
  const approvedIds = useAdminStore(s => s.approvedIds)
  const devMode = useAdminStore(s => s.devMode)
  const scanResults = useAdminStore(s => s.scanResults)
  const allApproved = useMemo(() => getApprovedSongs(), [approvedIds, devMode, scanResults])
  const filteredSongs = allApproved.filter(song =>
    song.title.toLowerCase().includes(query.toLowerCase()) ||
    song.originalArtist.toLowerCase().includes(query.toLowerCase()) ||
    song.singerName?.toLowerCase().includes(query.toLowerCase())
  )

  const ArtistAvatar = ({ name, imageUrl }) => {
    const [error, setError] = useState(false)
    if (imageUrl && !error) {
      return (
        <img
          src={imageUrl} alt={name} onError={() => setError(true)}
          style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
        />
      )
    }
    const ch = name.charAt(0).toUpperCase()
    const hue = name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360
    return (
      <div style={{
        width: 40, height: 40, borderRadius: '50%',
        background: `hsl(${hue}, 50%, 35%)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 16, fontWeight: 700, color: 'white', flexShrink: 0
      }}>
        {ch}
      </div>
    )
  }

  return (
    <div className="search-page">
      {/* Search bar */}
      <div style={{ position: 'sticky', top: 0, background: 'var(--background)', padding: '20px 0', zIndex: 10 }}>
        <div style={{ position: 'relative' }}>
          <SearchIcon style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} size={20} />
          <input
            type="text"
            placeholder="曲名、歌い手、アーティストで検索"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{
              width: '100%', padding: '14px 14px 14px 48px',
              background: 'var(--surface)', border: 'none', borderRadius: '50px',
              color: 'white', fontSize: '16px', outline: 'none', transition: 'background 0.2s'
            }}
            onFocus={(e) => e.target.style.background = 'var(--surface-hover)'}
            onBlur={(e) => e.target.style.background = 'var(--surface)'}
          />
          {query && (
            <button onClick={() => setQuery('')} style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-secondary)', padding: 0 }}>
              <X size={20} />
            </button>
          )}
        </div>
      </div>

      {/* Song search results when query exists */}
      {query && (
        <div style={{ marginBottom: '24px' }}>
          <h2 style={{ fontSize: '18px', marginBottom: '16px' }}>検索結果</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '20px' }}>
            {filteredSongs.length > 0 ? (
              filteredSongs.map(song => (
                <SongCard key={song.id} song={song} contextSongs={filteredSongs} onNavigateToCovers={onNavigateToCovers} onNavigateToSinger={onNavigateToSinger} />
              ))
            ) : (
              <p style={{ color: 'var(--text-secondary)' }}>一致する楽曲は見つかりませんでした。</p>
            )}
          </div>
        </div>
      )}

      {/* Artist index tabs */}
      <div style={{ marginTop: query ? '8px' : '0' }}>
        <h2 style={{ fontSize: '18px', marginBottom: '12px' }}>アーティスト一覧</h2>

        <div
          style={{
            display: 'flex', gap: '4px', overflowX: 'auto', paddingBottom: '12px',
            scrollbarWidth: 'none', msOverflowStyle: 'none',
          }}
        >
          {ALL_TABS.map(tab => {
            const hasArtists = activeSections.has(tab)
            const isActive = activeIndex === tab
            return (
              <button
                key={tab}
                onClick={() => handleIndexClick(tab)}
                style={{
                  minWidth: 36, height: 32, borderRadius: 8, border: 'none',
                  fontSize: 13, fontWeight: 600, cursor: hasArtists ? 'pointer' : 'default',
                  flexShrink: 0, padding: '0 6px', transition: 'all 0.2s',
                  background: isActive ? '#6366f1' : hasArtists ? 'var(--surface)' : 'transparent',
                  color: isActive ? 'white' : hasArtists ? 'var(--text-primary)' : 'rgba(148,163,184,0.3)',
                  opacity: hasArtists ? 1 : 0.5,
                }}
              >
                {tab}
              </button>
            )
          })}
        </div>

        {/* Artist sections */}
        <div style={{ marginTop: '8px' }}>
          {Array.from(sections.entries()).map(([key, artistList]) => (
            <div key={key} ref={el => sectionRefs.current[key] = el}>
              <div style={{
                fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)',
                padding: '12px 0 6px', letterSpacing: '0.05em',
                borderBottom: '1px solid rgba(255,255,255,0.05)', marginBottom: '4px'
              }}>
                {getSectionLabel(key)}
              </div>
              {artistList.map(artist => (
                <div
                  key={artist.name}
                  onClick={() => onNavigateToArtist && onNavigateToArtist(artist.name, artist.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '14px',
                    padding: '10px 8px', borderRadius: '10px', cursor: 'pointer',
                    transition: 'background 0.2s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--surface)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <ArtistAvatar name={artist.name} imageUrl={artist.imageUrl} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 15 }}>{artist.name}</div>
                  </div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: 13, flexShrink: 0 }}>
                    {artist.songCount}曲
                  </div>
                  <ChevronRight size={16} color="var(--text-secondary)" style={{ flexShrink: 0 }} />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      <style>{`
        .search-page div::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  )
}

export default Search
