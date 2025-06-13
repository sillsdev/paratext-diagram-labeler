import { COLLECTIONS, getCollectionIdFromTemplate } from './CollPlacenamesAndRefs';

// Load map definitions from JSON files - we'll switch this to dynamic loading
const smrMapData = require('./data/smr-map-defs.json');

// Cache for loaded map definition files
const mapDefsCache = {
    'SMR': smrMapData,
};

function findMapDefIgnoreCase(mapDefs, mapId) {
  const lowerMapId = mapId.toLowerCase();
  
  // Try direct lookup first for performance
  if (mapDefs[mapId]) {
    return mapDefs[mapId];
  }
  
  // Fall back to case-insensitive search
  for (const key in mapDefs) {
    console.log(`Checking map definition key: ${key.toLowerCase()} against ${lowerMapId}`);
    if (key.toLowerCase() === lowerMapId) {
      return mapDefs[key];
    }
  }
  
  return null;
}


// Synchronous version - returns null if data not yet loaded
function getMapDefSync(mapId, collPlacenames) {
    if (!mapId) {
        return null; // Handle empty template case explicitly
    }
    
    // Get collection ID from the map template name
    const collectionId = getCollectionIdFromTemplate(mapId);
    
    // If collection isn't loaded or not the current one, we can't proceed synchronously
    if (collPlacenames.getCurrentCollection() !== collectionId || !mapDefsCache[collectionId]) {
        console.log(`Collection ${collectionId} not ready for sync access - need async load first`);
        return null;
    }
    
    const mapDefs = mapDefsCache[collectionId];
    const mapData = findMapDefIgnoreCase(mapDefs, mapId);
    
    if (!mapData) {
        console.warn(`Map definition not found for ${mapId} in collection ${collectionId}`);
        return null;
    }
    
    // Create a copy with labels that have glosses
    const result = { ...mapData };
    
    if (Array.isArray(result.labels)) {
        result.labels = result.labels.map((label, idx) => ({ 
            ...label, 
            idx, 
            gloss: collPlacenames.getGloss(label.mergeKey)
        }));
    }
    
    result.template = mapId;
    return result;
}

// Async version - will load required data if needed
async function getMapDef(mapId, collPlacenames) {
    try {
        if (!mapId) {
            return null; // Handle empty template case explicitly
        }
        
        // Get collection ID from the map template name
        const collectionId = getCollectionIdFromTemplate(mapId);
        
        // Ensure we have the correct collection loaded in collPlacenames
        if (collPlacenames.getCurrentCollection() !== collectionId) {
            await collPlacenames.switchCollection(collectionId);
        }
        
        // Load map definitions for this collection if not already loaded
        if (!mapDefsCache[collectionId]) {
            const collection = COLLECTIONS[collectionId] || COLLECTIONS.SMR;
            const fileName = collection.mapDefsFile;
            const templatePath = 'C:/My Paratext 9 Projects/_MapLabelerTemplates';
            
            try {
                mapDefsCache[collectionId] = await window.electronAPI.loadFromJson(templatePath, fileName);
                console.log(`Map definitions for ${collectionId} loaded successfully`);
            } catch (error) {
                console.error(`Failed to load map definitions for ${collectionId}:`, error);
                // Fall back to SMR if loading fails
                mapDefsCache[collectionId] = smrMapData;
            }
        }
        
        // Now that we've ensured the data is loaded, use the sync version
        return getMapDefSync(mapId, collPlacenames);
    } catch (e) {
        console.error(`Failed to load map definition for ${mapId}:`, e);
        return null;
    }
}

export { getMapDef, getMapDefSync };
