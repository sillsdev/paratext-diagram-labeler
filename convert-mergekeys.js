const fs = require('fs');
const path = require('path');

// Function to convert a key to CamelCase with curly braces
function toCamelCaseTemplate(key) {
  // Remove trailing "_nt" or "_ot"
  let cleanKey = key.replace(/_(nt|ot)$/, '');
  
  // Split by underscores and convert to CamelCase
  const words = cleanKey.split('_');
  const camelCase = words
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('');
  
  // Enclose in curly braces
  return `{${camelCase}}`;
}

// Read the input file
const inputPath = path.join(__dirname, '_LabelerCollections', 'SMR', 'mergekeys-ori.json');
const outputPath = path.join(__dirname, '_LabelerCollections', 'SMR', 'mergekeys.json');

console.log('Reading mergekeys-ori.json...');
const inputData = JSON.parse(fs.readFileSync(inputPath, 'utf8'));

console.log('Converting data structure...');
const outputData = {};

for (const [key, value] of Object.entries(inputData)) {
  const newEntry = {
    lblTemplate: toCamelCaseTemplate(key),
    mapxKey: value.mapxKey
  };
  
  outputData[key] = newEntry;
}

console.log('Writing mergekeys.json...');
fs.writeFileSync(outputPath, JSON.stringify(outputData, null, 2), 'utf8');

console.log('✓ Conversion complete!');
console.log(`  Input: ${inputPath}`);
console.log(`  Output: ${outputPath}`);
console.log(`  Entries processed: ${Object.keys(outputData).length}`);

// Show a few examples
console.log('\nSample conversions:');
const samples = ['adriatic_sea', 'arabia_nt', 'ab', 'acts_2_10'];
samples.forEach(key => {
  if (outputData[key]) {
    console.log(`  ${key} -> ${outputData[key].lblTemplate}`);
  }
});
