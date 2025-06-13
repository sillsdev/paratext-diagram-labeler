import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import './App.css';
import BottomPane from './BottomPane.js';
import uiStr from './data/ui-strings.json';
import { DEFAULT_PROJECTS_FOLDER, DEMO_PROJECT, INITIAL_USFM } from './demo.js';
import { MAP_VIEW, TABLE_VIEW, USFM_VIEW,  } from './constants.js';
import { collPlacenames } from './CollPlacenamesAndRefs.js';
import { getMapDef, getMapDefSync } from './MapData';
import { inLang, getStatus, getMapForm } from './Utils.js';
import MapPane from './MapPane.js';
import TableView from './TableView.js';
import DetailsPane from './DetailsPane.js';
import SettingsModal from './SettingsModal.js';
// import { app } from 'electron';

const electronAPI = window.electronAPI;

// let appSettings = electronAPI.loadSettings();
// console.log('App settings loaded:', appSettings);
// if (!appSettings.projectsFolder) {  
//   appSettings.projectsFolder = DEFAULT_PROJECTS_FOLDER;
//   electronAPI.saveSettings(appSettings);
//   console.log('App settings updated with default projectsFolder:', appSettings.projectsFolder);
// }
// console.log('App settings after default:', appSettings);
const appSettings = { projectsFolder: DEFAULT_PROJECTS_FOLDER };

// Define an empty initial map state to be used until the async load completes
const emptyInitialMap = {
  template: '',
  mapView: false,
  imgFilename: '',
  width: 1000,
  height: 1000,
  labels: []
};
console.log('Creating empty initial map state');

function getRefList(labels, collPlacenames) {
  const rl = Array.from(
    new Set(
      labels
        .map(label => collPlacenames.getRefs(label.mergeKey)) 
        .flat()
    )
  ).sort();
  console.log('getRefList():', rl.length, 'refs for', labels.length, 'labels from collPlacenames:', collPlacenames);
  return rl;
}

function decodeFileAsString(arrayBuffer) {
  const uint8 = new Uint8Array(arrayBuffer);
  // UTF-8 BOM: EF BB BF
  if (uint8[0] === 0xEF && uint8[1] === 0xBB && uint8[2] === 0xBF) {
    // console.log('Detected UTF-8 BOM');
    return new TextDecoder('utf-8').decode(uint8.subarray(3));
  }
  // UTF-16LE BOM: FF FE
  if (uint8[0] === 0xFF && uint8[1] === 0xFE) {
    // console.log('Detected UTF-16LE BOM');
    return new TextDecoder('utf-16le').decode(uint8.subarray(2));
  }
  // UTF-16BE BOM: FE FF
  if (uint8[0] === 0xFE && uint8[1] === 0xFF) {
    // console.log('Detected UTF-16BE BOM');
    return new TextDecoder('utf-16be').decode(uint8.subarray(2));
  }
  // Default: utf-8
  // console.log('Assuming UTF-8 encoding');
  return new TextDecoder('utf-8').decode(uint8);
}

async function mapFromUsfm(usfm) {
  // Extract template and \fig field
  const figMatch = usfm.match(/\\fig[\s\S]*?\\fig\*/);
  const templateMatch = usfm.match(/\\zdiagram-s\s+\|template="([^"]*)"/);
  
  // Empty template case
  if (!templateMatch) {
    return {
      template: '',
      fig: figMatch ? figMatch[0] : '',
      mapView: false,
      imgFilename: '',
      width: 1000,
      height: 1000,
      labels: []
    };
  }
  
  const templateName = templateMatch[1];
  let mapDefData;
  
  try {
    // Now getMapDef returns a Promise
    mapDefData = await getMapDef(templateName, collPlacenames);
    
    if (mapDefData) {
      mapDefData.mapView = true;
      mapDefData.template = templateName;
    } else {
      throw new Error("Map definition not found");
    }
  } catch (e) {
    console.error("Error loading map definition:", e);
    mapDefData = {
      template: templateName,
      fig: figMatch ? figMatch[0] : '',
      mapView: false,
      imgFilename: '',
      width: 1000,
      height: 1000,
      labels: []
    }
  }
  
  mapDefData.fig = figMatch ? figMatch[0] : '';
  let maxIdx = mapDefData.labels.length;
  const regex = /\\zlabel\s+\|key="([^"]+)"\s+termid="([^"]+)"\s+gloss="([^"]+)"\s+label="([^"]*)"/g;
  let match;
  while ((match = regex.exec(usfm)) !== null) {
    // eslint-disable-next-line
    const [_, mergeKey, termId, gloss, vernLabel] = match;
    // If mapDefData already has a label with this mergeKey, add vernLabel to it.
    const existingLabel = mapDefData.labels.find(label => label.mergeKey === mergeKey);
    if (existingLabel) {
      if (vernLabel) {
        existingLabel.vernLabel = vernLabel;
      }
    } else {
      // If not, create a new label object
      const label = {
        mergeKey,
        termId,
        gloss: { en: gloss },
        vernLabel: vernLabel || '',
        idx: maxIdx++ // Assign an index for ordering
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
    usfm += `\\zlabel |key="${label.mergeKey}" termid="${label.termId}" gloss="${inLang(label.gloss, lang)}" label="${label.vernLabel || ''}"\\*\n`;
  });
  usfm += '\\zdiagram-e \\*';
  // Remove unnecessary escaping for output
  return usfm.replace(/\\/g, '\\');
}

function App() {
  const [projectFolder, setProjectFolder] = useState(appSettings.projectsFolder + "/" + DEMO_PROJECT); // Default to demo project
  const [lang, setLang] = useState('en');  //TODO: Persist in localStorage
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
  const [showSettings, setShowSettings] = useState(false);
  const [resetZoomFlag, setResetZoomFlag] = useState(false);  // For controlling Leaflet map
  const isDraggingVertical = useRef(false);
  const isDraggingHorizontal = useRef(false);
  const vernacularInputRef = useRef(null);
  const renderingsTextareaRef = useRef();
  const [extractedVerses, setExtractedVerses] = useState({});
  const [termRenderings, setTermRenderings] = useState();
  const [isInitialized, setIsInitialized] = useState(false); // Track initialization state

  // Initialize map from USFM
  useEffect(() => {
    const initializeMap = async () => {
      try {
        // Initialize from the demo USFM
        const initialMap = await mapFromUsfm(INITIAL_USFM);
        console.log('Initial Map loaded:', initialMap);
        setMapDef(initialMap);
        setMapPaneView(initialMap.mapView ? MAP_VIEW : TABLE_VIEW);
        setIsInitialized(true);
      } catch (error) {
        console.error("Error initializing map:", error);
        // Keep using empty map if initialization fails
        setIsInitialized(true);
      }
    };
    
    initializeMap();
  }, []);

  // Load term renderings from new project folder
  useEffect(() => {
    if (!electronAPI || !projectFolder || !isInitialized || !mapDef) return;
    
    const loadData = async () => {
      try {
        const newTermRenderings = await electronAPI.loadTermRenderings(projectFolder);
        console.log('[IPC] Loaded term renderings:', newTermRenderings, 'from folder:', projectFolder);
        if (newTermRenderings && !newTermRenderings.error) {
          setTermRenderings(newTermRenderings);
          // Re-init locations from map and new termRenderings
          const initialLocations = mapDef.labels.map(loc => {
            if (!loc.vernLabel) {
              loc.vernLabel = getMapForm(newTermRenderings, loc.termId);
            }
            const status = getStatus(newTermRenderings,  loc.termId, loc.vernLabel);
            return { ...loc, status };
          });
          setLocations(initialLocations);
          if (initialLocations.length > 0) {
            setSelLocation(0); // Select first location directly
          }
        } else {
          alert('Failed to load term-renderings.json: ' + (newTermRenderings && newTermRenderings.error));
        }
      } catch (e) {
        console.log(`Failed to load term-renderings.json from project folder <${projectFolder}>.`, e);
      }
    };
    
    loadData();
  }, [projectFolder, mapDef, isInitialized]);

  // setExtractedVerses when projectFolder or mapDef.labels change
  useEffect(() => {
    if (!projectFolder || !mapDef.labels?.length || !isInitialized) return;
    
    const refs = getRefList(mapDef.labels, collPlacenames);
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
        alert('Failed to requested filtered verses ' + (verses && verses.error));
      }
    });
  }, [projectFolder, mapDef.labels]);


  // UI handler to select project folder
  const handleSelectProjectFolder = useCallback(async () => {
    if (!electronAPI) return;
    try {
      const folderPath = await electronAPI.selectProjectFolder();
      if (folderPath) {
        setProjectFolder(folderPath);
      }
    } catch (e) {
      alert('Failed to select project folder.');
    }
  }, []);
  
  // On first load, prompt for project folder if not set
  useEffect(() => {
    if (!projectFolder && electronAPI) {
      handleSelectProjectFolder();
    }
    // eslint-disable-next-line
  }, [projectFolder]);

  
  // Handler to set the selected location (e.g. Label clicked)
  const handleSelectLocation = useCallback((location) => {
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
  }, [termRenderings, setRenderings, setIsApproved, setSelLocation]);

  // Handler to update label of selected location with new vernacular and status
  const handleUpdateVernacular = useCallback((termId, newVernacular) => {
    // Create a copy of the current state to ensure we're using the latest data
    const currentTermRenderings = { ...termRenderings };
    
    setLocations(prevLocations => prevLocations.map(loc => {
      if (loc.termId === termId) {
        const status = getStatus(currentTermRenderings, loc.termId, newVernacular);
        return { ...loc, vernLabel: newVernacular, status };
      }
      return loc;
    }));
  }, [termRenderings]); // is just renderings enough here?


  // Handler to cycle forward or backward through locations
  const handleNextLocation = useCallback((fwd) => {
    const currentIndex = selLocation;
    let nextIndex;
    if (fwd) {
      nextIndex = (currentIndex + 1) % locations.length;
    } else {
      nextIndex = (currentIndex - 1 + locations.length) % locations.length;
    }
    const nextLocation = locations[nextIndex];
    handleSelectLocation(nextLocation);
  }, [locations, selLocation, handleSelectLocation]);


  // Handlers for resizing panes
  const handleVerticalDragStart = (e) => {
    e.preventDefault();
    console.log('Vertical drag start');
    isDraggingVertical.current = true;
    document.addEventListener('mousemove', handleVerticalDrag);
    document.addEventListener('mouseup', handleDragEnd);
  };
  const handleHorizontalDragStart = (e) => {
    e.preventDefault();
    console.log('Horizontal drag start');
    isDraggingHorizontal.current = true;
    document.addEventListener('mousemove', handleHorizontalDrag);
    document.addEventListener('mouseup', handleDragEnd);
  };
  const handleVerticalDrag = (e) => {
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
  const handleHorizontalDrag = (e) => {
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
  const handleRenderingsChange = (e) => {
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
        isGuessed: false 
      };
    }
    
    // Update termRenderings state
    setTermRenderings(updatedData);
    
    // The renderings change might affect the status of the location indexed by selLocation
    const status = getStatus(updatedData, termId, locations[selLocation].vernLabel || '');
    
    // Update the status of the affected location
    setLocations(prevLocations => prevLocations.map(loc => {
      if (loc.termId === termId) {
        return { ...loc, status };
      }
      return loc;
    }));
  };

  // Handler for change in approved status.
  const handleApprovedChange = (e) => {
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
    const status = getStatus(updatedData, termId, locations[selLocation].vernLabel || '');
    setLocations(prevLocations => prevLocations.map(loc => {
      if (loc.termId === termId) {
        return { ...loc, status };
      }
      return loc;
    }));
  };


  // Handler for map image browse
  const handleBrowseMapTemplate = async () => {
    try {
      const [fileHandle] = await window.showOpenFilePicker({
        types: [
          {
            description: 'Sample Map Images',
            accept: { 'image/jpeg': ['.jpg'] },
          },
          {
            description: 'Data Merge Files',
            accept: { 'text/plain': ['.txt'] },
          },
        ],
        multiple: false,
      });
      if (fileHandle) {
        let newTemplateBase = fileHandle.name.replace(/\..*$/, '').replace(/^([a-z0-9-]+)_/i, '').trim().replace(/\s*[@(].*/, '');
        let collId = 'SMR'; // Default collection ID
        // Extract the collection ID from the start of the filename
        const collectionIdMatch = fileHandle.name.match(/^([a-z0-9-]+)_/i);
        if (collectionIdMatch) {
          collId = collectionIdMatch[1].toUpperCase(); // Use the first part as the collection ID
        }
        const labels = {};
        if (fileHandle.name.endsWith('.txt')) {
          // Handle data merge file
          const file = await fileHandle.getFile();
          console.log('Reading data merge file:', file.name);
          const fileText = decodeFileAsString(await file.arrayBuffer());
          console.log('Imported data merge file:', file.name, ">" + fileText + "<");
          // For now, assume it's an IDML data merge file //TODO: Handle mapx merge
          const lines = fileText.split('\n');
          const mergeKeys = lines[0].split('\t');
          const verns = lines[1].split('\t');
          if (verns.length === mergeKeys.length) {
            // Create labels from merge keys and vernaculars
            for (let i = 0; i < mergeKeys.length; i++) {
              labels[mergeKeys[i]] = verns[i];
            }
            console.log('Labels from data merge:', labels);
          } else {
            alert(inLang(uiStr.invalidDataMerge, lang));
            return;
          }
        } else if (fileHandle.name.endsWith('.jpg') || fileHandle.name.endsWith('.jpeg')) {
          // Handle map image file
        } else {
          return;
        }        
        const foundTemplate = getMapDefSync(newTemplateBase, collPlacenames);
        if (!foundTemplate) {
          alert(inLang(uiStr.noTemplate, lang) + ": " + newTemplateBase);
          return;
        }
        // Set mapDef and locations 
        setMapDef({
          template: newTemplateBase,
          fig: foundTemplate.fig || '',
          mapView: true,
          imgFilename: foundTemplate.imgFilename,
          width: foundTemplate.width,
          height: foundTemplate.height,
          labels: foundTemplate.labels
        });        // Make a local copy to ensure we're using the latest state
        const currentTermRenderings = { ...termRenderings };
        
        const newLocations = foundTemplate.labels.map(loc => {
          const status = getStatus(currentTermRenderings, loc.termId, loc.vernLabel || '');
          return { ...loc, vernLabel: loc.vernLabel || '', status };
        });        const initialLocations = newLocations.map(loc => {
          if (labels[loc.mergeKey]) {
            loc.vernLabel = labels[loc.mergeKey]; // Use label from data merge if available
          } else if (!loc.vernLabel) {
            loc.vernLabel = getMapForm(currentTermRenderings, loc.termId);
          }

          const status = getStatus(currentTermRenderings, loc.termId, loc.vernLabel);
          return { ...loc, status };
        });
        console.log('Initial locations:', initialLocations);
        setLocations(initialLocations);
        if (initialLocations.length > 0) {
          handleSelectLocation(initialLocations[0]); // Auto-select first location
        }
        setMapPaneView(MAP_VIEW); // Map View
      }
    } catch (e) {
      // User cancelled or not supported
      console.log('Map template browse cancelled or not supported:', e);
    }
  };

  
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
  const [usfmText, setUsfmText] = useState(() => usfmFromMap({ ...mapDef, labels: locations }, lang));

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
  const updateMapFromUsfm = useCallback(() => {
    if (!usfmTextareaRef.current) return;
    const text = usfmTextareaRef.current.value;
    try {
      const newMap = mapFromUsfm(text);
      // Re-init locations and selection      // Create a local copy of termRenderings to ensure we're using the latest state
      const currentTermRenderings = { ...termRenderings };
      
      const initialLocations = newMap.labels.map(loc => {
        if (!loc.vernLabel) {
          loc.vernLabel = getMapForm(currentTermRenderings, loc.termId);
        }
        const status = getStatus(currentTermRenderings, loc.termId, loc.vernLabel);
        return { ...loc, status };
      });
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
        height: newMap.height
      });
      setUsfmText(text); // keep USFM text in sync after parse
    } catch (e) {
      alert(inLang(uiStr.invalidUsfm, lang));
    }
  }, [termRenderings, setLocations, setSelLocation, lang, mapDef]);
  // Intercept view switch to update map if leaving USFM view
  const handleSwitchViewWithUsfm = useCallback(() => {
    if (mapPaneView === USFM_VIEW) {
      updateMapFromUsfm();
    }
    setMapPaneView(prev => {
      if (!mapDef.mapView) {
        // Only cycle between Table (1) and USFM (2)
        return prev === TABLE_VIEW ? USFM_VIEW : TABLE_VIEW;
      }
      // Cycle through Map (0), Table (1), USFM (2)
      return (prev + 1) % 3;  // Maybe this can be simplified now that Switch View is only from USFM
    });
  }, [mapPaneView, updateMapFromUsfm, mapDef.mapView]);

  // Intercept OK button in DetailsPane
  const handleOkWithUsfm = useCallback(() => {
    if (mapPaneView === USFM_VIEW) {
      updateMapFromUsfm();
    }
    // Optionally: do other OK logic here
    alert("At this point, the USFM text would be saved to Paratext.");  // TODO: 
  }, [mapPaneView, updateMapFromUsfm]);


  // Add rendering from bottom pane selection
  const handleAddRendering = useCallback((text) => {
    if (!locations[selLocation]) return;
    const termId = locations[selLocation].termId;
    let currentRenderings = renderings || '';
    let newRenderings = currentRenderings.trim() ? `${currentRenderings.trim()}\n${text.trim()}` : text.trim();
    setRenderings(newRenderings);
    const updatedData = { ...termRenderings };
    updatedData[termId] = {
      ...updatedData[termId],
      renderings: newRenderings,
      isGuessed: false
    };
    setTermRenderings(updatedData);
    setIsApproved(true);    setLocations(prevLocations => prevLocations.map(loc => {
      if (loc.termId === termId) {
        const status = getStatus(updatedData, loc.termId, loc.vernLabel);
        return { ...loc, status };
      }
      return loc;
    }));
    setTimeout(() => {
      if (renderingsTextareaRef.current) renderingsTextareaRef.current.focus();
    }, 0);
  }, [renderings, selLocation, locations, termRenderings]);


  // Replace all renderings with selected text (from bottom pane) or create new rendering (from details pane)
  const handleReplaceRendering = useCallback((text) => {
    if (!locations[selLocation]) return;
    const termId = locations[selLocation].termId;
    const newRenderings = text.trim();
    setRenderings(newRenderings);
    const updatedData = { ...termRenderings };
    updatedData[termId] = {
      ...updatedData[termId],
      renderings: newRenderings,
      isGuessed: false
    };
    setTermRenderings(updatedData);
    setIsApproved(true);    setLocations(prevLocations => prevLocations.map(loc => {
      if (loc.termId === termId) {
        const vernLabel = newRenderings;
        const status = getStatus(updatedData, loc.termId, vernLabel);
        return { ...loc, status, vernLabel };
      }
      return loc;
    }));
    setTimeout(() => {
      if (renderingsTextareaRef.current) renderingsTextareaRef.current.focus();
    }, 0);
  }, [selLocation, locations, termRenderings]);


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

  // Memoize locations and mapDef to prevent MapPane remounts
  const memoizedLocations = useMemo(() => locations, [locations]);
  const memoizedMapDef = useMemo(() => mapDef, [mapDef]);
  const memoizedHandleSelectLocation = useCallback(handleSelectLocation, [handleSelectLocation]);
  // Function to update locations when denials change
  const handleDenialsChanged = useCallback(() => {
    // Make sure we're using the latest term renderings state
    const currentTermRenderings = { ...termRenderings };
    
    setLocations(prevLocations => prevLocations.map(loc => {
      const status = getStatus(currentTermRenderings, loc.termId, loc.vernLabel || '');
      return { ...loc, status };
    }));
  }, [termRenderings]);


  // Debounced save of termRenderings to disk via IPC
  useEffect(() => {
    if (!projectFolder || !electronAPI) return;
    if (!termRenderings) return;

    const handler = setTimeout(() => {
      electronAPI.saveTermRenderings(projectFolder, termRenderings);
      console.log('[IPC] Auto-saved termRenderings to disk:', projectFolder);
      // Optionally: show a "saved" indicator here
      // console.log('Auto-saved termRenderings to disk');
    }, 2000); // 2 seconds after last change

    return () => clearTimeout(handler);
  }, [termRenderings, projectFolder]);


  return (
    <div className="app-container">
      <div className="top-section" style={{ flex: `0 0 ${topHeight}%` }}>        <div className="map-pane" style={{ flex: `0 0 ${mapWidth}%` }}>
          {mapPaneView === MAP_VIEW && mapDef.mapView && (
            <MapPane
              imageUrl={memoizedMapDef.imgFilename ? `/assets/maps/${memoizedMapDef.imgFilename}` : ''}
              locations={memoizedLocations}
              onSelectLocation={memoizedHandleSelectLocation}
              selLocation={selLocation}
              labelScale={labelScale}
              mapDef={memoizedMapDef}
              termRenderings={termRenderings}
              lang={lang}
              resetZoomFlag={resetZoomFlag} // Pass to MapPane
              setResetZoomFlag={setResetZoomFlag} // Pass setter to MapPane
              extractedVerses={extractedVerses} // Pass extracted verses
            />
          )}
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
            />
          )}
          {mapPaneView === USFM_VIEW && (
            <USFMView usfmText={usfmText} />
          )}
        </div>
        <div
          className="vertical-divider"
          onMouseDown={handleVerticalDragStart}
          dangerouslySetInnerHTML={{ __html: '‖<br />‖' }}
        />
        <div className="details-pane" style={{ flex: `0 0 ${100 - mapWidth}%` }}>
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
            onOk={handleOkWithUsfm}
            mapPaneView={mapPaneView}            onSetView={viewIdx => {
              if (viewIdx === MAP_VIEW && !mapDef.mapView) return;
              if (mapPaneView === USFM_VIEW) updateMapFromUsfm();
              setMapPaneView(viewIdx);
            }}
            onShowSettings={() => setShowSettings(true)} // <-- add onShowSettings
            mapDef={mapDef} // <-- pass map definition
            onBrowseMapTemplate={handleBrowseMapTemplate}
            vernacularInputRef={vernacularInputRef} // <-- pass ref
            renderingsTextareaRef={renderingsTextareaRef}
            lang={lang} // <-- pass lang
            setTermRenderings={setTermRenderings} // <-- pass setter
            onCreateRendering ={handleReplaceRendering} // <-- pass handler
          />
        </div>
      </div>
      <div
        className="horizontal-divider"
        onMouseDown={handleHorizontalDragStart}
      >
        ═════
      </div>
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
        />
      </div>
      <SettingsModal 
        open={showSettings} 
        onClose={() => setShowSettings(false)} 
        labelScale={labelScale} 
        setLabelScale={setLabelScale}
        lang={lang}
        setLang={setLang}
        projectFolder={projectFolder}
        handleSelectProjectFolder={handleSelectProjectFolder}
      />
    </div>
  );
}

export default App;