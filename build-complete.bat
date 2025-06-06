@echo off
echo Building complete Biblical Map Labeler Release Package...
echo -----------------------------------------------------

:: Clean previous builds
echo Cleaning up old builds...
rmdir /s /q dist 2>nul
rmdir /s /q temp-portable 2>nul

:: Set NODE_ENV to production explicitly
set NODE_ENV=production

:: Build React app
echo Building React app...
call npm run build

:: Copy resources and fix paths
echo Copying resources and fixing paths...
call npm run copy-resources

:: Fix fsevents issue (macOS-only package that causes issues on Windows)
echo Fixing fsevents issue...
node fix-fsevents.js

:: Build installer
echo Running electron-builder for installer...
call npx electron-builder --win nsis --config.npmRebuild=false

:: Build portable version 
echo Building portable version...
if exist "dist\win-unpacked\Biblical Map Labeler.exe" (
    echo Found unpacked application, creating portable version...
    
    :: Create portable version from unpacked files
    call npx electron-builder --win portable --prepackaged dist\win-unpacked --config.win.target=portable --config.win.artifactName="Biblical Map Labeler Portable ${version}.${ext}" --config.asar=false
    
    echo Portable build completed.
) else (
    echo ERROR: Cannot find the unpacked application.
    echo Portable build skipped.
)

:: Verify the build
echo Verifying build files...
if exist "dist\win-unpacked\Biblical Map Labeler.exe" (
    echo [SUCCESS] Unpacked application created successfully.
) else (
    echo [WARNING] Unpacked application missing!
)

if exist "dist\Biblical Map Labeler*.exe" (
    echo [SUCCESS] Installer and/or portable version created successfully:
    dir dist\*.exe
) else (
    echo [WARNING] No EXE files found in dist folder!
)

echo.
echo Build process complete. Release files are in the 'dist' folder.
pause
