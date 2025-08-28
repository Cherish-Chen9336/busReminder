Write-Host "Testing production build for GitHub Pages..." -ForegroundColor Green
Write-Host ""

Write-Host "Building with production settings..." -ForegroundColor Yellow
npm run build:prod

if ($LASTEXITCODE -ne 0) {
    Write-Host "Build failed!" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host ""
Write-Host "Build successful! Testing preview..." -ForegroundColor Green
Write-Host ""

npm run preview

Write-Host ""
Write-Host "Test completed. Press Enter to exit..." -ForegroundColor Green
Read-Host
