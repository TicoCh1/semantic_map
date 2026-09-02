@echo off
setlocal EnableExtensions
title UrbanFabric Human Verify

set "FRONTEND_DIR=%~dp0"
set "VERIFY_PORT=5173"

if not "%~1"=="" set "VERIFY_PORT=%~1"

pushd "%FRONTEND_DIR%" >nul

where npm.cmd >nul 2>nul
if errorlevel 1 (
  echo ERROR: npm.cmd was not found on PATH. Install Node.js and npm first.
  goto :failed
)

if not exist "node_modules\.bin\vite.cmd" (
  echo ERROR: Frontend dependencies are not installed.
  echo Run npm.cmd install once inside:
  echo   %FRONTEND_DIR%
  goto :failed
)

echo Starting UrbanFabric Human Verify at:
echo   http://127.0.0.1:%VERIFY_PORT%/verify/
echo.
echo Enter the RunPod URL in the page that opens; the backend selects a scored prompt.
echo Keep this window open while rating. Press Ctrl+C to stop.
echo.

call npm.cmd run dev -- --port %VERIFY_PORT% --strictPort --open /verify/
set "LAUNCH_EXIT_CODE=%ERRORLEVEL%"
popd >nul
exit /b %LAUNCH_EXIT_CODE%

:failed
popd >nul
echo.
pause
exit /b 1
