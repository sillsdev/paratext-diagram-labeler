@echo off
echo Building Biblical Map Labeler with icon fix - no symbolic links...

:: Ensure icon files are in all the right places
echo Copying icon files to all required locations...
if exist "public\icon.ico" (
    copy /Y "public\icon.ico" "icon.ico"
    copy /Y "public\icon.ico" "build\icon.ico"
    
    if not exist "build\resources" mkdir "build\resources"
    copy /Y "public\icon.ico" "build\resources\icon.ico"
    
    if not exist "buildResources" mkdir "buildResources"
    copy /Y "public\icon.ico" "buildResources\icon.ico"
    echo Icon files copied successfully.
) else (
    echo ERROR: icon.ico not found in the public directory!
    exit /b 1
)

:: Run electron-builder with simplified options
echo Running electron-builder with simplified options...
call npx electron-builder --win portable --publish never --config.npmRebuild=false --config.win.icon=icon.ico --config.directories.buildResources=buildResources

:: Run resource-hacker directly to update the icon
echo Attempting to apply icon directly to the EXE...
if exist "dist\win-unpacked\Biblical Map Labeler.exe" (
    if exist "%ProgramFiles%\Resource Hacker\ResourceHacker.exe" (
        echo Using Resource Hacker to update the executable icon...
        "%ProgramFiles%\Resource Hacker\ResourceHacker.exe" -open "dist\win-unpacked\Biblical Map Labeler.exe" -save "dist\win-unpacked\Biblical Map Labeler.exe" -action addoverwrite -res "public\icon.ico" -mask ICONGROUP,1,1033
        echo Icon update with Resource Hacker complete.
    ) else (
        echo Resource Hacker not found. Consider installing it to manually update the icon.
    )
)

echo Build process complete. 
echo.
echo IMPORTANT: If the icon still doesn't appear correctly:
echo 1. Install Resource Hacker from http://angusj.com/resourcehacker/
echo 2. Manually open the EXE in Resource Hacker
echo 3. Replace the icon with your icon.ico file
echo 4. Save the executable
echo.
echo You may also need to clear the Windows icon cache:
echo 1. Close all File Explorer windows
echo 2. Run as admin: IE4UINIT.EXE -ClearIconCache
echo 3. Restart Explorer or reboot your computer
echo.
pause
