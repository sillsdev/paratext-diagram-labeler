@echo off
echo Running Biblical Map App with saved configuration...
cd /d "%~dp0"
set NODE_ENV=production
echo Console output will appear below. The app should use the saved Paratext path.
echo -----------------------------------------------------------
npx electron electron-main.js
pause
