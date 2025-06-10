@echo off
echo Building standalone portable application...

if not exist "dist\win-unpacked" (
    echo ERROR: Cannot find the unpacked application.
    echo Please run build-release.bat first to create the unpacked application.
    pause
    exit /b 1
)

echo Using only portable target configuration...
echo Copying files to temp directory...

:: Create a temp directory for portable build
rmdir /s /q temp-portable 2>nul
mkdir temp-portable
xcopy /s /e /y dist\win-unpacked\* temp-portable\

echo Running electron-builder with portable configuration only...
npx electron-builder build --dir --win portable --config.win.target=portable --config.win.artifactName="Scripture Map Labeler Portable ${version}.${ext}" --config.asar=false --projectDir=. --prepackaged=temp-portable

echo Copying resulting portable app to dist folder...
if exist "temp-portable\win-portable\Scripture Map Labeler 0.1.0.exe" (
    copy "temp-portable\win-portable\Scripture Map Labeler 0.1.0.exe" dist\
    echo Portable app created successfully!
) else (
    echo Failed to create portable app.
)

echo Cleaning up...
rmdir /s /q temp-portable 2>nul

echo Showing all exe files in dist:
dir dist\*.exe

pause
