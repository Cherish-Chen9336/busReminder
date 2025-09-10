import { useState, useEffect } from 'react'
import './App.css'
import { getNearbyStops, getDepartures, healthCheck, DUBAI_CENTER } from './lib/supabase'

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
  currentStop?: string
  nextStop?: string
}

interface RouteInfo {
  route: string
  headsign: string
  nextDeparture: Departure
  allDepartures: Departure[]
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
  const [departures, setDepartures] = useState<RouteInfo[]>([])
  const [userLocation, setUserLocation] = useState<{lat: number, lon: number} | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [healthStatus, setHealthStatus] = useState<{success: boolean, message: string, data?: any, error?: string} | null>(null)
  const [isHealthChecking, setIsHealthChecking] = useState(false)
  const [useDubaiCenter, setUseDubaiCenter] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'failed' | 'idle'>('idle')
  const [selectedRoute, setSelectedRoute] = useState<any>(null)
  const [showRouteDetail, setShowRouteDetail] = useState(false)

  // Get user location with fallback to Dubai center
  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      console.log('Requesting location permission...')
      setError(null)
      setIsLoading(true)
      
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords
          console.log('Location obtained:', { lat: latitude, lon: longitude })
          setUserLocation({ lat: latitude, lon: longitude })
          setUseDubaiCenter(false)
          setIsLoading(false)
        },
        (error) => {
          console.error('Error getting location:', error)
          let errorMessage = 'Unable to get location information'
          switch(error.code) {
            case error.PERMISSION_DENIED:
              errorMessage = 'Location access denied. Click "Use Dubai Center" to continue with Dubai center coordinates.'
              setUseDubaiCenter(true)
              // Automatically use Dubai center if permission is denied
              setTimeout(() => {
                useDubaiCenterLocation()
              }, 2000)
              break
            case error.POSITION_UNAVAILABLE:
              errorMessage = 'Location information is unavailable. Click "Use Dubai Center" to continue.'
              setUseDubaiCenter(true)
              break
            case error.TIMEOUT:
              errorMessage = 'Location request timed out. Click "Use Dubai Center" to continue.'
              setUseDubaiCenter(true)
              break
          }
          setError(errorMessage)
          setIsLoading(false)
        },
        {
          enableHighAccuracy: false, // Reduce accuracy requirements
          timeout: 10000, // Reduce timeout
          maximumAge: 300000
        }
      )
    } else {
      setError('Geolocation is not supported by this browser. Using Dubai center as fallback.')
      setUseDubaiCenter(true)
      // Automatically use Dubai center if geolocation is not supported
      setTimeout(() => {
        useDubaiCenterLocation()
      }, 1000)
    }
  }

  // Use Dubai center as fallback location
  const useDubaiCenterLocation = () => {
    console.log('Using Dubai center as location:', DUBAI_CENTER)
    setUserLocation(DUBAI_CENTER)
    setUseDubaiCenter(true)
    setError(null)
  }

  useEffect(() => {
    getCurrentLocation()
  }, [])

  // Cleanup search timeout on unmount
  useEffect(() => {
    return () => {
      if (searchTimeout) {
        clearTimeout(searchTimeout)
      }
    }
  }, [])

  // Health check function
  const performHealthCheck = async () => {
    setIsHealthChecking(true)
    setHealthStatus(null)
    
    try {
      console.log('Starting health check...')
      const result = await healthCheck()
      console.log('Health check completed:', result)
      setHealthStatus(result)
      
      // If health check is successful, try to load departures for the first stop
      if (result.success && result.data && Array.isArray(result.data) && result.data.length > 0) {
        const firstStop = result.data[0]
        console.log('Testing departures for first stop:', firstStop)
        if (firstStop.stop_id) {
          try {
            const testDepartures = await getDepartures(firstStop.stop_id, new Date().toISOString(), 5)
            console.log('Test departures result:', testDepartures)
          } catch (depErr) {
            console.error('Test departures failed:', depErr)
          }
        }
      }
    } catch (error) {
      console.error('Health check error:', error)
      setHealthStatus({
        success: false,
        message: 'Health check failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    } finally {
      setIsHealthChecking(false)
    }
  }

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
    setConnectionStatus('connecting')
    
    try {
      console.log('Loading nearby stops for location:', userLocation)
      const stops = await getNearbyStops(userLocation.lat, userLocation.lon, 1000) as Stop[]
      console.log('Nearby stops received:', stops)
      setNearbyStops(stops)
      setConnectionStatus('connected')
      
      // Set closest stop
      if (stops.length > 0) {
        console.log('All stops received:', stops)
        
        // Map Supabase response to our Stop interface
        const mappedStops = stops.map((stop: any) => ({
          id: stop.stop_id,
          name: stop.stop_name,
          code: stop.stop_id, // Use stop_id as code
          distance: stop.distance_m,
          lat: stop.stop_lat,
          lon: stop.stop_lon
        }))
        
        console.log('Mapped stops:', mappedStops)
        setNearbyStops(mappedStops)
        
        const closest = mappedStops.reduce((prev, current) => 
          (prev.distance || 0) < (current.distance || 0) ? prev : current
        )
        console.log('Closest stop details:', closest)
        console.log('Closest stop ID:', closest.id)
        
        if (closest.id) {
          setClosestStop(closest)
          loadDepartures(closest.id)
        } else {
          console.error('Closest stop has no ID:', closest)
          setError('Invalid stop data received from server')
        }
      } else {
        console.log('No nearby stops found')
        setError('No bus stops found nearby')
      }
    } catch (err) {
      console.error('Error loading nearby stops:', err)
      setConnectionStatus('failed')
      setError(`Failed to load nearby stops: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setIsLoading(false)
    }
  }

  // Load departures for a specific stop
  const loadDepartures = async (stopId: string) => {
    if (!stopId) {
      console.error('Cannot load departures: stopId is undefined or empty')
      return
    }
    
    try {
      console.log('Loading departures for stop:', stopId)
      const now = new Date().toISOString()
      console.log('Request time:', now)
      const deps = await getDepartures(stopId, now, 20) as any[]
      console.log('Raw departures received:', deps)
      console.log('Departures type:', typeof deps)
      console.log('Departures length:', Array.isArray(deps) ? deps.length : 'Not an array')
      
      if (Array.isArray(deps) && deps.length > 0) {
        console.log('First departure:', deps[0])
        // Map the data to our Departure interface based on actual Supabase response structure
        const mappedDepartures = deps.map((dep: any) => ({
          route: dep.route_name || dep.route_id || dep.route || 'Unknown',
          headsign: dep.headsign || dep.destination || dep.headsign_text || dep.trip_headsign || 'Unknown Destination',
          etaMin: dep.eta_minutes || dep.eta_min || dep.eta || 0,
          scheduled: dep.planned_time || dep.scheduled_time || dep.scheduled || 'Unknown',
          status: dep.status || 'ON_TIME',
          direction: dep.direction || dep.trip_direction || 'Unknown',
          platform: dep.platform || dep.platform_number || dep.stop_platform || 'Unknown',
          realtime: dep.realtime || dep.is_realtime || false,
          currentStop: dep.current_stop || dep.current_stop_name || dep.last_stop || 'Unknown',
          nextStop: dep.next_stop || dep.next_stop_name || 'Unknown'
        }))
        
        // Filter to show only departures within next 2 hours (120 minutes)
        const filteredDepartures = mappedDepartures.filter(dep => dep.etaMin <= 120)
        
        // Group by route to show unique routes
        const uniqueRoutes = new Map()
        filteredDepartures.forEach(dep => {
          if (!uniqueRoutes.has(dep.route)) {
            uniqueRoutes.set(dep.route, {
              route: dep.route,
              headsign: dep.headsign,
              nextDeparture: dep,
              allDepartures: []
            })
          }
          uniqueRoutes.get(dep.route).allDepartures.push(dep)
        })
        
        // Convert to array and sort by next departure time
        const routeList = Array.from(uniqueRoutes.values()).sort((a, b) => 
          a.nextDeparture.etaMin - b.nextDeparture.etaMin
        )
        
        console.log('Mapped departures:', mappedDepartures)
        console.log('Filtered departures (next 2 hours):', filteredDepartures)
        console.log('Unique routes:', routeList)
        setDepartures(routeList)
      } else {
        console.log('No departures found for this stop')
        setDepartures([])
      }
    } catch (err) {
      console.error('Error loading departures:', err)
      setError(`Failed to load departure times: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }

  // Simulate real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      setLastUpdate(new Date())
      if (closestStop && closestStop.id) {
        loadDepartures(closestStop.id)
      }
    }, 30000) // Update every 30 seconds

    return () => clearInterval(interval)
  }, [closestStop])

  // Search functionality with debouncing
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
        (stop.name && stop.name.toLowerCase().includes(query.toLowerCase())) ||
        (stop.code && stop.code.toLowerCase().includes(query.toLowerCase()))
      )
      
      console.log('Results from nearby stops:', results)
      
      // If no results from nearby stops and we have a location, try a broader search
      if (results.length === 0 && userLocation) {
        console.log('No nearby results, trying broader search...')
        try {
          const broaderResults = await getNearbyStops(userLocation.lat, userLocation.lon, 5000) as any[]
          // Map Supabase response to our Stop interface
          const mappedBroaderResults = broaderResults.map((stop: any) => ({
            id: stop.stop_id,
            name: stop.stop_name,
            code: stop.stop_id,
            distance: stop.distance_m,
            lat: stop.stop_lat,
            lon: stop.stop_lon
          }))
          results = mappedBroaderResults.filter(stop =>
            (stop.name && stop.name.toLowerCase().includes(query.toLowerCase())) ||
            (stop.code && stop.code.toLowerCase().includes(query.toLowerCase()))
          )
          console.log('Broader search results:', results)
        } catch (err) {
          console.error('Broader search failed:', err)
        }
      }
      
      // If still no results and no location, show a helpful message
      if (results.length === 0) {
        if (!userLocation) {
          setError('Please allow location access first, or click "Near Me" button to get nearby stops')
        } else {
          setError('No matching stops found, please try different keywords')
        }
      }
      
      setSearchResults(results)
    } catch (err) {
      console.error('Search error:', err)
      setError('Search failed')
    } finally {
      setIsSearching(false)
    }
  }

  // Debounced search function
  const [searchTimeout, setSearchTimeout] = useState<number | null>(null)
  
  const handleSearchInput = (query: string) => {
    setSearchQuery(query)
    
    // Clear existing timeout
    if (searchTimeout) {
      clearTimeout(searchTimeout)
    }
    
    // Set new timeout for search
    const timeout = setTimeout(() => {
      if (query.trim().length >= 2) {
        handleSearch(query)
      } else {
        setSearchResults([])
      }
    }, 500) // Wait 500ms after user stops typing
    
    setSearchTimeout(timeout)
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
        justifyContent: 'center',
        display: 'flex',
        alignItems: 'center',
        gap: '12px'
      }}>
        <span>🚌 LIVE - Last updated: {lastUpdate.toLocaleString()}</span>
        <span style={{ 
          padding: '2px 8px', 
          borderRadius: '12px', 
          fontSize: '12px',
          backgroundColor: connectionStatus === 'connected' ? 'var(--success)' : 
                          connectionStatus === 'connecting' ? 'var(--warning)' : 
                          connectionStatus === 'failed' ? 'var(--danger)' : 'var(--text-muted)',
          color: 'white'
        }}>
          {connectionStatus === 'connected' ? '🟢 Connected' : 
           connectionStatus === 'connecting' ? '🟡 Connecting...' : 
           connectionStatus === 'failed' ? '🔴 Connection Failed' : '⚪ Idle'}
        </span>
      </div>

      {/* Main Content */}
      <div style={{ paddingTop: '50px' }}>
        {/* Error Display */}
        {error && (
          <div className="card" style={{ margin: '20px', marginTop: '10px', border: '2px solid var(--danger)', backgroundColor: '#fef2f2' }}>
            <div style={{ padding: '16px', color: 'var(--danger)' }}>
              <strong>⚠️ Error:</strong> {error}
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
              <p style={{ color: 'var(--text-secondary)', margin: 0 }}>Loading nearby stops...</p>
            </div>
          </div>
        )}

        {/* Health Check */}
        <div className="card" style={{ margin: '20px', marginTop: '10px' }}>
          <div className="card-header">
            🔧 System Health Check
          </div>
          <div style={{ padding: '20px' }}>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '16px' }}>
              <button
                onClick={performHealthCheck}
                disabled={isHealthChecking}
                className="btn-primary"
                style={{ minWidth: 'auto' }}
              >
                {isHealthChecking ? 'Checking...' : 'Test Supabase Connection'}
              </button>
              <button
                onClick={async () => {
                  if (closestStop && closestStop.id) {
                    console.log('Testing departures for closest stop:', closestStop.id)
                    try {
                      const testResult = await getDepartures(closestStop.id, new Date().toISOString(), 5)
                      console.log('Direct departures test result:', testResult)
                      alert(`Departures test result: ${JSON.stringify(testResult, null, 2)}`)
                    } catch (err) {
                      console.error('Direct departures test failed:', err)
                      alert(`Departures test failed: ${err}`)
                    }
                  } else {
                    alert('No closest stop available for testing')
                  }
                }}
                className="btn-outline"
                style={{ minWidth: 'auto' }}
              >
                🚌 Test Departures
              </button>
              {useDubaiCenter && (
                <button
                  onClick={useDubaiCenterLocation}
                  className="btn-outline"
                  style={{ minWidth: 'auto' }}
                >
                  Use Dubai Center
                </button>
              )}
            </div>
            
            {healthStatus && (
              <div style={{ 
                padding: '12px', 
                borderRadius: '8px', 
                backgroundColor: healthStatus.success ? '#f0f9ff' : '#fef2f2',
                border: `1px solid ${healthStatus.success ? 'var(--success)' : 'var(--danger)'}`,
                fontSize: '14px'
              }}>
                <div style={{ 
                  color: healthStatus.success ? 'var(--success)' : 'var(--danger)',
                  fontWeight: 'bold',
                  marginBottom: '8px'
                }}>
                  {healthStatus.success ? '✅' : '❌'} {healthStatus.message}
                </div>
                {healthStatus.error && (
                  <div style={{ color: 'var(--danger)', fontSize: '12px', marginTop: '4px' }}>
                    Error: {healthStatus.error}
                  </div>
                )}
                {healthStatus.data && (
                  <details style={{ marginTop: '8px' }}>
                    <summary style={{ cursor: 'pointer', fontWeight: 'bold' }}>View Response Data</summary>
                    <pre style={{ 
                      marginTop: '8px', 
                      padding: '8px', 
                      backgroundColor: '#f8fafc', 
                      borderRadius: '4px',
                      fontSize: '11px',
                      overflow: 'auto',
                      maxHeight: '200px'
                    }}>
                      {JSON.stringify(healthStatus.data, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Debug Info */}
        {import.meta.env.DEV && (
          <div className="card" style={{ margin: '20px', marginTop: '10px', fontSize: '12px' }}>
            <div style={{ padding: '16px' }}>
              <h4 style={{ color: 'var(--primary-blue)', margin: '0 0 12px 0' }}>Debug Info</h4>
              <p><strong>User Location:</strong> {userLocation ? `${userLocation.lat.toFixed(6)}, ${userLocation.lon.toFixed(6)}` : 'Not obtained'}</p>
              <p><strong>Using Dubai Center:</strong> {useDubaiCenter ? 'Yes' : 'No'}</p>
              <p><strong>Nearby Stops Count:</strong> {nearbyStops.length}</p>
              <p><strong>Closest Stop:</strong> {closestStop ? closestStop.name : 'None'}</p>
              <p><strong>Departures Count:</strong> {departures.length}</p>
              <p><strong>Loading Status:</strong> {isLoading ? 'Loading' : 'Idle'}</p>
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

        {/* Route Detail Modal */}
        {showRouteDetail && selectedRoute && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            zIndex: 2000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}>
            <div style={{
              backgroundColor: 'white',
              borderRadius: '12px',
              width: '100%',
              maxWidth: '800px',
              maxHeight: '90vh',
              overflow: 'auto',
              position: 'relative'
            }}>
              {/* Header */}
              <div style={{
                padding: '20px',
                borderBottom: '1px solid var(--border-light)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div>
                  <h2 style={{ margin: 0, color: 'var(--primary-blue)' }}>
                    Route {selectedRoute.route}
                  </h2>
                  <p style={{ margin: '4px 0 0 0', color: 'var(--text-secondary)' }}>
                    To: {selectedRoute.headsign}
                  </p>
                  <div style={{ marginTop: '8px', fontSize: '14px', color: 'var(--text-muted)' }}>
                    <span style={{ color: 'var(--success)', fontWeight: 'bold' }}>Dubai Mall</span>
                    <span style={{ margin: '0 8px' }}>→</span>
                    <span style={{ color: 'var(--text-secondary)' }}>25 stops</span>
                    <span style={{ margin: '0 8px' }}>→</span>
                    <span style={{ color: 'var(--danger)', fontWeight: 'bold' }}>JBR Beach</span>
                  </div>
                </div>
                <button
                  onClick={() => setShowRouteDetail(false)}
                  style={{
                    background: 'none',
                    border: 'none',
                    fontSize: '24px',
                    cursor: 'pointer',
                    color: 'var(--text-muted)'
                  }}
                >
                  ✕
                </button>
              </div>

              {/* Route Map */}
              <div style={{ padding: '20px' }}>
                <h3 style={{ margin: '0 0 16px 0', color: 'var(--primary-blue)' }}>
                  Route Map
                </h3>
                <div style={{
                  height: '300px',
                  backgroundColor: 'var(--light-gray)',
                  borderRadius: '8px',
                  position: 'relative',
                  overflow: 'hidden'
                }}>
                  {/* Scrollable Route Container */}
                  <div style={{
                    height: '100%',
                    overflowX: 'auto',
                    overflowY: 'hidden',
                    padding: '20px 0'
                  }}>
                    <div style={{
                      width: '4000px',
                      height: '120px',
                      position: 'relative',
                      display: 'flex',
                      alignItems: 'center'
                    }}>
                      {/* Horizontal Route Line */}
                      <div style={{
                        width: '100%',
                        height: '4px',
                        backgroundColor: 'var(--primary-blue)',
                        position: 'absolute',
                        top: '50%',
                        transform: 'translateY(-50%)'
                      }}>
                        {/* Bus Position Indicator - Static at current stop */}
                        <div style={{
                          position: 'absolute',
                          top: '-20px',
                          left: '1400px', // Position at Palm Jumeirah (current stop)
                          width: '32px',
                          height: '32px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '24px',
                          zIndex: 10
                        }}>
                          🚌
                        </div>
                      </div>
                      
                      {/* Route Stops - All 25 stops with wider spacing */}
                      {[
                        { name: 'Dubai Mall', position: 50, isTransfer: true, transferRoutes: ['F11', 'F12', 'F15'], isCurrent: false },
                        { name: 'Burj Khalifa', position: 200, isTransfer: false, isCurrent: false },
                        { name: 'Downtown Dubai', position: 350, isTransfer: true, transferRoutes: ['F15', 'F20', 'F25'], isCurrent: false },
                        { name: 'Business Bay', position: 500, isTransfer: false, isCurrent: false },
                        { name: 'Dubai Marina', position: 650, isTransfer: true, transferRoutes: ['F25', 'F30', 'F35'], isCurrent: false },
                        { name: 'JBR', position: 800, isTransfer: false, isCurrent: false },
                        { name: 'Palm Jumeirah', position: 1400, isTransfer: true, transferRoutes: ['F35', 'F40', 'F45'], isCurrent: true }, // Current stop
                        { name: 'Dubai Hills', position: 1550, isTransfer: false, isCurrent: false },
                        { name: 'Dubai Sports City', position: 1700, isTransfer: true, transferRoutes: ['F45', 'F50', 'F55'], isCurrent: false },
                        { name: 'Dubai Investment Park', position: 1850, isTransfer: false, isCurrent: false },
                        { name: 'Dubai Silicon Oasis', position: 2000, isTransfer: true, transferRoutes: ['F55', 'F60', 'F65'], isCurrent: false },
                        { name: 'Dubai International City', position: 2150, isTransfer: false, isCurrent: false },
                        { name: 'Dubai Festival City', position: 2300, isTransfer: true, transferRoutes: ['F65', 'F70', 'F75'], isCurrent: false },
                        { name: 'Dubai Healthcare City', position: 2450, isTransfer: false, isCurrent: false },
                        { name: 'Dubai Creek', position: 2600, isTransfer: true, transferRoutes: ['F75', 'F80', 'F85'], isCurrent: false },
                        { name: 'Dubai Gold Souk', position: 2750, isTransfer: false, isCurrent: false },
                        { name: 'Dubai Spice Souk', position: 2900, isTransfer: true, transferRoutes: ['F85', 'F90', 'F95'], isCurrent: false },
                        { name: 'Dubai Fish Market', position: 3050, isTransfer: false, isCurrent: false },
                        { name: 'Dubai Port', position: 3200, isTransfer: true, transferRoutes: ['F95', 'F100', 'F105'], isCurrent: false },
                        { name: 'Dubai Airport', position: 3350, isTransfer: false, isCurrent: false },
                        { name: 'Dubai Cargo Village', position: 3500, isTransfer: true, transferRoutes: ['F105', 'F110', 'F115'], isCurrent: false },
                        { name: 'Dubai Logistics City', position: 3650, isTransfer: false, isCurrent: false },
                        { name: 'Dubai World Central', position: 3800, isTransfer: true, transferRoutes: ['F115', 'F120', 'F125'], isCurrent: false },
                        { name: 'Dubai South', position: 3950, isTransfer: false, isCurrent: false },
                        { name: 'JBR Beach', position: 3950, isTransfer: false, isCurrent: false }
                      ].map((stop, index) => (
                        <div key={index} style={{
                          position: 'absolute',
                          left: `${stop.position}px`,
                          top: '50%',
                          transform: 'translateY(-50%)',
                          textAlign: 'center',
                          zIndex: stop.isCurrent ? 10 : 5
                        }}>
                          {/* Stop Marker - On the route line */}
                          <div style={{
                            width: stop.isCurrent ? '16px' : '12px',
                            height: stop.isCurrent ? '16px' : '12px',
                            backgroundColor: stop.isCurrent ? 'var(--success)' : 
                                           stop.isTransfer ? 'var(--warning)' : 'var(--primary-blue)',
                            borderRadius: '50%',
                            margin: '0 auto',
                            border: stop.isCurrent ? '3px solid white' : '2px solid white',
                            boxShadow: stop.isCurrent ? '0 4px 8px rgba(0,0,0,0.3)' : '0 2px 4px rgba(0,0,0,0.2)',
                            animation: stop.isCurrent ? 'pulse 2s infinite' : 'none',
                            position: 'relative',
                            top: '0px' // On the route line
                          }}></div>
                          
                          {/* Stop Name - Below the point */}
                          <div style={{
                            fontSize: '10px',
                            color: stop.isCurrent ? 'var(--success)' : 'var(--text-primary)',
                            fontWeight: stop.isCurrent ? 'bold' : 'normal',
                            marginTop: '12px',
                            backgroundColor: 'rgba(255,255,255,0.95)',
                            padding: '4px 6px',
                            borderRadius: '4px',
                            border: stop.isCurrent ? '2px solid var(--success)' : '1px solid var(--border-light)',
                            whiteSpace: 'nowrap',
                            maxWidth: '80px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}>
                            {stop.name}
                          </div>
                          
                          {/* Transfer Info - Below the name */}
                          {stop.isTransfer && stop.transferRoutes && (
                            <div style={{
                              fontSize: '8px',
                              fontWeight: 'bold',
                              marginTop: '4px',
                              backgroundColor: 'var(--warning)',
                              color: 'white',
                              padding: '2px 4px',
                              borderRadius: '3px',
                              display: 'flex',
                              gap: '2px',
                              flexWrap: 'wrap',
                              justifyContent: 'center'
                            }}>
                              {stop.transferRoutes.map((route, routeIndex) => (
                                <span key={routeIndex}>{route}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Route Legend */}
                <div style={{ marginTop: '20px', padding: '12px', backgroundColor: 'var(--light-gray)', borderRadius: '8px' }}>
                  <h4 style={{ margin: '0 0 12px 0', color: 'var(--primary-blue)', fontSize: '14px' }}>
                    Route Map Legend
                  </h4>
                  <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <div style={{ width: '12px', height: '12px', backgroundColor: 'var(--primary-blue)', borderRadius: '50%' }}></div>
                      <span style={{ fontSize: '12px' }}>Regular Stop</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <div style={{ width: '12px', height: '12px', backgroundColor: 'var(--warning)', borderRadius: '50%' }}></div>
                      <span style={{ fontSize: '12px' }}>Transfer Stop</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <div style={{ width: '16px', height: '16px', backgroundColor: 'var(--success)', borderRadius: '50%', animation: 'pulse 2s infinite' }}></div>
                      <span style={{ fontSize: '12px' }}>Current Stop</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '16px' }}>🚌</span>
                      <span style={{ fontSize: '12px' }}>Bus Position</span>
                    </div>
                  </div>
                </div>

                {/* Route Information */}
                <div style={{ marginTop: '20px' }}>
                  <h4 style={{ margin: '0 0 12px 0', color: 'var(--primary-blue)' }}>
                    Route Information
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div>
                      <strong>Operating Hours:</strong><br />
                      <span style={{ color: 'var(--text-secondary)' }}>06:00 - 23:00</span>
                    </div>
                    <div>
                      <strong>Fare:</strong><br />
                      <span style={{ color: 'var(--text-secondary)' }}>AED 3.00</span>
                    </div>
                    <div>
                      <strong>Frequency:</strong><br />
                      <span style={{ color: 'var(--text-secondary)' }}>Every 15-20 minutes</span>
                    </div>
                    <div>
                      <strong>Total Stops:</strong><br />
                      <span style={{ color: 'var(--text-secondary)' }}>25 stops</span>
                    </div>
                  </div>
                </div>

                {/* All Departures */}
                <div style={{ marginTop: '20px' }}>
                  <h4 style={{ margin: '0 0 12px 0', color: 'var(--primary-blue)' }}>
                    All Departures (Next 2 Hours)
                  </h4>
                  <div style={{ maxHeight: '200px', overflow: 'auto' }}>
                    {selectedRoute.allDepartures.map((dep: any, index: number) => (
                      <div key={index} style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '12px',
                        borderBottom: '1px solid var(--border-light)',
                        backgroundColor: index % 2 === 0 ? 'var(--light-gray)' : 'white'
                      }}>
                        <div>
                          <span style={{ fontWeight: 'bold' }}>{dep.etaMin} min</span>
                          <span style={{ marginLeft: '8px', color: 'var(--text-secondary)' }}>
                            {dep.scheduled}
                          </span>
                        </div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                          {dep.status === 'DELAYED' ? '⚠️ DELAYED' : 
                           dep.status === 'EARLY' ? '⚡ EARLY' : '✅ ON TIME'}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

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
              {departures.length > 0 ? (
                <div>
                  <div style={{ 
                    marginBottom: '16px', 
                    padding: '12px', 
                    backgroundColor: 'var(--info)', 
                    color: 'white', 
                    borderRadius: '8px',
                    fontSize: '14px',
                    textAlign: 'center'
                  }}>
                    📍 Showing next 2 hours of departures from this stop
                  </div>
                  
                  {/* All Bus Routes Passing This Stop */}
                  <div style={{ 
                    marginBottom: '16px', 
                    padding: '12px', 
                    backgroundColor: 'var(--light-gray)', 
                    borderRadius: '8px',
                    fontSize: '14px'
                  }}>
                    <h4 style={{ margin: '0 0 8px 0', color: 'var(--primary-blue)', fontSize: '14px' }}>
                      All Bus Routes Passing This Stop:
                    </h4>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {['F11', 'F12', 'F15', 'F20', 'F25', 'F30', 'F35', 'F40', 'F45', 'F50', 'F55', 'F60', 'F65', 'F70', 'F75', 'F80', 'F85', 'F90', 'F95', 'F100', 'F105', 'F110', 'F115', 'F120', 'F125'].map((route, index) => (
                        <span key={index} style={{
                          backgroundColor: 'var(--primary-blue)',
                          color: 'white',
                          padding: '4px 8px',
                          borderRadius: '12px',
                          fontSize: '12px',
                          fontWeight: 'bold'
                        }}>
                          {route}
                        </span>
                      ))}
                    </div>
                  </div>
              <div className="bus-grid">
                  {departures.map((route, index) => (
                  <div 
                    key={index} 
                    className="bus-card"
                    onClick={() => {
                      setSelectedRoute(route)
                      setShowRouteDetail(true)
                    }}
                    style={{ cursor: 'pointer' }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <div className="route-badge">
                        {route.route}
                      </div>
                      <div style={{ 
                        color: getStatusColor(route.nextDeparture.status || 'ON_TIME'),
                        fontSize: '12px',
                        fontWeight: 'bold'
                      }}>
                        {route.nextDeparture.status === 'DELAYED' ? '⚠️ DELAYED' : 
                         route.nextDeparture.status === 'EARLY' ? '⚡ EARLY' : '✅ ON TIME'}
                      </div>
                    </div>
                    
                    <div style={{ marginBottom: '12px' }}>
                      <div style={{ color: 'var(--text-primary)', fontWeight: 'bold', marginBottom: '4px' }}>
                          To: {route.headsign}
                      </div>
                        <div style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '4px' }}>
                          {getDirectionLabel(route.nextDeparture.direction)} • Platform {route.nextDeparture.platform}
                        </div>
                        {route.nextDeparture.currentStop && route.nextDeparture.currentStop !== 'Unknown' && (
                          <div style={{ color: 'var(--info)', fontSize: '12px', fontStyle: 'italic' }}>
                            Currently at: {route.nextDeparture.currentStop}
                      </div>
                        )}
                        <div style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '4px' }}>
                          {route.allDepartures.length} departures in next 2 hours
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div className={`eta-display ${getETAColorClass(route.nextDeparture.etaMin)}`}>
                        {route.nextDeparture.etaMin} min
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>
                          Next: {route.nextDeparture.scheduled}
                        </div>
                        {route.nextDeparture.realtime && (
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
              ) : (
                <div style={{ 
                  textAlign: 'center', 
                  padding: '40px 20px',
                  color: 'var(--text-muted)'
                }}>
                  <div style={{ fontSize: '48px', marginBottom: '16px' }}>🚌</div>
                  <h3 style={{ color: 'var(--text-secondary)', margin: '0 0 8px 0' }}>
                    No Bus Departures Found
                  </h3>
                  <p style={{ margin: 0, fontSize: '14px' }}>
                    No buses are currently scheduled to depart from this stop.
                    <br />
                    Try refreshing or check back later.
                  </p>
                </div>
              )}
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
                  onChange={(e) => handleSearchInput(e.target.value)}
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
                    getCurrentLocation();
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
                <p style={{ color: 'var(--text-secondary)', marginTop: '10px' }}>Searching for stops...</p>
              </div>
            )}
            
            {!isSearching && searchQuery && searchResults.length === 0 && (
              <div style={{ textAlign: 'center', padding: '20px' }}>
                <p style={{ color: 'var(--text-muted)', margin: 0 }}>
                  {userLocation ? 'No matching stops found' : 'Please get location first to search nearby stops'}
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
                      {departures.slice(0, 3).map((route, index) => (
                        <div key={index} style={{ 
                          display: 'flex', 
                          justifyContent: 'space-between', 
                          alignItems: 'center',
                          padding: '8px 0',
                          borderBottom: '1px solid var(--border-light)'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div className="route-badge" style={{ fontSize: '14px', padding: '6px 10px' }}>
                              {route.route}
                            </div>
                            <div>
                              <div style={{ color: 'var(--text-primary)', fontSize: '14px' }}>
                                {route.headsign}
                              </div>
                              <div style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>
                                {getDirectionLabel(route.nextDeparture.direction || 'TO_DUBAI')}
                              </div>
                            </div>
                          </div>
                          <div className={`eta-display ${getETAColorClass(route.nextDeparture.etaMin || 0)}`} style={{ fontSize: '18px' }}>
                            {route.nextDeparture.etaMin || 0} min
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
