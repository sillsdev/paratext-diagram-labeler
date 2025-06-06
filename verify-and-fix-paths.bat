@echo off
REM filepath: c:\git\mapLabelerExt\biblical-map-app\verify-and-fix-paths.bat

echo Verifying and fixing paths for the Biblical Map App...

REM Make sure HTML paths are fixed
echo Fixing HTML paths...
node fix-html-paths.js

REM Copy maps to base-maps folder
echo Copying maps to base-maps folder...
node copy-map-resources.js

REM Run verification script
echo Running path verification...
node verify-path-resolution.js

REM Create test HTML file for maps
echo Creating map test HTML...
node debug-map-loading.js

echo Done! If there are any path issues, they should be fixed now.
echo You can run electron-prod to test the application with the fixes.
