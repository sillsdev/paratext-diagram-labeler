const fs = require('fs');
const path = require('path');

/**
 * Sort refs within a term and sort terms by their lowest ref
 */
function sortPlacenameRefs(placenameData) {
  if (!placenameData.terms || !Array.isArray(placenameData.terms)) {
    return placenameData;
  }

  // First, sort refs within each term
  for (const term of placenameData.terms) {
    if (term.refs && Array.isArray(term.refs)) {
      term.refs.sort();
    }
  }

  // Then, sort terms by their lowest ref
  placenameData.terms.sort((a, b) => {
    const aRefs = a.refs || [];
    const bRefs = b.refs || [];

    // Terms with no refs go to the end
    if (aRefs.length === 0 && bRefs.length === 0) return 0;
    if (aRefs.length === 0) return 1;
    if (bRefs.length === 0) return -1;

    // Compare lowest refs
    const aLowest = aRefs[0];
    const bLowest = bRefs[0];

    return aLowest.localeCompare(bLowest);
  });

  return placenameData;
}

/**
 * Process core-placenames.json
 */
function processCorePlacenames(inputPath, outputPath) {
  console.log(`Reading ${inputPath}...`);
  
  let data;
  try {
    const content = fs.readFileSync(inputPath, 'utf8');
    data = JSON.parse(content);
  } catch (error) {
    console.error(`Error reading file: ${error.message}`);
    process.exit(1);
  }

  console.log(`Processing ${Object.keys(data).length} placenames...`);

  let changedCount = 0;
  const changedPlacenames = [];

  // Process each placename
  for (const [placeName, placeData] of Object.entries(data)) {
    const originalJson = JSON.stringify(placeData.terms);
    sortPlacenameRefs(placeData);
    const newJson = JSON.stringify(placeData.terms);

    if (originalJson !== newJson) {
      changedCount++;
      changedPlacenames.push(placeName);
    }
  }

  console.log(`Writing ${outputPath}...`);
  try {
    fs.writeFileSync(outputPath, JSON.stringify(data, null, 2), 'utf8');
  } catch (error) {
    console.error(`Error writing file: ${error.message}`);
    process.exit(1);
  }

  console.log(`\n✅ Done!`);
  console.log(`   ${changedCount} placenames had their terms reordered.`);
  
  if (changedCount > 0 && changedCount <= 20) {
    console.log(`\n   Changed placenames:`);
    for (const name of changedPlacenames) {
      console.log(`   - ${name}`);
    }
  } else if (changedCount > 20) {
    console.log(`\n   First 20 changed placenames:`);
    for (let i = 0; i < 20; i++) {
      console.log(`   - ${changedPlacenames[i]}`);
    }
    console.log(`   ... and ${changedCount - 20} more`);
  }
}

// Main execution
const inputPath = path.join(__dirname, '_LabelerCollections', 'core-placenames.json');
const outputPath = path.join(__dirname, '_LabelerCollections', 'core-placenames-new.json');

processCorePlacenames(inputPath, outputPath);
