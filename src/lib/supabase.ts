// Supabase configuration
const SUPABASE_URL = "https://dxjaxszouwvmffeujpkx.supabase.co"
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR4amF4c3pvdXd2bWZmZXVqcGt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTcyMzk4NDgsImV4cCI6MjA3MjgxNTg0OH0.i_bFhhlW20WZyvBvPHNAqCNGwX3wQNObY2e9JYqaK8s"

// API call function for Supabase RPC
async function callSupabaseRPC<T>(functionName: string, params: any = {}): Promise<T> {
  const url = `${SUPABASE_URL}/rest/v1/rpc/${functionName}`
  console.log(`Calling Supabase RPC: ${functionName}`, params)
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify(params)
  })

  console.log(`Response status: ${response.status} ${response.statusText}`)

  if (!response.ok) {
    const errorText = await response.text()
    console.error('Supabase error response:', errorText)
    throw new Error(`Supabase RPC call failed: ${response.status} ${response.statusText} - ${errorText}`)
  }

  const data = await response.json()
  console.log(`RPC ${functionName} response:`, data)
  return data
}

// RPC function calls
export async function getNearbyStops(lat: number, lon: number, radius_m: number = 500) {
  return callSupabaseRPC('nearby_stops', { lat, lon, radius_m })
}

export async function getDepartures(stopId: string, at: string, limit_n: number = 20) {
  return callSupabaseRPC('departures', { 
    p_stop_id: stopId, 
    p_at: at, 
    limit_n 
  })
}
