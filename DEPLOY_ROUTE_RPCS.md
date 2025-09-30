# 部署路线RPC函数到Supabase

## 问题
当前应用显示错误：`Route headsigns RPC failed: 404`，因为RPC函数在数据库中不存在。

## 解决方案
需要在Supabase中部署SQL RPC函数。

## 部署步骤

### 1. 登录Supabase Dashboard
- 访问 [https://supabase.com/dashboard](https://supabase.com/dashboard)
- 选择您的项目

### 2. 打开SQL编辑器
- 在左侧菜单中点击 "SQL Editor"
- 点击 "New query"

### 3. 执行SQL脚本
复制并粘贴以下SQL代码：

```sql
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
```

### 4. 运行查询
- 点击 "Run" 按钮执行SQL
- 等待执行完成

### 5. 验证部署
- 在SQL编辑器中测试函数：
```sql
-- 测试获取路线方向
select * from route_headsigns('30');

-- 测试获取路线车站
select * from route_stops_by_headsign('30', 'Dubai Sky Courts');
```

## 备用方案
如果无法立即部署RPC函数，应用会显示错误页面。可以：
1. 点击 "Retry" 按钮重试
2. 等待RPC函数部署完成
3. 刷新页面

## 预期结果
部署成功后，路线页面将：
- 显示真实的车站数量
- 支持方向切换
- 显示完整的路线地图
- 不再显示404错误
