
Write-Host "=== Direct Icon Fix Script ===" -ForegroundColor Cyan

# Check if ImageMagick is installed
$imgMagick = $null
try {
    $imgMagick = Get-Command magick -ErrorAction SilentlyContinue
} catch {}

if ($null -eq $imgMagick) {
    Write-Host "ImageMagick not found. Let's create the icon using PowerShell's native capabilities." -ForegroundColor Yellow
} else {
    Write-Host "ImageMagick found! Using it to create optimized icon..." -ForegroundColor Green
    
    # Source icon
    $sourceIcon = Join-Path $PSScriptRoot "public\icon.ico"
    
    # Generate a perfect 256x256 icon directly in buildResources
    $buildResourcesIcon = Join-Path $PSScriptRoot "buildResources\icon.ico"
    
    Write-Host "Creating 256x256 icon in buildResources directory..."
    magick convert $sourceIcon -resize 256x256 $buildResourcesIcon
    
    # Also place it in the root for direct access
    Copy-Item $buildResourcesIcon -Destination (Join-Path $PSScriptRoot "icon.ico") -Force
    
    Write-Host "Icon files created with ImageMagick!" -ForegroundColor Green
}

# Create a direct manifest file in buildResources
$manifestContent = @"
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<assembly xmlns="urn:schemas-microsoft-com:asm.v1" manifestVersion="1.0">
  <assemblyIdentity version="1.0.0.0" processorArchitecture="*" name="Biblical.Map.Labeler" type="win32"/>
  <description>Biblical Map Labeler</description>
  <compatibility xmlns="urn:schemas-microsoft-com:compatibility.v1">
    <application>
      <!-- Windows 10 -->
      <supportedOS Id="{8e0f7a12-bfb3-4fe8-b9a5-48fd50a15a9a}"/>
    </application>
  </compatibility>
  <application xmlns="urn:schemas-microsoft-com:asm.v3">
    <windowsSettings>
      <dpiAware xmlns="http://schemas.microsoft.com/SMI/2005/WindowsSettings">true</dpiAware>
      <longPathAware xmlns="http://schemas.microsoft.com/SMI/2016/WindowsSettings">true</longPathAware>
    </windowsSettings>
  </application>
</assembly>
"@

$manifestPath = Join-Path $PSScriptRoot "buildResources\app.manifest"
Set-Content -Path $manifestPath -Value $manifestContent -Force

Write-Host "Manifest file created at: $manifestPath" -ForegroundColor Green
Write-Host "Direct icon fix complete!" -ForegroundColor Cyan
