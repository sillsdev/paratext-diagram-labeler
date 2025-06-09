@echo off
echo Building Biblical Map Labeler with icon focus...

:: Copy icons to all required locations
echo Ensuring icons are in all required locations...
if exist "public\icon.ico" (
    copy /Y "public\icon.ico" "icon.ico"
    copy /Y "public\icon.ico" "build\icon.ico"
    copy /Y "public\icon.ico" "build\resources\icon.ico"
    if not exist "buildResources" mkdir buildResources
    copy /Y "public\icon.ico" "buildResources\icon.ico"
    echo Icon copied to all locations.
) else (
    echo ERROR: icon.ico not found in public directory!
    exit /b 1
)

:: Create app.manifest
echo Creating app.manifest in buildResources directory...
echo ^<?xml version="1.0" encoding="UTF-8" standalone="yes"?^> > "buildResources\app.manifest"
echo ^<assembly xmlns="urn:schemas-microsoft-com:asm.v1" manifestVersion="1.0"^> >> "buildResources\app.manifest"
echo   ^<assemblyIdentity version="1.0.0.0" processorArchitecture="*" name="Biblical.Map.Labeler" type="win32"/^> >> "buildResources\app.manifest"
echo   ^<description^>Biblical Map Labeler^</description^> >> "buildResources\app.manifest"
echo   ^<compatibility xmlns="urn:schemas-microsoft-com:compatibility.v1"^> >> "buildResources\app.manifest"
echo     ^<application^> >> "buildResources\app.manifest"
echo       ^<!-- Windows 10 --^> >> "buildResources\app.manifest"
echo       ^<supportedOS Id="{8e0f7a12-bfb3-4fe8-b9a5-48fd50a15a9a}"/^> >> "buildResources\app.manifest"
echo     ^</application^> >> "buildResources\app.manifest"
echo   ^</compatibility^> >> "buildResources\app.manifest"
echo ^</assembly^> >> "buildResources\app.manifest"
echo App manifest created.

:: Run electron-builder with specific icon focus
echo Building application with icon focus...
call npx electron-builder --win --publish never --config.npmRebuild=false --config.win.icon=icon.ico --config.directories.buildResources=buildResources

echo Checking if we need to refresh the icon cache...
echo.
echo If the EXE still doesn't show the correct icon in Windows Explorer:
echo 1. Close all File Explorer windows
echo 2. Open a Command Prompt as Administrator and run:
echo    IE4UINIT.EXE -ClearIconCache
echo 3. Restart Explorer (Task Manager > File > Run new task > explorer.exe)
echo.
echo Build process complete.
pause
