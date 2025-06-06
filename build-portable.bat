@echo off
echo Building portable application...

if not exist "dist\win-unpacked\Biblical Map Labeler.exe" (
    echo ERROR: Cannot find the unpacked application.
    echo Please run build-release.bat first to create the unpacked app.
    pause
    exit /b 1
)

echo Running electron-builder to create portable version...
call npx electron-builder --win portable --prepackaged dist\win-unpacked --config.win.target=portable --config.win.artifactName="Biblical Map Labeler Portable ${version}.${ext}" --debug

echo Portable build complete. Check the dist folder for the portable exe.
dir dist\*.exe
pause
