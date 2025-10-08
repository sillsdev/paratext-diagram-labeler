class AutocorrectService {
  constructor() {
    this.rules = [];
    this.isLoaded = false;
  }

  async loadAutocorrectFile(projectFolder) {
    try {
      const pathSeparator = window.electronAPI.getPathSeparator();
      const filePath = `${projectFolder}${pathSeparator}autocorrect.txt`;
      const content = await window.electronAPI.readFile(filePath);
      this.parseRules(content);
      this.isLoaded = true;
      console.log(`Loaded ${this.rules.length} autocorrect rules from ${filePath}`);
    } catch (error) {
      console.log('No autocorrect.txt file found or error loading:', error);
      this.rules = [];
      this.isLoaded = true;
    }
  }

  parseRules(content) {
    this.rules = [];
    
    const lines = content.split(/\r?\n/);
    
    for (let line of lines) {
      line = line.trim();
      
      // Skip empty lines and comments
      if (!line || line.startsWith('#')) continue;
      
      const arrowIndex = line.indexOf('-->');
      if (arrowIndex === -1) continue;
      
      const pattern = line.substring(0, arrowIndex);
      const replacement = line.substring(arrowIndex + 3);
      
      // Convert Unicode escapes (\uXXXX) to actual characters
      const processedPattern = this.processUnicodeEscapes(pattern);
      const processedReplacement = this.processUnicodeEscapes(replacement);
      
      this.rules.push({
        pattern: processedPattern,
        replacement: processedReplacement,
        length: processedPattern.length
      });
    }
    
    // Sort by pattern length (longest first) to handle overlapping patterns correctly
    this.rules.sort((a, b) => b.length - a.length);
  }

  getBuiltInRules() {
    // Built-in rules for parentheses escaping (for vernacular inputs only)
    return [
      { pattern: '(', replacement: '❪', length: 1 },
      { pattern: ')', replacement: '❫', length: 1 }
    ];
  }

  processUnicodeEscapes(text) {
    return text.replace(/\\u([0-9A-Fa-f]{4})/g, (match, hex) => {
      return String.fromCharCode(parseInt(hex, 16));
    });
  }

  applyAutocorrect(text, cursorPosition, includeBuiltInRules = true) {
    if (!this.isLoaded) return { text, cursorPosition };
    
    let rulesToApply = [...this.rules];
    
    // Add built-in rules if requested (for vernacular inputs only)
    if (includeBuiltInRules) {
      const builtInRules = this.getBuiltInRules();
      // Add built-in rules at the beginning (higher priority)
      rulesToApply = [...builtInRules, ...rulesToApply];
    }
    
    if (rulesToApply.length === 0) return { text, cursorPosition };
    
    let modified = false;
    let newText = text;
    let newCursorPosition = cursorPosition;
    
    // Check each rule against the text around cursor position
    for (const rule of rulesToApply) {
      const startPos = Math.max(0, cursorPosition - rule.length);
      const checkText = newText.substring(startPos, cursorPosition);
      
      if (checkText.endsWith(rule.pattern)) {
        // Apply the replacement
        const replaceStart = cursorPosition - rule.pattern.length;
        newText = newText.substring(0, replaceStart) + 
                 rule.replacement + 
                 newText.substring(cursorPosition);
        
        // Adjust cursor position
        newCursorPosition = replaceStart + rule.replacement.length;
        modified = true;
        break; // Apply only the first matching rule
      }
    }
    
    return { text: newText, cursorPosition: newCursorPosition, modified };
  }
}

export const autocorrectService = new AutocorrectService();
