// debug-map-loading.js
const fs = require('fs-extra');
const path = require('path');

console.log('Debugging map image loading issues...');

// Get the base directory
const buildDir = path.join(__dirname, 'build');
const baseMapsDir = path.join(buildDir, 'base-maps');
const assetsDir = path.join(buildDir, 'assets', 'maps');

// Create the map-tester.html file that will help diagnose map loading
console.log('Creating map-tester.html file to diagnose issues...');

// 1. Check if build/base-maps directory exists
console.log(`Checking if base-maps directory exists at: ${baseMapsDir}`);
if (fs.existsSync(baseMapsDir)) {
  console.log('✅ base-maps directory exists');
  
  // 2. Check if there are map files in it
  const mapFiles = fs.readdirSync(baseMapsDir).filter(file => 
    file.toLowerCase().endsWith('.jpg') || 
    file.toLowerCase().endsWith('.png')
  );
  
  console.log(`Found ${mapFiles.length} map files in base-maps directory`);
  if (mapFiles.length > 0) {
    console.log('Sample files:');
    mapFiles.slice(0, 5).forEach(file => console.log(`- ${file}`));
  } else {
    console.error('❌ No map files found in base-maps directory!');
  }
} else {
  console.error('❌ base-maps directory does not exist!');
}

// 3. Look for the map files referenced in the app
console.log('\nChecking map file references in MapData.js...');
try {
  // Read MapData.js to find which map files are being referenced
  const mapDataPath = path.join(__dirname, 'src', 'MapData.js');
  if (fs.existsSync(mapDataPath)) {
    const mapDataContent = fs.readFileSync(mapDataPath, 'utf8');
    
    // Extract image filenames
    const filenameRegex = /imgFilename:\s*['"]([^'"]+)['"]/g;
    const referencedFiles = [];
    let match;
    
    while ((match = filenameRegex.exec(mapDataContent)) !== null) {
      referencedFiles.push(match[1]);
    }
    
    // Save this list for our test HTML file
    global.referencedMapFiles = referencedFiles;
    
    console.log(`Found ${referencedFiles.length} map file references in MapData.js`);
    if (referencedFiles.length > 0) {
      console.log('Sample references:');
      referencedFiles.slice(0, 5).forEach(file => {
        const exists = fs.existsSync(path.join(baseMapsDir, file));
        console.log(`- ${file}: ${exists ? '✅ Found' : '❌ Missing'}`);
      });
    }
  } else {
    console.error('❌ MapData.js file not found!');
  }
} catch (err) {
  console.error('Error reading MapData.js:', err);
}

// 4. Check the preload.js file for getMapPath handler
console.log('\nVerifying preload.js includes getMapPath...');
const preloadPath = path.join(__dirname, 'preload.js');
const buildPreloadPath = path.join(buildDir, 'preload.js');
if (fs.existsSync(preloadPath)) {
  const preloadContent = fs.readFileSync(preloadPath, 'utf8');
  if (preloadContent.includes('getMapPath')) {
    console.log('✅ preload.js contains getMapPath method');
  } else {
    console.error('❌ preload.js does NOT contain getMapPath method!');
  }
} else {
  console.error('❌ preload.js file not found!');
}

// Check if build/preload.js also contains getMapPath
if (fs.existsSync(buildPreloadPath)) {
  const buildPreloadContent = fs.readFileSync(buildPreloadPath, 'utf8');
  if (buildPreloadContent.includes('getMapPath')) {
    console.log('✅ build/preload.js contains getMapPath method');
  } else {
    console.error('❌ build/preload.js does NOT contain getMapPath method!');
    
    // Fix it by copying the correct preload.js to build
    console.log('Fixing build/preload.js by copying from project root...');
    fs.copyFileSync(preloadPath, buildPreloadPath);
  }
} else {  console.error('❌ build/preload.js file not found!');
}

// Now create the comprehensive map-tester.html file
console.log('\nCreating enhanced map-tester.html file...');

// Get a list of sample maps to test
const testMaps = global.referencedMapFiles || [];
if (testMaps.length === 0 && mapFiles && mapFiles.length > 0) {
  // If we couldn't extract maps from MapData.js, use the first few from the directory
  testMaps.push(...mapFiles.slice(0, 3));
}

const testMapHtml = `<!DOCTYPE html>
<html>
<head>
    <title>Biblical Map App - Map Loading Tester</title>
    <meta charset="UTF-8">
    <base href="./" />
    <style>
        body {
            font-family: Arial, sans-serif;
            max-width: 900px;
            margin: 0 auto;
            padding: 20px;
            line-height: 1.6;
        }
        h1, h2 {
            color: #333;
        }
        .image-test {
            margin-bottom: 30px;
            border: 1px solid #ddd;
            padding: 15px;
            border-radius: 5px;
            background-color: #f9f9f9;
        }
        .image-container {
            max-width: 100%;
            overflow: auto;
            margin-top: 10px;
        }
        .success {
            color: green;
            font-weight: bold;
        }
        .failure {
            color: red;
            font-weight: bold;
        }
        img {
            max-width: 100%;
            border: 1px solid #ccc;
            margin-top: 10px;
        }
        .test-info {
            margin-bottom: 16px;
            padding: 10px;
            background-color: #e0f7fa;
            border-radius: 4px;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
        }
        th, td {
            padding: 8px;
            border: 1px solid #ddd;
            text-align: left;
        }
        th {
            background-color: #f2f2f2;
        }
    </style>
</head>
<body>
    <h1>Biblical Map App - Map Loading Test</h1>
    
    <div class="test-info">
        <p>This page tests whether map images can be loaded from different paths.</p>
        <p><strong>Current Date/Time:</strong> <span id="datetime"></span></p>
        <script>document.getElementById('datetime').textContent = new Date().toLocaleString();</script>
    </div>
    
    <div class="image-test">
        <h2>Test 1: Loading from base-maps (Relative Path)</h2>
        <div class="image-container">
            <p>URL: <code>./base-maps/${testMaps[0] || 'SMR1_155wbt - Holy Land.jpg'}</code></p>
            <div id="status1"></div>
            <img id="img1" src="./base-maps/${testMaps[0] || 'SMR1_155wbt - Holy Land.jpg'}" 
                 onload="document.getElementById('status1').innerHTML='<span class=\\'success\\'>SUCCESS: Image loaded correctly</span>'" 
                 onerror="document.getElementById('status1').innerHTML='<span class=\\'failure\\'>FAILED: Image could not be loaded</span>'">
        </div>
    </div>
    
    <div class="image-test">
        <h2>Test 2: Loading from assets/maps (Development Path)</h2>
        <div class="image-container">
            <p>URL: <code>./assets/maps/${testMaps[0] || 'SMR1_155wbt - Holy Land.jpg'}</code></p>
            <div id="status2"></div>
            <img id="img2" src="./assets/maps/${testMaps[0] || 'SMR1_155wbt - Holy Land.jpg'}" 
                 onload="document.getElementById('status2').innerHTML='<span class=\\'success\\'>SUCCESS: Image loaded correctly</span>'" 
                 onerror="document.getElementById('status2').innerHTML='<span class=\\'failure\\'>FAILED: Image could not be loaded</span>'">
        </div>
    </div>
    
    <div class="image-test">
        <h2>Test 3: Loading with Absolute Path</h2>
        <div class="image-container">
            <p>URL: <code>/base-maps/${testMaps[0] || 'SMR1_155wbt - Holy Land.jpg'}</code></p>
            <div id="status3"></div>
            <img id="img3" src="/base-maps/${testMaps[0] || 'SMR1_155wbt - Holy Land.jpg'}" 
                 onload="document.getElementById('status3').innerHTML='<span class=\\'success\\'>SUCCESS: Image loaded correctly</span>'" 
                 onerror="document.getElementById('status3').innerHTML='<span class=\\'failure\\'>FAILED: Image could not be loaded</span>'">
        </div>
    </div>
    
    <h2>Path Resolution Guidelines</h2>
    <ul>
        <li>In development mode, map images are expected in <code>/assets/maps/</code></li>
        <li>In production mode, map images are expected in <code>./base-maps/</code></li>
        <li>The application should handle both relative and absolute paths appropriately</li>
        <li>The most reliable path format for Electron is relative paths with <code>./base-maps/</code></li>
    </ul>
    
    <h2>All Referenced Maps</h2>
    <table>
        <tr>
            <th>Map File</th>
            <th>Exists in base-maps</th>
        </tr>
        ${testMaps.map(map => `
        <tr>
            <td>${map}</td>
            <td>${fs.existsSync(path.join(baseMapsDir, map)) ? 
                '<span class="success">✓ Found</span>' : 
                '<span class="failure">✗ Missing</span>'}</td>
        </tr>`).join('')}
    </table>
</body>
</html>`;

// Write the test file
const testFilePath = path.join(buildDir, 'map-tester.html');
fs.writeFileSync(testFilePath, testMapHtml);
console.log(`Map tester HTML created at: ${testFilePath}`);
console.log('Open this file in a browser to test image loading');

// Copy the tester to the dist folder if it exists (for testing in the distribution build)
const distDir = path.join(__dirname, 'dist', 'win-unpacked');
if (fs.existsSync(distDir)) {
  const distTestFilePath = path.join(distDir, 'map-tester.html');
  fs.writeFileSync(distTestFilePath, testMapHtml);
  console.log(`Also copied map tester to: ${distTestFilePath}`);
}

console.log('\nDebugging complete. Please check the output above for issues.');
