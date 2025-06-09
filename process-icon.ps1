
# This script ensures the icon file is correctly formatted and in the right places
# for electron-builder to use it in the app EXE and installer

Write-Host "=== Processing App Icon Files ===" -ForegroundColor Cyan

# Define paths
$publicIconPath = Join-Path $PSScriptRoot "public\icon.ico"
$buildIconPath = Join-Path $PSScriptRoot "build\icon.ico"
$resourcesIconPath = Join-Path $PSScriptRoot "build\resources\icon.ico"

# Check if source icon exists
if (-Not (Test-Path $publicIconPath)) {
    Write-Host "❌ ERROR: Source icon not found at: $publicIconPath" -ForegroundColor Red
    exit 1
}

# Create resources directory if it doesn't exist
$resourcesDir = Join-Path $PSScriptRoot "build\resources"
if (-Not (Test-Path $resourcesDir)) {
    Write-Host "Creating resources directory: $resourcesDir"
    New-Item -ItemType Directory -Path $resourcesDir -Force | Out-Null
}

# Copy icon to build directory
Write-Host "Copying icon to build directory..."
Copy-Item -Path $publicIconPath -Destination $buildIconPath -Force
Write-Host "Copying icon to resources directory..."
Copy-Item -Path $publicIconPath -Destination $resourcesIconPath -Force

# Verify icon exists in required locations
Write-Host "Verifying icon files..." -ForegroundColor Cyan
$locations = @(
    $buildIconPath,
    $resourcesIconPath
)

foreach ($location in $locations) {
    if (Test-Path $location) {
        $iconSize = (Get-Item $location).Length
        Write-Host "✅ Icon exists at $location (Size: $iconSize bytes)" -ForegroundColor Green
    } else {
        Write-Host "❌ Icon missing from $location" -ForegroundColor Red
    }
}

Write-Host "`nIcon processing complete" -ForegroundColor Cyan
Write-Host "Make sure your icon.ico file contains 256x256 pixels as its largest size" -ForegroundColor Yellow
