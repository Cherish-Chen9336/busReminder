-- Function to get all stops for a specific route
CREATE OR REPLACE FUNCTION fn_route_stops(
  p_route_id TEXT
)
RETURNS TABLE (
  stop_id TEXT,
  stop_name TEXT,
  stop_lat FLOAT,
  stop_lon FLOAT,
  stop_sequence INTEGER,
  is_transfer BOOLEAN,
  transfer_routes TEXT[]
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH route_trips AS (
    -- Get all trips for this route
    SELECT DISTINCT t.trip_id
    FROM trips t
    WHERE t.route_id = p_route_id
  ),
  longest_trip AS (
    -- Find the trip with the most stops
    SELECT rt.trip_id
    FROM route_trips rt
    JOIN stop_times st ON rt.trip_id = st.trip_id
    GROUP BY rt.trip_id
    ORDER BY COUNT(st.stop_id) DESC
    LIMIT 1
  ),
  route_stops AS (
    -- Get all stops for the longest trip
    SELECT 
      s.stop_id,
      s.stop_name,
      s.stop_lat,
      s.stop_lon,
      st.stop_sequence,
      CASE 
        WHEN LOWER(s.stop_name) LIKE '%metro%' OR 
             LOWER(s.stop_name) LIKE '%station%' OR
             LOWER(s.stop_name) LIKE '%bus stop%' THEN TRUE
        ELSE FALSE
      END as is_transfer
    FROM stops s
    JOIN stop_times st ON s.stop_id = st.stop_id
    JOIN longest_trip lt ON st.trip_id = lt.trip_id
    ORDER BY st.stop_sequence
  ),
  transfer_info AS (
    -- Get transfer routes for transfer stops
    SELECT 
      rs.stop_id,
      ARRAY_AGG(DISTINCT r.route_short_name) as transfer_routes
    FROM route_stops rs
    JOIN stop_times st ON rs.stop_id = st.stop_id
    JOIN trips t ON st.trip_id = t.trip_id
    JOIN routes r ON t.route_id = r.route_id
    WHERE rs.is_transfer = TRUE
    GROUP BY rs.stop_id
  )
  SELECT 
    rs.stop_id::TEXT,
    rs.stop_name::TEXT,
    rs.stop_lat::FLOAT,
    rs.stop_lon::FLOAT,
    rs.stop_sequence::INTEGER,
    rs.is_transfer::BOOLEAN,
    COALESCE(ti.transfer_routes, ARRAY[]::TEXT[]) as transfer_routes
  FROM route_stops rs
  LEFT JOIN transfer_info ti ON rs.stop_id = ti.stop_id
  ORDER BY rs.stop_sequence;
END;
$$;
