import extractedVerses from './data/extracted_verses.json';

function wordMatchesRenderings(word, renderings, anchored = true) {
  let renderingList = [];
  renderingList = renderings
    .split(/\r?\n/)
    .map(r => r.replace(/\(.*/g, '').replace(/.*\)/g, '')) // Remove content in parentheses (comments), even if only partially enclosed. (The user may be typing a comment.)
    .map(r => r.trim())
    .filter(r => r.length > 0)
    .map(r => r.replace(/\*/g, '[\\w-]*'));  // TODO: 1. implement better \w.   2. Handle isoolated * better.
      
  for (let rendering of renderingList) {
    try {
      const pattern = anchored ? "^" + rendering + "$" : rendering
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

class TermRenderings {
  constructor() {
    this.data = {};
  }

  setData(data) {
    this.data = data;
  }

  getMapForm(termId) {
    const entry = this.data[termId];
    if (!entry) {
      //console.warn(`TermId "${termId}" not found in term renderings`);
      return '';
    }
    let renderingsStr = entry.renderings;
    // Eliminate all asterisks
    renderingsStr = renderingsStr.replace(/\*/g, '');
    
    // Check for explicit map form (e.g., (@misradesh) or (map: misradesh))
    const match = renderingsStr.match(/\((?:@|map:\s*)([^)]+)\)/);
    if (match) {
      return match[1];
    }
    
    // Split into separate rendering items
    const items = renderingsStr.split('\n');
    
    // Process each item: remove parentheses and their contents, trim space
    const processedItems = items.map(item => {
      return item.replace(/\([^)]*\)/g, '').trim();
    }).filter(item => item.length > 0);
    
    // Join with em-dash and return
    return processedItems.join('—');
  }

  getStatus(termId, vernLabel) {

    // if (termId === "philipstravels_title") {
    //   console.warn("======================");
    // }
    //console.log(`Checking status for termId: ${termId}, vernLabel: ${vernLabel}`);
    vernLabel = vernLabel ? vernLabel.trim() : '';
    if (!vernLabel) {
      return 0; //{ status: "Blank", color: "crimson" };
    }
    
    if (vernLabel.includes('—')) {
      return 1; //{ status: "Must select one", color: "darkorange" };
    }
    
    const entry = this.data[termId];
    if (!entry) {
      //console.warn(`TermId "${termId}" not found in term renderings`);
      return 2; // { status: "No renderings", color: "indianred" };
    }
    
    const mapForm = this.getMapForm(termId);
    if (!mapForm) {
      return 2; // { status: "No renderings", color: "indianred" };
    }
    
    if (vernLabel === mapForm ) {
      if (entry.isGuessed) return 5;  // "Guessed rendering not yet approved"
      console.log(`Non-guessed Vernacular label matches map form: ${vernLabel}`);
      if (/\(@.+\)/.test(entry.renderings)) {   // If mapForm came from an explicit rendering (e.g., (@misradesh))
        console.log(`Explicit map form: ${vernLabel}`);
        if (!wordMatchesRenderings(mapForm, entry.renderings, false)) {
          console.log(`Explicit map form '${vernLabel}' does not match renderings.`);
          return 7 ; // Explicit map form does not match rendering
        }
      }
      return 4; // : "Approved"
    }
    
    // vernLabel !== mapForm
    return wordMatchesRenderings(vernLabel, entry.renderings, false) ?  6 : 3; // "insufficient"
  }

  getMatchTally(termId, refs) {
    let anyDenials = false;
    try {
      const entry = this.data[termId];
      let renderingList = [];
      if (!entry) {
        return [0, 0, false]; // No entry found, return zero tally
      }
      if (entry.renderings) {
        renderingList = entry.renderings
          .split(/\r?\n/)
          .map(r => r.replace(/\(.*/g, '').replace(/.*\)/g, '')) // Remove content in parentheses (comments), even if only partially enclosed. (The user may be typing a comment.)
          .map(r => r.trim())
          .filter(r => r.length > 0)
          .map(r => {
            let pattern = r;
            // Insert word boundary at start if not starting with *
            if (!pattern.startsWith('*')) pattern = '\\b' + pattern;
            // Insert word boundary at end if not ending with *
            if (!pattern.endsWith('*')) pattern = pattern + '\\b';
            // Replace * [with [\w-]* (word chars + dash)
            pattern = pattern.replace(/\*/g, '[\\w-]*');
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
  
      refs.map(refId => {
        const verse = extractedVerses[refId] || '';
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
      return [matchCount, refs.length, anyDenials];
    } catch (error) {
      console.error(`Error in getMatchTally for termId "${termId}":`, error);
      return [0,0, false];
    }
  }
  

}

export default TermRenderings;

