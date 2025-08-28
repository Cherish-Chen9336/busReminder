import React from 'react'
import ReactDOM from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import './index.css'
import FavoritesPage from './pages/Favorites'
import StopPage from './pages/Stop'

const router = createBrowserRouter([
  { path: '/', element: <FavoritesPage /> },
  { path: '/stop/:id', element: <StopPage /> },
])

// Register service worker (simple)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(console.error)
  })
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
)
