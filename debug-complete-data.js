// Complete debug script to understand the database structure
const SUPABASE_URL = "https://dxjaxszouwvmffeujpkx.supabase.co"
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR4amF4c3pvdXd2bWZmZXVqcGt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcyMzk4NDgsImV4cCI6MjA3MjgxNTg0OH0.i_bFhhlW20WZyvBvPHNAqCNGwX3wQNObY2e9JYqaK8s"

const BASE = `${SUPABASE_URL}/rest/v1`
const HEADERS = {
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  Accept: 'application/json',
  'Content-Type': 'application/json',
}

async function debugCompleteData() {
  console.log('Complete database structure analysis...\n')
  
  // 1) Check all tables
  console.log('1. Checking all available tables...')
  const tables = ['stops', 'stop_times', 'trips', 'routes', 'calendar', 'calendar_dates']
  
  for (const table of tables) {
    try {
      const res = await fetch(`${BASE}/${table}?limit=1`, { headers: HEADERS })
      if (res.ok) {
        const data = await res.json()
        console.log(`✓ ${table}: ${data.length} records (sample)`)
      } else {
        console.log(`✗ ${table}: ${res.status} ${res.statusText}`)
      }
    } catch (error) {
      console.log(`✗ ${table}: Error - ${error.message}`)
    }
  }
  
  // 2) Check stop_times in detail
  console.log('\n2. Detailed stop_times analysis...')
  const stopTimesRes = await fetch(`${BASE}/stop_times?limit=100`, { headers: HEADERS })
  if (stopTimesRes.ok) {
    const stopTimes = await stopTimesRes.json()
    console.log(`Total stop_times records: ${stopTimes.length}`)
    
    if (stopTimes.length > 0) {
      console.log('Sample stop_times:')
      stopTimes.slice(0, 5).forEach((st, i) => {
        console.log(`  ${i+1}. stop_id: ${st.stop_id}, trip_id: ${st.trip_id}, departure_time: ${st.departure_time}`)
      })
      
      // Get unique stop_ids
      const uniqueStopIds = [...new Set(stopTimes.map(st => st.stop_id))]
      console.log(`\nUnique stop_ids in stop_times: ${uniqueStopIds.length}`)
      console.log('First 10 stop_ids:', uniqueStopIds.slice(0, 10))
      
      // Get unique trip_ids
      const uniqueTripIds = [...new Set(stopTimes.map(st => st.trip_id))]
      console.log(`\nUnique trip_ids in stop_times: ${uniqueTripIds.length}`)
      console.log('First 10 trip_ids:', uniqueTripIds.slice(0, 10))
    }
  }
  
  // 3) Check trips
  console.log('\n3. Trips analysis...')
  const tripsRes = await fetch(`${BASE}/trips?limit=100`, { headers: HEADERS })
  if (tripsRes.ok) {
    const trips = await tripsRes.json()
    console.log(`Total trips records: ${trips.length}`)
    
    if (trips.length > 0) {
      console.log('Sample trips:')
      trips.slice(0, 5).forEach((t, i) => {
        console.log(`  ${i+1}. trip_id: ${t.trip_id}, route_id: ${t.route_id}, service_id: ${t.service_id}`)
      })
    }
  }
  
  // 4) Check routes
  console.log('\n4. Routes analysis...')
  const routesRes = await fetch(`${BASE}/routes?limit=100`, { headers: HEADERS })
  if (routesRes.ok) {
    const routes = await routesRes.json()
    console.log(`Total routes records: ${routes.length}`)
    
    if (routes.length > 0) {
      console.log('Sample routes:')
      routes.slice(0, 5).forEach((r, i) => {
        console.log(`  ${i+1}. route_id: ${r.route_id}, route_short_name: ${r.route_short_name}`)
      })
    }
  }
  
  // 5) Check if we can find any working stop
  console.log('\n5. Looking for working stops...')
  const stopTimesRes2 = await fetch(`${BASE}/stop_times?limit=1000`, { headers: HEADERS })
  if (stopTimesRes2.ok) {
    const stopTimes = await stopTimesRes2.json()
    
    if (stopTimes.length > 0) {
      // Find a stop with multiple departures
      const stopCounts = {}
      stopTimes.forEach(st => {
        stopCounts[st.stop_id] = (stopCounts[st.stop_id] || 0) + 1
      })
      
      const sortedStops = Object.entries(stopCounts).sort((a, b) => b[1] - a[1])
      console.log('Stops with most departures:')
      sortedStops.slice(0, 5).forEach(([stopId, count]) => {
        console.log(`  ${stopId}: ${count} departures`)
      })
      
      // Test with the busiest stop
      if (sortedStops.length > 0) {
        const busiestStopId = sortedStops[0][0]
        console.log(`\nTesting with busiest stop: ${busiestStopId}`)
        
        // Get stop info
        const stopRes = await fetch(`${BASE}/stops?stop_id=eq."${busiestStopId}"`, { headers: HEADERS })
        const stopInfo = await stopRes.json()
        console.log('Stop info:', stopInfo[0])
        
        // Get stop times for this stop
        const stopTimesForStop = stopTimes.filter(st => st.stop_id === busiestStopId)
        console.log(`Stop times for ${busiestStopId}:`, stopTimesForStop.slice(0, 5))
        
        // Get trips for this stop
        const tripIds = [...new Set(stopTimesForStop.map(st => st.trip_id))]
        console.log(`Trip IDs for ${busiestStopId}:`, tripIds.slice(0, 5))
        
        if (tripIds.length > 0) {
          const tripsRes = await fetch(`${BASE}/trips?trip_id=in.(${tripIds.slice(0, 5).map(id => `"${id}"`).join(',')})`, { headers: HEADERS })
          const trips = await tripsRes.json()
          console.log('Trips for this stop:', trips.slice(0, 3))
        }
      }
    }
  }
}

debugCompleteData().catch(console.error)
