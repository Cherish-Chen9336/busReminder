# 按线路获取站序功能部署指南

## 部署步骤

### 1. 数据库部署

#### 执行SQL脚本
```bash
# 在Supabase SQL Editor中执行以下脚本
psql -h your-supabase-host -U postgres -d postgres -f sql/route_stops.sql
```

或者直接在Supabase Dashboard的SQL Editor中复制粘贴 `sql/route_stops.sql` 的内容并执行。

#### 验证部署
```sql
-- 测试route_stops函数
SELECT COUNT(*) FROM route_stops('F11', CURRENT_DATE, NULL, 1);

-- 测试route_id_by_short_name函数
SELECT COUNT(*) FROM route_id_by_short_name('8');

-- 检查权限
SELECT has_function_privilege('anon', 'route_stops(TEXT, DATE, INTEGER, INTEGER)', 'EXECUTE');
SELECT has_function_privilege('anon', 'route_id_by_short_name(TEXT)', 'EXECUTE');
```

### 2. 前端部署

#### 构建项目
```bash
npm run build
```

#### 部署到GitHub Pages
```bash
npm run deploy
```

#### 验证功能
1. 打开部署的应用
2. 点击"🚌 线路查询"按钮
3. 输入测试线路号（如"8"或"F11"）
4. 点击"获取该线路站序"
5. 验证站点列表是否正确显示

## 验收检查清单

### 数据库验收
- [ ] `route_stops` RPC函数创建成功
- [ ] `route_id_by_short_name` RPC函数创建成功
- [ ] trips表包含direction_id和shape_id列
- [ ] 索引创建成功
- [ ] anon用户有执行权限
- [ ] 测试查询返回预期结果

### 前端验收
- [ ] RouteQuery组件正常渲染
- [ ] 线路查询按钮可点击
- [ ] 输入验证正常工作
- [ ] API调用成功
- [ ] 错误处理正常
- [ ] 健康检查功能正常
- [ ] 站点列表正确显示

### 功能验收
- [ ] 支持输入线路号（如"8"）
- [ ] 支持输入线路ID（如"F11"）
- [ ] 方向过滤功能正常
- [ ] 日期选择功能正常
- [ ] 回退逻辑生效
- [ ] 错误提示清晰
- [ ] 统计信息正确显示

## 故障排除

### 常见问题

#### 1. RPC函数调用失败
**症状**: 前端显示"查询失败"错误
**解决方案**:
1. 检查Supabase连接配置
2. 验证API密钥是否正确
3. 确认RPC函数已正确创建
4. 检查网络连接

#### 2. 返回空结果
**症状**: 查询成功但无站点数据
**解决方案**:
1. 检查数据库中是否有对应线路的数据
2. 验证服务日期是否有运营
3. 尝试不同的方向值
4. 使用健康检查功能诊断

#### 3. 权限错误
**症状**: 显示权限相关错误
**解决方案**:
1. 确认anon用户有执行权限
2. 检查RLS策略设置
3. 验证API密钥权限

### 调试工具

#### 1. 浏览器开发者工具
- 查看Network标签页的API请求
- 检查Console标签页的错误信息
- 使用Application标签页查看本地存储

#### 2. Supabase Dashboard
- 查看Database标签页的表结构
- 使用SQL Editor测试查询
- 检查Logs标签页的API调用记录

#### 3. 健康检查功能
- 使用应用内的"测试连接"按钮
- 查看返回的测试数据
- 根据错误信息进行相应处理

## 性能优化

### 数据库优化
1. 确保索引已创建
2. 定期分析查询性能
3. 考虑添加更多索引

### 前端优化
1. 实现查询结果缓存
2. 添加分页功能（如果站点很多）
3. 优化渲染性能

## 监控和维护

### 定期检查
1. 监控API调用成功率
2. 检查数据库性能
3. 验证数据完整性

### 更新维护
1. 定期更新依赖包
2. 监控安全漏洞
3. 优化用户体验

## 联系支持

如果遇到问题，请：
1. 查看本文档的故障排除部分
2. 检查GitHub Issues
3. 联系项目维护者

---

**部署完成后，用户就可以通过输入线路号或线路ID来查询该线路的站点顺序了！** 🚌✨
