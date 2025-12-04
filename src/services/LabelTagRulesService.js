/**
 * LabelTagRulesService
 * 
 * Manages project-level Label Tag Rules for applying transformations to place names.
 * Loads LabelTagRules.json from the Paratext project folder.
 * 
 * Rule format:
 * {
 *   "to": [
 *     ["([^a])a$", "$1laai⏹"],
 *     ["$", "laai"]
 *   ],
 *   "q": [["$", "?"]]
 * }
 * 
 * Rules are applied sequentially until all are processed or a stop character (⏹) is encountered.
 */

class LabelTagRulesService {
  constructor() {
    this.projectFolder = null;
    this.tagRules = {}; // { tagName: [[find, replace], ...] }
    this.isInitialized = false;
  }

  /**
   * Initialize the service with a project folder path
   * @param {string} projectFolderPath - Absolute path to Paratext project folder
   */
  async initialize(projectFolderPath) {
    console.log(`[LabelTagRulesService] initialize called with projectFolder: ${projectFolderPath}`);
    this.projectFolder = projectFolderPath;
    await this.loadRules();
    this.isInitialized = true;
    console.log(`[LabelTagRulesService] Initialization complete. Rules loaded:`, Object.keys(this.tagRules));
  }

  /**
   * Load LabelTagRules.json from project folder
   */
  async loadRules() {
    if (!this.projectFolder) {
      throw new Error('Project folder not set. Call initialize() first.');
    }

    const rulesPath = `${this.projectFolder}/LabelTagRules.json`;
    console.log(`[LabelTagRulesService] Attempting to load rules from: ${rulesPath}`);
    
    try {
      const data = await window.electronAPI.readJsonFile(rulesPath);
      this.tagRules = data || {};
      console.log('[LabelTagRulesService] LabelTagRules loaded successfully:', Object.keys(this.tagRules));
      console.log('[LabelTagRulesService] Full rules:', JSON.stringify(this.tagRules, null, 2));
    } catch (error) {
      // File doesn't exist or error reading - start with empty rules
      this.tagRules = {};
      console.log('[LabelTagRulesService] No LabelTagRules.json found or error reading, using empty rules. Error:', error.message);
    }
    
    // Apply default rule for 'q' tag if not present
    if (!this.tagRules['q']) {
      this.tagRules['q'] = [["$", "?"]];
      console.log('[LabelTagRulesService] Applied default rule for "q" tag: [["$", "?"]]');
    }
  }

  /**
   * Apply tag rules to a text string
   * @param {string} tag - The tag name (e.g., "to", "q")
   * @param {string} text - The text to transform
   * @returns {string} - The transformed text
   */
  applyTag(tag, text) {
    const rules = this.tagRules[tag];
    
    // If no rules for this tag, return the tag literally with the text
    if (!rules || !Array.isArray(rules)) {
      return `${tag}#${text}`;
    }

    let result = text;
    const stopChar = '⏹';

    // Apply each rule in sequence
    for (let i = 0; i < rules.length; i++) {
      const rule = rules[i];
      if (!Array.isArray(rule) || rule.length !== 2) {
        console.log(`[LabelTagRulesService] Skipping invalid rule ${i}`);
        continue; // Skip invalid rules
      }

      const [findPattern, replacePattern] = rule;
      
      try {
        const regex = new RegExp(findPattern, 'g');
        result = result.replace(regex, replacePattern);
        
        // Check if stop character is in the result
        if (result.includes(stopChar)) {
          result = result.replace(stopChar, '');
          break;
        }
      } catch (error) {
        console.error(`Error applying tag rule for "${tag}":`, error);
      }
    }

    return result;
  }

  /**
   * Check if a tag has defined rules
   * @param {string} tag - The tag name
   * @returns {boolean}
   */
  hasRulesForTag(tag) {
    return this.tagRules[tag] && Array.isArray(this.tagRules[tag]);
  }

  /**
   * Get all defined tag names
   * @returns {string[]}
   */
  getDefinedTags() {
    return Object.keys(this.tagRules);
  }
}

// Create singleton instance
const labelTagRulesService = new LabelTagRulesService();

export default labelTagRulesService;
