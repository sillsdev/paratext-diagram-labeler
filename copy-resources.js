const fs = require('fs-extra');
const path = require('path');

console.log('Starting resource copying process...');

// 1. Copy assets folder
const sourceAssetsDir = path.join(__dirname, 'public', 'assets');
const destAssetsDir = path.join(__dirname, 'build', 'assets');
console.log(`Copying assets from ${sourceAssetsDir} to ${destAssetsDir}`);
fs.copySync(sourceAssetsDir, destAssetsDir, { overwrite: true });

// 2. Copy data folder
const sourceDataDir = path.join(__dirname, 'public', 'data');
const destDataDir = path.join(__dirname, 'build', 'data');
console.log(`Copying data from ${sourceDataDir} to ${destDataDir}`);
fs.copySync(sourceDataDir, destDataDir, { overwrite: true });

// 3. Fix HTML file paths for Electron
console.log('Fixing HTML paths for Electron...');
const indexPath = path.join(__dirname, 'build', 'index.html');
if (fs.existsSync(indexPath)) {
  console.log(`Updating paths in ${indexPath}`);
  let htmlContent = fs.readFileSync(indexPath, 'utf8');
  
  // Replace absolute paths with relative paths
  // Replace href="/ with href="./ and src="/ with src="./
  htmlContent = htmlContent.replace(/(?:href|src)="\//g, (match) => match.replace('="/', '="./'));
  
  fs.writeFileSync(indexPath, htmlContent);
  console.log('HTML paths fixed successfully!');
} else {
  console.log('Warning: index.html not found in build folder');
}

// 3. Copy preload.js to build directory
const preloadSource = path.join(__dirname, 'preload.js');
const preloadDest = path.join(__dirname, 'build', 'preload.js');
console.log(`Copying ${preloadSource} to ${preloadDest}`);
fs.copySync(preloadSource, preloadDest, { overwrite: true });

// 4. Copy electron-main.js to build directory
const mainSource = path.join(__dirname, 'electron-main.js');
const mainDest = path.join(__dirname, 'build', 'electron-main.js');
console.log(`Copying ${mainSource} to ${mainDest}`);
fs.copySync(mainSource, mainDest, { overwrite: true });

// 5. Make sure package.json is copied with correct main path
const packageSource = path.join(__dirname, 'package.json');
const packageDest = path.join(__dirname, 'build', 'package.json');
console.log(`Copying and modifying ${packageSource} to ${packageDest}`);

// Read package.json, modify main field if needed, and write to build folder
let packageJson = fs.readJsonSync(packageSource);
packageJson.main = "electron-main.js"; // Set relative path for the built version
fs.writeJsonSync(packageDest, packageJson, { spaces: 2 });

// Create a simple electron.js entry point as an alternative entry in the build folder
const electronJsContent = `
const { app } = require('electron');
const path = require('path');

// Point to the real entry point
const mainPath = path.join(__dirname, 'electron-main.js');
require(mainPath);
`;

fs.writeFileSync(path.join(__dirname, 'build', 'electron.js'), electronJsContent);

console.log('Resource copying completed successfully!');
