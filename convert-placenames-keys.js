const fs = require('fs');
const path = require('path');

// Function to convert a key to CamelCase
function toCamelCase(key) {
  // Remove trailing "_nt" or "_ot"
  let cleanKey = key.replace(/_(nt|ot)$/, '');
  
  // Split by underscores and convert to CamelCase
  const words = cleanKey.split('_');
  const camelCase = words
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('');
  
  return camelCase;
}

// Read the input file
const inputPath = path.join(__dirname, '_LabelerCollections', 'SMR', 'placenames-before.json');
const outputPath = path.join(__dirname, '_LabelerCollections', 'SMR', 'placenames.json');

console.log('Reading placenames-before.json...');
const inputData = JSON.parse(fs.readFileSync(inputPath, 'utf8'));

console.log('Converting keys...');
const outputData = {};
const keyChanges = [];

for (const [oldKey, value] of Object.entries(inputData)) {
  const newKey = toCamelCase(oldKey);
  outputData[newKey] = value;
  
  // Track changes for reporting
  if (oldKey !== newKey) {
    keyChanges.push({ old: oldKey, new: newKey });
  }
}

console.log('Writing placenames.json...');
fs.writeFileSync(outputPath, JSON.stringify(outputData, null, 2), 'utf8');

console.log('✓ Conversion complete!');
console.log(`  Input: ${inputPath}`);
console.log(`  Output: ${outputPath}`);
console.log(`  Entries processed: ${Object.keys(outputData).length}`);
console.log(`  Keys changed: ${keyChanges.length}`);

// Show some examples of changed keys
if (keyChanges.length > 0) {
  console.log('\nSample key transformations:');
  const samples = keyChanges.slice(0, 10);
  samples.forEach(({ old, new: newKey }) => {
    console.log(`  ${old} -> ${newKey}`);
  });
  if (keyChanges.length > 10) {
    console.log(`  ... and ${keyChanges.length - 10} more`);
  }
}
