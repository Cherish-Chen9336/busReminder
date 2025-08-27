Write-Host "🚌 启动迪拜公交助手..." -ForegroundColor Green
Write-Host ""
Write-Host "📱 这是一个PWA应用，支持添加到主屏幕" -ForegroundColor Cyan
Write-Host "🔔 包含实时公交提醒功能" -ForegroundColor Cyan
Write-Host "🌐 支持离线使用" -ForegroundColor Cyan
Write-Host ""
Write-Host "正在启动开发服务器..." -ForegroundColor Yellow

try {
    npm run dev
} catch {
    Write-Host "❌ 启动失败，请检查是否已安装依赖" -ForegroundColor Red
    Write-Host "💡 运行 'npm install' 安装依赖" -ForegroundColor Yellow
}

Read-Host "按任意键退出"
