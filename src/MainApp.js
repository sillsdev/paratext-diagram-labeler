import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import './MainApp.css';
import BottomPane from './BottomPane.js';
import uiStr from './data/ui-strings.json';
import { MAP_VIEW, TABLE_VIEW, STATUS_BLANK, STATUS_PARTIAL, STATUS_OK } from './constants.js';
import { collectionManager, getCollectionIdFromTemplate, findCollectionIdAndTemplate } from './CollectionManager';
import { getMapDef } from './MapData';
import { inLang, getStatus, getPlaceNameStatus, isLabelVisible } from './Utils.js';
import MapPane from './MapPane.js';
import TableView from './TableView.js';
import DetailsPane from './DetailsPane.js';
import SettingsModal from './SettingsModal.js';
import TemplateBrowser from './TemplateBrowser.js';
// import { useInitialization, InitializationProvider } from './InitializationProvider';
import { settingsService } from './services/SettingsService';
import { autocorrectService } from './services/AutocorrectService';
import labelTemplateParser from './services/LabelTemplateParser';
import labelDictionaryService from './services/LabelDictionaryService';
import labelTagRulesService from './services/LabelTagRulesService';

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
  // NEW architecture: collect refs from all terms in all placeNames
  const refSet = new Set();
  labels.forEach(label => {
    if (label.placeNameIds && label.placeNameIds.length > 0) {
      label.placeNameIds.forEach(placeNameId => {
        const terms = collectionManager.getTermsForPlace(placeNameId, collectionId) || [];
        terms.forEach(term => {
          if (term.refs) {
            term.refs.forEach(ref => refSet.add(ref));
          }
        });
      });
    }
  });
  const rl = Array.from(refSet).sort();
  console.log(
    `getRefList(): ${rl.length} refs for ${labels.length} labels from collection ${collectionId}`
  );
  return rl;
}

// Extract template name from USFM \fig field
function getTemplateNameFromUsfm(usfm) {
  // USFM only contains the \fig field - extract the template name from src attribute
  const figMatch = usfm.match(/\\fig [^\\]*src="([^\\]+)"[^\\]*\\fig\*/);
  
  if (!figMatch) {
    return null;
  }
  
  const templateName = figMatch[1]
    .replace(/\..*$/, '') // Remove file extension
    .trim()
    .replace(/\s*[@(].*/, ''); // Remove anything after @ or (

  return templateName;
}

function MainApp({ settings, collectionsFolder, onExit, termRenderings, setTermRenderings }) {
  //   console.log('MainApp initialized with collectionsFolder prop:', collectionsFolder);

  const [isInitialized, setIsInitialized] = useState(false);
  const projectFolder = settings?.projectFolder;
  const [lang, setLang] = useState(() => {
    // First check settings, then default to 'en'
    return settings?.language || 'en';
  });
  const [mapDef, setMapDef] = useState(emptyInitialMap);
  const [labels, setLabelsRaw] = useState([]);
  const [statusRecalcTrigger, setStatusRecalcTrigger] = useState({
    timestamp: 0,
    affectedPlaceNameId: null,  // String: which placeName's rendering changed
    affectedLabelMergeKey: null // String: which label's vernacular changed
  });
  
  // Wrapper to log all setLabels calls
  const setLabels = useCallback((newLabelsOrFn) => {
    const caller = new Error().stack.split('\n')[2]?.trim();
    console.log('[setLabels called]', caller?.substring(0, 100));
    setLabelsRaw(newLabelsOrFn);
  }, []);
  const [selectedLabelIndex, setSelectedLabelIndex] = useState(0);
  const [mapWidth, setMapWidth] = useState(70);
  const [topHeight, setTopHeight] = useState(80);
  const [renderings, setRenderings] = useState(''); // OBSOLETE: kept for BottomPane compatibility
  const [isApproved] = useState(false); // OBSOLETE: kept for DetailsPane compatibility (read-only)
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
  const [activeTab, setActiveTab] = useState(0); // Active placeName tab in DetailsPane
  const [isBottomPaneExpanded, setIsBottomPaneExpanded] = useState(false); // Toggle bottom pane width
  const isDraggingVertical = useRef(false);
  const isDraggingHorizontal = useRef(false);
  const vernacularInputRef = useRef(null);
  const renderingsTextareaRef = useRef();
  const handleBrowseMapTemplateRef = useRef();
  const [extractedVerses, setExtractedVerses] = useState({});
  // const [termRenderings, setTermRenderings] = useState(); 
  // const [termRenderingsLoading, setTermRenderingsLoading] = useState(false); // Guard against multiple loads
  
  // Track unsaved changes for .idml.txt files
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

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
      if (!settings || !settings.collectionsFolder || !projectFolder) {
        console.error('Collections or project folder setting is missing', settings);
        throw new Error('Collections or project folder setting is missing');
      }
      try {
        // Initialize Label Dictionary Service
        await labelDictionaryService.initialize(projectFolder);
        console.log('Label Dictionary Service initialized');
        
        // Initialize Label Tag Rules Service
        console.log('About to initialize Label Tag Rules Service with projectFolder:', projectFolder);
        console.log('labelTagRulesService object:', labelTagRulesService);
        await labelTagRulesService.initialize(projectFolder);
        console.log('Label Tag Rules Service initialized');
        
        // Use the collections folder prop instead of settings to ensure consistency
        await collectionManager.initializeAllCollections(collectionsFolder, projectFolder);
        setIsInitialized(true);
      } catch (collectionError) {
        console.error('Failed to initialize services:', collectionError);
        console.error('Error stack:', collectionError.stack);
      }
    };
    initializeColls();
  }, [settings, collectionsFolder, projectFolder]);

  // Update label status when data changes (but don't initialize labels - that's done in handleSelectDiagram)
  useEffect(() => {
    console.log('[Update Labels] useEffect triggered');
    if (!electronAPI || !projectFolder || !isInitialized || !mapDef || !mapDef.labels?.length) {
      console.log('[Update Labels] Skipping - insufficient data');
      return;
    }

    console.log('[Update Labels] Running...');
    try {
      // Update existing labels with status recalculation, preserving vernLabel values
      setLabels(prevLabels => {
        // Only update if we have existing labels - don't initialize from mapDef here
        if (prevLabels.length === 0) {
          console.log('[Update Labels] No labels yet - skipping (initialization happens in handleSelectDiagram)');
          return prevLabels;
        }
        
        // Update existing labels, preserving vernLabel values
        const collectionId = getCollectionIdFromTemplate(mapDef.template);
        return prevLabels.map(label => {
          // Recalculate status using per-placeName status
          const perPlaceStatus = {};
          if (label.placeNameIds && label.placeNameIds.length > 0) {
            label.placeNameIds.forEach(placeNameId => {
              const terms = collectionManager.getTermsForPlace(placeNameId, collectionId) || [];
              if (terms.length > 0) {
                perPlaceStatus[placeNameId] = getPlaceNameStatus(
                  termRenderings,
                  terms,
                  label.vernLabel || '',
                  extractedVerses,
                  placeNameId,
                  labelDictionaryService
                );
              }
            });
          }
          
          const status = Object.keys(perPlaceStatus).length > 0
            ? Math.min(...Object.values(perPlaceStatus))
            : 1; // STATUS_BLANK if no placeNames
          
          return { ...label, status, perPlaceStatus };
        });
      });
      // Only set selection to 0 if no valid selection exists
      if (
        mapDef.labels &&
        mapDef.labels.length > 0 &&
        (selectedLabelIndex >= mapDef.labels.length || selectedLabelIndex < 0)
      ) {
        setSelectedLabelIndex(0); // Select first label only if current selection is invalid
      }
    } catch (e) {
      console.log(`Error updating labels:`, e);
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectFolder, mapDef, isInitialized]); 

  // setExtractedVerses when projectFolder or template changes
  // Use a serialized version of placeNameIds to avoid re-fetching on every label update
  const placeNameIdsKey = useMemo(() => {
    if (!labels?.length) return '';
    return labels.map(l => l.placeNameIds?.join(',') || '').join(';');
  }, [labels]);

  useEffect(() => {
    if (!projectFolder || !labels?.length || !isInitialized || !placeNameIdsKey) return;

    const collectionId = getCollectionIdFromTemplate(mapDef.template);
    const refs = getRefList(labels, collectionId);
    if (!refs.length) {
      setExtractedVerses({});
      return;
    }

    electronAPI.getFilteredVerses(projectFolder, refs).then(verses => {
      console.log('[IPC] getFilteredVerses:', projectFolder, 'for refs:', refs.length);
      if (verses && !verses.error) {
        console.log('[IPC] Setting extractedVerses with', Object.keys(verses).length, 'verse keys');
        setExtractedVerses(verses);
      } else {
        console.log('[IPC] Setting empty extractedVerses (error or no verses)');
        setExtractedVerses({});
        alert(inLang(uiStr.failedToRequestVerses, lang) + (verses && verses.error ? ' ' + verses.error : ''));
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectFolder, placeNameIdsKey, mapDef.template, isInitialized, lang]);

  // Recalculate status when extractedVerses becomes available (but only update status, not the whole label)
  useEffect(() => {
    console.log('[Status Recalc] useEffect triggered - labels:', labels?.length, 'extractedVerses keys:', Object.keys(extractedVerses).length, 'trigger:', statusRecalcTrigger);
    if (!labels?.length || !Object.keys(extractedVerses).length) {
      console.log('[Status Recalc] Skipping - insufficient data');
      return;
    }

    const { affectedPlaceNameId, affectedLabelMergeKey } = statusRecalcTrigger;
    const isTargetedRecalc = affectedPlaceNameId || affectedLabelMergeKey;
    
    console.log('[Status Recalc] Running status recalculation...',
      isTargetedRecalc
        ? `targeted: ${affectedPlaceNameId ? `placeNameId=${affectedPlaceNameId}` : `mergeKey=${affectedLabelMergeKey}`}`
        : 'full recalc');
    console.log('[Status Recalc] termRenderings keys:', Object.keys(termRenderings).length);
    const collectionId = getCollectionIdFromTemplate(mapDef.template);
    console.log('[Status Recalc] About to call setLabels...');
    setLabels(prevLabels => {
      console.log('[Status Recalc] prevLabels:', prevLabels.length);
      const updatedLabels = prevLabels.map((label, idx) => {
      // Skip labels not affected by this change
      if (isTargetedRecalc) {
        if (affectedLabelMergeKey && label.mergeKey !== affectedLabelMergeKey) {
          return label; // Skip: different label
        }
        if (affectedPlaceNameId && !label.placeNameIds?.includes(affectedPlaceNameId)) {
          return label; // Skip: doesn't use this placeName
        }
      }
      // Calculate status for labels WITH placeNameIds
      if (label.placeNameIds && label.placeNameIds.length > 0) {
        const perPlaceStatus = {};
        label.placeNameIds.forEach(placeNameId => {
          const terms = collectionManager.getTermsForPlace(placeNameId, collectionId) || [];
          if (terms.length > 0) {
            perPlaceStatus[placeNameId] = getPlaceNameStatus(
              termRenderings,
              terms,
              label.vernLabel || '',
              extractedVerses,
              placeNameId,
              labelDictionaryService
            );
          }
        });

        const oldStatus = label.status;
        let calculatedStatus = Object.keys(perPlaceStatus).length > 0
          ? Math.min(...Object.values(perPlaceStatus))
          : STATUS_OK;
        
        // Check for STATUS_PARTIAL (contains 《》)
        const vernLabel = typeof label.vernLabel === 'string' ? label.vernLabel : (label.vernLabel || '');
        if (vernLabel && (vernLabel.includes('《') || vernLabel.includes('》')) && calculatedStatus > STATUS_PARTIAL) {
          calculatedStatus = STATUS_PARTIAL;
        }
        
        if (idx < 3) {
          console.log(`[Status Recalc] Label ${idx} (${label.mergeKey}): oldStatus=${oldStatus}, newStatus=${calculatedStatus}, perPlaceStatus=`, perPlaceStatus);
        }
        
        return { ...label, status: calculatedStatus, perPlaceStatus };
      }
      
      // Calculate status for labels WITHOUT placeNameIds (e.g., {r#REF}, {number#123})
      // These don't have terms/renderings to validate against, so only BLANK, PARTIAL, or OK:
      const vernLabel = typeof label.vernLabel === 'string' ? label.vernLabel.trim() : String(label.vernLabel || '').trim();
      let newStatus;
      if (!vernLabel) {
        newStatus = STATUS_BLANK;
      } else if (vernLabel && (vernLabel.includes('《') || vernLabel.includes('》'))) {
        newStatus = STATUS_PARTIAL;
      } else {
        newStatus = STATUS_OK;
      }
      
      if (idx < 3 || label.status !== newStatus) {
        console.log(`[Status Recalc] Label ${idx} (${label.mergeKey}): oldStatus=${label.status}, newStatus=${newStatus}, vernLabel="${vernLabel}"`);
      }
      
      return { ...label, status: newStatus };
    });
      
      // const sample = updatedLabels.slice(0, 3).map(l => `${l.mergeKey}:${l.status}`).join(', ');
      // console.log('[Status Recalc] Updated labels sample:', sample);
      return updatedLabels;
    });
    console.log('[Status Recalc] Status recalculation complete');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [extractedVerses, termRenderings, mapDef.template, statusRecalcTrigger.timestamp]);

  // Load autocorrect file when project folder or initialization state changes
  useEffect(() => {
    if (projectFolder && isInitialized) {
      autocorrectService.loadAutocorrectFile(projectFolder);
    }
  }, [projectFolder, isInitialized]);

  // Update renderings and approval status when selected label or term renderings change
  useEffect(() => {
    if (!termRenderings || !labels.length || selectedLabelIndex >= labels.length) return;

    const currentLabel = labels[selectedLabelIndex];
    if (!currentLabel) return;

    // In NEW architecture, renderings are handled per placeName in DetailsPane
    // No need to set top-level renderings here based on termId
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLabelIndex, termRenderings, labels]);

  // Handler to set the selected label (e.g. Label clicked)
  const handleSelectLabel = useCallback(
    label => {
      console.log('Selected label:', label);
      if (!label) return;
      setSelectedLabelIndex(label.idx);
      
      // Check joined terms and sync if needed
      const collectionId = getCollectionIdFromTemplate(mapDef.template);
      const placeNameIds = label.placeNameIds || [];
      
      placeNameIds.forEach(placeNameId => {
        const isJoined = labelDictionaryService.isJoined(placeNameId);
        if (!isJoined) return;
        
        const placeName = collectionManager.getPlaceName(placeNameId, collectionId);
        const terms = placeName?.terms || [];
        
        if (terms.length <= 1) return;
        
        // Get renderings for all terms
        const renderings = terms.map(t => termRenderings[t.termId]?.renderings || '');
        const nonEmpty = renderings.filter(r => r.trim());
        const uniqueNonEmpty = [...new Set(nonEmpty.map(r => r.trim().toLowerCase()))];
        
        // If renderings are identical, we're good
        if (uniqueNonEmpty.length <= 1) return;
        
        // If one is blank and others are identical, sync the blank to the non-blank
        if (nonEmpty.length === renderings.length - 1) {
          const masterRendering = nonEmpty[0];
          const updatedData = { ...termRenderings };
          terms.forEach(t => {
            if (!termRenderings[t.termId]?.renderings?.trim()) {
              updatedData[t.termId] = {
                ...updatedData[t.termId],
                renderings: masterRendering,
                isGuessed: false,
              };
            }
          });
          setTermRenderings(updatedData);
          console.log(`[handleSelectLabel] Synced blank rendering to match non-blank for joined placeName ${placeNameId}`);
        } else {
          // Multiple different non-empty renderings - unjoin
          labelDictionaryService.setJoined(placeNameId, false);
          console.log(`[handleSelectLabel] Unjoined placeName ${placeNameId} due to different renderings`);
        }
      });
    },
    [setSelectedLabelIndex, mapDef.template, termRenderings, setTermRenderings]
  );

  // Handler to update label with new vernacular, opCode, and status
  const handleUpdateVernacular = useCallback(
    (mergeKey, lblTemplate, newVernacular, opCode = 'sync') => {
      console.log(`[handleUpdateVernacular] mergeKey="${mergeKey}", newVernacular="${newVernacular}", opCode="${opCode}", lblTemplate="${lblTemplate}"`);
      
      // Update label vernacular and opCode (status will be recalculated via trigger)
      setLabels(prevLabels =>
        prevLabels.map(label =>
          label.mergeKey === mergeKey
            ? { ...label, vernLabel: newVernacular, opCode }
            : label
        )
      );
      
      // If opCode is 'sync', update Label Dictionary (in memory only - not saved to disk yet)
      if (opCode === 'sync' && lblTemplate) {
        labelDictionaryService.setVernacular(lblTemplate, newVernacular, 'sync');
      }
      
      // Mark as having unsaved changes
      setHasUnsavedChanges(true);
      
      // Trigger targeted status recalculation for this label only
      setStatusRecalcTrigger(prev => ({
        timestamp: prev.timestamp + 1,
        affectedPlaceNameId: null,
        affectedLabelMergeKey: mergeKey
      }));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // Handler to cycle forward or backward through labels
  const handleNextLabel = useCallback(
    fwd => {
      // Find all visible label indices
      const visibleIndices = labels
        .map((lbl, idx) => ({ lbl, idx }))
        .filter(({ lbl }) => isLabelVisible(lbl, selectedVariant))
        .map(({ idx }) => idx);

      if (visibleIndices.length === 0) return; // No visible labels

      const currentVisibleIndex = visibleIndices.indexOf(selectedLabelIndex);
      let nextVisibleIndex;

      if (fwd) {
        nextVisibleIndex = (currentVisibleIndex + 1) % visibleIndices.length;
      } else {
        nextVisibleIndex =
          (currentVisibleIndex - 1 + visibleIndices.length) % visibleIndices.length;
      }

      const nextLabelIndex = visibleIndices[nextVisibleIndex];
      const nextLabel = labels[nextLabelIndex];
      setSelectedLabelIndex(nextLabelIndex);
      handleSelectLabel(nextLabel);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [labels, selectedLabelIndex, handleSelectLabel, selectedVariant]
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
    // Use .main-layout for collapsed layout, .top-section for expanded layout
    const container = document.querySelector('.main-layout') || document.querySelector('.top-section');
    if (!container) {
      console.error('Main layout or top section not found');
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
  // OBSOLETE in NEW architecture - renderings are handled per placeName in DetailsPane
  const handleRenderingsChange = e => {
    // This handler is no longer used in the NEW architecture
    // Term renderings are managed per placeName in DetailsPane
  };

  // Handler for change in approved status.
  // OBSOLETE in NEW architecture - renderings are handled per placeName in DetailsPane
  const handleApprovedChange = e => {
    // This handler is no longer used in the NEW architecture
    // Term renderings are managed per placeName in DetailsPane
  };

  // Handler to save labels to .IDML.TXT file
  const handleSaveLabels = useCallback(async () => {
    try {
      // Build labels object: mergeKey -> vernLabel
      const labelsToSave = {};
      const opCodesToSave = {};
      labels.forEach(label => {
        if (label.mergeKey) {
          labelsToSave[label.mergeKey] = label.vernLabel || '';
          opCodesToSave[label.mergeKey] = label.opCode || 'sync';
        }
      });
      
      const result = await electronAPI.saveLabelsToIdmlTxt(
        projectFolder,
        mapDef.template,
        labelsToSave,
        opCodesToSave
      );
      
      if (result.success) {
        setHasUnsavedChanges(false);
        console.log('Labels saved successfully to .IDML.TXT file:', result.filePath);
        
        // Sync all labels with opCode='sync' to the Label Dictionary
        try {
          await labelDictionaryService.syncLabelsToDict(labels);
          console.log('Label Dictionary synced successfully');
        } catch (dictError) {
          console.error('Error syncing Label Dictionary:', dictError);
          // Don't fail the entire save operation if dictionary sync fails
        }
      } else {
        console.error('Failed to save labels:', result.error);
        alert(inLang(uiStr.errorSavingLabels, lang) + ': ' + result.error);
      }
    } catch (error) {
      console.error('Error saving labels:', error);
      alert(inLang(uiStr.errorSavingLabels, lang) + ': ' + error.message);
    }
  }, [mapDef.template, labels, projectFolder, lang]);

  // Handler to revert labels to last saved state
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
  const loadTemplate = useCallback(async (templateName, figFilename = null, isJpg = false, imgPath = null) => {
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

      // Set mapDef and labels
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

      // Enhanced label mapping with NEW architecture
      const newLabels = foundTemplate.labels.map(label => {
        // Get lblTemplate from CollectionManager
        const lblTemplate = collectionManager.getLabelTemplate(label.mergeKey, collectionId) || label.mergeKey;
        
        // Parse template to extract placeNameIds
        const parsed = labelTemplateParser.parseTemplate(lblTemplate);
        const placeNameIds = parsed.placeNameIds || [];
        
        // Get vernacular from Label Dictionary (default opCode='sync')
        const dictVernacular = labelDictionaryService.getVernacular(lblTemplate);
        const opCode = 'sync'; // Default, will be overridden from @project.json later
        
        // Get gloss with priority: mergekeys.gloss > placenames.gloss > core-placenames.gloss
        const gloss = collectionManager.getGlossForMergeKey(label.mergeKey, collectionId);
        
        // Calculate per-placeName status
        const perPlaceStatus = {};
        placeNameIds.forEach(placeNameId => {
          const terms = collectionManager.getTermsForPlace(placeNameId, collectionId) || [];
          if (terms.length > 0) {
            perPlaceStatus[placeNameId] = getPlaceNameStatus(
              currentTermRenderings,
              terms,
              dictVernacular || '',
              extractedVerses,
              placeNameId,
              labelDictionaryService
            );
          }
        });
        
        // Label status = most severe of all placeNames (if any)
        const status = Object.keys(perPlaceStatus).length > 0
          ? Math.min(...Object.values(perPlaceStatus))
          : getStatus(
              currentTermRenderings,
              label.termId,
              label.vernLabel || '',
              collectionManager.getRefs(label.mergeKey, collectionId),
              extractedVerses
            );
        
        return { 
          ...label, 
          lblTemplate,
          placeNameIds,
          gloss,
          vernLabel: dictVernacular || label.vernLabel || '', 
          opCode,
          status,
          perPlaceStatus
        };
      });
      
      // Load saved labels from .IDML.TXT file and accompanying JSON file
      let savedIdmlLabels = {};
      let savedOpCodes = {};
      try {
        const result = await electronAPI.loadLabelsFromIdmlTxt(projectFolder, exactTemplateName);
        if (result.success && result.labels) {
          savedIdmlLabels = result.labels;
          savedOpCodes = result.opCodes || {};
          console.log('Loaded saved labels from .IDML.TXT file:', savedIdmlLabels);
          console.log('Loaded opCodes from JSON file:', savedOpCodes);
        }
      } catch (error) {
        console.error('Error loading .IDML.TXT file:', error);
      }
      
      // First pass: Load everything from saved files, using saved values
      const initialLabels = await Promise.all(newLabels.map(async label => {
        let finalVernLabel = '';
        let finalOpCode = 'sync'; // default
        
        if (savedIdmlLabels.hasOwnProperty(label.mergeKey)) {
          // Label was in saved data - use saved values exactly as they were
          finalVernLabel = savedIdmlLabels[label.mergeKey];
          finalOpCode = savedOpCodes[label.mergeKey] || 'sync';
          
          // Apply opCode rules
          if (finalOpCode === 'omit') {
            finalVernLabel = ''; // omit means blank
          }
        } else {
          // Not in saved data - try dictionary first
          const dictValue = labelDictionaryService.getVernacular(label.lblTemplate);
          
          if (dictValue) {
            finalVernLabel = dictValue;
            finalOpCode = 'sync';
          } else {
            // Not in saved data, not in dictionary - try other fallbacks
            const mergeKeyData = collectionManager.getMergeKeys(collectionId)[label.mergeKey];
            
            if (mergeKeyData?.altTermIds) {
              // Try altTermIds for backwards compatibility
              const altTermIds = mergeKeyData.altTermIds.split(/,\s*/);
              for (const termId of altTermIds) {
                const termData = currentTermRenderings[termId];
                if (termData?.renderings) {
                  const patterns = termData.renderings.split('||').map(p => p.trim()).filter(p => p);
                  if (patterns.length > 0) {
                    // Strip wildcards and comments from first pattern
                    finalVernLabel = patterns[0].replace(/\*/g, '').replace(/\/\/.*$/, '').trim();
                    break;
                  }
                }
              }
            }
            
            if (!finalVernLabel && label.lblTemplate) {
              // Check if template contains curly braces
              if (label.lblTemplate.includes('{')) {
                // Use resolveTemplate functionality
                const resolved = await collectionManager.resolveTemplate(label.lblTemplate, collectionId, currentTermRenderings, projectFolder);
                finalVernLabel = resolved?.literalText || '';
              } else {
                // No curly braces, leave blank
                finalVernLabel = '';
              }
            }
          }
        }

        // Return label with values from saved state (or fallbacks if not saved)
        return { 
          ...label, 
          vernLabel: finalVernLabel,
          opCode: finalOpCode,
          status: 1, 
          perPlaceStatus: {} 
        };
      }));
      
      // Clear unsaved changes flag
      setHasUnsavedChanges(false);
      
      // Second pass: Check for sync labels that differ from dictionary
      const syncDifferences = [];
      initialLabels.forEach(label => {
        if (label.opCode === 'sync' && label.lblTemplate) {
          const dictValue = labelDictionaryService.getVernacular(label.lblTemplate);
          if (dictValue && dictValue !== label.vernLabel) {
            if (!label.vernLabel || label.vernLabel.trim() === '') {
              // Saved value was blank — silently adopt dictionary value
              label.vernLabel = dictValue;
            } else {
              syncDifferences.push({
                mergeKey: label.mergeKey,
                gloss: inLang(label.gloss || { en: label.mergeKey }, lang),
                savedValue: label.vernLabel || '',
                dictValue: dictValue
              });
            }
          }
        }
      });
      
      // If there are differences, prompt user
      if (syncDifferences.length > 0) {
        const userChoice = await new Promise(resolve => {
          const overlay = document.createElement('div');
          overlay.style.cssText = 'position:fixed;left:0;top:0;width:100vw;height:100vh;z-index:10000;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;';
          
          const dialog = document.createElement('div');
          dialog.style.cssText = 'background:white;border-radius:10px;padding:24px;max-width:800px;max-height:80vh;overflow:auto;box-shadow:0 4px 24px rgba(0,0,0,0.3);';
          
          const title = document.createElement('h3');
          title.textContent = inLang(uiStr.syncDifferencesTitle || { en: 'Dictionary Sync Differences' }, lang);
          title.style.marginTop = '0';
          
          const message = document.createElement('p');
          message.textContent = inLang(uiStr.syncDifferencesMessage || { en: 'The following labels differ from the dictionary, and are marked for sync:' }, lang);
          
          const table = document.createElement('table');
          table.style.cssText = 'width:100%;border-collapse:collapse;margin:16px 0;';
          table.innerHTML = `
            <thead>
              <tr style="border-bottom:2px solid #ccc;">
                <th style="padding:8px;text-align:left;">${inLang(uiStr.gloss || { en: 'Gloss' }, lang)}</th>
                <th style="padding:8px;text-align:left;">${inLang(uiStr.previouslySaved || { en: 'Previously Saved' }, lang)}</th>
                <th style="padding:8px;text-align:left;">${inLang(uiStr.dictionary || { en: 'Dictionary' }, lang)}</th>
              </tr>
            </thead>
            <tbody>
              ${syncDifferences.map(diff => `
                <tr style="border-bottom:1px solid #eee;">
                  <td style="padding:8px;">${diff.gloss}</td>
                  <td style="padding:8px;">${diff.savedValue}</td>
                  <td style="padding:8px;font-weight:bold;">${diff.dictValue}</td>
                </tr>
                <tr>
                  <td></td>
                  <td style="padding:4px 8px;">
                    <button class="override-btn" data-mergekey="${diff.mergeKey}" style="padding:6px 12px;border-radius:4px;border:1px solid #ff9800;background:#fff3e0;cursor:pointer;width:100%;">${inLang(uiStr.setToOverride || { en: 'Keep this (override)' }, lang)}</button>
                  </td>
                  <td style="padding:4px 8px;">
                    <button class="update-btn" data-mergekey="${diff.mergeKey}" style="padding:6px 12px;border-radius:4px;border:1px solid #4caf50;background:#4caf50;color:white;cursor:pointer;width:100%;">${inLang(uiStr.updateFromDictionary || { en: 'Update with this (sync)' }, lang)}</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          `;
          
          // Add event listeners to buttons in table
          dialog.appendChild(title);
          dialog.appendChild(message);
          dialog.appendChild(table);
          
          // Track choices for each label - preselect 'update' for all
          const choices = {};
          syncDifferences.forEach(diff => {
            choices[diff.mergeKey] = 'update';
          });
          
          table.querySelectorAll('.override-btn').forEach(btn => {
            btn.onclick = () => {
              const mergeKey = btn.getAttribute('data-mergekey');
              choices[mergeKey] = 'override';
              btn.style.background = '#ff9800';
              btn.style.color = 'white';
              const updateBtn = table.querySelector(`.update-btn[data-mergekey="${mergeKey}"]`);
              if (updateBtn) {
                updateBtn.style.background = '#f0fbf1';
                updateBtn.style.color = 'black';
              }
            };
          });
          
          table.querySelectorAll('.update-btn').forEach(btn => {
            // Preselect update buttons visually
            btn.style.background = '#2e7d32';
            btn.style.color = 'white';
            
            btn.onclick = () => {
              const mergeKey = btn.getAttribute('data-mergekey');
              choices[mergeKey] = 'update';
              btn.style.background = '#2e7d32';
              btn.style.color = 'white';
              const overrideBtn = table.querySelector(`.override-btn[data-mergekey="${mergeKey}"]`);
              if (overrideBtn) {
                overrideBtn.style.background = '#fff3e0';
                overrideBtn.style.color = 'black';
              }
            };
          });
          
          const doneBtn = document.createElement('button');
          doneBtn.textContent = inLang(uiStr.ok || { en: 'OK' }, lang);
          doneBtn.style.cssText = 'padding:8px 16px;border-radius:4px;border:1px solid #1976d2;background:#1976d2;color:white;cursor:pointer;margin-top:16px;float:right;';
          doneBtn.onclick = () => { document.body.removeChild(overlay); resolve(choices); };
          
          dialog.appendChild(doneBtn);
          overlay.appendChild(dialog);
          document.body.appendChild(overlay);
        });
        
        // Process each label's choice
        let hasChanges = false;
        syncDifferences.forEach(diff => {
          const choice = userChoice[diff.mergeKey];
          const labelIndex = initialLabels.findIndex(l => l.mergeKey === diff.mergeKey);
          if (labelIndex !== -1) {
            if (choice === 'update') {
              // Update label from dictionary
              initialLabels[labelIndex].vernLabel = diff.dictValue;
              hasChanges = true;
            } else if (choice === 'override') {
              // Set opCode to override to keep saved value
              initialLabels[labelIndex].opCode = 'override';
              hasChanges = true;
            }
          }
        });
        if (hasChanges) {
          setHasUnsavedChanges(true);
        }
      }
      // Auto-join terms with identical or single non-empty renderings
      const updatedTermRenderings = { ...termRenderings };
      initialLabels.forEach(label => {
        const placeNameIds = label.placeNameIds || [];
        
        placeNameIds.forEach(placeNameId => {
          const placeName = collectionManager.getPlaceName(placeNameId, collectionId);
          const terms = placeName?.terms || [];
          
          if (terms.length <= 1) return;
          
          // Get renderings for all terms
          const renderings = terms.map(t => updatedTermRenderings[t.termId]?.renderings || '');
          const nonEmpty = renderings.filter(r => r.trim());
          const uniqueNonEmpty = [...new Set(nonEmpty.map(r => r.trim().toLowerCase()))];
          
          // If all identical or at most one non-empty, auto-join
          if (uniqueNonEmpty.length <= 1) {
            // Sync all terms to the same rendering
            if (nonEmpty.length > 0) {
              const masterRendering = nonEmpty[0];
              const anyApproved = terms.some(t => updatedTermRenderings[t.termId] && !updatedTermRenderings[t.termId].isGuessed);
              
              terms.forEach(t => {
                updatedTermRenderings[t.termId] = {
                  ...updatedTermRenderings[t.termId],
                  renderings: masterRendering,
                  isGuessed: anyApproved ? false : (updatedTermRenderings[t.termId]?.isGuessed ?? false),
                };
              });
            }
            
            // Set as joined
            labelDictionaryService.setJoined(placeNameId, true);
            console.log(`[loadTemplate] Auto-joined placeName ${placeNameId} (${terms.length} terms)`);
          }
        });
      });
      
      // Update term renderings state with auto-joined values
      setTermRenderings(updatedTermRenderings);
      
      console.log('Initial labels:', initialLabels);
      const medLabel = initialLabels.find(l => l.mergeKey === 'mediterranean_sea');
      if (medLabel) {
        console.log('[mediterranean_sea] vernLabel after initialization:', medLabel.vernLabel);
      }
      setLabels(initialLabels);

      // Find first visible label for initial selection
      const firstVisibleIndex = initialLabels.findIndex(label =>
        isLabelVisible(
          label,
          foundTemplate.variants && Object.keys(foundTemplate.variants).length > 0 ? 1 : 0
        )
      );
      if (firstVisibleIndex !== -1) {
        handleSelectLabel(initialLabels[firstVisibleIndex]); // Auto-select first visible label
      }
      setMapPaneView(MAP_VIEW); // Map View
      setResetZoomFlag(true); // Reset zoom on new map
    } catch (e) {
      console.error('Error loading template:', e);
      alert(inLang(uiStr.errorLoadingTemplate, lang) + ': ' + e.message);
    }
  }, [
    setMapDef,
    setLabels,
    termRenderings,
    lang,
    handleSelectLabel,
    extractedVerses,
    projectFolder,
    setSelectedVariant,
    setHasUnsavedChanges,
    setMapPaneView,
    setResetZoomFlag,
    setTermRenderings
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ]);

  // Reset/revert handler - reloads the current template from scratch
  const handleRevertLabels = useCallback(async () => {
    // Reset by reloading the current template from scratch
    const currentTemplate = mapDef.template;
    const currentFig = mapDef.fig;
    const currentMapView = mapDef.mapView;
    
    console.log('[Reset] Reloading template:', currentTemplate);
    
    // Clear unsaved changes flag immediately
    setHasUnsavedChanges(false);
    
    // Reload label dictionary from disk to discard in-memory changes
    console.log('[Reset] Reloading label dictionary from disk...');
    await labelDictionaryService.loadAll();
    
    // Reload the template - this will reset all labels to their initial state
    await loadTemplate(currentTemplate, currentFig, false, currentMapView);
    
    // Trigger full status recalculation after reset
    console.log('[Reset] Triggering status recalculation...');
    setStatusRecalcTrigger(prev => ({
      timestamp: prev.timestamp + 1,
      affectedPlaceNameId: null,
      affectedLabelMergeKey: null
    }));
    
    console.log('[Reset] Template reloaded');
  }, [mapDef.template, mapDef.fig, mapDef.mapView, loadTemplate]);

  // Store the function in a ref for stable reference
  useEffect(() => {
    handleBrowseMapTemplateRef.current = handleBrowseMapTemplate;
  }, [handleBrowseMapTemplate]);

  // Template browser selection handlers
  const handleSelectDiagram = useCallback(async (template, filters, group, index) => {
    console.log('Selected diagram:', template);
    if (!template || !template.templateName) {
      console.error('Invalid template object:', template);
      alert(inLang(uiStr.noTemplate, lang) + ': ' + (template ? JSON.stringify(template) : 'null'));
      return;
    }
    setShowTemplateBrowser(false);
    setTemplateFilters(filters);
    setTemplateGroup(null);
    setTemplateGroupIndex(-1); // No group navigation
    
    // Load the selected template
    await loadTemplate(template.templateName);
  }, [loadTemplate, lang]);

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
    if (!templateGroup || templateGroup.length === 0) return;
    
    // Check for unsaved changes
    const canProceed = await promptUnsavedChanges();
    if (!canProceed) return;
    
    // Wrap around: if at first item, go to last
    const newIndex = templateGroupIndex <= 0 
      ? templateGroup.length - 1 
      : templateGroupIndex - 1;
    const template = templateGroup[newIndex];
    setTemplateGroupIndex(newIndex);
    
    // Load the previous template
    await loadTemplate(template.templateName);
  }, [templateGroup, templateGroupIndex, promptUnsavedChanges, loadTemplate]);

  const handleNextTemplate = useCallback(async () => {
    if (!templateGroup || templateGroup.length === 0) return;
    
    // Check for unsaved changes
    const canProceed = await promptUnsavedChanges();
    if (!canProceed) return;
    
    // Wrap around: if at last item, go to first
    const newIndex = templateGroupIndex >= templateGroup.length - 1 
      ? 0 
      : templateGroupIndex + 1;
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
          // Extract template name from USFM and load the template
          const templateName = getTemplateNameFromUsfm(settings.usfm);
          if (!templateName) {
            console.log('No template specified in USFM, browsing for template instead.');  
            await handleBrowseMapTemplateRef.current();
            return;
          }
          console.log('Template name from USFM:', templateName);
          // Use loadTemplate to load the selected template (same as handleSelectDiagram)
          try {
            await loadTemplate(templateName);
          } catch (loadError) {
            console.error('Error loading template from USFM:', loadError);
            throw loadError; // Re-throw to be caught by outer try-catch
          }
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

  // USFM View mode removed - USFM is now only used for initial template selection
  // handleSwitchView now only toggles between Map View and Table View
  const handleSwitchView = useCallback(() => {
    setMapPaneView(prev =>
      prev === MAP_VIEW ? TABLE_VIEW : MAP_VIEW
    );
    // Refresh label statuses on view switch
    setStatusRecalcTrigger(prev => ({
      timestamp: prev.timestamp + 1,
      affectedPlaceNameId: null,
      affectedLabelMergeKey: null
    }));
  }, []);

  // Add rendering from bottom pane selection
  const handleAddRendering = useCallback(
    text => {
      if (!text || selectedLabelIndex < 0 || !labels[selectedLabelIndex]) return;
      
      const currentLabel = labels[selectedLabelIndex];
      const collectionId = getCollectionIdFromTemplate(mapDef.template);
      const placeNameId = currentLabel.placeNameIds?.[0]; // Use first placeName
      
      if (!placeNameId) return;
      
      const placeName = collectionManager.getPlaceName(placeNameId, collectionId);
      const terms = placeName?.terms || [];
      
      if (terms.length === 0) return;
      
      // Add to all terms for this placeName (or first term if not joined)
      const updatedData = { ...termRenderings };
      const isJoined = labelDictionaryService.isJoined(placeNameId);
      const termsToUpdate = isJoined ? terms : [terms[0]];
      
      termsToUpdate.forEach(term => {
        const existing = updatedData[term.termId]?.renderings || '';
        const patterns = existing ? existing.split('||').map(p => p.trim()) : [];
        const newPattern = text.trim();
        
        // Only add if not already present
        if (newPattern && !patterns.some(p => p.toLowerCase() === newPattern.toLowerCase())) {
          patterns.push(newPattern);
          updatedData[term.termId] = {
            ...updatedData[term.termId],
            renderings: patterns.join('||'),
            isGuessed: false,
          };
        }
      });
      
      setTermRenderings(updatedData);
      setStatusRecalcTrigger(prev => ({
        timestamp: prev.timestamp + 1,
        affectedPlaceNameId: placeNameId,
        affectedLabelMergeKey: null
      }));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedLabelIndex, labels, termRenderings, mapDef.template]
  );

  // Replace all renderings with selected text (from bottom pane)
  const handleReplaceRendering = useCallback(
    text => {
      if (!text || selectedLabelIndex < 0 || !labels[selectedLabelIndex]) return;
      
      const currentLabel = labels[selectedLabelIndex];
      const collectionId = getCollectionIdFromTemplate(mapDef.template);
      const placeNameId = currentLabel.placeNameIds?.[0]; // Use first placeName
      
      if (!placeNameId) return;
      
      const placeName = collectionManager.getPlaceName(placeNameId, collectionId);
      const terms = placeName?.terms || [];
      
      if (terms.length === 0) return;
      
      const newPattern = text.trim();
      if (!newPattern) return;
      
      // Replace for all terms for this placeName (or first term if not joined)
      const updatedData = { ...termRenderings };
      const isJoined = labelDictionaryService.isJoined(placeNameId);
      const termsToUpdate = isJoined ? terms : [terms[0]];
      
      termsToUpdate.forEach(term => {
        updatedData[term.termId] = {
          ...updatedData[term.termId],
          renderings: newPattern,
          isGuessed: false,
        };
      });
      
      setTermRenderings(updatedData);
      
      // Also update the label with the new text
      handleUpdateVernacular(
        currentLabel.mergeKey,
        currentLabel.lblTemplate || currentLabel.mergeKey,
        newPattern,
        currentLabel.opCode || 'sync'
      );
      
      setStatusRecalcTrigger(prev => ({
        timestamp: prev.timestamp + 1,
        affectedPlaceNameId: placeNameId,
        affectedLabelMergeKey: null
      }));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedLabelIndex, labels, termRenderings, mapDef.template, handleUpdateVernacular]
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
      const allRefs = getRefList(labels, collectionId);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [projectFolder, isInitialized, mapDef.template, labels]
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
      // Auto-save enabled for all views
      // Ctrl+9 triggers zoom reset
      if (e.ctrlKey && (e.key === '9' || e.code === 'Digit9')) {
        console.log('Resetting zoom');
        setResetZoomFlag(true);
        e.preventDefault();
        return;
      }
      if (e.key === 'PageDown') {
        handleNextLabel(true);
        e.preventDefault();
      } else if (e.key === 'PageUp') {
        handleNextLabel(false);
        e.preventDefault();
      }
    }
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [mapPaneView, handleNextLabel]); // Remove mapDef, mapRef from deps

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Add listener for refresh-label-statuses event from menu (Ctrl+R)
  useEffect(() => {
    if (electronAPI && electronAPI.onRefreshLabelStatuses) {
      const handleRefreshLabelStatuses = () => {
        console.log('Refresh Label Statuses triggered from menu');
        setStatusRecalcTrigger(prev => ({
          timestamp: prev.timestamp + 1,
          affectedPlaceNameId: null,
          affectedLabelMergeKey: null,
        }));
      };

      electronAPI.onRefreshLabelStatuses(handleRefreshLabelStatuses);

      return () => {
        if (electronAPI.removeRefreshLabelStatusesListener) {
          electronAPI.removeRefreshLabelStatusesListener(handleRefreshLabelStatuses);
        }
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Add listeners for navigation events from menu
  useEffect(() => {
    if (electronAPI && electronAPI.onNextLabel && electronAPI.onPreviousLabel) {
      const handleNextLabelMenu = () => {
        console.log('Next Label triggered from menu');
        handleNextLabel(true);
      };
      
      const handlePreviousLabelMenu = () => {
        console.log('Previous Label triggered from menu');
        handleNextLabel(false);
      };
      
      electronAPI.onNextLabel(handleNextLabelMenu);
      electronAPI.onPreviousLabel(handlePreviousLabelMenu);
      
      return () => {
        if (electronAPI.removeNextLabelListener) {
          electronAPI.removeNextLabelListener(handleNextLabelMenu);
        }
        if (electronAPI.removePreviousLabelListener) {
          electronAPI.removePreviousLabelListener(handlePreviousLabelMenu);
        }
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Memoize labels and mapDef to prevent MapPane remounts
  const memoizedLabels = useMemo(() => labels, [labels]);
  const memoizedMapDef = useMemo(() => mapDef, [mapDef]);
  const memoizedHandleSelectLabel = useCallback(handleSelectLabel, [handleSelectLabel]);

  // Extract the current collection ID from the template name
  const currentCollectionId = useMemo(() => {
    return getCollectionIdFromTemplate(mapDef.template);
  }, [mapDef.template]);

  // Function to update locations when denials change
  const handleDenialsChanged = useCallback(() => {
    // Make sure we're using the latest term renderings state
    const currentTermRenderings = { ...termRenderings };

    setLabels(prevLabels =>
      prevLabels.map(label => {
        const status = getStatus(
          currentTermRenderings,
          label.termId,
          label.vernLabel || '',
          collectionManager.getRefs(label.mergeKey, getCollectionIdFromTemplate(mapDef.template)),
          extractedVerses
        );
        return { ...label, status };
      })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

    const templateName = memoizedMapDef.template;
    const folder = collectionsFolder || settings.collectionsFolder;

    console.log('Loading image:', { 
      templateName, 
      imageFilename, 
      collectionsFolder: folder, 
      lang, 
      variant: selectedVariant 
    });

    // Use the new IPC function to load the image with language fallback
    if (window.electronAPI && window.electronAPI.loadImageWithFallback) {
      window.electronAPI
        .loadImageWithFallback(folder, templateName, imageFilename, lang, false) // isPreview = false for Map View
        .then(data => {
          if (data) {
            setImageData(data);
            console.log('Image loaded successfully through IPC with fallback');
          } else {
            console.error(`Failed to load image: ${imageFilename} for template: ${templateName}`);
            setImageData(null); // null indicates error
            setImageError(`Could not load map image: ${imageFilename}`);
          }
        })
        .catch(err => {
          console.error(`Error loading image: ${imageFilename}`, err);
          setImageData(null); // null indicates error
          setImageError(`Error loading map image: ${err.message || 'Unknown error'}`);
        });
    } else {
      console.error('electronAPI.loadImageWithFallback not available');
      setImageData(null); // null indicates error
      setImageError('Electron API not available. Cannot load images.');
    }
  }, [
    memoizedMapDef.imgFilename, 
    memoizedMapDef.variants,
    memoizedMapDef.template,
    selectedVariant,
    isInitialized, 
    settings, 
    collectionsFolder,
    lang
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
      const currentLabel = labels[selectedLabelIndex];
      if (!currentLabel || !isLabelVisible(currentLabel, newVariantId)) {
        // Find first visible label
        const firstVisibleIndex = labels.findIndex(lbl => isLabelVisible(lbl, newVariantId));
        if (firstVisibleIndex !== -1) {
          setSelectedLabelIndex(firstVisibleIndex);
        }
      }
    },
    [labels, selectedLabelIndex]
  );

  // Status recalculation is now handled by the dedicated useEffect above (lines 481-529)
  // that uses per-placeName status calculation for NEW architecture

  return (
    <div className="app-container">
      {!isBottomPaneExpanded ? (
        // Collapsed layout: Map + Bottom on left, Details full-height on right
        <div className="main-layout" style={{ display: 'flex', flex: 1, minHeight: 0 }}>
          <div className="left-column" style={{ 
            display: 'flex', 
            flexDirection: 'column',
            flex: `0 0 ${mapWidth}%`,
            minWidth: 0,
            minHeight: 0
          }}>
            <div className="map-pane" style={{ flex: `0 0 ${topHeight}%`, minHeight: 0 }}>
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
                labels={memoizedLabels}
                onSelectLabel={memoizedHandleSelectLabel}
                selectedLabelIndex={selectedLabelIndex}
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
              labels={labels}
              selectedLabelIndex={selectedLabelIndex}
              onSelectLabel={handleSelectLabel}
              onUpdateVernacular={handleUpdateVernacular}
              termRenderings={termRenderings}
              onNextLabel={handleNextLabel}
              lang={lang} // <-- pass lang
              extractedVerses={extractedVerses}
              collectionId={currentCollectionId} // Pass the collection ID
              selectedVariant={selectedVariant} // Pass selected variant
            />
          )}
          {/* USFM View removed - USFM only used for template selection */}
            </div>
            <div className="horizontal-divider" onMouseDown={handleHorizontalDragStart}>
              ═════
            </div>
            <div className="bottom-pane" style={{ flex: `0 0 ${100 - topHeight}%`, position: 'relative' }}>
              <button
                onClick={() => setIsBottomPaneExpanded(!isBottomPaneExpanded)}
                style={{
                  position: 'absolute',
                  top: '5px',
                  right: '5px',
                  zIndex: 100,
                  padding: '4px 8px',
                  cursor: 'pointer',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  background: 'white',
                  fontSize: '14px'
                }}
                title={isBottomPaneExpanded ? 'Collapse to map width' : 'Expand to full width'}
              >
                {isBottomPaneExpanded ? '⮜' : '⮞'}
              </button>
              <BottomPane
                placeNameIds={labels[selectedLabelIndex]?.placeNameIds || []}
                activeTab={activeTab}
                mergeKey={labels[selectedLabelIndex]?.mergeKey}
                onAddRendering={handleAddRendering}
                onReplaceRendering={handleReplaceRendering}
                lang={lang}
                termRenderings={termRenderings}
                setRenderings={setRenderings}
                onDenialsChanged={handleDenialsChanged}
                extractedVerses={extractedVerses}
                setTermRenderings={setTermRenderings}
                collectionId={currentCollectionId}
                onReloadExtractedVerses={handleReloadExtractedVerses}
              />
            </div>
          </div>
          <div
            className="vertical-divider"
            onMouseDown={handleVerticalDragStart}
            dangerouslySetInnerHTML={{ __html: '‖<br />‖' }}
          />
          <div className="details-pane" style={{ flex: `0 0 ${100 - mapWidth}%`, display: 'flex', flexDirection: 'column' }}>
            <DetailsPane
            selectedLabelIndex={selectedLabelIndex}
            onUpdateVernacular={handleUpdateVernacular}
            onNextLabel={handleNextLabel}
            renderings={renderings}
            isApproved={isApproved}
            onRenderingsChange={handleRenderingsChange}
            onApprovedChange={handleApprovedChange}
            termRenderings={termRenderings}
            labels={labels}
            onTriggerStatusRecalc={(placeNameId = null) => {
              setStatusRecalcTrigger(prev => ({
                timestamp: prev.timestamp + 1,
                affectedPlaceNameId: placeNameId,
                affectedLabelMergeKey: null
              }));
            }}
            onSwitchView={handleSwitchView}
            mapPaneView={mapPaneView}
            onSetView={async viewIdx => {
              if (viewIdx === MAP_VIEW && !mapDef.mapView) return;
              // USFM view removed
              setMapPaneView(viewIdx);
              // Refresh label statuses on view switch
              setStatusRecalcTrigger(prev => ({
                timestamp: prev.timestamp + 1,
                affectedPlaceNameId: null,
                affectedLabelMergeKey: null
              }));
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
            activeTab={activeTab} // Pass active placeName tab
            onActiveTabChange={setActiveTab} // Pass tab change handler
          />
          </div>
        </div>
      ) : (
        // Expanded layout: Map left, Details right (top), Bottom below both
        <>
          <div className="top-section" style={{ flex: `0 0 ${topHeight}%` }}>
            <div className="map-pane" style={{ flex: `0 0 ${mapWidth}%` }}>
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
                  )}
                  <MapPane
                    imageUrl={imageData}
                    labels={memoizedLabels}
                    onSelectLabel={memoizedHandleSelectLabel}
                    selectedLabelIndex={selectedLabelIndex}
                    labelScale={labelScale}
                    labelOpacity={labelOpacity}
                    mapDef={memoizedMapDef}
                    termRenderings={termRenderings}
                    lang={lang}
                    resetZoomFlag={resetZoomFlag}
                    setResetZoomFlag={setResetZoomFlag}
                    extractedVerses={extractedVerses}
                    collectionId={currentCollectionId}
                    showFrac={showFrac}
                    selectedVariant={selectedVariant}
                  />
                </>
              )}
              {mapPaneView === TABLE_VIEW && (
                <TableView
                  labels={labels}
                  selectedLabelIndex={selectedLabelIndex}
                  onSelectLabel={handleSelectLabel}
                  onUpdateVernacular={handleUpdateVernacular}
                  termRenderings={termRenderings}
                  onNextLabel={handleNextLabel}
                  lang={lang}
                  extractedVerses={extractedVerses}
                  collectionId={currentCollectionId}
                  selectedVariant={selectedVariant}
                />
              )}
            </div>
            <div
              className="vertical-divider"
              onMouseDown={handleVerticalDragStart}
              dangerouslySetInnerHTML={{ __html: '‖<br />‖' }}
            />
            <div className="details-pane" style={{ flex: `0 0 ${100 - mapWidth}%` }}>
              <DetailsPane
                selectedLabelIndex={selectedLabelIndex}
                onUpdateVernacular={handleUpdateVernacular}
                onNextLabel={handleNextLabel}
                renderings={renderings}
                isApproved={isApproved}
                onRenderingsChange={handleRenderingsChange}
                onApprovedChange={handleApprovedChange}
                termRenderings={termRenderings}
                labels={labels}
                onTriggerStatusRecalc={(placeNameId = null) => {
                  setStatusRecalcTrigger(prev => ({
                    timestamp: prev.timestamp + 1,
                    affectedPlaceNameId: placeNameId,
                    affectedLabelMergeKey: null
                  }));
                }}
                onSwitchView={handleSwitchView}
                mapPaneView={mapPaneView}
                onSetView={async viewIdx => {
                  if (viewIdx === MAP_VIEW && !mapDef.mapView) return;
                  setMapPaneView(viewIdx);
                  // Refresh label statuses on view switch
                  setStatusRecalcTrigger(prev => ({
                    timestamp: prev.timestamp + 1,
                    affectedPlaceNameId: null,
                    affectedLabelMergeKey: null
                  }));
                }}
                onShowSettings={() => setShowSettings(true)}
                mapDef={mapDef}
                onBrowseMapTemplate={handleBrowseMapTemplate}
                vernacularInputRef={vernacularInputRef}
                renderingsTextareaRef={renderingsTextareaRef}
                lang={lang}
                setTermRenderings={setTermRenderings}
                onCreateRendering={handleReplaceRendering}
                onExit={handleExitWithPrompt}
                selectedVariant={selectedVariant}
                onVariantChange={handleVariantChange}
                mapxPath={mapxPath}
                idmlPath={idmlPath}
                hasUnsavedChanges={hasUnsavedChanges}
                onSaveLabels={handleSaveLabels}
                onRevertLabels={handleRevertLabels}
                templateGroup={templateGroup}
                templateGroupIndex={templateGroupIndex}
                onPreviousTemplate={handlePreviousTemplate}
                onNextTemplate={handleNextTemplate}
                activeTab={activeTab}
                onActiveTabChange={setActiveTab}
              />
            </div>
          </div>
          <div className="horizontal-divider" onMouseDown={handleHorizontalDragStart}>
            ═════
          </div>
          <div className="bottom-pane" style={{ flex: `0 0 ${100 - topHeight}%`, position: 'relative' }}>
            <button
              onClick={() => setIsBottomPaneExpanded(!isBottomPaneExpanded)}
              style={{
                position: 'absolute',
                top: '5px',
                right: '5px',
                zIndex: 100,
                padding: '4px 8px',
                cursor: 'pointer',
                border: '1px solid #ccc',
                borderRadius: '4px',
                background: 'white',
                fontSize: '14px'
              }}
              title={isBottomPaneExpanded ? 'Collapse to map width' : 'Expand to full width'}
            >
              {isBottomPaneExpanded ? '⮜' : '⮞'}
            </button>
            <BottomPane
              placeNameIds={labels[selectedLabelIndex]?.placeNameIds || []}
              activeTab={activeTab}
              mergeKey={labels[selectedLabelIndex]?.mergeKey}
              onAddRendering={handleAddRendering}
              onReplaceRendering={handleReplaceRendering}
              lang={lang}
              termRenderings={termRenderings}
              setRenderings={setRenderings}
              onDenialsChanged={handleDenialsChanged}
              extractedVerses={extractedVerses}
              setTermRenderings={setTermRenderings}
              collectionId={currentCollectionId}
              onReloadExtractedVerses={handleReloadExtractedVerses}
            />
          </div>
        </>
      )}
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
        projectFolder={projectFolder}
        collectionId={getCollectionIdFromTemplate(mapDef.template)}
        collectionsFolder={collectionsFolder}
      />{' '}
      {showTemplateBrowser && (
        <TemplateBrowser
          open={true}
          lang={lang}
          projectFolder={projectFolder}
          templateFolder={collectionsFolder}
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
