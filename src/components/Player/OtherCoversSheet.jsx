import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Play, Music } from 'lucide-react'
import { usePlayerStore } from '../../store/usePlayerStore'
import data from '../../data/metadata.json'

const OtherCoversSheet = ({ isOpen, onClose }) => {
  const { currentTrack, setQueue } = usePlayerStore()
  
  if (!currentTrack) return null

  // Find all songs that have the same title (original title)
  // We assume 'title' is the common key for the song itself
  const otherCovers = data.songs.filter(s => 
    s.title === currentTrack.title
  )

  const handleSwitch = (song) => {
    const cover = song.covers[0]
    const singer = data.singers.find(si => si.channelId === cover.singerId)
    
    const trackToPlay = {
      id: song.id,
      videoId: cover.videoId,
      title: song.title,
      singerName: singer?.name || song.singerName || cover.singerId,
      thumbnailUrl: `https://img.youtube.com/vi/${cover.videoId}/hqdefault.jpg`
    }

    // Play immediately
    setQueue([trackToPlay], 0)
    // onClose() // Keep it open or close? User didn't specify, but usually you switch and see the highlight. 
    // Let's close for better UX if it switches.
    onClose()
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.6)',
              backdropFilter: 'blur(4px)',
              zIndex: 1100
            }}
          />

          {/* Sheet */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            drag="y"
            dragConstraints={{ top: 0 }}
            dragElastic={0.2}
            onDragEnd={(_, info) => {
              if (info.offset.y > 100) onClose()
            }}
            style={{
              position: 'fixed',
              bottom: 0,
              left: 0,
              right: 0,
              background: '#1a1d3d',
              borderTopLeftRadius: '24px',
              borderTopRightRadius: '24px',
              zIndex: 1200,
              paddingBottom: 'env(safe-area-inset-bottom, 24px)',
              maxHeight: '70vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 -10px 40px rgba(0,0,0,0.5)'
            }}
          >
            {/* Handle */}
            <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0' }}>
              <div style={{ width: '40px', height: '4px', background: 'rgba(255,255,255,0.2)', borderRadius: '2px' }} />
            </div>

            {/* Header */}
            <div style={{ padding: '0 24px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '18px', fontWeight: 'bold' }}>この曲の他のカバー</h3>
                <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'white', opacity: 0.5 }}>
                  <X size={24} />
                </button>
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '4px' }}>「{currentTrack.title}」の別バージョン</p>
            </div>

            {/* List */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
              {otherCovers.map((song, index) => {
                const isCurrent = song.videoId === currentTrack.videoId || 
                                 (song.covers && song.covers[0].videoId === currentTrack.videoId)
                
                return (
                  <div 
                    key={`${song.id}-${index}`}
                    onClick={() => !isCurrent && handleSwitch(song)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: '12px 24px',
                      gap: '16px',
                      cursor: isCurrent ? 'default' : 'pointer',
                      background: isCurrent ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                      borderLeft: isCurrent ? '4px solid var(--primary)' : '4px solid transparent',
                      transition: 'background 0.2s'
                    }}
                  >
                    <div style={{ 
                      width: '50px', 
                      height: '50px', 
                      borderRadius: '8px', 
                      overflow: 'hidden', 
                      flexShrink: 0,
                      position: 'relative',
                      background: 'var(--surface-hover)'
                    }}>
                      <img 
                        src={`https://img.youtube.com/vi/${song.covers[0].videoId}/mqdefault.jpg`} 
                        alt={song.singerName}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                      {isCurrent && (
                        <div style={{ position: 'absolute', inset: 0, background: 'rgba(99, 102, 241, 0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Play size={16} fill="white" color="white" />
                        </div>
                      )}
                    </div>
                    
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ 
                        fontWeight: '600', 
                        fontSize: '15px', 
                        color: isCurrent ? 'white' : 'var(--text-primary)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}>
                        {song.singerName}
                      </div>
                      <div style={{ color: 'var(--text-secondary)', fontSize: '12px', marginTop: '2px' }}>
                        YouTube Cover
                      </div>
                    </div>

                    {isCurrent && (
                      <div style={{ color: 'var(--primary)', fontSize: '12px', fontWeight: 'bold' }}>再生中</div>
                    )}
                  </div>
                )
              })}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

export default OtherCoversSheet
