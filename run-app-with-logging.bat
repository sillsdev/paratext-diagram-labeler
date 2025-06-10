@echo off
echo Running Biblical Map App with detailed logging...
cd /d "%~dp0"
set NODE_ENV=production
echo Console output will appear below. Look for dialog-related messages.
echo -----------------------------------------------------------
npx electron electron-main.js
pause
