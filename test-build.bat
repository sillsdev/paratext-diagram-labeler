@echo off
echo Testing the build distribution...

if not exist "dist\win-unpacked\Biblical Map Labeler.exe" (
    echo ERROR: Cannot find the unpacked application.
    echo Please run build-release.bat first to create the distribution.
    pause
    exit /b 1
)

echo.
echo Starting the application from the distribution...
echo Press Ctrl+C to exit when done testing.
echo.

start "" "dist\win-unpacked\Biblical Map Labeler.exe"

echo Application started. Check that it's running properly.
pause
