// Debug script to check what data exists for stops
const SUPABASE_URL = "https://dxjaxszouwvmffeujpkx.supabase.co"
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR4amF4c3pvdXd2bWZmZXVqcGt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcyMzk4NDgsImV4cCI6MjA3MjgxNTg0OH0.i_bFhhlW20WZyvBvPHNAqCNGwX3wQNObY2e9JYqaK8s"

const BASE = `${SUPABASE_URL}/rest/v1`
const HEADERS = {
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  Accept: 'application/json',
  'Content-Type': 'application/json',
}

async function debugStopData() {
  console.log('Debugging stop data...\n')
  
  // 1) Check what stops exist
  console.log('1. Checking stops table...')
  const stopsRes = await fetch(`${BASE}/stops?select=stop_id,stop_name&limit=10`, { headers: HEADERS })
  const stops = await stopsRes.json()
  console.log('Sample stops:', stops.slice(0, 5))
  
  // 2) Check what stop_times exist
  console.log('\n2. Checking stop_times table...')
  const stopTimesRes = await fetch(`${BASE}/stop_times?select=stop_id,departure_time&limit=10`, { headers: HEADERS })
  const stopTimes = await stopTimesRes.json()
  console.log('Sample stop_times:', stopTimes.slice(0, 5))
  
  // 3) Check unique stop_ids in stop_times
  console.log('\n3. Checking unique stop_ids in stop_times...')
  const uniqueStopsRes = await fetch(`${BASE}/stop_times?select=stop_id&limit=100`, { headers: HEADERS })
  const uniqueStops = await uniqueStopsRes.json()
  const uniqueStopIds = [...new Set(uniqueStops.map(st => st.stop_id))]
  console.log('Unique stop_ids in stop_times:', uniqueStopIds.slice(0, 10))
  
  // 4) Check if our test stop has any data
  const testStopId = "525001"
  console.log(`\n4. Checking data for stop ${testStopId}...`)
  
  const specificStopRes = await fetch(`${BASE}/stop_times?stop_id=eq."${testStopId}"&limit=5`, { headers: HEADERS })
  const specificStopData = await specificStopRes.json()
  console.log(`Data for stop ${testStopId}:`, specificStopData)
  
  // 5) Try a different stop that we know has data
  if (uniqueStopIds.length > 0) {
    const testStopId2 = uniqueStopIds[0]
    console.log(`\n5. Checking data for stop ${testStopId2}...`)
    
    const specificStopRes2 = await fetch(`${BASE}/stop_times?stop_id=eq."${testStopId2}"&limit=5`, { headers: HEADERS })
    const specificStopData2 = await specificStopRes2.json()
    console.log(`Data for stop ${testStopId2}:`, specificStopData2)
    
    // 6) Get trips for this stop
    if (specificStopData2.length > 0) {
      const tripIds = specificStopData2.map(st => st.trip_id)
      console.log(`\n6. Getting trips for stop ${testStopId2}...`)
      
      const tripsRes = await fetch(`${BASE}/trips?trip_id=in.(${tripIds.map(id => `"${id}"`).join(',')})&select=trip_id,route_id,trip_headsign&limit=5`, { headers: HEADERS })
      const trips = await tripsRes.json()
      console.log('Trips:', trips)
      
      // 7) Get routes for these trips
      if (trips.length > 0) {
        const routeIds = [...new Set(trips.map(t => t.route_id))]
        console.log(`\n7. Getting routes for trips...`)
        
        const routesRes = await fetch(`${BASE}/routes?route_id=in.(${routeIds.map(id => `"${id}"`).join(',')})&select=route_id,route_short_name,route_long_name&limit=5`, { headers: HEADERS })
        const routes = await routesRes.json()
        console.log('Routes:', routes)
      }
    }
  }
  
  // 8) Check calendar data
  console.log('\n8. Checking calendar data...')
  const calendarRes = await fetch(`${BASE}/calendar?select=service_id&limit=5`, { headers: HEADERS })
  const calendar = await calendarRes.json()
  console.log('Calendar data:', calendar)
}

debugStopData().catch(console.error)
