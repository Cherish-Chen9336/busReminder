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
      console.log(`Attempt ${attempt}/${retries} for ${functionName}`)
      
      // Create AbortController for timeout
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 15000) // 15 second timeout
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify(params),
        signal: controller.signal,
        mode: 'cors',
        cache: 'no-cache'
      })

      clearTimeout(timeoutId)
      console.log(`Response status: ${response.status} ${response.statusText}`)

      if (!response.ok) {
        const errorText = await response.text()
        console.error('Supabase error response:', errorText)
        
        // If it's a server error (5xx) and we have retries left, retry
        if (response.status >= 500 && attempt < retries) {
          console.log(`Server error, retrying in ${attempt * 2000}ms...`)
          await new Promise(resolve => setTimeout(resolve, attempt * 2000))
          continue
        }
        
        throw new Error(`Supabase RPC call failed: ${response.status} ${response.statusText} - ${errorText}`)
      }

      const data = await response.json()
      console.log(`RPC ${functionName} response:`, data)
      return data
      
    } catch (error) {
      console.error(`Attempt ${attempt} failed:`, error)
      
      // If it's the last attempt or not a network error, throw
      if (attempt === retries || (error as Error).name === 'AbortError') {
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
      
      // Wait before retry with exponential backoff
      const delay = Math.min(attempt * 2000, 10000) // Max 10 seconds
      console.log(`Waiting ${delay}ms before retry...`)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
  
  throw new Error('All retry attempts failed')
}

// Dubai center coordinates as fallback
export const DUBAI_CENTER = {
  lat: 25.2048,
  lon: 55.2708
}

// Health check function
export async function healthCheck() {
  try {
    console.log('Performing health check with Dubai center coordinates...')
    const result = await getNearbyStops(DUBAI_CENTER.lat, DUBAI_CENTER.lon, 1000)
    console.log('Health check result:', result)
    console.log('Health check result type:', typeof result)
    console.log('Health check result length:', Array.isArray(result) ? result.length : 'Not an array')
    if (Array.isArray(result) && result.length > 0) {
      console.log('First stop in health check:', result[0])
      console.log('First stop ID:', result[0]?.stop_id)
      
      // Test departures for the first stop
      if (result[0]?.stop_id) {
        console.log('Testing departures for stop:', result[0].stop_id)
        const departuresResult = await getDepartures(result[0].stop_id, new Date().toISOString(), 5)
        console.log('Departures test result:', departuresResult)
      }
    }
    return {
      success: true,
      data: result,
      message: 'Supabase connection successful'
    }
  } catch (error) {
    console.error('Health check failed:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'Supabase connection failed'
    }
  }
}

// Get nearby stops by querying stops table directly
export async function getNearbyStops(lat: number, lon: number, radius_m: number = 2000) {
  console.log('Querying nearby stops with params:', { lat, lon, radius_m })
  
  try {
    // Get all stops first, then calculate distances client-side
    const queryParams = new URLSearchParams()
    queryParams.append('select', 'stop_id,stop_name,stop_lat,stop_lon')
    queryParams.append('limit', '200') // Get more stops to filter from
    
    const url = `${BASE}/stops?${queryParams.toString()}`
    console.log(`Querying stops table:`, { url, lat, lon })
    
    const response = await fetch(url, {
      method: 'GET',
      headers: HEADERS,
      mode: 'cors',
      cache: 'no-cache'
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Stops query error:', errorText)
      throw new Error(`Failed to get nearby stops: ${response.status} - ${errorText}`)
    }

    const stops = await response.json()
    console.log('All stops found:', stops)
    console.log('Number of stops retrieved:', stops.length)

    // Calculate distances and filter by radius
    const stopsWithDistance = stops.map((stop: any) => {
      const distance = calculateDistance(lat, lon, stop.stop_lat, stop.stop_lon)
      const distanceM = Math.round(distance * 1000) // Convert to meters
      console.log(`Stop ${stop.stop_id} (${stop.stop_name}): ${distanceM}m away`)
      return {
        ...stop,
        distance_m: distanceM
      }
    })
    .sort((a: any, b: any) => a.distance_m - b.distance_m) // Sort by distance first
    
    // If no stops within radius, expand the search or take the closest ones
    let filteredStops = stopsWithDistance.filter((stop: any) => stop.distance_m <= radius_m)
    console.log(`Stops within ${radius_m}m radius:`, filteredStops.length)
    
    // If no stops found within radius, take the 10 closest stops regardless of distance
    if (filteredStops.length === 0) {
      console.log('No stops within radius, taking closest stops regardless of distance')
      filteredStops = stopsWithDistance.slice(0, 10)
      console.log('Closest stops selected:', filteredStops.map((s: any) => `${s.stop_name} (${s.distance_m}m)`))
    }
    
    const finalStops = filteredStops.slice(0, 20) // Limit to 20 closest stops

    console.log('Final stops selected:', finalStops.length, 'stops')
    console.log('Final stops details:', finalStops.map((s: any) => `${s.stop_name} (${s.distance_m}m)`))
    return finalStops
    
  } catch (error) {
    console.error('Error querying nearby stops:', error)
    throw error
  }
}

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

  // 1) service_ids active today
  const serviceIds = await getActiveServiceIds(today)
  console.log('Active service IDs:', serviceIds)
  if (!serviceIds?.length) return []

  // 2) trips for those services (limit to prevent URL too long error)
  const qTrips = new URLSearchParams()
  qTrips.append('service_id', encodeInList(serviceIds))
  qTrips.append('select', 'trip_id,route_id,trip_headsign')
  qTrips.append('limit', '200') // Reduced limit to prevent URL too long
  const tripsRes = await fetch(`${BASE}/trips?${qTrips.toString()}`, { headers: HEADERS })
  if (!tripsRes.ok) throw new Error(`Trips query failed: ${tripsRes.status} ${await tripsRes.text()}`)
  const trips: any[] = await tripsRes.json()
  console.log('Trips found:', trips.length)
  if (!trips.length) return []

  // 3) stop_times for this stop + those trips (batch process if too many trips)
  const tripIds = trips.map(t => t.trip_id)
  let allStopTimes: any[] = []
  
  // Process trips in batches to avoid URL length limits
  const batchSize = 50 // Process 50 trips at a time
  console.log(`Processing ${tripIds.length} trips in batches of ${batchSize}`)
  for (let i = 0; i < tripIds.length; i += batchSize) {
    const batchTripIds = tripIds.slice(i, i + batchSize)
    console.log(`Processing batch ${Math.floor(i/batchSize) + 1}: ${batchTripIds.length} trips`)
    
    const qST = new URLSearchParams()
    qST.append('trip_id', encodeInList(batchTripIds))
    qST.append('stop_id', encodeEq(stopId))
    qST.append('select', 'trip_id,departure_time,arrival_time,stop_sequence')
    qST.append('order', 'departure_time.asc')
    qST.append('limit', String(limit_n * 2)) // fetch extra per batch
    
    const stRes = await fetch(`${BASE}/stop_times?${qST.toString()}`, { headers: HEADERS })
    if (!stRes.ok) throw new Error(`stop_times query failed: ${stRes.status} ${await stRes.text()}`)
    const batchStopTimes: any[] = await stRes.json()
    console.log(`Batch ${Math.floor(i/batchSize) + 1} returned ${batchStopTimes.length} stop times`)
    allStopTimes = allStopTimes.concat(batchStopTimes)
    
    // If we have enough results, break early
    if (allStopTimes.length >= limit_n * 3) break
  }
  
  console.log(`Total stop times found: ${allStopTimes.length}`)
  if (!allStopTimes.length) return []

  // 4) routes for the referenced trips
  const routeIds = [...new Set(trips.map(t => t.route_id))]
  const qRoutes = new URLSearchParams()
  qRoutes.append('route_id', encodeInList(routeIds))
  qRoutes.append('select', 'route_id,route_short_name,route_long_name')
  const rRes = await fetch(`${BASE}/routes?${qRoutes.toString()}`, { headers: HEADERS })
  if (!rRes.ok) throw new Error(`routes query failed: ${rRes.status} ${await rRes.text()}`)
  const routes: any[] = await rRes.json()
  console.log('Routes found:', routes.length)

  const tripMap  = new Map(trips.map(t => [t.trip_id, t]))
  const routeMap = new Map(routes.map(r => [r.route_id, r]))

  const departures = allStopTimes.map(st => {
    const trip  = tripMap.get(st.trip_id)
    const route = trip ? routeMap.get(trip.route_id) : undefined
    const dep   = st.departure_time || st.arrival_time
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
}

// Get active service IDs for a given date
async function getActiveServiceIds(date: string): Promise<string[]> {
  console.log('Getting active service IDs for date:', date)
  
  try {
    const dayOfWeek = new Date(date).getDay() // 0 = Sunday, 1 = Monday, etc.
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
    const dayName = dayNames[dayOfWeek]
    
    console.log('Day of week:', dayOfWeek, 'Day name:', dayName)
    
    // Query calendar table for services active on this day
    let calendarQueryParams = new URLSearchParams()
    calendarQueryParams.append('select', 'service_id')
    calendarQueryParams.append(dayName, 'eq.1')
    calendarQueryParams.append('start_date', `lte.${date}`)
    calendarQueryParams.append('end_date', `gte.${date}`)
    
    const calendarUrl = `${BASE}/calendar?${calendarQueryParams.toString()}`
    console.log(`Querying calendar table:`, { url: calendarUrl })
    
    const calendarResponse = await fetch(calendarUrl, {
      method: 'GET',
      headers: HEADERS,
      mode: 'cors',
      cache: 'no-cache'
    })

    if (!calendarResponse.ok) {
      const errorText = await calendarResponse.text()
      console.error('Calendar query error:', errorText)
      throw new Error(`Failed to get calendar: ${calendarResponse.status} - ${errorText}`)
    }

    const calendarServices = await calendarResponse.json()
    console.log('Calendar services found:', calendarServices)

    // Query calendar_dates for exceptions
    let calendarDatesQueryParams = new URLSearchParams()
    calendarDatesQueryParams.append('select', 'service_id,exception_type')
    calendarDatesQueryParams.append('date', `eq.${date}`)
    
    const calendarDatesUrl = `${BASE}/calendar_dates?${calendarDatesQueryParams.toString()}`
    console.log(`Querying calendar_dates table:`, { url: calendarDatesUrl })
    
    const calendarDatesResponse = await fetch(calendarDatesUrl, {
      method: 'GET',
      headers: HEADERS,
      mode: 'cors',
      cache: 'no-cache'
    })

    let calendarDates = []
    if (calendarDatesResponse.ok) {
      calendarDates = await calendarDatesResponse.json()
      console.log('Calendar dates found:', calendarDates)
    } else {
      console.log('No calendar_dates table or no exceptions for this date')
    }

    // Process services
    const activeServices = new Set<string>()
    
    // Add services from calendar
    calendarServices.forEach((service: any) => {
      activeServices.add(service.service_id)
    })
    
    // Handle calendar_dates exceptions
    calendarDates.forEach((exception: any) => {
      if (exception.exception_type === 1) {
        // Service added for this date
        activeServices.add(exception.service_id)
      } else if (exception.exception_type === 2) {
        // Service removed for this date
        activeServices.delete(exception.service_id)
      }
    })

    const result = Array.from(activeServices)


    console.log('Final active service IDs 今天服务ID:', result)
    return result
    
  } catch (error) {
    console.error('Error getting active service IDs:', error)
    // Return empty array if there's an error
    return []
  }
}


// Get route stops for a specific route - using stop_times and stops tables
// Paste this in src/lib/supabase.ts (or the file where getRouteStops lives).
// It expects BASE, HEADERS, encodeInList and encodeEq helpers to exist nearby.

export async function getRouteStops(
  routeId: string,
  serviceDate?: string,
  direction?: number,
  maxTrips: number = 50
) {
  console.log('getRouteStops called with:', { routeId, serviceDate, direction, maxTrips })

  try {
    // 1) Optionally compute active service IDs for the serviceDate
    let activeServiceIds: string[] = []
    if (serviceDate) {
      try {
        activeServiceIds = await getActiveServiceIds(serviceDate)
        console.log('Active service IDs for', serviceDate, ':', activeServiceIds)
      } catch (err) {
        console.warn('Failed to get active service ids, continuing without service filter', err)
      }
    }

    // 2) Build trips query: filter by route_id + optional service_id + optional direction
    const tripsParams = new URLSearchParams()
    // route_id is a string in GTFS: use encodeEq to quote if needed
    tripsParams.append('route_id', encodeEq(routeId))
    if (activeServiceIds && activeServiceIds.length) {
      tripsParams.append('service_id', encodeInList(activeServiceIds))
    }
    if (typeof direction === 'number') {
      // direction_id is usually numeric 0/1 in GTFS
      tripsParams.append('direction_id', `eq.${direction}`)
    }
    tripsParams.append('select', 'trip_id,service_id,trip_headsign,route_id,direction_id')
    tripsParams.append('limit', String(Math.max(100, maxTrips))) // fetch more to avoid truncation

    const tripsUrl = `${BASE}/trips?${tripsParams.toString()}`
    console.log('Trips URL:', tripsUrl)

    const tripsRes = await fetch(tripsUrl, { method: 'GET', headers: HEADERS })
    if (!tripsRes.ok) {
      const errTxt = await tripsRes.text()
      throw new Error(`Trips query failed: ${tripsRes.status} ${errTxt}`)
    }
    const trips: any[] = await tripsRes.json()
    console.log('Trips returned:', trips.length, trips.slice(0, 5))

    if (!trips.length) {
      console.log('No trips found for route:', routeId)
      return []
    }

    // 3) Prefer a trip that matches the direction if specified, else use first trip
    let chosenTripId: string | undefined
    if (typeof direction === 'number') {
      const match = trips.find(t => Number(t.direction_id) === Number(direction))
      chosenTripId = match?.trip_id
      console.log('Trip matching direction:', chosenTripId)
    }
    if (!chosenTripId) chosenTripId = trips[0].trip_id
    if (!chosenTripId) {
      console.log('No usable trip id found, aborting')
      return []
    }

    // 4) Get stop_times for chosen trip
    const stopTimesParams = new URLSearchParams()
    stopTimesParams.append('trip_id', encodeEq(chosenTripId))
    stopTimesParams.append('select', 'stop_id,stop_sequence,arrival_time,departure_time,stop_headsign')
    stopTimesParams.append('order', 'stop_sequence.asc')
    stopTimesParams.append('limit', '1000') // safe upper bound

    const stopTimesUrl = `${BASE}/stop_times?${stopTimesParams.toString()}`
    console.log('Stop times URL:', stopTimesUrl)

    const stRes = await fetch(stopTimesUrl, { method: 'GET', headers: HEADERS })
    if (!stRes.ok) {
      const errTxt = await stRes.text()
      throw new Error(`stop_times query failed: ${stRes.status} ${errTxt}`)
    }
    const stopTimes: any[] = await stRes.json()
    console.log('Stop times returned:', stopTimes.length, stopTimes.slice(0, 5))

    if (!stopTimes.length) {
      console.log('No stop_times for trip:', chosenTripId)
      return []
    }

    // 5) Build stops query using in.(...) with proper quoting
    const stopIds = [...new Set(stopTimes.map(st => st.stop_id))]
    const stopsParams = new URLSearchParams()
    stopsParams.append('stop_id', encodeInList(stopIds))
    stopsParams.append('select', 'stop_id,stop_name,stop_lat,stop_lon')
    const stopsUrl = `${BASE}/stops?${stopsParams.toString()}`
    console.log('Stops URL:', stopsUrl, 'stop count:', stopIds.length)

    const stopsRes = await fetch(stopsUrl, { method: 'GET', headers: HEADERS })
    if (!stopsRes.ok) {
      const errTxt = await stopsRes.text()
      throw new Error(`stops query failed: ${stopsRes.status} ${errTxt}`)
    }
    const stops: any[] = await stopsRes.json()
    console.log('Stops returned:', stops.length, stops.slice(0, 5))

    // 6) Combine stop_times + stops into ordered list
    const stopMap = new Map(stops.map(s => [String(s.stop_id), s]))
    const combined = stopTimes.map((st, idx) => {
      const s = stopMap.get(String(st.stop_id))
      return {
        order_no: st.stop_sequence ?? idx + 1,
        stop_sequence: st.stop_sequence ?? idx + 1,
        stop_id: st.stop_id,
        stop_name: s?.stop_name ?? 'Unknown Stop',
        stop_lat: s?.stop_lat ?? 0,
        stop_lon: s?.stop_lon ?? 0,
        trip_id: chosenTripId,
        arrival_time: st.arrival_time,
        departure_time: st.departure_time,
        stop_headsign: st.stop_headsign,
        direction_id: trips.find(t => t.trip_id === chosenTripId)?.direction_id ?? null,
        route_id: routeId,
      }
    })

    console.log('getRouteStops result length:', combined.length)
    return combined
  } catch (err) {
    console.error('getRouteStops error:', err)
    throw err
  }
}

// Get route ID by short name - query routes table
export async function getRouteIdByShortName(routeShortName: string) {
  console.log('Querying routes table with params:', { routeShortName })
  
  const queryParams = new URLSearchParams()
  queryParams.append('route_short_name', `eq.${routeShortName}`)
  queryParams.append('select', '*')
  
  const url = `${BASE}/routes?${queryParams.toString()}`
  console.log(`Querying Supabase table: routes`, { url, routeShortName })
  
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 15000) // 15 second timeout
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        ...HEADERS,
        'Prefer': 'return=minimal'
      },
      signal: controller.signal,
      mode: 'cors',
      cache: 'no-cache'
    })

    clearTimeout(timeoutId)
    console.log(`Response status: ${response.status} ${response.statusText}`)

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Supabase error response:', errorText)
      throw new Error(`Supabase table query failed: ${response.status} ${response.statusText} - ${errorText}`)
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