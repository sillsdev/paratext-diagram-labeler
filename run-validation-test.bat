@echo off
echo Running Paratext Path Dialog Validation Test...
cd /d "%~dp0"
npx electron validate-paratext-path-fix.js
pause
