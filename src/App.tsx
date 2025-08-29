import { useState, useEffect } from 'react'
import './App.css'

// Enhanced type definitions
interface Stop {
  id: string
  name: string
  code: string
  distance?: number
  isClosest?: boolean
}

interface Departure {
  route: string
  headsign: string
  etaMin: number
  scheduled: string
  realtime?: boolean
  direction: 'TO_DUBAI' | 'TO_ABU_DHABI' | 'TO_SHARJAH'
  platform?: string
  status?: 'ON_TIME' | 'DELAYED' | 'EARLY'
}

// Enhanced mock data
const mockStops: Stop[] = [
  { id: 'S1', name: 'Al Jafiliya Bus Station', code: 'AJS', distance: 0.2, isClosest: true },
  { id: 'S2', name: 'Ibn Battuta Metro Bus Stop', code: 'IBM', distance: 1.5 },
  { id: 'S3', name: 'Expo Metro Bus Stop', code: 'EXPO', distance: 3.2 },
  { id: 'S4', name: 'Dubai Mall Bus Stop', code: 'DMB', distance: 2.1 },
  { id: 'S5', name: 'Burj Khalifa Bus Stop', code: 'BKB', distance: 2.3 },
]

const mockDepartures: Departure[] = [
  { route: 'F55', headsign: 'Ibn Battuta', etaMin: 4, scheduled: '14:30', realtime: true, direction: 'TO_ABU_DHABI', platform: 'A', status: 'ON_TIME' },
  { route: 'F55', headsign: 'Expo Metro', etaMin: 18, scheduled: '14:41', direction: 'TO_DUBAI', platform: 'B', status: 'ON_TIME' },
  { route: 'X28', headsign: 'Gold Souq', etaMin: 31, scheduled: '14:54', direction: 'TO_SHARJAH', platform: 'C', status: 'ON_TIME' },
  { route: 'E11', headsign: 'Dubai Mall', etaMin: 7, scheduled: '14:33', realtime: true, direction: 'TO_DUBAI', platform: 'A', status: 'DELAYED' },
  { route: 'E11', headsign: 'Burj Khalifa', etaMin: 22, scheduled: '14:48', direction: 'TO_ABU_DHABI', platform: 'B', status: 'ON_TIME' },
  { route: 'F30', headsign: 'Al Ghubaiba', etaMin: 12, scheduled: '14:38', direction: 'TO_DUBAI', platform: 'C', status: 'ON_TIME' },
]

// Local storage hook
function useLocalStorage<T>(key: string, initialValue: T) {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key)
      return item ? JSON.parse(item) : initialValue
    } catch (error) {
      console.error(error)
      return initialValue
    }
  })

  const setValue = (value: T | ((val: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value
      setStoredValue(valueToStore)
      window.localStorage.setItem(key, JSON.stringify(valueToStore))
    } catch (error) {
      console.error(error)
    }
  }

  return [storedValue, setValue] as const
}

// Main App Component
function App() {
  const [favorites, setFavorites] = useLocalStorage<Stop[]>('favorites', [])
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Stop[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [lastUpdate, setLastUpdate] = useState(new Date())
  const [closestStop] = useState<Stop | null>(mockStops.find(s => s.isClosest) || null)

  // Simulate real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      setLastUpdate(new Date())
    }, 30000) // Update every 30 seconds

    return () => clearInterval(interval)
  }, [])

  // Search functionality
  const handleSearch = (query: string) => {
    setSearchQuery(query)
    if (query.trim().length < 2) {
      setSearchResults([])
      return
    }
    setIsSearching(true)
    
    setTimeout(() => {
      const results = mockStops.filter(stop =>
        stop.name.toLowerCase().includes(query.toLowerCase()) ||
        stop.code.toLowerCase().includes(query.toLowerCase())
      )
      setSearchResults(results)
      setIsSearching(false)
    }, 300)
  }

  // Add to favorites
  const handleAddFavorite = (stop: Stop) => {
    if (!favorites.some(f => f.id === stop.id)) {
      setFavorites([stop, ...favorites])
    }
    setSearchQuery('')
    setSearchResults([])
  }

  // Remove from favorites
  const handleRemoveFavorite = (id: string) => {
    setFavorites(favorites.filter(f => f.id !== id))
  }

  // Get ETA color class
  const getETAColorClass = (etaMin: number) => {
    if (etaMin <= 5) return 'eta-urgent'
    if (etaMin <= 15) return 'eta-soon'
    return 'eta-normal'
  }

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'DELAYED': return 'var(--danger)'
      case 'EARLY': return 'var(--warning)'
      default: return 'var(--success)'
    }
  }

  // Get direction label
  const getDirectionLabel = (direction: string) => {
    switch (direction) {
      case 'TO_DUBAI': return 'TO DUBAI'
      case 'TO_ABU_DHABI': return 'TO ABU DHABI'
      case 'TO_SHARJAH': return 'TO SHARJAH'
      default: return direction
    }
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--dark-bg)' }}>
      {/* Live Status Bar */}
      <div className="status-live" style={{ 
        position: 'fixed', 
        top: 0, 
        left: 0, 
        right: 0, 
        zIndex: 1000,
        borderRadius: 0,
        justifyContent: 'center'
      }}>
        🚌 LIVE - Last updated: {lastUpdate.toLocaleString()}
      </div>

      {/* Main Content */}
      <div style={{ paddingTop: '50px' }}>
        {/* Header */}
        <header className="card" style={{ margin: '20px', marginTop: '10px' }}>
          <div className="card-header">
            🚌 Dubai Bus Buddy - Real-time Transit Information
          </div>
          <div style={{ padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h1 style={{ color: 'var(--primary-blue)', margin: 0, fontSize: '24px' }}>
                Real-time Bus Information
              </h1>
              <p style={{ color: 'var(--text-secondary)', margin: '8px 0 0 0' }}>
                Get live updates on bus arrivals and departures
              </p>
            </div>
            <button 
              className="btn-secondary"
              onClick={() => setIsSettingsOpen(true)}
              style={{ minWidth: 'auto', padding: '12px' }}
            >
              ⚙️
            </button>
          </div>
        </header>

        {/* Closest Station Section */}
        {closestStop && (
          <div className="card" style={{ margin: '20px' }}>
            <div className="card-header">
              📍 Closest Station - {closestStop.name}
            </div>
            <div style={{ padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <div>
                                      <h3 style={{ color: 'var(--primary-blue)', margin: 0, fontSize: '20px' }}>
                      {closestStop.name}
                    </h3>
                  <p style={{ color: 'var(--text-secondary)', margin: '8px 0 0 0' }}>
                    Code: {closestStop.code} • Distance: {closestStop.distance}km
                  </p>
                </div>
                <div className="realtime-indicator">
                  Auto-updating
                </div>
              </div>

              {/* All Bus Departures from Closest Stop */}
              <div className="bus-grid">
                {mockDepartures.map((dep, index) => (
                  <div key={index} className="bus-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <div className="route-badge">
                        {dep.route}
                      </div>
                      <div style={{ 
                        color: getStatusColor(dep.status || 'ON_TIME'),
                        fontSize: '12px',
                        fontWeight: 'bold'
                      }}>
                        {dep.status === 'DELAYED' ? '⚠️ DELAYED' : 
                         dep.status === 'EARLY' ? '⚡ EARLY' : '✅ ON TIME'}
                      </div>
                    </div>
                    
                    <div style={{ marginBottom: '12px' }}>
                      <div style={{ color: 'var(--text-primary)', fontWeight: 'bold', marginBottom: '4px' }}>
                        {dep.headsign}
                      </div>
                      <div style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
                        {getDirectionLabel(dep.direction)} • Platform {dep.platform}
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div className={`eta-display ${getETAColorClass(dep.etaMin)}`}>
                        {dep.etaMin} min
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>
                          Scheduled: {dep.scheduled}
                        </div>
                        {dep.realtime && (
                          <div className="realtime-indicator">
                            Live data
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Search Section - Updated to match image */}
        <div className="card" style={{ margin: '20px' }}>
          <div className="card-header">
            🔍 Search Bus Stops
          </div>
          <div style={{ padding: '20px' }}>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <input
                type="text"
                placeholder="Search for bus station name or area..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="search-input"
                style={{ flex: 1 }}
              />
              <button
                onClick={() => handleSearch(searchQuery)}
                className="btn-primary"
                style={{ minWidth: 'auto', padding: '12px 20px' }}
              >
                🔍 Search
              </button>
              <button
                onClick={() => {
                  // Handle "Near Me" functionality
                  if (closestStop) {
                    handleSearch(closestStop.name);
                  }
                }}
                className="btn-purple"
                style={{ minWidth: 'auto', padding: '12px 20px' }}
              >
                📍 Near Me
              </button>
            </div>
            
            {isSearching && (
              <div style={{ textAlign: 'center', padding: '20px' }}>
                <div className="loading-spinner"></div>
                <p style={{ color: 'var(--text-secondary)', marginTop: '10px' }}>Searching...</p>
              </div>
            )}
            
            {searchResults.length > 0 && (
              <div style={{ marginTop: '20px' }}>
                {searchResults.map((stop) => (
                  <div key={stop.id} className="stop-info">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <h4 style={{ color: 'var(--primary-blue)', margin: '0 0 8px 0' }}>
                          {stop.name}
                        </h4>
                        <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
                          Code: {stop.code} • Distance: {stop.distance}km
                        </p>
                      </div>
                      <button
                        onClick={() => handleAddFavorite(stop)}
                        className="btn-primary"
                        style={{ minWidth: 'auto' }}
                      >
                        Add to Favorites
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Favorites Section */}
        {favorites.length > 0 && (
          <div className="card" style={{ margin: '20px' }}>
            <div className="card-header">
              ⭐ My Favorite Stops
            </div>
            <div style={{ padding: '20px' }}>
              <div className="bus-grid">
                {favorites.map((stop) => (
                  <div key={stop.id} className="stop-info">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                      <div>
                        <h4 style={{ color: 'var(--primary-blue)', margin: '0 0 8px 0' }}>
                          {stop.name}
                        </h4>
                        <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
                          Code: {stop.code}
                        </p>
                      </div>
                      <button
                        onClick={() => handleRemoveFavorite(stop.id)}
                        className="btn-secondary"
                        style={{ minWidth: 'auto', padding: '8px 16px' }}
                      >
                        Remove
                      </button>
                    </div>
                    
                    {/* Show departures for this stop */}
                    <div style={{ marginTop: '16px' }}>
                      <h5 style={{ color: 'var(--text-primary)', margin: '0 0 12px 0', fontSize: '16px' }}>
                        Upcoming Buses:
                      </h5>
                      {mockDepartures.slice(0, 3).map((dep, index) => (
                        <div key={index} style={{ 
                          display: 'flex', 
                          justifyContent: 'space-between', 
                          alignItems: 'center',
                          padding: '8px 0',
                          borderBottom: '1px solid var(--dark-surface)'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div className="route-badge" style={{ fontSize: '14px', padding: '6px 10px' }}>
                              {dep.route}
                            </div>
                            <div>
                              <div style={{ color: 'var(--text-primary)', fontSize: '14px' }}>
                                {dep.headsign}
                              </div>
                              <div style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>
                                {getDirectionLabel(dep.direction)}
                              </div>
                            </div>
                          </div>
                          <div className={`eta-display ${getETAColorClass(dep.etaMin)}`} style={{ fontSize: '18px' }}>
                            {dep.etaMin} min
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Empty State */}
        {favorites.length === 0 && searchResults.length === 0 && !searchQuery && (
          <div className="card" style={{ margin: '20px', textAlign: 'center', padding: '40px 20px' }}>
            <div style={{ fontSize: '64px', marginBottom: '20px' }}>🚌</div>
            <h3 style={{ color: 'var(--primary-blue)', margin: '0 0 16px 0', fontSize: '24px' }}>
              Welcome to Dubai Bus Buddy
            </h3>
            <p style={{ color: 'var(--text-secondary)', margin: '0 0 24px 0', fontSize: '16px' }}>
              Search for bus stops and add them to your favorites to get real-time updates
            </p>
            <button 
              className="btn-primary"
              onClick={() => {
                const searchInput = document.querySelector('.search-input') as HTMLInputElement;
                searchInput?.focus();
              }}
            >
              Start Searching
            </button>
          </div>
        )}
      </div>

      {/* Settings Modal */}
      {isSettingsOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1001,
          padding: '20px'
        }}>
          <div className="card" style={{ maxWidth: '500px', width: '100%', maxHeight: '80vh', overflow: 'auto' }}>
            <div className="card-header">
              ⚙️ Settings
            </div>
            <div style={{ padding: '20px' }}>
              <div style={{ marginBottom: '24px' }}>
                <h3 style={{ color: 'var(--gold-primary)', margin: '0 0 16px 0' }}>About App</h3>
                <div style={{ color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                  <p><strong>Version:</strong> 2.0.0</p>
                  <p><strong>Features:</strong></p>
                  <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>
                    <li>Real-time bus information</li>
                    <li>Closest station detection</li>
                    <li>Favorite stops management</li>
                    <li>PWA support</li>
                    <li>Offline capability</li>
                  </ul>
                </div>
              </div>
              
              <div style={{ marginBottom: '24px' }}>
                <h3 style={{ color: 'var(--gold-primary)', margin: '0 0 16px 0' }}>PWA Installation</h3>
                <p style={{ color: 'var(--text-secondary)', margin: '0 0 16px 0' }}>
                  This app supports PWA installation. Look for the "Add to Home Screen" option in your browser.
                </p>
              </div>

              <button
                onClick={() => setIsSettingsOpen(false)}
                className="btn-primary"
                style={{ width: '100%' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
