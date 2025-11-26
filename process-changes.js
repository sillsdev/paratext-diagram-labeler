const fs = require('fs');
const path = require('path');

// Read the input files
const changesPath = path.join(__dirname, 'changes.txt');
const corePlacenamesPath = path.join(__dirname, '_LabelerCollections', 'core-placenames.json');
const mergekeysPath = path.join(__dirname, '_LabelerCollections', 'SMR', 'mergekeys.json');

// Parse TSV file
function parseTSV(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.trim().split('\n');
  const headers = lines[0].split('\t');
  
  return lines.slice(1).map(line => {
    const values = line.split('\t');
    const row = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });
    return row;
  });
}

// Read and parse files
console.log('Reading input files...');
const changes = parseTSV(changesPath);
const corePlacenames = JSON.parse(fs.readFileSync(corePlacenamesPath, 'utf8'));
const mergekeys = JSON.parse(fs.readFileSync(mergekeysPath, 'utf8'));

// Create copies for the new files
const newCorePlacenames = JSON.parse(JSON.stringify(corePlacenames));
const newMergekeys = JSON.parse(JSON.stringify(mergekeys));

// Process each change
console.log(`\nProcessing ${changes.length} changes...\n`);
let processedCount = 0;
let warnings = [];

changes.forEach((change, index) => {
  const { newLabelTemplate, oldPlaceName, englishGloss, englishContext } = change;
  
  console.log(`[${index + 1}/${changes.length}] Processing: ${oldPlaceName} -> ${newLabelTemplate}`);
  
  // Check if oldPlaceName exists in core-placenames
  if (!newCorePlacenames[oldPlaceName]) {
    warnings.push(`WARNING: oldPlaceName "${oldPlaceName}" not found in core-placenames.json`);
    return;
  }
  
  // Save the gloss and context from core-placenames
  const savedGloss = newCorePlacenames[oldPlaceName].gloss;
  const savedContext = newCorePlacenames[oldPlaceName].context;
  
  // Delete the item from core-placenames
  delete newCorePlacenames[oldPlaceName];
  
  // Find the matching mergekey entry (where lblTemplate === {oldPlaceName})
  const searchTemplate = `{${oldPlaceName}}`;
  let foundMergekeyKey = null;
  
  for (const [key, value] of Object.entries(newMergekeys)) {
    if (value.lblTemplate === searchTemplate) {
      foundMergekeyKey = key;
      break;
    }
  }
  
  if (!foundMergekeyKey) {
    warnings.push(`WARNING: No mergekey found with lblTemplate "${searchTemplate}"`);
    return;
  }
  
  // Update the mergekey entry
  newMergekeys[foundMergekeyKey].lblTemplate = newLabelTemplate;
  newMergekeys[foundMergekeyKey].gloss = savedGloss;
  
  // Update context - set English to new value, and check if it changed
  const oldEnglishContext = savedContext.en || '';
  const contextChanged = oldEnglishContext !== englishContext;
  
  if (contextChanged) {
    // Empty other language strings if English context changed
    newMergekeys[foundMergekeyKey].context = {
      en: englishContext,
      es: '',
      fr: ''
    };
  } else {
    // Keep existing context values
    newMergekeys[foundMergekeyKey].context = savedContext;
  }
  
  newMergekeys[foundMergekeyKey].altTermIds = foundMergekeyKey;
  
  processedCount++;
});

// Write the new files
console.log(`\n\nWriting output files...`);
const newCorePlacenamesPath = path.join(__dirname, '_LabelerCollections', 'core-placenames-new.json');
const newMergekeysPath = path.join(__dirname, '_LabelerCollections', 'SMR', 'mergekeys-new.json');

fs.writeFileSync(newCorePlacenamesPath, JSON.stringify(newCorePlacenames, null, 2), 'utf8');
fs.writeFileSync(newMergekeysPath, JSON.stringify(newMergekeys, null, 2), 'utf8');

console.log(`✓ Created: ${newCorePlacenamesPath}`);
console.log(`✓ Created: ${newMergekeysPath}`);

// Summary
console.log(`\n${'='.repeat(60)}`);
console.log(`SUMMARY:`);
console.log(`${'='.repeat(60)}`);
console.log(`Total changes in file: ${changes.length}`);
console.log(`Successfully processed: ${processedCount}`);
console.log(`Warnings: ${warnings.length}`);

if (warnings.length > 0) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`WARNINGS:`);
  console.log(`${'='.repeat(60)}`);
  warnings.forEach(warning => console.log(warning));
}
