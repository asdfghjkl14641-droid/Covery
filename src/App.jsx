import { useState, useEffect, useCallback } from 'react'
import './App.css'
import { Home as HomeIcon, Search as SearchIcon, Library as LibraryIcon } from 'lucide-react'
import Home from './pages/Home'
import Search from './pages/Search'
import Library from './pages/Library'
import SongCovers from './pages/SongCovers'
import ArtistSongs from './pages/ArtistSongs'
import SingerPage from './pages/SingerPage'
import Admin from './pages/Admin'
import MiniPlayer from './components/Player/MiniPlayer'
import FullScreenPlayer from './components/Player/FullScreenPlayer'
import { useYouTubeAPI } from './hooks/useYouTubeAPI'
import { usePlayerStore } from './store/usePlayerStore'
import { AnimatePresence } from 'framer-motion'
import { ShieldAlert } from 'lucide-react'

function App() {
  const [activeTab, setActiveTab] = useState('home')
  const [viewingSong, setViewingSong] = useState(null)
  const [viewingArtist, setViewingArtist] = useState(null)
  const [viewingSinger, setViewingSinger] = useState(null)
  const [tabHistory, setTabHistory] = useState([])
  const { isFullscreen, isVideoVisible } = usePlayerStore()

  useYouTubeAPI()

  // Push current tab to history, then navigate
  const pushAndNavigate = useCallback((newTab) => {
    setTabHistory(prev => [...prev, activeTab])
    setActiveTab(newTab)
    window.history.pushState({ tab: newTab }, '')
    window.scrollTo(0, 0)
  }, [activeTab])

  const navigateToCovers = useCallback((songTitle, songId = null) => {
    setViewingSong({ title: songTitle, id: songId })
    pushAndNavigate('song-covers')
  }, [pushAndNavigate])

  const navigateToArtist = useCallback((artistName, artistId = null) => {
    setViewingArtist({ name: artistName, id: artistId })
    pushAndNavigate('artist-songs')
  }, [pushAndNavigate])

  const navigateToSinger = useCallback((singerId) => {
    setViewingSinger(singerId)
    pushAndNavigate('singer-page')
  }, [pushAndNavigate])

  const goBack = useCallback(() => {
    setTabHistory(prev => {
      const copy = [...prev]
      const previous = copy.pop() || 'home'
      setActiveTab(previous)
      return copy
    })
    window.scrollTo(0, 0)
  }, [])

  // Top-level nav (home/search/playlist) resets history
  const navTo = useCallback((tab) => {
    setTabHistory([])
    setActiveTab(tab)
  }, [])

  // Browser back button support
  useEffect(() => {
    const handlePopState = () => goBack()
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [goBack])

  return (
    <div className="app-layout">
      <div className="main-view">
        {/* Navigation moved inside main-view to allow normal scrolling */}
        {activeTab !== 'admin' && <Header activeTab={activeTab} setActiveTab={navTo} />}
        
        <main className="main-content" style={{ padding: activeTab === 'admin' ? '0' : '0 24px 100px 24px', flex: 1 }}>
          <div id="youtube-player-global" className={`youtube-container-global ${isFullscreen ? 'visible' : 'hidden'} ${isFullscreen && !isVideoVisible ? 'video-hidden' : ''}`}></div>
          <div id="youtube-player-preload" style={{ position: 'fixed', bottom: 0, right: 0, width: 10, height: 10, opacity: 0, pointerEvents: 'none', zIndex: -1 }}></div>
          
          {activeTab === 'home' && <Home onNavigateToCovers={navigateToCovers} onNavigateToSinger={navigateToSinger} />}
          {activeTab === 'search' && <Search onNavigateToCovers={navigateToCovers} onNavigateToArtist={navigateToArtist} onNavigateToSinger={navigateToSinger} />}
          {activeTab === 'playlist' && <Library onNavigateToCovers={navigateToCovers} onNavigateToSinger={navigateToSinger} />}
          {activeTab === 'song-covers' && (
            <SongCovers
              songTitle={viewingSong?.title || viewingSong}
              songId={viewingSong?.id}
              onBack={goBack}
              onNavigateToSinger={navigateToSinger}
            />
          )}
          {activeTab === 'artist-songs' && (
            <ArtistSongs
              artistName={viewingArtist?.name || viewingArtist}
              artistId={viewingArtist?.id}
              onBack={goBack}
              onNavigateToCovers={navigateToCovers}
              onNavigateToSinger={navigateToSinger}
            />
          )}
          {activeTab === 'singer-page' && (
            <SingerPage
              singerId={viewingSinger}
              onBack={goBack}
              onNavigateToCovers={navigateToCovers}
              onNavigateToSinger={navigateToSinger}
            />
          )}
          {activeTab === 'admin' && <Admin />}
        </main>
      </div>

      {activeTab !== 'admin' && <MiniPlayer />}

      <AnimatePresence>
        {isFullscreen && <FullScreenPlayer />}
      </AnimatePresence>

    </div>
  )
}

const Header = ({ activeTab, setActiveTab }) => {
  return (
    <header className="nav-toolbar">
      <div className="nav-logo">
        <h1 className="gradient-text" style={{ fontSize: '20px', margin: 0, cursor: 'pointer' }} onClick={() => setActiveTab('home')}>
          Covery
        </h1>
      </div>

      <div className="nav-toolbar-center">
        <div className="search-bar-wrapper">
          <div className="search-bar-container">
            <SearchIcon className="search-icon-inside" size={18} color="#94a3b8" />
            <input 
              type="text" 
              className="search-bar-input" 
              placeholder="曲名、歌い手で検索"
              onClick={() => setActiveTab('search')}
              readOnly={activeTab !== 'search'}
            />
          </div>
        </div>

        <button 
          className={`nav-circle-btn ${activeTab === 'home' ? 'active' : ''}`}
          onClick={() => setActiveTab('home')}
          title="ホーム"
        >
          <HomeIcon size={20} strokeWidth={2.5} />
        </button>

        <button 
          className={`nav-circle-btn ${activeTab === 'search' ? 'active' : ''}`}
          onClick={() => setActiveTab('search')}
          title="検索"
        >
          <SearchIcon size={20} strokeWidth={2.5} />
        </button>

        <button 
          className={`nav-circle-btn ${activeTab === 'playlist' ? 'active' : ''}`}
          onClick={() => setActiveTab('playlist')}
          title="マイライブラリ"
        >
          <LibraryIcon size={20} strokeWidth={2.5} />
        </button>
      </div>

      <div className="nav-toolbar-right">
        <button 
          className="nav-circle-btn"
          onClick={() => setActiveTab('admin')}  // admin uses setActiveTab directly (no history reset needed)
          title="ホストログイン"
          style={{ marginLeft: 'auto' }}
        >
          <ShieldAlert size={20} color="#818cf8" />
        </button>
      </div>
    </header>
  )
}

export default App
