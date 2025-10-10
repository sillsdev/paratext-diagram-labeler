#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Configuration
const JSON_INPUT_FILE = path.join(__dirname, 'BiblicalTermsWithSpellings.json');
const TSV_OUTPUT_FILE = path.join(__dirname, 'LookupTable.TSV');

// Project codes from the PROJECTS array
const PROJECT_CODES = ['N', 'n', 'E', 'G', 'R', 'T', 'K'];

// Normalize spelling to create lookup key
function normalizeSpelling(spelling) {
  if (!spelling) return '';
  return spelling.toLowerCase().replace(/[^a-z]/g, '');
}

// Calculate priority based on Category and Domain
function calculatePriority(category, domain) {
  let priority = 0;
  
  // Add 10 if Category is not "PN"
  if (category !== 'PN') {
    priority += 10;
  }
  
  // Add 5 if Domain is exactly "person"
  if (domain === 'person') {
    priority += 5;
  }
  // Add 1 if Domain contains "person" and something more
  else if (domain && domain.includes('person')) {
    priority += 1;
  }
  
  return priority;
}

// Check if a character is a Hebrew letter
function isHebrewLetter(char) {
  if (!char) return false;
  const codePoint = char.codePointAt(0);
  // Hebrew block: U+0590-U+05FF
  // Hebrew Presentation Forms-A: U+FB1D-U+FB4F
  return (codePoint >= 0x0590 && codePoint <= 0x05FF) ||
         (codePoint >= 0xFB1D && codePoint <= 0xFB4F);
}

function main() {
  console.log('Building lookup table from BiblicalTermsWithSpellings.json...');
  console.log(`Input: ${JSON_INPUT_FILE}`);
  console.log(`Output: ${TSV_OUTPUT_FILE}`);
  
  try {
    // Read JSON file
    const jsonContent = fs.readFileSync(JSON_INPUT_FILE, 'utf8');
    const terms = JSON.parse(jsonContent);
    
    console.log(`Found ${terms.length} terms to process`);
    
    // Build lookup table rows
    const lookupRows = [];
    let processedTerms = 0;
    let termsWithSpellings = 0;
    
    for (const term of terms) {
      processedTerms++;
      
      // Collect all found spellings for this term
      const foundSpellings = new Set();
      
      for (const code of PROJECT_CODES) {
        const spelling = term[`spell-${code}`];
        if (spelling && spelling.trim()) {
          foundSpellings.add(spelling.trim());
        }
      }
      
      // Skip terms with no found spellings
      if (foundSpellings.size === 0) {
        continue;
      }
      
      termsWithSpellings++;
      
      // Calculate priority once for this term
      const priority = calculatePriority(term.Category, term.Domain);
      
      // Add Hebrew letter bonus
      let hebrewBonus = 0;
      if (term.Id && isHebrewLetter(term.Id.charAt(0))) {
        hebrewBonus = 1;
      }
      
      // Create normalized lookup keys for this term and track which translations contribute
      const normalizedKeysData = new Map(); // key -> Set of project codes that contributed
      
      for (const code of PROJECT_CODES) {
        const spelling = term[`spell-${code}`];
        if (spelling && spelling.trim()) {
          const normalizedKey = normalizeSpelling(spelling.trim());
          if (normalizedKey) {
            if (!normalizedKeysData.has(normalizedKey)) {
              normalizedKeysData.set(normalizedKey, new Set());
            }
            normalizedKeysData.get(normalizedKey).add(code);
          }
        }
      }
      
      // Add rows for each unique normalized key
      for (const [lookupKey, contributingCodes] of normalizedKeysData) {
        // Calculate priority including translation count factor and Hebrew bonus
        let finalPriority = priority + hebrewBonus;
        
        // Add 4 if only one or two translations contribute to this lookup key
        if (contributingCodes.size <= 2) {
          finalPriority += 4;
        }
        
        lookupRows.push({
          lookupKey: lookupKey,
          id: term.Id || '',
          gloss: term.Gloss || '',
          definition: term.Definition || '',
          spellN: term['spell-N'] || '',
          category: term.Category || '',
          domain: term.Domain || '',
          priority: finalPriority,
          translationCount: contributingCodes.size
        });
      }
    }
    
    console.log(`Terms with spellings: ${termsWithSpellings}/${processedTerms}`);
    console.log(`Generated ${lookupRows.length} lookup table entries`);
    
    // Sort by lookup key first, then by priority value ascending (lower priority number = higher priority)
    lookupRows.sort((a, b) => {
      const keyCompare = a.lookupKey.localeCompare(b.lookupKey);
      if (keyCompare !== 0) return keyCompare;
      return a.priority - b.priority; // Ascending priority (lower numbers first)
    });
    
    // Build TSV content
    const header = ['LookupKey', 'Id', 'Gloss', 'Definition', 'spell-N', 'Category', 'Domain', 'Priority'].join('\t');
    const rows = lookupRows.map(row => [
      row.lookupKey,
      row.id,
      row.gloss,
      row.definition,
      row.spellN,
      row.category,
      row.domain,
      row.priority
    ].map(val => String(val).replace(/\t/g, ' ')).join('\t'));
    
    const tsvContent = [header, ...rows].join('\n');
    
    // Write TSV file
    fs.writeFileSync(TSV_OUTPUT_FILE, tsvContent, 'utf8');
    
    console.log('Lookup table generation complete!');
    console.log(`Generated ${rows.length} rows in ${TSV_OUTPUT_FILE}`);
    
    // Show statistics
    const uniqueKeys = new Set(lookupRows.map(row => row.lookupKey));
    console.log(`Unique lookup keys: ${uniqueKeys.size}`);
    
    // Show priority distribution
    const priorityCounts = {};
    for (const row of lookupRows) {
      priorityCounts[row.priority] = (priorityCounts[row.priority] || 0) + 1;
    }
    console.log('Priority distribution:', priorityCounts);
    
    // Show translation count distribution
    const translationCounts = {};
    for (const row of lookupRows) {
      translationCounts[row.translationCount] = (translationCounts[row.translationCount] || 0) + 1;
    }
    console.log('Translation count distribution:', translationCounts);
    
    // Show low-coverage entries (1-2 translations)
    const lowCoverage = lookupRows.filter(row => row.translationCount <= 2);
    console.log(`Low coverage entries (≤2 translations): ${lowCoverage.length}/${lookupRows.length} (${Math.round(lowCoverage.length/lookupRows.length*100)}%)`);
    
    // Show sample of first few entries
    console.log('\nSample data (first 5 entries):');
    console.log(header);
    for (let i = 0; i < Math.min(5, rows.length); i++) {
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

module.exports = { 
  main, 
  normalizeSpelling, 
  calculatePriority 
};