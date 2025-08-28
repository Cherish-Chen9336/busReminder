@echo off
echo Testing production build for GitHub Pages...
echo.

echo Building with production settings...
call npm run build:prod

if %ERRORLEVEL% NEQ 0 (
    echo Build failed!
    pause
    exit /b 1
)

echo.
echo Build successful! Testing preview...
echo.

call npm run preview

echo.
echo Test completed. Press any key to exit...
pause >nul
