/**
 * ReferenceFormatter
 * 
 * Formats scripture references using Paratext project conventions.
 * Reads book names from project's scrBookNames.xml and applies formatting rules.
 * 
 * Supports formats like:
 * - {r#JHN 2} → "John 2" (or vernacular book name)
 * - {r#1SA 2.3} → "1 Samuel 2:3"
 * - {r#GEN 1.1-3} → "Genesis 1:1-3"
 */

class ReferenceFormatter {
  constructor() {
    this.projectFolder = null;
    this.bookNames = {}; // Maps book codes to vernacular names
    this.isInitialized = false;
  }

  /**
   * Initialize with project folder and load book names
   * @param {string} projectFolderPath - Path to Paratext project folder
   */
  async initialize(projectFolderPath) {
    this.projectFolder = projectFolderPath;
    await this.loadBookNames();
    this.isInitialized = true;
  }

  /**
   * Load book names from project's scrBookNames.xml
   */
  async loadBookNames() {
    if (!this.projectFolder) {
      throw new Error('Project folder not set');
    }

    try {
      const bookNamesPath = `${this.projectFolder}/scrBookNames.xml`;
      const xmlContent = await window.electronAPI.readFile(bookNamesPath);
      this.parseBookNames(xmlContent);
    } catch (error) {
      console.warn('Could not load scrBookNames.xml, using default English names:', error);
      this.loadDefaultBookNames();
    }
  }

  /**
   * Parse scrBookNames.xml content
   * @param {string} xmlContent - XML content from scrBookNames.xml
   */
  parseBookNames(xmlContent) {
    // Simple XML parsing for book names
    // Format: <book code="GEN">Genesis</book>
    const bookPattern = /<book\s+code="([^"]+)">([^<]+)<\/book>/g;
    let match;

    while ((match = bookPattern.exec(xmlContent)) !== null) {
      const bookCode = match[1];
      const bookName = match[2];
      this.bookNames[bookCode] = bookName;
    }
  }

  /**
   * Load default English book names as fallback
   */
  loadDefaultBookNames() {
    this.bookNames = {
      GEN: 'Genesis', EXO: 'Exodus', LEV: 'Leviticus', NUM: 'Numbers', DEU: 'Deuteronomy',
      JOS: 'Joshua', JDG: 'Judges', RUT: 'Ruth', '1SA': '1 Samuel', '2SA': '2 Samuel',
      '1KI': '1 Kings', '2KI': '2 Kings', '1CH': '1 Chronicles', '2CH': '2 Chronicles',
      EZR: 'Ezra', NEH: 'Nehemiah', EST: 'Esther', JOB: 'Job', PSA: 'Psalms',
      PRO: 'Proverbs', ECC: 'Ecclesiastes', SNG: 'Song of Songs', ISA: 'Isaiah',
      JER: 'Jeremiah', LAM: 'Lamentations', EZK: 'Ezekiel', DAN: 'Daniel', HOS: 'Hosea',
      JOL: 'Joel', AMO: 'Amos', OBA: 'Obadiah', JON: 'Jonah', MIC: 'Micah',
      NAM: 'Nahum', HAB: 'Habakkuk', ZEP: 'Zephaniah', HAG: 'Haggai', ZEC: 'Zechariah',
      MAL: 'Malachi', MAT: 'Matthew', MRK: 'Mark', LUK: 'Luke', JHN: 'John',
      ACT: 'Acts', ROM: 'Romans', '1CO': '1 Corinthians', '2CO': '2 Corinthians',
      GAL: 'Galatians', EPH: 'Ephesians', PHP: 'Philippians', COL: 'Colossians',
      '1TH': '1 Thessalonians', '2TH': '2 Thessalonians', '1TI': '1 Timothy',
      '2TI': '2 Timothy', TIT: 'Titus', PHM: 'Philemon', HEB: 'Hebrews', JAS: 'James',
      '1PE': '1 Peter', '2PE': '2 Peter', '1JN': '1 John', '2JN': '2 John',
      '3JN': '3 John', JUD: 'Jude', REV: 'Revelation'
    };
  }

  /**
   * Format a scripture reference
   * @param {string} refString - Reference string like "JHN 2" or "1SA 2.3"
   * @returns {string} Formatted reference
   */
  formatReference(refString) {
    if (!refString) {
      return '';
    }

    // Parse the reference
    const parts = refString.trim().split(/\s+/);
    if (parts.length === 0) {
      return refString;
    }

    const bookCode = parts[0];
    const bookName = this.bookNames[bookCode] || bookCode;

    if (parts.length === 1) {
      // Just book name
      return bookName;
    }

    // Handle chapter.verse format
    const ref = parts[1];
    
    // Replace dots with colons for verse references (2.3 → 2:3)
    const formattedRef = ref.includes('.') && !ref.includes(':')
      ? ref.replace('.', ':')
      : ref;

    return `${bookName} ${formattedRef}`;
  }

  /**
   * Format multiple references (e.g., from a template)
   * @param {Array<string>} references - Array of reference strings
   * @returns {Array<string>} Array of formatted references
   */
  formatReferences(references) {
    return references.map(ref => this.formatReference(ref));
  }

  /**
   * Get book name for a book code
   * @param {string} bookCode - Book code like "GEN" or "JHN"
   * @returns {string} Book name in project language
   */
  getBookName(bookCode) {
    return this.bookNames[bookCode] || bookCode;
  }

  /**
   * Clear cached data
   */
  clear() {
    this.bookNames = {};
    this.projectFolder = null;
    this.isInitialized = false;
  }
}

// Create singleton instance
const referenceFormatter = new ReferenceFormatter();

export default referenceFormatter;
