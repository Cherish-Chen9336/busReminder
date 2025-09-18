# 按线路获取站序功能文档

## 功能概述

本功能允许用户通过输入线路号（route_short_name）或线路ID（route_id）来查询该线路的按站序排序的站点列表。

## 数据库变更

### 新增RPC函数

#### 1. route_stops
**功能**: 根据线路ID获取该线路的站点列表，按站序排序

**参数**:
- `p_route_id` (TEXT, 必填): 目标线路的route_id
- `p_service_date` (DATE, 默认current_date): 查询的服务日
- `p_direction` (INT, 默认null): 方向，若未提供则不按方向过滤
- `p_max_trips` (INT, 默认1): 当一个线路在当日有多条不同pattern的trip时，取停靠站数量最多的1条作为代表

**返回字段**:
- `order_no` (INTEGER): 站序（stop_sequence）
- `stop_id` (TEXT): 站点ID
- `stop_name` (TEXT): 站点名称
- `stop_lat` (DOUBLE PRECISION): 站点纬度
- `stop_lon` (DOUBLE PRECISION): 站点经度
- `trip_id` (TEXT): 行程ID
- `shape_id` (TEXT): 形状ID
- `direction_id` (INTEGER): 方向ID

#### 2. route_id_by_short_name
**功能**: 根据线路号获取对应的线路ID

**参数**:
- `p_route_short_name` (TEXT): 线路号（如"8"）

**返回字段**:
- `route_id` (TEXT): 线路ID
- `route_short_name` (TEXT): 线路号
- `route_long_name` (TEXT): 线路长名称

### 数据库结构变更

1. **trips表新增列**:
   - `direction_id` (INTEGER): 方向ID
   - `shape_id` (TEXT): 形状ID

2. **新增索引**:
   - `idx_trips_route_id`: trips(route_id)
   - `idx_stop_times_trip_id_sequence`: stop_times(trip_id, stop_sequence)

3. **权限设置**:
   - 为anon用户授予执行权限
   - 使用SECURITY DEFINER确保RLS策略不阻塞

## 前端集成

### 新增组件

#### RouteQuery组件
位置: `src/components/RouteQuery.tsx`

**功能**:
- 提供线路查询界面
- 支持输入线路号或线路ID
- 支持选择方向和日期
- 显示站点列表和统计信息
- 提供健康检查功能

**主要功能**:
1. 线路输入验证
2. 自动识别线路号并转换为线路ID
3. 调用RPC函数获取站点数据
4. 按站序显示站点列表
5. 错误处理和用户提示

### 更新的文件

1. **src/lib/supabase.ts**:
   - 新增 `getRouteStops()` 函数
   - 新增 `getRouteIdByShortName()` 函数

2. **src/App.tsx**:
   - 集成RouteQuery组件
   - 添加线路查询按钮

## API接口

### REST端点

#### 1. 获取线路站点
```
POST /rest/v1/rpc/route_stops
```

**请求头**:
```
apikey: <SUPABASE_ANON_KEY>
Authorization: Bearer <SUPABASE_ANON_KEY>
Content-Type: application/json
```

**请求体**:
```json
{
  "p_route_id": "F11",
  "p_service_date": "2024-01-15",
  "p_direction": 0,
  "p_max_trips": 1
}
```

**响应示例**:
```json
[
  {
    "order_no": 1,
    "stop_id": "stop_001",
    "stop_name": "起始站",
    "stop_lat": 25.2048,
    "stop_lon": 55.2708,
    "trip_id": "trip_001",
    "shape_id": "shape_001",
    "direction_id": 0
  }
]
```

#### 2. 根据线路号获取线路ID
```
POST /rest/v1/rpc/route_id_by_short_name
```

**请求体**:
```json
{
  "p_route_short_name": "8"
}
```

**响应示例**:
```json
[
  {
    "route_id": "route_008",
    "route_short_name": "8",
    "route_long_name": "8号线"
  }
]
```

## 使用说明

### 用户操作流程

1. 点击主界面的"🚌 线路查询"按钮
2. 在输入框中输入线路号（如"8"）或线路ID（如"F11"）
3. 可选：选择方向（0或1）
4. 可选：选择服务日期（默认今天）
5. 点击"获取该线路站序"按钮
6. 查看按站序排序的站点列表

### 功能特性

1. **智能识别**: 自动识别输入是线路号还是线路ID
2. **方向过滤**: 支持按方向过滤站点
3. **日期选择**: 支持查询特定日期的运营情况
4. **健康检查**: 提供系统连接测试功能
5. **错误处理**: 提供详细的错误信息和排错提示

## 验收标准

### 基本功能验收

1. ✅ 用户输入"线路号或route_id"，点击后能看到该线路的站点顺序
2. ✅ 可切换方向0/1
3. ✅ 可选择服务日（默认今天）
4. ✅ 在当天无有效服务时，回退逻辑生效，仍能返回一条代表trip的站序
5. ✅ 网络异常或权限问题时，给出明确可操作的错误提示

### 数据完整性验收

1. ✅ stops表至少包含stop_id、stop_name、stop_lat、stop_lon
2. ✅ stop_times表至少包含trip_id、stop_id、stop_sequence
3. ✅ calendar与calendar_dates表已导入
4. ✅ trips表包含direction_id和shape_id列

### 性能验收

1. ✅ 查询响应时间在合理范围内（<5秒）
2. ✅ 索引优化生效
3. ✅ RPC函数执行效率良好

## 排错指南

### 常见问题及解决方案

#### 1. 返回为空
**可能原因**:
- 该route_id在p_service_date没有有效trips
- 回退逻辑未命中任意trip
- 数据库中没有对应数据

**解决方案**:
1. 使用SQL检查该route_id是否在指定日期有有效trips
2. 检查calendar和calendar_dates表的数据
3. 确认trips表中有对应route_id的数据

#### 2. 按方向过滤为空
**可能原因**:
- 该线路在指定方向没有trips
- direction_id值不匹配

**解决方案**:
1. 提示用户清除方向限制
2. 尝试另一个方向值
3. 检查trips表中direction_id的实际值

#### 3. 路由短号找不到route_id
**可能原因**:
- route_short_name不匹配数据
- routes表中没有对应数据

**解决方案**:
1. 确认route_short_name是否正确
2. 检查routes表的数据完整性
3. 提供可用的线路号列表

#### 4. 仍无数据
**可能原因**:
- 缺少calendar_dates数据
- 数据导入不完整

**解决方案**:
1. 导入calendar_dates表数据
2. 检查数据导入脚本
3. 验证GTFS数据完整性

### 健康检查

使用健康检查功能可以快速诊断问题：
1. 点击"测试连接"按钮
2. 查看返回的测试数据
3. 根据错误信息进行相应处理

## 技术实现细节

### 数据库逻辑

1. **服务日期判断**: 使用calendar表判断指定日期的服务状态
2. **例外日期处理**: 通过calendar_dates表处理节假日等例外情况
3. **回退机制**: 当指定日期无服务时，回退到任意trip
4. **代表trip选择**: 选择停靠站数量最多的trip作为代表

### 前端实现

1. **类型安全**: 使用TypeScript确保类型安全
2. **错误处理**: 完善的错误处理和用户提示
3. **用户体验**: 加载状态、清空功能、统计信息显示
4. **响应式设计**: 支持不同屏幕尺寸

### 安全考虑

1. **权限控制**: 仅使用anon key，不使用service_role
2. **输入验证**: 前端和后端双重验证
3. **SQL注入防护**: 使用参数化查询
4. **CSP兼容**: 确保连接Supabase的域名在CSP白名单中

## 部署说明

### 数据库部署

1. 执行 `sql/route_stops.sql` 脚本
2. 验证RPC函数创建成功
3. 确认权限设置正确
4. 运行测试查询验证功能

### 前端部署

1. 确保新组件正确导入
2. 验证API调用配置
3. 测试所有功能路径
4. 检查错误处理逻辑

### 验证清单

- [ ] 数据库RPC函数创建成功
- [ ] 权限设置正确
- [ ] 索引创建成功
- [ ] 前端组件正常渲染
- [ ] API调用成功
- [ ] 错误处理正常
- [ ] 用户体验良好
- [ ] 性能满足要求
