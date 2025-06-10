@echo off
echo Resetting Paratext configuration to simulate fresh installation...
cd /d "%~dp0"
npx electron reset-paratext-config.js
pause
