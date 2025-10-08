#!/usr/bin/env node

const fs = require('fs');

// Usage: node tsv-to-json.js [input.tsv] [output.json]
const inputFile = process.argv[2] || 'ui-strings.tsv';
const outputFile = process.argv[3] || 'src/data/ui-strings.json';

function tsvToJson(tsvContent) {
  const lines = tsvContent.trim().split('\n');
  const header = lines[0].split('\t');
  
  // Validate header
  const expectedHeader = ['key', 'en', 'es', 'fr', 'ne'];
  if (JSON.stringify(header) !== JSON.stringify(expectedHeader)) {
    throw new Error(`Invalid header. Expected: ${expectedHeader.join(', ')}, Got: ${header.join(', ')}`);
  }
  
  const result = {};
  const statusValueItems = {};
  
  // Helper function to unescape TSV values
  function unescapeTsvValue(value) {
    if (!value) return '';
    // Convert literal \n back to newlines
    return value.replace(/\\n/g, '\n');
  }
  
  // Process each data row
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue; // Skip empty lines
    
    // Split on tabs, but only split into exactly 5 parts to handle embedded tabs
    const columns = line.split('\t');
    if (columns.length < 5) {
      console.warn(`Skipping invalid row ${i + 1}: not enough columns (${columns.length})`);
      continue;
    } else if (columns.length > 5) {
      // If there are more than 5 columns, merge the extra columns back into the last column
      const extraColumns = columns.slice(4);
      columns[4] = extraColumns.join('\t');
      columns.splice(5);
    }
    
    const [key, en, es, fr, ne] = columns.map(unescapeTsvValue);
    
    // Check if this is a statusValue item
    const statusValueMatch = key.match(/^statusValue_(\d+)_(text|help)$/);
    if (statusValueMatch) {
      const index = parseInt(statusValueMatch[1]);
      const property = statusValueMatch[2]; // 'text' or 'help'
      
      // Initialize the statusValue item if it doesn't exist
      if (!statusValueItems[index]) {
        statusValueItems[index] = {};
      }
      
      // Add the property to the statusValue item
      statusValueItems[index][property] = {
        en: en || undefined,
        es: es || undefined,
        fr: fr || undefined,
        ne: ne || undefined
      };
      
      // Remove undefined/empty values
      Object.keys(statusValueItems[index][property]).forEach(lang => {
        if (!statusValueItems[index][property][lang]) {
          delete statusValueItems[index][property][lang];
        }
      });
      
    } else {
      // Regular property
      const langObject = {
        en: en || undefined,
        es: es || undefined,
        fr: fr || undefined,
        ne: ne || undefined
      };
      
      // Remove undefined/empty values
      Object.keys(langObject).forEach(lang => {
        if (!langObject[lang]) {
          delete langObject[lang];
        }
      });
      
      result[key] = langObject;
    }
  }
  
  // Convert statusValueItems object to array and add to result
  if (Object.keys(statusValueItems).length > 0) {
    const statusValueArray = [];
    const maxIndex = Math.max(...Object.keys(statusValueItems).map(Number));
    
    for (let i = 0; i <= maxIndex; i++) {
      if (statusValueItems[i]) {
        statusValueArray[i] = statusValueItems[i];
      } else {
        // Fill missing indices with empty objects
        statusValueArray[i] = {};
      }
    }
    
    result.statusValue = statusValueArray;
  }
  
  return result;
}

try {
  console.log(`Converting ${inputFile} to ${outputFile}...`);
  
  // Read TSV file
  const tsvContent = fs.readFileSync(inputFile, 'utf8');
  
  // Convert to JSON
  const jsonData = tsvToJson(tsvContent);
  
  // Write JSON file with proper formatting
  const jsonContent = JSON.stringify(jsonData, null, 2);
  fs.writeFileSync(outputFile, jsonContent, 'utf8');
  
  console.log(`Successfully converted to ${outputFile}`);
  console.log(`Total keys: ${Object.keys(jsonData).length}`);
  if (jsonData.statusValue) {
    console.log(`StatusValue items: ${jsonData.statusValue.length}`);
  }
  
} catch (error) {
  console.error('Error:', error.message);
  process.exit(1);
}
