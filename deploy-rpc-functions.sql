-- Deploy RPC functions to Supabase
-- Run this in your Supabase SQL editor

-- 1. Create PostGIS function for nearest stops
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

-- 2. Create function for stop details
CREATE OR REPLACE FUNCTION fn_stop_details(
  p_stop_id TEXT,
  p_current_time TIME DEFAULT NULL
)
RETURNS TABLE (
  stop_id TEXT,
  stop_name TEXT,
  stop_lat FLOAT,
  stop_lon FLOAT,
  route_id TEXT,
  route_short_name TEXT,
  route_long_name TEXT,
  trip_headsign TEXT,
  departure_time TIME,
  eta_minutes INTEGER,
  is_active_service BOOLEAN
)
LANGUAGE plpgsql
AS $$
DECLARE
  current_time_val TIME;
BEGIN
  -- Use provided time or current time
  IF p_current_time IS NULL THEN
    current_time_val := CURRENT_TIME;
  ELSE
    current_time_val := p_current_time;
  END IF;

  RETURN QUERY
  WITH active_services AS (
    -- Get active service IDs for today
    SELECT DISTINCT c.service_id
    FROM calendar c
    WHERE c.start_date <= CURRENT_DATE 
      AND c.end_date >= CURRENT_DATE
      AND (
        (EXTRACT(DOW FROM CURRENT_DATE) = 0 AND c.sunday = 1) OR
        (EXTRACT(DOW FROM CURRENT_DATE) = 1 AND c.monday = 1) OR
        (EXTRACT(DOW FROM CURRENT_DATE) = 2 AND c.tuesday = 1) OR
        (EXTRACT(DOW FROM CURRENT_DATE) = 3 AND c.wednesday = 1) OR
        (EXTRACT(DOW FROM CURRENT_DATE) = 4 AND c.thursday = 1) OR
        (EXTRACT(DOW FROM CURRENT_DATE) = 5 AND c.friday = 1) OR
        (EXTRACT(DOW FROM CURRENT_DATE) = 6 AND c.saturday = 1)
      )
    UNION
    -- Include calendar_dates exceptions
    SELECT DISTINCT cd.service_id
    FROM calendar_dates cd
    WHERE cd.date = CURRENT_DATE
      AND cd.exception_type = 1
    EXCEPT
    SELECT DISTINCT cd.service_id
    FROM calendar_dates cd
    WHERE cd.date = CURRENT_DATE
      AND cd.exception_type = 2
  ),
  stop_routes AS (
    -- Get all routes that serve this stop
    SELECT DISTINCT 
      s.stop_id,
      s.stop_name,
      s.stop_lat,
      s.stop_lon,
      r.route_id,
      r.route_short_name,
      r.route_long_name,
      t.trip_headsign,
      st.departure_time,
      CASE 
        WHEN st.departure_time >= current_time_val THEN
          EXTRACT(EPOCH FROM (st.departure_time - current_time_val)) / 60
        ELSE
          EXTRACT(EPOCH FROM (st.departure_time + INTERVAL '24 hours' - current_time_val)) / 60
      END::INTEGER as eta_minutes,
      CASE WHEN as.service_id IS NOT NULL THEN TRUE ELSE FALSE END as is_active_service
    FROM stops s
    JOIN stop_times st ON s.stop_id = st.stop_id
    JOIN trips t ON st.trip_id = t.trip_id
    JOIN routes r ON t.route_id = r.route_id
    LEFT JOIN active_services as ON t.service_id = as.service_id
    WHERE s.stop_id = p_stop_id
      AND st.departure_time IS NOT NULL
  )
  SELECT 
    sr.stop_id::TEXT,
    sr.stop_name::TEXT,
    sr.stop_lat::FLOAT,
    sr.stop_lon::FLOAT,
    sr.route_id::TEXT,
    sr.route_short_name::TEXT,
    sr.route_long_name::TEXT,
    sr.trip_headsign::TEXT,
    sr.departure_time,
    sr.eta_minutes::INTEGER,
    sr.is_active_service
  FROM stop_routes sr
  WHERE sr.eta_minutes >= 0 
    AND sr.eta_minutes <= 120  -- Next 2 hours
    AND sr.is_active_service = TRUE
  ORDER BY sr.eta_minutes ASC;
END;
$$;

-- 3. Create function for route stops
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

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION fn_nearest_stops_postgis TO anon;
GRANT EXECUTE ON FUNCTION fn_stop_details TO anon;
GRANT EXECUTE ON FUNCTION fn_route_stops TO anon;
