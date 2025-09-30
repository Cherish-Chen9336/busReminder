import React, { useState, useEffect } from 'react'
import './App.css'
import { getNearbyStops, getDepartures, healthCheck, DUBAI_CENTER, getRouteStops } from './lib/supabase'
import { realtimeTracker } from './lib/realtime'
import type { BusPosition } from './lib/realtime'
// import { notificationService } from './lib/notifications'
import { shareService } from './lib/share'
import { RouteQuery } from './components/RouteQuery'
import RouteDetailPage from './components/RouteDetailPage'
// Removed StopDetailPage import as it's now handled by routing

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
  route_id?: string
  bus_id?: string
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
  const [userLocation, setUserLocation] = useState<{lat: number, lon: number, accuracy?: number} | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [healthStatus, setHealthStatus] = useState<{success: boolean, message: string, data?: any, error?: string} | null>(null)
  const [isHealthChecking, setIsHealthChecking] = useState(false)
  const [useDubaiCenter, setUseDubaiCenter] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'failed' | 'idle'>('idle')
  // Removed showRouteDetail state - using page routing instead
  const [routeStops, setRouteStops] = useState<any[]>([])
  const [realtimeBuses, setRealtimeBuses] = useState<BusPosition[]>([])
  const [isRealtimeActive] = useState(true)
  // Add page state management for routing
  const [currentPage, setCurrentPage] = useState<'main' | 'stop-detail' | 'route-detail'>('main')
  const [selectedStop, setSelectedStop] = useState<Stop | null>(null)
  const [selectedRoute, setSelectedRoute] = useState<any>(null)

  // Get user location with fallback to Dubai center
  const getCurrentLocation = (forceRefresh = false) => {
    console.log('=== Getting user location ===')
    if (forceRefresh) {
      console.log('🔄 Force refreshing GPS location...')
    }
    console.log('navigator.geolocation available:', !!navigator.geolocation)
    
    if (navigator.geolocation) {
      console.log('Requesting location permission...')
      setError(null)
      setIsLoading(true)
      
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude, accuracy } = position.coords
          console.log('✅ Location obtained successfully!')
          console.log('Latitude:', latitude)
          console.log('Longitude:', longitude)
          console.log('Accuracy:', accuracy, 'meters')
          console.log('Timestamp:', new Date(position.timestamp))
          
          // Check if accuracy is reasonable (adjusted for mobile GPS)
          if (accuracy > 5000) {
            console.log('⚠️ Location accuracy is very low, may be inaccurate')
            console.log('⚠️ Accuracy:', accuracy, 'meters - consider refreshing GPS')
            setError(`Location accuracy too low (${Math.round(accuracy)}m). Move outdoors or enable precise location.`)
          setUserLocation({ lat: latitude, lon: longitude, accuracy })
          setUseDubaiCenter(false)
          setIsLoading(false)
            return
          } else if (accuracy > 1000) {
            console.log('⚠️ Location accuracy is moderate')
            console.log('⚠️ Accuracy:', accuracy, 'meters - acceptable for mobile GPS')
          } else {
            console.log('✅ Location accuracy is good')
            console.log('✅ Accuracy:', accuracy, 'meters - excellent precision')
          }
          
          setUserLocation({ lat: latitude, lon: longitude, accuracy })
          setUseDubaiCenter(false)
          setIsLoading(false)
          console.log('Location state updated')
        },
        (error) => {
          console.error('❌ Location acquisition failed:', error)
          console.log('Error code:', error.code)
          console.log('Error message:', error.message)
          
          let errorMessage = 'Unable to get location information'
          switch(error.code) {
            case error.PERMISSION_DENIED:
              errorMessage = 'Location access denied. Please allow location permission or click "Use Dubai Center" to continue.'
              console.log('Reason: User denied location permission')
              break
            case error.POSITION_UNAVAILABLE:
              errorMessage = 'Location information unavailable. Please check GPS settings or click "Use Dubai Center" to continue.'
              console.log('Reason: Location information unavailable')
              break
            case error.TIMEOUT:
              errorMessage = 'Location request timed out. Please retry or click "Use Dubai Center" to continue.'
              console.log('Reason: Location request timeout')
              break
            default:
              errorMessage = 'Unknown error occurred while getting location.'
              console.log('Reason: Unknown error')
              break
          }
          
          setError(errorMessage)
          setUseDubaiCenter(true)
          setIsLoading(false)
          
          // Only auto-use Dubai center if not force refresh
          if (!forceRefresh) {
            console.log('Auto-using Dubai center as fallback location...')
            setTimeout(() => {
              useDubaiCenterLocation()
            }, 2000)
          }
        },
        {
          enableHighAccuracy: true, // Use high accuracy for better results
          timeout: 20000, // Increase timeout for high accuracy
          maximumAge: forceRefresh ? 0 : 300000 // Force refresh if requested
        }
      )
    } else {
      console.log('❌ Browser does not support geolocation API')
      setError('This browser does not support geolocation. Using Dubai center as fallback.')
      setUseDubaiCenter(true)
      setIsLoading(false)
      
      // Auto-use Dubai center as fallback
      setTimeout(() => {
        useDubaiCenterLocation()
      }, 1000)
    }
  }

  // Use Dubai center as fallback location
  const useDubaiCenterLocation = () => {
    console.log('=== Using Dubai center as fallback location ===')
    console.log('Dubai center coordinates:', DUBAI_CENTER)
    setUserLocation(DUBAI_CENTER)
    setUseDubaiCenter(true)
    setError(null)
    console.log('Switched to Dubai center location')
  }

  // Navigation functions - use URL routing for stop details
  const navigateToStopDetail = (stop: Stop) => {
    // Navigate to /stop/:stop_id
    window.location.href = `/stop/${stop.id}`
  }

  const navigateToRouteDetail = async (route: any) => {
    setSelectedRoute(route)
    setCurrentPage('route-detail')
    
    // Load route stops when navigating to route detail
    try {
      console.log('Loading route stops for route:', route.route_id || route.route)
      const stops = await getRouteStops(route.route_id || route.route)
      console.log('Route stops loaded:', stops)
      setRouteStops(stops)
    } catch (error) {
      console.error('Error loading route stops:', error)
      setRouteStops([])
    }
  }

  const navigateBackToMain = () => {
    setCurrentPage('main')
    setSelectedStop(null)
    setSelectedRoute(null)
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
    console.log('=== useEffect triggered ===')
    console.log('userLocation:', userLocation)
    if (userLocation) {
      console.log('userLocation exists, calling loadNearbyStops...')
      loadNearbyStops()
    } else {
      console.log('No userLocation, skipping loadNearbyStops')
    }
  }, [userLocation])

  // Load nearby stops from Supabase
  const loadNearbyStops = async () => {
    console.log('🚀🚀🚀 loadNearbyStops function called! 🚀🚀🚀')
    console.log('userLocation check:', userLocation)
    
    if (!userLocation) {
      console.log('❌ No userLocation, returning early')
      return
    }
    
    console.log('✅ userLocation exists, proceeding...')
    setIsLoading(true)
    setError(null)
    setConnectionStatus('connecting')
    
    try {
      console.log('=== loadNearbyStops called ===')
      console.log('Loading nearby stops for location:', userLocation)
      console.log('Force refresh timestamp:', Date.now())
      console.log('About to call getNearbyStops with:', { lat: userLocation.lat, lon: userLocation.lon, radius: 10000, limit: 50 })
      
      const stops = await getNearbyStops(userLocation.lat, userLocation.lon, 10000, 50) as Stop[]
      console.log('=== getNearbyStops returned ===')
      console.log('Nearby stops received:', stops)
      console.log('Stops length:', stops.length)
      console.log('Stops type:', typeof stops)
      console.log('Is array:', Array.isArray(stops))
      setNearbyStops(stops)
      setConnectionStatus('connected')
      
      // Set closest stop
      if (stops.length > 0) {
        console.log('All stops received:', stops)
        
        // Map Supabase response to our Stop interface
        const mappedStops = stops.map((stop: any) => {
          console.log(`Mapping stop ${stop.stop_id}: distance_m=${stop.distance_m}, stop_name=${stop.stop_name}`)
          return {
          id: stop.stop_id,
          name: stop.stop_name,
          code: stop.stop_id, // Use stop_id as code
          distance: stop.distance_m,  // Use RPC distance_m field
          lat: stop.stop_lat,
          lon: stop.stop_lon
          }
        })
        
        // Debug: Log the mapped stops to verify data structure
        console.log('=== Mapped Stops Debug ===')
        console.log('Total stops:', stops.length)
        console.log('Mapped stops structure:', mappedStops)
        console.log('First stop details:', mappedStops[0])
        
        console.log('Mapped stops:', mappedStops)
        setNearbyStops(mappedStops)
        
        const closest = mappedStops.reduce((prev, current) => 
          (prev.distance || 0) < (current.distance || 0) ? prev : current
        )
        console.log('=== Closest Stop Selection ===')
        console.log('Closest stop details:', closest)
        console.log('Closest stop ID:', closest.id)
        console.log('Closest stop name:', closest.name)
        console.log('Closest stop distance:', closest.distance)
        
        // Validate distance - if too large, likely lat/lon swapped or bad GPS
        if (closest.distance > 50000) {
          console.error('Distance too large:', closest.distance, 'm - likely lat/lon swapped or bad GPS')
          setError(`Distance too large (${Math.round(closest.distance)}m). This may indicate GPS issues or coordinate problems.`)
          return
        }
        
        if (closest.id) {
          console.log('Setting closest stop and loading departures...')
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
      console.error('=== Error in loadNearbyStops ===')
      console.error('Error loading nearby stops:', err)
      console.error('Error type:', typeof err)
      console.error('Error message:', err instanceof Error ? err.message : String(err))
      console.error('Error stack:', err instanceof Error ? err.stack : 'No stack trace')
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
      const deps = await getDepartures(stopId, now, 50) as any[]
      console.log('Raw departures received:', deps)
      console.log('Departures type:', typeof deps)
      console.log('Departures length:', Array.isArray(deps) ? deps.length : 'Not an array')
      
      if (Array.isArray(deps) && deps.length > 0) {
        console.log('First departure:', deps[0])
        // Map the data to our Departure interface based on actual Supabase response structure
        const mappedDepartures = deps.map((dep: any) => ({
          route: dep.route_name || dep.route_id || 'Unknown Route',
          headsign: dep.headsign || dep.trip_headsign || dep.route_long_name || 'Unknown Destination',
          route_id: dep.route_id,
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
              route_id: dep.route_id,
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
        console.log('Unique routes found:', [...new Set(mappedDepartures.map(d => d.route))])
        console.log('Total routes:', [...new Set(mappedDepartures.map(d => d.route))].length)
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

  // Load route stops for a specific route
  const loadRouteStops = async (routeId: string) => {
    try {
      console.log('=== Loading route stops ===')
      console.log('Route ID received:', routeId)
      console.log('Route ID type:', typeof routeId)
      console.log('Route ID length:', routeId?.length)
      
      if (!routeId || routeId === 'undefined' || routeId === 'null') {
        console.error('Invalid route ID provided:', routeId)
        setRouteStops([])
        return
      }
      
      console.log('Calling getRouteStops with:', routeId)
      const stops = await getRouteStops(routeId)
      console.log('Route stops loaded:', stops)
      console.log('Number of stops found:', stops.length)
      console.log('Setting routeStops state with:', stops)
      
      if (stops.length === 0) {
        console.warn('No stops found for route:', routeId)
        console.warn('This will cause the detail page to show "Loading route stops..."')
      }
      
      setRouteStops(stops)
      console.log('routeStops state updated')
    } catch (err) {
      console.error('Error loading route stops:', err)
      console.error('Error details:', err instanceof Error ? err.message : String(err))
      setRouteStops([])
    }
  }

  // Update ETA times without reloading data
  const updateETATimes = () => {
    setDepartures(prevDepartures => {
      const currentTime = new Date()
      const updatedDepartures = prevDepartures.map(route => {
        const scheduledTime = new Date(`${currentTime.toISOString().split('T')[0]}T${route.nextDeparture.scheduled}`)
        const etaMinutes = Math.max(0, Math.round((scheduledTime.getTime() - currentTime.getTime()) / (1000 * 60)))
        
        // If current departure has passed or is very close (etaMin <= 0), find the next departure
        if (etaMinutes <= 0 && route.allDepartures.length > 1) {
          // Find the next departure after the current one
          const nextDeparture = route.allDepartures.find(dep => {
            const depTime = new Date(`${currentTime.toISOString().split('T')[0]}T${dep.scheduled}`)
            return depTime.getTime() > currentTime.getTime()
          })
          
          if (nextDeparture) {
            const nextScheduledTime = new Date(`${currentTime.toISOString().split('T')[0]}T${nextDeparture.scheduled}`)
            const nextEtaMinutes = Math.max(0, Math.round((nextScheduledTime.getTime() - currentTime.getTime()) / (1000 * 60)))
            
            console.log(`Switching to next departure for route ${route.route}: ${nextDeparture.scheduled} (${nextEtaMinutes} min)`)
            
            return {
              ...route,
              nextDeparture: {
                ...nextDeparture,
                etaMin: nextEtaMinutes
              }
            }
          } else {
            // No more departures today, remove this route from display
            console.log(`No more departures for route ${route.route}, removing from display`)
            return null
          }
        }
        
        return {
          ...route,
          nextDeparture: {
            ...route.nextDeparture,
            etaMin: etaMinutes
          }
        }
      })
      
      // Filter out routes with no more departures and sort by ETA time
      const filteredDepartures = updatedDepartures
        .filter(route => route !== null) // Remove null routes (no more departures)
        .filter(route => {
          // Keep routes that have departures within the next 2 hours
          return route.nextDeparture.etaMin <= 120
        })
        .sort((a, b) => a.nextDeparture.etaMin - b.nextDeparture.etaMin)
      
      console.log(`Updated departures: ${filteredDepartures.length} routes`)
      return filteredDepartures
    })
  }

  // Simulate real-time updates - only update times, not reload data
  useEffect(() => {
    // Update every 10 seconds for smooth time display
    const interval = setInterval(() => {
      setLastUpdate(new Date())
      updateETATimes()
    }, 10000) // Update every 10 seconds

    return () => clearInterval(interval)
  }, [])

  // Load departures only when stop changes
  useEffect(() => {
      if (closestStop && closestStop.id) {
        loadDepartures(closestStop.id)
      }
  }, [closestStop?.id])

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
          const broaderResults = await getNearbyStops(userLocation.lat, userLocation.lon, 1000, 100) as any[]
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

  // Get status color (unused function - commented out)
  // const getStatusColor = (status: string) => {
  //   switch (status) {
  //     case 'DELAYED': return 'var(--danger)'
  //     case 'EARLY': return 'var(--warning)'
  //     default: return 'var(--success)'
  //   }
  // }

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
  
  // Enhanced debug logging for frontend display issues
  console.log('=== Frontend Display Debug ===');
  console.log('User location:', userLocation);
  console.log('Closest stop:', closestStop);
  console.log('Nearby stops count:', nearbyStops.length);
  console.log('Departures count:', departures.length);
  console.log('Loading state:', isLoading);
  console.log('Error state:', error);
  
  // Force refresh to test distance fix
  console.log('Distance fix applied - checking closest stop distance:', closestStop?.distance);

  // Check for potential issues
  if (connectionStatus === 'connected' && !closestStop && !isLoading) {
    console.warn('Connected but no closest stop found');
  }
  
  if (connectionStatus === 'connected' && closestStop && departures.length === 0 && !isLoading) {
    console.warn('Connected with closest stop but no departures');
  }

  // Render different pages based on currentPage state
  if (currentPage === 'route-detail' && selectedRoute) {
    return <RouteDetailPage route={selectedRoute} onBack={navigateBackToMain} />
  }

  // Check if we're on the stop detail page
  if (window.location.pathname.startsWith('/stop/')) {
    const stopId = window.location.pathname.split('/stop/')[1]
    if (stopId) {
      const StopDetailPage = React.lazy(() => import('./components/StopDetailPage'))
      return (
        <React.Suspense fallback={
          <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--light-gray)'
          }}>
            <div className="loading-spinner"></div>
          </div>
        }>
          <StopDetailPage stopId={stopId} />
        </React.Suspense>
      )
    }
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
                    const testResult = await getRouteStops('F11');
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

        {/* Current Location Info */}
        <div className="card" style={{ margin: '20px', marginTop: '10px' }}>
          <div style={{ padding: '16px' }}>
            <h4 style={{ color: 'var(--primary-blue)', margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
              📍 Current Location
            </h4>
            {userLocation ? (
              <div>
                <div style={{ marginBottom: '8px' }}>
                  <strong>Coordinates:</strong> {userLocation.lat.toFixed(6)}, {userLocation.lon.toFixed(6)}
                </div>
                <div style={{ marginBottom: '8px' }}>
                  <strong>Location Source:</strong> {useDubaiCenter ? 'Dubai Center (Fallback)' : 'GPS Location'}
                </div>
                {userLocation.accuracy && (
                  <div style={{ marginBottom: '8px' }}>
                    <strong>Accuracy:</strong> ±{Math.round(userLocation.accuracy)}m
                  </div>
                )}
                <div style={{ 
                  fontSize: '12px', 
                  color: 'var(--text-muted)', 
                  backgroundColor: 'var(--light-gray)', 
                  padding: '8px', 
                  borderRadius: '4px',
                  marginTop: '8px'
                }}>
                  {useDubaiCenter ? 
                    'Using Dubai center coordinates as fallback location. Click "Near Me" to try getting your actual location.' :
                    'Location obtained from your device GPS.'
                  }
                </div>
                <div style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => getCurrentLocation(true)}
                    style={{
                      padding: '8px 12px',
                      fontSize: '12px',
                      backgroundColor: 'var(--primary-blue)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    🔄 Refresh GPS
                  </button>
                  {useDubaiCenter && (
                    <button
                      onClick={useDubaiCenterLocation}
                      style={{
                        padding: '8px 12px',
                        fontSize: '12px',
                        backgroundColor: 'var(--text-muted)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer'
                      }}
                    >
                      📍 Use Dubai Center
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div style={{ color: 'var(--text-muted)' }}>
                <p>Location not available. Click "Near Me" to get your location.</p>
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
              <p><strong>Location Accuracy:</strong> {userLocation?.accuracy ? `${Math.round(userLocation.accuracy)}m` : 'Unknown'}</p>
              <p><strong>Using Dubai Center:</strong> {useDubaiCenter ? 'Yes' : 'No'}</p>
              <p><strong>Nearby Stops Count:</strong> {nearbyStops.length}</p>
              <p><strong>Closest Stop:</strong> {closestStop ? closestStop.name : 'None'}</p>
              <p><strong>Closest Stop ID:</strong> {closestStop ? closestStop.id : 'None'}</p>
              <p><strong>Closest Distance:</strong> {closestStop ? `${Math.round(closestStop.distance || 0)}m` : 'None'}</p>
              <p><strong>Departures Count:</strong> {departures.length}</p>
              <p><strong>Loading Status:</strong> {isLoading ? 'Loading' : 'Idle'}</p>
              <button
                onClick={() => {
                  console.log('=== Manual Data Flow Test ===');
                  console.log('User location:', userLocation);
                  console.log('Closest stop:', closestStop);
                  console.log('Nearby stops:', nearbyStops);
                  console.log('Departures:', departures);
                  alert(`Debug Info:\nUser Location: ${userLocation ? `${userLocation.lat}, ${userLocation.lon}` : 'None'}\nClosest Stop: ${closestStop ? closestStop.name : 'None'}\nNearby Stops: ${nearbyStops.length}\nDepartures: ${departures.length}`);
                }}
                style={{
                  padding: '8px 12px',
                  fontSize: '12px',
                  backgroundColor: 'var(--primary-blue)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  marginTop: '10px'
                }}
              >
                🔍 Debug Data Flow
              </button>
              <button
                onClick={async () => {
                  if (userLocation) {
                    console.log('=== Manual RPC Test ===');
                    console.log('Testing RPC with user location:', userLocation);
                    try {
                      const testStops = await getNearbyStops(userLocation.lat, userLocation.lon, 5000, 10);
                      console.log('Manual RPC test result:', testStops);
                      alert(`Manual RPC Test:\nFound ${testStops.length} stops\nFirst stop: ${testStops[0] ? testStops[0].stop_name : 'None'}`);
                    } catch (err) {
                      console.error('Manual RPC test failed:', err);
                      alert(`Manual RPC test failed: ${err instanceof Error ? err.message : String(err)}`);
                    }
                  } else {
                    alert('No user location available for testing');
                  }
                }}
                style={{
                  padding: '8px 12px',
                  fontSize: '12px',
                  backgroundColor: 'var(--warning)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  marginTop: '10px',
                  marginLeft: '10px'
                }}
              >
                🧪 Test RPC
              </button>
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
              {/* Current Location Display */}
              {userLocation && (
                <div style={{ 
                  marginTop: '8px', 
                  padding: '8px 12px', 
                  backgroundColor: 'var(--light-gray)', 
                  borderRadius: '6px',
                  fontSize: '12px',
                  color: 'var(--text-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  <span>📍</span>
                  <span>
                    {useDubaiCenter ? 'Dubai Center' : 'Your Location'}: 
                    {userLocation.lat.toFixed(4)}, {userLocation.lon.toFixed(4)}
                    {userLocation.accuracy && ` (±${Math.round(userLocation.accuracy)}m)`}
                  </span>
                </div>
              )}
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

        {/* Route Detail Modal - Removed, using page routing instead */}
        {false && (
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
                    To: {routeStops.length > 0 ? routeStops[routeStops.length - 1].stop_name : (selectedRoute?.headsign || 'Unknown Destination')}
                  </p>
                  <div style={{ marginTop: '8px', fontSize: '14px', color: 'var(--text-muted)' }}>
                  <span style={{ color: 'var(--success)', fontWeight: 'bold' }}>{routeStops.length > 0 ? routeStops[0].stop_name : 'Unknown Start Station'}</span>
                    <span style={{ margin: '0 8px' }}>→</span>
                  <span style={{ color: 'var(--text-secondary)' }}>{routeStops.length} stops</span>
                    <span style={{ margin: '0 8px' }}>→</span>
                  <span style={{ color: 'var(--danger)', fontWeight: 'bold' }}>
                    {routeStops.length > 0 ? routeStops[routeStops.length - 1].stop_name : (selectedRoute?.headsign || 'Unknown Destination')}
                  </span>
                  </div>
                </div>
                <button
                  onClick={() => console.log('Modal close clicked')}
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
                    Route stops • {routeStops.length} stops • {realtimeBuses.length} buses online
                  </div>
                </div>
                <div style={{
                  height: '300px',
                  backgroundColor: 'var(--light-gray)',
                  borderRadius: '8px',
                  position: 'relative',
                  overflow: 'hidden'
                }}>
                  {routeStops.length === 0 && (
                  <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    textAlign: 'center',
                    zIndex: 20
                  }}>
                      <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
                        Loading route stops...
                      </p>
                  </div>
                  )}
                  {/* Scrollable Route Container */}
                  <div style={{
                    height: '100%',
                    overflowX: 'auto',
                    overflowY: 'hidden',
                    padding: '20px 0'
                  }}>
                    <div style={{
                      width: `${Math.max(4000, routeStops.length * 260 + 100)}px`,
                      height: '220px', // Increase height to accommodate two-line text
                      position: 'relative',
                      display: 'flex',
                      alignItems: 'center'
                    }}>
                      {/* Horizontal Route Line - From first to last stop */}
                      <div style={{
                        width: `${Math.max(3800, routeStops.length * 260 - 50)}px`,
                        height: '4px',
                        backgroundColor: 'var(--primary-blue)',
                        position: 'absolute',
                        top: '50%',
                        left: '50px', // Start at first stop position
                        transform: 'translateY(-50%)'
                      }}>
                        {/* Real-time bus position indicators */}
                        {(() => {
                          console.log('Bus icons render check:', { isRealtimeActive, realtimeBusesLength: realtimeBuses.length, routeStopsLength: routeStops.length });
                          return null;
                        })()}
                        {isRealtimeActive && realtimeBuses.length > 0 && realtimeBuses.map((bus) => {
                          // Calculate bus position on route (pixels) based on progress
                          // Use a fixed route length if routeStops is not loaded yet
                          const routeLength = routeStops.length > 0 ? Math.max(3800, routeStops.length * 260 - 50) : 3800;
                          const busPosition = 50 + (bus.progress / 100) * routeLength;
                          
                          console.log(`Bus ${bus.busId} position: ${busPosition}px (progress: ${bus.progress}%)`);
                          
                          return (
                            <div key={bus.busId} className={`bus-icon ${bus.status}`} style={{
                              position: 'absolute',
                              top: '-50px',
                              left: `${busPosition}px`,
                              width: '40px',
                              height: '40px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '28px',
                              zIndex: 20,
                              transform: 'scaleX(-1)',
                              backgroundColor: 'white',
                              borderRadius: '50%',
                              border: '3px solid var(--primary-blue)',
                              boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
                              animation: bus.status === 'moving' ? 'busMoving 2s infinite' : 
                                        bus.status === 'stopped' ? 'busStopped 3s infinite' : 
                                        bus.status === 'delayed' ? 'busDelayed 1.5s infinite' : 'none'
                            }}>
                              🚌
                            </div>
                          );
                        })}
                        
                      </div>
                      
                      {/* Route Stops - Display actual route stops */}
                      {routeStops.map((stop: any, index: number) => {
                        const position = 50 + (index * 260); // Spread stops across the route line
                        const isCurrent = stop.stop_id === closestStop?.id;
                        const isTransfer = stop.stop_name.toLowerCase().includes('metro') || 
                                          stop.stop_name.toLowerCase().includes('station') ||
                                          stop.stop_name.toLowerCase().includes('bus stop') ||
                                          stop.is_transfer;
                        console.log(`Stop ${stop.stop_name} - isTransfer: ${isTransfer}, transfer_routes:`, stop.transfer_routes);
                        console.log(`Stop ${stop.stop_id} (${stop.stop_name}) - isCurrent: ${isCurrent}, closestStop.id: ${closestStop?.id}`);
                        
                        return (
                        <div key={stop.stop_id} style={{
                          position: 'absolute',
                          left: `${position}px`,
                          top: '50%',
                          transform: 'translateY(-50%)',
                          textAlign: 'center',
                          zIndex: isCurrent ? 10 : 5,
                          cursor: 'pointer'
                        }} onClick={() => {
                          // Create a Stop object for navigation
                          const stopForNavigation: Stop = {
                            id: stop.stop_id,
                            name: stop.stop_name,
                            code: stop.stop_id,
                            distance: 0, // Distance not available in route context
                            lat: stop.stop_lat,
                            lon: stop.stop_lon
                          }
                          navigateToStopDetail(stopForNavigation)
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
                          
                          {/* Current Station Label */}
                          {isCurrent && (
                          <div style={{
                              position: 'absolute',
                              top: '-25px',
                              left: '50%',
                              transform: 'translateX(-50%)',
                              backgroundColor: 'var(--success)',
                              color: 'white',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              fontSize: '8px',
                              fontWeight: 'bold',
                              zIndex: 7,
                              whiteSpace: 'nowrap'
                            }}>
                              CURRENT
                            </div>
                          )}
                          
                          {/* Stop Name - Two column text below the route line */}
                          <div style={{
                            fontSize: '11px',
                            color: isCurrent ? 'var(--success)' : 'var(--text-primary)',
                            fontWeight: 'bold',
                            marginTop: '25px',
                            backgroundColor: 'rgba(255,255,255,0.95)',
                            padding: '6px 4px',
                            borderRadius: '4px',
                            border: 'none',
                            minHeight: '60px',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            maxWidth: '80px',
                            position: 'absolute',
                            top: '50%',
                            left: '50%',
                            transform: 'translate(-50%, 0)',
                            zIndex: 4,
                            textAlign: 'center',
                            lineHeight: '1.2'
                          }}>
                            {stop.stop_name.split(' ').map((word: string, wordIndex: number) => (
                              <div key={wordIndex} style={{ marginBottom: '2px' }}>
                                {word}
                              </div>
                            ))}
                          </div>
                          
                          {/* Transfer Info - Show transfer routes */}
                          {isTransfer && stop.transfer_routes && stop.transfer_routes.length > 0 && (
                            <div style={{
                              fontSize: '9px',
                              fontWeight: 'bold',
                              marginTop: '25px',
                              backgroundColor: 'var(--warning)',
                              color: 'white',
                              padding: '4px 6px',
                              borderRadius: '4px',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '2px',
                              alignItems: 'center',
                              justifyContent: 'center',
                              position: 'absolute',
                              top: '50%',
                              left: '50%',
                              transform: 'translate(50px, 0)',
                              zIndex: 4,
                              maxWidth: '60px',
                              minHeight: '40px',
                                textAlign: 'center',
                              lineHeight: '1.1'
                              }}>
                              {stop.transfer_routes.slice(0, 3).map((route: any, routeIndex: number) => (
                                <div key={routeIndex} style={{ fontSize: '8px' }}>
                                  {route.route}
                              </div>
                              ))}
                              {stop.transfer_routes.length > 3 && (
                                <div style={{ fontSize: '7px' }}>
                                  +{stop.transfer_routes.length - 3}
                                </div>
                              )}
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
                      <span style={{ color: 'var(--text-secondary)' }}>{routeStops.length} stops</span>
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

                {/* Route Stops List */}
                {routeStops.length > 0 && (
                  <div style={{ marginTop: '20px' }}>
                    <h4 style={{ margin: '0 0 12px 0', color: 'var(--primary-blue)' }}>
                      Route Stops ({routeStops.length} stops)
                    </h4>
                    <div style={{ 
                      backgroundColor: 'var(--light-gray)', 
                      borderRadius: '8px', 
                      padding: '16px',
                      maxHeight: '300px',
                      overflowY: 'auto'
                    }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {routeStops.map((stop, index) => (
                          <div key={`${stop.stop_id}-${index}`} style={{
                            display: 'flex',
                            alignItems: 'center',
                            padding: '12px',
                            backgroundColor: 'white',
                            borderRadius: '6px',
                            border: '1px solid var(--border-color)',
                            position: 'relative'
                          }}>
                            {/* Stop sequence number */}
                            <div style={{
                              width: '32px',
                              height: '32px',
                              backgroundColor: 'var(--primary-blue)',
                              color: 'white',
                              borderRadius: '50%',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '14px',
                              fontWeight: 'bold',
                              marginRight: '12px',
                              flexShrink: 0
                            }}>
                              {stop.stop_sequence || index + 1}
                            </div>
                            
                            {/* Stop information */}
                            <div style={{ flex: 1 }}>
                              <div style={{ 
                                fontWeight: 'bold', 
                                color: 'var(--text-primary)',
                                marginBottom: '4px'
                              }}>
                                {stop.stop_name}
                              </div>
                              <div style={{ 
                                fontSize: '12px', 
                                color: 'var(--text-secondary)',
                                display: 'flex',
                                gap: '12px'
                              }}>
                                <span>ID: {stop.stop_id}</span>
                                <span>Lat: {stop.stop_lat?.toFixed(4)}</span>
                                <span>Lon: {stop.stop_lon?.toFixed(4)}</span>
                              </div>
                              {stop.is_transfer && (
                                <div style={{
                                  fontSize: '11px',
                                  color: 'var(--warning)',
                                  backgroundColor: '#fef3c7',
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                  marginTop: '4px',
                                  display: 'inline-block'
                                }}>
                                  Transfer Station
                                </div>
                              )}
                            </div>
                            
                            {/* Current station indicator */}
                            {stop.stop_id === closestStop?.id && (
                              <div style={{
                                position: 'absolute',
                                top: '-8px',
                                right: '-8px',
                                backgroundColor: 'var(--success)',
                                color: 'white',
                                fontSize: '10px',
                                fontWeight: 'bold',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                zIndex: 10
                              }}>
                                CURRENT
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

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
            <div className="card-header" style={{ cursor: 'pointer' }} onClick={() => navigateToStopDetail(closestStop)}>
              📍 Closest Station - {closestStop.name}
            </div>
            <div style={{ padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <div>
                                      <h3 style={{ color: 'var(--primary-blue)', margin: 0, fontSize: '20px' }}>
                      {closestStop.name}
                    </h3>
                  <p style={{ color: 'var(--text-secondary)', margin: '8px 0 0 0' }}>
                    Code: {closestStop.code} • Distance: {closestStop.distance ? Math.round(closestStop.distance) : 0}m
                    {userLocation?.accuracy && (
                      <span style={{ marginLeft: '10px', fontSize: '12px' }}>
                        • Accuracy: {Math.round(userLocation.accuracy)}m
                      </span>
                    )}
                  </p>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                  <div className="realtime-indicator">
                    Auto-updating
                  </div>
                    <button
                    onClick={() => getCurrentLocation(true)}
                      style={{
                        padding: '4px 8px',
                        fontSize: '12px',
                        backgroundColor: 'var(--primary-blue)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                      cursor: 'pointer',
                      marginLeft: '8px'
                      }}
                    >
                    🔄 Refresh GPS
                    </button>
                  {userLocation?.accuracy && userLocation.accuracy > 200 && (
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>
                      ⚠️ Low location accuracy, recommend refreshing
                    </div>
                  )}
                </div>
              </div>

              {/* All Bus Departures from Closest Stop */}
              {isLoading && <div>Loading departures…</div>}
              {!isLoading && error && <div className="text-red-600">Couldn't load departures — {error}</div>}
              {!isLoading && !error && departures.length === 0 && (
                <div>No upcoming departures for this stop.</div>
              )}
              {!isLoading && !error && departures.length > 0 && (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                  gap: '16px',
                  marginTop: '16px'
                }}>
                  {departures.map((route) => (
                    <div key={`${route.route}-${route.headsign}`} style={{
                      backgroundColor: 'white',
                      borderRadius: '12px',
                      padding: '20px',
                      boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                      border: '1px solid #e5e7eb',
                      position: 'relative',
                      cursor: 'pointer',
                      transition: 'transform 0.2s ease, box-shadow 0.2s ease'
                    }}
         onClick={() => {
           console.log('=== Route clicked ===')
           console.log('Route object:', route)
           navigateToRouteDetail(route)
         }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-2px)'
                      e.currentTarget.style.boxShadow = '0 8px 15px rgba(0, 0, 0, 0.15)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)'
                      e.currentTarget.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.1)'
                    }}>
                      {/* Route Number Badge */}
                      <div style={{
                        position: 'absolute',
                        top: '16px',
                        left: '16px',
                        backgroundColor: 'var(--primary-blue)',
                        color: 'white',
                        padding: '4px 12px',
                        borderRadius: '20px',
                        fontSize: '14px',
                        fontWeight: 'bold'
                      }}>
                        {route.route || 'Unknown'}
                      </div>
                      
                      {/* Status Badge */}
                      <div style={{
                        position: 'absolute',
                        top: '16px',
                        right: '16px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '12px',
                        color: '#10B981',
                        fontWeight: 'bold'
                      }}>
                        <span>✓</span>
                        <span>ON TIME</span>
                      </div>
                      
                      {/* Destination */}
                      <div style={{
                        marginTop: '40px',
                        marginBottom: '8px'
                      }}>
                        <div style={{
                          fontSize: '16px',
                          fontWeight: 'bold',
                          color: 'var(--text-primary)',
                          marginBottom: '4px'
                        }}>
                          To: {route.headsign || 'Unknown Destination'}
                        </div>
                        <div style={{
                          fontSize: '12px',
                          color: 'var(--text-muted)'
                        }}>
                          Unknown • Platform Unknown
                        </div>
                      </div>
                      
                      {/* Departures Count */}
                      <div style={{
                        fontSize: '12px',
                        color: 'var(--text-muted)',
                        marginBottom: '16px'
                      }}>
                        {route.allDepartures.length} departures in next 2 hours
                      </div>
                      
                      {/* Next Departure ETA */}
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}>
                        <div style={{
                          fontSize: '24px',
                          fontWeight: 'bold',
                          color: route.nextDeparture.etaMin <= 5 ? '#dc2626' : '#f59e0b', // 5分钟内红色，其他黄色
                          backgroundColor: '#f0f9ff', // 更浅的蓝色背景
                          padding: '8px 16px',
                          borderRadius: '20px',
                          border: '2px solid var(--primary-blue)', // 主题色边框
                          animation: route.nextDeparture.etaMin <= 5 ? 'pulse 1s infinite' : 'none',
                          transform: route.nextDeparture.etaMin <= 5 ? 'scale(1.05)' : 'scale(1)',
                          transition: 'all 0.3s ease',
                          opacity: route.nextDeparture.etaMin <= 5 ? 0.8 : 1
                        }}>
                          {route.nextDeparture.etaMin === 0 ? 'Now' : `${route.nextDeparture.etaMin} min`}
                        </div>
                        <div style={{
                          fontSize: '12px',
                          color: 'var(--text-muted)',
                          textAlign: 'right'
                        }}>
                          Next: {route.nextDeparture.scheduled}
                        </div>
                      </div>
                    </div>
                  ))}
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
                            ? `Code: ${item.code} • Distance: ${item.distance ? Math.round(item.distance) : 0}m`
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
                              // Navigate to stop detail page instead of opening modal
                              console.log('Route detail requested for route:', item.id)
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

      {/* Route Detail Modal - Removed, using page routing instead */}
      {false && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            maxWidth: '800px',
            width: '100%',
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
                <h2 style={{ 
                  color: 'var(--primary-blue)', 
                  margin: 0, 
                  fontSize: '24px',
                  fontWeight: 'bold'
                }}>
                  Route {selectedRoute.route}
                </h2>
                <p style={{ 
                  color: 'var(--text-secondary)', 
                  margin: '4px 0 0 0',
                  fontSize: '16px'
                }}>
                  To: {selectedRoute.headsign}
                </p>
                <div style={{
                  marginTop: '8px',
                  fontSize: '14px',
                  color: 'var(--text-muted)'
                }}>
                  <span style={{ color: 'var(--success)', fontWeight: 'bold' }}>Route {selectedRoute?.route || 'Unknown'}</span>
                  <span style={{ margin: '0 8px' }}>→</span>
                  <span style={{ color: 'var(--text-secondary)' }}>{routeStops.length} stops</span>
                  <span style={{ margin: '0 8px' }}>→</span>
                  <span style={{ color: 'var(--danger)', fontWeight: 'bold' }}>{selectedRoute?.headsign || 'Unknown Destination'}</span>
                </div>
              </div>
              <button
                onClick={() => console.log('Modal close clicked')}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '24px',
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                  padding: '8px'
                }}
              >
                ✕
              </button>
            </div>

            {/* Route Map Section */}
            <div style={{ padding: '20px' }}>
              <h3 style={{ 
                color: 'var(--primary-blue)', 
                margin: '0 0 16px 0',
                fontSize: '18px'
              }}>
                Route Map
              </h3>
              
              {/* Loading State */}
              {routeStops.length === 0 && (
                <div style={{
                  position: 'relative',
                  height: '200px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: '#f8fafc',
                  borderRadius: '8px',
                  border: '2px dashed #e2e8f0'
                }}>
                  <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
                    Loading route stops...
                  </p>
                </div>
              )}
              
              {/* Route Map */}
              {routeStops.length > 0 && (
                <div style={{
                  position: 'relative',
                  height: '200px',
                  margin: '20px 0',
                  backgroundColor: '#f8fafc',
                  borderRadius: '8px',
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
                        width: `${Math.max(1200, routeStops.length * 120 + 200)}px`,
                        height: '160px',
                        position: 'relative',
                        display: 'flex',
                        alignItems: 'center'
                      }}>
                      {/* Horizontal Route Line */}
                      <div style={{
                        width: `${Math.max(1000, routeStops.length * 120 - 50)}px`,
                        height: '6px',
                        backgroundColor: 'var(--primary-blue)',
                        position: 'absolute',
                        top: '50%',
                        left: '50px',
                        transform: 'translateY(-50%)',
                        borderRadius: '3px'
                      }}>
                        {/* Real-time bus position indicators */}
                        {isRealtimeActive && realtimeBuses.map((bus) => {
                          const routeLength = Math.max(1000, routeStops.length * 120 - 50);
                          const busPosition = 50 + (bus.progress / 100) * routeLength;
                          
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
                              transform: 'scaleX(-1)',
                              animation: bus.status === 'moving' ? 'bounce 1s infinite' : 'none'
                            }}>
                              🚌
                            </div>
                          );
                        })}
                      </div>
                      
                      {/* Route Stops */}
                      {routeStops.map((stop: any, index: number) => {
                        const position = 50 + (index * 120);
                        const isCurrent = stop.stop_id === closestStop?.id;
                        const isTransfer = stop.is_transfer || stop.stop_name.toLowerCase().includes('metro') || stop.stop_name.toLowerCase().includes('station');
                        const isFirst = index === 0;
                        const isLast = index === routeStops.length - 1;
                        
                        // Debug logging
                        if (isCurrent) {
                          console.log('Current stop found:', { stopId: stop.stop_id, closestStopId: closestStop?.id, stopName: stop.stop_name });
                        }
                        
                        return (
                          <div key={stop.stop_id} style={{
                            position: 'absolute',
                            left: `${position}px`,
                            top: '50%',
                            transform: 'translateY(-50%)',
                            textAlign: 'center',
                            zIndex: isCurrent ? 10 : 5
                          }}>
                            {/* Stop Marker */}
                            <div style={{
                              width: isCurrent ? '20px' : '16px',
                              height: isCurrent ? '20px' : '16px',
                              backgroundColor: isCurrent ? '#10b981' : // Green for current station
                                             isTransfer ? '#f59e0b' : // Orange for transfer stations
                                             'var(--primary-blue)', // Theme blue for regular stations
                              borderRadius: '50%',
                              margin: '0 auto',
                              border: isCurrent ? '3px solid white' : '2px solid white',
                              boxShadow: isCurrent ? '0 4px 12px rgba(16, 185, 129, 0.4)' : 
                                         isTransfer ? '0 2px 8px rgba(245, 158, 11, 0.3)' : 
                                         '0 2px 6px rgba(37, 99, 235, 0.3)',
                              animation: isCurrent ? 'pulse 2s infinite' : 'none',
                              position: 'absolute',
                              top: '50%',
                              left: '50%',
                              transform: 'translate(-50%, -50%)',
                              zIndex: 6
                            }}></div>
                            
                            {/* Station Type Label */}
                            <div style={{
                              fontSize: '8px',
                              fontWeight: 'bold',
                              color: isCurrent ? '#10b981' : 
                                     isTransfer ? '#f59e0b' : '#3b82f6',
                              marginTop: '-8px',
                              marginBottom: '4px',
                              textTransform: 'uppercase',
                              letterSpacing: '0.5px'
                            }}>
                              {isFirst ? 'START' : isLast ? 'END' : isTransfer ? 'TRANSFER' : 'STATION'}
                            </div>
                            
                       {/* Stop Name */}
                       <div style={{
                         fontSize: '11px',
                         color: isCurrent ? '#10b981' : '#374151',
                         fontWeight: isCurrent ? 'bold' : '600',
                         marginTop: '20px',
                         backgroundColor: 'rgba(255,255,255,0.95)',
                         padding: '6px 4px',
                         borderRadius: '6px',
                         border: isCurrent ? '2px solid #10b981' : '1px solid #e5e7eb',
                         writingMode: 'vertical-rl',
                         textOrientation: 'mixed',
                         wordBreak: 'break-word',
                         whiteSpace: 'normal',
                         minHeight: '60px',
                         display: 'flex',
                         alignItems: 'center',
                         justifyContent: 'center',
                         maxWidth: '70px',
                         position: 'absolute',
                         top: '50%',
                         left: '50%',
                         transform: 'translate(-50%, 0)',
                         zIndex: 4,
                         boxShadow: isCurrent ? '0 4px 12px rgba(16, 185, 129, 0.2)' : '0 2px 4px rgba(0,0,0,0.1)'
                       }}>
                         {stop.stop_name}
                       </div>
                       
                       {/* Transfer Routes for Transfer Stations */}
                       {isTransfer && stop.transfer_routes && stop.transfer_routes.length > 0 && (
                         <div style={{
                           position: 'absolute',
                           top: '50%',
                           left: '50%',
                           transform: 'translate(-50%, 120px)',
                           zIndex: 5,
                           backgroundColor: 'rgba(245, 158, 11, 0.9)',
                           color: 'white',
                           padding: '4px 8px',
                           borderRadius: '12px',
                           fontSize: '9px',
                           fontWeight: 'bold',
                           textAlign: 'center',
                           minWidth: '60px',
                           boxShadow: '0 2px 8px rgba(245, 158, 11, 0.3)'
                         }}>
                           <div style={{ marginBottom: '2px' }}>Transfer</div>
                           <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                             {stop.transfer_routes.slice(0, 3).map((route: any, idx: number) => (
                               <div key={idx} style={{ fontSize: '8px' }}>
                                 {route.route} → {route.destination}
                               </div>
                             ))}
                             {stop.transfer_routes.length > 3 && (
                               <div style={{ fontSize: '7px', opacity: 0.8 }}>
                                 +{stop.transfer_routes.length - 3} more
                               </div>
                             )}
                           </div>
                         </div>
                       )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  
                  {/* Legend */}
                  <div style={{
                    position: 'absolute',
                    bottom: '10px',
                    left: '10px',
                    right: '10px',
                    display: 'flex',
                    justifyContent: 'center',
                    gap: '20px',
                    fontSize: '11px',
                    color: 'var(--text-muted)',
                    backgroundColor: 'rgba(255,255,255,0.9)',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    backdropFilter: 'blur(4px)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <div style={{
                        width: '12px',
                        height: '12px',
                        borderRadius: '50%',
                        backgroundColor: '#10b981'
                      }}></div>
                      <span>Current</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <div style={{
                        width: '12px',
                        height: '12px',
                        borderRadius: '50%',
                        backgroundColor: '#f59e0b'
                      }}></div>
                      <span>Transfer</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <div style={{
                        width: '12px',
                        height: '12px',
                        borderRadius: '50%',
                        backgroundColor: 'var(--primary-blue)'
                      }}></div>
                      <span>Regular</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <div style={{ fontSize: '16px' }}>🚌</div>
                      <span>Bus</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <div style={{
                        width: '12px',
                        height: '12px',
                        borderRadius: '12px',
                        backgroundColor: 'rgba(245, 158, 11, 0.9)'
                      }}></div>
                      <span>Transfer Routes</span>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Route Info */}
              <div style={{
                fontSize: '12px',
                color: 'var(--text-muted)',
                textAlign: 'center',
                marginTop: '10px'
              }}>
                Route stops • {routeStops.length} stops • {realtimeBuses.length} buses online
              </div>
            </div>
          </div>
        </div>
      )}
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
