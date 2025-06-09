const fs = require('fs-extra');
const path = require('path');
const { execSync } = require('child_process');

console.log('=== Creating Standalone Icon Fix Package ===');

// Define paths
const iconToolsDir = path.join(__dirname, 'IconFix');

// Create the icon tools directory if it doesn't exist
if (!fs.existsSync(iconToolsDir)) {
  fs.mkdirSync(iconToolsDir, { recursive: true });
  console.log(`Created directory: ${iconToolsDir}`);
}

// Create PowerShell script in the IconFix directory
const psScript = `
# Standalone Icon Fix Tool for Biblical Map App
# Run as administrator for best results

Write-Host "=== Biblical Map App Icon Fix Tool ===" -ForegroundColor Cyan

# Check if we're running as administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "WARNING: This script works best when run as administrator." -ForegroundColor Yellow
    Write-Host "Consider restarting with admin privileges." -ForegroundColor Yellow
}

# Look for the EXE in common locations
$possibleLocations = @(
    ".\\dist\\win-unpacked\\Biblical Map Labeler.exe",
    "..\\dist\\win-unpacked\\Biblical Map Labeler.exe",
    "..\\Biblical Map Labeler.exe"
)

$exePath = $null
$iconPath = ".\\icon.ico"

# Find the exe
foreach ($location in $possibleLocations) {
    if (Test-Path $location) {
        $exePath = (Get-Item $location).FullName
        Write-Host "Found executable at: $exePath" -ForegroundColor Green
        break
    }
}

# If exe not found, ask user
if ($null -eq $exePath) {
    Write-Host "Could not automatically find the Biblical Map Labeler.exe file." -ForegroundColor Yellow
    $userPath = Read-Host "Please enter the full path to the Biblical Map Labeler.exe file"
    
    if (Test-Path $userPath) {
        $exePath = (Get-Item $userPath).FullName
    } else {
        Write-Host "Invalid path. Exiting." -ForegroundColor Red
        exit 1
    }
}

# Check if rcedit.exe exists
if (Test-Path ".\\rcedit.exe") {
    $rceditPath = ".\\rcedit.exe"
    Write-Host "Found rcedit.exe in current directory." -ForegroundColor Green
} else {
    Write-Host "Downloading rcedit.exe..." -ForegroundColor Yellow
    
    try {
        Invoke-WebRequest -Uri "https://github.com/electron/rcedit/releases/download/v1.1.1/rcedit-x64.exe" -OutFile "rcedit.exe"
        $rceditPath = ".\\rcedit.exe"
        Write-Host "Downloaded rcedit.exe successfully." -ForegroundColor Green
    } catch {
        Write-Host "Failed to download rcedit. Error: $_" -ForegroundColor Red
        Write-Host "Please download rcedit manually from: https://github.com/electron/rcedit/releases" -ForegroundColor Red
        exit 1
    }
}

# Apply the icon
Write-Host "Applying icon to executable..." -ForegroundColor Cyan
try {
    & $rceditPath $exePath --set-icon $iconPath
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Icon successfully applied to the executable!" -ForegroundColor Green
    } else {
        Write-Host "rcedit failed with exit code $LASTEXITCODE" -ForegroundColor Red
    }
} catch {
    Write-Host "Error executing rcedit: $_" -ForegroundColor Red
}

# Try Resource Hacker if installed
$resHackerPath = "$env:ProgramFiles\\Resource Hacker\\ResourceHacker.exe"
if (Test-Path $resHackerPath) {
    Write-Host "Resource Hacker found, using it as backup method..." -ForegroundColor Cyan
    try {
        & $resHackerPath -open $exePath -save $exePath -action addoverwrite -res $iconPath -mask ICONGROUP,1,1033
        Write-Host "Resource Hacker completed successfully." -ForegroundColor Green
    } catch {
        Write-Host "Error with Resource Hacker: $_" -ForegroundColor Red
    }
} else {
    Write-Host "Resource Hacker not found. If rcedit didn't work, consider installing Resource Hacker." -ForegroundColor Yellow
}

# Clear icon cache
Write-Host "Attempting to refresh icon cache..." -ForegroundColor Cyan
try {
    Write-Host "Stopping Explorer..."
    Stop-Process -Name explorer -Force -ErrorAction SilentlyContinue
    
    if (Test-Path "$env:SystemRoot\\System32\\ie4uinit.exe") {
        Write-Host "Clearing icon cache..."
        Start-Process "$env:SystemRoot\\System32\\ie4uinit.exe" -ArgumentList "-ClearIconCache" -Wait
        Start-Sleep -Seconds 1
    }
    
    Write-Host "Restarting Explorer..."
    Start-Process explorer
    Write-Host "Icon cache refresh attempted." -ForegroundColor Green
} catch {
    Write-Host "Failed to refresh icon cache: $_" -ForegroundColor Red
    Write-Host "You may need to restart your computer to see the icon changes." -ForegroundColor Yellow
}

Write-Host "\`n=== Icon Fix Complete ===" -ForegroundColor Cyan
Write-Host "If the icon is still not showing correctly:" -ForegroundColor Yellow
Write-Host "1. Restart your computer to fully clear the icon cache"
Write-Host "2. Try installing Resource Hacker and using it manually: http://angusj.com/resourcehacker/"
Write-Host "3. Make sure your icon.ico file contains multiple sizes (256x256 down to 16x16)"

Read-Host "Press Enter to exit"
`;

fs.writeFileSync(path.join(iconToolsDir, 'FixIcon.ps1'), psScript);
console.log('Created FixIcon.ps1 script');

// Copy icon.ico to the IconFix directory
const iconSource = path.join(__dirname, 'public', 'icon.ico');
const iconDest = path.join(iconToolsDir, 'icon.ico');
if (fs.existsSync(iconSource)) {
  fs.copyFileSync(iconSource, iconDest);
  console.log(`Copied icon.ico to the IconFix directory`);
} else {
  console.error(`ERROR: icon.ico not found at ${iconSource}`);
}

// Create a simple BAT launcher that runs the PowerShell script as admin
const batContent = `@echo off
echo Running Icon Fix Tool as administrator...
powershell -Command "Start-Process PowerShell -ArgumentList '-ExecutionPolicy Bypass -File "%~dp0FixIcon.ps1"' -Verb RunAs"
`;

fs.writeFileSync(path.join(iconToolsDir, 'Run-Icon-Fix.bat'), batContent);
console.log('Created Run-Icon-Fix.bat');

// Download rcedit.exe
console.log('Attempting to download rcedit.exe...');
try {
  const downloadCommand = `powershell -Command "Invoke-WebRequest -Uri 'https://github.com/electron/rcedit/releases/download/v1.1.1/rcedit-x64.exe' -OutFile '${path.join(iconToolsDir, 'rcedit.exe')}'"`;
  execSync(downloadCommand);
  console.log('Successfully downloaded rcedit.exe');
} catch (error) {
  console.error(`Failed to download rcedit.exe: ${error.message}`);
  console.log('Please download it manually from: https://github.com/electron/rcedit/releases');
}

// Create README.txt
const readmeContent = `Biblical Map App Icon Fix Tool
===========================

This tool helps fix icon issues with the Biblical Map App executable.

Instructions:

1. Make sure the Biblical Map Labeler.exe has been built
2. Run "Run-Icon-Fix.bat" by right-clicking and selecting "Run as administrator"
3. Follow the on-screen instructions

If you encounter any issues:
- Make sure you run the bat file as administrator
- Try restarting your computer after fixing the icon
- Install Resource Hacker (http://angusj.com/resourcehacker/) for manual icon editing

Files included:
- FixIcon.ps1 - PowerShell script that fixes the icon
- Run-Icon-Fix.bat - Batch file to run the PowerShell script as admin
- icon.ico - The icon file to be applied
- rcedit.exe - Tool to modify Windows executable resources
`;

fs.writeFileSync(path.join(iconToolsDir, 'README.txt'), readmeContent);
console.log('Created README.txt');

console.log('\n=== Icon Fix Package Creation Complete ===');
console.log(`The standalone icon fix tool is available in: ${iconToolsDir}`);
console.log('After building your app, you can:');
console.log('1. Navigate to the IconFix directory');
console.log('2. Right-click on "Run-Icon-Fix.bat" and select "Run as administrator"');
console.log('3. Follow the on-screen instructions to fix the EXE icon');
