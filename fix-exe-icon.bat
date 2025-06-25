@echo off
echo Manual Icon Fix Script
echo ======================

if not exist "dist\win-unpacked\Scripture Map Labeler.exe" (
    echo ERROR: Built executable not found!
    echo Please run build-release.bat first.
    pause
    exit /b 1
)

echo Running manual icon embedding...
node embed-icon.js

echo Clearing icon cache...
powershell -ExecutionPolicy Bypass -File clear-icon-cache.ps1

echo.
echo Manual icon fix complete!
echo If the icon still doesn't appear:
echo 1. Try restarting Windows
echo 2. Right-click the exe and select "Refresh"
echo 3. Navigate away from the folder and back
echo.
pause
