@echo off
echo Running Biblical Map App with console output...

:: Run Electron in development mode with console window
set NODE_ENV=development
start powershell -NoExit -Command "& {npm run electron-dev}"

echo Application started. Check the PowerShell window for console output.
