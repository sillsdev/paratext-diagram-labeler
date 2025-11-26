/**
 * LabelTemplateParser
 * 
 * Parses label template strings to extract:
 * - {placeNameId} - Basic placeName references
 * - {tag#placeNameId} - Tagged placeName references (any tag allowed)
 * - {r#REF} - Scripture references with abbreviated names (e.g., {r#JHN 2} → "Jn. 2")\n * - {R#REF} - Scripture references with short names (e.g., {R#JHN 2} → "John 2")
 * - {#NUM} - Numbers for digit conversion (e.g., {#7.5}, {#123})
 * 
 * Collections can define their own tag conventions without central registry.
 */

class LabelTemplateParser {
  /**
   * Parse a template string and extract all field references
   * @param {string} template - Template string like "{Jerusalem}" or "{to#Jericho} and {from#Jerusalem}"
   * @returns {Object} Parsed template info
   */
  parseTemplate(template) {
    if (!template) {
      return {
        isValid: false,
        fields: [],
        placeNameIds: [],
        references: [],
        hasMultiplePlaceNames: false
      };
    }

    const fields = [];
    const placeNameIds = [];
    const references = [];

    // Regex to match {content} patterns
    // Literal curlies are never allowed, so we don't need to handle escaping
    const fieldPattern = /\{([^}]+)\}/g;
    let match;

    while ((match = fieldPattern.exec(template)) !== null) {
      const fieldContent = match[1];
      const field = {
        raw: match[0],
        content: fieldContent,
        start: match.index,
        end: match.index + match[0].length
      };

      // Check if this is a scripture reference {r#...} or {R#...}
      if (fieldContent.startsWith('r#') || fieldContent.startsWith('R#')) {
        field.type = 'reference';
        field.useShort = fieldContent.startsWith('R#'); // R# = short, r# = abbreviated
        field.reference = fieldContent.substring(2).trim();
        references.push(field.reference);
      }
      // Check if this is a number field {#...}
      else if (fieldContent.startsWith('#')) {
        field.type = 'number';
        field.number = fieldContent.substring(1).trim();
      }
      // Check if this has a tag {tag#placeNameId}
      else if (fieldContent.includes('#')) {
        const hashIndex = fieldContent.indexOf('#');
        field.type = 'tagged-placename';
        field.tag = fieldContent.substring(0, hashIndex);
        field.placeNameId = fieldContent.substring(hashIndex + 1);
        placeNameIds.push(field.placeNameId);
      }
      // Plain {placeNameId}
      else {
        field.type = 'placename';
        field.placeNameId = fieldContent;
        placeNameIds.push(fieldContent);
      }

      fields.push(field);
    }

    // Get unique placeNameIds
    const uniquePlaceNameIds = [...new Set(placeNameIds)];

    return {
      isValid: fields.length > 0,
      template,
      fields,
      placeNameIds: uniquePlaceNameIds,
      references,
      hasMultiplePlaceNames: uniquePlaceNameIds.length > 1,
      literalText: this.extractLiteralText(template, fields)
    };
  }

  /**
   * Extract literal (non-field) text from template
   * @param {string} template - Template string
   * @param {Array} fields - Parsed fields
   * @returns {string} Literal text portions
   */
  extractLiteralText(template, fields) {
    if (fields.length === 0) {
      return template;
    }

    let literalParts = [];
    let lastEnd = 0;

    for (const field of fields) {
      if (field.start > lastEnd) {
        literalParts.push(template.substring(lastEnd, field.start));
      }
      lastEnd = field.end;
    }

    if (lastEnd < template.length) {
      literalParts.push(template.substring(lastEnd));
    }

    return literalParts.join('').trim();
  }

  /**
   * Get all placeNameIds from a template
   * @param {string} template - Template string
   * @returns {Array<string>} Array of unique placeNameIds
   */
  getPlaceNameIds(template) {
    const parsed = this.parseTemplate(template);
    return parsed.placeNameIds;
  }

  /**
   * Get all references from a template
   * @param {string} template - Template string
   * @returns {Array<string>} Array of scripture references
   */
  getReferences(template) {
    const parsed = this.parseTemplate(template);
    return parsed.references;
  }

  /**
   * Check if template has multiple placeNames
   * @param {string} template - Template string
   * @returns {boolean} True if template references multiple placeNames
   */
  hasMultiplePlaceNames(template) {
    const parsed = this.parseTemplate(template);
    return parsed.hasMultiplePlaceNames;
  }

  /**
   * Validate template syntax
   * @param {string} template - Template string
   * @returns {Object} Validation result with isValid and errors
   */
  validateTemplate(template) {
    const errors = [];

    if (!template) {
      return { isValid: true, errors }; // Empty template is valid
    }

    // Check for unmatched braces
    const openCount = (template.match(/\{/g) || []).length;
    const closeCount = (template.match(/\}/g) || []).length;

    if (openCount !== closeCount) {
      errors.push('Unmatched curly braces in template');
    }

    // Check for nested braces (not allowed)
    if (/\{[^}]*\{/.test(template) || /\}[^{]*\}/.test(template)) {
      errors.push('Nested curly braces are not allowed');
    }

    // Check for empty fields
    if (/\{\s*\}/.test(template)) {
      errors.push('Empty field references {} are not allowed');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

// Create singleton instance
const labelTemplateParser = new LabelTemplateParser();

export default labelTemplateParser;
