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

function decodeFileAsString(arrayBuffer) {
  const uint8 = new Uint8Array(arrayBuffer);
  // UTF-8 BOM: EF BB BF
  if (uint8[0] === 0xef && uint8[1] === 0xbb && uint8[2] === 0xbf) {
    // console.log('Detected UTF-8 BOM');
    return new TextDecoder('utf-8').decode(uint8.subarray(3));
  }
  // UTF-16LE BOM: FF FE
  if (uint8[0] === 0xff && uint8[1] === 0xfe) {
    // console.log('Detected UTF-16LE BOM');
    return new TextDecoder('utf-16le').decode(uint8.subarray(2));
  }
  // UTF-16BE BOM: FE FF
  if (uint8[0] === 0xfe && uint8[1] === 0xff) {
    // console.log('Detected UTF-16BE BOM');
    return new TextDecoder('utf-16be').decode(uint8.subarray(2));
  }
  // Default: utf-8
  // console.log('Assuming UTF-8 encoding');
  return new TextDecoder('utf-8').decode(uint8);
}

async function mapFromUsfm(usfm) {
  // Extract template and \fig field
  const figMatch = usfm.match(/\\fig [^\\]*src="([^\\]+)"[^\\]*\\fig\*/);
  const templateMatch = usfm.match(/\\zdiagram-s\s+\|template="([^"]*)"/);
  let templateName = '';

  if (templateMatch) {
    templateName = templateMatch[1];
  } else {
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
    templateName = figMatch[1]
      .replace(/\..*$/, '') // Remove file extension
      .trim()
      .replace(/\s*[@(].*/, ''); // Remove anything after @ or (
  }

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
      fig: figMatch ? figMatch[0] : '',
      mapView: false,
      imgFilename: '',
      width: 1000,
      height: 1000,
      labels: [],
    };
  }

  mapDefData.fig = figMatch ? figMatch[0] : '';
  let maxIdx = mapDefData.labels.length;
  const regex =
    /\\zlabel-s\s+\|key="([^"]+)"\s+termid="([^"]+)"\s+gloss="([^"]+)"\s*\\\*\s*([^\\]*)/g;
  let match;
  while ((match = regex.exec(usfm)) !== null) {
    // eslint-disable-next-line
    const [_, mergeKey, termId, gloss, vernLabel] = match;
    console.log(`Parsed label: mergeKey=${mergeKey}, termId=${termId}, gloss=${gloss}, vernLabel=${vernLabel}`);
    // If mapDefData already has a label with this mergeKey, add vernLabel to it.
    const existingLabel = mapDefData.labels.find(label => label.mergeKey === mergeKey);
    if (existingLabel) {
      if (vernLabel) {
        existingLabel.vernLabel = vernLabel;
      }
    } else {
      // If not, create a new label object
      console.log(`Creating new label for mergeKey: ${mergeKey}`);
      const label = {
        mergeKey,
        termId,
        gloss: { en: gloss },
        vernLabel: vernLabel || '',
        idx: maxIdx++, // Assign an index for ordering
      };
      mapDefData.labels.push(label);
    }
  }
  console.log('Parsed map definition:', mapDefData);
  return mapDefData;
}

function usfmFromMap(map, lang) {
  console.log('Converting map to USFM:', map);
  // Reconstruct USFM string from current map state
  let usfm = `\\zdiagram-s |template="${map.template}"\\*\n`;
  // Always include the \fig line if present, and ensure it is in correct USFM format
  if (map.fig && !/^\\fig/.test(map.fig)) {
    usfm += `\\fig ${map.fig}\\fig*\n`;
  } else if (map.fig) {
    usfm += `${map.fig}\n`;
  }
  map.labels.forEach(label => {
    usfm += `\\zlabel-s |key="${label.mergeKey}" termid="${label.termId}" gloss="${inLang(
      label.gloss,
      lang
    )}"\\*${label.vernLabel || ''}\\zlabel-e\\*\n`;
  });
  usfm += '\\zdiagram-e \\*';
  // Remove unnecessary escaping for output
  return usfm.replace(/\\/g, '\\');
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
  const [mapxPaths, setMapxPaths] = useState(() => {
    const saved = localStorage.getItem('mapxPaths'); // Persist mapxPaths in localStorage
    return saved ? JSON.parse(saved) : [];
  });
  const [mapxPath, setMapxPath] = useState(''); // Current template's MAPX file path
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

  // Persist mapxPaths to localStorage
  useEffect(() => {
    localStorage.setItem('mapxPaths', JSON.stringify(mapxPaths));
  }, [mapxPaths]);

  // Update mapxPath when template changes or mapxPaths change
  useEffect(() => {
    const findMapxPath = async () => {
      if (!mapDef.template || mapxPaths.length === 0) {
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
      
      for (const folderPath of mapxPaths) {
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
  }, [mapDef.template, mapxPaths]);

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

  // Handler for map image browse
  const handleBrowseMapTemplate = useCallback(async () => {
    try {
      // Use Electron's file picker instead of web API
      const result = await electronAPI.selectTemplateFile();
      
      if (result.canceled || !result.success) {
        if (result.error) {
          console.error('File selection error:', result.error);
          alert(inLang(uiStr.errorSelectingFile, lang) + ': ' + result.error);
        }
        return;
      }

      const fileName = result.fileName;
      const filePath = result.filePath;
      let figFilename = '';
      let isJpg = false;
      const labels = {};

      if (fileName) {
        // Extract template name from filename and log the process
        // console.log("Original file name:", fileName);
        let newTemplateBase = fileName.replace(/\..*$/, ''); // Remove file extension
        // console.log("After removing extension:", newTemplateBase);
        newTemplateBase = newTemplateBase.trim();
        // console.log("After trim:", newTemplateBase);
        newTemplateBase = newTemplateBase.replace(/\s*[@(].*/, ''); // Remove anything after @ or (
        // console.log("Final template base name:", newTemplateBase);

        if (fileName.toLowerCase().endsWith('.txt')) {
          // Handle data merge file
          const fileContent = result.fileContent;
          if (!fileContent) {
            alert(inLang(uiStr.failedToReadFile, lang));
            return;
          }
          
          // console.log("Reading data merge file:", fileName);
          const fileText = decodeFileAsString(fileContent);
          // console.log(
          //   "Imported data merge file:",
          //   fileName,
          //   ">" + fileText + "<",
          // );
          // For now, assume it's an IDML data merge file //TODO: Handle mapx merge
          const lines = fileText.split('\n');
          const mergeKeys = lines[0].split('\t');
          const verns = lines[1].split('\t');
          if (verns.length === mergeKeys.length) {
            // Create labels from merge keys and vernaculars
            for (let i = 0; i < mergeKeys.length; i++) {
              labels[mergeKeys[i]] = verns[i];
            }
            // console.log("Labels from data merge:", labels);
          } else {
            alert(inLang(uiStr.invalidDataMerge, lang));
            return;
          }
        } else if (fileName.toLowerCase().endsWith('.jpg') || fileName.toLowerCase().endsWith('.jpeg')) {
          // Handle map image file
          figFilename = fileName;
          isJpg = true;
        } else {
          return;
        }

        if (!figFilename) {
          // If no figFilename, use the template base name as figFilename
          figFilename = newTemplateBase + '.jpg'; // Default to .jpg
        }
        // Add diagnostic logs to see what's happening
        // console.log("Template base name:", newTemplateBase);
        const [collectionId, templateName] = findCollectionIdAndTemplate(newTemplateBase);
        newTemplateBase = templateName; // Use the exact template name from the collection
        // console.log("Detected collection ID:", collectionId);
        // console.log("Collections loaded:", collectionManager.collectionsData);
        // console.log(
        //   "Is collection loaded?",
        //   collectionManager.isCollectionLoaded(collectionId),
        // );

        // Try to get the map definition
        const foundTemplate = await getMapDef(newTemplateBase, collectionId);
        // console.log("Found template:", foundTemplate);

        if (!foundTemplate) {
          console.error(
            'Template not found. Looking for:',
            newTemplateBase,
            'in collection:',
            collectionId
          );

          // Examine available templates for debugging
          const availableTemplates = Object.keys(collectionManager.getMapDefs(collectionId));
          console.log('Available templates in collection:', availableTemplates);

          alert(inLang(uiStr.noTemplate, lang) + ': ' + newTemplateBase);
          return;
        } // Set mapDef and locations
        setMapDef({
          template: newTemplateBase,
          fig: '\\fig | src="' + figFilename + '" size="span" ref="-"\\fig*',
          mapView: true,
          imgFilename: isJpg ? filePath : foundTemplate.imgFilename,
          width: foundTemplate.width,
          height: foundTemplate.height,
          labels: foundTemplate.labels,
          variants: foundTemplate.variants, // Include variants if they exist
        });

        // Initialize selectedVariant based on whether variants exist
        setSelectedVariant(
          foundTemplate.variants && Object.keys(foundTemplate.variants).length > 0 ? 1 : 0
        ); // Make a local copy to ensure we're using the latest state
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
        const initialLocations = newLocations.map(loc => {
          if (labels[loc.mergeKey]) {
            loc.vernLabel = labels[loc.mergeKey]; // Use label from data merge if available
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
      }
    } catch (e) {
      // User cancelled or not supported
      console.log('Map template browse cancelled or not supported:', e);
    }
  }, [
    setMapDef,
    setLocations,
    termRenderings,
    lang,
    handleSelectLocation,
    extractedVerses,
    mapDef.template,
  ]);

  // Store the function in a ref for stable reference
  useEffect(() => {
    handleBrowseMapTemplateRef.current = handleBrowseMapTemplate;
  }, [handleBrowseMapTemplate]);

  // Initialize map from USFM once settings and collections are loaded
  useEffect(() => {
    if (!isInitialized) return; // Don't initialize map until collections are loaded
    const initializeMap = async () => {
      try {
        if (!settings.usfm) {
          await handleBrowseMapTemplateRef.current();
        } else {
          // console.log("Initializing map from USFM:", settings.usfm);
          const initialMap = await mapFromUsfm(settings.usfm);
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
        }
      } catch (error) {
        console.log('Unable to initialize map:', error);
        // browse for a map template if no map
        await handleBrowseMapTemplateRef.current();
      }
    };
    initializeMap();
  }, [isInitialized, settings.usfm]);

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
            onExit={onExit}
            selectedVariant={selectedVariant} // Pass selected variant
            onVariantChange={handleVariantChange} // Pass variant change handler
            mapxPath={mapxPath} // Pass current MAPX file path
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
        mapxPaths={mapxPaths}
        setMapxPaths={setMapxPaths}
      />{' '}
    </div>
  );
}

export default MainApp;
