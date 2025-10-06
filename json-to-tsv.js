#!/usr/bin/env node

const fs = require('fs');

// Usage: node json-to-tsv.js [input.json] [output.tsv]
const inputFile = process.argv[2] || 'src/data/ui-strings.json';
const outputFile = process.argv[3] || 'ui-strings.tsv';

function jsonToTsv(jsonData) {
  const rows = [];
  const header = ['key', 'en', 'es', 'fr', 'ne'];
  rows.push(header.join('\t'));

  // Helper function to escape TSV values
  function escapeTsvValue(value) {
    if (!value) return '';
    // Replace tabs with spaces and newlines with literal \n
    return value.replace(/\t/g, ' ').replace(/\n/g, '\\n').replace(/\r/g, '');
  }

  // Process statusValue array
  if (jsonData.statusValue && Array.isArray(jsonData.statusValue)) {
    jsonData.statusValue.forEach((item, index) => {
      // Process text property
      if (item.text) {
        const textKey = `statusValue_${index}_text`;
        const textRow = [
          textKey,
          escapeTsvValue(item.text.en),
          escapeTsvValue(item.text.es),
          escapeTsvValue(item.text.fr),
          escapeTsvValue(item.text.ne)
        ];
        rows.push(textRow.join('\t'));
      }

      // Process help property
      if (item.help) {
        const helpKey = `statusValue_${index}_help`;
        const helpRow = [
          helpKey,
          escapeTsvValue(item.help.en),
          escapeTsvValue(item.help.es),
          escapeTsvValue(item.help.fr),
          escapeTsvValue(item.help.ne)
        ];
        rows.push(helpRow.join('\t'));
      }
    });
  }

  // Process all other properties (from addMapForm onwards)
  Object.keys(jsonData).forEach(key => {
    if (key !== 'statusValue') {
      const value = jsonData[key];
      if (typeof value === 'object' && value !== null) {
        const row = [
          key,
          escapeTsvValue(value.en),
          escapeTsvValue(value.es),
          escapeTsvValue(value.fr),
          escapeTsvValue(value.ne)
        ];
        rows.push(row.join('\t'));
      }
    }
  });

  return rows.join('\n');
}

try {
  console.log(`Converting ${inputFile} to ${outputFile}...`);
  
  // Read and parse JSON file
  const jsonContent = fs.readFileSync(inputFile, 'utf8');
  const jsonData = JSON.parse(jsonContent);
  
  // Convert to TSV
  const tsvContent = jsonToTsv(jsonData);
  
  // Write TSV file
  fs.writeFileSync(outputFile, tsvContent, 'utf8');
  
  console.log(`Successfully converted to ${outputFile}`);
  console.log(`Total rows: ${tsvContent.split('\n').length - 1} (excluding header)`);
  
} catch (error) {
  console.error('Error:', error.message);
  process.exit(1);
}
