import {
  BOOK_NAMES,
  MATCH_PRE_B,
  MATCH_POST_B,
  MATCH_W,
  STATUS_BLANK,
  STATUS_MULTIPLE,
  STATUS_NO_RENDERINGS,
  STATUS_UNMATCHED,
  STATUS_MATCHED,
  STATUS_GUESSED,
  STATUS_RENDERING_SHORT,
  STATUS_BAD_EXPLICIT_FORM,
  STATUS_INCOMPLETE,
  STATUS_MULTIPLE_RENDERINGS
} from './constants.js';

export const statusValue = [
  { bkColor: 'dimgray', textColor: 'white', sort: 1 }, // 0  - blank
  { bkColor: 'cyan', textColor: 'black', sort: 5 }, // 1 - multiple
  { bkColor: 'blue', textColor: 'white', sort: 3 }, // 2 - no renderings
  { bkColor: 'yellow', textColor: 'black', sort: 4 }, // 3 - unmatched
  { bkColor: 'white', textColor: 'black', sort: 0 }, // 4 - matched
  { bkColor: '#FF8000', textColor: 'black', sort: 2 }, // 5 - guessed : #FF8000 : #e56300
  { bkColor: 'crimson', textColor: 'white', sort: 6 }, // 6 - Rendering shorter than label
  { bkColor: 'magenta', textColor: 'black', sort: 7 }, // 7 - Bad explicit form
  { bkColor: '#80FF00', textColor: 'black', sort: 8 }, // 8 - Incomplete : #80FF00
  { bkColor: 'purple', textColor: 'white', sort: 9 }, // 9 - Multiple renderings
];

export function prettyRef(ref) {
  // ref is a 9 digit string. First 3 digits are the book code, next 3 are chapter, last 3 are verse.
  const bookCode = parseInt(ref.slice(0, 3), 10) - 1;
  const chapter = parseInt(ref.slice(3, 6), 10);
  const verse = parseInt(ref.slice(6, 9), 10);
  const bookName = BOOK_NAMES.slice(bookCode * 4, bookCode * 4 + 3); // Use the top-level bookNames constant, 4 chars per code.
  return `${bookName} ${chapter}:${verse}`;
}

export function inLang(prop, lang = 'en') {
  if (!prop) return '';
  if (typeof prop === 'string') return prop;
  return prop[lang] || prop['en'] || Object.values(prop)[0] || '';
}

// @entry is a term rendering entry
// @refs is an array of reference IDs (9-digit strings) from collectionManager.getRefs()
// @extractedVerses is an object mapping reference IDs to verse text from
export function getMatchTally(entry, refs, extractedVerses) {
  let anyDenials = false;
  try {
    let renderingList = [];
    if (!entry) {
      return [0, 0, false]; // No entry found, return zero tally
    }
    if (entry.renderings) {
      renderingList = entry.renderings
        .replace(/\|\|/g, '\n')
        .split(/(\r?\n)/)
        .map(r => r.replace(/\(.*/g, '').replace(/.*\)/g, '')) // Remove content in parentheses (comments), even if only partially enclosed. (The user may be typing a comment.)
        .map(r => r.trim())
        .filter(r => r.length > 0)
        .map(r => {
          let pattern = convertParatextWildcardsToRegex(r);
          // Insert word boundary at start if not starting with word character pattern
          if (!pattern.startsWith('(?:' + MATCH_W) && !pattern.startsWith(MATCH_W)) {
            pattern = MATCH_PRE_B + pattern;
          }
          // Insert word boundary at end if not ending with word character pattern
          if (!pattern.endsWith('*)') && !pattern.endsWith('*')) {
            pattern = pattern + MATCH_POST_B;
          }
          // console.log(`Creating regex for rendering "${r}" with pattern "${pattern}"`);
          try {
            return new RegExp(pattern, 'iu');
          } catch (e) {
            // Invalid regex, skip it
            return null;
          }
        })
        .filter(Boolean); // Remove nulls (invalid regexes)
    }
    // console.log(`getMatchTally("${termId}")`, entry.renderings);
    // console.log(`num refs: ${refs.length}`, renderingList);
    // Compute match tally
    let matchCount = 0;
    let deniedRefs = entry?.denials || [];
    let nonEmptyRefCt = 0;

    refs.map(refId => {
      const verse = extractedVerses[refId] || '';
      if (!verse) {
        return false; // Skip empty verses
      }
      nonEmptyRefCt++;
      const hasMatch = renderingList.some(r => r.test(verse));
      if (hasMatch) {
        matchCount++;
      } else {
        if (deniedRefs.includes(refId)) {
          anyDenials = true;
          matchCount++;
        }
      }
      return hasMatch;
    });
    return [matchCount, nonEmptyRefCt, anyDenials];
  } catch (error) {
    console.error(`Error in getMatchTally":`, error);
    return [0, 0, false];
  }
}

export function getStatus(termRenderings, termId, vernLabel, refs, extractedVerses) {
  //console.log(`Checking status for termId: ${termId}, vernLabel: ${vernLabel}`);
  vernLabel = vernLabel ? vernLabel.trim() : '';
  if (!vernLabel) {
    return STATUS_BLANK; //{ status: "Blank", color: "crimson" };
  }

  if (vernLabel.includes('—')) {
    return STATUS_MULTIPLE; //{ status: "Must select one", color: "darkorange" };
  }

  const entry = termRenderings[termId];
  if (!entry) {
    //console.warn(`TermId "${termId}" not found in term renderings`);
    return STATUS_NO_RENDERINGS; // { status: "No renderings", color: "indianred" };
  }

  const mapForm = getMapFormStrict(termRenderings, termId);
  if (!mapForm) {
    return STATUS_NO_RENDERINGS; // { status: "No renderings", color: "indianred" };
  }

  if (vernLabel === mapForm) {
    if (entry.isGuessed) return STATUS_GUESSED; // "Guessed rendering not yet approved"
    // console.log(`Non-guessed Vernacular label matches map form: ${vernLabel}`);
    if (/\(@.+\)/.test(entry.renderings)) {
      // If mapForm came from an explicit rendering (e.g., (@misradesh))
      // console.log(`Explicit map form: ${vernLabel}`);
      if (!wordMatchesRenderings(mapForm, entry.renderings, false)) {
        // console.log(`Explicit map form '${vernLabel}' does not match renderings.`);
        return STATUS_BAD_EXPLICIT_FORM; // Explicit map form does not match rendering
      }
    }
    const matchedTally = getMatchTally(entry, refs, extractedVerses);
    if (matchedTally[0] === matchedTally[1]) {
      return STATUS_MATCHED; // : "Approved"
    } else {
      return STATUS_INCOMPLETE; // "Incomplete" - some refs matched, but not all
    }
  }

  // vernLabel !== mapForm
  return wordMatchesRenderings(vernLabel, entry.renderings, false)
    ? (/\S\s*\n\s*\S/.test(entry.renderings) ? STATUS_MULTIPLE_RENDERINGS : STATUS_RENDERING_SHORT)
    : STATUS_UNMATCHED; 
}

export function getMapForm(termRenderings, termId, altTermIds) {
  const strictForm = getMapFormStrict(termRenderings, termId);
  if (strictForm) {
    return strictForm;
  }
  if (!altTermIds) {
    return '';
  }
  const altTermIdList = altTermIds.split(/\s*,\s*/);
  for (const altTermId of altTermIdList) {
    const altForm = getMapFormStrict(termRenderings, altTermId);
    if (altForm) {
      return altForm;
    }
  }
  return '';
}

function getMapFormStrict(termRenderings, termId) {
  const entry = termRenderings[termId];
  if (!entry) {
    return '';
  }
  let renderingsStr = entry.renderings || '';
  // Eliminate all asterisks
  renderingsStr = renderingsStr.replace(/\*/g, '');

  // Check for explicit map form (e.g., (@misradesh) or (map: misradesh))
  const match = renderingsStr.match(/\((?:@|map:\s*)([^)]+)\)/);
  if (match) {
    return match[1];
  }

  // Split into separate rendering items
  const items = renderingsStr.replace(/\|\|/g, '\n').split(/(\r?\n)/);
  // console.log(`Split renderings for termId "${termId}":`, items);
  // Process each item: remove parentheses and their contents, trim space
  const processedItems = items
    .map(item => {
      return item.replace(/\([^)]*\)/g, '').trim();
    })
    .filter(item => item.length > 0);

  // Join with em-dash and return
  return processedItems.join('—');
}

// Check if a word matches any of the renderings, returning a 1-based index of the match.
export function wordMatchesRenderings(word, renderings, anchored = true) {
  let renderingList = [];
  renderingList = renderings
    .replace(/\|\|/g, '\n')
    .split(/(\r?\n)/)
    .map(r => r.replace(/\(.*/g, '').replace(/.*\)/g, '')) // Remove content in parentheses (comments), even if only partially enclosed. (The user may be typing a comment.)
    .map(r => r.trim())
    .filter(r => r.length > 0)
    .map(r => convertParatextWildcardsToRegex(r));

  for (let i = 0; i < renderingList.length; i++) {
    const rendering = renderingList[i];
    try {
      const pattern = anchored ? '^' + rendering + '$' : rendering;
      console.log(
        `Checking word "${word}" against rendering "${rendering}" with pattern "${pattern}"`
      );
      const regex = new RegExp(pattern, 'iu');
      if (regex.test(word)) {
        // console.log(`Word "${word}" matches rendering "${rendering}"`);
        return i+1; // Return 1-based index
      } else {
        // console.log(`Word "${word}" doesn't match rendering "${rendering}" with pattern "${pattern}"`);
      }
    } catch (e) {
      // Invalid regex, skip it
      continue;
    }
  }
  return 0; // No match found
}

// Convert Paratext wildcard patterns to regex patterns
function convertParatextWildcardsToRegex(rendering) {
  // Split the rendering into tokens (words and asterisks)
  const tokens = rendering.split(/(\s+|\*+)/);
  let regexParts = [];
  
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    
    if (token.match(/^\s+$/)) {
      // Whitespace - preserve as is
      regexParts.push(token.replace(/\s/g, '\\s'));
    } else if (token === '**') {
      // Two consecutive asterisks - matches any number of optional words
      regexParts.push('(?:' + MATCH_W + '+(?:\\s+' + MATCH_W + '+)*)?');
    } else if (token === '*') {
      // Single isolated asterisk - matches up to one optional word
      regexParts.push('(?:' + MATCH_W + '+)?');
    } else if (token.includes('*')) {
      // Word containing asterisks (prefix, suffix, infix patterns)
      let wordPattern = token.replace(/[.+?^${}()|[\]\\]/g, '\\$&'); // Escape regex metacharacters
      wordPattern = wordPattern.replace(/\*/g, MATCH_W + '*'); // Replace * with word character pattern
      regexParts.push(wordPattern);
    } else if (token.length > 0) {
      // Regular word - escape regex metacharacters
      regexParts.push(token.replace(/[.+?^${}()|[\]\\]/g, '\\$&'));
    }
  }
  
  return regexParts.join('');
}

// Utility function to determine if a location is visible based on selected variant
export function isLocationVisible(location, selectedVariant) {
  // If no variants defined (selectedVariant = 0), or location variant is 0, always visible
  if (selectedVariant === 0 || !location.variant || location.variant === 0) {
    return true;
  }
  // Bitwise AND check
  return (selectedVariant & location.variant) !== 0;
}
