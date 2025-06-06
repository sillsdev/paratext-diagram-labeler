@echo off
REM filepath: c:\git\mapLabelerExt\biblical-map-app\build-and-test.bat

echo ===== Biblical Map App - Build and Test =====
echo.
echo This script will build and test the app in production mode.
echo.

echo Setting NODE_ENV to production...
set NODE_ENV=production

echo Step 1: Building React app...
call npm run build
if %ERRORLEVEL% NEQ 0 (
  echo ERROR: Build failed!
  goto :end
)

echo Step 2: Copying resources...
call npm run copy-resources
if %ERRORLEVEL% NEQ 0 (
  echo WARNING: Error copying resources!
)

echo Step 3: Copying map resources...
node copy-map-resources.js
if %ERRORLEVEL% NEQ 0 (
  echo WARNING: Error copying maps!
)

echo Step 4: Fixing HTML paths...
node fix-html-paths.js

echo Step 5: Verifying path resolution...
node verify-path-resolution.js

echo Step 6: Creating map tester HTML...
node debug-map-loading.js

echo.
echo ===== Build Complete =====
echo.

echo Would you like to test the application now? (Y/N)
set /p choice=
if /i "%choice%"=="Y" (
  echo.
  echo Starting application in production mode...
  echo Press Ctrl+C to exit when done testing.
  echo.
  call npm run electron-prod
) else (
  echo.
  echo You can test the application later by running:
  echo npm run electron-prod
)

:end
echo.
echo Build and test process complete.
pause
