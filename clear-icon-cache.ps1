Write-Host "Clearing Windows icon cache (aggressive method)..." -ForegroundColor Yellow

# Stop explorer and related processes
Write-Host "Stopping explorer.exe..." -ForegroundColor Cyan
Stop-Process -Name explorer -Force -ErrorAction SilentlyContinue

# Wait for processes to stop
Start-Sleep -Seconds 2

# Delete icon cache files
$iconCachePaths = @(
    "$env:LOCALAPPDATA\IconCache.db",
    "$env:LOCALAPPDATA\Microsoft\Windows\Explorer\iconcache*.db",
    "$env:LOCALAPPDATA\Microsoft\Windows\Explorer\thumbcache*.db"
)

foreach ($path in $iconCachePaths) {
    Write-Host "Clearing cache: $path" -ForegroundColor Cyan
    try {
        Remove-Item $path -Force -Recurse -ErrorAction SilentlyContinue
        Write-Host "[OK] Cleared: $path" -ForegroundColor Green
    } catch {
        Write-Host "[WARNING] Could not clear: $path" -ForegroundColor Yellow
    }
}

# Clear shell icon cache registry
Write-Host "Clearing shell icon cache registry..." -ForegroundColor Cyan
try {
    Remove-ItemProperty -Path "HKCU:\Software\Classes\Local Settings\Software\Microsoft\Windows\Shell\BagMRU" -Name "*" -Force -ErrorAction SilentlyContinue
    Remove-ItemProperty -Path "HKCU:\Software\Classes\Local Settings\Software\Microsoft\Windows\Shell\Bags" -Name "*" -Force -ErrorAction SilentlyContinue
    Write-Host "[OK] Registry cache cleared" -ForegroundColor Green
} catch {
    Write-Host "[WARNING] Could not clear registry cache" -ForegroundColor Yellow
}

# Restart explorer
Write-Host "Restarting explorer.exe..." -ForegroundColor Cyan
Start-Process explorer.exe

Write-Host "Icon cache clearing complete. You may need to refresh File Explorer (F5) to see changes." -ForegroundColor Green
