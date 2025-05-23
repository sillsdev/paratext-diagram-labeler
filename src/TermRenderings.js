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
      console.warn(`TermId "${termId}" not found in term renderings`);
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

  getStatus(termId, vernacularName) {
    const entry = this.data[termId];
    if (!entry) {
      console.warn(`TermId "${termId}" not found in term renderings`);
      return { status: "Error", color: "red" };
    }
    
    if (!vernacularName) {
      return { status: "Blank", color: "darkred" };
    }
    
    if (vernacularName.includes('—')) {
      return { status: "Must select one", color: "darkorange" };
    }
    
    const mapForm = this.getMapForm(termId);
    if (!mapForm) {
      return { status: "No renderings", color: "darkslategray" };
    }
    
    if (vernacularName !== mapForm) {
      return { status: "Does not match", color: "darkmagenta" };
    }
    
    if (vernacularName === mapForm && !entry.isGuessed) {
      return { status: "Approved", color: "darkgreen" };
    }
    
    if (vernacularName === mapForm && entry.isGuessed) {
      return { status: "Guessed rendering not yet approved", color: "darkblue" };
    }
    
    return { status: "Needs checked", color: "darkgoldenrod" };
  }
}

export default TermRenderings;