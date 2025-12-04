const fs = require('fs');
const path = require('path');

// Read the input files
const tsvPath = path.join(__dirname, 'newContext.tsv');
const corePlacenamesPath = path.join(__dirname, '_LabelerCollections', 'core-placenames.json');

console.log('Reading input files...');

// Parse TSV file
function parseTSV(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.trim().split('\n');
  const headers = lines[0].split('\t').map(h => h.trim());
  
  return lines.slice(1).map(line => {
    const values = line.split('\t').map(v => v.trim());
    const row = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });
    return row;
  });
}

const contextUpdates = parseTSV(tsvPath);
const corePlacenames = JSON.parse(fs.readFileSync(corePlacenamesPath, 'utf8'));

console.log(`Loaded ${contextUpdates.length} context updates from TSV`);
console.log(`Loaded ${Object.keys(corePlacenames).length} core placenames\n`);

// Create a map of updates for quick lookup
const updateMap = new Map();
contextUpdates.forEach(row => {
  const key = Object.values(row)[0]; // First column is the key
  const newContext = Object.values(row)[1] || ''; // Second column is the context
  updateMap.set(key, newContext);
});

console.log(`Processing updates...`);
let updateCount = 0;
let notFoundCount = 0;
const notFoundKeys = [];

// Update the contexts
for (const [placeKey, newContext] of updateMap.entries()) {
  if (corePlacenames[placeKey]) {
    if (!corePlacenames[placeKey].context) {
      corePlacenames[placeKey].context = {};
    }
    corePlacenames[placeKey].context.en = newContext;
    updateCount++;
  } else {
    notFoundCount++;
    notFoundKeys.push(placeKey);
  }
}

// Write the new file
const outputPath = path.join(__dirname, '_LabelerCollections', 'core-placenames-newcontext.json');
fs.writeFileSync(outputPath, JSON.stringify(corePlacenames, null, 2), 'utf8');

console.log(`\n✓ Created: ${outputPath}`);
console.log(`\nSummary:`);
console.log(`  Contexts updated: ${updateCount}`);
console.log(`  Keys not found: ${notFoundCount}`);

if (notFoundKeys.length > 0) {
  console.log(`\nKeys not found in core-placenames.json:`);
  notFoundKeys.forEach(key => console.log(`  - ${key}`));
}
