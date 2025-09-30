// Test the final getDepartures function
const SUPABASE_URL = "https://dxjaxszouwvmffeujpkx.supabase.co"
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR4amF4c3pvdXd2bWZmZXVqcGt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcyMzk4NDgsImV4cCI6MjA3MjgxNTg0OH0.i_bFhhlW20WZyvBvPHNAqCNGwX3wQNObY2e9JYqaK8s"

const BASE = `${SUPABASE_URL}/rest/v1`
const HEADERS = {
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  Accept: 'application/json',
  'Content-Type': 'application/json',
}

// Test the final getDepartures function
async function testFinalDepartures() {
  console.log('Testing final getDepartures function...\n')
  
  const testStopId = "17902" // Creek Metro Station 2
  const now = new Date().toISOString()
  
  try {
    // 1) Test getDepartures function
    console.log('1. Testing getDepartures function...')
    const departures = await getDepartures(testStopId, now, 10)
    console.log(`Found ${departures.length} departures`)
    
    if (departures.length > 0) {
      console.log('Departures:')
      departures.forEach((dep, i) => {
        console.log(`  ${i+1}. Route: ${dep.route_name || dep.route_id || 'Unknown'}`)
        console.log(`     Destination: ${dep.headsign || 'Unknown'}`)
        console.log(`     Departure: ${dep.departure_time || 'Unknown'}`)
        console.log(`     ETA: ${dep.eta_minutes || 0} minutes`)
        console.log()
      })
    } else {
      console.log('No departures found')
    }
    
  } catch (error) {
    console.error('Error:', error)
  }
}

// Final getDepartures function
async function getDepartures(stopId, at, limit_n = 20) {
  console.log('getDepartures called with:', { stopId, at, limit_n })
  const now = new Date(at)
  const today = now.toISOString().split('T')[0]

  try {
    // 1) service_ids active today
    const serviceIds = await getActiveServiceIds(today)
    console.log('Active service IDs:', serviceIds)
    if (!serviceIds?.length) return []

    // 2) trips for those services
    const qTrips = new URLSearchParams()
    qTrips.append('service_id', `in.(${serviceIds.map(id => `"${id}"`).join(',')})`)
    qTrips.append('select', 'trip_id,route_id,trip_headsign')
    qTrips.append('limit', '200')
    const tripsRes = await fetch(`${BASE}/trips?${qTrips.toString()}`, { headers: HEADERS })
    if (!tripsRes.ok) throw new Error(`Trips query failed: ${tripsRes.status} ${await tripsRes.text()}`)
    const trips = await tripsRes.json()
    console.log('Trips found:', trips.length)
    if (!trips.length) return []

    // 3) stop_times for this stop + those trips
    const tripIds = trips.map(t => t.trip_id)
    let allStopTimes = []
    
    // Process trips in batches
    const batchSize = 50
    console.log(`Processing ${tripIds.length} trips in batches of ${batchSize}`)
    for (let i = 0; i < tripIds.length; i += batchSize) {
      const batchTripIds = tripIds.slice(i, i + batchSize)
      
      const qST = new URLSearchParams()
      qST.append('trip_id', `in.(${batchTripIds.map(id => `"${id}"`).join(',')})`)
      qST.append('stop_id', `eq.${stopId}`) // Fixed: removed quotes
      qST.append('select', 'trip_id,departure_time,arrival_time,stop_sequence')
      qST.append('order', 'departure_time.asc')
      qST.append('limit', String(limit_n * 2))
      
      const stRes = await fetch(`${BASE}/stop_times?${qST.toString()}`, { headers: HEADERS })
      if (!stRes.ok) throw new Error(`stop_times query failed: ${stRes.status} ${await stRes.text()}`)
      const batchStopTimes = await stRes.json()
      allStopTimes = allStopTimes.concat(batchStopTimes)
      
      if (allStopTimes.length >= limit_n * 3) break
    }
    
    console.log(`Total stop times found: ${allStopTimes.length}`)
    if (!allStopTimes.length) return []

    // 4) routes for the referenced trips
    const routeIds = [...new Set(trips.map(t => t.route_id))]
    const qRoutes = new URLSearchParams()
    qRoutes.append('route_id', `in.(${routeIds.map(id => `"${id}"`).join(',')})`)
    qRoutes.append('select', 'route_id,route_short_name,route_long_name')
    const rRes = await fetch(`${BASE}/routes?${qRoutes.toString()}`, { headers: HEADERS })
    if (!rRes.ok) throw new Error(`routes query failed: ${rRes.status} ${await rRes.text()}`)
    const routes = await rRes.json()
    console.log('Routes found:', routes.length)

    const tripMap = new Map(trips.map(t => [t.trip_id, t]))
    const routeMap = new Map(routes.map(r => [r.route_id, r]))

    const departures = allStopTimes.map(st => {
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

// Helper functions
async function getActiveServiceIds(date) {
  const dayOfWeek = new Date(date).getDay()
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
  const dayName = dayNames[dayOfWeek]
  
  const calendarRes = await fetch(`${BASE}/calendar?${dayName}=eq.1&start_date=lte.${date}&end_date=gte.${date}&select=service_id`, { headers: HEADERS })
  if (!calendarRes.ok) throw new Error(`Calendar query failed: ${calendarRes.status}`)
  const calendarServices = await calendarRes.json()
  return calendarServices.map(c => c.service_id)
}

function etaMinutesGTFS(now, targetHHMMSS) {
  const nowSec = now.getHours()*3600 + now.getMinutes()*60 + now.getSeconds()
  const tSec = gtfsToSeconds(targetHHMMSS)
  const ahead = tSec >= nowSec ? (tSec - nowSec) : (tSec + 24*3600 - nowSec)
  return Math.round(ahead / 60)
}

function gtfsToSeconds(t) {
  const [h,m,s] = t.split(':').map(Number)
  return (h*3600) + (m*60) + (s || 0)
}

// Run the test
testFinalDepartures().catch(console.error)
