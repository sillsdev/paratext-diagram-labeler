@echo off
echo Testing the build without packaging...

:: Set environment to production
set NODE_ENV=production

:: First ensure HTML paths are fixed
echo Fixing HTML paths...
node copy-resources.js

:: Run electron on the build directory
echo Running the application...
npx electron build/electron.js

pause
