@echo off
setlocal EnableExtensions
title Auto Flow
cd /d "%~dp0"

where node >nul 2>&1
if errorlevel 1 (
  echo [Auto Flow] Node.js was not found in PATH.
  echo Install Node.js 20 or newer and try again.
  pause
  exit /b 1
)

if not exist "node_modules\" (
  echo [Auto Flow] Installing dependencies...
  call npm install
  if errorlevel 1 (
    echo [Auto Flow] npm install failed.
    pause
    exit /b 1
  )
)

echo.
echo   Auto Flow launcher
echo   -----------------
echo   1. Dev mode   - server + hot reload  http://localhost:5173
echo   2. Play mode  - build + game server  http://localhost:3001
echo.
choice /c 12 /n /t 6 /d 1 /m "Select mode [1/2], dev starts automatically in 6s: "
if errorlevel 2 goto play
goto dev

:dev
echo.
echo [Auto Flow] Starting dev server...
start "" powershell -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Seconds 4; Start-Process 'http://localhost:5173'"
call npm run dev
goto done

:play
echo.
echo [Auto Flow] Building client...
call npm run build
if errorlevel 1 (
  echo [Auto Flow] Build failed.
  pause
  exit /b 1
)
echo [Auto Flow] Starting game server...
start "" powershell -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Seconds 2; Start-Process 'http://localhost:3001'"
call npm start
goto done

:done
if errorlevel 1 (
  echo.
  echo [Auto Flow] Server stopped with an error.
  pause
)
endlocal
