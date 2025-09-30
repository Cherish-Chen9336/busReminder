-- PostGIS function to find nearest stops with proper distance calculation
-- This replaces the previous Haversine-based function with PostGIS ST_Distance

CREATE OR REPLACE FUNCTION fn_nearest_stops_postgis(
  user_lat FLOAT,
  user_lon FLOAT,
  radius_meters INTEGER DEFAULT 2000,
  limit_count INTEGER DEFAULT 20
)
RETURNS TABLE (
  stop_id TEXT,
  stop_name TEXT,
  stop_lat FLOAT,
  stop_lon FLOAT,
  distance_meters FLOAT
) 
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.stop_id::TEXT,
    s.stop_name::TEXT,
    s.stop_lat::FLOAT,
    s.stop_lon::FLOAT,
    ST_Distance(
      ST_GeogFromText('POINT(' || user_lon || ' ' || user_lat || ')'),
      ST_GeogFromText('POINT(' || s.stop_lon || ' ' || s.stop_lat || ')')
    )::FLOAT as distance_meters
  FROM stops s
  WHERE ST_DWithin(
    ST_GeogFromText('POINT(' || user_lon || ' ' || user_lat || ')'),
    ST_GeogFromText('POINT(' || s.stop_lon || ' ' || s.stop_lat || ')'),
    radius_meters
  )
  ORDER BY distance_meters ASC
  LIMIT limit_count;
END;
$$;
