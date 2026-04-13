import React from 'react'
import { Play, Pause, SkipForward, Music } from 'lucide-react'
import { usePlayerStore } from '../../store/usePlayerStore'
import { motion } from 'framer-motion'

const MiniPlayer = () => {
  const { currentTrack, isPlaying, togglePlay, setFullscreen, isBGMMode, bgmArtistName } = usePlayerStore()
  const [imageError, setImageError] = React.useState(false)

  if (!currentTrack) return null

  return (
    <motion.div
      initial={{ y: 100 }}
      animate={{ y: 0 }}
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: 'var(--player-height)',
        borderRadius: 0, // Remove all rounded corners for absolute bottom look
        display: 'flex',
        alignItems: 'center',
        padding: '0 24px',
        zIndex: 1000, // Ensure it's above everything
        backgroundColor: 'var(--miniplayer-bg)',
        backdropFilter: 'blur(30px)',
        WebkitBackdropFilter: 'blur(30px)',
        borderTop: '1px solid rgba(255,255,255,0.1)',
        cursor: 'pointer',
        boxShadow: '0 -8px 24px rgba(0, 0, 0, 0.5)'
      }} onClick={() => setFullscreen(true)}>
      <div style={{ width: '48px', height: '48px', marginRight: '12px', flexShrink: 0, background: 'var(--surface)', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {!imageError ? (
          <img 
            src={currentTrack.thumbnailUrl} 
            alt="" 
            onError={() => setImageError(true)}
            style={{ width: '100%', height: '100%', borderRadius: '4px', objectFit: 'cover' }} 
          />
        ) : (
          <Music size={20} opacity={0.5} />
        )}
      </div>
      
      <div style={{ flex: 1, minWidth: 0 }}>
        {isBGMMode && (
          <div style={{ fontSize: 10, fontWeight: 700, color: '#6366f1', marginBottom: 1 }}>
            BGM: {bgmArtistName}
          </div>
        )}
        <div style={{
          fontSize: '14px',
          fontWeight: 'bold',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}>
          {currentTrack.title}
        </div>
        <div style={{
          fontSize: '11px',
          color: 'var(--text-secondary)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}>
          {currentTrack.singerName}
          {currentTrack.originalArtist && (
            <span style={{ color: '#6366f1', marginLeft: '6px' }}>/ {currentTrack.originalArtist}</span>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }} onClick={(e) => e.stopPropagation()}>
        <motion.button 
          whileTap={{ 
            scale: 0.9, 
            backgroundColor: 'rgba(255, 255, 255, 0.2)',
            transition: { duration: 0.1 }
          }}
          onClick={togglePlay} 
          style={{ 
            background: 'none', 
            border: 'none', 
            padding: '8px', 
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            outline: 'none',
            WebkitTapHighlightColor: 'transparent'
          }}
        >
          {isPlaying ? <Pause size={24} fill="white" /> : <Play size={24} fill="white" />}
        </motion.button>
        <motion.button 
          whileTap={{ 
            scale: 0.9, 
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
            transition: { duration: 0.1 }
          }}
          style={{ 
            background: 'none', 
            border: 'none', 
            padding: '8px', 
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            outline: 'none',
            WebkitTapHighlightColor: 'transparent'
          }}
        >
          <SkipForward size={24} fill="white" />
        </motion.button>
      </div>
    </motion.div>
  )
}

export default MiniPlayer
