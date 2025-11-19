const fs = require('fs');
const path = require('path');

// Read the input file
const inputPath = path.join(__dirname, '_LabelerCollections', 'SMR', 'placenames-ori.json');
const outputPath = path.join(__dirname, '_LabelerCollections', 'SMR', 'placenames.json');

console.log('Reading placenames-ori.json...');
const inputData = JSON.parse(fs.readFileSync(inputPath, 'utf8'));

console.log('Converting data structure...');
const outputData = {};

for (const [key, value] of Object.entries(inputData)) {
  const newEntry = {
    gloss: value.gloss,
    context: value.context,
    terms: [
      {
        termId: value.termId,
        transliteration: value.transliteration,
        refs: value.refs
      }
    ],
    altTermIds: value.altTermIds
  };
  
  outputData[key] = newEntry;
}

console.log('Writing placenames.json...');
fs.writeFileSync(outputPath, JSON.stringify(outputData, null, 2), 'utf8');

console.log('✓ Conversion complete!');
console.log(`  Input: ${inputPath}`);
console.log(`  Output: ${outputPath}`);
console.log(`  Entries processed: ${Object.keys(outputData).length}`);
