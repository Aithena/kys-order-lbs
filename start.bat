@echo off
cd /d "%~dp0"

set PORT=18805
set URL=http://127.0.0.1:%PORT%/

echo.
echo  Order LBS map tool
echo  URL: %URL%
echo  Close this window to stop the server.
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Node.js not found. Please install Node.js first.
  pause
  exit /b 1
)

if not exist "node_modules\" (
  echo First run: installing dependencies...
  call npm install
  if errorlevel 1 (
    echo [ERROR] npm install failed.
    pause
    exit /b 1
  )
  echo.
)

start "" powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -Command "Start-Sleep -Seconds 2; Start-Process '%URL%'"

call npm run dev

echo.
echo Server stopped. If the page did not open, check port %PORT%.
echo Manual URL: %URL%
pause
