const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

console.log('Running post-build icon embedding...');

// Path to the built executable
const exePath = path.join(__dirname, 'dist', 'win-unpacked', 'Scripture Map Labeler.exe');
const iconPath = path.join(__dirname, 'buildResources', 'icon.ico');
const rceditPath = path.join(__dirname, 'IconFix', 'rcedit.exe');

if (!fs.existsSync(exePath)) {
  console.error('Executable not found:', exePath);
  process.exit(1);
}

if (!fs.existsSync(iconPath)) {
  console.error('Icon file not found:', iconPath);
  process.exit(1);
}

if (!fs.existsSync(rceditPath)) {
  console.error('rcedit.exe not found:', rceditPath);
  console.log('Please ensure rcedit.exe is in the IconFix folder');
  process.exit(1);
}

try {
  console.log('Embedding icon into executable...');
  console.log('Executable:', exePath);
  console.log('Icon:', iconPath);
  
  // Use rcedit to embed the icon
  const command = `"${rceditPath}" "${exePath}" --set-icon "${iconPath}"`;
  console.log('Running command:', command);
  
  execSync(command, { stdio: 'inherit' });
  
  console.log('Icon embedding completed successfully!');
  
  // Also set version info while we're at it
  try {
    const versionCommand = `"${rceditPath}" "${exePath}" --set-version-string "CompanyName" "SIL International" --set-version-string "FileDescription" "Scripture Map Labeler" --set-version-string "ProductName" "Scripture Map Labeler"`;
    execSync(versionCommand, { stdio: 'inherit' });
    console.log('Version info updated successfully!');
  } catch (versionError) {
    console.warn('Failed to update version info (non-critical):', versionError.message);
  }
  
} catch (error) {
  console.error('Failed to embed icon:', error.message);
  process.exit(1);
}
