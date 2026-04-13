import { create } from 'zustand'

// ── Dual player references (main + preload) ──
let _mainPlayer = null
let _preloadPlayer = null
let _preloadedVideoId = null

export function setMainPlayer(p) { _mainPlayer = p }
export function getMainPlayer() { return _mainPlayer }
export function setPreloadPlayer(p) { _preloadPlayer = p }
export function getPreloadPlayer() { return _preloadPlayer }
export function getPreloadedVideoId() { return _preloadedVideoId }
export function setPreloadedVideoId(id) { _preloadedVideoId = id }

// Legacy alias used by other files
export function setYTPlayer(p) { _mainPlayer = p }
export function getYTPlayer() { return _mainPlayer }

export const usePlayerStore = create((set, get) => ({
  currentTrack: null,
  isPlaying: false,
  isFullscreen: false,

  queue: [],
  currentIndex: -1,
  currentTime: 0,
  duration: 0,

  repeatMode: 'none',
  isShuffled: false,
  shuffledQueue: [],

  // Cover swipe
  sameCovers: [],
  currentCoverIndex: 0,
  _isCoverSwitch: false,
  _isSwitchingCover: false,

  // Video visibility
  isVideoVisible: false,

  // BGM mode
  isBGMMode: false,
  bgmArtistName: '',

  // Setters
  setFullscreen: (bool) => set({ isFullscreen: bool }),
  toggleVideoVisible: () => set(s => ({ isVideoVisible: !s.isVideoVisible })),
  setPlaying: (bool) => set({ isPlaying: bool }),
  togglePlay: () => set((state) => ({ isPlaying: !state.isPlaying })),

  setProgress: (currentTime, duration) => set({
    currentTime,
    duration: duration || get().duration
  }),

  setSameCovers: (covers) => set({ sameCovers: covers }),

  // ── Track & Queue ──
  setQueue: (tracks, startIndex = 0) => {
    const isShuffled = get().isShuffled
    let shuffled = [...tracks]
    if (isShuffled) {
      shuffled = [...tracks].sort(() => Math.random() - 0.5)
    }
    set({ isBGMMode: false, bgmArtistName: '',
      queue: tracks, shuffledQueue: shuffled,
      currentIndex: startIndex, currentTrack: tracks[startIndex],
      isPlaying: true, currentTime: 0
    })
  },

  playTrack: (track) => {
    const { queue } = get()
    const index = queue.findIndex(t => t.id === track.id)
    if (index !== -1) {
      set({ currentIndex: index, currentTrack: track, isPlaying: true, currentTime: 0 })
    } else {
      const newQueue = [...queue, track]
      set({ queue: newQueue, currentIndex: newQueue.length - 1, currentTrack: track, isPlaying: true, currentTime: 0 })
    }
  },

  nextTrack: () => {
    const { currentIndex, queue, shuffledQueue, isShuffled, repeatMode, isBGMMode } = get()
    const activeQueue = isShuffled ? shuffledQueue : queue
    if (repeatMode === 'one') { set({ currentTime: 0, isPlaying: true }); return }
    let nextIndex = currentIndex + 1
    if (nextIndex >= activeQueue.length) {
      if (isBGMMode) {
        // BGM mode: reshuffle and loop from top
        const reshuffled = [...queue].sort(() => Math.random() - 0.5)
        set({ shuffledQueue: reshuffled, currentIndex: 0, currentTrack: reshuffled[0], isPlaying: true, currentTime: 0 })
        return
      }
      if (repeatMode === 'all') nextIndex = 0
      else { set({ isPlaying: false }); return }
    }
    set({ currentIndex: nextIndex, currentTrack: activeQueue[nextIndex], isPlaying: true, currentTime: 0 })
  },

  prevTrack: () => {
    const { currentIndex, queue, shuffledQueue, isShuffled, currentTime } = get()
    if (currentTime > 3) { set({ currentTime: 0 }); return }
    const activeQueue = isShuffled ? shuffledQueue : queue
    let prevIndex = currentIndex - 1
    if (prevIndex < 0) prevIndex = activeQueue.length - 1
    set({ currentIndex: prevIndex, currentTrack: activeQueue[prevIndex], isPlaying: true, currentTime: 0 })
  },

  toggleRepeat: () => {
    const c = get().repeatMode
    set({ repeatMode: c === 'none' ? 'all' : c === 'all' ? 'one' : 'none' })
  },

  toggleShuffle: () => {
    const next = !get().isShuffled
    const shuffled = next ? [...get().queue].sort(() => Math.random() - 0.5) : []
    set({ isShuffled: next, shuffledQueue: shuffled })
  },

  startBGMMode: (artistName, tracks) => {
    const shuffled = [...tracks].sort(() => Math.random() - 0.5)
    set({
      isBGMMode: true,
      bgmArtistName: artistName,
      queue: tracks,
      shuffledQueue: shuffled,
      isShuffled: true,
      currentIndex: 0,
      currentTrack: shuffled[0],
      isPlaying: true,
      currentTime: 0,
    })
  },

  stopBGMMode: () => {
    set({ isBGMMode: false, bgmArtistName: '' })
  },

  // ── Preload next cover (muted, keeps playing for full buffer) ──
  preloadNextCover: () => {
    const { sameCovers, currentCoverIndex } = get()
    if (sameCovers.length <= 1) return
    const nextIdx = (currentCoverIndex + 1) % sameCovers.length
    const nextCover = sameCovers[nextIdx]
    const preload = getPreloadPlayer()
    if (!preload?.loadVideoById || !nextCover) return
    if (getPreloadedVideoId() === nextCover.videoId) return

    console.log('[Covery] Preloading:', nextCover.videoId)
    preload.mute()
    preload.loadVideoById(nextCover.videoId, 0)
    // Do NOT pause — let it play muted so buffer stays warm
    setPreloadedVideoId(nextCover.videoId)
  },

  // ── Cover switch ──
  switchCover: (index) => {
    const { sameCovers, currentTrack } = get()
    if (index < 0 || index >= sameCovers.length) return
    const cover = sameCovers[index]
    const main = getMainPlayer()

    let startSeconds = 0
    if (main?.getCurrentTime) startSeconds = main.getCurrentTime()

    const preload = getPreloadPlayer()
    const preloadReady = preload && getPreloadedVideoId() === cover.videoId

    if (preloadReady) {
      console.log('[Covery] Fast swap at', startSeconds.toFixed(1), 's')

      // 1. Seek preload to same position
      preload.seekTo(startSeconds, true)

      // 2. Match volume + unmute (preload is already playing, so audio starts instantly)
      if (main?.getVolume) { try { preload.setVolume(main.getVolume()) } catch (_) {} }
      preload.unMute()

      // 3. Silence main immediately, then pause
      try { main.mute() } catch (_) {}
      setTimeout(() => { try { main.pauseVideo() } catch (_) {} }, 50)

      // 4. Swap references
      setMainPlayer(preload)
      setPreloadPlayer(main)
      setPreloadedVideoId(null)

      set({
        _isCoverSwitch: true,
        _isSwitchingCover: false,
        currentCoverIndex: index,
        currentTrack: {
          ...currentTrack,
          videoId: cover.videoId,
          singerName: cover.singerName,
          thumbnailUrl: `https://img.youtube.com/vi/${cover.videoId}/hqdefault.jpg`,
        },
        isPlaying: true,
      })
    } else {
      // ── Fallback: direct load ──
      console.log('[Covery] Direct load at', startSeconds.toFixed(1), 's')

      set({
        _isCoverSwitch: true,
        _isSwitchingCover: true,
        currentCoverIndex: index,
        currentTrack: {
          ...currentTrack,
          videoId: cover.videoId,
          singerName: cover.singerName,
          thumbnailUrl: `https://img.youtube.com/vi/${cover.videoId}/hqdefault.jpg`,
        },
        isPlaying: true,
      })

      if (main?.loadVideoById) {
        main.loadVideoById(cover.videoId, startSeconds)
        setTimeout(() => { if (main?.playVideo) main.playVideo() }, 300)
      }
    }

    // Preload next after swap settles
    setTimeout(() => get().preloadNextCover(), 800)
  },

  nextCover: () => {
    const { currentCoverIndex, sameCovers } = get()
    if (sameCovers.length <= 1) return
    get().switchCover((currentCoverIndex + 1) % sameCovers.length)
  },

  prevCover: () => {
    const { currentCoverIndex, sameCovers } = get()
    if (sameCovers.length <= 1) return
    get().switchCover((currentCoverIndex - 1 + sameCovers.length) % sameCovers.length)
  },
}))
