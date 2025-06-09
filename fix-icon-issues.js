const fs = require('fs-extra');
const path = require('path');

console.log('=== Comprehensive Icon Fix Script ===');

// Define paths
const rootDir = __dirname;
const iconSource = path.join(rootDir, 'public', 'icon.ico');
const rootIconPath = path.join(rootDir, 'icon.ico');
const buildIconPath = path.join(rootDir, 'build', 'icon.ico');
const buildResourcesDir = path.join(rootDir, 'buildResources');
const buildResourcesIconPath = path.join(buildResourcesDir, 'icon.ico');

// Ensure buildResources directory exists
if (!fs.existsSync(buildResourcesDir)) {
  fs.mkdirSync(buildResourcesDir, { recursive: true });
  console.log(`Created buildResources directory: ${buildResourcesDir}`);
}

// Check if source icon exists
if (!fs.existsSync(iconSource)) {
  console.error(`❌ ERROR: Source icon not found at: ${iconSource}`);
  process.exit(1);
}

// Copy icon to all required locations
console.log('Copying icon to all required locations...');

// Copy to root directory
fs.copySync(iconSource, rootIconPath, { overwrite: true });
console.log(`✅ Copied icon to: ${rootIconPath}`);

// Copy to buildResources directory
fs.copySync(iconSource, buildResourcesIconPath, { overwrite: true });
console.log(`✅ Copied icon to: ${buildResourcesIconPath}`);

// Copy to build directory if it exists
if (fs.existsSync(path.dirname(buildIconPath))) {
  fs.copySync(iconSource, buildIconPath, { overwrite: true });
  console.log(`✅ Copied icon to: ${buildIconPath}`);
  
  // Also copy to build/resources if it exists
  const buildResourcesPath = path.join(rootDir, 'build', 'resources');
  if (fs.existsSync(buildResourcesPath)) {
    fs.copySync(iconSource, path.join(buildResourcesPath, 'icon.ico'), { overwrite: true });
    console.log(`✅ Copied icon to: ${path.join(buildResourcesPath, 'icon.ico')}`);
  }
}

// Create app.manifest file in buildResources
console.log('Creating app.manifest in buildResources directory...');
const manifestContent = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<assembly xmlns="urn:schemas-microsoft-com:asm.v1" manifestVersion="1.0">
  <assemblyIdentity version="1.0.0.0" processorArchitecture="*" name="Biblical.Map.Labeler" type="win32"/>
  <description>Scripture Map Labeler</description>
  <dependency>
    <dependentAssembly>
      <assemblyIdentity type="win32" name="Microsoft.Windows.Common-Controls" version="6.0.0.0" processorArchitecture="*" publicKeyToken="6595b64144ccf1df" language="*"/>
    </dependentAssembly>
  </dependency>
  <compatibility xmlns="urn:schemas-microsoft-com:compatibility.v1">
    <application>
      <!-- Windows 10 and 11 -->
      <supportedOS Id="{8e0f7a12-bfb3-4fe8-b9a5-48fd50a15a9a}"/>
    </application>
  </compatibility>
  <application xmlns="urn:schemas-microsoft-com:asm.v3">
    <windowsSettings>
      <dpiAware xmlns="http://schemas.microsoft.com/SMI/2005/WindowsSettings">true</dpiAware>
      <longPathAware xmlns="http://schemas.microsoft.com/SMI/2016/WindowsSettings">true</longPathAware>
    </windowsSettings>
  </application>
</assembly>`;

const manifestPath = path.join(buildResourcesDir, 'app.manifest');
fs.writeFileSync(manifestPath, manifestContent, 'utf8');
console.log(`✅ Created manifest at: ${manifestPath}`);

// Update package.json
console.log('Updating package.json...');
const packagePath = path.join(rootDir, 'package.json');
const packageJson = require(packagePath);

if (packageJson.build) {
  // Update buildResources directory
  packageJson.build.directories = packageJson.build.directories || {};
  packageJson.build.directories.buildResources = "buildResources";
  
  // Update win configuration  packageJson.build.win = packageJson.build.win || {};
  packageJson.build.win.icon = "icon.ico";
  packageJson.build.win.target = ["nsis", "portable"];
  
  // Update nsis configuration
  packageJson.build.nsis = packageJson.build.nsis || {};
  packageJson.build.nsis.oneClick = false;
  packageJson.build.nsis.allowToChangeInstallationDirectory = true;
  packageJson.build.nsis.installerIcon = "icon.ico";
  packageJson.build.nsis.uninstallerIcon = "icon.ico";
  packageJson.build.nsis.installerHeaderIcon = "icon.ico";
  
  // Explicitly set asarUnpack array to include the icon
  packageJson.build.asarUnpack = packageJson.build.asarUnpack || [];
  if (!packageJson.build.asarUnpack.includes("icon.ico")) {
    packageJson.build.asarUnpack.push("icon.ico");
  }
}

fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2), 'utf8');
console.log('✅ Updated package.json');

// Clear Windows icon cache message
console.log('\n=== IMPORTANT ===');
console.log('After rebuilding your application, if the EXE icon still shows the default React icon,');
console.log('you may need to clear the Windows icon cache. Here\'s how:');
console.log('1. Close File Explorer if it\'s open');
console.log('2. Run the following command as administrator:');
console.log('   IE4UINIT.EXE -ClearIconCache');
console.log('   or');
console.log('   IE4UINIT.EXE -show');
console.log('3. Restart Windows Explorer (Task Manager > File > Run new task > explorer.exe)');
console.log('=== END ===\n');

console.log('Icon fix script completed!');
