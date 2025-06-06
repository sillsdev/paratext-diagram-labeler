// copy-map-resources.js
const fs = require('fs-extra');
const path = require('path');

// Define paths
const sourceMapDir = path.join(__dirname, 'public', 'assets', 'maps');
const buildDir = path.join(__dirname, 'build');
const distUnpackedDir = path.join(__dirname, 'dist', 'win-unpacked');
const distDir = path.join(__dirname, 'dist');

console.log('Map resources script starting...');
console.log('Source map directory:', sourceMapDir);
console.log('Build directory:', buildDir);

// Check if source maps directory exists
if (!fs.existsSync(sourceMapDir)) {
  console.error(`ERROR: Source map directory '${sourceMapDir}' does not exist!`);
  process.exit(1);
}

// Function to copy maps for a specific output directory
function copyMapsForTarget(targetDir) {
  const destMapDir = path.join(targetDir, 'base-maps');
  
  console.log(`Copying map images from ${sourceMapDir} to ${destMapDir}`);
  
  // Ensure the destination directory exists
  fs.ensureDirSync(destMapDir);
  
  // Copy all map files
  try {
    fs.copySync(sourceMapDir, destMapDir, { overwrite: true });
    console.log(`Maps copied successfully to ${destMapDir}`);
    
    // Log the copied files
    const files = fs.readdirSync(destMapDir);
    console.log(`Copied ${files.length} map files.`);
  } catch (err) {
    console.error(`Error copying maps: ${err.message}`);
  }
}

// Copy maps for development/testing build
console.log('Copying maps for development build...');
copyMapsForTarget(buildDir);

// Copy maps for production build if dist/win-unpacked exists
if (fs.existsSync(distUnpackedDir)) {
  console.log('Copying maps for production build...');
  copyMapsForTarget(distUnpackedDir);
} else {
  console.log('Production build directory not found, skipping map copy for production.');
}

// Additionally, create a separate maps folder that can be packaged separately
if (fs.existsSync(distDir)) {
  const mapsCopyDir = path.join(distDir, 'map-resources');
  console.log(`Creating separate map resources folder at ${mapsCopyDir}`);
  
  fs.ensureDirSync(mapsCopyDir);
  fs.copySync(sourceMapDir, mapsCopyDir, { overwrite: true });
  
  // Create a README file explaining how to use these map files
  const readmePath = path.join(mapsCopyDir, 'README.txt');
  const readmeContent = 
`Biblical Map Labeler - Map Resources

These map files should be copied to a folder named 'base-maps' located in the same 
directory as the Biblical Map Labeler executable.

Directory structure should be:
- Biblical Map Labeler.exe
- base-maps/
  - (all map files)

For more information, see the MAP_DISTRIBUTION.md file included with the application.`;
  
  fs.writeFileSync(readmePath, readmeContent);
  console.log('Created resources folder and README');
}

console.log('Map copying complete!');
