-- Deploy route RPC functions
-- Run this in your Supabase SQL editor

-- RPC function to get headsigns for a route
create or replace function route_headsigns(in_route_id text)
returns table (headsign text, trips integer)
language sql stable security definer set search_path=public as $$
  select coalesce(nullif(t.trip_headsign,''),'(Unknown)') as headsign,
         count(*) as trips
  from trips t
  where t.route_id::text = in_route_id
  group by 1
  order by trips desc, headsign;
$$;

-- RPC function to get ordered stops by headsign for a route
create or replace function route_stops_by_headsign(
  in_route_id text,
  in_headsign text default null
)
returns table (
  headsign text,
  stop_id text,
  stop_name text,
  stop_lat double precision,
  stop_lon double precision,
  seq integer
)
language sql stable security definer set search_path=public as $$
with route_trips as (
  select t.trip_id, coalesce(nullif(t.trip_headsign,''),'(Unknown)') as headsign
  from trips t
  where t.route_id::text = in_route_id
),
trip_len as (
  select rt.trip_id, rt.headsign, max(st.stop_sequence) as nstops
  from route_trips rt
  join stop_times st on st.trip_id = rt.trip_id
  group by rt.trip_id, rt.headsign
),
pick as (
  select tl.trip_id, tl.headsign
  from trip_len tl
  where (in_headsign is not null and tl.headsign = in_headsign)
  order by tl.nstops desc
  limit 1
),
pick_all as (
  select distinct on (tl.headsign) tl.trip_id, tl.headsign
  from trip_len tl
  where in_headsign is null
  order by tl.headsign, tl.nstops desc
),
chosen as (
  select * from pick
  union all
  select * from pick_all
)
select c.headsign, s.stop_id, s.stop_name, s.stop_lat, s.stop_lon, st.stop_sequence as seq
from chosen c
join stop_times st on st.trip_id = c.trip_id
join stops s on s.stop_id = st.stop_id
order by c.headsign, st.stop_sequence;
$$;

-- Grant permissions
grant execute on function route_headsigns(text) to anon, authenticated;
grant execute on function route_stops_by_headsign(text, text) to anon, authenticated;
