// Test script to check if we can get nearby stops with actual bus data
const SUPABASE_URL = "https://dxjaxszouwvmffeujpkx.supabase.co"
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR4amF4c3pvdXd2bWZmZXVqcGt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcyMzk4NDgsImV4cCI6MjA3MjgxNTg0OH0.i_bFhhlW20WZyvBvPHNAqCNGwX3wQNObY2e9JYqaK8s"

const BASE = `${SUPABASE_URL}/rest/v1`
const HEADERS = {
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  Accept: 'application/json',
  'Content-Type': 'application/json',
}

// Test coordinates (Dubai center)
const lat = 25.2048
const lon = 55.2708

async function testFixedNearbyStops() {
  console.log('Testing fixed nearby stops function...\n')
  console.log('Coordinates:', { lat, lon })
  
  try {
    // 1) First, get all stops that have stop_times data
    console.log('1. Getting stops with stop_times data...')
    const stopTimesRes = await fetch(`${BASE}/stop_times?select=stop_id&limit=1000`, { headers: HEADERS })
    const stopTimes = await stopTimesRes.json()
    const stopIdsWithData = [...new Set(stopTimes.map(st => st.stop_id))]
    console.log(`Found ${stopIdsWithData.length} stops with stop_times data`)
    
    // 2) Get stop details for these stops
    console.log('\n2. Getting stop details...')
    const stopsRes = await fetch(`${BASE}/stops?stop_id=in.(${stopIdsWithData.map(id => `"${id}"`).join(',')})&select=stop_id,stop_name,stop_lat,stop_lon`, { headers: HEADERS })
    const stops = await stopsRes.json()
    console.log(`Found ${stops.length} stop details`)
    
    if (stops.length === 0) {
      console.log('No stop details found!')
      return
    }
    
    // 3) Calculate distances for these stops
    console.log('\n3. Calculating distances...')
    
    function calculateDistance(lat1, lon1, lat2, lon2) {
      const R = 6371 // Earth's radius in kilometers
      const dLat = (lat2 - lat1) * Math.PI / 180
      const dLon = (lon2 - lon1) * Math.PI / 180
      const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon/2) * Math.sin(dLon/2)
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
      return R * c
    }
    
    const stopsWithDistance = stops.map(stop => {
      const dKm = calculateDistance(lat, lon, Number(stop.stop_lat), Number(stop.stop_lon))
      return { ...stop, distance_m: Math.round(dKm * 1000) }
    }).sort((a, b) => a.distance_m - b.distance_m)
    
    console.log('Closest stops with bus data:')
    stopsWithDistance.slice(0, 10).forEach((stop, i) => {
      console.log(`  ${i+1}. ${stop.stop_name} (${stop.stop_id}) - ${stop.distance_m}m`)
    })
    
    // 4) Test departures for the closest stop
    if (stopsWithDistance.length > 0) {
      const closestStop = stopsWithDistance[0]
      console.log(`\n4. Testing departures for closest stop: ${closestStop.stop_name} (${closestStop.stop_id})`)
      
      // Get active service IDs
      const today = new Date().toISOString().split('T')[0]
      const dayOfWeek = new Date(today).getDay()
      const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
      const dayName = dayNames[dayOfWeek]
      
      const calendarRes = await fetch(`${BASE}/calendar?${dayName}=eq.1&start_date=lte.${today}&end_date=gte.${today}&select=service_id`, { headers: HEADERS })
      const calendarServices = await calendarRes.json()
      const activeServiceIds = calendarServices.map(c => c.service_id)
      
      // Get trips for active services
      const tripsRes = await fetch(`${BASE}/trips?service_id=in.(${activeServiceIds.map(id => `"${id}"`).join(',')})&select=trip_id,route_id,trip_headsign&limit=100`, { headers: HEADERS })
      const trips = await tripsRes.json()
      
      // Get stop_times for this stop
      const tripIds = trips.map(t => t.trip_id)
      const stopTimesRes = await fetch(`${BASE}/stop_times?trip_id=in.(${tripIds.map(id => `"${id}"`).join(',')})&stop_id=eq."${closestStop.stop_id}"&select=trip_id,departure_time,arrival_time&order=departure_time.asc&limit=10`, { headers: HEADERS })
      const stopTimes = await stopTimesRes.json()
      
      console.log(`Found ${stopTimes.length} departures for this stop`)
      
      if (stopTimes.length > 0) {
        // Get routes
        const routeIds = [...new Set(trips.map(t => t.route_id))]
        const routesRes = await fetch(`${BASE}/routes?route_id=in.(${routeIds.map(id => `"${id}"`).join(',')})&select=route_id,route_short_name,route_long_name`, { headers: HEADERS })
        const routes = await routesRes.json()
        
        const tripMap = new Map(trips.map(t => [t.trip_id, t]))
        const routeMap = new Map(routes.map(r => [r.route_id, r]))
        
        console.log('\nDepartures:')
        stopTimes.forEach((st, i) => {
          const trip = tripMap.get(st.trip_id)
          const route = trip ? routeMap.get(trip.route_id) : undefined
          const dep = st.departure_time || st.arrival_time
          
          console.log(`  ${i+1}. Route: ${route?.route_short_name || trip?.route_id || 'Unknown'}`)
          console.log(`     Destination: ${trip?.trip_headsign || 'Unknown'}`)
          console.log(`     Departure: ${dep}`)
          console.log()
        })
      }
    }
    
  } catch (error) {
    console.error('Error:', error)
  }
}

testFixedNearbyStops().catch(console.error)
