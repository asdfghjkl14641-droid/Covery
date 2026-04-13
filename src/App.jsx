import { useState } from 'react'
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
  const [prevTab, setPrevTab] = useState('home')
  const { isFullscreen, isVideoVisible } = usePlayerStore()
  
  // Initialize YouTube API and Player
  useYouTubeAPI()

  const navigateToCovers = (songTitle) => {
    setPrevTab(activeTab)
    setViewingSong(songTitle)
    setActiveTab('song-covers')
    window.scrollTo(0, 0)
  }

  const navigateToArtist = (artistName) => {
    setPrevTab(activeTab)
    setViewingArtist(artistName)
    setActiveTab('artist-songs')
    window.scrollTo(0, 0)
  }

  const navigateToSinger = (singerId) => {
    setPrevTab(activeTab)
    setViewingSinger(singerId)
    setActiveTab('singer-page')
    window.scrollTo(0, 0)
  }

  const goBack = () => {
    setActiveTab(prevTab)
    window.scrollTo(0, 0)
  }

  return (
    <div className="app-layout">
      <div className="main-view">
        {/* Navigation moved inside main-view to allow normal scrolling */}
        {activeTab !== 'admin' && <Header activeTab={activeTab} setActiveTab={setActiveTab} />}
        
        <main className="main-content" style={{ padding: activeTab === 'admin' ? '0' : '0 24px 100px 24px', flex: 1 }}>
          <div id="youtube-player-global" className={`youtube-container-global ${isFullscreen ? 'visible' : 'hidden'} ${isFullscreen && !isVideoVisible ? 'video-hidden' : ''}`}></div>
          <div id="youtube-player-preload" style={{ position: 'fixed', bottom: 0, right: 0, width: 10, height: 10, opacity: 0, pointerEvents: 'none', zIndex: -1 }}></div>
          
          {activeTab === 'home' && <Home onNavigateToCovers={navigateToCovers} onNavigateToSinger={navigateToSinger} />}
          {activeTab === 'search' && <Search onNavigateToCovers={navigateToCovers} onNavigateToArtist={navigateToArtist} onNavigateToSinger={navigateToSinger} />}
          {activeTab === 'playlist' && <Library onNavigateToCovers={navigateToCovers} onNavigateToSinger={navigateToSinger} />}
          {activeTab === 'song-covers' && (
            <SongCovers
              songTitle={viewingSong}
              onBack={goBack}
              onNavigateToSinger={navigateToSinger}
            />
          )}
          {activeTab === 'artist-songs' && (
            <ArtistSongs
              artistName={viewingArtist}
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
          onClick={() => setActiveTab('admin')}
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
