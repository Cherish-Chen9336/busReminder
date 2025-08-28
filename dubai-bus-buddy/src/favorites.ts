import { create } from 'zustand'

export interface Stop {
  id: string
  name: string
  code: string
}

interface FavState {
  favorites: Stop[]
  add: (s: Stop) => void
  remove: (id: string) => void
  reorder: (from: number, to: number) => void
}

const load = (): Stop[] => {
  try { 
    return JSON.parse(localStorage.getItem('favorites') || '[]') 
  } catch { 
    return [] 
  }
}

const save = (favs: Stop[]) => {
  localStorage.setItem('favorites', JSON.stringify(favs))
}

const useFavs = create<FavState>((set, get) => ({
  favorites: load(),
  add: (s: Stop) => set((st) => {
    const exists = st.favorites.some(f => f.id === s.id)
    const next = exists ? st.favorites : [s, ...st.favorites]
    save(next)
    return { favorites: next }
  }),
  remove: (id: string) => set((st) => {
    const next = st.favorites.filter(f => f.id !== id)
    save(next)
    return { favorites: next }
  }),
  reorder: (from: number, to: number) => set((st) => {
    const next = st.favorites.slice()
    const [item] = next.splice(from, 1)
    next.splice(to, 0, item)
    save(next)
    return { favorites: next }
  }),
}))

export { useFavs }
