@echo off
setlocal
title UrbanFabric PCA-tSNE Viewer

cd /d "%~dp0"

if not exist "..\frontend\node_modules\vite\bin\vite.js" (
  echo Missing shared frontend dependencies.
  echo Please run npm.cmd install in ..\frontend first.
  pause
  exit /b 1
)

echo Starting UrbanFabric PCA/t-SNE Scale Viewer...
echo URL: http://127.0.0.1:5174/
echo.
npm.cmd run dev

echo.
echo Viewer stopped.
pause
