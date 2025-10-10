#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Configuration
const JSON_INPUT_FILE = path.join(__dirname, 'BiblicalTermsWithSpellings.json');
const TSV_OUTPUT_FILE = path.join(__dirname, 'spellings.tsv');

// Project codes from the PROJECTS array
const PROJECT_CODES = ['N', 'n', 'E', 'G', 'R', 'T', 'K'];

function main() {
  console.log('Converting BiblicalTermsWithSpellings.json to spellings.tsv...');
  console.log(`Input: ${JSON_INPUT_FILE}`);
  console.log(`Output: ${TSV_OUTPUT_FILE}`);
  
  try {
    // Read JSON file
    const jsonContent = fs.readFileSync(JSON_INPUT_FILE, 'utf8');
    const terms = JSON.parse(jsonContent);
    
    console.log(`Found ${terms.length} terms to convert`);
    
    // Build TSV header
    const baseColumns = ['Id', 'Strong', 'Transliteration', 'Gloss', 'Definition', 'Category', 'Domain', 'References'];
    const spellColumns = PROJECT_CODES.map(code => `spell-${code}`);
    const pcColumns = PROJECT_CODES.map(code => `pc-${code}`);
    const header = [...baseColumns, ...spellColumns, ...pcColumns].join('\t');
    
    // Build TSV rows
    const rows = terms.map(term => {
      const baseValues = [
        term.Id || '',
        term.Strong || '',
        term.Transliteration || '',
        term.Gloss || '',
        term.Definition || '',
        term.Category || '',
        term.Domain || '',
        // Join all references with spaces
        (term.References || []).join(' ')
      ];
      
      // Add spell columns
      const spellValues = PROJECT_CODES.map(code => term[`spell-${code}`] || '');
      
      // Add percentage columns
      const pcValues = PROJECT_CODES.map(code => term[`pc-${code}`] || '0');
      
      const allValues = [...baseValues, ...spellValues, ...pcValues];
      
      // Escape any tabs in the data by replacing them with spaces
      return allValues.map(val => String(val).replace(/\t/g, ' ')).join('\t');
    });
    
    // Combine header and rows
    const tsvContent = [header, ...rows].join('\n');
    
    // Write TSV file
    fs.writeFileSync(TSV_OUTPUT_FILE, tsvContent, 'utf8');
    
    console.log('Conversion complete!');
    console.log(`Generated ${rows.length} rows in ${TSV_OUTPUT_FILE}`);
    
    // Show sample of first few terms
    console.log('\nSample data (first 3 terms):');
    console.log(header);
    for (let i = 0; i < Math.min(3, rows.length); i++) {
      console.log(rows[i]);
    }
    
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = { main };
