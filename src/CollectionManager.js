import packageInfo from '../package.json';

const mergeKeysFile = "mergekeys.json";
const termListFile = "termlist.json";
const mapDefsFile = "map-defs.json";

export function getCollectionIdFromTemplate(templateName) {
  if (!templateName) return 'SMR'; // Default to SMR if no template
  const match = templateName.match(/^([a-z]{2,4})_/i);
  // Always uppercase the collection ID to match the COLLECTIONS object keys
  if (match) return match[1].toUpperCase();
  return 'SMR'; // Default to SMR if no pattern match
}  


// Function to determine collection ID and template name from rough template name
export function findCollectionIdAndTemplate(templateName) {
  if (!templateName) return ['SMR', '' ]; // Default to SMR if no template

  const match = templateName.match(/^([a-z]{2,4})_/i);
  // Always uppercase the collection ID to match the COLLECTIONS object keys
  if (match) return [match[1].toUpperCase(), templateName];

  // If no pattern match, search through all available collections
  if (collectionManager.isInitialized) {
    const allCollectionIds = collectionManager.getAllCollectionIds();
    console.log(`Searching for template "${templateName}" in ${allCollectionIds.length} collections:`, allCollectionIds);
    
    for (const collectionId of allCollectionIds) {
      // Only search in collections that are actually loaded
      if (!collectionManager.isCollectionLoaded(collectionId)) {
        console.log(`Skipping collection ${collectionId} - not loaded`);
        continue;
      }
      
      const mapDefs = collectionManager.getMapDefs(collectionId);
      console.log(`Checking collection ${collectionId} with ${Object.keys(mapDefs).length} templates`);
      
      // Check for exact match first
      if (mapDefs[templateName]) {
        console.log(`Found template "${templateName}" in collection ${collectionId}`);
        return [collectionId, templateName];
      }
      
      // Check for match with collection prefix
      const prefixedTemplateName = `${collectionId}_${templateName}`;
      if (mapDefs[prefixedTemplateName]) {
        console.log(`Found template "${templateName}" with prefix "${prefixedTemplateName}" in collection ${collectionId}`);
        return [collectionId, prefixedTemplateName];
      }
      
      // Check for case-insensitive match
      const normalizedMapDefs = collectionManager.collectionsData.get(collectionId)?.normalizedMapDefs;
      if (normalizedMapDefs && normalizedMapDefs[templateName.toLowerCase()]) {
        console.log(`Found template "${templateName}" (case-insensitive) in collection ${collectionId}`);
        return [collectionId, templateName];
      }
      
      // Check for case-insensitive match with collection prefix
      if (normalizedMapDefs && normalizedMapDefs[prefixedTemplateName.toLowerCase()]) {
        console.log(`Found template "${templateName}" (case-insensitive with prefix) in collection ${collectionId}`);
        return [collectionId, prefixedTemplateName];
      }
    }
    console.warn(`Template "${templateName}" not found in any collection, defaulting to SMR`);
  }

  return ['SMR', templateName]; // Default to SMR if no match found anywhere
}

class CollectionManager {
  constructor() {
    this.availableCollections = new Map(); // id -> collection config from collection.json
    this.collectionsData = new Map(); // id -> loaded JSON data (mergeKeys, termlist, mapDefs)
    this.appVersion = packageInfo.version; // from package.json 
    this.isInitialized = false;
    this.isLoading = false;
    this.loadError = null;
    this.coreTermlist = null;
  }

  // Helper functions for collections
  getAllCollectionIds() {
    return Array.from(this.availableCollections.keys());
  }

  getCollectionConfig(collectionId) {
    return this.availableCollections.get(collectionId?.toUpperCase());
  }

  getCollectionName(collectionId) {
    const normalizedId = (collectionId || '').toUpperCase();
    const config = this.availableCollections.get(normalizedId);
    return config ? config.name : normalizedId;
  }

  // Initialize by loading all collections
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
      this.isLoading = false;
      return;
    }

    try {
      // 1. Discover available collections
      const discoveredCollections = await this.discoverCollections(templateFolderPath);
      
      // 2. Filter by version compatibility and store available collections
      for (const config of discoveredCollections) {
        if (this.isVersionCompatible(config.minLabelerVersion)) {
          this.availableCollections.set(config.id, config);
        } else {
          console.warn(`Skipping collection "${config.name}" (requires version ${config.minLabelerVersion}, current: ${this.appVersion})`);
          alert(`Collection "${config.name}" requires app version ${config.minLabelerVersion} or higher. Current version is ${this.appVersion}. Please update the app to use this collection.`);
        }
      }

      // 3. Load core termlist (if it exists)
      try {
        this.coreTermlist = await window.electronAPI.loadFromJson(templateFolderPath, 'core-termlist.json');
        console.log('Core termlist loaded successfully:', Object.keys(this.coreTermlist).length, 'terms');
      } catch (error) {
        console.warn('Core termlist not found or failed to load:', error.message);
        this.coreTermlist = {};
      }

      // 4. Load all compatible collections
      const loadPromises = Array.from(this.availableCollections.keys()).map(id => 
        this.loadCollection(id).catch(error => {
          console.error(`Failed to load collection ${id}:`, error);
          return null; // Don't fail entire initialization
        })
      );

      await Promise.all(loadPromises);
      this.isInitialized = true;
      
      console.log(`Initialized ${this.availableCollections.size} collections successfully`);
    } catch (error) {
      this.loadError = error;
      console.error('Failed to initialize collections:', error);
    } finally {
      this.isLoading = false;
    }
  }

  // Load a specific collection
  async loadCollection(collectionId) {
    const config = this.availableCollections.get(collectionId);
    if (!config) {
      throw new Error(`Collection ${collectionId} not found in available collections`);
    }

    console.log(`Loading collection ${config.name}...`);

    try {
      // Load the three standard JSON files in parallel
      const [mergeKeys, termlist, mapDefs] = await Promise.all([
        window.electronAPI.loadFromJson(config.path, mergeKeysFile),
        window.electronAPI.loadFromJson(config.path, termListFile), 
        window.electronAPI.loadFromJson(config.path, mapDefsFile)
      ]);

      // Basic existence checks (detailed validation can be added later)
      if (!mergeKeys || Object.keys(mergeKeys).length === 0) {
        throw new Error(`Empty or missing merge keys in ${mergeKeysFile}`);
      }
      if (!mapDefs || Object.keys(mapDefs).length === 0) {
        throw new Error(`Empty or missing map definitions in ${mapDefsFile}`);
      }



      // termlist can be empty, just warn
      if (!termlist || Object.keys(termlist).length === 0) {
        console.warn(`Empty or missing term list in ${termListFile} for collection ${collectionId}`);
      }

      // Validate and clean up map definitions - remove duplicate merge keys and labels without merge keys
      for (const [templateName, mapDef] of Object.entries(mapDefs)) {
        if (mapDef.labels && Array.isArray(mapDef.labels)) {
          const seenMergeKeys = new Set();
          const validLabels = [];
          
          for (const label of mapDef.labels) {
            if (!label.mergeKey) {
              console.error(`Collection ${config.name}: Label without merge key found in template "${templateName}". Label dropped.`);
            } else if (seenMergeKeys.has(label.mergeKey)) {
              console.error(`Collection ${config.name}: Duplicate merge key "${label.mergeKey}" found in template "${templateName}". Duplicate label removed.`);
            } else {
              seenMergeKeys.add(label.mergeKey);
              validLabels.push(label);
            }
          }
          
          // Update the map definition with cleaned labels if any were dropped
          if (validLabels.length !== mapDef.labels.length) {
            const droppedCount = mapDef.labels.length - validLabels.length;
            mapDef.labels = validLabels;
            console.warn(`Collection ${config.name}: Removed ${droppedCount} invalid labels from template "${templateName}"`);
          }
        }
      }

      // Build normalized map defs for case-insensitive lookup
      const normalizedMapDefs = {};
      for (const key in mapDefs) {
        normalizedMapDefs[key.toLowerCase()] = key;
      }

      // Store the loaded data using the new Map structure
      this.collectionsData.set(collectionId, {
        isLoaded: true,
        config: config, // Store the collection.json config
        mergeKeys,
        termlist: termlist || {},
        mapDefs,
        normalizedMapDefs,
      });

      console.log(`Collection ${config.name} loaded: ${Object.keys(mapDefs).length} map definitions, ${Object.keys(mergeKeys).length} merge keys, ${Object.keys(termlist).length} terms`);
      
    } catch (error) {
      console.error(`Failed to load collection ${config.name}:`, error);
      // Store error info but don't throw
      this.collectionsData.set(collectionId, {
        isLoaded: false,
        config: config,
        loadError: error
      });
    }
  }

  // Synchronous methods to access collection data
  isCollectionLoaded(collectionId) {
    // Ensure uppercase collection ID for consistency
    const normalizedId = (collectionId || '').toUpperCase();
    const data = this.collectionsData.get(normalizedId);
    return data?.isLoaded || false;
  }

  getMergeKeys(collectionId) {
    // Ensure uppercase collection ID for consistency
    const normalizedId = (collectionId || '').toUpperCase();
    const data = this.collectionsData.get(normalizedId);
    return data?.mergeKeys || {};
  }

  getTermlist(collectionId) {
    // Ensure uppercase collection ID for consistency
    const normalizedId = (collectionId || '').toUpperCase();
    const data = this.collectionsData.get(normalizedId);
    return data?.termlist || {};
  }

  getMapDefs(collectionId) {
    // Ensure uppercase collection ID for consistency
    const normalizedId = (collectionId || '').toUpperCase();
    const data = this.collectionsData.get(normalizedId);
    return data?.mapDefs || {};
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

    const collection = this.collectionsData.get(collectionId);
    if (!collection?.isLoaded) {
      console.warn(
        `Collection ${collectionId} not loaded, can't get map definition for ${templateName}`
      );
      return null;
    }

    console.log('Collection is loaded:', collection.isLoaded);

    // Try direct lookup first
    if (collection.mapDefs[templateName]) {
      console.log('Found template with exact match');
      const result = { ...collection.mapDefs[templateName] };
      result.template = templateName;
      return this.enrichMapDefWithGlosses(result, collectionId);
    }

    // Try case-insensitive lookup
    const normalizedKey = collection.normalizedMapDefs[templateName.toLowerCase()];
    if (normalizedKey) {
      console.log('Found template with case-insensitive match:', normalizedKey);
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

  getTermEntry(termId, collectionId) {
    let termlist = this.getTermlist(collectionId);
    if (termlist[termId]) {
      return termlist[termId];
    }
    if (this.coreTermlist[termId]) {
      return this.coreTermlist[termId];
    }
    return null;
  }

  // MergeKeys and Termlist access methods with collection ID parameter
  getGloss(mergeKey, collectionId) {
    if (!mergeKey) { return ''; }
    const termId = this.getTermId(mergeKey, collectionId);
    if (!termId) {
      console.warn(`termId not found for mergeKey "${mergeKey}" in ${collectionId} collection`);
      return '';
    }
    const termEntry = this.getTermEntry(termId, collectionId);
    if (!termEntry) {
      console.warn(
        `term ID "${termId}" not found in ${collectionId} collection term list`,
        this.getTermlist(collectionId)
      );
      return '';
    }
    return termEntry.gloss || '';
  }

  getMapxKey(mergeKey, collectionId = 'SMR') {
    const mergeKeys = this.getMergeKeys(collectionId);
    const entry = mergeKeys[mergeKey];
    if (!entry) {
      console.error(`mergeKey "${mergeKey}" not found in ${collectionId} collection merge keys!`);
      return mergeKey;
    }
    return entry.mapxKey || mergeKey;
  }

  getTermId(mergeKey, collectionId = 'SMR') {
    if (!mergeKey) { return ''; }
    const mergeKeys = this.getMergeKeys(collectionId);
    const entry = mergeKeys[mergeKey];
    if (!entry) {
      console.warn(`mergeKey "${mergeKey}" not found in ${collectionId} collection merge keys`);
      return '';
    }
    return entry.termId || '';
  }

  getDefinition(mergeKey, collectionId = 'SMR') {
    const termId = this.getTermId(mergeKey, collectionId);
    if (!termId) {
      console.warn(`termId not found for mergeKey "${mergeKey}" in ${collectionId} collection`);
      return '';
    }
    const termEntry = this.getTermEntry(termId, collectionId);
    if (!termEntry) {
      console.warn(
        `term ID "${termId}" not found in ${collectionId} collection term list`,
        this.getTermlist(collectionId)
      );
      return '';
    }
    return termEntry.context || '';
  }

  getAltTermIds(mergeKey, collectionId = 'SMR') {
    const mergeKeys = this.getMergeKeys(collectionId);
    const entry = mergeKeys[mergeKey];
    if (!entry || !entry.altTermIds) {
      return '';
    }
    return entry.altTermIds;
  }

  getTransliteration(mergeKey, collectionId = 'SMR') {
    if (!mergeKey) { return ''; }
    const termId = this.getTermId(mergeKey, collectionId);
    if (!termId) {
      console.warn(`termId not found for mergeKey "${mergeKey}" in ${collectionId} collection`);
      return '';
    }
    const termEntry = this.getTermEntry(termId, collectionId);
    if (!termEntry) {
      console.warn(
        `term ID "${termId}" not found in ${collectionId} collection term list`,
        this.getTermlist(collectionId)
      );
      return '';
    }
    return termEntry.transliteration || '';
  }

  getRefs(mergeKey, collectionId = 'SMR') {
    const termId = this.getTermId(mergeKey, collectionId);
    if (!termId) {
      console.warn(`termId not found for mergeKey "${mergeKey}" in ${collectionId} collection`);
      return [];
    }
    const termEntry = this.getTermEntry(termId, collectionId);
    if (!termEntry) {
      console.warn(
        `term ID "${termId}" not found in ${collectionId} collection term list`,
        this.getTermlist(collectionId)
      );
      return [];
    }
    return termEntry.refs || [];
  }

  async discoverCollections(templateFolderPath) {
    try {
      const collections = await window.electronAPI.discoverCollections(templateFolderPath);
      console.log(`Discovered ${collections.length} collections:`, collections.map(c => c.name));
      return collections;
    } catch (error) {
      console.error('Failed to discover collections:', error);
      throw error;
    }
  }

  isVersionCompatible(requiredVersion) {
    if (!requiredVersion) return true;
    
    const parseVersion = (version) => version.split('.').map(num => parseInt(num, 10));
    const current = parseVersion(this.appVersion);
    const required = parseVersion(requiredVersion);
    
    for (let i = 0; i < Math.max(current.length, required.length); i++) {
      const currentPart = current[i] || 0;
      const requiredPart = required[i] || 0;
      
      if (currentPart < requiredPart) return false;
      if (currentPart > requiredPart) return true;
    }
    return true;
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

// Helper functions for external access
export function getAllCollectionIds() {
  return collectionManager.getAllCollectionIds();
}

export function getCollectionName(collectionId) {
  return collectionManager.getCollectionName(collectionId);
}
