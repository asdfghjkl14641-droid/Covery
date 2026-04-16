import React, { useState, useEffect, useMemo } from 'react'
import { Heart, ListMusic, Plus, Trash2, Play, Loader } from 'lucide-react'
import { useCollectionStore } from '../store/useCollectionStore'
import { usePlayerStore } from '../store/usePlayerStore'
import { fetchSongsBatch } from '../api/client'
import SongCard from '../components/Shared/SongCard'

const Library = ({ onNavigateToCovers, onNavigateToSinger }) => {
  const [activeTab, setActiveTab] = useState('favorites')
  const { favorites, playlists, createPlaylist, deletePlaylist, removeSongFromPlaylist } = useCollectionStore()
  const setQueue = usePlayerStore((state) => state.setQueue)
  const [newPlaylistName, setNewPlaylistName] = useState('')
  const [selectedPlaylistId, setSelectedPlaylistId] = useState(null)

  // Collect all unique song IDs from favorites + playlists
  const allSongIds = useMemo(() => {
    const set = new Set(favorites)
    for (const pl of playlists) {
      for (const id of (pl.songIds || [])) set.add(id)
    }
    return Array.from(set)
  }, [favorites, playlists])

  const [songsById, setSongsById] = useState({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Fetch song data from API whenever IDs change
  const idsKey = useMemo(() => allSongIds.sort((a, b) => a - b).join(','), [allSongIds])
  useEffect(() => {
    let cancelled = false
    if (allSongIds.length === 0) {
      setSongsById({})
      return
    }
    setLoading(true)
    setError(null)
    fetchSongsBatch(allSongIds)
      .then(({ songs }) => {
        if (cancelled) return
        const map = Object.fromEntries(songs.map(s => [s.id, {
          ...s,
          originalArtist: s.artist?.name || '',
          coverCount: s.covers?.length || 0,
        }]))
        setSongsById(map)
      })
      .catch(err => {
        if (!cancelled) setError(err.message || 'fetch failed')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [idsKey])

  const favoriteSongs = favorites.map(id => songsById[id]).filter(Boolean)

  const currentPlaylist = playlists.find(p => p.id === selectedPlaylistId)
  const playlistSongs = currentPlaylist
    ? (currentPlaylist.songIds || []).map(id => songsById[id]).filter(Boolean)
    : []

  const handlePlayAll = (songs) => {
    const tracks = songs
      .map(song => {
        const cover = song.covers?.[0]
        if (!cover?.videoId) return null
        return {
          id: song.id,
          videoId: cover.videoId,
          title: song.title,
          originalArtist: song.originalArtist || song.artist?.name || '',
          singerName: cover.channel?.channelName || cover.channelName || '',
          thumbnailUrl: cover.thumbnailUrl || `https://img.youtube.com/vi/${cover.videoId}/hqdefault.jpg`,
        }
      })
      .filter(Boolean)
    if (tracks.length > 0) setQueue(tracks, 0)
  }

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
          onClick={() => { setActiveTab('favorites'); setSelectedPlaylistId(null) }}
          icon={<Heart size={18} fill={activeTab === 'favorites' ? 'currentColor' : 'none'} />}
          label={`お気に入り (${favorites.length})`}
        />
        <TabButton
          active={activeTab === 'playlists'}
          onClick={() => setActiveTab('playlists')}
          icon={<ListMusic size={18} />}
          label={`プレイリスト (${playlists.length})`}
        />
      </div>

      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
          <Loader size={24} className="spin" style={{ animation: 'spin 1s linear infinite' }} />
        </div>
      )}

      {error && (
        <div style={{ color: '#ef4444', textAlign: 'center', padding: '20px' }}>
          エラー: {error}
        </div>
      )}

      {!loading && !error && activeTab === 'favorites' && (
        <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
          {favoriteSongs.length > 0 ? (
            <>
              <button
                onClick={() => handlePlayAll(favoriteSongs)}
                style={{
                  background: 'var(--primary)', color: 'white', border: 'none',
                  borderRadius: 24, padding: '10px 20px', fontSize: 14, fontWeight: 'bold',
                  display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: '20px',
                }}
              >
                <Play size={18} fill="white" /> 全て再生
              </button>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '20px' }}>
                {favoriteSongs.map(song => (
                  <div key={song.id} style={{ position: 'relative' }}>
                    <SongCard
                      song={song}
                      contextSongs={favoriteSongs}
                      onNavigateToCovers={onNavigateToCovers}
                      onNavigateToSinger={onNavigateToSinger}
                    />
                    {song.covers?.length === 0 && (
                      <div style={{ fontSize: 11, color: '#f59e0b', marginTop: 4, textAlign: 'center' }}>
                        承認済みカバーなし
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          ) : favorites.length > 0 ? (
            <EmptyState icon={<Heart size={48} />} title="読み込み中..." description="" />
          ) : (
            <EmptyState icon={<Heart size={48} />} title="お気に入りはまだありません" description="気になる曲のハートアイコンをタップして追加しましょう。" />
          )}
        </div>
      )}

      {!loading && !error && activeTab === 'playlists' && (
        <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
          {/* Playlist detail view */}
          {selectedPlaylistId && currentPlaylist ? (
            <div>
              <button
                onClick={() => setSelectedPlaylistId(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', marginBottom: 16, fontSize: 14 }}
              >
                ← プレイリスト一覧に戻る
              </button>
              <h2 style={{ fontSize: '1.5rem', marginBottom: 16 }}>{currentPlaylist.name}</h2>
              {playlistSongs.length > 0 ? (
                <>
                  <button
                    onClick={() => handlePlayAll(playlistSongs)}
                    style={{
                      background: 'var(--primary)', color: 'white', border: 'none',
                      borderRadius: 24, padding: '10px 20px', fontSize: 14, fontWeight: 'bold',
                      display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: '20px',
                    }}
                  >
                    <Play size={18} fill="white" /> 全て再生
                  </button>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '20px' }}>
                    {playlistSongs.map(song => (
                      <div key={song.id} style={{ position: 'relative' }}>
                        <SongCard
                          song={song}
                          contextSongs={playlistSongs}
                          onNavigateToCovers={onNavigateToCovers}
                          onNavigateToSinger={onNavigateToSinger}
                        />
                        <button
                          onClick={() => removeSongFromPlaylist(selectedPlaylistId, song.id)}
                          style={{
                            background: 'rgba(239,68,68,0.1)', border: 'none', color: '#ef4444',
                            borderRadius: 8, padding: '4px 8px', fontSize: 11, cursor: 'pointer', marginTop: 4,
                            display: 'block', width: '100%',
                          }}
                        >
                          <Trash2 size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                          削除
                        </button>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <EmptyState icon={<ListMusic size={48} />} title="曲がありません" description="曲のメニューからこのプレイリストに追加しましょう。" />
              )}
            </div>
          ) : (
            <>
              {/* Playlist list view */}
              <form onSubmit={handleCreatePlaylist} style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
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
                      alignItems: 'center',
                      cursor: 'pointer',
                    }}
                      onClick={() => setSelectedPlaylistId(playlist.id)}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <div style={{ width: '48px', height: '48px', background: 'var(--surface)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <ListMusic size={24} color="var(--primary)" />
                        </div>
                        <div>
                          <div style={{ fontWeight: 'bold' }}>{playlist.name}</div>
                          <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{playlist.songIds.length} 曲</div>
                        </div>
                      </div>
                      <button onClick={(e) => { e.stopPropagation(); deletePlaylist(playlist.id) }} style={{ background: 'none', border: 'none', color: '#ef4444' }}>
                        <Trash2 size={20} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState icon={<ListMusic size={48} />} title="プレイリストがありません" description="自分だけの最高のプレイリストを作成しましょう。" />
              )}
            </>
          )}
        </div>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
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
