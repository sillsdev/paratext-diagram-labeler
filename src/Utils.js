import { MATCH_PRE_B, MATCH_POST_B, MATCH_W } from './demo.js';
import { STATUS_BLANK, STATUS_MULTIPLE, STATUS_NO_RENDERINGS, STATUS_UNMATCHED, STATUS_MATCHED, STATUS_GUESSED, STATUS_RENDERING_SHORT, STATUS_BAD_EXPLICIT_FORM } from './constants.js';


export const statusValue = [
  { bkColor: "dimgray", textColor: "white", sort: 1  },  // 0  - blank
  { bkColor: "cyan",    textColor: "black", sort: 5  },  // 1 - multiple
  { bkColor: "blue",    textColor: "white", sort: 3  },  // 2 - no renderings
  { bkColor: "yellow",  textColor: "black", sort: 4  },  // 3 - unmatched
  { bkColor: "white",   textColor: "black", sort: 0  },  // 4 - matched  
  { bkColor: "#FF8000", textColor: "black", sort: 2  },  // 5 - guessed : #FF8000 : #e56300
  { bkColor: "crimson", textColor: "white", sort: 6  },  // 6 - Rendering shorter than label
  { bkColor: "#80FF00", textColor: "black", sort: 7  },  // 7 - Bad explicit form : #80FF00
];


export function inLang(prop, lang = 'en') {
  if (!prop) return '';
  if (typeof prop === 'string') return prop;
  return prop[lang] || prop['en'] || Object.values(prop)[0] || '';
}

export function getMatchTally(entry, refs, extractedVerses) {
  let anyDenials = false;
  try {
    let renderingList = [];
    if (!entry) {
      return [0, 0, false]; // No entry found, return zero tally
    }
    if (entry.renderings) {
      renderingList = entry.renderings
        .replace(/\|\|/g, '\n').split(/(\r?\n)/)
        .map(r => r.replace(/\(.*/g, '').replace(/.*\)/g, '')) // Remove content in parentheses (comments), even if only partially enclosed. (The user may be typing a comment.)
        .map(r => r.trim())
        .filter(r => r.length > 0)
        .map(r => {
          let pattern = r;
          // Insert word boundary at start if not starting with *
          if (!pattern.startsWith('*')) pattern = MATCH_PRE_B + pattern;
          // Insert word boundary at end if not ending with *
          if (!pattern.endsWith('*')) pattern = pattern + MATCH_POST_B;
          // Replace * [with [\w-]* (word chars + dash)
          pattern = pattern.replace(/\*/g, MATCH_W + '*');
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
    return [0,0, false];
  }
}

export function getStatus(termRenderings, termId, vernLabel) {

  // if (termId === "philipstravels_title") {
  //   console.warn("======================");
  // }
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
  
  const mapForm = getMapForm(termRenderings, termId);
  if (!mapForm) {
    return STATUS_NO_RENDERINGS; // { status: "No renderings", color: "indianred" };
  }
  
  if (vernLabel === mapForm ) {
    if (entry.isGuessed) return STATUS_GUESSED;  // "Guessed rendering not yet approved"
    // console.log(`Non-guessed Vernacular label matches map form: ${vernLabel}`);
    if (/\(@.+\)/.test(entry.renderings)) {   // If mapForm came from an explicit rendering (e.g., (@misradesh))
      // console.log(`Explicit map form: ${vernLabel}`);
      if (!wordMatchesRenderings(mapForm, entry.renderings, false)) {
        // console.log(`Explicit map form '${vernLabel}' does not match renderings.`);
        return STATUS_BAD_EXPLICIT_FORM; // Explicit map form does not match rendering
      }
    }
    return STATUS_MATCHED; // : "Approved"
  }
  
  // vernLabel !== mapForm
  return wordMatchesRenderings(vernLabel, entry.renderings, false) ?  STATUS_RENDERING_SHORT : STATUS_UNMATCHED; // "insufficient"
}

export function getMapForm(termRenderings, termId) {
  const entry = termRenderings[termId];
  if (!entry) {
    //console.warn(`TermId "${termId}" not found in term renderings`);
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
  const processedItems = items.map(item => {
    return item.replace(/\([^)]*\)/g, '').trim();
  }).filter(item => item.length > 0);
  
  // Join with em-dash and return
  return processedItems.join('—');
}


export function wordMatchesRenderings(word, renderings, anchored = true) {
  let renderingList = [];
  renderingList = renderings
    .replace(/\|\|/g, '\n').split(/(\r?\n)/)
    .map(r => r.replace(/\(.*/g, '').replace(/.*\)/g, '')) // Remove content in parentheses (comments), even if only partially enclosed. (The user may be typing a comment.)
    .map(r => r.trim())
    .filter(r => r.length > 0)
    .map(r => r.replace(/\*/g, MATCH_W + '*'));  // TODO: 1. implement better \w.   2. Handle isoolated * better.
      
  for (let rendering of renderingList) {
    try {
      const pattern = anchored ? "^" + rendering + "$" : rendering
      console.log(`Checking word "${word}" against rendering "${rendering}" with pattern "${pattern}"`);
      const regex = new RegExp(pattern, 'iu');
      if (regex.test(word)) {
        // console.log(`Word "${word}" matches rendering "${rendering}"`);
        return true;
      } else {
        // console.log(`Word "${word}" doesn't match rendering "${rendering}" with pattern "${pattern}"`);
      }
    } catch (e) {
      // Invalid regex, skip it
      continue;
    } 
  }
  return false;
}

