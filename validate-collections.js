const fs = require('fs');
const path = require('path');

class CollectionValidator {
  constructor(collectionsPath, logFilePath = null) {
    this.collectionsPath = collectionsPath;
    this.logFilePath = logFilePath;
    this.errors = [];
    this.warnings = [];
    this.corePlacenames = null;
    this.allMergeKeys = {}; // Track usage across collections
    this.logBuffer = []; // Buffer for file logging
  }

  log(message, isError = false) {
    const prefix = isError ? '❌' : '⚠️ ';
    const fullMessage = `${prefix} ${message}`;
    
    if (isError) {
      this.errors.push(message);
      console.error(fullMessage);
    } else {
      this.warnings.push(message);
      console.warn(fullMessage);
    }
    
    // Add to log buffer for file writing
    this.logBuffer.push(fullMessage);
  }
  
  logInfo(message) {
    console.log(message);
    this.logBuffer.push(message);
  }
  
  writeLogFile() {
    if (this.logFilePath) {
      try {
        fs.writeFileSync(this.logFilePath, this.logBuffer.join('\n'), 'utf8');
        console.log(`\n📄 Log file written to: ${this.logFilePath}`);
      } catch (error) {
        console.error(`Failed to write log file: ${error.message}`);
      }
    }
  }

  loadJSON(filePath) {
    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (error) {
      this.log(`Failed to load ${filePath}: ${error.message}`, true);
      return null;
    }
  }

  fileExists(filePath) {
    return fs.existsSync(filePath);
  }

  // Extract placenames from lblTemplate
  extractPlaceNames(lblTemplate) {
    const placeNames = [];
    // Match anything in curly braces
    const matches = lblTemplate.matchAll(/\{([^}]+)\}/g);
    
    for (const match of matches) {
      const content = match[1];
      
      // Skip references (r#...)
      if (content.startsWith('r#')) {
        continue;
      }
      
      // Skip numbers (#...)
      if (content.startsWith('#')) {
        continue;
      }
      
      // If contains hashtag, part after hashtag is placeName
      if (content.includes('#')) {
        const parts = content.split('#');
        placeNames.push(parts[1]);
      } else {
        // Entire content is placeName
        placeNames.push(content);
      }
    }
    
    return placeNames;
  }

  // Validate lblTemplate format
  validateLblTemplate(lblTemplate, mergeKey, collectionName) {
    const matches = lblTemplate.matchAll(/\{([^}]+)\}/g);
    
    for (const match of matches) {
      const content = match[1];
      
      // Check for reference pattern
      if (content.startsWith('r#')) {
        const refPart = content.substring(2);
        const refPattern = /^([A-Z1-4][A-Z]{2} )?\d+([\d.\-\u2013; ]*)$/;
        if (!refPattern.test(refPart)) {
          this.log(`[${collectionName}] mergekeys.json: Invalid reference format in lblTemplate "${lblTemplate}" for key "${mergeKey}": ${content}`, true);
        }
      }
      // Check for number pattern
      else if (content.startsWith('#')) {
        const numPart = content.substring(1);
        const numPattern = /^\d+([\d.,]*)?$/;
        if (!numPattern.test(numPart)) {
          this.log(`[${collectionName}] mergekeys.json: Invalid number format in lblTemplate "${lblTemplate}" for key "${mergeKey}": ${content}`, true);
        }
      }
    }
  }

  // Validate map-defs.json
  validateMapDefs(collectionName, collectionPath, mapDefs, mergeKeys) {
    this.logInfo(`\n  Validating map-defs.json...`);
    const enFolder = path.join(collectionPath, '@en');
    const usedMergeKeys = new Set();

    for (const [mapName, mapDef] of Object.entries(mapDefs)) {
      // Check mapTypes
      if (!mapDef.mapTypes || mapDef.mapTypes.trim() === '') {
        this.log(`[${collectionName}] map-defs.json: Map "${mapName}" has empty mapTypes`, true);
      }

      // Check formats
      if (!mapDef.formats) {
        this.log(`[${collectionName}] map-defs.json: Map "${mapName}" missing formats property`, true);
      } else {
        const formats = mapDef.formats.toLowerCase().split(',').map(f => f.trim());
        const validFormats = formats.every(f => f === 'idml' || f === 'mapx');
        if (!validFormats) {
          this.log(`[${collectionName}] map-defs.json: Map "${mapName}" has invalid formats "${mapDef.formats}". Must be "idml", "mapx", or "idml, mapx"`, true);
        }
      }

      // Check imgFilename exists
      if (mapDef.imgFilename) {
        const imgPath = path.join(enFolder, mapDef.imgFilename);
        if (!this.fileExists(imgPath)) {
          this.log(`[${collectionName}] map-defs.json: Map "${mapName}" references image "${mapDef.imgFilename}" which doesn't exist in @en folder`, true);
        }
      } else {
        this.log(`[${collectionName}] map-defs.json: Map "${mapName}" missing imgFilename`, true);
      }

      // Check labels
      if (mapDef.labels && Array.isArray(mapDef.labels)) {
        const type1Labels = mapDef.labels.filter(l => l.type === 1);
        const type3Labels = mapDef.labels.filter(l => l.type === 3);

        if (type1Labels.length > 1) {
          this.log(`[${collectionName}] map-defs.json: Map "${mapName}" has ${type1Labels.length} labels of type 1 (max 1 allowed)`, true);
        }

        if (type3Labels.length > 1) {
          this.log(`[${collectionName}] map-defs.json: Map "${mapName}" has ${type3Labels.length} labels of type 3 (max 1 allowed)`, true);
        }

        // Check for duplicate mergeKeys within the same map
        const mergeKeysInMap = new Map();
        for (let i = 0; i < mapDef.labels.length; i++) {
          const label = mapDef.labels[i];
          if (label.mergeKey) {
            if (mergeKeysInMap.has(label.mergeKey)) {
              this.log(`[${collectionName}] map-defs.json: Map "${mapName}" has duplicate mergeKey "${label.mergeKey}" (at label indices ${mergeKeysInMap.get(label.mergeKey)} and ${i})`, true);
            } else {
              mergeKeysInMap.set(label.mergeKey, i);
            }
          }
        }

        // Check each label's mergeKey exists
        for (const label of mapDef.labels) {
          if (label.mergeKey) {
            usedMergeKeys.add(label.mergeKey);
            if (mergeKeys && !mergeKeys[label.mergeKey]) {
              this.log(`[${collectionName}] map-defs.json: Map "${mapName}" label references mergeKey "${label.mergeKey}" which doesn't exist in mergekeys.json`, true);
            }
          }
        }
      }
    }

    return usedMergeKeys;
  }

  // Validate mergekeys.json
  validateMergeKeys(collectionName, mergeKeys, usedMergeKeys, placenames) {
    this.logInfo(`  Validating mergekeys.json...`);
    const usedPlaceNames = new Set();

    for (const [key, value] of Object.entries(mergeKeys)) {
      // Track for core-placenames validation
      if (!this.allMergeKeys[collectionName]) {
        this.allMergeKeys[collectionName] = new Set();
      }

      // Check if mergeKey is used in map-defs
      if (!usedMergeKeys.has(key)) {
        this.log(`[${collectionName}] mergekeys.json: Key "${key}" is not used by any label in map-defs.json`, false);
      }

      // Check lblTemplate
      if (!value.lblTemplate) {
        this.log(`[${collectionName}] mergekeys.json: Key "${key}" missing lblTemplate`, true);
        continue;
      }

      const simplePattern = /^\{[^#{\s]+\}$/;
      const isSimple = simplePattern.test(value.lblTemplate);

      // If not simple pattern, must have gloss and context
      if (!isSimple) {
        if (!value.gloss || !value.gloss.en) {
          this.log(`[${collectionName}] mergekeys.json: Key "${key}" has complex lblTemplate "${value.lblTemplate}" but missing English gloss`, true);
        }
        if (!value.context || !value.context.en) {
          this.log(`[${collectionName}] mergekeys.json: Key "${key}" has complex lblTemplate "${value.lblTemplate}" but missing English context`, true);
        }
      }

      // Validate lblTemplate format
      this.validateLblTemplate(value.lblTemplate, key, collectionName);

      // Extract and check placenames
      const placeNamesInTemplate = this.extractPlaceNames(value.lblTemplate);
      for (const placeName of placeNamesInTemplate) {
        usedPlaceNames.add(placeName);
        this.allMergeKeys[collectionName].add(placeName);

        // Check if placename exists in placenames.json or core-placenames.json
        const existsInLocal = placenames && placenames[placeName];
        const existsInCore = this.corePlacenames && this.corePlacenames[placeName];

        if (!existsInLocal && !existsInCore) {
          this.log(`[${collectionName}] mergekeys.json: Key "${key}" references placeName "${placeName}" which doesn't exist in placenames.json or core-placenames.json`, true);
        }
      }
    }

    return usedPlaceNames;
  }

  // Validate placenames.json
  validatePlaceNames(collectionName, placenames, usedPlaceNames) {
    if (!placenames) {
      this.logInfo(`  No placenames.json found (optional)`);
      return;
    }

    this.logInfo(`  Validating placenames.json...`);

    for (const placeName of Object.keys(placenames)) {
      if (!usedPlaceNames.has(placeName)) {
        this.log(`[${collectionName}] placenames.json: PlaceName "${placeName}" is not used in any mergekeys.json lblTemplate`, false);
      }
    }
  }

  // Validate a single collection
  validateCollection(collectionName) {
    const message = `\n📁 Validating collection: ${collectionName}`;
    this.logInfo(message);
    const collectionPath = path.join(this.collectionsPath, collectionName);

    // Load files
    const mapDefsPath = path.join(collectionPath, 'map-defs.json');
    const mergeKeysPath = path.join(collectionPath, 'mergekeys.json');
    const placeNamesPath = path.join(collectionPath, 'placenames.json');

    const mapDefs = this.loadJSON(mapDefsPath);
    const mergeKeys = this.loadJSON(mergeKeysPath);
    const placenames = this.fileExists(placeNamesPath) ? this.loadJSON(placeNamesPath) : null;

    if (!mapDefs || !mergeKeys) {
      this.log(`[${collectionName}] Missing required files (map-defs.json or mergekeys.json)`, true);
      return;
    }

    // Validate each file
    const usedMergeKeys = this.validateMapDefs(collectionName, collectionPath, mapDefs, mergeKeys);
    const usedPlaceNames = this.validateMergeKeys(collectionName, mergeKeys, usedMergeKeys, placenames);
    this.validatePlaceNames(collectionName, placenames, usedPlaceNames);
  }

  // Validate core-placenames.json
  validateCorePlaceNames() {
    this.logInfo(`\n📁 Validating core-placenames.json`);
    
    if (!this.corePlacenames) {
      this.log(`core-placenames.json not found or failed to load`, true);
      return;
    }

    // Collect all used placenames across all collections
    const allUsedPlaceNames = new Set();
    for (const collectionSet of Object.values(this.allMergeKeys)) {
      for (const placeName of collectionSet) {
        allUsedPlaceNames.add(placeName);
      }
    }

    // Check each placename in core-placenames
    for (const placeName of Object.keys(this.corePlacenames)) {
      if (!allUsedPlaceNames.has(placeName)) {
        this.log(`core-placenames.json: PlaceName "${placeName}" is not used in any collection's mergekeys.json`, false);
      }
    }
  }

  // Main validation
  validate() {
    this.logInfo('🔍 Starting validation of _LabelerCollections\n');
    this.logInfo('='.repeat(60));

    // Load core-placenames
    const corePlaceNamesPath = path.join(this.collectionsPath, 'core-placenames.json');
    this.corePlacenames = this.loadJSON(corePlaceNamesPath);

    // Get all collection folders
    const items = fs.readdirSync(this.collectionsPath, { withFileTypes: true });
    const collections = items
      .filter(item => item.isDirectory())
      .map(item => item.name);

    // Validate each collection
    for (const collection of collections) {
      this.validateCollection(collection);
    }

    // Validate core-placenames
    this.validateCorePlaceNames();

    // Summary
    this.logInfo('\n' + '='.repeat(60));
    this.logInfo('\n📊 VALIDATION SUMMARY\n');
    this.logInfo(`Total Errors: ${this.errors.length}`);
    this.logInfo(`Total Warnings: ${this.warnings.length}`);

    if (this.errors.length === 0 && this.warnings.length === 0) {
      this.logInfo('\n✅ All validations passed!');
      this.writeLogFile();
      return true;
    } else {
      if (this.errors.length > 0) {
        this.logInfo('\n❌ Validation failed with errors');
      } else {
        this.logInfo('\n✅ No errors, but warnings were found');
      }
      this.writeLogFile();
      return this.errors.length === 0;
    }
  }
}

// Run validation
const collectionsPath = path.join(__dirname, '_LabelerCollections');
const logFilePath = path.join(__dirname, 'validation-results.log');
const validator = new CollectionValidator(collectionsPath, logFilePath);
const success = validator.validate();

process.exit(success ? 0 : 1);
