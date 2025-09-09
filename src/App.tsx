import { useState, useEffect } from 'react'
import './App.css'
import { getNearbyStops, getDepartures } from './lib/supabase'

// Enhanced type definitions
interface Stop {
  id: string
  name: string
  code: string
  distance?: number
  isClosest?: boolean
  lat?: number
  lon?: number
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

// Mock data removed - now using Supabase RPC calls

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
  const [closestStop, setClosestStop] = useState<Stop | null>(null)
  const [nearbyStops, setNearbyStops] = useState<Stop[]>([])
  const [departures, setDepartures] = useState<Departure[]>([])
  const [userLocation, setUserLocation] = useState<{lat: number, lon: number} | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Get user location
  useEffect(() => {
    if (navigator.geolocation) {
      console.log('Requesting location permission...')
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords
          console.log('Location obtained:', { lat: latitude, lon: longitude })
          setUserLocation({ lat: latitude, lon: longitude })
        },
        (error) => {
          console.error('Error getting location:', error)
          let errorMessage = '无法获取位置信息'
          switch(error.code) {
            case error.PERMISSION_DENIED:
              errorMessage = '位置访问被拒绝，请在浏览器设置中允许位置访问'
              break
            case error.POSITION_UNAVAILABLE:
              errorMessage = '位置信息不可用'
              break
            case error.TIMEOUT:
              errorMessage = '获取位置超时'
              break
          }
          setError(errorMessage)
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000
        }
      )
    } else {
      setError('浏览器不支持地理位置功能')
    }
  }, [])

  // Load nearby stops when location is available
  useEffect(() => {
    if (userLocation) {
      loadNearbyStops()
    }
  }, [userLocation])

  // Load nearby stops from Supabase
  const loadNearbyStops = async () => {
    if (!userLocation) return
    
    setIsLoading(true)
    setError(null)
    
    try {
      console.log('Loading nearby stops for location:', userLocation)
      const stops = await getNearbyStops(userLocation.lat, userLocation.lon, 1000) as Stop[]
      console.log('Nearby stops received:', stops)
      setNearbyStops(stops)
      
      // Set closest stop
      if (stops.length > 0) {
        const closest = stops.reduce((prev: Stop, current: Stop) => 
          (prev.distance || 0) < (current.distance || 0) ? prev : current
        )
        console.log('Closest stop:', closest)
        setClosestStop(closest)
        loadDepartures(closest.id)
      } else {
        console.log('No nearby stops found')
        setError('附近没有找到公交站点')
      }
    } catch (err) {
      console.error('Error loading nearby stops:', err)
      setError(`加载附近站点失败: ${err instanceof Error ? err.message : '未知错误'}`)
    } finally {
      setIsLoading(false)
    }
  }

  // Load departures for a specific stop
  const loadDepartures = async (stopId: string) => {
    try {
      console.log('Loading departures for stop:', stopId)
      const now = new Date().toISOString()
      console.log('Request time:', now)
      const deps = await getDepartures(stopId, now, 20) as Departure[]
      console.log('Departures received:', deps)
      setDepartures(deps)
    } catch (err) {
      console.error('Error loading departures:', err)
      setError(`加载班次信息失败: ${err instanceof Error ? err.message : '未知错误'}`)
    }
  }

  // Simulate real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      setLastUpdate(new Date())
      if (closestStop) {
        loadDepartures(closestStop.id)
      }
    }, 30000) // Update every 30 seconds

    return () => clearInterval(interval)
  }, [closestStop])

  // Search functionality
  const handleSearch = async (query: string) => {
    setSearchQuery(query)
    if (query.trim().length < 2) {
      setSearchResults([])
      return
    }
    setIsSearching(true)
    
    try {
      console.log('Searching for:', query)
      
      // First try to search in nearby stops
      let results = nearbyStops.filter(stop =>
        stop.name.toLowerCase().includes(query.toLowerCase()) ||
        stop.code.toLowerCase().includes(query.toLowerCase())
      )
      
      console.log('Results from nearby stops:', results)
      
      // If no results from nearby stops and we have a location, try a broader search
      if (results.length === 0 && userLocation) {
        console.log('No nearby results, trying broader search...')
        try {
          const broaderResults = await getNearbyStops(userLocation.lat, userLocation.lon, 5000) as Stop[]
          results = broaderResults.filter(stop =>
            stop.name.toLowerCase().includes(query.toLowerCase()) ||
            stop.code.toLowerCase().includes(query.toLowerCase())
          )
          console.log('Broader search results:', results)
        } catch (err) {
          console.error('Broader search failed:', err)
        }
      }
      
      // If still no results and no location, show a helpful message
      if (results.length === 0) {
        if (!userLocation) {
          setError('请先允许位置访问权限，或点击"Near Me"按钮获取附近站点')
        } else {
          setError('未找到匹配的站点，请尝试其他关键词')
        }
      }
      
      setSearchResults(results)
    } catch (err) {
      console.error('Search error:', err)
      setError('搜索失败')
    } finally {
      setIsSearching(false)
    }
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
    <div className="min-h-screen" style={{ background: 'var(--light-gray)' }}>
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
        {/* Error Display */}
        {error && (
          <div className="card" style={{ margin: '20px', marginTop: '10px', border: '2px solid var(--danger)', backgroundColor: '#fef2f2' }}>
            <div style={{ padding: '16px', color: 'var(--danger)' }}>
              <strong>⚠️ 错误：</strong> {error}
              <button 
                onClick={() => setError(null)}
                style={{ marginLeft: '12px', background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* Loading Display */}
        {isLoading && (
          <div className="card" style={{ margin: '20px', marginTop: '10px', textAlign: 'center' }}>
            <div style={{ padding: '20px' }}>
              <div className="loading-spinner" style={{ margin: '0 auto 16px' }}></div>
              <p style={{ color: 'var(--text-secondary)', margin: 0 }}>正在加载附近站点...</p>
            </div>
          </div>
        )}

        {/* Debug Info */}
        {import.meta.env.DEV && (
          <div className="card" style={{ margin: '20px', marginTop: '10px', fontSize: '12px' }}>
            <div style={{ padding: '16px' }}>
              <h4 style={{ color: 'var(--primary-blue)', margin: '0 0 12px 0' }}>调试信息</h4>
              <p><strong>用户位置:</strong> {userLocation ? `${userLocation.lat.toFixed(6)}, ${userLocation.lon.toFixed(6)}` : '未获取'}</p>
              <p><strong>附近站点数量:</strong> {nearbyStops.length}</p>
              <p><strong>最近站点:</strong> {closestStop ? closestStop.name : '无'}</p>
              <p><strong>班次数量:</strong> {departures.length}</p>
              <p><strong>加载状态:</strong> {isLoading ? '加载中' : '空闲'}</p>
            </div>
          </div>
        )}

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
                {departures.map((dep, index) => (
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
              <div style={{ position: 'relative', flex: 1 }}>
                <input
                  type="text"
                  placeholder="Search for bus station name or area..."
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="search-input"
                  style={{ width: '100%', paddingRight: searchQuery ? '40px' : '16px' }}
                />
                {searchQuery && (
                  <button
                    onClick={() => {
                      setSearchQuery('')
                      setSearchResults([])
                      setError(null)
                    }}
                    style={{
                      position: 'absolute',
                      right: '8px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      fontSize: '18px',
                      padding: '4px'
                    }}
                  >
                    ✕
                  </button>
                )}
              </div>
              <button
                onClick={() => handleSearch(searchQuery)}
                className="btn-primary"
                style={{ minWidth: 'auto', padding: '12px 20px' }}
                disabled={searchQuery.trim().length < 2}
              >
                🔍 Search
              </button>
              <button
                onClick={() => {
                  // Handle "Near Me" functionality
                  if (userLocation) {
                    loadNearbyStops();
                  } else {
                    setError('请先允许位置访问权限');
                    // Try to get location again
                    if (navigator.geolocation) {
                      navigator.geolocation.getCurrentPosition(
                        (position) => {
                          const { latitude, longitude } = position.coords
                          console.log('Manual location obtained:', { lat: latitude, lon: longitude })
                          setUserLocation({ lat: latitude, lon: longitude })
                        },
                        (error) => {
                          console.error('Manual location error:', error)
                          setError('无法获取位置信息，请检查浏览器设置')
                        }
                      )
                    }
                  }
                }}
                className="btn-outline"
                style={{ minWidth: 'auto', padding: '12px 20px' }}
              >
                📍 Near Me
              </button>
            </div>
            
            {isSearching && (
              <div style={{ textAlign: 'center', padding: '20px' }}>
                <div className="loading-spinner"></div>
                <p style={{ color: 'var(--text-secondary)', marginTop: '10px' }}>正在搜索站点...</p>
              </div>
            )}
            
            {!isSearching && searchQuery && searchResults.length === 0 && (
              <div style={{ textAlign: 'center', padding: '20px' }}>
                <p style={{ color: 'var(--text-muted)', margin: 0 }}>
                  {userLocation ? '未找到匹配的站点' : '请先获取位置信息以搜索附近站点'}
                </p>
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
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          onClick={() => loadDepartures(stop.id)}
                          className="btn-outline"
                          style={{ minWidth: 'auto', fontSize: '12px' }}
                        >
                          View Times
                        </button>
                        <button
                          onClick={() => handleAddFavorite(stop)}
                          className="btn-primary"
                          style={{ minWidth: 'auto', fontSize: '12px' }}
                        >
                          Add to Favorites
                        </button>
                      </div>
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
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          onClick={() => loadDepartures(stop.id)}
                          className="btn-primary"
                          style={{ minWidth: 'auto', padding: '8px 16px', fontSize: '12px' }}
                        >
                          View Times
                        </button>
                        <button
                          onClick={() => handleRemoveFavorite(stop.id)}
                          className="btn-secondary"
                          style={{ minWidth: 'auto', padding: '8px 16px', fontSize: '12px' }}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                    
                    {/* Show departures for this stop */}
                    <div style={{ marginTop: '16px' }}>
                      <h5 style={{ color: 'var(--text-primary)', margin: '0 0 12px 0', fontSize: '16px' }}>
                        Upcoming Buses:
                      </h5>
                      {departures.slice(0, 3).map((dep, index) => (
                        <div key={index} style={{ 
                          display: 'flex', 
                          justifyContent: 'space-between', 
                          alignItems: 'center',
                          padding: '8px 0',
                          borderBottom: '1px solid var(--border-light)'
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
                <h3 style={{ color: 'var(--primary-blue)', margin: '0 0 16px 0' }}>About App</h3>
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
                <h3 style={{ color: 'var(--primary-blue)', margin: '0 0 16px 0' }}>PWA Installation</h3>
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
