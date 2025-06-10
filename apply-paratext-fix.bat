@echo off
echo Applying comprehensive fix to Paratext path handling...
node fix-paratext-dialog.js
if %ERRORLEVEL% EQU 0 (
    echo Fix applied successfully.
    echo Now run the app with: $env:NODE_ENV='development'; npx electron .
) else (
    echo Failed to apply fix. See error messages above.
)
pause
