@echo off
echo Performing diagnostic checks on the Biblical Map Labeler distribution...
echo -----------------------------------------------------------------------

:: Check for build directory
echo Checking build directory...
if exist "build" (
    echo [OK] Build directory exists
) else (
    echo [ERROR] Build directory not found. Please run 'npm run build' first.
    exit /b 1
)

:: Check for map files in build
echo Checking map files in build directory...
if exist "build\base-maps" (
    dir /b "build\base-maps\*.jpg" > nul 2>&1
    if not errorlevel 1 (
        echo [OK] Map files found in build\base-maps
    ) else (
        echo [WARNING] No .jpg files found in build\base-maps
    )
) else (
    echo [ERROR] base-maps directory not found in build. Please run 'npm run copy-maps'
)

:: Check for production build
echo Checking production build...
if exist "dist\win-unpacked" (
    echo [OK] Production build found
    
    :: Check for base-maps in production build
    if exist "dist\win-unpacked\base-maps" (
        dir /b "dist\win-unpacked\base-maps\*.jpg" > nul 2>&1
        if not errorlevel 1 (
            echo [OK] Map files found in production build
            for /f %%A in ('dir /b "dist\win-unpacked\base-maps\*.jpg" ^| find /c /v ""') do set "map_count=%%A"
            echo     Found %map_count% map files in production build
        ) else (
            echo [WARNING] No .jpg files found in production build base-maps folder
        )
    ) else (
        echo [ERROR] base-maps directory not found in production build
    )
    
    :: Check for executable
    if exist "dist\win-unpacked\Biblical Map Labeler.exe" (
        echo [OK] Application executable found
    ) else (
        echo [WARNING] Application executable not found or has different name
    )
    
    :: Check for installer
    if exist "dist\Biblical Map Labeler Setup*.exe" (
        echo [OK] Installer found
    ) else (
        echo [WARNING] Installer not found
    )
    
) else (
    echo [INFO] Production build not found. Run 'npm run package' to create it.
)

echo.
echo Diagnostic check complete. Fix any errors before distributing the application.
echo Use build-complete.bat to create a full distribution package.
pause
