@echo off
echo Building Paratext Diagram Labeler Release...

:: Verify icon files exist before building
echo Verifying icon files...
powershell -ExecutionPolicy Bypass -File verify-icon.ps1

:: Clean previous builds
echo Cleaning up old builds...
rmdir /s /q dist 2>nul

:: Set NODE_ENV to production explicitly
set NODE_ENV=production

:: Ensure icon is in public folder for React build
echo Ensuring icon is in public folder...
if not exist "public\icon.ico" (
    echo Copying icon from buildResources to public...
    copy /Y "buildResources\icon.ico" "public\icon.ico"
) else (
    echo Icon already exists in public folder.
)

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

echo Running electron-builder...
call npx electron-builder --win --publish never --config.npmRebuild=false

:: Run additional icon embedding as a backup
echo Running additional icon embedding...
node embed-icon.js

:: Clear Windows icon cache to force refresh
REM echo Clearing Windows icon cache...
REM powershell -ExecutionPolicy Bypass -File clear-icon-cache.ps1

:: Verify the build
echo Verifying build files...
if exist "dist\win-unpacked\Paratext Diagram Labeler.exe" (
    echo [SUCCESS] Unpacked application created successfully.
    echo Checking if icon is embedded in executable...
    powershell -Command "if ((Get-ItemProperty 'dist\win-unpacked\Paratext Diagram Labeler.exe').VersionInfo.FileDescription) { Write-Host '[OK] Executable has metadata' } else { Write-Host '[WARNING] Executable may not have icon' }"
) else (
    echo [WARNING] Unpacked application missing!
)

REM if exist "dist\Paratext Diagram Labeler Setup*.exe" (
    REM echo [SUCCESS] Installer created successfully.
REM ) else (
    REM echo [WARNING] Installer not found!
REM )

REM if exist "dist\Paratext Diagram Labeler*.exe" (
    REM echo [SUCCESS] Portable version created successfully.
REM ) else (
    REM echo [WARNING] Portable version not found!
REM )

echo.
echo Build process complete. Release files are in the 'dist' folder.
pause
