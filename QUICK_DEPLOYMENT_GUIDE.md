# 🚀 Quick RPC Deployment Guide

## 问题解决
当前应用显示404错误是因为RPC函数还没有部署到Supabase中。

## 立即修复步骤

### 1. 部署RPC函数到Supabase

1. **打开Supabase Dashboard**
   - 登录到您的Supabase项目
   - 点击左侧菜单的 "SQL Editor"

2. **复制并执行SQL脚本**
   - 复制 `deploy-rpc-functions.sql` 文件的全部内容
   - 粘贴到SQL编辑器中
   - 点击 "Run" 按钮执行

3. **验证部署成功**
   在SQL编辑器中运行以下测试查询：
   ```sql
   -- 测试最近车站函数
   SELECT * FROM fn_nearest_stops_postgis(25.2048, 55.2708, 2000, 5);
   
   -- 测试车站详情函数
   SELECT * FROM fn_stop_details('290501', '14:30:00');
   
   -- 测试路线车站函数
   SELECT * FROM fn_route_stops('X25');
   ```

### 2. 如果部署失败

如果RPC函数部署失败，应用会自动使用备用方案：
- ✅ **最近车站** - 使用客户端距离计算
- ✅ **车站详情** - 使用原始REST API方法
- ✅ **路线车站** - 使用原始查询方法

### 3. 检查应用状态

刷新应用后，查看控制台日志：
- 如果看到 "PostGIS RPC Results" - RPC函数工作正常
- 如果看到 "Fallback Results" - 使用备用方案

## 🎯 预期结果

部署RPC函数后：
- ✅ **更准确的车站距离** - PostGIS精确计算
- ✅ **更快的查询速度** - 服务器端优化
- ✅ **更稳定的结果** - 确定性算法
- ✅ **更多路线信息** - 完整的车站详情

## 🔧 故障排除

### 常见问题：

1. **PostGIS扩展未启用**
   ```sql
   CREATE EXTENSION IF NOT EXISTS postgis;
   ```

2. **权限问题**
   ```sql
   GRANT EXECUTE ON FUNCTION fn_nearest_stops_postgis TO anon;
   GRANT EXECUTE ON FUNCTION fn_stop_details TO anon;
   GRANT EXECUTE ON FUNCTION fn_route_stops TO anon;
   ```

3. **函数名称错误**
   - 确保函数名称完全匹配
   - 检查大小写是否正确

## 📞 需要帮助？

如果遇到问题：
1. 检查Supabase SQL编辑器的错误信息
2. 查看应用控制台的详细日志
3. 确认数据库表结构正确

现在应用已经配置了备用方案，即使RPC函数未部署也能正常工作！
