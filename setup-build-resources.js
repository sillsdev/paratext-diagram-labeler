const fs = require('fs-extra');
const path = require('path');

console.log('Setting up build resources directory...');

// Define paths
const buildDir = path.join(__dirname, 'build');
const resourcesDir = path.join(buildDir, 'resources');
const iconSource = path.join(__dirname, 'public', 'icon.ico');
const iconDest = path.join(resourcesDir, 'icon.ico');

// Create resources directory if it doesn't exist
if (!fs.existsSync(resourcesDir)) {
  fs.mkdirSync(resourcesDir, { recursive: true });
  console.log(`Created resources directory: ${resourcesDir}`);
}

// Copy icon to resources directory
if (fs.existsSync(iconSource)) {
  fs.copySync(iconSource, iconDest, { overwrite: true });
  console.log(`Copied icon to: ${iconDest}`);
} else {
  console.error(`ERROR: Icon not found at: ${iconSource}`);
}

// Also ensure icon is in build directory
const buildIconPath = path.join(buildDir, 'icon.ico');
if (fs.existsSync(iconSource)) {
  fs.copySync(iconSource, buildIconPath, { overwrite: true });
  console.log(`Copied icon to: ${buildIconPath}`);
}

console.log('Build resources setup complete!');
