@echo off
echo Fixing electron-main.js to properly handle Paratext path detection and dialogs...
echo.

node fix-electron-main.js

echo.
echo Fix script completed. 
echo Please run the application with 'npm run electron-dev' to test the changes.
pause
