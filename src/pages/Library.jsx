import React, { useState } from 'react'
import { Heart, ListMusic, Plus, Trash2, Play } from 'lucide-react'
import { useCollectionStore } from '../store/useCollectionStore'
import { usePlayerStore } from '../store/usePlayerStore'
import SongCard from '../components/Shared/SongCard'

const Library = ({ onNavigateToCovers, onNavigateToSinger }) => {
  const [activeTab, setActiveTab] = useState('favorites')
  const { favorites, playlists, createPlaylist, deletePlaylist } = useCollectionStore()
  const [newPlaylistName, setNewPlaylistName] = useState('')

  // Favorites display is API-only; without an API hydrate endpoint yet, render as empty.
  const favoriteSongs = []

  const handleCreatePlaylist = (e) => {
    e.preventDefault()
    if (newPlaylistName.trim()) {
      createPlaylist(newPlaylistName.trim())
      setNewPlaylistName('')
    }
  }

  return (
    <div className="library-page">
      <header style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '2rem' }}>コレクション</h1>
      </header>

      <div style={{ display: 'flex', gap: '24px', marginBottom: '32px', borderBottom: '1px solid var(--surface)' }}>
        <TabButton 
          active={activeTab === 'favorites'} 
          onClick={() => setActiveTab('favorites')}
          icon={<Heart size={18} fill={activeTab === 'favorites' ? 'currentColor' : 'none'} />}
          label="お気に入り"
        />
        <TabButton 
          active={activeTab === 'playlists'} 
          onClick={() => setActiveTab('playlists')}
          icon={<ListMusic size={18} />}
          label="プレイリスト"
        />
      </div>

      {activeTab === 'favorites' ? (
        <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
          {favoriteSongs.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '20px' }}>
              {favoriteSongs.map(song => (
                <SongCard
                  key={song.id}
                  song={song}
                  contextSongs={favoriteSongs}
                  onNavigateToCovers={onNavigateToCovers}
                  onNavigateToSinger={onNavigateToSinger}
                />
              ))}
            </div>
          ) : (
            <EmptyState icon={<Heart size={48} />} title="お気に入りはまだありません" description="気になる曲のハートアイコンをタップして追加しましょう。" />
          )}
        </div>
      ) : (
        <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
          <form onClick={handleCreatePlaylist} style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
            <input 
              type="text" 
              placeholder="新しいプレイリスト名"
              value={newPlaylistName}
              onChange={(e) => setNewPlaylistName(e.target.value)}
              style={{
                background: 'var(--surface)',
                border: 'none',
                padding: '12px 16px',
                borderRadius: '8px',
                color: 'white',
                flex: 1
              }}
            />
            <button type="submit" style={{ background: 'var(--primary)', border: 'none', padding: '12px', borderRadius: '8px', color: 'black' }}>
              <Plus size={24} />
            </button>
          </form>

          {playlists.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {playlists.map(playlist => (
                <div key={playlist.id} className="glass" style={{
                  padding: '16px',
                  borderRadius: '12px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ width: '48px', height: '48px', background: 'var(--surface)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <ListMusic size={24} color="var(--primary)" />
                    </div>
                    <div>
                      <div style={{ fontWeight: 'bold' }}>{playlist.name}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{playlist.songIds.length} 曲</div>
                    </div>
                  </div>
                  <button onClick={() => deletePlaylist(playlist.id)} style={{ background: 'none', border: 'none', color: '#ef4444' }}>
                    <Trash2 size={20} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon={<ListMusic size={48} />} title="プレイリストがありません" description="自分だけの最高のプレイリストを作成しましょう。" />
          )}
        </div>
      )}
    </div>
  )
}

const TabButton = ({ active, onClick, icon, label }) => (
  <button onClick={onClick} style={{
    background: 'none',
    border: 'none',
    padding: '12px 4px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    color: active ? 'var(--primary)' : 'var(--text-secondary)',
    borderBottom: active ? '2px solid var(--primary)' : '2px solid transparent',
    transition: 'all 0.2s',
    borderRadius: 0,
    fontWeight: active ? 'bold' : 'normal'
  }}>
    {icon}
    <span>{label}</span>
  </button>
)

const EmptyState = ({ icon, title, description }) => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '40vh', color: 'var(--text-secondary)', textAlign: 'center', padding: '20px' }}>
    <div style={{ marginBottom: '16px', opacity: 0.5 }}>{icon}</div>
    <h3 style={{ color: 'white', marginBottom: '8px' }}>{title}</h3>
    <p style={{ fontSize: '14px', maxWidth: '300px' }}>{description}</p>
  </div>
)

export default Library
