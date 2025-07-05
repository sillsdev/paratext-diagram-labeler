// filepath: c:\git\mapLabelerExt\biblical-map-app\src\CollectionManager.js
// Collection mapping structure
export const COLLECTIONS = {
  SMR: {
    id: 'SMR',
    name: 'SIL Map Repository',
    placeNamesFile: 'smr-placenames-refs.json',
    mapDefsFile: 'smr-map-defs.json',
    description: 'SIL Map Repository collection',
  },
  UBS: {
    id: 'UBS',
    name: 'United Bible Societies',
    placeNamesFile: 'ubs-placenames-refs.json',
    mapDefsFile: 'ubs-map-defs.json',
    description: 'United Bible Societies collection',
  },
  // Additional collections as needed
};

// Helper functions for collections
export function getAllCollectionIds() {
  return Object.keys(COLLECTIONS);
}

export function getCollectionById(id) {
  return COLLECTIONS[id] || COLLECTIONS.SMR;
}

// Function to determine collection ID from template name
export function getCollectionIdFromTemplate(templateName) {
  if (!templateName) return 'SMR'; // Default to SMR if no template
  const match = templateName.match(/^([^_]+)_/);
  // Always uppercase the collection ID to match the COLLECTIONS object keys
  return match ? match[1].toUpperCase() : 'SMR'; // Default to SMR if no match
}

class CollectionManager {
  constructor() {
    this.collectionsData = {};
    this.isInitialized = false;
    this.isLoading = false;
    this.loadError = null;
  } // Initialize by loading all collections
  async initializeAllCollections(templateFolderPath) {
    if (this.isInitialized) return;
    if (this.isLoading) return;

    this.isLoading = true;
    this.loadError = null;

    this.templateFolderPath = templateFolderPath;
    if (!this.templateFolderPath) {
      this.loadError = new Error(
        'Template folder path is not set. Please configure the template folder in settings.'
      );
    }

    try {
      const collectionIds = getAllCollectionIds();
      console.log(`Starting to load ${collectionIds.length} collections...`);

      // Create promises for loading all collections in parallel
      const loadPromises = collectionIds.map(id => this.loadCollection(id));

      // Wait for all collections to load
      await Promise.all(loadPromises);

      this.isInitialized = true;
      console.log(`All ${collectionIds.length} collections loaded successfully`);
    } catch (error) {
      this.loadError = error;
      console.error('Failed to initialize all collections:', error);
    } finally {
      this.isLoading = false;
    }
  }

  // Load a specific collection
  async loadCollection(collectionId) {
    if (this.collectionsData[collectionId]?.isLoaded) {
      console.log(`Collection ${collectionId} already loaded`);
      return;
    }

    const collection = getCollectionById(collectionId);
    console.log(`Loading collection ${collection.name}...`);

    try {
      // Create collection data structure if it doesn't exist
      if (!this.collectionsData[collectionId]) {
        this.collectionsData[collectionId] = {
          isLoaded: false,
          placenames: null,
          mapDefs: null,
        };
      } 
      
      // Use templateFolderPath if provided, otherwise fall back to the old method
      // Ensure consistent path separator (backslash for Windows)
      const templatePath = this.templateFolderPath;

      // Check if template path exists before trying to load from it
      // console.log(`Verifying template folder exists: ${templatePath}`);
      const folderExists = await this.checkFolderExists(templatePath);

      if (!folderExists) {
        throw new Error(`Template folder not found: ${templatePath}`);
      }

      // console.log(`Loading collection data from verified path: ${templatePath}`);

      // Load placenames and map definitions in parallel
      const [placenames, mapDefs] = await Promise.all([
        window.electronAPI.loadFromJson(templatePath, collection.placeNamesFile).catch(err => {
          console.error(`Failed to load placenames file: ${collection.placeNamesFile}`, err);
          throw new Error(
            `Could not load required file: ${collection.placeNamesFile}. Please check that your template folder is configured correctly.`
          );
        }),
        window.electronAPI.loadFromJson(templatePath, collection.mapDefsFile).catch(err => {
          console.error(`Failed to load map definitions file: ${collection.mapDefsFile}`, err);
          throw new Error(
            `Could not load required file: ${collection.mapDefsFile}. Please check that your template folder is configured correctly.`
          );
        }),
      ]);

      // Check if data was loaded successfully
      if (!placenames || Object.keys(placenames).length === 0) {
        throw new Error(`Empty placenames data loaded from ${collection.placeNamesFile}`);
      }

      if (!mapDefs || Object.keys(mapDefs).length === 0) {
        throw new Error(`Empty map definitions loaded from ${collection.mapDefsFile}`);
      }
      // Build normalized map defs for case-insensitive lookup
      const normalizedMapDefs = {};
      // console.log(`Building normalized map definitions for collection ${collectionId}`);
      for (const key in mapDefs) {
        normalizedMapDefs[key.toLowerCase()] = key; // Store original key for lookup
        // console.log(`Map key: "${key}" => normalized: "${key.toLowerCase()}"`);
      }
      // console.log(`Created ${Object.keys(normalizedMapDefs).length} normalized map definition keys for ${collectionId}`);
      // Show some examples of normalized keys
      // const exampleKeys = Object.keys(normalizedMapDefs).slice(0, 3);
      // console.log("Example normalized keys:", exampleKeys);

      // Store the loaded data
      this.collectionsData[collectionId] = {
        isLoaded: true,
        placenames,
        mapDefs,
        normalizedMapDefs,
      };

      console.log(
        `Collection ${collection.name} loaded successfully with ${
          Object.keys(placenames).length
        } placenames and ${Object.keys(mapDefs).length} map definitions`
      );
    } catch (error) {
      console.error(`Failed to load collection ${collection.name}:`, error);
      // Keep the collection structure but mark as failed
      if (this.collectionsData[collectionId]) {
        this.collectionsData[collectionId].loadError = error;
      }
    }
  }

  // Synchronous methods to access collection data
  isCollectionLoaded(collectionId) {
    // Ensure uppercase collection ID for consistency
    const normalizedId = (collectionId || '').toUpperCase();
    return !!this.collectionsData[normalizedId]?.isLoaded;
  }

  getPlacenames(collectionId) {
    // Ensure uppercase collection ID for consistency
    const normalizedId = (collectionId || '').toUpperCase();
    return this.collectionsData[normalizedId]?.placenames || {};
  }

  getMapDefs(collectionId) {
    // Ensure uppercase collection ID for consistency
    const normalizedId = (collectionId || '').toUpperCase();
    return this.collectionsData[normalizedId]?.mapDefs || {};
  } // Get map definition with case-insensitive lookup

  getMapDef(templateName, collectionId) {
    // Add diagnostics
    console.log('getMapDef called with templateName:', templateName, 'collectionId:', collectionId);

    // Extract collection ID from template if not provided
    if (!collectionId && templateName) {
      collectionId = getCollectionIdFromTemplate(templateName);
      console.log('Extracted collection ID:', collectionId);
    }

    // Ensure collection ID is uppercase to match our keys
    collectionId = (collectionId || 'SMR').toUpperCase();
    console.log('Using normalized collection ID:', collectionId);

    if (!templateName) {
      console.warn('No template name provided to getMapDef');
      return null;
    }

    const collection = this.collectionsData[collectionId];
    if (!collection?.isLoaded) {
      console.warn(
        `Collection ${collectionId} not loaded, can't get map definition for ${templateName}`
      );
      return null;
    }

    console.log('Collection is loaded:', collection.isLoaded);

    // Try direct lookup first
    // console.log('Attempting direct lookup with key:', templateName);
    if (collection.mapDefs[templateName]) {
      console.log('Found template with exact match');
      const result = { ...collection.mapDefs[templateName] };
      result.template = templateName;
      return this.enrichMapDefWithGlosses(result, collectionId);
    }

    // Try case-insensitive lookup
    // console.log('Attempting case-insensitive lookup with key:', templateName.toLowerCase());
    // console.log(
    //   'Available normalized keys:',
    //   Object.keys(collection.normalizedMapDefs).slice(0, 5),
    //   '...'
    // );

    const normalizedKey = collection.normalizedMapDefs[templateName.toLowerCase()];
    if (normalizedKey) {
      // console.log('Found template with case-insensitive match:', normalizedKey);
      const result = { ...collection.mapDefs[normalizedKey] };
      result.template = templateName; // Use the requested template name
      return this.enrichMapDefWithGlosses(result, collectionId);
    }

    console.warn('No template match found for:', templateName);
    return null;
  }

  // Add glosses to map definition labels
  enrichMapDefWithGlosses(mapDef, collectionId) {
    if (!mapDef || !Array.isArray(mapDef.labels)) {
      return mapDef;
    }

    mapDef.labels = mapDef.labels.map((label, idx) => ({
      ...label,
      idx,
      gloss: this.getGloss(label.mergeKey, collectionId),
      termId: this.getTermId(label.mergeKey, collectionId),
    }));

    return mapDef;
  }

  // Placenames access methods with collection ID parameter
  getGloss(mergeKey, collectionId) {
    const placenames = this.getPlacenames(collectionId);
    const entry = placenames[mergeKey];
    if (!entry) {
      console.warn(`mergeKey "${mergeKey}" not found in ${collectionId} collection placenames`);
      return '';
    }
    return entry.gloss || '';
  }

  getMapxKey(mergeKey, collectionId = 'SMR') {
    const placenames = this.getPlacenames(collectionId);
    const entry = placenames[mergeKey];
    if (!entry) {
      console.error(`mergeKey "${mergeKey}" not found in ${collectionId} collection placenames!`);
      return mergeKey;
    }
    return entry.mapxKey || entry.gloss.en || mergeKey;
  }

  getTermId(mergeKey, collectionId = 'SMR') {
    const placenames = this.getPlacenames(collectionId);
    const entry = placenames[mergeKey];
    if (!entry) {
      console.warn(`mergeKey "${mergeKey}" not found in ${collectionId} collection placenames`);
      return '';
    }
    return entry.termId || '';
  }

  getDefinition(mergeKey, collectionId = 'SMR') {
    const placenames = this.getPlacenames(collectionId);
    const entry = placenames[mergeKey];
    if (!entry) {
      // Avoid spamming console with warnings
      return '';
    }
    return entry.context || '';
  }

  getAltTermIds(mergeKey, collectionId = 'SMR') {
    const placenames = this.getPlacenames(collectionId);
    const entry = placenames[mergeKey];
    if (!entry || !entry.altTermIds) {
      return '';
    }
    return entry.altTermIds;
  }

  getTransliteration(mergeKey, collectionId = 'SMR') {
    const placenames = this.getPlacenames(collectionId);
    const entry = placenames[mergeKey];
    if (!entry) {
      // Avoid spamming console with warnings
      return '';
    }
    return entry.transliteration || '';
  }

  getRefs(mergeKey, collectionId = 'SMR') {
    const placenames = this.getPlacenames(collectionId);
    const entry = placenames[mergeKey];
    if (!entry) {
      console.warn(`mergeKey "${mergeKey}" not found in ${collectionId} collection placenames!`);
      return [];
    }
    return entry.refs || [];
  }

  // Helper method to check if a folder exists
  async checkFolderExists(folderPath) {
    if (!folderPath) return false;

    try {
      console.log(`CollectionManager: Checking if folder exists: ${folderPath}`);
      const stat = await window.electronAPI.statPath(folderPath);
      return stat && stat.isDirectory === true;
    } catch (error) {
      console.error('Error checking folder exists in CollectionManager:', error);
      return false;
    }
  }
}

// Create singleton instance
export const collectionManager = new CollectionManager();
