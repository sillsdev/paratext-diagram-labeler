import { collectionManager, getCollectionIdFromTemplate } from './CollectionManager';

/**
 * Get map definition for a specific template name
 * @param {string} templateName - The template name to look up
 * @param {string} [collectionId] - Optional collection ID (if not provided, will be extracted from templateName)
 * @returns {Object|null} - The map definition or null if not found
 */
function getMapDef(templateName, collectionId = null) {
  if (!templateName) {
    console.warn('Empty template name provided to getMapDef');
    return null;
  }

  // Extract collection ID from template if not provided
  if (!collectionId) {
    collectionId = getCollectionIdFromTemplate(templateName);
  }

  return collectionManager.getMapDef(templateName, collectionId);
}

export { getMapDef };
