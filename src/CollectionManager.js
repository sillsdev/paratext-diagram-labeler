import packageInfo from '../package.json';
import labelTemplateParser from './services/LabelTemplateParser';
import labelTagRulesService from './services/LabelTagRulesService';

const mergeKeysFile = "mergekeys.json";
const placeNamesFile = "placenames.json";
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
    this.collectionsData = new Map(); // id -> loaded JSON data (mergeKeys, placenames, mapDefs)
    this.appVersion = packageInfo.version; // from package.json 
    this.isInitialized = false;
    this.isLoading = false;
    this.loadError = null;
    this.corePlaceNames = null;
    this.templateParser = labelTemplateParser;
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
  async initializeAllCollections(templateFolderPath, projectFolder) {
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

      // 3. Load core placenames (if it exists)
      try {
        this.corePlaceNames = await window.electronAPI.loadFromJson(templateFolderPath, 'core-placenames.json');
        console.log('Core placenames loaded successfully:', Object.keys(this.corePlaceNames).length, 'place names');
      } catch (error) {
        console.warn('Core placenames not found or failed to load:', error.message);
        this.corePlaceNames = {};
      }

      // 4. Load all compatible collections
      const loadPromises = Array.from(this.availableCollections.keys()).map(id => 
        this.loadCollection(id, projectFolder).catch(error => {
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
  async loadCollection(collectionId, projectFolder) {
    const config = this.availableCollections.get(collectionId);
    if (!config) {
      throw new Error(`Collection ${collectionId} not found in available collections`);
    }

    console.log(`Loading collection ${config.name}...`);

    try {
      // Load the three standard JSON files in parallel
      const [mergeKeys, placenames, mapDefs] = await Promise.all([
        window.electronAPI.loadFromJson(config.path, mergeKeysFile),
        window.electronAPI.loadFromJson(config.path, placeNamesFile),
        window.electronAPI.loadFromJson(config.path, mapDefsFile)
      ]);

      // Basic existence checks (detailed validation can be added later)
      if (!mergeKeys || Object.keys(mergeKeys).length === 0) {
        throw new Error(`Empty or missing merge keys in ${mergeKeysFile}`);
      }
      if (!mapDefs || Object.keys(mapDefs).length === 0) {
        throw new Error(`Empty or missing map definitions in ${mapDefsFile}`);
      }

      // placenames can be empty, just warn
      if (!placenames || Object.keys(placenames).length === 0) {
        console.warn(`Empty or missing placenames in ${placeNamesFile} for collection ${collectionId}`);
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
        placenames: placenames || {},
        mapDefs,
        normalizedMapDefs,
      });

      console.log(`Collection ${config.name} loaded: ${Object.keys(mapDefs).length} map definitions, ${Object.keys(mergeKeys).length} merge keys, ${Object.keys(placenames || {}).length} place names`);
      
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

  getMergeKeyDefinition(mergeKey, collectionId) {
    const mergeKeys = this.getMergeKeys(collectionId);
    const entry = mergeKeys[mergeKey];
    return entry?.context || { en: '' };
  }

  getPlaceNames(collectionId) {
    // Ensure uppercase collection ID for consistency
    const normalizedId = (collectionId || '').toUpperCase();
    const data = this.collectionsData.get(normalizedId);
    return data?.placenames || {};
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

    mapDef.labels = mapDef.labels.map((label, idx) => {
      const lblTemplate = this.getLabelTemplate(label.mergeKey, collectionId);
      const placeNameIds = lblTemplate ? this.templateParser.getPlaceNameIds(lblTemplate) : [];
      const primaryPlaceNameId = placeNameIds.length > 0 ? placeNameIds[0] : null;
      
      return {
        ...label,
        idx,
        lblTemplate,
        gloss: primaryPlaceNameId ? this.getGloss(primaryPlaceNameId, collectionId) : '',
      };
    });

    return mapDef;
  }

  getPlaceName(placeNameId, collectionId) {
    if (!placeNameId) return null;
    
    const placenames = this.getPlaceNames(collectionId);
    if (placenames[placeNameId]) {
      return placenames[placeNameId];
    }
    if (this.corePlaceNames && this.corePlaceNames[placeNameId]) {
      return this.corePlaceNames[placeNameId];
    }
    return null;
  }

  // Get all terms for a specific place name
  getTermsForPlace(placeNameId, collectionId) {
    const placeName = this.getPlaceName(placeNameId, collectionId);
    if (!placeName || !placeName.terms) {
      return [];
    }
    return placeName.terms;
  }

  // Get label template from mergeKey
  getLabelTemplate(mergeKey, collectionId = 'SMR') {
    if (!mergeKey) return '';
    
    const mergeKeys = this.getMergeKeys(collectionId);
    const entry = mergeKeys[mergeKey];
    if (!entry) {
      console.warn(`mergeKey "${mergeKey}" not found in ${collectionId} collection merge keys`);
      return '';
    }
    return entry.lblTemplate || '';
  }

  // Resolve template to get all placeNameIds and references
  async resolveTemplate(lblTemplate, collectionId, termRenderings = {}, projectFolder = null) {
    if (!lblTemplate) return { placeNameIds: [], references: [], literalText: '', hasMultiplePlaceNames: false };
    
    const parsed = this.templateParser.parseTemplate(lblTemplate);
    if (parsed.fields.some(f => f.type === 'reference' || f.type === 'number')) {
      console.log(`[resolveTemplate] Template: "${lblTemplate}", fields:`, parsed.fields);
    }
    
    // Resolve the template by replacing each field with its resolved text
    let resolvedText = lblTemplate;
    
    // Process each field in reverse order to avoid index shifting
    const sortedFields = [...parsed.fields].sort((a, b) => b.start - a.start);
    
    for (const field of sortedFields) {
      if (field.type === 'reference') {
        // Scripture reference - convert to vernacular format
        if (projectFolder && window.electronAPI?.vernRef) {
          try {
            const vernacular = await window.electronAPI.vernRef(projectFolder, field.reference);
            console.log(`[resolveTemplate] Reference "${field.reference}" -> "${vernacular}"`);
            resolvedText = resolvedText.substring(0, field.start) + 
                          vernacular + 
                          resolvedText.substring(field.end);
          } catch (error) {
            console.error(`Error converting reference ${field.reference}:`, error);
          }
        } else {
          console.warn(`[resolveTemplate] Cannot process reference - projectFolder: ${projectFolder}, vernRef available: ${!!window.electronAPI?.vernRef}`);
        }
        continue;
      }
      
      if (field.type === 'number') {
        // Number field - convert digits based on project settings
        if (projectFolder && window.electronAPI?.convertDigits) {
          try {
            const numberStr = field.number;
            // Convert digits - backend will load settings and use settings.fp
            const converted = await window.electronAPI.convertDigits(projectFolder, numberStr);
            resolvedText = resolvedText.substring(0, field.start) + 
                          converted + 
                          resolvedText.substring(field.end);
          } catch (error) {
            console.error(`Error converting number ${field.number}:`, error);
          }
        }
        continue;
      }
      
      if (field.type === 'placename' || field.type === 'tagged-placename') {
        const placeNameId = field.placeNameId;
        const tag = field.tag || null;
        
        const placeName = this.getPlaceName(placeNameId, collectionId);
        if (placeName && placeName.terms && placeName.terms.length > 0) {
          // Collect unique rendering patterns from ALL terms
          const allPatterns = [];
          let hasExplicitMapForm = false;
          let explicitMapForm = '';
          
          for (const term of placeName.terms) {
            const termData = termRenderings[term.termId];
            if (termData && termData.renderings) {
              let renderingsStr = termData.renderings || '';
              // Strip all asterisks (wildcards)
              renderingsStr = renderingsStr.replace(/\*/g, '');
              
              // Check for explicit map form (e.g., (@misradesh) or (map: misradesh))
              const mapFormMatch = renderingsStr.match(/\((?:@|map:\s*)([^)]+)\)/);
              if (mapFormMatch) {
                hasExplicitMapForm = true;
                explicitMapForm = mapFormMatch[1];
                break; // Explicit map form takes precedence
              } else {
                // Split into separate rendering items
                const items = renderingsStr.replace(/\|\|/g, '\n').split(/(\r?\n)/);
                // Process each item: remove parentheses and their contents, trim space
                const processedItems = items
                  .map(item => item.replace(/\([^)]*\)/g, '').trim())
                  .filter(item => item.length > 0);
                allPatterns.push(...processedItems);
              }
            }
          }
          
          let replacementText = '';
          
          if (hasExplicitMapForm) {
            // Use explicit map form
            replacementText = explicitMapForm;
            
            // Apply tag if present
            if (tag && labelTagRulesService.isInitialized) {
              replacementText = labelTagRulesService.applyTag(tag, replacementText);
            }
          } else if (allPatterns.length > 0) {
            // Get unique patterns (case-sensitive to preserve original)
            const uniquePatterns = [...new Set(allPatterns)];
            
            // Apply tag to each pattern if present
            if (tag && labelTagRulesService.isInitialized) {
              console.log(`[resolveTemplate] Applying tag "${tag}" to patterns:`, uniquePatterns);
              const taggedPatterns = uniquePatterns.map(pattern => 
                labelTagRulesService.applyTag(tag, pattern)
              );
              replacementText = taggedPatterns.join('——');
              console.log(`[resolveTemplate] Tagged result: "${replacementText}"`);
            } else {
              console.log(`[resolveTemplate] No tag or service not initialized. tag="${tag}", isInitialized=${labelTagRulesService.isInitialized}`);
              // Join with double em-dash without tag
              replacementText = uniquePatterns.join('——');
            }
          }
          
          // Replace the field in the template with the resolved text
          if (replacementText) {
            resolvedText = resolvedText.substring(0, field.start) + 
                          replacementText + 
                          resolvedText.substring(field.end);
          }
        }
      }
    }
    
    return {
      placeNameIds: parsed.placeNameIds,
      references: parsed.references,
      hasMultiplePlaceNames: parsed.hasMultiplePlaceNames,
      literalText: resolvedText === lblTemplate ? '' : resolvedText
    };
  }

  // Get gloss for a placeNameId
  getGloss(placeNameId, collectionId) {
    if (!placeNameId) return '';
    
    const placeName = this.getPlaceName(placeNameId, collectionId);
    if (!placeName) {
      console.warn(`placeNameId "${placeNameId}" not found in ${collectionId} collection`);
      return '';
    }
    return placeName.gloss || '';
  }

  // Get gloss for a mergeKey with priority: mergekeys.gloss > placenames.gloss > core-placenames.gloss
  getGlossForMergeKey(mergeKey, collectionId) {
    if (!mergeKey) return { en: '' };
    
    // Priority 1: Check mergekeys.json for gloss override
    const mergeKeys = this.getMergeKeys(collectionId);
    const entry = mergeKeys[mergeKey];
    if (entry && entry.gloss) {
      return entry.gloss;
    }
    
    // Priority 2-3: Get gloss from placenames (collection-specific) or core-placenames
    const lblTemplate = entry ? entry.lblTemplate : '';
    if (lblTemplate) {
      const parsed = this.templateParser.parseTemplate(lblTemplate);
      const placeNameIds = parsed.placeNameIds || [];
      if (placeNameIds.length > 0) {
        const firstPlaceNameId = placeNameIds[0];
        const placeName = this.getPlaceName(firstPlaceNameId, collectionId);
        if (placeName && placeName.gloss) {
          return placeName.gloss;
        }
      }
    }
    
    // Fallback: return mergeKey as English gloss
    return { en: mergeKey };
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

  // Get definition (context) for a placeNameId
  getDefinition(placeNameId, collectionId = 'SMR') {
    if (!placeNameId) return { en: '' };
    
    const placeName = this.getPlaceName(placeNameId, collectionId);
    if (!placeName) {
      console.warn(`placeNameId "${placeNameId}" not found in ${collectionId} collection`);
      return { en: '' };
    }
    return placeName.context || { en: '' };
  }

  // Get alternative term IDs for a placeNameId
  getAltTermIds(placeNameId, collectionId = 'SMR') {
    const placeName = this.getPlaceName(placeNameId, collectionId);
    if (!placeName || !placeName.altTermIds) {
      return '';
    }
    return placeName.altTermIds;
  }

  // Get transliteration for a specific term within a placeName
  getTransliteration(placeNameId, collectionId = 'SMR') {
    if (!placeNameId) return '';
    
    const terms = this.getTermsForPlace(placeNameId, collectionId);
    if (!terms || terms.length === 0) {
      return '';
    }
    // Return transliteration from first term
    return terms[0].transliteration || '';
  }

  // Get all references for a placeNameId (merged from all terms)
  getRefs(placeNameId, collectionId = 'SMR') {
    if (!placeNameId) return [];
    
    const terms = this.getTermsForPlace(placeNameId, collectionId);
    if (!terms || terms.length === 0) {
      return [];
    }
    
    // Merge all refs from all terms (already sorted: NT first, then OT)
    const allRefs = [];
    for (const term of terms) {
      if (term.refs && Array.isArray(term.refs)) {
        allRefs.push(...term.refs);
      }
    }
    return allRefs;
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
