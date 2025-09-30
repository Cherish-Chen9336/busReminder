// Test script to check if getDepartures function works
const SUPABASE_URL = "https://dxjaxszouwvmffeujpkx.supabase.co"
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR4amF4c3pvdXd2bWZmZXVqcGt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcyMzk4NDgsImV4cCI6MjA3MjgxNTg0OH0.i_bFhhlW20WZyvBvPHNAqCNGwX3wQNObY2e9JYqaK8s"

const BASE = `${SUPABASE_URL}/rest/v1`
const HEADERS = {
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  Accept: 'application/json',
  'Content-Type': 'application/json',
}

// Test with a known stop ID from our previous test
const testStopId = "525001" // Wasl, Terminus
const now = new Date().toISOString()

console.log('Testing getDepartures function...')
console.log('Stop ID:', testStopId)
console.log('Time:', now)
console.log()

async function testDepartures() {
  try {
    // 1) Get active service IDs for today
    const today = now.split('T')[0]
    console.log('Getting active service IDs for:', today)
    
    const dayOfWeek = new Date(today).getDay()
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
    const dayName = dayNames[dayOfWeek]
    
    console.log('Day of week:', dayOfWeek, 'Day name:', dayName)
    
    // Query calendar table
    let calendarQueryParams = new URLSearchParams()
    calendarQueryParams.append('select', 'service_id')
    calendarQueryParams.append(dayName, 'eq.1')
    calendarQueryParams.append('start_date', `lte.${today}`)
    calendarQueryParams.append('end_date', `gte.${today}`)
    
    const calendarUrl = `${BASE}/calendar?${calendarQueryParams.toString()}`
    console.log('Calendar URL:', calendarUrl)
    
    const calendarResponse = await fetch(calendarUrl, {
      method: 'GET',
      headers: HEADERS,
      mode: 'cors',
      cache: 'no-cache'
    })
    
    if (!calendarResponse.ok) {
      console.error('Calendar query failed:', calendarResponse.status, await calendarResponse.text())
      return
    }
    
    const calendarServices = await calendarResponse.json()
    console.log('Active service IDs:', calendarServices.length)
    
    if (calendarServices.length === 0) {
      console.log('No active services found for today')
      return
    }
    
    // 2) Get trips for active services
    const serviceIds = calendarServices.map(s => s.service_id)
    const qTrips = new URLSearchParams()
    qTrips.append('service_id', `in.(${serviceIds.map(id => `"${id}"`).join(',')})`)
    qTrips.append('select', 'trip_id,route_id,trip_headsign')
    qTrips.append('limit', '50')
    
    const tripsUrl = `${BASE}/trips?${qTrips.toString()}`
    console.log('Trips URL:', tripsUrl)
    
    const tripsRes = await fetch(tripsUrl, { headers: HEADERS })
    if (!tripsRes.ok) {
      console.error('Trips query failed:', tripsRes.status, await tripsRes.text())
      return
    }
    
    const trips = await tripsRes.json()
    console.log('Trips found:', trips.length)
    
    if (trips.length === 0) {
      console.log('No trips found for active services')
      return
    }
    
    // 3) Get stop_times for this stop
    const tripIds = trips.map(t => t.trip_id)
    const qST = new URLSearchParams()
    qST.append('trip_id', `in.(${tripIds.map(id => `"${id}"`).join(',')})`)
    qST.append('stop_id', `eq."${testStopId}"`)
    qST.append('select', 'trip_id,departure_time,arrival_time,stop_sequence')
    qST.append('order', 'departure_time.asc')
    qST.append('limit', '20')
    
    const stopTimesUrl = `${BASE}/stop_times?${qST.toString()}`
    console.log('Stop times URL:', stopTimesUrl)
    
    const stRes = await fetch(stopTimesUrl, { headers: HEADERS })
    if (!stRes.ok) {
      console.error('Stop times query failed:', stRes.status, await stRes.text())
      return
    }
    
    const stopTimes = await stRes.json()
    console.log('Stop times found:', stopTimes.length)
    
    if (stopTimes.length === 0) {
      console.log('No stop times found for this stop')
      return
    }
    
    // 4) Get routes
    const routeIds = [...new Set(trips.map(t => t.trip_id))]
    const qRoutes = new URLSearchParams()
    qRoutes.append('route_id', `in.(${routeIds.map(id => `"${id}"`).join(',')})`)
    qRoutes.append('select', 'route_id,route_short_name,route_long_name')
    
    const routesUrl = `${BASE}/routes?${qRoutes.toString()}`
    console.log('Routes URL:', routesUrl)
    
    const rRes = await fetch(routesUrl, { headers: HEADERS })
    if (!rRes.ok) {
      console.error('Routes query failed:', rRes.status, await rRes.text())
      return
    }
    
    const routes = await rRes.json()
    console.log('Routes found:', routes.length)
    
    // 5) Combine data
    const tripMap = new Map(trips.map(t => [t.trip_id, t]))
    const routeMap = new Map(routes.map(r => [r.route_id, r]))
    
    console.log('\nDepartures for stop', testStopId, ':')
    stopTimes.forEach((st, index) => {
      const trip = tripMap.get(st.trip_id)
      const route = trip ? routeMap.get(trip.route_id) : undefined
      const dep = st.departure_time || st.arrival_time
      
      console.log(`${index + 1}. Route: ${route?.route_short_name || trip?.route_id || 'Unknown'}`)
      console.log(`   Destination: ${trip?.trip_headsign || 'Unknown'}`)
      console.log(`   Departure time: ${dep}`)
      console.log(`   Route long name: ${route?.route_long_name || 'Unknown'}`)
      console.log()
    })
    
  } catch (error) {
    console.error('Error:', error)
  }
}

testDepartures().catch(console.error)
