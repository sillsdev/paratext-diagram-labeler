@echo off
echo Applying FINAL fix to Paratext path handling...
node final-paratext-path-fix.js
if %ERRORLEVEL% EQU 0 (
    echo Fix applied successfully.
    echo.
    echo Now run the app with: $env:NODE_ENV='development'; npx electron .
    echo.
    echo You should see a dialog asking you to select a Paratext folder if no valid path is found.
) else (
    echo Failed to apply fix. See error messages above.
)
pause
