// Test script for Paratext projects path functionality
const fs = require('fs');
const path = require('path');

console.log('=== Testing Paratext Projects Path ===');

// Default path to test
const defaultPath = 'C:\\My Paratext 9 Projects';

// Function to validate a Paratext path
function validatePath(folderPath) {
  console.log(`\nValidating: ${folderPath}`);
  
  // Check if the path exists
  if (!fs.existsSync(folderPath)) {
    console.log(`❌ Path does not exist: ${folderPath}`);
    return false;
  }
  console.log(`✅ Path exists: ${folderPath}`);
  
  // Check for _MapLabelerTemplates folder
  const templatesPath = path.join(folderPath, '_MapLabelerTemplates');
  if (!fs.existsSync(templatesPath)) {
    console.log(`❌ _MapLabelerTemplates folder not found`);
    
    // Try to create the folder
    try {
      console.log(`Attempting to create _MapLabelerTemplates folder...`);
      fs.mkdirSync(templatesPath, { recursive: true });
      if (fs.existsSync(templatesPath)) {
        console.log(`✅ Successfully created _MapLabelerTemplates folder`);
      } else {
        console.log(`❌ Failed to create _MapLabelerTemplates folder`);
        return false;
      }
    } catch (err) {
      console.error(`❌ Error creating folder: ${err.message}`);
      return false;
    }
  } else {
    console.log(`✅ _MapLabelerTemplates folder exists`);
  }
  
  return true;
}

// Test default path
console.log(`Testing default path: ${defaultPath}`);
if (fs.existsSync(defaultPath)) {
  console.log(`Default path exists.`);
  validatePath(defaultPath);
} else {
  console.log(`Default path does not exist.`);
  
  // Try to find other possible Paratext paths
  console.log('\nLooking for alternative Paratext paths...');
  const commonPaths = [
    'C:\\My Paratext 8 Projects',
    'C:\\My Paratext Projects',
    path.join(process.env.USERPROFILE, 'Documents', 'My Paratext 9 Projects'),
    path.join(process.env.USERPROFILE, 'Documents', 'My Paratext 8 Projects'),
    path.join(process.env.USERPROFILE, 'My Documents', 'My Paratext 9 Projects'),
    path.join(process.env.USERPROFILE, 'My Documents', 'My Paratext 8 Projects')
  ];
  
  let foundPath = false;
  for (const testPath of commonPaths) {
    if (fs.existsSync(testPath)) {
      console.log(`Found alternative path: ${testPath}`);
      validatePath(testPath);
      foundPath = true;
    }
  }
  
  if (!foundPath) {
    console.log('No Paratext paths found in common locations.');
  }
}

console.log('\nTest complete.');
