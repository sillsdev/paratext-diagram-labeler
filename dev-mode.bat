@echo off
setlocal

set "PORT=3000"

echo Checking if React dev server is already running on port %PORT%...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":%PORT% " ^| findstr LISTENING') do (
    set "PID=%%a"
    goto :server_already_running
)

rem -------------------------------------------------
rem SERVER NOT RUNNING → start it
echo Starting React dev server on port %PORT%...
start cmd /k "npm start"

rem Wait for server to be ready (max 15 seconds)
echo Waiting for server to start...
:wait_loop
timeout /t 1 >nul
netstat -aon | findstr ":%PORT% " | findstr LISTENING >nul
if %errorlevel% equ 0 goto :server_ready
set /a "count+=1"
if %count% geq 15 (
    echo ERROR: Server failed to start in 15 seconds.
    exit /b 1
)
goto :wait_loop

:server_ready
echo React server is ready on port %PORT%.
timeout /t 2 >nul
goto :launch_electron

rem -------------------------------------------------
:server_already_running
echo React server already running (PID %PID%).

:launch_electron
echo Starting Electron...
set NODE_ENV=development
npx electron electron-main.js

endlocal