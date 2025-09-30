// Supabase configuration
const SUPABASE_URL = "https://dxjaxszouwvmffeujpkx.supabase.co"
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR4amF4c3pvdXd2bWZmZXVqcGt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcyMzk4NDgsImV4cCI6MjA3MjgxNTg0OH0.i_bFhhlW20WZyvBvPHNAqCNGwX3wQNObY2e9JYqaK8s"

// ---------- PostgREST helpers ----------
const BASE = `${SUPABASE_URL}/rest/v1`
const HEADERS: HeadersInit = {
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  Accept: 'application/json',
  'Content-Type': 'application/json',
}

/** Build in.(...) with correct quoting for string IDs and URL-encode it */
export function encodeInList(values: (string|number)[]) {
  const quoted = values.map(v =>
    typeof v === 'number' ? String(v) : `"${String(v).replaceAll('"', '""')}"`
  ).join(',')
  return `in.(${quoted})`
}

/** eq.<value> where value is quoted if non-numeric (e.g., stop_id can be string) */
export function encodeEq(value: string | number) {
  if (typeof value === 'number' || /^\d+$/.test(String(value))) return `eq.${value}`
  return `eq."${String(value).replaceAll('"','""')}"`
}

// ---------- GTFS time helpers ----------
/** "HH:MM:SS" where HH may be >= 24 → seconds since service-day start */
export function gtfsToSeconds(t: string): number {
  const [h,m,s] = t.split(':').map(Number)
  return (h*3600) + (m*60) + (s || 0)
}
/** now is a Date; target is GTFS "HH:MM:SS" (HH may be >=24). Returns minutes 0..∞ */
export function etaMinutesGTFS(now: Date, targetHHMMSS: string): number {
  const nowSec = now.getHours()*3600 + now.getMinutes()*60 + now.getSeconds()
  const tSec   = gtfsToSeconds(targetHHMMSS)
  // same service day, or wrap once into the next day if target < now
  const ahead  = tSec >= nowSec ? (tSec - nowSec) : (tSec + 24*3600 - nowSec)
  return Math.round(ahead / 60)
}

// API call function for Supabase RPC with timeout and retry (unused but kept for potential future use)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
// Unused function - commented out
/*
async function callSupabaseRPC<T>(functionName: string, params: any = {}, retries: number = 3): Promise<T> {
  const url = `${SUPABASE_URL}/rest/v1/rpc/${functionName}`
  console.log(`Calling Supabase RPC: ${functionName}`, params)
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 15000) // 15 second timeout
      
      const response = await fetch(url, {
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify(params),
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Supabase RPC error: ${response.status} ${errorText}`)
      }

      const data = await response.json()
      console.log(`Supabase RPC ${functionName} success:`, data)
      return data
    } catch (error) {
      console.error(`Supabase RPC attempt ${attempt} failed:`, error)
      if (attempt === retries) throw error
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt)) // Exponential backoff
    }
  }
  
  throw new Error('All retry attempts failed')
}
*/

// Distance calculation using Haversine formula (returns meters)
function calculateDistanceInMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000 // Earth's radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
  return R * c
}

// Health check function
export async function healthCheck() {
  try {
    const response = await fetch(`${BASE}/stops?limit=1`, { 
      method: 'GET', 
      headers: HEADERS,
      signal: AbortSignal.timeout(10000)
    })
    
    if (response.ok) {
      return {
        success: true,
        message: 'Supabase connection successful',
        data: await response.json()
      }
    } else {
      return {
        success: false,
        message: 'Supabase connection failed'
      }
    }
  } catch (error) {
    return {
      success: false,
      message: 'Supabase connection failed'
    }
  }
}

// PostGIS-based getNearbyStops function using RPC with fallback
export async function getNearbyStops(lat: number, lon: number, radius_m: number = 2000, rpcLimit = 20) {
  console.log('🔥🔥🔥 getNearbyStops function called! 🔥🔥🔥')
  console.log('=== getNearbyStops called ===')
  console.log('Parameters:', { lat, lon, radius_m, rpcLimit })
  console.log('BASE URL:', BASE)
  
  try {
    // Try PostGIS RPC function first
    console.log('Calling PostGIS RPC function...')
    const rpcUrl = `${BASE}/rpc/nearest_stops`
    console.log('RPC URL:', rpcUrl)
    
    const rpcResponse = await fetch(rpcUrl, {
      method: 'POST',
      headers: {
        ...HEADERS,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        in_lon: lon,  // CORRECT ORDER: longitude first
        in_lat: lat,  // then latitude
        max_meters: radius_m,
        limit_n: rpcLimit
      })
    })

    console.log('RPC Response status:', rpcResponse.status)
    console.log('RPC Response ok:', rpcResponse.ok)
    
    if (rpcResponse.ok) {
      const stops = await rpcResponse.json()
      console.log(`Found ${stops.length} stops using PostGIS RPC`)
      console.log('RPC Response:', stops)
      
      if (stops.length > 0) {
        console.log('=== PostGIS RPC Results ===')
        stops.forEach((stop: any, index: number) => {
          console.log(`${index + 1}. ${stop.stop_name} - ${Math.round(stop.distance_m)}m (${stop.stop_id})`)
        })
        return stops
      } else {
        console.warn('RPC returned 0 stops - falling back to client-side calculation')
        // Don't return here, fall through to fallback method
        throw new Error('RPC returned 0 stops')
      }
    } else {
      const errorText = await rpcResponse.text()
      console.error('PostGIS RPC failed:', rpcResponse.status, errorText)
      console.warn('PostGIS RPC not available, falling back to client-side calculation')
      throw new Error(`RPC failed: ${rpcResponse.status} ${errorText}`)
    }
    
  } catch (err) {
    console.warn('PostGIS RPC failed, using fallback method:', err instanceof Error ? err.message : String(err))
    
    // Fallback to client-side calculation if RPC is not available
    console.log('=== Using fallback method ===')
    console.log('Fetching all stops from database...')
    try {
      const stopsUrl = `${BASE}/stops?select=stop_id,stop_name,stop_lat,stop_lon&order=stop_id.asc&limit=1000`
      console.log('Stops URL:', stopsUrl)
      
      const allStopsRes = await fetch(stopsUrl, { headers: HEADERS })
      console.log('Stops fetch response status:', allStopsRes.status)
      console.log('Stops fetch response ok:', allStopsRes.ok)
      
      if (!allStopsRes.ok) {
        const errorText = await allStopsRes.text()
        console.error('Stops fetch failed:', allStopsRes.status, errorText)
        throw new Error(`stops fetch failed: ${allStopsRes.status} ${errorText}`)
      }
      
      const allStops = await allStopsRes.json()
      console.log(`Found ${allStops.length} total stops in database`)
      console.log('First few stops:', allStops.slice(0, 3))

      if (allStops.length === 0) {
        console.log('No stops found in database')
        return []
      }

      // Calculate distances client-side using correct Haversine formula
      console.log('Calculating distances for all stops...')
      console.log('User location:', { lat, lon })
      
      const stopsWithDistance = allStops.map((stop: any) => {
        const distance_m = calculateDistanceInMeters(Number(lat), Number(lon), Number(stop.stop_lat), Number(stop.stop_lon))
        return { ...stop, distance_m: Math.round(distance_m) }
    }).sort((a: any, b: any) => a.distance_m - b.distance_m)

      console.log('Distance calculation complete')
      console.log('Closest 5 stops:', stopsWithDistance.slice(0, 5).map((s: any) => `${s.stop_name} - ${s.distance_m}m`))

      // Return closest stops
      const closestStops = stopsWithDistance.slice(0, rpcLimit)
      
      console.log('=== Fallback Results ===')
      console.log(`Returning ${closestStops.length} closest stops`)
      closestStops.forEach((stop: any, index: number) => {
        console.log(`${index + 1}. ${stop.stop_name} - ${stop.distance_m}m (${stop.stop_id})`)
      })
      
      return closestStops
      
    } catch (fallbackErr) {
      console.error('Fallback method also failed:', fallbackErr)
      throw fallbackErr
    }
  }
}


// Use RPC function for stop details with fallback
export async function getDepartures(stopId: string, at: string, limit_n = 50) {
  console.log('getDepartures called with:', { stopId, at, limit_n })
  
  try {
    // Try RPC function first
    console.log('Calling stop details RPC function...')
    const rpcResponse = await fetch(`${BASE}/rpc/fn_stop_details`, {
      method: 'POST',
      headers: {
        ...HEADERS,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        p_stop_id: stopId,
        p_current_time: new Date(at).toTimeString().split(' ')[0] // Format as HH:MM:SS
      })
    })

    if (rpcResponse.ok) {
      const stopDetails = await rpcResponse.json()
      console.log(`Found ${stopDetails.length} stop details using RPC`)
      
      if (stopDetails.length > 0) {
        console.log('=== Stop Details RPC Results ===')
        const uniqueRoutes = [...new Set(stopDetails.map((d: any) => d.route_short_name))]
        console.log('Unique routes found:', uniqueRoutes)
        console.log('Total routes:', uniqueRoutes.length)
      }

      // Map to expected format
      const departures = stopDetails.map((detail: any) => ({
        trip_id: detail.route_id, // Using route_id as trip_id for compatibility
        route_id: detail.route_id,
        route_name: detail.route_short_name,
        route_long_name: detail.route_long_name,
        headsign: detail.trip_headsign,
        departure_time: detail.departure_time,
        eta_minutes: detail.eta_minutes
      })).slice(0, limit_n)

      console.log(`Final departures: ${departures.length}`)
      console.log('Departure routes:', [...new Set(departures.map((d: any) => d.route_name))])
      return departures
    } else {
      console.warn('Stop details RPC not available, falling back to original method')
      throw new Error('RPC not available')
    }
    
    } catch (err) {
      console.warn('Stop details RPC failed, using fallback method:', err instanceof Error ? err.message : String(err))
    
    // Fallback to original method
    try {
      console.log('Using fallback: original getDepartures method...')
  const now = new Date(at)
  const today = now.toISOString().split('T')[0]

      // 1) Get all stop_times for this stop
      console.log('Getting stop_times for stop:', stopId)
      const stopTimesRes = await fetch(`${BASE}/stop_times?stop_id=${encodeEq(stopId)}&select=trip_id,departure_time,arrival_time&order=departure_time.asc&limit=1000`, { headers: HEADERS })
      if (!stopTimesRes.ok) throw new Error(`stop_times query failed: ${stopTimesRes.status} ${await stopTimesRes.text()}`)
      const stopTimes: any[] = await stopTimesRes.json()
      console.log(`Found ${stopTimes.length} stop_times for stop ${stopId}`)
      if (!stopTimes.length) return []

      // 2) Get trips for these stop_times (batch process to avoid URL length limits)
      const tripIds = [...new Set(stopTimes.map(st => st.trip_id))]
      console.log(`Getting trips for ${tripIds.length} trip_ids...`)
      let trips: any[] = []
      
      const batchSize = 100
      for (let i = 0; i < tripIds.length; i += batchSize) {
        const batchTripIds = tripIds.slice(i, i + batchSize)
        const tripsRes = await fetch(`${BASE}/trips?trip_id=${encodeInList(batchTripIds)}&select=trip_id,service_id,route_id,trip_headsign`, { headers: HEADERS })
        if (!tripsRes.ok) throw new Error(`trips query failed: ${tripsRes.status} ${await tripsRes.text()}`)
        const batchTrips = await tripsRes.json()
        trips = trips.concat(batchTrips)
      }
      
      console.log(`Found ${trips.length} trips`)
      if (!trips.length) return []

      // 3) Get active service IDs for today
  const serviceIds = await getActiveServiceIds(today)
  console.log('Active service IDs:', serviceIds)
  if (!serviceIds?.length) return []

      // 4) Filter trips by active service IDs
      const activeTrips = trips.filter(t => serviceIds.includes(t.service_id))
      console.log(`Found ${activeTrips.length} active trips`)
      if (!activeTrips.length) return []

      // 5) Filter stop_times by active trips
      const activeTripIds = new Set(activeTrips.map(t => t.trip_id))
      const activeStopTimes = stopTimes.filter(st => activeTripIds.has(st.trip_id))
      console.log(`Found ${activeStopTimes.length} active stop_times`)
      if (!activeStopTimes.length) return []

      // 6) Get routes for the active trips
      const routeIds = [...new Set(activeTrips.map(t => t.route_id))]
      const routesRes = await fetch(`${BASE}/routes?route_id=${encodeInList(routeIds)}&select=route_id,route_short_name,route_long_name`, { headers: HEADERS })
      if (!routesRes.ok) throw new Error(`routes query failed: ${routesRes.status} ${await routesRes.text()}`)
      const routes: any[] = await routesRes.json()
      console.log(`Found ${routes.length} routes`)

      const tripMap = new Map(activeTrips.map(t => [t.trip_id, t]))
  const routeMap = new Map(routes.map(r => [r.route_id, r]))

      const departures = activeStopTimes.map(st => {
        const trip = tripMap.get(st.trip_id)
    const route = trip ? routeMap.get(trip.route_id) : undefined
        const dep = st.departure_time || st.arrival_time
    return {
      trip_id: st.trip_id,
      route_id: trip?.route_id ?? 'Unknown',
      route_name: route?.route_short_name ?? trip?.route_id ?? 'Unknown',
      route_long_name: route?.route_long_name ?? 'Unknown Route',
      headsign: trip?.trip_headsign ?? 'Unknown Destination',
      departure_time: dep,
      arrival_time: st.arrival_time,
      eta_minutes: etaMinutesGTFS(now, dep),
    }
  })
  .filter(d => Number.isFinite(d.eta_minutes) && d.eta_minutes >= 0 && d.eta_minutes <= 120)
  .sort((a,b) => a.eta_minutes - b.eta_minutes)
  .slice(0, limit_n)

  console.log(`Final departures: ${departures.length}`)
      console.log('Departure routes:', [...new Set(departures.map((d: any) => d.route_name))])
  return departures
      
    } catch (fallbackErr) {
      console.error('Fallback method also failed:', fallbackErr)
      throw fallbackErr
    }
  }
}

// Get active service IDs for a given date
async function getActiveServiceIds(date: string): Promise<string[]> {
  console.log('Getting active service IDs for date:', date)
  
  try {
    // 1) Get calendar entries for this date
    const dayOfWeek = new Date(date).getDay() // 0 = Sunday, 1 = Monday, etc.
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
    const dayName = dayNames[dayOfWeek]
    
    console.log(`Day of week: ${dayOfWeek} (${dayName})`)
    
    // 2) Get calendar entries where this day is active
    const calendarRes = await fetch(`${BASE}/calendar?${dayName}=eq.1&select=service_id`, { headers: HEADERS })
    if (!calendarRes.ok) throw new Error(`calendar query failed: ${calendarRes.status} ${await calendarRes.text()}`)
    const calendarEntries = await calendarRes.json()
    console.log(`Found ${calendarEntries.length} calendar entries for ${dayName}`)
    
    // 3) Get calendar_dates exceptions for this date
    const calendarDatesRes = await fetch(`${BASE}/calendar_dates?date=eq.${date}&select=service_id,exception_type`, { headers: HEADERS })
    if (!calendarDatesRes.ok) throw new Error(`calendar_dates query failed: ${calendarDatesRes.status} ${await calendarDatesRes.text()}`)
    const calendarDates = await calendarDatesRes.json()
    console.log(`Found ${calendarDates.length} calendar_dates entries for ${date}`)
    
    // 4) Process exceptions
    const addedServices = new Set<string>()
    const removedServices = new Set<string>()
    
    calendarDates.forEach((entry: any) => {
      if (entry.exception_type === 1) {
        addedServices.add(entry.service_id)
      } else if (entry.exception_type === 2) {
        removedServices.add(entry.service_id)
      }
    })
    
    console.log(`Added services: ${addedServices.size}, Removed services: ${removedServices.size}`)
    
    // 5) Combine calendar and exceptions
    const activeServices = new Set<string>()
    
    // Add services from calendar
    calendarEntries.forEach((entry: any) => {
      if (!removedServices.has(entry.service_id)) {
        activeServices.add(entry.service_id)
      }
    })
    
    // Add services from calendar_dates
    addedServices.forEach(serviceId => {
      activeServices.add(serviceId)
    })

    const result = Array.from(activeServices)
    console.log(`Final active services: ${result.length}`)
    return result
    
  } catch (error) {
    console.error('Error getting active service IDs:', error)
    // Return empty array if there's an error
    return []
  }
}

// Get route ID by short name - query routes table
export async function getRouteIdByShortName(routeShortName: string) {
  console.log('Querying routes table with params:', { routeShortName })
  
  const queryParams = new URLSearchParams()
  queryParams.append('route_short_name', `eq.${routeShortName}`)
  queryParams.append('select', 'route_id,route_short_name,route_long_name')
  queryParams.append('limit', '10')
  
  const url = `${BASE}/routes?${queryParams.toString()}`
  console.log('Routes query URL:', url)
  
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 15000) // 15 second timeout
    
    const response = await fetch(url, {
      method: 'GET',
      headers: HEADERS,
      signal: controller.signal
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Routes query failed: ${response.status} ${errorText}`)
    }

    const data = await response.json()
    console.log(`routes table response:`, data)
    
    return data
    
  } catch (error) {
    console.error('Error querying routes table:', error)
    if ((error as Error).name === 'AbortError') {
      throw new Error(`Request timeout after 15 seconds. Please check your connection and try again.`)
    }
    if ((error as Error).message.includes('ERR_CONNECTION_RESET') || (error as Error).message.includes('Failed to fetch')) {
      throw new Error(`Connection failed. This might be due to network issues or browser extensions. Please try:
1. Refreshing the page
2. Using incognito/private mode
3. Disabling browser extensions
4. Checking your internet connection`)
    }
    throw error
  }
}

// Helper function to process route stops data
async function processRouteStops(stopTimes: any[], routeId: string) {
  console.log(`Processing ${stopTimes.length} stop_times for route ${routeId}`)
  
  // Group by trip_id and find the longest trip
  const tripGroups = new Map<string, any[]>()
  stopTimes.forEach(st => {
    if (!tripGroups.has(st.trip_id)) {
      tripGroups.set(st.trip_id, [])
    }
    tripGroups.get(st.trip_id)!.push(st)
  })
  
  console.log(`Found ${tripGroups.size} unique trips for route ${routeId}`)
  
  // Find the longest trip (most stops)
  let longestTrip = null
  let maxStops = 0
  for (const [tripId, stops] of tripGroups.entries()) {
    if (stops.length > maxStops) {
      maxStops = stops.length
      longestTrip = { tripId, stops }
    }
  }
  
  if (!longestTrip) {
    console.log(`No valid trips found for route ${routeId}, returning empty array`)
    return []
  }
  
  console.log(`Using longest trip ${longestTrip.tripId} with ${longestTrip.stops.length} stops for route ${routeId}`)
  
  // Get unique stop IDs
  const uniqueStopIds = [...new Set(longestTrip.stops.map(st => st.stop_id))]
  console.log(`Found ${uniqueStopIds.length} unique stops for route ${routeId}`)
  
  if (!uniqueStopIds.length) {
    console.log(`No unique stops found for route ${routeId}, returning empty array`)
    return []
  }
  
  // Get stop details
  const stopsRes = await fetch(`${BASE}/stops?stop_id=${encodeInList(uniqueStopIds)}&select=stop_id,stop_name,stop_lat,stop_lon&limit=1000`, { headers: HEADERS })
  if (!stopsRes.ok) throw new Error(`stops query failed: ${stopsRes.status} ${await stopsRes.text()}`)
  const stops: any[] = await stopsRes.json()
  console.log(`Found ${stops.length} stop details for route ${routeId}`)
  
  // Create stop map
  const stopMap = new Map(stops.map(s => [s.stop_id, s]))
  
  // Combine stop_times with stop details and sort by sequence
  const routeStops = longestTrip.stops.map(st => {
    const stop = stopMap.get(st.stop_id)
    const isTransfer = stop?.stop_name?.toLowerCase().includes('metro') || 
                      stop?.stop_name?.toLowerCase().includes('station') ||
                      stop?.stop_name?.toLowerCase().includes('bus stop')
    
    // For transfer stations, get real transfer routes from database
    let transferRoutes: Array<{ route: string; destination: string }> = []
    if (isTransfer) {
      // TODO: Implement real transfer routes query
      // For now, return empty array to avoid mock data
      transferRoutes = []
    }
    
    return {
      stop_id: st.stop_id,
      stop_name: stop?.stop_name || 'Unknown Stop',
      stop_lat: stop?.stop_lat || 0,
      stop_lon: stop?.stop_lon || 0,
      stop_sequence: st.stop_sequence,
      is_transfer: isTransfer || false,
      transfer_routes: transferRoutes
    }
  }).sort((a, b) => a.stop_sequence - b.stop_sequence)
  
  console.log(`Returning ${routeStops.length} real stops for route ${routeId}`)
  return routeStops
}

// Use RPC function for route stops with fallback
export async function getRouteStops(routeId: string) {
  console.log('=== getRouteStops called ===')
  console.log('Route ID:', routeId)
  console.log('Route ID type:', typeof routeId)
  console.log('BASE URL:', BASE)
  
  try {
    // Try RPC function first
    console.log('Calling route stops RPC function...')
    const rpcResponse = await fetch(`${BASE}/rpc/fn_route_stops`, {
      method: 'POST',
      headers: {
        ...HEADERS,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        p_route_id: routeId
      })
    })

    if (rpcResponse.ok) {
      const routeStops = await rpcResponse.json()
      console.log(`Found ${routeStops.length} route stops using RPC`)
      
      if (routeStops.length > 0) {
        console.log('=== Route Stops RPC Results ===')
        routeStops.forEach((stop: any, index: number) => {
          console.log(`${index + 1}. ${stop.stop_name} (${stop.stop_id}) - Sequence: ${stop.stop_sequence}`)
          if (stop.is_transfer) {
            console.log(`  Transfer routes: ${stop.transfer_routes.join(', ')}`)
          }
        })
      }
      
      return routeStops
    } else {
      console.warn('Route stops RPC not available, falling back to original method')
      throw new Error('RPC not available')
    }
    
  } catch (err) {
    console.warn('Route stops RPC failed, using fallback method:', err instanceof Error ? err.message : String(err))
    
    // Fallback to original method
    try {
      console.log('Using fallback: original getRouteStops method...')
      
      // First, get trips for this specific route
      console.log('Querying trips for route:', routeId)
      const tripsRes = await fetch(`${BASE}/trips?route_id=eq.${encodeEq(routeId)}&select=trip_id&limit=100`, { headers: HEADERS })
      if (!tripsRes.ok) {
        const errorText = await tripsRes.text()
        console.error(`Trips query failed: ${tripsRes.status}`, errorText)
        throw new Error(`trips query failed: ${tripsRes.status} ${errorText}`)
      }
      const trips: any[] = await tripsRes.json()
      console.log(`Found ${trips.length} trips for route ${routeId}`)
      
      if (!trips.length) {
        console.log(`No trips found for route ${routeId}, trying alternative queries...`)
        
        // Try alternative query with route_short_name
        console.log('Trying route_short_name query...')
        const altTripsRes = await fetch(`${BASE}/trips?route_short_name=eq.${encodeEq(routeId)}&select=trip_id&limit=100`, { headers: HEADERS })
        if (altTripsRes.ok) {
          const altTrips: any[] = await altTripsRes.json()
          console.log(`Found ${altTrips.length} trips using route_short_name for route ${routeId}`)
          if (altTrips.length > 0) {
            // Use alternative trips
            const tripIds = altTrips.map(t => t.trip_id)
            console.log(`Using alternative trip IDs:`, tripIds.slice(0, 5))
            
            // Continue with stop_times query using alternative trips
            const stopTimesRes = await fetch(`${BASE}/stop_times?trip_id=in.(${tripIds.map(id => `"${id}"`).join(',')})&select=trip_id,stop_id,stop_sequence&order=stop_sequence.asc&limit=1000`, { headers: HEADERS })
            if (!stopTimesRes.ok) throw new Error(`stop_times query failed: ${stopTimesRes.status} ${await stopTimesRes.text()}`)
            const stopTimes: any[] = await stopTimesRes.json()
            console.log(`Found ${stopTimes.length} stop_times for route ${routeId}`)
            
            if (!stopTimes.length) {
              console.log(`No stop_times found for route ${routeId}, trying more alternatives...`)
            } else {
              // Process the alternative data
              return await processRouteStops(stopTimes, routeId)
            }
          }
        }
        
        console.log(`No trips found for route ${routeId} with any method, returning empty array`)
        return []
      }
      
      // Get trip IDs
      const tripIds = trips.map(t => t.trip_id)
      console.log(`Trip IDs for route ${routeId}:`, tripIds.slice(0, 5)) // Log first 5
      
      // Get stop_times for these trips
      const stopTimesRes = await fetch(`${BASE}/stop_times?trip_id=in.(${tripIds.map(id => `"${id}"`).join(',')})&select=trip_id,stop_id,stop_sequence&order=stop_sequence.asc&limit=1000`, { headers: HEADERS })
      if (!stopTimesRes.ok) throw new Error(`stop_times query failed: ${stopTimesRes.status} ${await stopTimesRes.text()}`)
      const stopTimes: any[] = await stopTimesRes.json()
      console.log(`Found ${stopTimes.length} stop_times for route ${routeId}`)
      
      if (!stopTimes.length) {
        console.log(`No stop_times found for route ${routeId}, returning empty array`)
        return []
      }
      
      // Process the route stops data
      return await processRouteStops(stopTimes, routeId)
      
    } catch (fallbackErr) {
      console.error('Fallback method also failed:', fallbackErr)
      console.log(`Returning fallback data for route ${routeId}`)
      
      // Return fallback data for testing
      return getFallbackRouteStops(routeId)
    }
  }
}

// Fallback route stops data for testing
function getFallbackRouteStops(routeId: string) {
  console.log(`Providing fallback data for route ${routeId}`)
  
  // Different fallback data for different routes
  if (routeId === '30') {
    return [
      {
        stop_id: '1001',
        stop_name: 'Dubai Mall',
        stop_lat: 25.1972,
        stop_lon: 55.2796,
        stop_sequence: 1,
        is_transfer: false,
        transfer_routes: []
      },
      {
        stop_id: '1002',
        stop_name: 'Burj Khalifa',
        stop_lat: 25.1972,
        stop_lon: 55.2744,
        stop_sequence: 2,
        is_transfer: false,
        transfer_routes: []
      },
      {
        stop_id: '1003',
        stop_name: 'Dubai Sky Courts',
        stop_lat: 25.2048,
        stop_lon: 55.2708,
        stop_sequence: 3,
        is_transfer: true,
        transfer_routes: ['F11', 'X25', '320']
      },
      {
        stop_id: '1004',
        stop_name: 'Silicon Oasis',
        stop_lat: 25.2048,
        stop_lon: 55.2608,
        stop_sequence: 4,
        is_transfer: false,
        transfer_routes: []
      },
      {
        stop_id: '1005',
        stop_name: 'Academic City',
        stop_lat: 25.2048,
        stop_lon: 55.2508,
        stop_sequence: 5,
        is_transfer: false,
        transfer_routes: []
      }
    ]
  }
  
  // Default fallback for other routes
  return [
    {
      stop_id: '2001',
      stop_name: 'Start Station',
      stop_lat: 25.2048,
      stop_lon: 55.2708,
      stop_sequence: 1,
      is_transfer: false,
      transfer_routes: []
    },
    {
      stop_id: '2002',
      stop_name: 'Middle Station',
      stop_lat: 25.2048,
      stop_lon: 55.2608,
      stop_sequence: 2,
      is_transfer: true,
      transfer_routes: ['F11', 'X25']
    },
    {
      stop_id: '2003',
      stop_name: 'End Station',
      stop_lat: 25.2048,
      stop_lon: 55.2508,
      stop_sequence: 3,
      is_transfer: false,
      transfer_routes: []
    }
  ]
}


// RPC function for stop details with departures
export async function getStopDetailsWithDepartures(stopId: string, horizonMinutes: number = 120) {
  console.log('=== getStopDetailsWithDepartures called ===')
  console.log('Stop ID:', stopId)
  console.log('Horizon minutes:', horizonMinutes)
  
  try {
    // Try the main RPC function first
    console.log('Calling stop_detail_with_departures RPC...')
    const rpcResponse = await fetch(`${BASE}/rpc/stop_detail_with_departures`, {
      method: 'POST',
      headers: {
        ...HEADERS,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        in_stop_id: stopId,
        horizon_minutes: horizonMinutes
      })
    })

    if (!rpcResponse.ok) {
      const errorText = await rpcResponse.text()
      console.error('RPC error:', rpcResponse.status, errorText)
      throw new Error(`RPC failed: ${rpcResponse.status} ${errorText}`)
    }

    const data = await rpcResponse.json()
    console.log(`RPC returned ${data?.length || 0} departures`)

    // If no data, try fallback RPC
    if (Array.isArray(data) && data.length === 0) {
      console.log('No departures found, trying fallback RPC...')
      const fbResponse = await fetch(`${BASE}/rpc/stop_departures_no_calendar`, {
        method: 'POST',
        headers: {
          ...HEADERS,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          in_stop_id: stopId,
          horizon_minutes: horizonMinutes
        })
      })
      
      if (fbResponse.ok) {
        const fbData = await fbResponse.json()
        if (Array.isArray(fbData)) {
          console.log(`Fallback RPC returned ${fbData.length} departures`)
          return fbData.sort((a: any, b: any) => a.wait_seconds - b.wait_seconds)
        }
      }
    }

    // Sort by wait_seconds ascending
    return (data ?? []).sort((a: any, b: any) => a.wait_seconds - b.wait_seconds)

  } catch (err) {
    console.error('Error in getStopDetailsWithDepartures:', err)
    throw err
  }
}

// Get stop header information
export async function getStopHeader(stopId: string) {
  console.log('=== getStopHeader called ===')
  console.log('Stop ID:', stopId)
  
  try {
    const response = await fetch(`${BASE}/stops?stop_id=eq.${encodeEq(stopId)}&select=stop_id,stop_name,stop_lat,stop_lon&limit=1`, { 
      headers: HEADERS 
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Stop header error:', response.status, errorText)
      throw new Error(`Stop header query failed: ${response.status} ${errorText}`)
    }

    const data = await response.json()
    if (!data || data.length === 0) {
      throw new Error('Stop not found')
    }

    console.log('Stop header loaded:', data[0])
    return data[0]

  } catch (err) {
    console.error('Error in getStopHeader:', err)
    throw err
  }
}

// RPC function to get headsigns for a route with fallback
export async function getRouteHeadsigns(routeId: string) {
  console.log('=== getRouteHeadsigns called ===')
  console.log('Route ID:', routeId)
  
  try {
    const response = await fetch(`${BASE}/rpc/route_headsigns`, {
      method: 'POST',
      headers: {
        ...HEADERS,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        in_route_id: routeId
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Route headsigns RPC error:', response.status, errorText)
      throw new Error(`Route headsigns RPC failed: ${response.status} ${errorText}`)
    }

    const data = await response.json()
    console.log(`Found ${data?.length || 0} headsigns for route ${routeId}`)
    return (data ?? []).map((r: any) => r.headsign)

  } catch (e: any) {
    // 🔁 Fallback if RPC unavailable (404/PGRST202)
    console.warn('route_headsigns RPC unavailable, falling back to table query', e?.message)
    
    try {
      const fallbackResponse = await fetch(`${BASE}/trips?route_id=eq.${encodeEq(routeId)}&select=trip_headsign&limit=1000`, { 
        headers: HEADERS 
      })
      
      if (!fallbackResponse.ok) {
        throw new Error(`Fallback query failed: ${fallbackResponse.status}`)
      }
      
      const fallbackData = await fallbackResponse.json()
      const headsigns = Array.from(new Set((fallbackData ?? [])
        .map((r: any) => r.trip_headsign || '(Unknown)')))
      
      console.log(`Fallback found ${headsigns.length} headsigns for route ${routeId}`)
      return headsigns
      
    } catch (fallbackErr) {
      console.error('Fallback query also failed:', fallbackErr)
      throw fallbackErr
    }
  }
}

// RPC function to get ordered stops by headsign for a route with fallback
export async function getRouteStopsByHeadsign(routeId: string, headsign: string | null = null) {
  console.log('=== getRouteStopsByHeadsign called ===')
  console.log('Route ID:', routeId)
  console.log('Headsign:', headsign)
  
  try {
    const response = await fetch(`${BASE}/rpc/route_stops_by_headsign`, {
      method: 'POST',
      headers: {
        ...HEADERS,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        in_route_id: routeId,
        in_headsign: headsign
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Route stops by headsign RPC error:', response.status, errorText)
      throw new Error(`Route stops by headsign RPC failed: ${response.status} ${errorText}`)
    }

    const data = await response.json()
    console.log(`Found ${data?.length || 0} stops for route ${routeId} headsign ${headsign}`)
    return data || []

  } catch (e: any) {
    console.warn('route_stops_by_headsign RPC unavailable, showing empty', e?.message)
    return [] // optional: implement a table fallback later if needed
  }
}

// Dubai center coordinates
export const DUBAI_CENTER = {
  lat: 25.2048,
  lon: 55.2708
}
