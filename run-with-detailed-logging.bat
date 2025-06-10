@echo off
echo Running Biblical Map App with detailed console output...
echo.

:: Make a copy of electron-main.js to preserve any fixes
echo Creating backup of electron-main.js...
copy electron-main.js electron-main.js.debug-bak > nul

:: Clean up the stored configuration
echo Deleting stored Paratext configuration...
if exist "%APPDATA%\Electron\paratext-config.json" (
    del "%APPDATA%\Electron\paratext-config.json"
    echo Configuration deleted.
) else (
    echo No configuration found to delete.
)

:: Set up the development environment
echo Setting up development environment...
set NODE_ENV=development

:: Run the application with detailed logging
echo.
echo Running application...
echo Please check for dialog boxes asking for Paratext path...
echo.
npx electron --trace-warnings --enable-logging .

echo.
echo Application exited.
echo If you didn't see a dialog asking for the Paratext path, check the output above for clues.
pause
