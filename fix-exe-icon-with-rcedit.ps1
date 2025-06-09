# Fix EXE icon using rcedit directly (a tool from electron-builder)
# This script requires admin privileges to work properly

Write-Host "=== Direct EXE Icon Fix Tool ===" -ForegroundColor Cyan

# Check if we're running as administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "This script should be run as administrator for best results." -ForegroundColor Yellow
    Write-Host "Attempting to continue anyway..." -ForegroundColor Yellow
}

# Define paths
$exePath = Join-Path $PSScriptRoot "dist\win-unpacked\Biblical Map Labeler.exe"
$iconPath = Join-Path $PSScriptRoot "public\icon.ico"
$rceditPath = Get-ChildItem -Path "$PSScriptRoot\node_modules" -Recurse -Filter "rcedit*.exe" | Select-Object -First 1 -ExpandProperty FullName

# Check if exe exists
if (-Not (Test-Path $exePath)) {
    Write-Host "❌ ERROR: Application executable not found at: $exePath" -ForegroundColor Red
    Write-Host "Make sure you have built the application first." -ForegroundColor Red
    exit 1
}

# Check if icon exists
if (-Not (Test-Path $iconPath)) {
    Write-Host "❌ ERROR: Icon not found at: $iconPath" -ForegroundColor Red
    exit 1
}

# Check if rcedit exists
if ($null -eq $rceditPath) {
    Write-Host "❌ ERROR: rcedit.exe not found in node_modules." -ForegroundColor Red
    Write-Host "Downloading standalone rcedit.exe..." -ForegroundColor Yellow
    
    $tempFolder = Join-Path $env:TEMP "rcedit-download"
    New-Item -ItemType Directory -Force -Path $tempFolder | Out-Null
    
    $rceditUrl = "https://github.com/electron/rcedit/releases/download/v1.1.1/rcedit-x64.exe"
    $rceditPath = Join-Path $tempFolder "rcedit-x64.exe"
    
    try {
        Invoke-WebRequest -Uri $rceditUrl -OutFile $rceditPath
        Write-Host "✅ Downloaded rcedit.exe successfully." -ForegroundColor Green
    }
    catch {
        Write-Host "❌ Failed to download rcedit.exe: $_" -ForegroundColor Red
        Write-Host "Please manually download rcedit from https://github.com/electron/rcedit/releases" -ForegroundColor Red
        exit 1
    }
}

# Apply icon to EXE using rcedit
Write-Host "Applying icon to executable using rcedit..." -ForegroundColor Cyan
Write-Host "EXE: $exePath"
Write-Host "Icon: $iconPath"
Write-Host "Tool: $rceditPath"

try {
    & $rceditPath "$exePath" --set-icon "$iconPath"
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Successfully applied icon to the executable!" -ForegroundColor Green
    }
    else {
        Write-Host "❌ rcedit process failed with exit code $LASTEXITCODE" -ForegroundColor Red
    }
}
catch {
    Write-Host "❌ Error executing rcedit: $_" -ForegroundColor Red
}

# Try Resource Hacker if available
$resourceHackerPath = "$env:ProgramFiles\Resource Hacker\ResourceHacker.exe"
if (Test-Path $resourceHackerPath) {
    Write-Host "`nTrying with Resource Hacker as backup..." -ForegroundColor Cyan
    
    try {
        & $resourceHackerPath -open "$exePath" -save "$exePath" -action addoverwrite -res "$iconPath" -mask ICONGROUP,1,1033
        Write-Host "✅ Resource Hacker process completed." -ForegroundColor Green
    }
    catch {
        Write-Host "❌ Error using Resource Hacker: $_" -ForegroundColor Red
    }
}

# Refresh icon cache
Write-Host "`nAttempting to refresh icon cache..." -ForegroundColor Cyan
try {
    Stop-Process -Name explorer -Force -ErrorAction SilentlyContinue
    if (Test-Path "$env:SystemRoot\System32\ie4uinit.exe") {
        Start-Process "$env:SystemRoot\System32\ie4uinit.exe" -ArgumentList "-ClearIconCache" -Wait
        Start-Sleep -Seconds 1
    }
    Start-Process explorer
    Write-Host "✅ Icon cache refresh attempted." -ForegroundColor Green
}
catch {
    Write-Host "❌ Failed to refresh icon cache: $_" -ForegroundColor Red
    Write-Host "You may need to restart your computer to see icon changes." -ForegroundColor Yellow
}

Write-Host "`n=== Process Complete ===" -ForegroundColor Cyan
Write-Host "If the icon is still not showing correctly:" -ForegroundColor Yellow
Write-Host "1. Restart your computer to fully clear the icon cache"
Write-Host "2. Try installing Resource Hacker and using it manually"
Write-Host "3. Check that your icon.ico file contains 256x256, 64x64, 32x32, and 16x16 sizes"
