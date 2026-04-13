import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useCollectionStore = create(
  persist(
    (set) => ({
      favorites: [], // List of song IDs
      playlists: [], // List of { id, name, songIds: [] }

      toggleFavorite: (songId) => set((state) => {
        const isFavorite = state.favorites.includes(songId)
        return {
          favorites: isFavorite 
            ? state.favorites.filter(id => id !== songId)
            : [...state.favorites, songId]
        }
      }),

      createPlaylist: (name) => set((state) => ({
        playlists: [...state.playlists, { id: Date.now().toString(), name, songIds: [] }]
      })),

      deletePlaylist: (id) => set((state) => ({
        playlists: state.playlists.filter(p => p.id !== id)
      })),

      addSongToPlaylist: (playlistId, songId) => set((state) => ({
        playlists: state.playlists.map(p => 
          p.id === playlistId 
            ? { ...p, songIds: Array.from(new Set([...p.songIds, songId])) }
            : p
        )
      })),

      removeSongFromPlaylist: (playlistId, songId) => set((state) => ({
        playlists: state.playlists.map(p => 
          p.id === playlistId 
            ? { ...p, songIds: p.songIds.filter(id => id !== songId) }
            : p
        )
      })),
    }),
    {
      name: 'covery-collection', // localStorage key
    }
  )
)
