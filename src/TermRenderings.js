import { STATUS_BLANK, STATUS_MULTIPLE, STATUS_NO_RENDERINGS, STATUS_UNMATCHED, STATUS_MATCHED, STATUS_GUESSED, STATUS_RENDERING_SHORT, STATUS_BAD_EXPLICIT_FORM } from './constants.js';
import { wordMatchesRenderings } from './Utils.js';

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
    const items = renderingsStr.replace(/\|\|/g, '\n').split(/(\r?\n)/);
    // console.log(`Split renderings for termId "${termId}":`, items);
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
      return STATUS_BLANK; //{ status: "Blank", color: "crimson" };
    }
    
    if (vernLabel.includes('—')) {
      return STATUS_MULTIPLE; //{ status: "Must select one", color: "darkorange" };
    }
    
    const entry = this.data[termId];
    if (!entry) {
      //console.warn(`TermId "${termId}" not found in term renderings`);
      return STATUS_NO_RENDERINGS; // { status: "No renderings", color: "indianred" };
    }
    
    const mapForm = this.getMapForm(termId);
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

  getEntry(termId) {
    return this.data[termId];
  }
  

}

export default TermRenderings;

