import { useState, useEffect } from 'react'
import './App.css'
import { getNearbyStops, getDepartures, healthCheck, DUBAI_CENTER } from './lib/supabase'
import { realtimeTracker } from './lib/realtime'
import type { BusPosition } from './lib/realtime'
import { notificationService } from './lib/notifications'
import { shareService } from './lib/share'
import { RouteQuery } from './components/RouteQuery'

// Enhanced type definitions
interface Stop {
  id: string
  name: string
  code: string
  distance?: number
  isClosest?: boolean
  lat?: number
  lon?: number
  type?: 'station' | 'route'
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

// Using real data from Supabase RPC calls

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
  const [isRouteQueryOpen, setIsRouteQueryOpen] = useState(false)
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
  const [realtimeBuses, setRealtimeBuses] = useState<BusPosition[]>([])
  const [isRealtimeActive] = useState(true)
  // Removed F11 route stops state as it was causing errors

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
    // Removed automatic F11 loading to prevent errors on startup
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
      const stops = await getNearbyStops(userLocation.lat, userLocation.lon, 5000) as Stop[]
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
        setDepartures([]) // Clear departures when no stops found
      }
    } catch (err) {
      console.error('Error loading nearby stops:', err)
      setConnectionStatus('failed')
      setError(`Failed to load nearby stops: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setIsLoading(false)
    }
  }

  // Removed loadF11RouteStops function as it was causing errors

  // Load departures for a specific stop
  const loadDepartures = async (stopId: string) => {
    if (!stopId) {
      console.error('Cannot load departures: stopId is undefined or empty')
      return
    }
    
    setIsLoading(true)
    setError(null)
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
          route: dep.route_name || dep.route_id || 'Unknown',
          headsign: dep.headsign || dep.trip_headsign || 'Unknown Destination',
          etaMin: dep.eta_minutes || 0,
          scheduled: dep.departure_time || dep.arrival_time || 'Unknown',
          status: dep.status || 'ON_TIME',
          direction: dep.direction || 'Unknown',
          platform: dep.platform || 'Unknown',
          realtime: dep.realtime || false,
          currentStop: dep.current_stop || 'Unknown',
          nextStop: dep.next_stop || 'Unknown'
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
        let routeList = Array.from(uniqueRoutes.values()).sort((a, b) => 
          a.nextDeparture.etaMin - b.nextDeparture.etaMin
        )
        
        // Only show real data from Supabase - no mock data
        
        console.log('Mapped departures:', mappedDepartures)
        console.log('Filtered departures (next 2 hours):', filteredDepartures)
        console.log('Final route list with real data:', routeList)
        setDepartures(routeList ?? [])
      } else {
        console.log('No departures found for this stop')
        setDepartures([])
        // Don't set error here, just show empty state
      }
    } catch (err) {
      console.error('Error loading departures:', err)
      setDepartures([])
      setError(`Failed to load departure times: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setIsLoading(false)
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

  // Real-time bus position tracking
  useEffect(() => {
    if (isRealtimeActive) {
      // Start real-time updates
      realtimeTracker.startUpdates()
      
      // Subscribe to real-time data updates
      const unsubscribe = realtimeTracker.subscribe((buses) => {
        setRealtimeBuses(buses)
      })
      
      // Get initial data
      setRealtimeBuses(realtimeTracker.getCurrentBuses())
      
      return () => {
        unsubscribe()
        realtimeTracker.stopUpdates()
      }
    } else {
      realtimeTracker.stopUpdates()
      setRealtimeBuses([])
    }
  }, [isRealtimeActive])

  // Enhanced search functionality with routes and stations
  const handleSearch = async (query: string) => {
    setSearchQuery(query)
    if (query.trim().length < 2) {
      setSearchResults([])
      return
    }
    setIsSearching(true)
    
    try {
      console.log('Searching for:', query)
      
      // Search in nearby stops
      let stopResults = nearbyStops.filter(stop =>
        (stop.name && stop.name.toLowerCase().includes(query.toLowerCase())) ||
        (stop.code && stop.code.toLowerCase().includes(query.toLowerCase()))
      )
      
      // Search in available routes - only show real routes from Supabase data
      const routeResults: Stop[] = []
      
      // If no results from nearby stops and we have a location, try a broader search
      if (stopResults.length === 0 && userLocation) {
        console.log('No nearby results, trying broader search...')
        try {
          const broaderResults = await getNearbyStops(userLocation.lat, userLocation.lon, 5000) as any[]
          const mappedBroaderResults = broaderResults.map((stop: any) => ({
            id: stop.stop_id,
            name: stop.stop_name,
            code: stop.stop_id,
            distance: stop.distance_m,
            lat: stop.stop_lat,
            lon: stop.stop_lon,
            type: 'station' as const
          }))
          stopResults = mappedBroaderResults.filter(stop =>
            (stop.name && stop.name.toLowerCase().includes(query.toLowerCase())) ||
            (stop.code && stop.code.toLowerCase().includes(query.toLowerCase()))
          )
          console.log('Broader search results:', stopResults)
        } catch (err) {
          console.error('Broader search failed:', err)
        }
      }
      
      // Add type to stop results
      const typedStopResults = stopResults.map(stop => ({ ...stop, type: 'station' as const }))
      
      // Combine results
      const allResults = [...typedStopResults, ...routeResults]
      
      // If still no results, show a helpful message
      if (allResults.length === 0) {
        if (!userLocation) {
          setError('Please allow location access first, or click "Near Me" button to get nearby stops')
        } else {
          setError('No matching stops or routes found, please try different keywords')
        }
      }
      
      setSearchResults(allResults)
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

  // Debug logging
  console.log('App render state:', {
    userLocation,
    closestStop,
    departures: departures.length,
    isLoading,
    error,
    connectionStatus
  });

  // Check for potential issues
  if (connectionStatus === 'connected' && !closestStop && !isLoading) {
    console.warn('Connected but no closest stop found');
  }
  
  if (connectionStatus === 'connected' && closestStop && departures.length === 0 && !isLoading) {
    console.warn('Connected with closest stop but no departures');
  }

  // Error boundary for rendering
  try {
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
              <button
                onClick={async () => {
                  // Test route stops functionality
                  console.log('Testing route stops functionality...');
                  try {
                    const { getRouteStops } = await import('./lib/supabase');
                    const testResult = await getRouteStops('F11', new Date().toISOString().split('T')[0], undefined, 1);
                    console.log('Test result:', testResult);
                    alert(`Test completed: Found ${testResult.length} stops for F11 route`);
                  } catch (err) {
                    console.error('Test failed:', err);
                    alert(`Test failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
                  }
                }}
                className="btn-outline"
                style={{ minWidth: 'auto' }}
              >
                🚌 Test Route Query
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
            <div style={{ display: 'flex', gap: '8px' }}>
              <button 
                className="btn-secondary"
                onClick={() => setIsRouteQueryOpen(true)}
                style={{ minWidth: 'auto', padding: '12px' }}
              >
                🚌 Route Query
              </button>
              <button 
                className="btn-secondary"
                onClick={() => setIsSettingsOpen(true)}
                style={{ minWidth: 'auto', padding: '12px' }}
              >
                ⚙️
              </button>
            </div>
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
                    Route {selectedRoute?.route || 'Unknown'}
                  </h2>
                  <p style={{ margin: '4px 0 0 0', color: 'var(--text-secondary)' }}>
                    To: {selectedRoute?.headsign || 'Unknown Destination'}
                  </p>
                  <div style={{ marginTop: '8px', fontSize: '14px', color: 'var(--text-muted)' }}>
                    <span style={{ color: 'var(--success)', fontWeight: 'bold' }}>Route {selectedRoute?.route || 'Unknown'}</span>
                    <span style={{ margin: '0 8px' }}>→</span>
                    <span style={{ color: 'var(--text-secondary)' }}>Multiple stops</span>
                    <span style={{ margin: '0 8px' }}>→</span>
                    <span style={{ color: 'var(--danger)', fontWeight: 'bold' }}>{selectedRoute?.headsign || 'Unknown Destination'}</span>
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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h3 style={{ margin: 0, color: 'var(--primary-blue)' }}>
                    Route Map
                  </h3>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    Route stops • {realtimeBuses.length} buses online
                  </div>
                </div>
                <div style={{
                  height: '300px',
                  backgroundColor: 'var(--light-gray)',
                  borderRadius: '8px',
                  position: 'relative',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    textAlign: 'center',
                    zIndex: 20
                  }}>
                    <p style={{ color: 'var(--text-secondary)', margin: 0 }}>Use Route Query to load route stops</p>
                  </div>
                  {/* Scrollable Route Container */}
                  <div style={{
                    height: '100%',
                    overflowX: 'auto',
                    overflowY: 'hidden',
                    padding: '20px 0'
                  }}>
                    <div style={{
                      width: '3800px',
                      height: '200px', // Increase height to accommodate all elements
                      position: 'relative',
                      display: 'flex',
                      alignItems: 'center'
                    }}>
                      {/* Horizontal Route Line - From first to last stop */}
                      <div style={{
                        width: '3600px', // From 50px (first stop) to 3650px (last stop)
                        height: '4px',
                        backgroundColor: 'var(--primary-blue)',
                        position: 'absolute',
                        top: '50%',
                        left: '50px', // Start at first stop position
                        transform: 'translateY(-50%)'
                      }}>
                        {/* Real-time bus position indicators */}
                        {isRealtimeActive && realtimeBuses.map((bus) => {
                          // Calculate bus position on route (pixels)
                          const busPosition = 50 + (bus.progress / 100) * 3600;
                          
                          return (
                            <div key={bus.busId} className={`bus-icon ${bus.status}`} style={{
                              position: 'absolute',
                              top: '-35px',
                              left: `${busPosition}px`,
                              width: '32px',
                              height: '32px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '24px',
                              zIndex: 10,
                              transform: 'scaleX(-1)'
                            }}>
                              🚌
                            </div>
                          );
                        })}
                        
                      </div>
                      
                      {/* Route Stops - Placeholder for route stops */}
                      {[].map((stop: any, index: number) => {
                        const position = 50 + (index * 240); // Spread stops across the route line
                        const isCurrent = stop.id === closestStop?.id;
                        const isTransfer = stop.name.toLowerCase().includes('metro') || stop.name.toLowerCase().includes('station');
                        
                        return (
                        <div key={stop.id} style={{
                          position: 'absolute',
                          left: `${position}px`,
                          top: '50%',
                          transform: 'translateY(-50%)',
                          textAlign: 'center',
                          zIndex: isCurrent ? 10 : 5
                        }}>
                          {/* Stop Marker - Exactly on the route line */}
                          <div style={{
                            width: isCurrent ? '16px' : '12px',
                            height: isCurrent ? '16px' : '12px',
                            backgroundColor: isCurrent ? 'var(--success)' : 
                                           isTransfer ? 'var(--warning)' : 'var(--primary-blue)',
                            borderRadius: '50%',
                            margin: '0 auto',
                            border: isCurrent ? '3px solid white' : '2px solid white',
                            boxShadow: isCurrent ? '0 4px 8px rgba(0,0,0,0.3)' : '0 2px 4px rgba(0,0,0,0.2)',
                            animation: isCurrent ? 'pulse 2s infinite' : 'none',
                            position: 'absolute',
                            top: '50%',
                            left: '50%',
                            transform: 'translate(-50%, -50%)',
                            zIndex: 6
                          }}></div>
                          
                          {/* Stop Name - Vertical text below the route line */}
                          <div style={{
                            fontSize: '12px', // Increase font size
                            color: isCurrent ? 'var(--success)' : 'var(--text-primary)',
                            fontWeight: 'bold', // Always bold
                            marginTop: '25px', // Move further down to avoid bus icon
                            backgroundColor: 'rgba(255,255,255,0.95)',
                            padding: '4px 2px',
                            borderRadius: '4px',
                            border: 'none', // Remove border
                            writingMode: 'vertical-rl',
                            textOrientation: 'mixed',
                            whiteSpace: 'nowrap',
                            minHeight: '50px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            maxWidth: '60px',
                            position: 'absolute',
                            top: '50%',
                            left: '50%',
                            transform: 'translate(-50%, 0)',
                            zIndex: 4
                          }}>
                            {stop.name}
                          </div>
                          
                          {/* Transfer Info - Simplified for real data */}
                          {isTransfer && (
                            <div style={{
                              fontSize: '8px',
                              fontWeight: 'bold',
                              marginTop: '25px', // Same level as station name
                              backgroundColor: 'var(--warning)',
                              color: 'white',
                              padding: '1px 2px', // Reduce top and bottom padding
                              borderRadius: '3px',
                              display: 'flex',
                              flexDirection: 'column', // Vertical layout
                              gap: '1px',
                              alignItems: 'center',
                              justifyContent: 'center',
                              position: 'absolute',
                              top: '50%',
                              left: '50%',
                              transform: 'translate(30px, 0)', // Move to the right of station name
                              zIndex: 4,
                              maxWidth: '30px',
                              minHeight: '50px' // Reduce minHeight
                            }}>
                              <div style={{
                                textAlign: 'center',
                                lineHeight: '1.2'
                              }}>
                                {stop.code}
                              </div>
                            </div>
                          )}
                        </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Route Legend - Moved down */}
                <div style={{ marginTop: '200px', padding: '12px', backgroundColor: 'var(--light-gray)', borderRadius: '8px' }}>
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
                      <span style={{ fontSize: '12px' }}>Metro/Station</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <div style={{ width: '16px', height: '16px', backgroundColor: 'var(--success)', borderRadius: '50%', animation: 'pulse 2s infinite' }}></div>
                      <span style={{ fontSize: '12px' }}>Current Stop</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '20px' }}>🚌</span>
                      <span style={{ fontSize: '12px' }}>Bus Position</span>
                    </div>
                  </div>
                  <div style={{ marginTop: '12px', fontSize: '12px', color: 'var(--text-muted)' }}>
                    Use Route Query to load and display route stops
                  </div>
                </div>

                {/* Route Information - Moved down */}
                <div style={{ marginTop: '20px' }}>
                  <h4 style={{ margin: '0 0 12px 0', color: 'var(--primary-blue)' }}>
                    Route Information
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div>
                      <strong>Route:</strong><br />
                      <span style={{ color: 'var(--text-secondary)' }}>{selectedRoute?.route || 'Unknown'} - {selectedRoute?.headsign || 'Unknown Destination'}</span>
                    </div>
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
                      <span style={{ color: 'var(--text-secondary)' }}>Use Route Query to see stops</span>
                    </div>
                    <div>
                      <strong>Destination:</strong><br />
                      <span style={{ color: 'var(--text-secondary)' }}>{selectedRoute?.headsign || 'Unknown Destination'}</span>
                    </div>
                    <div>
                      <strong>Real-time Tracking:</strong><br />
                      <span style={{ color: isRealtimeActive ? 'var(--success)' : 'var(--text-muted)' }}>
                        {isRealtimeActive ? 'Enabled' : 'Disabled'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Real-time Bus Status Panel */}
                {isRealtimeActive && (
                  <div style={{ marginTop: '20px' }}>
                    <h4 style={{ margin: '0 0 12px 0', color: 'var(--primary-blue)' }}>
                      Real-time Bus Status ({realtimeBuses.length} buses online)
                    </h4>
                    <div style={{ maxHeight: '200px', overflow: 'auto', border: '1px solid var(--border-light)', borderRadius: '8px' }}>
                      {realtimeBuses.map((bus, index) => (
                        <div key={bus.busId} style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '12px',
                          borderBottom: index < realtimeBuses.length - 1 ? '1px solid var(--border-light)' : 'none',
                          backgroundColor: index % 2 === 0 ? 'var(--light-gray)' : 'white'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{
                              fontSize: '24px'
                            }}>
                              🚌
                            </div>
                            <div>
                              <div style={{ fontWeight: 'bold', fontSize: '14px' }}>
                                {bus.busId}
                              </div>
                              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                                {bus.currentStop} → {bus.nextStop}
                              </div>
                            </div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ 
                              fontSize: '12px', 
                              color: bus.status === 'moving' ? '#10B981' : 
                                     bus.status === 'stopped' ? '#F59E0B' : '#EF4444',
                              fontWeight: 'bold'
                            }}>
                              {bus.status === 'moving' ? 'Moving' : 
                               bus.status === 'stopped' ? 'Stopped' : 'Delayed'}
                            </div>
                            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                              Progress: {Math.round(bus.progress)}%
                            </div>
                            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                              ETA: {bus.eta} min
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* All Departures */}
                <div style={{ marginTop: '20px' }}>
                  <h4 style={{ margin: '0 0 12px 0', color: 'var(--primary-blue)' }}>
                    All Departures (Next 2 Hours)
                  </h4>
                  <div style={{ maxHeight: '200px', overflow: 'auto' }}>
                    {(selectedRoute?.allDepartures || []).map((dep: any, index: number) => (
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
              {isLoading && <div>Loading departures…</div>}
              {!isLoading && error && <div className="text-red-600">Couldn't load departures — {error}</div>}
              {!isLoading && !error && departures.length === 0 && (
                <div>No upcoming departures for this stop.</div>
              )}
              {!isLoading && !error && departures.length > 0 && (
                <ul className="grid gap-2">
                  {departures.map((route, index) => (
                    <li key={index} className="border rounded p-3">
                      <div className="font-medium">
                        {route.route} → {route.headsign}
                      </div>
                      <div>Departs {route.nextDeparture.scheduled} ({route.nextDeparture.etaMin} min)</div>
                      <div className="text-sm opacity-70">{route.allDepartures.length} departures in next 2 hours</div>
                    </li>
                  ))}
                </ul>
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
                {searchResults.map((item) => (
                  <div key={item.id} className="stop-info">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                          <h4 style={{ color: 'var(--primary-blue)', margin: 0 }}>
                            {item.name}
                          </h4>
                          <span style={{ 
                            fontSize: '10px', 
                            padding: '2px 6px', 
                            borderRadius: '10px',
                            backgroundColor: item.type === 'route' ? 'var(--info)' : 'var(--success)',
                            color: 'white',
                            fontWeight: 'bold'
                          }}>
                            {item.type === 'route' ? 'ROUTE' : 'STATION'}
                          </span>
                        </div>
                        <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
                          {item.type === 'station' 
                            ? `Code: ${item.code} • Distance: ${item.distance}km`
                            : `Bus Route • Multiple stops`
                          }
                        </p>
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        {item.type === 'station' ? (
                          <>
                            <button
                              onClick={() => loadDepartures(item.id)}
                              className="btn-outline"
                              style={{ minWidth: 'auto', fontSize: '12px' }}
                            >
                              View Times
                            </button>
                            <button
                              onClick={() => handleAddFavorite(item)}
                              className="btn-primary"
                              style={{ minWidth: 'auto', fontSize: '12px' }}
                            >
                              Add to Favorites
                            </button>
                            <button
                              onClick={() => {
                                if (item.type === 'station') {
                                  shareService.shareStation(item.name, item.code, []);
                                } else {
                                  shareService.shareRoute(item.id, item.name, []);
                                }
                              }}
                              className="btn-secondary"
                              style={{ minWidth: 'auto', fontSize: '12px' }}
                            >
                              📤 Share
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => {
                              // Handle route selection
                              setSelectedRoute({
                                route: item.id,
                                headsign: item.name.split(' - ')[1] || item.name,
                                nextDeparture: { etaMin: 0, scheduled: 'N/A', status: 'ON_TIME', direction: 'TO_DUBAI', platform: 'N/A', realtime: false, currentStop: 'N/A', nextStop: 'N/A' },
                                allDepartures: []
                              })
                              setShowRouteDetail(true)
                            }}
                            className="btn-primary"
                            style={{ minWidth: 'auto', fontSize: '12px' }}
                          >
                            View Route Map
                          </button>
                        )}
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
                    <li>Route query by line number</li>
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

      {/* Route Query Modal */}
      <RouteQuery 
        isOpen={isRouteQueryOpen} 
        onClose={() => setIsRouteQueryOpen(false)} 
      />
    </div>
  )
  } catch (error) {
    console.error('App render error:', error);
    return (
      <div className="min-h-screen" style={{ background: 'var(--light-gray)', padding: '20px' }}>
        <div className="card" style={{ margin: '20px', textAlign: 'center' }}>
          <div style={{ padding: '40px' }}>
            <h2 style={{ color: 'var(--danger)', marginBottom: '16px' }}>⚠️ Application Error</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '16px' }}>
              The application encountered an error. Please refresh the page and try again.
            </p>
            <button 
              onClick={() => window.location.reload()} 
              className="btn-primary"
            >
              Refresh Page
            </button>
            <details style={{ marginTop: '20px', textAlign: 'left' }}>
              <summary style={{ cursor: 'pointer', color: 'var(--text-muted)' }}>Error Details</summary>
              <pre style={{ 
                marginTop: '10px', 
                padding: '10px', 
                backgroundColor: '#f8fafc', 
                borderRadius: '4px',
                fontSize: '12px',
                overflow: 'auto'
              }}>
                {error instanceof Error ? error.message : String(error)}
              </pre>
            </details>
          </div>
        </div>
      </div>
    );
  }
}

export default App
