@echo off
setlocal

title UrbanFabric Frontend Dev - Full

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0frontend\Start-FrontendDev.ps1" -Mode Full
if errorlevel 1 (
  echo.
  echo UrbanFabric development frontend full mode failed to start.
  echo.
  pause
)
