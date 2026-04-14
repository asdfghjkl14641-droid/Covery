import { useEffect, useRef } from 'react'
import { usePlayerStore, setMainPlayer, setPreloadPlayer, getMainPlayer } from '../store/usePlayerStore'
import { useAdminStore } from '../store/useAdminStore'
import { getApprovedSongs } from '../utils/filterCovers'
import metaData from '../data/metadata.json'

export const useYouTubeAPI = () => {
  const mainRef = useRef(null)
  const preloadRef = useRef(null)
  const isReadyRef = useRef(false)
  const intervalRef = useRef(null)

  const {
    currentTrack,
    isPlaying,
    setPlaying,
    setProgress,
    nextTrack,
    currentTime,
    setSameCovers,
  } = usePlayerStore()

  // ── Init: load YT API + create both players ──
  useEffect(() => {
    if (!window.YT) {
      const tag = document.createElement('script')
      tag.src = 'https://www.youtube.com/iframe_api'
      document.getElementsByTagName('script')[0].parentNode.insertBefore(tag, document.getElementsByTagName('script')[0])
    }

    const checkReady = () => {
      if (window.YT && window.YT.Player) createPlayers()
      else setTimeout(checkReady, 100)
    }

    window.onYouTubeIframeAPIReady = () => createPlayers()
    checkReady()

    return () => {
      if (mainRef.current) mainRef.current.destroy()
      if (preloadRef.current) preloadRef.current.destroy()
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [])

  const PLAYER_VARS = { autoplay: 1, playsinline: 1, controls: 0, disablekb: 1, origin: window.location.origin }

  const createPlayers = () => {
    if (mainRef.current) return

    // Main player
    mainRef.current = new window.YT.Player('youtube-player-global', {
      height: '100%', width: '100%',
      playerVars: PLAYER_VARS,
      events: {
        onReady: (event) => {
          console.log('[Covery] Main player ready')
          isReadyRef.current = true
          setMainPlayer(event.target)
        },
        onStateChange: handleStateChange,
      },
    })

    // Preload player
    preloadRef.current = new window.YT.Player('youtube-player-preload', {
      height: '100%', width: '100%',
      playerVars: PLAYER_VARS,
      events: {
        onReady: (event) => {
          console.log('[Covery] Preload player ready')
          setPreloadPlayer(event.target)
          event.target.mute()
        },
        onStateChange: handleStateChange,
      },
    })
  }

  // Shared state change handler — attached to BOTH players.
  // Only act on events from whichever player is currently "main".
  const handleStateChange = (event) => {
    const currentMain = getMainPlayer()
    const isFromMain = event.target === currentMain

    if (!isFromMain) return // Ignore events from the non-active (preload/old) player

    if (event.data === window.YT.PlayerState.PLAYING) {
      usePlayerStore.setState({ _isSwitchingCover: false })
      setPlaying(true)
      startProgressTimer()
    } else if (event.data === window.YT.PlayerState.PAUSED) {
      if (usePlayerStore.getState()._isSwitchingCover) {
        usePlayerStore.setState({ _isSwitchingCover: false })
        event.target.playVideo()
        return
      }
      setPlaying(false)
      stopProgressTimer()
    } else if (event.data === window.YT.PlayerState.ENDED) {
      stopProgressTimer()
      nextTrack()
    }
  }

  const startProgressTimer = () => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    intervalRef.current = setInterval(() => {
      const player = getMainPlayer()
      if (player?.getCurrentTime) {
        setProgress(player.getCurrentTime(), player.getDuration())
      }
    }, 500)
  }

  const stopProgressTimer = () => {
    if (intervalRef.current) clearInterval(intervalRef.current)
  }

  // ── Track change: load video + build cover list + trigger preload ──
  useEffect(() => {
    if (!isReadyRef.current || !currentTrack) return
    const main = getMainPlayer()
    if (!main) return

    const isCoverSwitch = usePlayerStore.getState()._isCoverSwitch

    if (isCoverSwitch) {
      console.log('[Covery] Cover switch — skipping loadVideoById')
      usePlayerStore.setState({ _isCoverSwitch: false })
    } else {
      console.log('[Covery] Loading video:', currentTrack.videoId)
      main.loadVideoById(currentTrack.videoId)
      // Safety: ensure playback starts even if autoplay is blocked
      setTimeout(() => { try { main.playVideo() } catch (_) {} }, 500)
    }

    // Build same-song cover list from approved data
    const approvedSongs = getApprovedSongs()
    const sameSongs = approvedSongs.filter(s => s.title === currentTrack.title)
    const covers = sameSongs.map(s => {
      const c = s.covers?.[0]
      if (!c) return null
      const singer = (metaData?.singers || []).find(si => si.channelId === c.singerId)
      return {
        videoId: c.videoId,
        singerId: c.singerId,
        singerName: singer?.name || c.singerId || 'Unknown',
        singerThumb: singer?.thumbnailUrl || '',
        publishedAt: c.publishedAt || '',
      }
    }).filter(Boolean)

    const currentIdx = covers.findIndex(c => c.videoId === currentTrack.videoId)
    setSameCovers(covers)
    usePlayerStore.setState({ currentCoverIndex: currentIdx >= 0 ? currentIdx : 0 })

    // Preload next cover after a short delay
    setTimeout(() => usePlayerStore.getState().preloadNextCover(), 2000)
  }, [currentTrack?.videoId])

  // ── Play/Pause ──
  useEffect(() => {
    const player = getMainPlayer()
    if (!player || !isReadyRef.current || !player.getPlayerState) return
    if (isPlaying) player.playVideo()
    else player.pauseVideo()
  }, [isPlaying])

  // ── Manual seek ──
  useEffect(() => {
    const player = getMainPlayer()
    if (!player || !isReadyRef.current || !player.seekTo) return
    const playerTime = player.getCurrentTime()
    if (Math.abs(playerTime - currentTime) > 2) {
      player.seekTo(currentTime, true)
    }
  }, [currentTime])

  return mainRef
}
