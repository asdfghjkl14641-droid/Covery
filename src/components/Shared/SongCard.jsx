import { Play, Heart, Music } from 'lucide-react'
import { usePlayerStore } from '../../store/usePlayerStore'
import { useCollectionStore } from '../../store/useCollectionStore'
import data from '../../data/metadata.json'
import { useState } from 'react'

const SongCard = ({ song, coverIndex = 0, contextSongs = [], onNavigateToCovers, onNavigateToSinger }) => {
  const setQueue = usePlayerStore((state) => state.setQueue)
  const { favorites, toggleFavorite } = useCollectionStore()

  const cover = song.covers[coverIndex]
  const singer = data.singers.find(s => s.channelId === cover.singerId)
  const isFavorite = favorites.includes(song.id)

  // Count total covers for this song across all entries
  const coverCount = data.songs.filter(s => s.title === song.title).length

  const handlePlay = (e) => {
    e.stopPropagation()
    
    // Create a playable track object
    const trackToPlay = {
      id: song.id,
      videoId: cover.videoId,
      title: song.title,
      originalArtist: song.originalArtist,
      singerName: singer?.name || cover.singerId,
      thumbnailUrl: cover.thumbnailUrl
    }

    if (contextSongs.length > 0) {
      // Deduplicate by title — one entry per song (skip/next goes to a different song)
      const seen = new Set()
      const queueList = []
      let targetIndex = 0
      for (const s of contextSongs) {
        const key = `${s.title}|||${s.originalArtist}`
        if (seen.has(key)) continue
        seen.add(key)
        if (s.id === song.id) targetIndex = queueList.length
        const c = s.covers[0]
        const sig = data.singers.find(si => si.channelId === c.singerId)
        queueList.push({
          id: s.id,
          videoId: c.videoId,
          title: s.title,
          originalArtist: s.originalArtist,
          singerName: sig?.name || c.singerId,
          thumbnailUrl: c.thumbnailUrl
        })
      }
      setQueue(queueList, targetIndex)
    } else {
      setQueue([trackToPlay], 0)
    }
  }

  const handleToggleFavorite = (e) => {
    e.stopPropagation()
    toggleFavorite(song.id)
  }

  const handleTitleClick = (e) => {
    e.stopPropagation();
    if (onNavigateToCovers) {
      onNavigateToCovers(song.title);
    }
  }

  return (
    <div className="song-card" onClick={handlePlay} style={{ width: '200px' }}>
      <div className="song-card-image-container" style={{ width: '200px', height: '150px', overflow: 'hidden', borderRadius: '8px', position: 'relative' }}>
        <ImageWithFallback 
          videoId={cover.videoId}
          alt={song.title} 
        />
        <div className="play-button-overlay">
          <Play size={24} fill="white" color="white" />
        </div>
        {coverCount >= 2 && (
          <div style={{
            position: 'absolute', top: 8, right: 8, zIndex: 2,
            background: '#6366f1', borderRadius: '50%',
            width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, fontWeight: 700, color: 'white',
            boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
          }}>
            {coverCount}
          </div>
        )}
      </div>
      <div 
        className="song-card-title-link"
        onClick={handleTitleClick}
        style={{ 
          fontWeight: '700', 
          fontSize: '15px', 
          marginBottom: '4px', 
          overflow: 'hidden', 
          textOverflow: 'ellipsis', 
          whiteSpace: 'nowrap',
          cursor: 'pointer',
          transition: 'color 0.2s'
        }}
      >
        {song.title}
      </div>
      <div style={{ fontSize: '12px', color: '#6366f1', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: '500', marginBottom: '2px' }}>
        {song.originalArtist}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div
          onClick={(e) => { e.stopPropagation(); if (cover.singerId && onNavigateToSinger) onNavigateToSinger(cover.singerId) }}
          style={{ fontSize: '12px', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: '500', cursor: onNavigateToSinger ? 'pointer' : 'default', transition: 'color 0.2s' }}
          onMouseEnter={e => { if (onNavigateToSinger) e.currentTarget.style.color = '#6366f1' }}
          onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-secondary)' }}
        >
          {shorthandSingerName(singer?.name || cover.singerId)}
        </div>
        <button 
          onClick={handleToggleFavorite}
          style={{ background: 'none', border: 'none', padding: '4px', color: isFavorite ? '#ef4444' : 'var(--text-secondary)', cursor: 'pointer' }}
        >
          <Heart size={18} fill={isFavorite ? 'currentColor' : 'none'} />
        </button>
      </div>
    </div>
  )
}

const ImageWithFallback = ({ videoId, alt }) => {
  const [errorLevel, setErrorLevel] = useState(0) // 0: hq, 1: mq, 2: final error
  
  const hqUrl = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
  const mqUrl = `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`

  if (errorLevel >= 2) {
    return (
      <div className="song-card-image-container" style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surface-hover)' }}>
        <Music size={32} opacity={0.5} />
      </div>
    )
  }

  return (
    <img 
      src={errorLevel === 0 ? hqUrl : mqUrl} 
      alt={alt} 
      onError={() => setErrorLevel(prev => prev + 1)}
      style={{ 
        width: '100%', 
        height: '100%', 
        objectFit: 'cover', 
        display: 'block',
        transform: 'scale(1.3)' // Zoom in to remove YouTube's baked-in black bars
      }}
    />
  )
}

const shorthandSingerName = (name) => {
  if (name.length > 10) return name.substring(0, 10) + '...'
  return name
}

export default SongCard
