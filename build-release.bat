@echo off
echo Building Biblical Map Labeler Release...

:: Clean previous builds
echo Cleaning up old builds...
rmdir /s /q dist 2>nul

:: Set NODE_ENV to production explicitly
set NODE_ENV=production

:: Build and Package
echo Building and packaging app...
call npm run build
call npm run copy-resources

:: Fix fsevents issue (macOS-only package that causes issues on Windows)
echo Fixing fsevents issue...
node fix-fsevents.js

:: Double-check that the HTML paths are fixed properly
echo Re-running path fixes to ensure proper file paths...
node copy-resources.js

:: Verify and fix app icon
echo Verifying and fixing app icon...
node verify-icon.js

:: Process icon files
echo Processing icon files for application and installer...
powershell -ExecutionPolicy Bypass -File process-icon.ps1
node setup-build-resources.js

echo Running electron-builder...
call npx electron-builder --win --publish never --config.npmRebuild=false

:: Verify the build
echo Verifying build files...
if exist "dist\win-unpacked\Biblical Map Labeler.exe" (
    echo [SUCCESS] Unpacked application created successfully.
) else (
    echo [WARNING] Unpacked application missing!
)

if exist "dist\Biblical Map Labeler Setup*.exe" (
    echo [SUCCESS] Installer created successfully.
) else (
    echo [WARNING] Installer not found!
)

if exist "dist\Biblical Map Labeler*.exe" (
    echo [SUCCESS] Portable version created successfully.
) else (
    echo [WARNING] Portable version not found!
)

echo.
echo Build process complete. Release files are in the 'dist' folder.
pause
