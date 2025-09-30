// Unit test for nearest stops functionality
// Test with Dubai Mall coordinates to verify correct results

const testNearestStops = async () => {
  console.log('=== Testing Nearest Stops with Dubai Mall Coordinates ===');
  
  // Dubai Mall coordinates (known location)
  const dubaiMall = {
    lat: 25.1972,
    lon: 55.2744,
    accuracy: 20
  };
  
  console.log('Test coordinates:', dubaiMall);
  
  try {
    // Test the RPC call directly
    const response = await fetch('https://dxjaxszouwvmffeujpkx.supabase.co/rest/v1/rpc/nearest_stops', {
      method: 'POST',
      headers: {
        'apikey': 'your-anon-key',
        'Authorization': 'Bearer your-anon-key',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        in_lon: dubaiMall.lon,  // Correct order: longitude first
        in_lat: dubaiMall.lat,  // then latitude
        max_meters: 2000,
        limit_n: 5
      })
    });
    
    if (!response.ok) {
      throw new Error(`RPC call failed: ${response.status}`);
    }
    
    const stops = await response.json();
    console.log('RPC Response:', stops);
    
    // Verify results
    if (stops.length === 0) {
      console.error('❌ No stops found - RPC may not be deployed');
      return false;
    }
    
    const closest = stops[0];
    console.log('Closest stop:', closest);
    
    // Check distance is reasonable (< 1500m for Dubai Mall area)
    if (closest.distance_m > 1500) {
      console.error(`❌ Distance too large: ${closest.distance_m}m (expected < 1500m)`);
      return false;
    }
    
    // Check it's not Abu Dhabi
    if (closest.stop_name.toLowerCase().includes('abu dhabi')) {
      console.error(`❌ Found Abu Dhabi stop: ${closest.stop_name} - likely lat/lon swapped`);
      return false;
    }
    
    console.log('✅ Test passed!');
    console.log(`✅ Closest stop: ${closest.stop_name}`);
    console.log(`✅ Distance: ${Math.round(closest.distance_m)}m`);
    console.log(`✅ Stop ID: ${closest.stop_id}`);
    
    return true;
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    return false;
  }
};

// Run the test
testNearestStops();