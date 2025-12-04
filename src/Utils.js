import {
  BOOK_NAMES,
  MATCH_PRE_B,
  MATCH_POST_B,
  MATCH_W,
  STATUS_BLANK,
  STATUS_MULTIPLE,
  STATUS_NO_RENDERINGS,
  STATUS_UNMATCHED,
  STATUS_GUESSED,
  STATUS_MULTIPLE_RENDERINGS,
  STATUS_INCOMPLETE,
  STATUS_OK,
} from './constants.js';

export const statusValue = [
  { bkColor: 'dimgray', textColor: 'white', sort: 0 }, // 0 - Blank
  { bkColor: 'dimgray', textColor: 'white', sort: 1 }, // 1 - Partial (same as blank)
  { bkColor: 'cyan', textColor: 'black', sort: 2 }, // 2 - Multiple Options
  { bkColor: 'blue', textColor: 'white', sort: 3 }, // 3 - No renderings
  { bkColor: 'yellow', textColor: 'black', sort: 4 }, // 4 - Unmatched label
  { bkColor: 'purple', textColor: 'white', sort: 5 }, // 5 - Multiple renderings
  { bkColor: '#FF8000', textColor: 'black', sort: 6 }, // 6 - Guessed
  { bkColor: '#80FF00', textColor: 'black', sort: 7 }, // 7 - Incomplete
  { bkColor: 'white', textColor: 'black', sort: 8 }, // 8 - Perfect (OK)
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

  if (vernLabel.includes('——')) {
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
    // Note: Explicit map form validation removed in new architecture
    const matchedTally = getMatchTally(entry, refs, extractedVerses);
    if (matchedTally[0] === matchedTally[1]) {
      return STATUS_OK; // : "Approved"
    } else {
      return STATUS_INCOMPLETE; // "Incomplete" - some refs matched, but not all
    }
  }

  // vernLabel !== mapForm
  return wordMatchesRenderings(vernLabel, entry.renderings, false)
    ? STATUS_MULTIPLE_RENDERINGS  // Multiple patterns detected
    : STATUS_UNMATCHED;
}

/**
 * Calculate status for a placeName by considering all its terms together.
 * This handles multi-term placeNames (e.g., NT + OT) where terms may have
 * different renderings or one term may have no rendering (auto-join case).
 */
export function getPlaceNameStatus(termRenderings, terms, vernLabel, extractedVerses, placeNameId = null, labelDictionaryService = null) {
  // Ensure vernLabel is a string
  vernLabel = (vernLabel && typeof vernLabel === 'string') ? vernLabel.trim() : '';
  console.log(`[getPlaceNameStatus] placeNameId="${placeNameId}", vernLabel: "${vernLabel}"`, Array.from(vernLabel).map(c => c.charCodeAt(0).toString(16)));
  
  // If the vernacular Label is empty, return STATUS_BLANK
  if (!vernLabel) {
    console.log(`[getPlaceNameStatus] Returning STATUS_BLANK (empty vernLabel)`);
    return STATUS_BLANK;
  }

  // If the vernacular label contains double em-dash, return STATUS_MULTIPLE
  if (vernLabel.includes('——')) {
    console.log(`[getPlaceNameStatus] Returning STATUS_MULTIPLE (contains ——)`);
    return STATUS_MULTIPLE;
  }

  // If the PlaceName has no terms with refs, return STATUS_OK
  if (!terms || terms.length === 0 || !terms.some(t => t.refs && t.refs.length > 0)) {
    return STATUS_OK;
  }

  // Build an array allPatterns[], a list of all unique (case-insensitively) rendering patterns
  const allPatternsSet = new Map(); // Use Map to track case-insensitive uniqueness
  const termIsGuessed = [];
  const termsWithRefs = [];

  for (const term of terms) {
    const entry = termRenderings[term.termId];
    if (!entry || !entry.renderings) continue;
    
    // Extract patterns (with wildcards, without comments)
    const patterns = extractRenderingPatterns(entry.renderings);
    for (const pattern of patterns) {
      const lowerPattern = pattern.toLowerCase();
      if (!allPatternsSet.has(lowerPattern)) {
        allPatternsSet.set(lowerPattern, pattern); // Store original case
      }
    }
    
    termIsGuessed.push(entry.isGuessed || false);
    if (term.refs && term.refs.length > 0) {
      termsWithRefs.push({ entry, refs: term.refs });
    }
  }

  const allPatterns = Array.from(allPatternsSet.values());

  // If allPatterns is empty, return STATUS_NO_RENDERINGS
  if (allPatterns.length === 0) {
    return STATUS_NO_RENDERINGS;
  }

  // Make two arrays: matchesLabel[] and doesntMatchLabel[]
  const matchesLabel = [];
  const doesntMatchLabel = [];

  for (const pattern of allPatterns) {
    // Check if label matches this pattern using wildcard matching
    const matches = patternMatchesLabel(vernLabel, pattern);
    if (matches) {
      matchesLabel.push(pattern);
    } else {
      doesntMatchLabel.push(pattern);
    }
  }

  // If matchesLabel is empty, return STATUS_UNMATCHED
  if (matchesLabel.length === 0) {
    console.log(`[getPlaceNameStatus] STATUS_UNMATCHED for "${placeNameId}": vernLabel="${vernLabel}", allPatterns=${JSON.stringify(allPatterns)}`);
    return STATUS_UNMATCHED;
  }

  // If doesntMatchLabel is not empty, check against AltApproved list
  if (doesntMatchLabel.length > 0) {
    const needsChecked = [];
    const altApproved = labelDictionaryService ? labelDictionaryService.getAltRenderings(placeNameId) : [];
    
    for (const pattern of doesntMatchLabel) {
      // Case-insensitive comparison
      const isApproved = altApproved.some(approved => approved.toLowerCase() === pattern.toLowerCase());
      if (!isApproved) {
        needsChecked.push(pattern);
      }
    }
    
    // If the needsChecked list is not empty, return STATUS_MULTIPLE_RENDERINGS
    if (needsChecked.length > 0) {
      return STATUS_MULTIPLE_RENDERINGS;
    }
  }

  // If any of the PlaceName's terms is a guessed rendering, return STATUS_GUESSED
  const anyGuessed = termIsGuessed.some(g => g);
  if (anyGuessed) {
    return STATUS_GUESSED;
  }

  // Get the tally of found references. If any are missing and not denied, return STATUS_INCOMPLETE
  if (termsWithRefs.length > 0) {
    let totalMatched = 0;
    let totalRefs = 0;
    let anyDenials = false;
    
    for (const { entry, refs } of termsWithRefs) {
      const [matched, total, denials] = getMatchTally(entry, refs, extractedVerses);
      totalMatched += matched;
      totalRefs += total;
      anyDenials = anyDenials || denials;
    }
    
    if (totalMatched < totalRefs) {
      return STATUS_INCOMPLETE;
    }
  }

  // Return STATUS_OK
  return STATUS_OK;
}

/**
 * Check if a label matches a pattern (with wildcards).
 * @param {string} label - The vernacular label
 * @param {string} pattern - The rendering pattern (may contain * wildcards)
 * @returns {boolean} True if the label matches the pattern
 */
function patternMatchesLabel(label, pattern) {
  try {
    const regexPattern = convertParatextWildcardsToRegex(pattern);
    // Use word boundaries instead of anchors to match pattern anywhere in label
    const regex = new RegExp(MATCH_PRE_B + regexPattern + MATCH_POST_B, 'iu');
    return regex.test(label);
  } catch (e) {
    // Invalid regex, treat as non-match
    return false;
  }
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

  // Join with double em-dash and return
  return processedItems.join('——');
}

// Check if a word matches any of the renderings, returning a 1-based index of the match.
/**
 * Extract rendering patterns from a renderings string, stripping comments but keeping wildcards.
 * Comments are defined as text within parentheses.
 * @param {string} renderings - The renderings string (may contain || separators)
 * @returns {string[]} Array of patterns with comments removed but wildcards intact
 */
export function extractRenderingPatterns(renderings) {
  if (!renderings) return [];
  return renderings
    .replace(/\|\|/g, '\n')
    .split(/(\r?\n)/)
    .map(r => r.replace(/\s*\([^)]*\)?\s*/g, '')) // Remove comments in parentheses
    .map(r => r.trim())
    .filter(r => r.length > 0);
}

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
      // console.log(
      //   `Checking word "${word}" against rendering "${rendering}" with pattern "${pattern}"`
      // );
      const regex = new RegExp(pattern, 'iu');
      if (regex.test(word)) {
        // console.log(`Word "${word}" matches rendering "${rendering}"`);
        return i + 1; // Return 1-based index
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

// Utility function to determine if a label is visible based on selected variant
export function isLabelVisible(label, selectedVariant) {
  // If no variants defined (selectedVariant = 0), or label variant is 0, always visible
  if (selectedVariant === 0 || !label.variant || label.variant === 0) {
    return true;
  }
  // Bitwise AND check
  return (selectedVariant & label.variant) !== 0;
}
