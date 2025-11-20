/**
 * LabelDictionaryService
 * 
 * Manages project-level Label Dictionary and PlaceName Data storage.
 * Stores:
 * - LabelDictionary.json: maps lblTemplate → vernacular label
 * - PlaceNameData.json: stores per-placeName altRenderings confirmations and isJoined flag
 * 
 * Both files are stored directly in the Paratext project folder alongside TermRenderings.xml
 */

class LabelDictionaryService {
  constructor() {
    this.projectFolder = null;
    this.labelDictionary = {}; // { lblTemplate: vernacular }
    this.placeNameData = {}; // { placeNameId: { altRenderings: [[patterns]], isJoined: boolean } }
    this.isInitialized = false;
  }

  /**
   * Initialize the service with a project folder path
   * @param {string} projectFolderPath - Absolute path to Paratext project folder
   */
  async initialize(projectFolderPath) {
    this.projectFolder = projectFolderPath;
    await this.loadAll();
    this.isInitialized = true;
  }

  /**
   * Load both LabelDictionary.json and PlaceNameData.json
   */
  async loadAll() {
    if (!this.projectFolder) {
      throw new Error('Project folder not set. Call initialize() first.');
    }

    try {
      // Load LabelDictionary.json
      const dictPath = `${this.projectFolder}/LabelDictionary.json`;
      try {
        const dictData = await window.electronAPI.readJsonFile(dictPath);
        this.labelDictionary = dictData || {};
      } catch (error) {
        // File doesn't exist yet - start with empty dictionary
        this.labelDictionary = {};
      }

      // Load PlaceNameData.json
      const dataPath = `${this.projectFolder}/PlaceNameData.json`;
      try {
        const data = await window.electronAPI.readJsonFile(dataPath);
        this.placeNameData = data || {};
      } catch (error) {
        // File doesn't exist yet - start with empty data
        this.placeNameData = {};
      }
    } catch (error) {
      console.error('Error loading label dictionary data:', error);
      throw error;
    }
  }

  /**
   * Save LabelDictionary.json to project folder
   */
  async saveLabelDictionary() {
    if (!this.projectFolder) {
      throw new Error('Project folder not set. Call initialize() first.');
    }

    try {
      const dictPath = `${this.projectFolder}/LabelDictionary.json`;
      await window.electronAPI.saveJsonFile(dictPath, this.labelDictionary);
    } catch (error) {
      console.error('Error saving label dictionary:', error);
      throw error;
    }
  }

  /**
   * Save PlaceNameData.json to project folder
   */
  async savePlaceNameData() {
    if (!this.projectFolder) {
      throw new Error('Project folder not set. Call initialize() first.');
    }

    try {
      const dataPath = `${this.projectFolder}/PlaceNameData.json`;
      await window.electronAPI.saveJsonFile(dataPath, this.placeNameData);
    } catch (error) {
      console.error('Error saving place name data:', error);
      throw error;
    }
  }

  /**
   * Get vernacular label for a template
   * @param {string} lblTemplate - Template string like "{Jerusalem}"
   * @returns {string|null} Vernacular label or null if not found
   */
  getVernacular(lblTemplate) {
    return this.labelDictionary[lblTemplate] || null;
  }

  /**
   * Set vernacular label for a template (in memory only - does not save to disk)
   * @param {string} lblTemplate - Template string like "{Jerusalem}"
   * @param {string} vernacular - Vernacular label text
   * @param {string} opCode - Operation code: 'sync', 'override', or 'omit'
   */
  setVernacular(lblTemplate, vernacular, opCode = 'sync') {
    // Only store in dictionary if opCode is 'sync'
    if (opCode === 'sync') {
      this.labelDictionary[lblTemplate] = vernacular;
      // Note: Does not auto-save - call saveLabelDictionary() explicitly when ready
    }
  }
  
  /**
   * Sync all labels with opCode='sync' to the dictionary and save to disk
   * @param {Array} labels - Array of label objects
   */
  async syncLabelsToDict(labels) {
    labels.forEach(label => {
      if (label.opCode === 'sync' && label.lblTemplate && label.vernLabel) {
        this.labelDictionary[label.lblTemplate] = label.vernLabel;
      }
    });
    await this.saveLabelDictionary();
  }

  /**
   * Get confirmed alternate renderings for a placeName
   * @param {string} placeNameId - PlaceName identifier
   * @returns {Array<Array<string>>} Array of confirmed pattern arrays
   */
  getAltRenderings(placeNameId) {
    const data = this.placeNameData[placeNameId];
    return data?.altRenderings || [];
  }

  /**
   * Add confirmed rendering patterns for a placeName
   * @param {string} placeNameId - PlaceName identifier
   * @param {Array<string>} patterns - Array of pattern strings to confirm
   */
  async addAltRendering(placeNameId, patterns) {
    if (!this.placeNameData[placeNameId]) {
      this.placeNameData[placeNameId] = {
        altRenderings: [],
        isJoined: false
      };
    }

    // Sort patterns for consistent comparison
    const sortedPatterns = [...patterns].sort();
    
    // Check if this pattern set already exists
    const exists = this.placeNameData[placeNameId].altRenderings.some(
      existing => {
        const sortedExisting = [...existing].sort();
        return JSON.stringify(sortedExisting) === JSON.stringify(sortedPatterns);
      }
    );

    if (!exists) {
      this.placeNameData[placeNameId].altRenderings.push(sortedPatterns);
      await this.savePlaceNameData();
    }
  }

  /**
   * Check if patterns are in confirmed altRenderings
   * @param {string} placeNameId - PlaceName identifier
   * @param {Array<string>} patterns - Array of pattern strings to check
   * @returns {boolean} True if patterns are confirmed
   */
  isPatternsConfirmed(placeNameId, patterns) {
    const altRenderings = this.getAltRenderings(placeNameId);
    const sortedPatterns = [...patterns].sort();
    
    return altRenderings.some(existing => {
      const sortedExisting = [...existing].sort();
      return JSON.stringify(sortedExisting) === JSON.stringify(sortedPatterns);
    });
  }

  /**
   * Get joined status for a placeName
   * @param {string} placeNameId - PlaceName identifier
   * @returns {boolean} True if terms are joined
   */
  isJoined(placeNameId) {
    const data = this.placeNameData[placeNameId];
    return data?.isJoined || false;
  }

  /**
   * Set joined status for a placeName
   * @param {string} placeNameId - PlaceName identifier
   * @param {boolean} joined - Whether terms should be joined
   */
  async setJoined(placeNameId, joined) {
    if (!this.placeNameData[placeNameId]) {
      this.placeNameData[placeNameId] = {
        altRenderings: [],
        isJoined: false
      };
    }

    this.placeNameData[placeNameId].isJoined = joined;
    await this.savePlaceNameData();
  }

  /**
   * Clear all data (for testing or project switching)
   */
  clear() {
    this.labelDictionary = {};
    this.placeNameData = {};
    this.projectFolder = null;
    this.isInitialized = false;
  }
}

// Create singleton instance
const labelDictionaryService = new LabelDictionaryService();

export default labelDictionaryService;
