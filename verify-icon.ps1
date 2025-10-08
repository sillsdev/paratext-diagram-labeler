Write-Host "Checking icon files..." -ForegroundColor Yellow

$buildResourcesIcon = "buildResources\icon.ico"
$publicIcon = "public\icon.ico"

if (Test-Path $buildResourcesIcon) {
    Write-Host "[OK] $buildResourcesIcon exists" -ForegroundColor Green
    $iconInfo = Get-ItemProperty $buildResourcesIcon
    Write-Host "Size: $($iconInfo.Length) bytes"
} else {
    Write-Host "[ERROR] $buildResourcesIcon missing!" -ForegroundColor Red
}

if (Test-Path $publicIcon) {
    Write-Host "[OK] $publicIcon exists" -ForegroundColor Green
} else {
    Write-Host "[WARNING] $publicIcon missing - will copy from buildResources" -ForegroundColor Yellow
}

Write-Host "`nIcon should contain multiple resolutions:" -ForegroundColor Cyan
Write-Host "- 16x16 (title bar)"
Write-Host "- 32x32 (taskbar)"
Write-Host "- 48x48 (desktop shortcut)"
Write-Host "- 64x64, 128x128, 256x256 (various Windows displays)"

Write-Host "`nVerification complete." -ForegroundColor Green
