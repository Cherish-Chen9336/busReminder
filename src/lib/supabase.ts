// Supabase configuration
const SUPABASE_URL = "https://dxjaxszouwvmffeujpkx.supabase.co"
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR4amF4c3pvdXd2bWZmZXVqcGt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcyMzk4NDgsImV4cCI6MjA3MjgxNTg0OH0.i_bFhhlW20WZyvBvPHNAqCNGwX3wQNObY2e9JYqaK8s"

// API call function for Supabase RPC with timeout and retry
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
    const result = await callSupabaseRPC('nearby_stops', { 
      lat: DUBAI_CENTER.lat, 
      lon: DUBAI_CENTER.lon, 
      radius_m: 1000 
    })
    console.log('Health check result:', result)
    console.log('Health check result type:', typeof result)
    console.log('Health check result length:', Array.isArray(result) ? result.length : 'Not an array')
    if (Array.isArray(result) && result.length > 0) {
      console.log('First stop in health check:', result[0])
      console.log('First stop ID:', result[0]?.stop_id)
      
      // Test departures for the first stop
      if (result[0]?.stop_id) {
        console.log('Testing departures for stop:', result[0].stop_id)
        const departuresResult = await callSupabaseRPC('departures', {
          limit_n: 5,
          p_at: new Date().toISOString(),
          p_stop_id: result[0].stop_id
        })
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

// RPC function calls
export async function getNearbyStops(lat: number, lon: number, radius_m: number = 500) {
  return callSupabaseRPC('nearby_stops', { lat, lon, radius_m })
}

export async function getDepartures(stopId: string, at: string, limit_n: number = 20) {
  console.log('Calling getDepartures with params:', { stopId, at, limit_n })
  return callSupabaseRPC('departures', { 
    p_stop_id: stopId,
    p_at: at,
    limit_n
  })
}
