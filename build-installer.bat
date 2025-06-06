@echo off
echo Building installer from unpacked application...

if not exist "dist\win-unpacked\Biblical Map Labeler.exe" (
    echo ERROR: Cannot find the unpacked application.
    echo Please run build-release.bat first to create the unpacked app.
    pause
    exit /b 1
)

echo Running electron-builder to create installer...
call npx electron-builder --win --prepackaged dist\win-unpacked

echo Installer build complete. Check the dist folder for the installers.
pause
