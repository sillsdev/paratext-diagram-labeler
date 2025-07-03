import { collectionManager, getCollectionIdFromTemplate } from './CollectionManager';

// Cache to prevent duplicate getMapDef calls  //TODO: Check if this is still needed
const mapDefCache = new Map();
const pendingRequests = new Map();

/**
 * Get map definition for a specific template name
 * @param {string} templateName - The template name to look up
 * @param {string} [collectionId] - Optional collection ID (if not provided, will be extracted from templateName)
 * @returns {Object|null} - The map definition or null if not found
 */
async function getMapDef(templateName, collectionId = null) {
  if (!templateName) {
    console.warn('Empty template name provided to getMapDef');
    return null;
  }

  // Extract collection ID from template if not provided
  if (!collectionId) {
    collectionId = getCollectionIdFromTemplate(templateName);
  }

  const cacheKey = `${templateName}|${collectionId}`;

  // Check if we have a cached result   //TODO: Get rid of this cache elsewhere in code. It results in stale data.
  // if (mapDefCache.has(cacheKey)) {
  //   console.log(`Using cached map definition for: ${templateName}`);
  //   return mapDefCache.get(cacheKey);
  // }

  // Check if there's already a pending request for this template
  if (pendingRequests.has(cacheKey)) {
    console.log(`Waiting for pending map definition request for: ${templateName}`);
    return await pendingRequests.get(cacheKey);
  }

  console.log(`getMapDef called with templateName: ${templateName} collectionId: ${collectionId}`);

  // Create a promise for this request
  const requestPromise = Promise.resolve(collectionManager.getMapDef(templateName, collectionId));
  pendingRequests.set(cacheKey, requestPromise);

  try {
    const result = await requestPromise;
    // Cache the result
    mapDefCache.set(cacheKey, result);
    // Remove from pending requests
    pendingRequests.delete(cacheKey);
    return result;
  } catch (error) {
    // Remove from pending requests on error
    pendingRequests.delete(cacheKey);
    throw error;
  }
}

export { getMapDef };
