// Collection mapping structure
export const COLLECTIONS = {
    SMR: {
        id: 'SMR',
        name: 'SIL Map Repository',
        placeNamesFile: 'SMR_PlaceNames&Refs.json',
        mapDefsFile: 'smr-map-defs.json',
        description: 'SIL Scripture Map Resources',
        defaultTemplate: 'SMR_005wbt - Gen10 Descendants Of Noah'
    },
    BFBS: {
        id: 'BFBS',
        name: 'BFBS Map Collection',
        placeNamesFile: 'BFBS_PlaceNames&Refs.json',
        mapDefsFile: 'bfbs-map-defs.json',
        description: 'British and Foreign Bible Society maps',
        defaultTemplate: 'BFBS_001 - Jerusalem in Jesus time'
    }
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
    return match ? match[1] : 'SMR'; // Default to SMR if no match
}

class CollectionManager {
    constructor() {
        this.collectionsData = {};
        this.isInitialized = false;
        this.isLoading = false;
        this.loadError = null;
    }

    // Initialize by loading all collections
    async initializeAllCollections() {
        if (this.isInitialized) return;
        if (this.isLoading) return;
        
        this.isLoading = true;
        this.loadError = null;
        
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
                    mapDefs: null
                };
            }
            
            const templatePath = 'C:/My Paratext 9 Projects/_MapLabelerTemplates';
            
            // Load placenames and map definitions in parallel
            const [placenames, mapDefs] = await Promise.all([
                window.electronAPI.loadFromJson(templatePath, collection.placeNamesFile),
                window.electronAPI.loadFromJson(templatePath, collection.mapDefsFile)
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
            for (const key in mapDefs) {
                normalizedMapDefs[key.toLowerCase()] = key; // Store original key for lookup
            }
            
            // Store the loaded data
            this.collectionsData[collectionId] = {
                isLoaded: true,
                placenames,
                mapDefs,
                normalizedMapDefs
            };
            
            console.log(`Collection ${collection.name} loaded successfully with ${Object.keys(placenames).length} placenames and ${Object.keys(mapDefs).length} map definitions`);
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
        return !!this.collectionsData[collectionId]?.isLoaded;
    }
    
    getPlacenames(collectionId) {
        return this.collectionsData[collectionId]?.placenames || {};
    }
    
    getMapDefs(collectionId) {
        return this.collectionsData[collectionId]?.mapDefs || {};
    }
    
    // Get map definition with case-insensitive lookup
    getMapDef(templateName, collectionId) {
        // Extract collection ID from template if not provided
        if (!collectionId && templateName) {
            collectionId = getCollectionIdFromTemplate(templateName);
        }
        
        collectionId = collectionId || 'SMR';
        
        if (!templateName) {
            return null;
        }
        
        const collection = this.collectionsData[collectionId];
        if (!collection?.isLoaded) {
            console.warn(`Collection ${collectionId} not loaded, can't get map definition for ${templateName}`);
            return null;
        }
        
        // Try direct lookup first
        if (collection.mapDefs[templateName]) {
            const result = { ...collection.mapDefs[templateName] };
            result.template = templateName;
            return this.enrichMapDefWithGlosses(result, collectionId);
        }
        
        // Try case-insensitive lookup
        const normalizedKey = collection.normalizedMapDefs[templateName.toLowerCase()];
        if (normalizedKey) {
            const result = { ...collection.mapDefs[normalizedKey] };
            result.template = templateName; // Use the requested template name
            return this.enrichMapDefWithGlosses(result, collectionId);
        }
        
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
            gloss: this.getGloss(label.mergeKey, collectionId)
        }));
        
        return mapDef;
    }
    
    // Placenames access methods with collection ID parameter
    getGloss(mergeKey, collectionId = 'SMR') {
        const placenames = this.getPlacenames(collectionId);
        const entry = placenames[mergeKey];
        if (!entry) {
            console.warn(`mergeKey "${mergeKey}" not found in ${collectionId} collection placenames`);
            return '';
        }
        return entry.gloss || '';
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
}

// Create singleton instance
export const collectionManager = new CollectionManager();
