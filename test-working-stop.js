// Test with a working stop that has stop_times data
const SUPABASE_URL = "https://dxjaxszouwvmffeujpkx.supabase.co"
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR4amF4c3pvdXd2bWZmZXVqcGt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcyMzk4NDgsImV4cCI6MjA3MjgxNTg0OH0.i_bFhhlW20WZyvBvPHNAqCNGwX3wQNObY2e9JYqaK8s"

const BASE = `${SUPABASE_URL}/rest/v1`
const HEADERS = {
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  Accept: 'application/json',
  'Content-Type': 'application/json',
}

// Test with a working stop
const workingStopId = "12801" // centrepoint Metro Station 1
const now = new Date().toISOString()

console.log('Testing with working stop:', workingStopId)
console.log('Time:', now)
console.log()

async function testWorkingStop() {
  try {
    // 1) Get stop info
    console.log('1. Getting stop info...')
    const stopRes = await fetch(`${BASE}/stops?stop_id=eq."${workingStopId}"`, { headers: HEADERS })
    const stopInfo = await stopRes.json()
    console.log('Stop info:', stopInfo[0])
    
    // 2) Get active service IDs for today
    const today = now.split('T')[0]
    console.log('\n2. Getting active service IDs for:', today)
    
    const dayOfWeek = new Date(today).getDay()
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
    const dayName = dayNames[dayOfWeek]
    
    const calendarRes = await fetch(`${BASE}/calendar?${dayName}=eq.1&start_date=lte.${today}&end_date=gte.${today}&select=service_id`, { headers: HEADERS })
    const calendarServices = await calendarRes.json()
    console.log('Active service IDs:', calendarServices.map(s => s.service_id))
    
    // 3) Get trips for active services
    const serviceIds = calendarServices.map(s => s.service_id)
    const tripsRes = await fetch(`${BASE}/trips?service_id=in.(${serviceIds.map(id => `"${id}"`).join(',')})&select=trip_id,route_id,trip_headsign&limit=50`, { headers: HEADERS })
    const trips = await tripsRes.json()
    console.log('\n3. Trips found:', trips.length)
    
    // 4) Get stop_times for this stop
    const tripIds = trips.map(t => t.trip_id)
    const stopTimesRes = await fetch(`${BASE}/stop_times?trip_id=in.(${tripIds.map(id => `"${id}"`).join(',')})&stop_id=eq."${workingStopId}"&select=trip_id,departure_time,arrival_time&order=departure_time.asc&limit=20`, { headers: HEADERS })
    const stopTimes = await stopTimesRes.json()
    console.log('\n4. Stop times found:', stopTimes.length)
    
    if (stopTimes.length > 0) {
      console.log('Sample stop times:')
      stopTimes.slice(0, 5).forEach((st, i) => {
        console.log(`  ${i+1}. trip_id: ${st.trip_id}, departure: ${st.departure_time}`)
      })
      
      // 5) Get routes
      const routeIds = [...new Set(trips.map(t => t.route_id))]
      const routesRes = await fetch(`${BASE}/routes?route_id=in.(${routeIds.map(id => `"${id}"`).join(',')})&select=route_id,route_short_name,route_long_name`, { headers: HEADERS })
      const routes = await routesRes.json()
      console.log('\n5. Routes found:', routes.length)
      
      // 6) Combine data like in getDepartures
      const tripMap = new Map(trips.map(t => [t.trip_id, t]))
      const routeMap = new Map(routes.map(r => [r.route_id, r]))
      
      console.log('\n6. Combined departures:')
      stopTimes.forEach((st, i) => {
        const trip = tripMap.get(st.trip_id)
        const route = trip ? routeMap.get(trip.route_id) : undefined
        const dep = st.departure_time || st.arrival_time
        
        console.log(`  ${i+1}. Route: ${route?.route_short_name || trip?.route_id || 'Unknown'}`)
        console.log(`     Destination: ${trip?.trip_headsign || 'Unknown'}`)
        console.log(`     Departure: ${dep}`)
        console.log(`     Route long: ${route?.route_long_name || 'Unknown'}`)
        console.log()
      })
    }
    
  } catch (error) {
    console.error('Error:', error)
  }
}

testWorkingStop().catch(console.error)
