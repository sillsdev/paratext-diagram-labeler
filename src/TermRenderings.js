class TermRenderings {
  constructor(jsonFile) {
    this.data = {};
    this.loadData(jsonFile);
  }

  loadData(jsonFile) {
    fetch(jsonFile)
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
      })
      .then(data => {
        this.data = data;
      })
      .catch(error => console.error('Failed to load term renderings:', error));
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

    if (termId === "philipstravels_title") {
      console.warn("======================");
    }
    console.log(`Checking status for termId: ${termId}, vernLabel: ${vernLabel}`);
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
    
    if (vernLabel !== mapForm) {
      return 3; //{ status: "Does not match", color: "darkmagenta" };
    }
    
    if (vernLabel === mapForm && !entry.isGuessed) {
      return 4; //{ status: "Approved", color: "darkgreen" };
    }
    
    if (vernLabel === mapForm && entry.isGuessed) {
      return 5; // { status: "Guessed rendering not yet approved", color: "darkblue" };
    }
    
    return 6; //{ status: "Needs checked", color: "darkgoldenrod" };
  }

}

export default TermRenderings;