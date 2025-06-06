@echo off
REM filepath: c:\git\mapLabelerExt\biblical-map-app\test-map-loading-comprehensive.bat

echo ===== Biblical Map App - Map Loading Test =====
echo.
echo This script will test map loading in different scenarios.
echo.

REM Ensure the build exists
if not exist "build\index.html" (
  echo ERROR: Build folder not found! Run 'npm run build' first.
  goto :end
)

REM Check for maps in base-maps folder
echo Checking for maps in base-maps folder...
if not exist "build\base-maps\*.jpg" (
  echo WARNING: No maps found in build\base-maps folder!
  echo Running copy-map-resources.js to copy maps...
  node copy-map-resources.js
  
  if not exist "build\base-maps\*.jpg" (
    echo ERROR: Map copying failed. Please check source map locations.
    goto :end
  ) else (
    echo Maps copied successfully.
  )
) else (
  echo Found maps in base-maps folder.
)

REM Run the verification script
echo.
echo Running path resolution verification...
node verify-path-resolution.js

REM Test index.html for path issues
echo.
echo Checking index.html paths...
powershell -Command "Get-Content build\index.html | Select-String 'href|src'"

REM Check for base href tag
powershell -Command "if(Select-String -Path build\index.html -Pattern '<base href') { Write-Host 'Base href tag found.' -ForegroundColor Green } else { Write-Host 'WARNING: No base href tag found!' -ForegroundColor Yellow; node fix-html-paths.js }"

REM Create map-tester if it doesn't exist
echo.
echo Updating map test HTML...
node debug-map-loading.js

echo.
echo ===== Test Complete =====
echo.
echo To test the app with these changes:
echo 1. Run 'npm run electron-prod' to launch the app
echo 2. Check if maps are displayed correctly
echo 3. Look for any errors in the console

:end
pause
