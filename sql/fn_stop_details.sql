-- Function to get stop details including routes and next departures
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
