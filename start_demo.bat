@echo off
setlocal

title UrbanFabric Frontend Dev - Demo

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0frontend\Start-FrontendDev.ps1" -Mode Demo
if errorlevel 1 (
  echo.
  echo UrbanFabric development frontend demo mode failed to start.
  echo.
  pause
)
