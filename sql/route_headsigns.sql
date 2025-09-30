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

grant execute on function route_headsigns(text) to anon, authenticated;
