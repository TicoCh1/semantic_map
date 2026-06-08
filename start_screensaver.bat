@echo off
setlocal

title UrbanFabric Frontend Dev - Screensaver

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0frontend\Start-FrontendDev.ps1" -Mode Screensaver
if errorlevel 1 (
  echo.
  echo UrbanFabric development frontend screensaver mode failed to start.
  echo.
  pause
)
