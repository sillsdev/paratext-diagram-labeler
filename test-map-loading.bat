@echo off
echo Testing map loading from base-maps folder...

:: Set environment to production
set NODE_ENV=production

:: Ensure HTML paths are fixed
echo Fixing HTML paths...
node copy-resources.js

:: Copy map resources to base-maps folder
echo Copying map resources...
node copy-map-resources.js

:: Run electron on the build directory
echo Running the application...
npx electron build/electron.js

pause
