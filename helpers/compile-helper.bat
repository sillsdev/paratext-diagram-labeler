@echo off
REM Compile the SantaFeBroadcast helper as a self-contained executable
REM This can be run during the build process to create a helper that doesn't require .NET to be installed

echo Compiling SantaFeBroadcast helper...

REM Try to find csc.exe in common locations
set CSC_PATH=
for %%f in (
    "C:\Program Files\Microsoft Visual Studio\2022\*\MSBuild\Current\Bin\Roslyn\csc.exe"
    "C:\Program Files (x86)\Microsoft Visual Studio\2019\*\MSBuild\Current\Bin\Roslyn\csc.exe"
    "C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
    "C:\Windows\Microsoft.NET\Framework\v4.0.30319\csc.exe"
) do (
    if exist "%%f" (
        set CSC_PATH=%%f
        goto :found_csc
    )
)

:found_csc
if "%CSC_PATH%"=="" (
    echo ERROR: Could not find csc.exe. Please ensure .NET Framework or Visual Studio is installed.
    echo Alternatively, use: dotnet publish -c Release --self-contained -r win-x64 -p:PublishSingleFile=true
    pause
    exit /b 1
)

echo Using CSC: %CSC_PATH%
"%CSC_PATH%" /target:exe /out:SantaFeBroadcast.exe SantaFeBroadcast.cs

if %ERRORLEVEL% EQU 0 (
    echo SUCCESS: SantaFeBroadcast.exe compiled successfully
) else (
    echo ERROR: Compilation failed
    pause
    exit /b 1
)

pause
