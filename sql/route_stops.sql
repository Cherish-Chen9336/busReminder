-- Database change script: Implement route stops query functionality
-- Author: Dubai Bus Buddy
-- Date: 2024

-- 1. Ensure trips table contains necessary columns
-- Add direction_id column (if not exists)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'trips' AND column_name = 'direction_id') THEN
        ALTER TABLE trips ADD COLUMN direction_id INTEGER;
    END IF;
END $$;

-- Add shape_id column (if not exists)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'trips' AND column_name = 'shape_id') THEN
        ALTER TABLE trips ADD COLUMN shape_id TEXT;
    END IF;
END $$;

-- 2. Create necessary indexes for performance improvement
CREATE INDEX IF NOT EXISTS idx_trips_route_id ON trips(route_id);
CREATE INDEX IF NOT EXISTS idx_stop_times_trip_id_sequence ON stop_times(trip_id, stop_sequence);

-- 3. Create main RPC function: route_stops
CREATE OR REPLACE FUNCTION route_stops(
    p_route_id TEXT,
    p_service_date DATE DEFAULT CURRENT_DATE,
    p_direction INTEGER DEFAULT NULL,
    p_max_trips INTEGER DEFAULT 1
)
RETURNS TABLE(
    order_no INTEGER,
    stop_id TEXT,
    stop_name TEXT,
    stop_lat DOUBLE PRECISION,
    stop_lon DOUBLE PRECISION,
    trip_id TEXT,
    shape_id TEXT,
    direction_id INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_trip_ids TEXT[];
    v_trip_id TEXT;
    v_stop_count INTEGER;
    v_max_stops INTEGER := 0;
    v_selected_trips TEXT[] := '{}';
    v_service_date DATE := COALESCE(p_service_date, CURRENT_DATE);
    v_dow INTEGER := EXTRACT(DOW FROM v_service_date); -- 0=Sunday, 1=Monday, etc.
    v_service_id TEXT;
BEGIN
    -- Find valid service ID for specified date
    SELECT service_id INTO v_service_id
    FROM calendar c
    WHERE c.service_id IN (
        SELECT DISTINCT t.service_id 
        FROM trips t 
        WHERE t.route_id = p_route_id
    )
    AND (
        (v_dow = 0 AND c.sunday = 1) OR
        (v_dow = 1 AND c.monday = 1) OR
        (v_dow = 2 AND c.tuesday = 1) OR
        (v_dow = 3 AND c.wednesday = 1) OR
        (v_dow = 4 AND c.thursday = 1) OR
        (v_dow = 5 AND c.friday = 1) OR
        (v_dow = 6 AND c.saturday = 1)
    )
    AND c.start_date <= v_service_date
    AND c.end_date >= v_service_date
    LIMIT 1;

    -- If no valid service for the day, check for exception dates
    IF v_service_id IS NULL THEN
        SELECT service_id INTO v_service_id
        FROM calendar_dates cd
        WHERE cd.service_id IN (
            SELECT DISTINCT t.service_id 
            FROM trips t 
            WHERE t.route_id = p_route_id
        )
        AND cd.date = v_service_date
        AND cd.exception_type = 1 -- Add service
        LIMIT 1;
    END IF;

    -- If still no valid service found, fallback to any trip
    IF v_service_id IS NULL THEN
        -- Get all trips for this route, sorted by stop count
        FOR v_trip_id IN 
            SELECT t.trip_id
            FROM trips t
            WHERE t.route_id = p_route_id
            AND (p_direction IS NULL OR t.direction_id = p_direction)
            ORDER BY (
                SELECT COUNT(*) 
                FROM stop_times st 
                WHERE st.trip_id = t.trip_id
            ) DESC
            LIMIT p_max_trips
        LOOP
            v_selected_trips := array_append(v_selected_trips, v_trip_id);
        END LOOP;
    ELSE
        -- Use valid service ID to find trips
        FOR v_trip_id IN 
            SELECT t.trip_id
            FROM trips t
            WHERE t.route_id = p_route_id
            AND t.service_id = v_service_id
            AND (p_direction IS NULL OR t.direction_id = p_direction)
            ORDER BY (
                SELECT COUNT(*) 
                FROM stop_times st 
                WHERE st.trip_id = t.trip_id
            ) DESC
            LIMIT p_max_trips
        LOOP
            v_selected_trips := array_append(v_selected_trips, v_trip_id);
        END LOOP;
    END IF;

    -- If no trips found, return empty result
    IF array_length(v_selected_trips, 1) IS NULL THEN
        RETURN;
    END IF;

    -- Return stop information for selected trips
    RETURN QUERY
    SELECT 
        st.stop_sequence::INTEGER as order_no,
        s.stop_id,
        s.stop_name,
        s.stop_lat,
        s.stop_lon,
        st.trip_id,
        t.shape_id,
        t.direction_id
    FROM stop_times st
    JOIN stops s ON st.stop_id = s.stop_id
    JOIN trips t ON st.trip_id = t.trip_id
    WHERE st.trip_id = ANY(v_selected_trips)
    ORDER BY st.trip_id, st.stop_sequence;
END;
$$;

-- 4. Create auxiliary RPC function: route_id_by_short_name
CREATE OR REPLACE FUNCTION route_id_by_short_name(
    p_route_short_name TEXT
)
RETURNS TABLE(
    route_id TEXT,
    route_short_name TEXT,
    route_long_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        r.route_id,
        r.route_short_name,
        r.route_long_name
    FROM routes r
    WHERE r.route_short_name = p_route_short_name
    ORDER BY r.route_id
    LIMIT 10; -- Limit return result count
END;
$$;

-- 5. Grant execute permissions to anon user
GRANT EXECUTE ON FUNCTION route_stops(TEXT, DATE, INTEGER, INTEGER) TO anon;
GRANT EXECUTE ON FUNCTION route_id_by_short_name(TEXT) TO anon;

-- 6. Refresh dependent materialized views (if they exist)
-- Note: This assumes stop_times_norm materialized view exists, skip if not
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM pg_matviews WHERE matviewname = 'stop_times_norm') THEN
        REFRESH MATERIALIZED VIEW stop_times_norm;
    END IF;
END $$;

-- 7. Data self-check queries
-- Check data integrity of necessary tables
DO $$
DECLARE
    v_stops_count INTEGER;
    v_stop_times_count INTEGER;
    v_trips_count INTEGER;
    v_routes_count INTEGER;
    v_calendar_count INTEGER;
BEGIN
    -- Check stops table
    SELECT COUNT(*) INTO v_stops_count FROM stops;
    IF v_stops_count = 0 THEN
        RAISE WARNING 'stops table is empty, please ensure stop data is imported';
    ELSE
        RAISE NOTICE 'stops table contains % records', v_stops_count;
    END IF;

    -- Check stop_times table
    SELECT COUNT(*) INTO v_stop_times_count FROM stop_times;
    IF v_stop_times_count = 0 THEN
        RAISE WARNING 'stop_times table is empty, please ensure schedule data is imported';
    ELSE
        RAISE NOTICE 'stop_times table contains % records', v_stop_times_count;
    END IF;

    -- Check trips table
    SELECT COUNT(*) INTO v_trips_count FROM trips;
    IF v_trips_count = 0 THEN
        RAISE WARNING 'trips table is empty, please ensure trip data is imported';
    ELSE
        RAISE NOTICE 'trips table contains % records', v_trips_count;
    END IF;

    -- Check routes table
    SELECT COUNT(*) INTO v_routes_count FROM routes;
    IF v_routes_count = 0 THEN
        RAISE WARNING 'routes table is empty, please ensure route data is imported';
    ELSE
        RAISE NOTICE 'routes table contains % records', v_routes_count;
    END IF;

    -- Check calendar table
    SELECT COUNT(*) INTO v_calendar_count FROM calendar;
    IF v_calendar_count = 0 THEN
        RAISE WARNING 'calendar table is empty, please ensure service calendar data is imported';
    ELSE
        RAISE NOTICE 'calendar table contains % records', v_calendar_count;
    END IF;
END $$;

-- 8. Example test queries
-- Test route_stops function (using a known route_id)
-- Note: Please replace 'F11' with an actual existing route_id
/*
SELECT 
    'Testing route_stops function' as test_name,
    COUNT(*) as result_count
FROM route_stops('F11', CURRENT_DATE, NULL, 1);
*/

-- Test route_id_by_short_name function
/*
SELECT 
    'Testing route_id_by_short_name function' as test_name,
    COUNT(*) as result_count
FROM route_id_by_short_name('8');
*/

-- Completion message
DO $$
BEGIN
    RAISE NOTICE 'Database change script execution completed!';
    RAISE NOTICE 'Created the following functions:';
    RAISE NOTICE '1. route_stops(p_route_id, p_service_date, p_direction, p_max_trips)';
    RAISE NOTICE '2. route_id_by_short_name(p_route_short_name)';
    RAISE NOTICE 'Added necessary indexes and permissions';
    RAISE NOTICE 'Please run test queries to verify functionality';
END $$;
