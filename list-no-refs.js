const fs = require('fs');
const path = require('path');

// Read the core-placenames.json file
const filePath = path.join(__dirname, '_LabelerCollections', 'core-placenames.json');
const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

// Process each item
const results = [];

for (const [key, item] of Object.entries(data)) {
  // Check if this item has any terms with empty refs
  const hasNoRefs = item.terms && item.terms.some(term => 
    !term.refs || term.refs.length === 0
  );
  
  if (hasNoRefs) {
    const englishGloss = item.gloss?.en || '';
    const englishContext = item.context?.en || '';
    results.push(`${key}\t${englishGloss}\t${englishContext}`);
  }
}

// Output results
console.log(`Found ${results.length} items with no refs:\n`);
results.forEach(line => console.log(line));
