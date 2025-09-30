// Debug script to check service ID matching
const SUPABASE_URL = "https://dxjaxszouwvmffeujpkx.supabase.co"
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR4amF4c3pvdXd2bWZmZXVqcGt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcyMzk4NDgsImV4cCI6MjA3MjgxNTg0OH0.i_bFhhlW20WZyvBvPHNAqCNGwX3wQNObY2e9JYqaK8s"

const BASE = `${SUPABASE_URL}/rest/v1`
const HEADERS = {
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  Accept: 'application/json',
  'Content-Type': 'application/json',
}

async function debugServiceMatching() {
  console.log('Debugging service ID matching...\n')
  
  // 1) Check what service IDs exist in trips
  console.log('1. Checking service IDs in trips...')
  const tripsRes = await fetch(`${BASE}/trips?select=service_id&limit=100`, { headers: HEADERS })
  const trips = await tripsRes.json()
  const serviceIdsInTrips = [...new Set(trips.map(t => t.service_id))]
  console.log('Service IDs in trips:', serviceIdsInTrips.slice(0, 10))
  
  // 2) Check what service IDs exist in calendar
  console.log('\n2. Checking service IDs in calendar...')
  const calendarRes = await fetch(`${BASE}/calendar?select=service_id&limit=100`, { headers: HEADERS })
  const calendar = await calendarRes.json()
  const serviceIdsInCalendar = calendar.map(c => c.service_id)
  console.log('Service IDs in calendar:', serviceIdsInCalendar.slice(0, 10))
  
  // 3) Check which service IDs are active today
  const today = new Date().toISOString().split('T')[0]
  const dayOfWeek = new Date(today).getDay()
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
  const dayName = dayNames[dayOfWeek]
  
  console.log(`\n3. Checking active services for ${today} (${dayName})...`)
  const activeCalendarRes = await fetch(`${BASE}/calendar?${dayName}=eq.1&start_date=lte.${today}&end_date=gte.${today}&select=service_id`, { headers: HEADERS })
  const activeCalendar = await activeCalendarRes.json()
  const activeServiceIds = activeCalendar.map(c => c.service_id)
  console.log('Active service IDs:', activeServiceIds)
  
  // 4) Check which trips use active service IDs
  console.log('\n4. Checking trips with active service IDs...')
  const activeTripsRes = await fetch(`${BASE}/trips?service_id=in.(${activeServiceIds.map(id => `"${id}"`).join(',')})&select=trip_id,route_id,service_id&limit=20`, { headers: HEADERS })
  const activeTrips = await activeTripsRes.json()
  console.log('Active trips found:', activeTrips.length)
  console.log('Sample active trips:', activeTrips.slice(0, 5))
  
  // 5) Check stop_times for these active trips
  if (activeTrips.length > 0) {
    console.log('\n5. Checking stop_times for active trips...')
    const tripIds = activeTrips.map(t => t.trip_id)
    const stopTimesRes = await fetch(`${BASE}/stop_times?trip_id=in.(${tripIds.map(id => `"${id}"`).join(',')})&select=trip_id,stop_id,departure_time&limit=50`, { headers: HEADERS })
    const stopTimes = await stopTimesRes.json()
    console.log('Stop times for active trips:', stopTimes.length)
    
    if (stopTimes.length > 0) {
      console.log('Sample stop times:', stopTimes.slice(0, 5))
      
      // 6) Find stops that have data
      const stopIds = [...new Set(stopTimes.map(st => st.stop_id))]
      console.log('\n6. Stops with data:', stopIds.slice(0, 10))
      
      // 7) Test with one of these stops
      if (stopIds.length > 0) {
        const testStopId = stopIds[0]
        console.log(`\n7. Testing with stop ${testStopId}...`)
        
        // Get stop info
        const stopInfoRes = await fetch(`${BASE}/stops?stop_id=eq."${testStopId}"`, { headers: HEADERS })
        const stopInfo = await stopInfoRes.json()
        console.log('Stop info:', stopInfo[0])
        
        // Get stop times for this specific stop
        const stopTimesForStop = stopTimes.filter(st => st.stop_id === testStopId)
        console.log(`Stop times for ${testStopId}:`, stopTimesForStop.length)
        
        if (stopTimesForStop.length > 0) {
          console.log('Sample stop times for this stop:')
          stopTimesForStop.slice(0, 5).forEach((st, i) => {
            console.log(`  ${i+1}. trip_id: ${st.trip_id}, departure: ${st.departure_time}`)
          })
          
          // Get trips for this stop
          const tripIdsForStop = [...new Set(stopTimesForStop.map(st => st.trip_id))]
          const tripsForStopRes = await fetch(`${BASE}/trips?trip_id=in.(${tripIdsForStop.map(id => `"${id}"`).join(',')})&select=trip_id,route_id,trip_headsign,service_id`, { headers: HEADERS })
          const tripsForStop = await tripsForStopRes.json()
          console.log(`\nTrips for stop ${testStopId}:`, tripsForStop.length)
          
          if (tripsForStop.length > 0) {
            console.log('Sample trips for this stop:')
            tripsForStop.slice(0, 3).forEach((t, i) => {
              console.log(`  ${i+1}. trip_id: ${t.trip_id}, route_id: ${t.route_id}, service_id: ${t.service_id}`)
            })
            
            // Get routes
            const routeIds = [...new Set(tripsForStop.map(t => t.route_id))]
            const routesRes = await fetch(`${BASE}/routes?route_id=in.(${routeIds.map(id => `"${id}"`).join(',')})&select=route_id,route_short_name,route_long_name`, { headers: HEADERS })
            const routes = await routesRes.json()
            console.log(`\nRoutes for stop ${testStopId}:`, routes.length)
            
            if (routes.length > 0) {
              console.log('Sample routes:')
              routes.slice(0, 3).forEach((r, i) => {
                console.log(`  ${i+1}. route_id: ${r.route_id}, short_name: ${r.route_short_name}`)
              })
              
              // Final combined data
              console.log(`\n8. Final combined data for stop ${testStopId}:`)
              const tripMap = new Map(tripsForStop.map(t => [t.trip_id, t]))
              const routeMap = new Map(routes.map(r => [r.route_id, r]))
              
              stopTimesForStop.slice(0, 5).forEach((st, i) => {
                const trip = tripMap.get(st.trip_id)
                const route = trip ? routeMap.get(trip.route_id) : undefined
                const dep = st.departure_time || st.arrival_time
                
                console.log(`  ${i+1}. Route: ${route?.route_short_name || trip?.route_id || 'Unknown'}`)
                console.log(`     Destination: ${trip?.trip_headsign || 'Unknown'}`)
                console.log(`     Departure: ${dep}`)
                console.log(`     Service: ${trip?.service_id || 'Unknown'}`)
                console.log()
              })
            }
          }
        }
      }
    }
  }
}

debugServiceMatching().catch(console.error)
