const fs = require('fs');
const path = require('path');

// Read the input files
const corePlacenamesPath = path.join(__dirname, '_LabelerCollections', 'core-placenames.json');
const acaiPlacesPath = path.join(__dirname, '_LabelerCollections', 'AcaiPlaces.json');

console.log('Reading input files...');
const corePlacenames = JSON.parse(fs.readFileSync(corePlacenamesPath, 'utf8'));
const acaiPlaces = JSON.parse(fs.readFileSync(acaiPlacesPath, 'utf8'));

console.log(`Loaded ${Object.keys(corePlacenames).length} core placenames`);
console.log(`Loaded ${Object.keys(acaiPlaces).length} Acai places\n`);

// Build a lookup for faster searching
// Map of lowercase labels to array of acai keys that have that label
const labelToAcaiKeys = new Map();

for (const [acaiKey, acaiRecord] of Object.entries(acaiPlaces)) {
  if (acaiRecord.labels && Array.isArray(acaiRecord.labels)) {
    acaiRecord.labels.forEach(label => {
      const lowerLabel = label.toLowerCase();
      if (!labelToAcaiKeys.has(lowerLabel)) {
        labelToAcaiKeys.set(lowerLabel, []);
      }
      labelToAcaiKeys.get(lowerLabel).push(acaiKey);
    });
  }
}

// Process each core placename
const results = [];
results.push(['placeKey', 'placeGloss', 'placeContext', 'acaiId', 'acaiGloss', 'acaiDesc', 'notExact', 'otherOpt'].join('\t'));

for (const [placeKey, placeRecord] of Object.entries(corePlacenames)) {
  const placeGloss = placeRecord.gloss?.en || '';
  const placeContext = placeRecord.context?.en || '';
  
  let acaiId = '';
  let acaiGloss = '';
  let acaiDesc = '';
  let notExact = '';
  let otherOpt = '';
  
  // Priority 1: Try to match by key (case-insensitive)
  const lowerPlaceKey = placeKey.toLowerCase();
  let matchedByKey = false;
  
  for (const acaiKey of Object.keys(acaiPlaces)) {
    if (acaiKey.toLowerCase() === lowerPlaceKey) {
      acaiId = acaiKey;
      acaiGloss = acaiPlaces[acaiKey].labels?.[0] || '';
      acaiDesc = acaiPlaces[acaiKey].desc || '';
      notExact = (acaiKey !== placeKey) ? 'X' : '';
      matchedByKey = true;
      break;
    }
  }
  
  // Priority 2: If no key match, try to match by label
  if (!matchedByKey && placeGloss) {
    const lowerPlaceGloss = placeGloss.toLowerCase();
    const matchingKeys = labelToAcaiKeys.get(lowerPlaceGloss) || [];
    
    if (matchingKeys.length > 0) {
      // First match becomes the acaiId
      acaiId = matchingKeys[0];
      acaiGloss = acaiPlaces[acaiId].labels?.[0] || '';
      acaiDesc = acaiPlaces[acaiId].desc || '';
      notExact = (acaiId !== placeKey) ? 'X' : '';
      
      // Remaining matches go to otherOpt
      if (matchingKeys.length > 1) {
        otherOpt = matchingKeys.slice(1).join(', ');
      }
    }
  }
  
  // If we matched by key, check if there are other keys with matching labels
  if (matchedByKey && placeGloss) {
    const lowerPlaceGloss = placeGloss.toLowerCase();
    const matchingKeys = labelToAcaiKeys.get(lowerPlaceGloss) || [];
    
    // Filter out the acaiId itself and add others to otherOpt
    const otherKeys = matchingKeys.filter(key => key !== acaiId);
    if (otherKeys.length > 0) {
      otherOpt = otherKeys.join(', ');
    }
  }
  
  // Build the row
  const row = [
    placeKey,
    placeGloss,
    placeContext,
    acaiId,
    acaiGloss,
    acaiDesc,
    notExact,
    otherOpt
  ].join('\t');
  
  results.push(row);
}

// Write output
const outputPath = path.join(__dirname, 'places-comparison.tsv');
fs.writeFileSync(outputPath, results.join('\n'), 'utf8');

console.log(`✓ Created: ${outputPath}`);
console.log(`Total rows: ${results.length - 1} (plus header)`);

// Summary statistics
let exactMatches = 0;
let keyMatches = 0;
let labelMatches = 0;
let noMatches = 0;
let hasOtherOptions = 0;

results.slice(1).forEach(row => {
  const cols = row.split('\t');
  const hasAcaiId = cols[3] !== '';
  const isNotExact = cols[6] === 'X';
  const hasOther = cols[7] !== '';
  
  if (!hasAcaiId) {
    noMatches++;
  } else if (!isNotExact) {
    exactMatches++;
  } else {
    // Check if it matched by key or label
    const placeKey = cols[0];
    const acaiId = cols[3];
    if (placeKey.toLowerCase() === acaiId.toLowerCase()) {
      keyMatches++;
    } else {
      labelMatches++;
    }
  }
  
  if (hasOther) {
    hasOtherOptions++;
  }
});

console.log('\nSummary:');
console.log(`  Exact matches (key and case): ${exactMatches}`);
console.log(`  Key matches (different case): ${keyMatches}`);
console.log(`  Label matches only: ${labelMatches}`);
console.log(`  No matches: ${noMatches}`);
console.log(`  Records with other options: ${hasOtherOptions}`);
