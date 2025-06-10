const fs = require('fs-extra');
const path = require('path');

console.log('=== Icon Verification and Fixing ===');

// Define paths
const sourceIconPath = path.join(__dirname, 'public', 'icon.ico');
const buildIconPath = path.join(__dirname, 'build', 'icon.ico');
const distIconPath = path.join(__dirname, 'dist', 'win-unpacked', 'icon.ico');

// Check if source icon exists
console.log('Checking for icon in public directory...');
if (fs.existsSync(sourceIconPath)) {
  console.log('✅ Icon found in public directory');
  
  // Make sure it's copied to build folder
  console.log('Copying icon to build directory...');
  fs.copySync(sourceIconPath, buildIconPath, { overwrite: true });
  
  // Check if dist folder exists and copy there too
  if (fs.existsSync(path.join(__dirname, 'dist', 'win-unpacked'))) {
    console.log('Copying icon to dist/win-unpacked directory...');
    fs.copySync(sourceIconPath, distIconPath, { overwrite: true });
  }
} else {
  console.error('❌ No icon.ico found in public directory!');
  console.log('Please create an icon.ico file and place it in the public directory');
}

// Check icon in electron-main.js
console.log('\nChecking icon path in electron-main.js...');
const mainPath = path.join(__dirname, 'electron-main.js');
const buildMainPath = path.join(__dirname, 'build', 'electron-main.js');

if (fs.existsSync(mainPath)) {
  const content = fs.readFileSync(mainPath, 'utf8');
  if (content.includes("icon: path.join(__dirname, 'build/icon.ico')")) {
    console.error('❌ Found incorrect icon path in electron-main.js!');
    console.log('Fixing path...');
    
    const fixedContent = content.replace(
      "icon: path.join(__dirname, 'build/icon.ico')",
      "icon: path.join(__dirname, 'icon.ico')"
    );
    
    fs.writeFileSync(mainPath, fixedContent);
    console.log('✅ Fixed icon path in electron-main.js');
  } else if (content.includes("icon: path.join(__dirname, 'icon.ico')")) {
    console.log('✅ Icon path in electron-main.js is correct');
  } else {
    console.error('❌ Could not find icon path in electron-main.js');
  }
}

// Also fix in build/electron-main.js if it exists
if (fs.existsSync(buildMainPath)) {
  const content = fs.readFileSync(buildMainPath, 'utf8');
  if (content.includes("icon: path.join(__dirname, 'build/icon.ico')")) {
    console.error('❌ Found incorrect icon path in build/electron-main.js!');
    console.log('Fixing path...');
    
    const fixedContent = content.replace(
      "icon: path.join(__dirname, 'build/icon.ico')",
      "icon: path.join(__dirname, 'icon.ico')"
    );
    
    fs.writeFileSync(buildMainPath, fixedContent);
    console.log('✅ Fixed icon path in build/electron-main.js');
  } else if (content.includes("icon: path.join(__dirname, 'icon.ico')")) {
    console.log('✅ Icon path in build/electron-main.js is correct');
  } else {
    console.error('❌ Could not find icon path in build/electron-main.js');
  }
}

// Check package.json build configuration
console.log('\nChecking package.json build configuration...');
const packagePath = path.join(__dirname, 'package.json');
if (fs.existsSync(packagePath)) {
  const packageJson = require(packagePath);
  if (packageJson.build && packageJson.build.win && packageJson.build.win.icon === 'build/icon.ico') {
    console.error('❌ Found incorrect icon path in package.json!');
    console.log('The path should be just "build/icon.ico" in package.json as electron-builder uses a relative path');
    // This path is actually correct for electron-builder, unlike the runtime path in electron-main.js
  } else if (packageJson.build && packageJson.build.win && packageJson.build.win.icon) {
    console.log(`✅ Icon path in package.json is: ${packageJson.build.win.icon}`);
  } else {
    console.error('❌ Could not find icon configuration in package.json build.win section');
  }
}

console.log('\nIcon verification complete. If you still have issues after rebuilding:');
console.log('1. Make sure the icon.ico file contains multiple sizes (16x16 to 256x256)');
console.log('2. Try cleaning your build directories and rebuilding');
console.log('3. Check Windows icon cache by restarting Explorer or rebooting');
