/**
 * ReferenceFormatter
 * 
 * Formats scripture references using Paratext project conventions.
 * Reads book names from project's scrBookNames.xml and applies formatting rules.
 * 
 * Supports formats like:
 * - {r#JHN 2} → "Jn. 2" (abbreviated name)
 * - {R#JHN 2} → "John 2" (short name)
 * - {r#1SA 2.3} → "1 Sam. 2:3" (abbreviated)
 * - {R#GEN 1.1-3} → "Genesis 1:1-3" (short)
 */

class ReferenceFormatter {
  constructor() {
    this.projectFolder = null;
    this.bookNamesShort = {}; // Maps book codes to short names (e.g., "John")
    this.bookNamesAbbr = {};  // Maps book codes to abbreviated names (e.g., "Jn.")
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
      console.warn('Could not load scrBookNames.xml, will use book codes as fallback:', error);
    }
  }

  /**
   * Parse scrBookNames.xml content
   * @param {string} xmlContent - XML content from scrBookNames.xml
   */
  parseBookNames(xmlContent) {
    // XML parsing for book names
    // Format: <book code="GEN"><short>Genesis</short><abbr>Gen.</abbr></book>
    const bookPattern = /<book\s+code="([^"]+)"[^>]*>([\s\S]*?)<\/book>/g;
    let match;

    while ((match = bookPattern.exec(xmlContent)) !== null) {
      const bookCode = match[1];
      const bookContent = match[2];
      
      // Extract short name
      const shortMatch = /<short>([^<]+)<\/short>/.exec(bookContent);
      if (shortMatch) {
        this.bookNamesShort[bookCode] = shortMatch[1];
      }
      
      // Extract abbreviated name
      const abbrMatch = /<abbr>([^<]+)<\/abbr>/.exec(bookContent);
      if (abbrMatch) {
        this.bookNamesAbbr[bookCode] = abbrMatch[1];
      }
    }
  }

  /**
   * Format a scripture reference
   * @param {string} refString - Reference string like "JHN 2" or "1SA 2.3"
   * @param {boolean} useShort - If true, use short name (R#); if false, use abbreviated (r#)
   * @returns {string} Formatted reference
   */
  formatReference(refString, useShort = false) {
    if (!refString) {
      return '';
    }

    // Parse the reference
    const parts = refString.trim().split(/\s+/);
    if (parts.length === 0) {
      return refString;
    }

    const bookCode = parts[0];
    
    // Get book name based on preference
    let bookName;
    if (useShort) {
      // R# - prefer short name, fallback to abbreviated, then code
      bookName = this.bookNamesShort[bookCode] || this.bookNamesAbbr[bookCode] || bookCode;
    } else {
      // r# - prefer abbreviated name, fallback to short, then code
      bookName = this.bookNamesAbbr[bookCode] || this.bookNamesShort[bookCode] || bookCode;
    }

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
   * @param {boolean} useShort - If true, use short names; if false, use abbreviated
   * @returns {Array<string>} Array of formatted references
   */
  formatReferences(references, useShort = false) {
    return references.map(ref => this.formatReference(ref, useShort));
  }

  /**
   * Get book name for a book code
   * @param {string} bookCode - Book code like "GEN" or "JHN"
   * @param {boolean} useShort - If true, use short name; if false, use abbreviated
   * @returns {string} Book name in project language
   */
  getBookName(bookCode, useShort = false) {
    if (useShort) {
      return this.bookNamesShort[bookCode] || this.bookNamesAbbr[bookCode] || bookCode;
    } else {
      return this.bookNamesAbbr[bookCode] || this.bookNamesShort[bookCode] || bookCode;
    }
  }

  /**
   * Clear cached data
   */
  clear() {
    this.bookNamesShort = {};
    this.bookNamesAbbr = {};
    this.projectFolder = null;
    this.isInitialized = false;
  }
}

// Create singleton instance
const referenceFormatter = new ReferenceFormatter();

export default referenceFormatter;
