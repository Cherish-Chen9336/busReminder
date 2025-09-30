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

// --- replace existing getNearbyStops with this ---
export async function getNearbyStops(lat: number, lon: number, radius_m: number = 500, rpcLimit = 50) {
  console.log('getNearbyStops called with:', { lat, lon, radius_m, rpcLimit })
  if (typeof lat !== 'number' || typeof lon !== 'number') {
    throw new Error('Invalid coordinates passed to getNearbyStops')
  }
  
  // Validate coordinates are reasonable for Dubai
  if (lat < 24.5 || lat > 25.5 || lon < 54.5 || lon > 56.0) {
    console.warn('Coordinates seem outside Dubai area:', { lat, lon })
  }

  try {
    // 1) First get ALL stops within a reasonable radius (not just those with stop_times)
    console.log('Getting all stops within radius...')
    const allStopsRes = await fetch(`${BASE}/stops?select=stop_id,stop_name,stop_lat,stop_lon&limit=1000`, { headers: HEADERS })
    if (!allStopsRes.ok) throw new Error(`stops fetch failed: ${allStopsRes.status} ${await allStopsRes.text()}`)
    const allStops = await allStopsRes.json()
    console.log(`Found ${allStops.length} total stops`)

    if (allStops.length === 0) {
      console.log('No stops found')
      return []
    }

    // 2) Calculate distances for ALL stops and sort by distance
    console.log('Calculating distances for all stops...')
    const stopsWithDistance = allStops.map((stop: any) => {
      const dKm = calculateDistance(Number(lat), Number(lon), Number(stop.stop_lat), Number(stop.stop_lon))
      return { ...stop, distance_m: Math.round(dKm * 1000) }
    }).sort((a: any, b: any) => a.distance_m - b.distance_m)

    console.log('All stops with distances (first 10):', stopsWithDistance.slice(0, 10).map((s: any) => ({ stop_id: s.stop_id, stop_name: s.stop_name, distance_m: s.distance_m })))
    
    // 3) First, try to get stops within radius (regardless of bus data)
    const withinRadius = stopsWithDistance.filter((s: any) => s.distance_m <= radius_m)
    console.log(`Found ${withinRadius.length} stops within ${radius_m}m radius`)
    
    // 4) If we have stops within radius, return them (even if they don't have bus data)
    if (withinRadius.length > 0) {
      console.log('Returning stops within radius:', withinRadius.length)
      return withinRadius.slice(0, 20)
    }
    
    // 5) If no stops within radius, return the closest stops (regardless of bus data)
    console.log('No stops within radius, returning closest stops...')
    console.log('Closest stops (first 5):', stopsWithDistance.slice(0, 5).map((s: any) => ({ stop_id: s.stop_id, stop_name: s.stop_name, distance_m: s.distance_m })))
    
    return stopsWithDistance.slice(0, Math.min(20, stopsWithDistance.length))
    
  } catch (err) {
    console.error('getNearbyStops error:', err)
    throw err
  }
}
// --- end replacement ---

// Calculate distance between two points using Haversine formula
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371 // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
  return R * c
}

export async function getDepartures(stopId: string, at: string, limit_n = 20) {
  console.log('getDepartures called with:', { stopId, at, limit_n })
  const now = new Date(at)
  const today = now.toISOString().split('T')[0]

  try {
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
    return departures
  } catch (err) {
    console.error('getDepartures error:', err)
    throw err
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

// Get route stops for a specific route
export async function getRouteStops(routeId: string) {
  console.log('getRouteStops called with:', { routeId })
  
  try {
    // 1) Get all trips for this route
    const tripsRes = await fetch(`${BASE}/trips?route_id=${encodeEq(routeId)}&select=trip_id,service_id&limit=1000`, { headers: HEADERS })
    if (!tripsRes.ok) throw new Error(`trips query failed: ${tripsRes.status} ${await tripsRes.text()}`)
    const trips: any[] = await tripsRes.json()
    console.log(`Found ${trips.length} trips for route ${routeId}`)
    
    if (!trips.length) return []
    
    // 2) Get active service IDs for today
    const today = new Date().toISOString().split('T')[0]
    const serviceIds = await getActiveServiceIds(today)
    console.log('Active service IDs:', serviceIds)
    
    if (!serviceIds?.length) return []
    
    // 3) Filter trips by active service IDs
    const activeTrips = trips.filter(t => serviceIds.includes(t.service_id))
    console.log(`Found ${activeTrips.length} active trips`)
    
    if (!activeTrips.length) return []
    
    // 4) Get stop_times for active trips
    const tripIds = activeTrips.map(t => t.trip_id)
    const batchSize = 100
    let allStopTimes: any[] = []
    
    for (let i = 0; i < tripIds.length; i += batchSize) {
      const batchTripIds = tripIds.slice(i, i + batchSize)
      const stopTimesRes = await fetch(`${BASE}/stop_times?trip_id=${encodeInList(batchTripIds)}&select=stop_id,stop_sequence,trip_id&order=stop_sequence.asc&limit=1000`, { headers: HEADERS })
      if (!stopTimesRes.ok) throw new Error(`stop_times query failed: ${stopTimesRes.status} ${await stopTimesRes.text()}`)
      const batchStopTimes = await stopTimesRes.json()
      allStopTimes = allStopTimes.concat(batchStopTimes)
    }
    
    console.log(`Found ${allStopTimes.length} stop_times for active trips`)
    
    // 5) Get unique stop IDs and their details
    const uniqueStopIds = [...new Set(allStopTimes.map(st => st.stop_id))]
    console.log(`Found ${uniqueStopIds.length} unique stops`)
    
    if (!uniqueStopIds.length) return []
    
    // 6) Get stop details
    const stopsRes = await fetch(`${BASE}/stops?stop_id=${encodeInList(uniqueStopIds)}&select=stop_id,stop_name,stop_lat,stop_lon&limit=1000`, { headers: HEADERS })
    if (!stopsRes.ok) throw new Error(`stops query failed: ${stopsRes.status} ${await stopsRes.text()}`)
    const stops: any[] = await stopsRes.json()
    console.log(`Found ${stops.length} stop details`)
    
    // 7) Create stop sequence map
    const stopSequenceMap = new Map<string, number[]>()
    allStopTimes.forEach(st => {
      if (!stopSequenceMap.has(st.stop_id)) {
        stopSequenceMap.set(st.stop_id, [])
      }
      stopSequenceMap.get(st.stop_id)!.push(st.stop_sequence)
    })
    
    // 8) Calculate average sequence for each stop and sort
    const stopsWithSequence = stops.map(stop => {
      const sequences = stopSequenceMap.get(stop.stop_id) || []
      const avgSequence = sequences.length > 0 ? sequences.reduce((a, b) => a + b, 0) / sequences.length : 0
      return {
        ...stop,
        stop_sequence: avgSequence
      }
    }).sort((a, b) => a.stop_sequence - b.stop_sequence)
    
    console.log(`Returning ${stopsWithSequence.length} stops for route ${routeId}`)
    return stopsWithSequence
    
  } catch (err) {
    console.error('getRouteStops error:', err)
    throw err
  }
}

// Dubai center coordinates
export const DUBAI_CENTER = {
  lat: 25.2048,
  lon: 55.2708
}
