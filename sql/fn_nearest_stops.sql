-- Create RPC function for nearest stops calculation
-- This function returns the nearest stops with distance in meters, ordered by distance

create or replace function public.fn_nearest_stops(lat0 double precision, lon0 double precision, limit_n int default 50)
returns table (
  stop_id text,
  stop_name text,
  stop_lat double precision,
  stop_lon double precision,
  distance_m double precision
)
language sql stable as $$
  select s.stop_id, s.stop_name, s.stop_lat, s.stop_lon,
    (6371000 * acos(
       greatest(-1, least(1,
         cos(radians(lat0)) * cos(radians(s.stop_lat)) *
         cos(radians(s.stop_lon) - radians(lon0)) +
         sin(radians(lat0)) * sin(radians(s.stop_lat))
       ))
    )) as distance_m
  from public.stops s
  order by distance_m
  limit limit_n;
$$;

-- Grant execute permission to anonymous users
grant execute on function public.fn_nearest_stops(double precision, double precision, int) to anon;
