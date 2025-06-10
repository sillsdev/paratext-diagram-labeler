const fs = require('fs-extra');
const path = require('path');

// This script checks path resolution for both relative and absolute paths
// in the context of an Electron app. It simulates how paths will be resolved
// when the app runs in production.

console.log('==== Verifying Path Resolution ====');

// Get app directory paths
const appRootDir = __dirname;
const buildDir = path.join(appRootDir, 'build');
const baseMapsDir = path.join(buildDir, 'base-maps');

console.log('App Root:', appRootDir);
console.log('Build Dir:', buildDir);
console.log('Base Maps Dir:', baseMapsDir);

// Check for base-maps directory in build
if (fs.existsSync(baseMapsDir)) {
  const maps = fs.readdirSync(baseMapsDir).filter(file => 
    file.toLowerCase().endsWith('.jpg') || 
    file.toLowerCase().endsWith('.png')
  );
  console.log(`\n✅ Found ${maps.length} maps in build/base-maps directory`);
  if (maps.length > 0) {
    console.log('Sample maps:');
    maps.slice(0, 3).forEach(map => console.log(`- ${map}`));
  }
} else {
  console.log('❌ build/base-maps directory does not exist!');
}

// Check if index.html exists and analyze its structure
const indexHtmlPath = path.join(buildDir, 'index.html');
if (fs.existsSync(indexHtmlPath)) {
  console.log('\n✅ Found index.html in build directory');
  
  // Read and analyze index.html
  const htmlContent = fs.readFileSync(indexHtmlPath, 'utf8');
  
  // Check for base href tag
  const baseHrefMatch = htmlContent.match(/<base href="([^"]+)"/);
  if (baseHrefMatch) {
    console.log(`Base href tag found: ${baseHrefMatch[1]}`);
  } else {
    console.log('⚠️ No base href tag found in index.html');
  }
  
  // Check for CSS links
  const cssLinkMatches = htmlContent.match(/href="[^"]+\.css"/g);
  if (cssLinkMatches && cssLinkMatches.length > 0) {
    console.log('\nCSS links found:');
    cssLinkMatches.forEach(match => {
      const href = match.match(/href="([^"]+)"/)[1];
      console.log(`- ${href}`);
      
      // Try to resolve this path
      const absolutePath = path.resolve(buildDir, href.replace(/^\.\//, ''));
      if (fs.existsSync(absolutePath)) {
        console.log(`  ✅ Resolves to: ${absolutePath}`);
      } else {
        console.log(`  ❌ Cannot resolve path: ${absolutePath}`);
      }
    });
  } else {
    console.log('No CSS links found in index.html');
  }
  
  // Check for JS links
  const jsLinkMatches = htmlContent.match(/src="[^"]+\.js"/g);
  if (jsLinkMatches && jsLinkMatches.length > 0) {
    console.log('\nJS links found:');
    jsLinkMatches.forEach(match => {
      const src = match.match(/src="([^"]+)"/)[1];
      console.log(`- ${src}`);
      
      // Try to resolve this path
      const absolutePath = path.resolve(buildDir, src.replace(/^\.\//, ''));
      if (fs.existsSync(absolutePath)) {
        console.log(`  ✅ Resolves to: ${absolutePath}`);
      } else {
        console.log(`  ❌ Cannot resolve path: ${absolutePath}`);
      }
    });
  } else {
    console.log('No JS links found in index.html');
  }
} else {
  console.log('❌ index.html not found in build directory');
}

// Suggest protocol handler for Electron
console.log('\n==== Recommendations ====');
console.log('1. Ensure all resources use relative paths (starting with ./)');
console.log('2. Add a base href tag to index.html pointing to "./"');
console.log('3. Use protocol handler in Electron to correctly resolve file:// URLs');
console.log('4. Check CSS/JS file paths in the generated index.html after building');
