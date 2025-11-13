import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import './MainApp.css';
import BottomPane from './BottomPane.js';
import uiStr from './data/ui-strings.json';
import { MAP_VIEW, TABLE_VIEW, USFM_VIEW } from './constants.js';
import { collectionManager, getCollectionIdFromTemplate, findCollectionIdAndTemplate } from './CollectionManager';
import { getMapDef } from './MapData';
import { inLang, getStatus, getMapForm, isLocationVisible } from './Utils.js';
import MapPane from './MapPane.js';
import TableView from './TableView.js';
import DetailsPane from './DetailsPane.js';
import SettingsModal from './SettingsModal.js';
import TemplateBrowser from './TemplateBrowser.js';
// import { useInitialization, InitializationProvider } from './InitializationProvider';
import { settingsService } from './services/SettingsService';
import { autocorrectService } from './services/AutocorrectService';

const electronAPI = window.electronAPI;

// This section is now handled by the SettingsService
// The following lines are no longer needed as we're using settingsService
// to manage app settings.

// Define an empty initial map state to be used until the async load completes
const emptyInitialMap = {
  template: '',
  mapView: false,
  imgFilename: '',
  width: 1000,
  height: 1000,
  labels: [],
};
// console.log('Creating empty initial map state');

// return a list of all refs used by all the labels in the map definition
function getRefList(labels, collectionId = 'SMR') {
  const rl = Array.from(
    new Set(labels.map(label => collectionManager.getRefs(label.mergeKey, collectionId)).flat())
  ).sort();
  console.log(
    `getRefList(): ${rl.length} refs for ${labels.length} labels from collection ${collectionId}`
  );
  return rl;
}

async function mapFromUsfm(usfm, projectFolder) {
  // USFM now only contains the \fig field - it's used only to select the diagram
  // Extract template name from \fig field
  const figMatch = usfm.match(/\\fig [^\\]*src="([^\\]+)"[^\\]*\\fig\*/);
  
  if (!figMatch) {
    return {
      template: '',
      fig: '',
      mapView: false,
      imgFilename: '',
      width: 1000,
      height: 1000,
      labels: [],
    };
  }
  
  const templateName = figMatch[1]
    .replace(/\..*$/, '') // Remove file extension
    .trim()
    .replace(/\s*[@(].*/, ''); // Remove anything after @ or (

  let mapDefData;
  try {
    // Get map definition from collection manager
    mapDefData = await getMapDef(templateName);
    if (mapDefData) {
      mapDefData.mapView = true;
      mapDefData.template = templateName;
    } else {
      throw new Error('Map definition not found');
    }
  } catch (e) {
    console.error('Error loading map definition:', e);
    mapDefData = {
      template: templateName,
      fig: figMatch[0],
      mapView: false,
      imgFilename: '',
      width: 1000,
      height: 1000,
      labels: [],
    };
  }

  mapDefData.fig = figMatch[0];
  
  // Try to load labels from .idml.txt file if it exists
  try {
    const result = await window.electronAPI.loadLabelsFromIdmlTxt(projectFolder, templateName);
    if (result.success && result.labels) {
      console.log('Loaded labels from .idml.txt file:', result.labels);
      // Merge saved labels with map definition
      mapDefData.labels.forEach(label => {
        if (result.labels[label.mergeKey]) {
          label.vernLabel = result.labels[label.mergeKey];
        }
      });
    } else {
      console.log('No saved .idml.txt file found, using default labels from term renderings');
    }
  } catch (error) {
    console.log('Could not load .idml.txt file, using default labels:', error);
  }
  
  console.log('Parsed map definition:', mapDefData);
  return mapDefData;
}

function usfmFromMap(map, lang) {
  console.log('Converting map to USFM (only \\fig field):', map);
  // Only return the \fig...\fig* field, not the full USFM with labels
  // Labels are now stored in .idml.txt files
  let usfm = '';
  if (map.fig && !/^\\fig/.test(map.fig)) {
    usfm = `\\fig ${map.fig}\\fig*`;
  } else if (map.fig) {
    usfm = map.fig;
  }
  return usfm;
}

function MainApp({ settings, templateFolder, onExit, termRenderings, setTermRenderings }) {
  //   console.log('MainApp initialized with templateFolder prop:', templateFolder);

  const [isInitialized, setIsInitialized] = useState(false);
  const projectFolder = settings?.projectFolder;
  const [lang, setLang] = useState(() => {
    // First check settings, then default to 'en'
    return settings?.language || 'en';
  });
  const [mapDef, setMapDef] = useState(emptyInitialMap);
  const [locations, setLocations] = useState([]);
  const [selLocation, setSelLocation] = useState(0);
  const [mapWidth, setMapWidth] = useState(70);
  const [topHeight, setTopHeight] = useState(80);
  const [renderings, setRenderings] = useState('');
  const [isApproved, setIsApproved] = useState(false);
  const [mapPaneView, setMapPaneView] = useState(MAP_VIEW); // Default to MAP_VIEW, will be updated after loading
  const [labelScale, setLabelScale] = useState(() => {
    const saved = localStorage.getItem('labelScale'); // Persist labelScale in localStorage
    return saved ? parseFloat(saved) : 1;
  });
  const [labelOpacity, setLabelOpacity] = useState(() => {
    const saved = localStorage.getItem('labelOpacity'); // Persist labelOpacity in localStorage
    return saved ? parseFloat(saved) : 85;
  });
  const [showFrac, setShowFrac] = useState(() => {
    const saved = localStorage.getItem('showFrac'); // Persist showFrac in localStorage
    return saved === 'true';
  });
  const [templatePaths, setTemplatePaths] = useState(() => {
    const saved = localStorage.getItem('templatePaths'); // Persist templatePaths in localStorage
    return saved ? JSON.parse(saved) : [];
  });
  const [mapxPath, setMapxPath] = useState(''); // Current template's MAPX file path
  const [idmlPath, setIdmlPath] = useState(''); // Current template's IDML file path
  const [showSettings, setShowSettings] = useState(false);
  const [selectedVariant, setSelectedVariant] = useState(0); // 0 means no variants, 1+ for actual variants
  const [resetZoomFlag, setResetZoomFlag] = useState(false); // For controlling Leaflet map
  const isDraggingVertical = useRef(false);
  const isDraggingHorizontal = useRef(false);
  const vernacularInputRef = useRef(null);
  const renderingsTextareaRef = useRef();
  const handleBrowseMapTemplateRef = useRef();
  const [extractedVerses, setExtractedVerses] = useState({});
  // const [termRenderings, setTermRenderings] = useState(); 
  // const [termRenderingsLoading, setTermRenderingsLoading] = useState(false); // Guard against multiple loads
  
  // Track unsaved changes and saved state for .idml.txt files
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [savedLabels, setSavedLabels] = useState({}); // Store the last saved state to allow reverting

  // Template Browser state
  const [showTemplateBrowser, setShowTemplateBrowser] = useState(false);
  const [templateFilters, setTemplateFilters] = useState({
    format: 'any',
    collection: 'all',
    colorMode: 'any',
    texture: 'any',
    saved: 'all'
  });
  const [templateGroup, setTemplateGroup] = useState(null); // Array of templates in current group
  const [templateGroupIndex, setTemplateGroupIndex] = useState(-1); // -1 means no group navigation

  // Persist labelScale to localStorage
  useEffect(() => {
    localStorage.setItem('labelScale', labelScale.toString());
  }, [labelScale]);

  // Persist labelOpacity to localStorage
  useEffect(() => {
    localStorage.setItem('labelOpacity', labelOpacity.toString());
  }, [labelOpacity]);

  // Persist showFrac to localStorage
  useEffect(() => {
    localStorage.setItem('showFrac', showFrac.toString());
  }, [showFrac]);

  // Persist templatePaths to localStorage
  useEffect(() => {
    localStorage.setItem('templatePaths', JSON.stringify(templatePaths));
  }, [templatePaths]);

  // Update mapxPath when template changes or templatePaths change
  useEffect(() => {
    const findMapxPath = async () => {
      if (!mapDef.template || templatePaths.length === 0) {
        setMapxPath('');
        return;
      }

      // Try to find MAPX file with different naming conventions
      const templateName = mapDef.template;
      const mapxFilenames = [];
      
      // First try with the full template name (with collection prefix)
      mapxFilenames.push(`${templateName}.mapx`);
      
      // Then try without collection prefix (extract part after underscore)
      const underscoreIndex = templateName.indexOf('_');
      if (underscoreIndex !== -1 && underscoreIndex < templateName.length - 1) {
        const templateWithoutPrefix = templateName.substring(underscoreIndex + 1);
        mapxFilenames.push(`${templateWithoutPrefix}.mapx`);
      }
      
      for (const folderPath of templatePaths) {
        for (const mapxFilename of mapxFilenames) {
          try {
            const fullPath = electronAPI ? await electronAPI.path.join(folderPath, mapxFilename) : '';
            const exists = electronAPI ? await electronAPI.fileExists(fullPath) : false;
            
            if (exists) {
              console.log(`Found MAPX file: ${fullPath}`);
              setMapxPath(fullPath);
              return;
            }
          } catch (error) {
            console.log(`Error checking MAPX file ${mapxFilename} in ${folderPath}:`, error);
          }
        }
      }
      
      // No MAPX file found with any naming convention
      console.log(`No MAPX file found for template: ${templateName}. Tried: ${mapxFilenames.join(', ')}`);
      setMapxPath('');
    };

    findMapxPath();
  }, [mapDef.template, templatePaths]);

  // Update idmlPath when template changes or templatePaths change
  useEffect(() => {
    const findIdmlPath = async () => {
      if (!mapDef.template || templatePaths.length === 0) {
        setIdmlPath('');
        return;
      }

      // Try to find IDML file with different naming conventions
      const templateName = mapDef.template;
      const idmlFilenames = [];
      
      // First try with the full template name (with collection prefix)
      idmlFilenames.push(`${templateName}.idml`);
      
      // Then try without collection prefix (extract part after underscore)
      const underscoreIndex = templateName.indexOf('_');
      if (underscoreIndex !== -1 && underscoreIndex < templateName.length - 1) {
        const templateWithoutPrefix = templateName.substring(underscoreIndex + 1);
        idmlFilenames.push(`${templateWithoutPrefix}.idml`);
      }
      
      for (const folderPath of templatePaths) {
        for (const idmlFilename of idmlFilenames) {
          try {
            const fullPath = electronAPI ? await electronAPI.path.join(folderPath, idmlFilename) : '';
            const exists = electronAPI ? await electronAPI.fileExists(fullPath) : false;
            
            if (exists) {
              console.log(`Found IDML file: ${fullPath}`);
              setIdmlPath(fullPath);
              return;
            }
          } catch (error) {
            console.log(`Error checking IDML file ${idmlFilename} in ${folderPath}:`, error);
          }
        }
      }
      
      // No IDML file found with any naming convention
      console.log(`No IDML file found for template: ${templateName}. Tried: ${idmlFilenames.join(', ')}`);
      setIdmlPath('');
    };

    findIdmlPath();
  }, [mapDef.template, templatePaths]);

  useEffect(() => {
    // Load collections on mount, and then never again.

    const initializeColls = async () => {
      // Load collections using the provided settings
      console.log('Loading map collections...');

      // Make sure we have the required settings
      if (!settings || !settings.templateFolder || !projectFolder) {
        console.error('Template or project folder setting is missing', settings);
        throw new Error('Template or project folder setting is missing');
      }
      try {
        // Use the template folder prop instead of settings to ensure consistency
        await collectionManager.initializeAllCollections(templateFolder, projectFolder);
        setIsInitialized(true);
      } catch (collectionError) {
        console.error('Failed to initialize map collections:', collectionError);
      }
    };
    initializeColls();
  }, [settings, templateFolder, projectFolder]);

  // Set initial locations
  useEffect(() => {
    if (!electronAPI || !projectFolder || !isInitialized || !mapDef || !mapDef.labels?.length)
      return;

    try {
      // Update existing locations with termRenderings, preserving vernLabel values
      setLocations(prevLocations => {
        if (prevLocations.length === 0) {
          // If no previous locations, initialize from mapDef
          console.log('No previous locations found, initializing from mapDef');
          return mapDef.labels.map(loc => {
            if (!loc.vernLabel) {
              const altTermIds = collectionManager.getAltTermIds(loc.mergeKey, getCollectionIdFromTemplate(mapDef.template));
              loc.vernLabel = getMapForm(termRenderings, loc.termId, altTermIds);
            }
            const status = getStatus(
              termRenderings,
              loc.termId,
              loc.vernLabel,
              collectionManager.getRefs(
                loc.mergeKey,
                getCollectionIdFromTemplate(mapDef.template)
              ),
              extractedVerses
            );
            return { ...loc, status };
          });
        } else {
          // Update existing locations, preserving vernLabel values
          return prevLocations.map(loc => {
            const status = getStatus(
              termRenderings,
              loc.termId,
              loc.vernLabel || '', // Use existing vernLabel or empty string
              collectionManager.getRefs(
                loc.mergeKey,
                getCollectionIdFromTemplate(mapDef.template)
              ),
              extractedVerses
            );
            return { ...loc, status };
          });
        }
      });
      // Only set selection to 0 if no valid selection exists
      if (
        mapDef.labels &&
        mapDef.labels.length > 0 &&
        (selLocation >= mapDef.labels.length || selLocation < 0)
      ) {
        setSelLocation(0); // Select first location only if current selection is invalid
      }
    } catch (e) {
      console.log(`Error updating locations:`, e);
    }

    
  }, [projectFolder, mapDef, isInitialized,  extractedVerses, selLocation, termRenderings]); 

  // setExtractedVerses when projectFolder or mapDef.labels change
  useEffect(() => {
    if (!projectFolder || !mapDef.labels?.length || !isInitialized) return;

    const collectionId = getCollectionIdFromTemplate(mapDef.template);
    const refs = getRefList(mapDef.labels, collectionId);
    if (!refs.length) {
      setExtractedVerses({});
      return;
    }

    electronAPI.getFilteredVerses(projectFolder, refs).then(verses => {
      console.log('[IPC] getFilteredVerses:', projectFolder, 'for refs:', refs.length);
      if (verses && !verses.error) {
        setExtractedVerses(verses);
        // console.log('[IPC] getFilteredVerses:', Object.keys(verses).length, 'for refs:', refs.length);
      } else {
        setExtractedVerses({});
        alert(inLang(uiStr.failedToRequestVerses, lang) + (verses && verses.error ? ' ' + verses.error : ''));
      }
    });
  }, [projectFolder, mapDef.labels, mapDef.template, isInitialized, lang]);

  // Load autocorrect file when project folder or initialization state changes
  useEffect(() => {
    if (projectFolder && isInitialized) {
      autocorrectService.loadAutocorrectFile(projectFolder);
    }
  }, [projectFolder, isInitialized]);

  // Update renderings and approval status when selected location or term renderings change
  useEffect(() => {
    if (!termRenderings || !locations.length || selLocation >= locations.length) return;

    const currentLocation = locations[selLocation];
    if (!currentLocation) return;

    const entry = termRenderings[currentLocation.termId];
    if (entry) {
      setRenderings(entry.renderings);
      setIsApproved(!entry.isGuessed);
    } else {
      setRenderings('');
      setIsApproved(false);
    }
  }, [selLocation, termRenderings, locations]);

  // Handler to set the selected location (e.g. Label clicked)
  const handleSelectLocation = useCallback(
    location => {
      console.log('Selected location:', location);
      if (!location) return;
      setSelLocation(location.idx);
      const entry = termRenderings[location.termId];
      if (entry) {
        setRenderings(entry.renderings);
        setIsApproved(!entry.isGuessed);
      } else {
        setRenderings('');
        setIsApproved(false);
        //console.warn(`No term renderings entry for termId: ${location.termId}`);
      }
    },
    [termRenderings, setRenderings, setIsApproved, setSelLocation]
  );

  // Handler to update label of selected location with new vernacular and status
  const handleUpdateVernacular = useCallback(
    (termId, newVernacular) => {
      // Create a copy of the current state to ensure we're using the latest data
      const currentTermRenderings = { ...termRenderings };

      setLocations(prevLocations =>
        prevLocations.map(loc => {
          if (loc.termId === termId) {
            const status = getStatus(
              currentTermRenderings,
              loc.termId,
              newVernacular,
              collectionManager.getRefs(loc.mergeKey, getCollectionIdFromTemplate(mapDef.template)),
              extractedVerses
            );
            return { ...loc, vernLabel: newVernacular, status };
          }
          return loc;
        })
      );
      
      // Mark as having unsaved changes
      setHasUnsavedChanges(true);
    },
    [termRenderings, extractedVerses, mapDef.template]
  ); // is just renderings enough here?

  // Handler to cycle forward or backward through locations
  const handleNextLocation = useCallback(
    fwd => {
      // Find all visible location indices
      const visibleIndices = locations
        .map((loc, idx) => ({ loc, idx }))
        .filter(({ loc }) => isLocationVisible(loc, selectedVariant))
        .map(({ idx }) => idx);

      if (visibleIndices.length === 0) return; // No visible locations

      const currentVisibleIndex = visibleIndices.indexOf(selLocation);
      let nextVisibleIndex;

      if (fwd) {
        nextVisibleIndex = (currentVisibleIndex + 1) % visibleIndices.length;
      } else {
        nextVisibleIndex =
          (currentVisibleIndex - 1 + visibleIndices.length) % visibleIndices.length;
      }

      const nextLocationIndex = visibleIndices[nextVisibleIndex];
      const nextLocation = locations[nextLocationIndex];
      setSelLocation(nextLocationIndex);
      handleSelectLocation(nextLocation);
    },
    [locations, selLocation, handleSelectLocation, selectedVariant]
  );

  // Handlers for resizing panes
  const handleVerticalDragStart = e => {
    e.preventDefault();
    console.log('Vertical drag start');
    isDraggingVertical.current = true;
    document.addEventListener('mousemove', handleVerticalDrag);
    document.addEventListener('mouseup', handleDragEnd);
  };
  const handleHorizontalDragStart = e => {
    e.preventDefault();
    console.log('Horizontal drag start');
    isDraggingHorizontal.current = true;
    document.addEventListener('mousemove', handleHorizontalDrag);
    document.addEventListener('mouseup', handleDragEnd);
  };
  const handleVerticalDrag = e => {
    if (!isDraggingVertical.current) return;
    console.log('Vertical dragging:', e.clientX);
    const container = document.querySelector('.top-section');
    if (!container) {
      console.error('Top section not found');
      return;
    }
    const containerRect = container.getBoundingClientRect();
    const newWidth = ((e.clientX - containerRect.left) / containerRect.width) * 100;
    setMapWidth(Math.max(20, Math.min(80, newWidth)));
  };
  const handleHorizontalDrag = e => {
    if (!isDraggingHorizontal.current) return;
    console.log('Horizontal dragging:', e.clientY);
    const container = document.querySelector('.app-container');
    if (!container) {
      console.error('App container not found');
      return;
    }
    const containerRect = container.getBoundingClientRect();
    const newHeight = ((e.clientY - containerRect.top) / containerRect.height) * 100;
    setTopHeight(Math.max(50, Math.min(90, newHeight)));
  };
  const handleDragEnd = () => {
    console.log('Drag ended');
    isDraggingVertical.current = false;
    isDraggingHorizontal.current = false;
    document.removeEventListener('mousemove', handleVerticalDrag);
    document.removeEventListener('mousemove', handleHorizontalDrag);
    document.removeEventListener('mouseup', handleDragEnd);
  };

  // Handler for change in renderings textarea
  const handleRenderingsChange = e => {
    const newRenderings = e.target.value;
    const termId = locations[selLocation].termId;

    // Update local state
    setRenderings(newRenderings);

    // Create a proper updated termRenderings object
    const updatedData = { ...termRenderings };

    // Create the entry if it doesn't exist
    if (!updatedData[termId]) {
      updatedData[termId] = { renderings: newRenderings, isGuessed: false };
    } else {
      updatedData[termId] = {
        ...updatedData[termId],
        renderings: newRenderings,
        isGuessed: false,
      };
    }

    // Update termRenderings state
    setTermRenderings(updatedData);

    // The renderings change might affect the status of the location indexed by selLocation
    const status = getStatus(
      updatedData,
      termId,
      locations[selLocation].vernLabel || '',
      collectionManager.getRefs(
        locations[selLocation].mergeKey,
        getCollectionIdFromTemplate(mapDef.template)
      ),
      extractedVerses
    );

    // Update the status of the affected location
    setLocations(prevLocations =>
      prevLocations.map(loc => {
        if (loc.termId === termId) {
          return { ...loc, status };
        }
        return loc;
      })
    );
  };

  // Handler for change in approved status.
  const handleApprovedChange = e => {
    const approved = e.target.checked;
    const termId = locations[selLocation].termId;

    // Update local state
    setIsApproved(approved);

    // Create a proper updated termRenderings object
    const updatedData = { ...termRenderings };

    // Create entry if it doesn't exist
    if (!updatedData[termId]) {
      updatedData[termId] = { renderings: '', isGuessed: !approved };
    } else {
      updatedData[termId] = {
        ...updatedData[termId],
        isGuessed: !approved,
      };
    }

    // Update termRenderings state
    setTermRenderings(updatedData);

    // Update the status of the affected location
    const status = getStatus(
      updatedData,
      termId,
      locations[selLocation].vernLabel || '',
      collectionManager.getRefs(
        locations[selLocation].mergeKey,
        getCollectionIdFromTemplate(mapDef.template)
      ),
      extractedVerses
    );
    setLocations(prevLocations =>
      prevLocations.map(loc => {
        if (loc.termId === termId) {
          return { ...loc, status };
        }
        return loc;
      })
    );
  };

  // Handler to save labels to .IDML.TXT file
  const handleSaveLabels = useCallback(async () => {
    try {
      // Build labels object: mergeKey -> vernLabel
      const labelsToSave = {};
      locations.forEach(loc => {
        if (loc.mergeKey && loc.vernLabel) {
          labelsToSave[loc.mergeKey] = loc.vernLabel;
        }
      });
      
      const result = await electronAPI.saveLabelsToIdmlTxt(
        projectFolder,
        mapDef.template,
        labelsToSave
      );
      
      if (result.success) {
        setSavedLabels({ ...labelsToSave });
        setHasUnsavedChanges(false);
        console.log('Labels saved successfully to .IDML.TXT file:', result.filePath);
      } else {
        console.error('Failed to save labels:', result.error);
        alert(inLang(uiStr.errorSavingLabels, lang) + ': ' + result.error);
      }
    } catch (error) {
      console.error('Error saving labels:', error);
      alert(inLang(uiStr.errorSavingLabels, lang) + ': ' + error.message);
    }
  }, [mapDef.template, locations, projectFolder, lang]);

  // Handler to revert labels to last saved state
  const handleRevertLabels = useCallback(() => {
    if (!hasUnsavedChanges) return;
    
    // Restore locations from saved labels
    const currentTermRenderings = { ...termRenderings };
    const restoredLocations = locations.map(loc => {
      const savedLabel = savedLabels[loc.mergeKey] || '';
      const status = getStatus(
        currentTermRenderings,
        loc.termId,
        savedLabel,
        collectionManager.getRefs(loc.mergeKey, getCollectionIdFromTemplate(mapDef.template)),
        extractedVerses
      );
      return { ...loc, vernLabel: savedLabel, status };
    });
    
    setLocations(restoredLocations);
    setHasUnsavedChanges(false);
    console.log('Labels reverted to last saved state');
    // Optional: Show message to user
    alert(inLang(uiStr.labelsReverted, lang));
  }, [hasUnsavedChanges, savedLabels, locations, termRenderings, extractedVerses, mapDef.template, lang]);

  // Helper function to prompt user about unsaved changes
  const promptUnsavedChanges = useCallback(async () => {
    if (!hasUnsavedChanges) return true; // No changes, proceed
    
    // Create a three-button custom dialog
    const choice = await new Promise(resolve => {
      const overlay = document.createElement('div');
      overlay.style.cssText = 'position:fixed;left:0;top:0;width:100vw;height:100vh;z-index:10000;background:rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;';
      
      const dialog = document.createElement('div');
      dialog.style.cssText = 'background:white;border-radius:10px;padding:24px;min-width:400px;box-shadow:0 4px 24px rgba(0,0,0,0.3);';
      
      const title = document.createElement('h3');
      title.textContent = inLang(uiStr.unsavedChanges, lang);
      title.style.marginTop = '0';
      
      const message = document.createElement('p');
      message.textContent = inLang(uiStr.unsavedChangesPrompt, lang);
      message.style.marginBottom = '20px';
      
      const buttonContainer = document.createElement('div');
      buttonContainer.style.cssText = 'display:flex;justify-content:flex-end;gap:8px;';
      
      const cancelBtn = document.createElement('button');
      cancelBtn.textContent = inLang(uiStr.cancel, lang);
      cancelBtn.style.cssText = 'padding:8px 16px;border-radius:4px;border:1px solid #ccc;background:#f5f5f5;cursor:pointer;';
      cancelBtn.onclick = () => { document.body.removeChild(overlay); resolve('cancel'); };
      
      const discardBtn = document.createElement('button');
      discardBtn.textContent = inLang(uiStr.discard, lang);
      discardBtn.style.cssText = 'padding:8px 16px;border-radius:4px;border:1px solid #ff9800;background:#fff3e0;cursor:pointer;';
      discardBtn.onclick = () => { document.body.removeChild(overlay); resolve('discard'); };
      
      const saveBtn = document.createElement('button');
      saveBtn.textContent = inLang(uiStr.save, lang);
      saveBtn.style.cssText = 'padding:8px 16px;border-radius:4px;border:1px solid #4caf50;background:#4caf50;color:white;cursor:pointer;';
      saveBtn.onclick = () => { document.body.removeChild(overlay); resolve('save'); };
      
      buttonContainer.appendChild(cancelBtn);
      buttonContainer.appendChild(discardBtn);
      buttonContainer.appendChild(saveBtn);
      
      dialog.appendChild(title);
      dialog.appendChild(message);
      dialog.appendChild(buttonContainer);
      overlay.appendChild(dialog);
      document.body.appendChild(overlay);
    });
    
    if (choice === 'cancel') {
      return false; // Cancel the action
    } else if (choice === 'save') {
      await handleSaveLabels(); // Save first
      return true; // Proceed
    } else {
      return true; // Discard and proceed
    }
  }, [hasUnsavedChanges, lang, handleSaveLabels]);

  // Wrapped exit handler to check for unsaved changes
  const handleExitWithPrompt = useCallback(async () => {
    const canProceed = await promptUnsavedChanges();
    if (canProceed) {
      onExit();
    }
  }, [promptUnsavedChanges, onExit]);

  // Handler for map image browse
  const handleBrowseMapTemplate = useCallback(async () => {
    // Check for unsaved changes before browsing
    const canProceed = await promptUnsavedChanges();
    if (!canProceed) return;
    
    // Open template browser instead of file picker
    setShowTemplateBrowser(true);
  }, [promptUnsavedChanges]);

  // Extract template loading logic into a reusable function
  const loadTemplate = useCallback(async (templateName, labels = {}, figFilename = null, isJpg = false, imgPath = null) => {
    try {
      // Get collection ID and exact template name
      const [collectionId, exactTemplateName] = findCollectionIdAndTemplate(templateName);
      
      // Try to get the map definition
      const foundTemplate = await getMapDef(exactTemplateName, collectionId);

      if (!foundTemplate) {
        console.error(
          'Template not found. Looking for:',
          exactTemplateName,
          'in collection:',
          collectionId
        );

        // Examine available templates for debugging
        const availableTemplates = Object.keys(collectionManager.getMapDefs(collectionId));
        console.log('Available templates in collection:', availableTemplates);

        alert(inLang(uiStr.noTemplate, lang) + ': ' + exactTemplateName);
        return;
      }
      
      // Determine the figure filename
      if (!figFilename) {
        figFilename = exactTemplateName + '.jpg'; // Default to .jpg
      }

      // Set mapDef and locations
      setMapDef({
        template: exactTemplateName,
        fig: '\\fig | src="' + figFilename + '" size="span" ref="-"\\fig*',
        mapView: true,
        imgFilename: isJpg && imgPath ? imgPath : foundTemplate.imgFilename,
        width: foundTemplate.width,
        height: foundTemplate.height,
        labels: foundTemplate.labels,
        variants: foundTemplate.variants, // Include variants if they exist
      });

      // Initialize selectedVariant based on whether variants exist
      setSelectedVariant(
        foundTemplate.variants && Object.keys(foundTemplate.variants).length > 0 ? 1 : 0
      );
      
      // Make a local copy to ensure we're using the latest state
      const currentTermRenderings = { ...termRenderings };

      const newLocations = foundTemplate.labels.map(loc => {
        const status = getStatus(
          currentTermRenderings,
          loc.termId,
          loc.vernLabel || '',
          collectionManager.getRefs(loc.mergeKey, getCollectionIdFromTemplate(mapDef.template)),
          extractedVerses
        );
        return { ...loc, vernLabel: loc.vernLabel || '', status };
      });
      
      // Load saved labels from .IDML.TXT file if no data merge file was loaded
      let savedIdmlLabels = {};
      if (Object.keys(labels).length === 0) {
        try {
          const result = await electronAPI.loadLabelsFromIdmlTxt(projectFolder, exactTemplateName);
          if (result.success && result.labels) {
            savedIdmlLabels = result.labels;
            console.log('Loaded saved labels from .IDML.TXT file:', savedIdmlLabels);
          }
        } catch (error) {
          console.error('Error loading .IDML.TXT file:', error);
        }
      }
      
      const initialLocations = newLocations.map(loc => {
        if (labels[loc.mergeKey]) {
          loc.vernLabel = labels[loc.mergeKey]; // Use label from data merge if available
        } else if (savedIdmlLabels[loc.mergeKey]) {
          loc.vernLabel = savedIdmlLabels[loc.mergeKey]; // Use saved label from .IDML.TXT file
        } else if (!loc.vernLabel) {
          const altTermIds = collectionManager.getAltTermIds(loc.mergeKey, getCollectionIdFromTemplate(mapDef.template));
          loc.vernLabel = getMapForm(currentTermRenderings, loc.termId, altTermIds);
        }

        const status = getStatus(
          currentTermRenderings,
          loc.termId,
          loc.vernLabel,
          collectionManager.getRefs(loc.mergeKey, getCollectionIdFromTemplate(mapDef.template)),
          extractedVerses
        );
        return { ...loc, status };
      });
      
      // Store the saved labels for revert functionality
      const finalSavedLabels = {};
      initialLocations.forEach(loc => {
        if (loc.mergeKey && loc.vernLabel) {
          finalSavedLabels[loc.mergeKey] = loc.vernLabel;
        }
      });
      setSavedLabels(finalSavedLabels);
      setHasUnsavedChanges(false);
      console.log('Initial locations:', initialLocations);
      setLocations(initialLocations);

      // Find first visible location for initial selection
      const firstVisibleIndex = initialLocations.findIndex(loc =>
        isLocationVisible(
          loc,
          foundTemplate.variants && Object.keys(foundTemplate.variants).length > 0 ? 1 : 0
        )
      );
      if (firstVisibleIndex !== -1) {
        handleSelectLocation(initialLocations[firstVisibleIndex]); // Auto-select first visible location
      }
      setMapPaneView(MAP_VIEW); // Map View
      setResetZoomFlag(true); // Reset zoom on new map
    } catch (e) {
      console.error('Error loading template:', e);
      alert(inLang(uiStr.errorLoadingTemplate, lang) + ': ' + e.message);
    }
  }, [
    setMapDef,
    setLocations,
    termRenderings,
    lang,
    handleSelectLocation,
    extractedVerses,
    projectFolder,
    mapDef.template,
    setSelectedVariant,
    setSavedLabels,
    setHasUnsavedChanges,
    setMapPaneView,
    setResetZoomFlag
  ]);

  // Store the function in a ref for stable reference
  useEffect(() => {
    handleBrowseMapTemplateRef.current = handleBrowseMapTemplate;
  }, [handleBrowseMapTemplate]);

  // Template browser selection handlers
  const handleSelectDiagram = useCallback(async (template, filters) => {
    console.log('Selected diagram:', template);
    setShowTemplateBrowser(false);
    setTemplateFilters(filters);
    setTemplateGroup(null);
    setTemplateGroupIndex(-1); // No group navigation
    
    // Load the selected template
    await loadTemplate(template.templateName);
  }, [loadTemplate]);

  const handleSelectGroup = useCallback(async (template, filters, group, index) => {
    console.log('Selected group:', template, 'at index:', index, 'of', group.length);
    setShowTemplateBrowser(false);
    setTemplateFilters(filters);
    setTemplateGroup(group);
    setTemplateGroupIndex(index);
    
    // Load the selected template
    await loadTemplate(template.templateName);
  }, [loadTemplate]);

  const handlePreviousTemplate = useCallback(async () => {
    if (!templateGroup || templateGroupIndex <= 0) return;
    
    // Check for unsaved changes
    const canProceed = await promptUnsavedChanges();
    if (!canProceed) return;
    
    const newIndex = templateGroupIndex - 1;
    const template = templateGroup[newIndex];
    setTemplateGroupIndex(newIndex);
    
    // Load the previous template
    await loadTemplate(template.templateName);
  }, [templateGroup, templateGroupIndex, promptUnsavedChanges, loadTemplate]);

  const handleNextTemplate = useCallback(async () => {
    if (!templateGroup || templateGroupIndex >= templateGroup.length - 1) return;
    
    // Check for unsaved changes
    const canProceed = await promptUnsavedChanges();
    if (!canProceed) return;
    
    const newIndex = templateGroupIndex + 1;
    const template = templateGroup[newIndex];
    setTemplateGroupIndex(newIndex);
    
    // Load the next template
    await loadTemplate(template.templateName);
  }, [templateGroup, templateGroupIndex, promptUnsavedChanges, loadTemplate]);

  // Initialize map from USFM once settings and collections are loaded
  useEffect(() => {
    if (!isInitialized) return; // Don't initialize map until collections are loaded
    const initializeMap = async () => {
      try {
        if (!settings.usfm) {
          await handleBrowseMapTemplateRef.current();
        } else {
          // console.log("Initializing map from USFM:", settings.usfm);
          const initialMap = await mapFromUsfm(settings.usfm, projectFolder);
          if (!initialMap.template) {
            console.log('No template specified in USFM, browsing for template instead.');  
            await handleBrowseMapTemplateRef.current();
            return;
          }
          console.log('Initial Map loaded (based on usfm):', initialMap);
          setMapDef(initialMap);

          // Initialize selectedVariant based on whether variants exist
          setSelectedVariant(initialMap.variants && Object.keys(initialMap.variants).length > 0 ? 1 : 0);
          setMapPaneView(initialMap.mapView ? MAP_VIEW : TABLE_VIEW);
          
          // Initialize locations with status information
          const currentTermRenderings = { ...termRenderings };
          const initialLocations = initialMap.labels.map(loc => {
            if (!loc.vernLabel) {
              const altTermIds = collectionManager.getAltTermIds(loc.mergeKey, getCollectionIdFromTemplate(initialMap.template));
              loc.vernLabel = getMapForm(currentTermRenderings, loc.termId, altTermIds);
            }
            const status = getStatus(
              currentTermRenderings,
              loc.termId,
              loc.vernLabel,
              collectionManager.getRefs(loc.mergeKey, getCollectionIdFromTemplate(initialMap.template)),
              extractedVerses
            );
            return { ...loc, status };
          });
          
          setLocations(initialLocations);
          
          // Set saved labels for revert functionality
          const finalSavedLabels = {};
          initialLocations.forEach(loc => {
            if (loc.mergeKey && loc.vernLabel) {
              finalSavedLabels[loc.mergeKey] = loc.vernLabel;
            }
          });
          setSavedLabels(finalSavedLabels);
          setHasUnsavedChanges(false);
          
          // Find first visible location for initial selection
          const firstVisibleIndex = initialLocations.findIndex(loc =>
            isLocationVisible(
              loc,
              initialMap.variants && Object.keys(initialMap.variants).length > 0 ? 1 : 0
            )
          );
          setSelLocation(firstVisibleIndex >= 0 ? firstVisibleIndex : 0);
        }
      } catch (error) {
        console.log('Unable to initialize map:', error);
        // browse for a map template if no map
        await handleBrowseMapTemplateRef.current();
      }
    };
    initializeMap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInitialized, settings.usfm, projectFolder]);

  // USFM View component (editable, uncontrolled)
  const usfmTextareaRef = useRef();
  const USFMView = React.memo(function USFMView({ usfmText }) {
    return (
      <textarea
        ref={usfmTextareaRef}
        style={{ width: '100%', height: '100%', minHeight: 300 }}
        defaultValue={usfmText}
        spellCheck={false}
      />
    );
  });

  // --- USFM state for editing ---
  const [usfmText, setUsfmText] = useState(() =>
    usfmFromMap({ ...mapDef, labels: locations }, lang)
  );

  // Only update USFM text when switching TO USFM view (not on every locations change)
  const prevMapPaneView = useRef();
  useEffect(() => {
    if (prevMapPaneView.current !== USFM_VIEW && mapPaneView === USFM_VIEW) {
      setUsfmText(usfmFromMap({ ...mapDef, labels: locations }, lang));
    }
    prevMapPaneView.current = mapPaneView;
  }, [mapPaneView, locations, mapDef, lang]);

  // --- USFM to map/locations sync ---
  // Helper to update map/locations from USFM text
  const updateMapFromUsfm = useCallback(async () => {
    if (!usfmTextareaRef.current) return;
    const text = usfmTextareaRef.current.value;
    try {
      const newMap = await mapFromUsfm(text);
      console.log('Parsed map from USFM:', newMap);
      // Re-init locations and selection      // Create a local copy of termRenderings to ensure we're using the latest state
      const currentTermRenderings = { ...termRenderings };

      const initialLocations = newMap.labels.map(loc => {
        if (!loc.vernLabel) {
          const altTermIds = collectionManager.getAltTermIds(loc.mergeKey, getCollectionIdFromTemplate(mapDef.template));
          loc.vernLabel = getMapForm(currentTermRenderings, loc.termId, altTermIds);
        }
        const status = getStatus(
          currentTermRenderings,
          loc.termId,
          loc.vernLabel,
          collectionManager.getRefs(loc.mergeKey, getCollectionIdFromTemplate(mapDef.template)),
          extractedVerses
        );
        return { ...loc, status };
      });
      console.log('Initial locations from USFM:', initialLocations);
      setSelLocation(0);
      setLocations(initialLocations);
      //  update map object      // Update map data in state
      setMapDef({
        ...mapDef,
        labels: newMap.labels,
        template: newMap.template,
        fig: newMap.fig,
        mapView: newMap.mapView,
        imgFilename: newMap.imgFilename,
        width: newMap.width,
        height: newMap.height,
      });
      setUsfmText(text); // keep USFM text in sync after parse

      return true; // Indicate success
    } catch (e) {
      console.error('Error parsing USFM:', e);
      alert(inLang(uiStr.invalidUsfm, lang));
      return false; // Indicate failure
    }
  }, [termRenderings, setLocations, setSelLocation, lang, mapDef, extractedVerses]);
  // Intercept view switch to update map if leaving USFM view
  const handleSwitchViewWithUsfm = useCallback(async () => {
    if (mapPaneView === USFM_VIEW) {
      await updateMapFromUsfm();
    }
    setMapPaneView(prev => {
      if (!mapDef.mapView) {
        // Only cycle between Table (1) and USFM (2)
        return prev === TABLE_VIEW ? USFM_VIEW : TABLE_VIEW;
      }
      // Cycle through Map (0), Table (1), USFM (2)
      return (prev + 1) % 3; // Maybe this can be simplified now that Switch View is only from USFM
    });
  }, [mapPaneView, updateMapFromUsfm, mapDef.mapView]);

  // Intercept OK button in DetailsPane
  //   const handleOkWithUsfm = useCallback(() => {
  //     if (mapPaneView === USFM_VIEW) {
  //       updateMapFromUsfm();
  //     }

  //     // Generate the current USFM from map state and save to settings
  //     const currentUsfm = usfmFromMap({ ...mapDef, labels: locations }, lang);
  //     settingsService.updateUsfm(currentUsfm);
  //     console.log('Saved USFM to settings');

  //     // Optionally: do other OK logic here
  //     alert("At this point, the USFM text would be saved to Paratext.");  // TODO:
  //   }, [mapPaneView, updateMapFromUsfm, mapDef, locations, lang]);

  // Add rendering from bottom pane selection
  const handleAddRendering = useCallback(
    text => {
      if (!locations[selLocation]) return;
      const termId = locations[selLocation].termId;
      let currentRenderings = renderings || '';
      let newRenderings = currentRenderings.trim()
        ? `${currentRenderings.trim()}\n${text.trim()}`
        : text.trim();
      setRenderings(newRenderings);
      const updatedData = { ...termRenderings };
      updatedData[termId] = {
        ...updatedData[termId],
        renderings: newRenderings,
        isGuessed: false,
      };
      setTermRenderings(updatedData);
      setIsApproved(true);
      setLocations(prevLocations =>
        prevLocations.map(loc => {
          if (loc.termId === termId) {
            const status = getStatus(
              updatedData,
              loc.termId,
              loc.vernLabel,
              collectionManager.getRefs(loc.mergeKey, getCollectionIdFromTemplate(mapDef.template)),
              extractedVerses
            );
            return { ...loc, status };
          }
          return loc;
        })
      );
      setTimeout(() => {
        if (renderingsTextareaRef.current) {
          renderingsTextareaRef.current.focus();
          console.log('Focus set on renderings textarea');
        }
      }, 0);
    },
    [renderings, selLocation, locations, termRenderings, extractedVerses, mapDef.template, setTermRenderings]
  );

  // Replace all renderings with selected text (from bottom pane) or create new rendering (from details pane)
  const handleReplaceRendering = useCallback(
    text => {
      if (!locations[selLocation]) return;
      const termId = locations[selLocation].termId;
      const newRenderings = text.trim();
      setRenderings(newRenderings);
      const updatedData = { ...termRenderings };
      updatedData[termId] = {
        ...updatedData[termId],
        renderings: newRenderings,
        isGuessed: false,
      };
      setTermRenderings(updatedData);
      setIsApproved(true);
      setLocations(prevLocations =>
        prevLocations.map(loc => {
          if (loc.termId === termId) {
            const vernLabel = newRenderings;
            const status = getStatus(
              updatedData,
              loc.termId,
              vernLabel,
              collectionManager.getRefs(loc.mergeKey, getCollectionIdFromTemplate(mapDef.template)),
              extractedVerses
            );
            return { ...loc, status, vernLabel };
          }
          return loc;
        })
      );
      setTimeout(() => {
        if (renderingsTextareaRef.current) {
          renderingsTextareaRef.current.focus();
          console.log('Focus set on renderings textarea');
        }
      }, 0);
    },
    [selLocation, locations, termRenderings, extractedVerses, mapDef.template, setTermRenderings]
  );

  // Reload extracted verses for all terms (after Paratext edits)
  const handleReloadExtractedVerses = useCallback(
    async (termId, mergeKey) => {
      if (!projectFolder || !isInitialized) return;

      console.log(
        `Reloading all extracted verses after editing term: ${termId}, mergeKey: ${mergeKey}`
      );

      // Capture focus state before reload to restore it afterwards
      const activeElement = document.activeElement;
      const focusInfo = {
        isVernacularActive: vernacularInputRef.current === activeElement,
        isRenderingsActive: renderingsTextareaRef.current === activeElement,
        cursorPos: activeElement?.selectionStart,
        scrollPos: activeElement?.scrollTop
      };

      // Get all refs for the entire map (not just the specific term)
      const collectionId = getCollectionIdFromTemplate(mapDef.template);
      const allRefs = getRefList(mapDef.labels, collectionId);

      if (!allRefs.length) return;

      try {
        const verses = await electronAPI.getFilteredVerses(projectFolder, allRefs);
        if (verses && !verses.error) {
          // Update extracted verses state - the useEffect will handle location status updates
          setExtractedVerses(verses);

          console.log(`Reloaded ${Object.keys(verses).length} verses for entire map`);
          
          // Force Electron window focus restoration to fix input handling after reload
          // This mimics the effect of Alt+Tab which restores input functionality
          if (window.electronAPI && window.electronAPI.restoreWindowFocus) {
            await window.electronAPI.restoreWindowFocus();
          } else {
            // Fallback: trigger blur/focus events to reset input state
            window.blur();
            setTimeout(() => window.focus(), 10);
          }
          
          // Restore focus and cursor position after React state update
          setTimeout(() => {
            if (focusInfo.isVernacularActive && vernacularInputRef.current) {
              vernacularInputRef.current.focus();
              if (typeof focusInfo.cursorPos === 'number') {
                vernacularInputRef.current.setSelectionRange(focusInfo.cursorPos, focusInfo.cursorPos);
              }
              if (typeof focusInfo.scrollPos === 'number') {
                vernacularInputRef.current.scrollTop = focusInfo.scrollPos;
              }
            } else if (focusInfo.isRenderingsActive && renderingsTextareaRef.current) {
              renderingsTextareaRef.current.focus();
              if (typeof focusInfo.cursorPos === 'number') {
                renderingsTextareaRef.current.setSelectionRange(focusInfo.cursorPos, focusInfo.cursorPos);
              }
              if (typeof focusInfo.scrollPos === 'number') {
                renderingsTextareaRef.current.scrollTop = focusInfo.scrollPos;
              }
            }
          }, 0);
          
        } else {
          console.warn('Failed to reload extracted verses:', verses?.error);
        }
      } catch (error) {
        console.error('Error reloading extracted verses:', error);
      }
    },
    [projectFolder, isInitialized, mapDef.template, mapDef.labels]
  );

  // const handleCreateRendering = useCallback(
  //   (text, isGuessed) => {
  //     if (!locations[selLocation]) return;
  //     const termId = locations[selLocation].termId;
  //     const newRenderings = text.trim();
  //     setRenderings(newRenderings);
  //     const updatedData = { ...termRenderings };
  //     updatedData[termId] = {
  //       ...updatedData[termId],
  //       renderings: newRenderings,
  //       isGuessed,
  //     };
  //     setTermRenderings(updatedData);
  //     setIsApproved(!isGuessed);
  //     setLocations(prevLocations =>
  //       prevLocations.map(loc => {
  //         if (loc.termId === termId) {
  //           const status = getStatus(
  //             updatedData,
  //             loc.termId,
  //             loc.vernLabel,
  //             collectionManager.getRefs(loc.mergeKey, getCollectionIdFromTemplate(mapDef.template)),
  //             extractedVerses
  //           );
  //           return { ...loc, status };
  //         }
  //         return loc;
  //       })
  //     );
  //     setTimeout(() => {
  //       if (renderingsTextareaRef.current) renderingsTextareaRef.current.focus();
  //     }, 0);
  //   },
  //   [selLocation, locations, termRenderings, extractedVerses, mapDef.template]
  // );

  // Add global PageUp/PageDown navigation for Map and Table views
  useEffect(() => {
    function handleGlobalKeyDown(e) {
      if (mapPaneView === USFM_VIEW) return; // Do not trigger in USFM view
      // Ctrl+9 triggers zoom reset
      if (e.ctrlKey && (e.key === '9' || e.code === 'Digit9')) {
        console.log('Resetting zoom');
        setResetZoomFlag(true);
        e.preventDefault();
        return;
      }
      if (e.key === 'PageDown') {
        handleNextLocation(true);
        e.preventDefault();
      } else if (e.key === 'PageUp') {
        handleNextLocation(false);
        e.preventDefault();
      }
    }
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [mapPaneView, handleNextLocation]); // Remove mapDef, mapRef from deps

  // Add listener for fit-map event from menu
  useEffect(() => {
    if (electronAPI && electronAPI.onFitMap) {
      const handleFitMap = () => {
        console.log('Fit Map triggered from menu');
        setResetZoomFlag(true);
      };
      
      electronAPI.onFitMap(handleFitMap);
      
      return () => {
        if (electronAPI.removeFitMapListener) {
          electronAPI.removeFitMapListener(handleFitMap);
        }
      };
    }
  }, []);

  // Add listeners for navigation events from menu
  useEffect(() => {
    if (electronAPI && electronAPI.onNextLabel && electronAPI.onPreviousLabel) {
      const handleNextLabel = () => {
        if (mapPaneView !== USFM_VIEW) {
          console.log('Next Label triggered from menu');
          handleNextLocation(true);
        }
      };
      
      const handlePreviousLabel = () => {
        if (mapPaneView !== USFM_VIEW) {
          console.log('Previous Label triggered from menu');
          handleNextLocation(false);
        }
      };
      
      electronAPI.onNextLabel(handleNextLabel);
      electronAPI.onPreviousLabel(handlePreviousLabel);
      
      return () => {
        if (electronAPI.removeNextLabelListener) {
          electronAPI.removeNextLabelListener(handleNextLabel);
        }
        if (electronAPI.removePreviousLabelListener) {
          electronAPI.removePreviousLabelListener(handlePreviousLabel);
        }
      };
    }
  }, [mapPaneView, handleNextLocation]);

  // Memoize locations and mapDef to prevent MapPane remounts
  const memoizedLocations = useMemo(() => locations, [locations]);
  const memoizedMapDef = useMemo(() => mapDef, [mapDef]);
  const memoizedHandleSelectLocation = useCallback(handleSelectLocation, [handleSelectLocation]);

  // Extract the current collection ID from the template name
  const currentCollectionId = useMemo(() => {
    return getCollectionIdFromTemplate(mapDef.template);
  }, [mapDef.template]);

  // Function to update locations when denials change
  const handleDenialsChanged = useCallback(() => {
    // Make sure we're using the latest term renderings state
    const currentTermRenderings = { ...termRenderings };

    setLocations(prevLocations =>
      prevLocations.map(loc => {
        const status = getStatus(
          currentTermRenderings,
          loc.termId,
          loc.vernLabel || '',
          collectionManager.getRefs(loc.mergeKey, getCollectionIdFromTemplate(mapDef.template)),
          extractedVerses
        );
        return { ...loc, status };
      })
    );
  }, [termRenderings, extractedVerses, mapDef.template]);

  // Debounced save of termRenderings to disk via IPC
  useEffect(() => {
    if (!projectFolder || !electronAPI) return;
    if (!termRenderings) return;

    const handler = setTimeout(() => {
      electronAPI.saveTermRenderings(projectFolder, settings.saveToDemo, termRenderings);
      console.log(
        '[IPC] Auto-saved termRenderings to disk:',
        projectFolder,
        'saveToDemo:',
        settings.saveToDemo
      );
      // Optionally: show a "saved" indicator here
      // console.log('Auto-saved termRenderings to disk');
    }, 2000); // 2 seconds after last change

    return () => clearTimeout(handler);
  }, [termRenderings, projectFolder, settings.saveToDemo]);

  // Save project folder to settings when it changes
  //   useEffect(() => {
  //     if (!isInitialized || !projectFolder) return;
  //     settingsService.updateProjectFolder(projectFolder); // Save the project folder to settings
  //     console.log('Auto-saved project folder to settings:', projectFolder);
  //   }, [projectFolder, isInitialized]);

  // Save language to settings when it changes
  useEffect(() => {
    if (!isInitialized) return;
    settingsService
      .updateLanguage(lang) // Save the language to settings
      .then(() => console.log('Auto-saved language to settings:', lang))
      .catch(err => console.error('Error saving language to settings:', err));
  }, [lang, isInitialized]);

  // State for storing the loaded image data URL
  // undefined = loading, null = error, string = loaded image data
  const [imageData, setImageData] = useState(undefined);
  // Add state to track specific image load error message
  const [imageError, setImageError] = useState(null);

  // Load the image via IPC when the map definition, settings, or selected variant change
  useEffect(() => {
    if (!memoizedMapDef.imgFilename || !settings || !isInitialized) return;

    // Determine which image to use based on selected variant
    let imageFilename = memoizedMapDef.imgFilename; // Default image
    
    // Check if current variant has a custom image
    if (selectedVariant > 0 && memoizedMapDef.variants) {
      const variantKeys = Object.keys(memoizedMapDef.variants);
      const variantKey = variantKeys[selectedVariant - 1];
      const variant = memoizedMapDef.variants[variantKey];
      if (variant?.imgFilename) {
        imageFilename = variant.imgFilename;
        console.log(`Using variant image: ${imageFilename} for variant: ${variantKey}`);
      }
    }

    // Set to loading state
    setImageData(undefined);
    setImageError(null);

    let imagePath;
    if (imageFilename.includes('/') || imageFilename.includes('\\')) {
      // If imageFilename is already an absolute path (contains a slash), use it directly
      imagePath = imageFilename;
    } else {
      // Append filename to tempate folder path.
      // Use the template folder passed as prop instead of from settings service
      // This ensures we always use the latest version that's in memory
      imagePath = (templateFolder || settings.templateFolder) + '/' + currentCollectionId + '/' + imageFilename;
    }
    console.log('Loading image from path:', imagePath, '; templatefolder:', templateFolder, '; variant:', selectedVariant);

    // Use the IPC function to load the image
    if (window.electronAPI) {
      window.electronAPI
        .loadImage(imagePath)
        .then(data => {
          if (data) {
            setImageData(data);
            console.log('Image loaded successfully through IPC');
          } else {
            console.error(`Failed to load image through IPC from path: ${imagePath}`);
            setImageData(null); // null indicates error
            setImageError(`Could not load map image: ${imagePath}`);
          }
        })
        .catch(err => {
          console.error(`Error loading image through IPC from path: ${imagePath}`, err);
          setImageData(null); // null indicates error
          setImageError(`Error loading map image: ${err.message || 'Unknown error'}`);
        });
    } else {
      console.error('electronAPI not available');
      setImageData(null); // null indicates error
      setImageError('Electron API not available. Cannot load images.');
    }
  }, [
    memoizedMapDef.imgFilename, 
    memoizedMapDef.variants,
    selectedVariant,
    isInitialized, 
    settings, 
    templateFolder, 
    currentCollectionId
  ]);
  // For debugging - keep track of the original path with proper Windows path separators
  //   const imgPath = memoizedMapDef.imgFilename ?
  //   (settingsService.getTemplateFolder()) + '\\' + memoizedMapDef.imgFilename : '';
  //   console.log('Image path is based on settingsService.getTemplateFolder():', settingsService.getTemplateFolder());

  // Add cleanup effect to handle unmounting gracefully
  useEffect(() => {
    console.log('MainApp mounted - initializing');

    // Return a cleanup function that will run when MainApp is unmounted
    return () => {
      // Cancel any timers, requests or operations that could cause errors when unmounted
      console.log('MainApp is unmounting - performing cleanup');

      // Create a dummy element to replace any map references
      // This helps prevent Leaflet errors during unmounting
      if (!window._mapCleanupDummy) {
        window._mapCleanupDummy = document.createElement('div');
      }

      // Create a global flag to prevent any Leaflet operations during unmounting
      window._mapIsUnmounting = true;

      // Attempt to clean up any leaflet resources
      if (window.L && window.L.DomUtil) {
        try {
          // Clean up any leaflet eventHandlers
          window.L.DomEvent._globalEventHandlers = {};

          // Manually clear any Leaflet references still in the DOM
          const leafletContainers = document.querySelectorAll('.leaflet-container');
          leafletContainers.forEach(container => {
            try {
              container.outerHTML = '';
            } catch (e) {
              // Ignore errors
            }
          });
        } catch (e) {
          console.log('Error cleaning up Leaflet:', e);
        }
      }

      // Add a timeout to clear the unmounting flag
      setTimeout(() => {
        window._mapIsUnmounting = false;
      }, 500);
    };
  }, []);

  // Handle variant selection changes
  const handleVariantChange = useCallback(
    newVariantId => {
      setSelectedVariant(newVariantId);

      // Check if current selection is still visible
      const currentLocation = locations[selLocation];
      if (!currentLocation || !isLocationVisible(currentLocation, newVariantId)) {
        // Find first visible location
        const firstVisibleIndex = locations.findIndex(loc => isLocationVisible(loc, newVariantId));
        if (firstVisibleIndex !== -1) {
          setSelLocation(firstVisibleIndex);
        }
      }
    },
    [locations, selLocation]
  );

  // Update location statuses when extractedVerses change (without affecting selection)
  useEffect(() => {
    if (!termRenderings || !locations.length || !mapDef.template) return;

    // Update all location statuses based on the current extractedVerses
    setLocations(prevLocations => {
      return prevLocations.map(loc => {
        const status = getStatus(
          termRenderings,
          loc.termId,
          loc.vernLabel || '',
          collectionManager.getRefs(loc.mergeKey, getCollectionIdFromTemplate(mapDef.template)),
          extractedVerses
        );
        return { ...loc, status };
      });
    });

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [extractedVerses, termRenderings, mapDef.template]); // locations intentionally omitted to prevent infinite loop

  return (
    <div className="app-container">
      {' '}
      <div className="top-section" style={{ flex: `0 0 ${topHeight}%` }}>
        {' '}
        <div className="map-pane" style={{ flex: `0 0 ${mapWidth}%` }}>
          {' '}
          {mapPaneView === MAP_VIEW && mapDef.mapView && (
            <>
              {imageData === undefined && (
                <div
                  style={{
                    position: 'absolute',
                    top: '10px',
                    right: '10px',
                    background: 'rgba(255,255,0,0.8)',
                    color: 'black',
                    padding: '5px 10px',
                    borderRadius: '5px',
                    zIndex: 1001,
                    fontSize: '12px',
                  }}
                >
                  {inLang(uiStr.loadingImage, lang)}
                </div>
              )}
              {imageData === null && imageError && (
                <div
                  style={{
                    position: 'absolute',
                    top: '10px',
                    right: '10px',
                    background: 'rgba(255,100,100,0.9)',
                    color: 'white',
                    padding: '5px 10px',
                    borderRadius: '5px',
                    zIndex: 1001,
                    fontSize: '12px',
                    maxWidth: '80%',
                  }}
                >
                  {imageError}
                </div>
              )}{' '}
              <MapPane
                imageUrl={imageData}
                locations={memoizedLocations}
                onSelectLocation={memoizedHandleSelectLocation}
                selLocation={selLocation}
                labelScale={labelScale}
                labelOpacity={labelOpacity}
                mapDef={memoizedMapDef}
                termRenderings={termRenderings}
                lang={lang}
                resetZoomFlag={resetZoomFlag} // Pass to MapPane
                setResetZoomFlag={setResetZoomFlag} // Pass setter to MapPane
                extractedVerses={extractedVerses} // Pass extracted verses
                collectionId={currentCollectionId} // Pass the collection ID
                showFrac={showFrac}
                selectedVariant={selectedVariant} // Pass selected variant
              />
            </>
          )}{' '}
          {mapPaneView === TABLE_VIEW && (
            <TableView
              locations={locations}
              selLocation={selLocation}
              onSelectLocation={handleSelectLocation}
              onUpdateVernacular={handleUpdateVernacular}
              termRenderings={termRenderings}
              onNextLocation={handleNextLocation}
              lang={lang} // <-- pass lang
              extractedVerses={extractedVerses}
              collectionId={currentCollectionId} // Pass the collection ID
              selectedVariant={selectedVariant} // Pass selected variant
            />
          )}
          {mapPaneView === USFM_VIEW && <USFMView usfmText={usfmText} />}
        </div>
        <div
          className="vertical-divider"
          onMouseDown={handleVerticalDragStart}
          dangerouslySetInnerHTML={{ __html: '‖<br />‖' }}
        />
        <div className="details-pane" style={{ flex: `0 0 ${100 - mapWidth}%` }}>
          {' '}
          <DetailsPane
            selLocation={selLocation}
            onUpdateVernacular={handleUpdateVernacular}
            onNextLocation={handleNextLocation}
            renderings={renderings}
            isApproved={isApproved}
            onRenderingsChange={handleRenderingsChange}
            onApprovedChange={handleApprovedChange}
            termRenderings={termRenderings}
            locations={locations}
            onSwitchView={handleSwitchViewWithUsfm}
            mapPaneView={mapPaneView}
            onSetView={async viewIdx => {
              if (viewIdx === MAP_VIEW && !mapDef.mapView) return;
              if (mapPaneView === USFM_VIEW) await updateMapFromUsfm();
              setMapPaneView(viewIdx);
            }}
            onShowSettings={() => setShowSettings(true)} // <-- add onShowSettings
            mapDef={mapDef} // <-- pass map definition
            onBrowseMapTemplate={handleBrowseMapTemplate}
            vernacularInputRef={vernacularInputRef} // <-- pass ref
            renderingsTextareaRef={renderingsTextareaRef}
            lang={lang} // <-- pass lang
            setTermRenderings={setTermRenderings} // <-- pass setter
            onCreateRendering={handleReplaceRendering} // <-- pass handler
            onExit={handleExitWithPrompt}
            selectedVariant={selectedVariant} // Pass selected variant
            onVariantChange={handleVariantChange} // Pass variant change handler
            mapxPath={mapxPath} // Pass current MAPX file path
            idmlPath={idmlPath} // Pass current IDML file path
            hasUnsavedChanges={hasUnsavedChanges} // Pass unsaved changes state
            onSaveLabels={handleSaveLabels} // Pass save handler
            onRevertLabels={handleRevertLabels} // Pass revert handler
            templateGroup={templateGroup} // Pass template group for navigation
            templateGroupIndex={templateGroupIndex} // Pass current index in group
            onPreviousTemplate={handlePreviousTemplate} // Pass previous handler
            onNextTemplate={handleNextTemplate} // Pass next handler
          />
        </div>
      </div>
      <div className="horizontal-divider" onMouseDown={handleHorizontalDragStart}>
        ═════
      </div>{' '}
      <div className="bottom-pane" style={{ flex: `0 0 ${100 - topHeight}%` }}>
        <BottomPane
          termId={locations[selLocation]?.termId}
          mergeKey={locations[selLocation]?.mergeKey}
          renderings={renderings}
          onAddRendering={handleAddRendering}
          onReplaceRendering={handleReplaceRendering}
          lang={lang}
          termRenderings={termRenderings}
          setRenderings={setRenderings}
          onDenialsChanged={handleDenialsChanged}
          extractedVerses={extractedVerses}
          setTermRenderings={setTermRenderings}
          collectionId={currentCollectionId} // Pass the collection ID
          onReloadExtractedVerses={handleReloadExtractedVerses}
        />
      </div>{' '}
      <SettingsModal
        open={showSettings}
        onClose={() => setShowSettings(false)}
        labelScale={labelScale}
        setLabelScale={setLabelScale}
        labelOpacity={labelOpacity}
        setLabelOpacity={setLabelOpacity}
        lang={lang}
        setLang={setLang}
        showFrac={showFrac}
        setShowFrac={setShowFrac}
        templatePaths={templatePaths}
        setTemplatePaths={setTemplatePaths}
      />{' '}
      {showTemplateBrowser && (
        <TemplateBrowser
          open={true}
          lang={lang}
          projectFolder={projectFolder}
          initialFilters={templateFilters}
          onSelectDiagram={handleSelectDiagram}
          onSelectGroup={handleSelectGroup}
          onClose={() => setShowTemplateBrowser(false)}
        />
      )}
    </div>
  );
}

export default MainApp;
