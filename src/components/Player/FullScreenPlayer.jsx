import React from 'react'
import { Play, Pause, SkipForward, SkipBack, ChevronDown, Repeat, Shuffle, Share2, ListMusic, Music, Users, ChevronLeft, ChevronRight, Eye, EyeOff } from 'lucide-react'
import { usePlayerStore } from '../../store/usePlayerStore'
import { motion, AnimatePresence } from 'framer-motion'
import { useSwipeable } from 'react-swipeable'
import OtherCoversSheet from './OtherCoversSheet'

const FullScreenPlayer = () => {
  const {
    currentTrack,
    isPlaying,
    togglePlay,
    setFullscreen,
    isFullscreen,
    currentTime,
    duration,
    setProgress,
    nextTrack,
    prevTrack,
    repeatMode,
    toggleRepeat,
    isShuffled,
    toggleShuffle,
    sameCovers,
    currentCoverIndex,
    nextCover,
    prevCover,
    switchCover,
    isVideoVisible,
    toggleVideoVisible,
    isBGMMode,
    bgmArtistName,
  } = usePlayerStore()

  const [isOtherCoversOpen, setIsOtherCoversOpen] = React.useState(false)
  const [swipeDir, setSwipeDir] = React.useState(null) // 'left' | 'right' | null
  const [showHint, setShowHint] = React.useState(() => {
    try { return !localStorage.getItem('covery-swipe-hint-seen') } catch { return true }
  })

  if (!currentTrack) return null

  const hasManyCovers = sameCovers.length >= 2
  const currentSinger = hasManyCovers ? sameCovers[currentCoverIndex] : null

  const handleSwipe = (dir) => {
    if (!hasManyCovers) return
    setSwipeDir(dir)
    if (dir === 'left') nextCover()
    else prevCover()

    // Dismiss hint
    if (showHint) {
      setShowHint(false)
      try { localStorage.setItem('covery-swipe-hint-seen', '1') } catch {}
    }

    // Clear animation
    setTimeout(() => setSwipeDir(null), 400)
  }

  const swipeHandlers = useSwipeable({
    onSwipedLeft: () => handleSwipe('left'),
    onSwipedRight: () => handleSwipe('right'),
    preventScrollOnSwipe: true,
    trackMouse: true,
    delta: 40,
  })

  const formatTime = (seconds) => {
    const min = Math.floor(seconds / 60)
    const sec = Math.floor(seconds % 60)
    return `${min}:${sec.toString().padStart(2, '0')}`
  }

  const handleSeek = (e) => {
    const val = parseFloat(e.target.value)
    setProgress(val, duration)
  }

  return (
      <motion.div
        key="fullscreen-player"
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="fullscreen-player"
        style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'linear-gradient(to bottom, #0f1333, #0a0e27)',
          zIndex: 1000, display: 'flex', flexDirection: 'column',
          padding: '24px', color: 'var(--text-primary)', overflowY: 'auto'
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <button onClick={() => setFullscreen(false)} style={{ background: 'none', border: 'none', color: 'white' }}>
            <ChevronDown size={32} />
          </button>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.6, marginBottom: '2px' }}>
              {isBGMMode ? `BGMモード: ${bgmArtistName}` : '再生中のプレイリスト'}
            </div>
            <div style={{ fontSize: '12px', fontWeight: '600', opacity: 0.8 }}>{currentTrack.singerName}</div>
          </div>
          <button
            onClick={toggleVideoVisible}
            style={{
              background: isVideoVisible ? 'var(--primary)' : '#1e2248',
              border: 'none', borderRadius: '50%',
              width: 40, height: 40,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'white', cursor: 'pointer', transition: 'background 0.2s', padding: 0,
            }}
            title={isVideoVisible ? '動画を非表示' : '動画を表示'}
          >
            {isVideoVisible ? <Eye size={20} /> : <EyeOff size={20} />}
          </button>
        </div>

        {/* Cover count indicator */}
        {hasManyCovers && (
          <div
            onClick={() => setIsOtherCoversOpen(true)}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              padding: '6px 16px', borderRadius: 20,
              background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.25)',
              cursor: 'pointer', margin: '0 auto 12px', width: 'fit-content',
            }}
          >
            <Users size={14} color="#6366f1" />
            <span style={{ fontSize: 12, fontWeight: 600, color: '#a5b4fc' }}>
              この曲のカバー: {sameCovers.length}人
            </span>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#6366f1', background: 'rgba(99,102,241,0.2)', borderRadius: 8, padding: '1px 6px' }}>
              {currentCoverIndex + 1}/{sameCovers.length}
            </span>
          </div>
        )}

        {/* Video / Thumbnail area */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '10px 0' }}>
          {isVideoVisible ? (
            /* Video ON: iframe is shown via CSS overlay — leave space for it + transparent swipe zone */
            <div style={{
              width: '100%', maxWidth: '560px', aspectRatio: '16/9', borderRadius: '12px',
              position: 'relative',
            }}>
              {/* Transparent swipe overlay on top of the iframe */}
              {hasManyCovers && (
                <div
                  {...swipeHandlers}
                  style={{ position: 'absolute', inset: 0, zIndex: 1002, cursor: 'grab' }}
                />
              )}
            </div>
          ) : (
            /* Audio-only mode: show thumbnail */
            <div style={{
              width: '100%', maxWidth: '560px', aspectRatio: '16/9', borderRadius: '12px',
              background: 'rgba(0,0,0,0.3)', boxShadow: '0 0 30px rgba(99, 102, 241, 0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              position: 'relative', overflow: 'hidden'
            }}>
              <PlayerThumbnail videoId={currentTrack.videoId} alt={currentTrack.title} isPlaying={isPlaying} />
            </div>
          )}
        </div>

        {/* ═══ SWIPE COVER AREA ═══ */}
        {hasManyCovers && (
          <div style={{ marginBottom: 8 }}>
            <div
              {...(isVideoVisible ? {} : swipeHandlers)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                gap: 16, padding: '12px 0', cursor: 'grab', userSelect: 'none',
                touchAction: 'pan-y',
              }}
            >
              {/* Left arrow */}
              <button onClick={(e) => { e.stopPropagation(); handleSwipe('right') }} style={{ background: 'none', border: 'none', padding: 8, cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                <ChevronLeft size={24} color="rgba(255,255,255,0.5)" />
              </button>

              {/* Animated singer icon (hidden when video is ON) */}
              {!isVideoVisible && (
                <div style={{ width: 60, height: 60, position: 'relative', overflow: 'hidden' }}>
                  <AnimatePresence mode="popLayout">
                    <motion.div
                      key={currentSinger?.videoId || 'empty'}
                      initial={{ x: swipeDir === 'left' ? 80 : swipeDir === 'right' ? -80 : 0, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      exit={{ x: swipeDir === 'left' ? -80 : 80, opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      style={{ position: 'absolute', inset: 0 }}
                    >
                      <SwipeSingerIcon src={currentSinger?.singerThumb} name={currentSinger?.singerName || '?'} />
                    </motion.div>
                  </AnimatePresence>
                </div>
              )}

              {/* Right arrow */}
              <button onClick={(e) => { e.stopPropagation(); handleSwipe('left') }} style={{ background: 'none', border: 'none', padding: 8, cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                <ChevronRight size={24} color="rgba(255,255,255,0.5)" />
              </button>
            </div>

            {/* Singer name with animation */}
            <AnimatePresence mode="wait">
              <motion.div
                key={currentSinger?.singerName || ''}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2 }}
                style={{ textAlign: 'center', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}
              >
                {currentSinger?.singerName}
              </motion.div>
            </AnimatePresence>

            {/* Dot indicators */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginBottom: 4 }}>
              {sameCovers.map((_, i) => (
                <div
                  key={i}
                  onClick={() => switchCover(i)}
                  style={{
                    width: 8, height: 8, borderRadius: '50%', cursor: 'pointer',
                    transition: 'all 0.2s',
                    background: i === currentCoverIndex ? '#6366f1' : 'transparent',
                    border: i === currentCoverIndex ? '2px solid #6366f1' : '2px solid rgba(255,255,255,0.25)',
                  }}
                />
              ))}
            </div>

            {/* Hint (first time only) */}
            {showHint && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                style={{ textAlign: 'center', fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}
              >
                スワイプでカバー切替
              </motion.div>
            )}
          </div>
        )}

        {/* Info */}
        <div style={{ marginBottom: '32px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h2 style={{ fontSize: '22px', fontWeight: 'bold', marginBottom: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{currentTrack.title}</h2>
              {currentTrack.originalArtist && (
                <p style={{ color: '#6366f1', fontWeight: '600', fontSize: '13px', marginBottom: '2px' }}>
                  {currentTrack.originalArtist}
                </p>
              )}
              <p style={{ color: 'var(--text-secondary)', fontWeight: '500', fontSize: '14px' }}>{currentTrack.singerName}</p>
            </div>
            <button style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '50%', width: '44px', height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', color: 'white' }}>
              <HeartMock size={24} />
            </button>
          </div>

          {/* Seek Bar */}
          <div style={{ marginBottom: '8px' }}>
            <div className="seekbar-container" style={{ position: 'relative', height: '24px', display: 'flex', alignItems: 'center' }}>
              <input
                type="range" min={0} max={duration || 100} value={currentTime} onChange={handleSeek}
                style={{ width: '100%', height: '4px', appearance: 'none', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', outline: 'none', cursor: 'pointer', position: 'relative', zIndex: 2 }}
              />
              <div style={{ position: 'absolute', top: '50%', left: 0, transform: 'translateY(-50%)', width: `${(currentTime / (duration || 1)) * 100}%`, height: '4px', background: 'var(--primary)', borderRadius: '2px', pointerEvents: 'none', zIndex: 1 }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginTop: '4px', fontWeight: '500', color: 'var(--text-secondary)' }}>
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>
        </div>

        {/* Main Controls */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
          <button onClick={toggleShuffle} style={{ background: 'none', border: 'none', color: isShuffled ? 'var(--primary)' : 'white', opacity: isShuffled ? 1 : 0.5 }}>
            <Shuffle size={24} />
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '32px' }}>
            <button onClick={prevTrack} style={{ background: 'none', border: 'none', color: 'white' }}>
              <SkipBack size={36} fill="white" />
            </button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={togglePlay}
              style={{ background: 'white', color: 'black', width: '68px', height: '68px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', boxShadow: '0 8px 20px rgba(0,0,0,0.4)' }}
            >
              {isPlaying ? <Pause size={30} fill="black" /> : <Play size={30} fill="black" style={{ marginLeft: '4px' }} />}
            </motion.button>
            <button onClick={nextTrack} style={{ background: 'none', border: 'none', color: 'white' }}>
              <SkipForward size={36} fill="white" />
            </button>
          </div>
          <button onClick={toggleRepeat} style={{ background: 'none', border: 'none', color: repeatMode !== 'none' ? 'var(--primary)' : 'white', opacity: repeatMode !== 'none' ? 1 : 0.5, position: 'relative' }}>
            <Repeat size={24} />
            {repeatMode === 'one' && <span style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', fontSize: '8px', fontWeight: 'bold' }}>1</span>}
          </button>
        </div>

        {/* Secondary Controls */}
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '0 4px', marginBottom: '20px' }}>
          <button
            onClick={() => setIsOtherCoversOpen(true)}
            style={{
              background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '20px', padding: '8px 16px', color: 'white',
              display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer'
            }}
          >
            <ListMusic size={20} />
            <span style={{ fontSize: '13px', fontWeight: '600' }}>他のカバーを見る</span>
          </button>
        </div>
        <OtherCoversSheet
          isOpen={isOtherCoversOpen}
          onClose={() => setIsOtherCoversOpen(false)}
        />
      </motion.div>
  )
}

// ── Swipe singer icon (60px circle) ──
const SwipeSingerIcon = ({ src, name }) => {
  const [err, setErr] = React.useState(false)
  if (!src || err) {
    return (
      <div style={{
        width: 60, height: 60, borderRadius: '50%', background: 'var(--primary)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 20, fontWeight: 700, color: 'white',
        border: '3px solid rgba(99,102,241,0.4)',
      }}>
        {name.charAt(0)}
      </div>
    )
  }
  return (
    <img src={src} alt="" onError={() => setErr(true)}
      style={{ width: 60, height: 60, borderRadius: '50%', objectFit: 'cover', border: '3px solid rgba(99,102,241,0.4)' }}
    />
  )
}

const PlayerThumbnail = ({ videoId, alt, isPlaying }) => {
  const [errorLevel, setErrorLevel] = React.useState(0)
  const maxResUrl = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`
  const hqUrl = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`

  if (errorLevel >= 2) {
    return (
      <div style={{ width: '100%', height: '100%', background: 'var(--surface-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Music size={48} opacity={0.2} />
      </div>
    )
  }

  return (
    <img
      src={errorLevel === 0 ? maxResUrl : hqUrl}
      alt={alt}
      onError={() => setErrorLevel(prev => prev + 1)}
      style={{ width: '100%', height: '100%', objectFit: 'cover', filter: isPlaying ? 'none' : 'blur(4px)', transition: 'filter 0.5s ease' }}
    />
  )
}

const HeartMock = ({ size }) => <span style={{ fontSize: size, cursor: 'pointer' }}>❤</span>

export default FullScreenPlayer
