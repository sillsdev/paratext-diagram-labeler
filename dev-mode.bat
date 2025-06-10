@echo off
echo Starting React development server...
start cmd /k "npm start"
timeout /t 5
echo Starting Electron with current source...
set NODE_ENV=development
npx electron electron-main.js