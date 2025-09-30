# PostGIS RPC Functions Deployment Guide

This guide explains how to deploy and use the PostGIS-based RPC functions for the Dubai Bus Buddy application.

## 🚀 Deployment Steps

### 1. Deploy RPC Functions to Supabase

1. Open your Supabase project dashboard
2. Go to SQL Editor
3. Copy and paste the contents of `deploy-rpc-functions.sql`
4. Execute the script

### 2. Verify Functions are Created

Run these test queries in Supabase SQL Editor:

```sql
-- Test nearest stops function
SELECT * FROM fn_nearest_stops_postgis(25.2048, 55.2708, 2000, 10);

-- Test stop details function
SELECT * FROM fn_stop_details('290501', '14:30:00');

-- Test route stops function
SELECT * FROM fn_route_stops('X25');
```

## 🔧 Function Details

### 1. `fn_nearest_stops_postgis`
- **Purpose**: Find nearest bus stops using PostGIS distance calculation
- **Parameters**:
  - `user_lat`: User latitude
  - `user_lon`: User longitude
  - `radius_meters`: Search radius (default: 2000m)
  - `limit_count`: Maximum results (default: 20)
- **Returns**: Stop details with accurate distances

### 2. `fn_stop_details`
- **Purpose**: Get stop details including routes and next departures
- **Parameters**:
  - `p_stop_id`: Stop ID to query
  - `p_current_time`: Current time (optional, defaults to now)
- **Returns**: Route information with ETA calculations

### 3. `fn_route_stops`
- **Purpose**: Get all stops for a specific route
- **Parameters**:
  - `p_route_id`: Route ID to query
- **Returns**: Complete route with transfer information

## 🎯 Benefits

### PostGIS Advantages:
- **Accurate Distance Calculation**: Uses proper geographic distance calculations
- **Spatial Indexing**: Leverages PostGIS spatial indexes for fast queries
- **Deterministic Results**: Consistent results for the same coordinates
- **Server-side Processing**: Reduces client-side computation

### RPC Benefits:
- **Single API Call**: One request instead of multiple queries
- **Optimized Queries**: Database-optimized joins and filters
- **Consistent Data**: All related data in one response
- **Better Performance**: Reduced network overhead

## 🔍 Frontend Integration

The frontend now uses these RPC functions instead of multiple REST API calls:

```typescript
// Before: Multiple API calls
const stops = await fetch('/stops?...')
const stopTimes = await fetch('/stop_times?...')
const trips = await fetch('/trips?...')
const routes = await fetch('/routes?...')

// After: Single RPC call
const result = await fetch('/rpc/fn_stop_details', {
  method: 'POST',
  body: JSON.stringify({ p_stop_id: stopId })
})
```

## 🐛 Troubleshooting

### Common Issues:

1. **Function not found (404)**
   - Ensure functions are deployed correctly
   - Check function names match exactly
   - Verify permissions are granted

2. **Permission denied**
   - Run: `GRANT EXECUTE ON FUNCTION fn_* TO anon;`
   - Check RLS policies if enabled

3. **PostGIS not available**
   - Enable PostGIS extension in Supabase
   - Run: `CREATE EXTENSION IF NOT EXISTS postgis;`

4. **Distance calculation issues**
   - Verify coordinate order (longitude, latitude)
   - Check for NULL coordinates in stops table

### Debug Queries:

```sql
-- Check if PostGIS is available
SELECT PostGIS_version();

-- Check stops table structure
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'stops';

-- Test distance calculation
SELECT ST_Distance(
  ST_GeogFromText('POINT(55.2708 25.2048)'),
  ST_GeogFromText('POINT(55.2708 25.2048)')
);
```

## 📊 Performance Monitoring

Monitor RPC function performance:

```sql
-- Check function execution times
SELECT 
  schemaname,
  funcname,
  calls,
  total_time,
  mean_time
FROM pg_stat_user_functions
WHERE funcname LIKE 'fn_%';
```

## 🔄 Updates

To update functions:

1. Modify the SQL in `deploy-rpc-functions.sql`
2. Re-run the deployment script
3. Test with the verification queries
4. Update frontend if needed

## 📝 Notes

- Functions use `ST_GeogFromText` for accurate geographic calculations
- Distance results are in meters
- Functions handle timezone-aware time calculations
- Transfer routes are automatically detected and included
