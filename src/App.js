import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { MapContainer, ImageOverlay, Marker, ZoomControl } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import TermRenderings from './TermRenderings';
import './App.css';
import MapBibTerms from './MapBibTerms';
import { getMapData } from './MapData';

const mapBibTerms = new MapBibTerms();

const statusValue = [
  { text: "Blank", bkColor: "crimson", textColor: 'white'},  // 0
  { text: "Must select one", bkColor: "darkorange", textColor: 'white'},    // 1
  { text: "No renderings", bkColor: "indianred", textColor: 'white'}, // 2
  { text: "Does not match", bkColor: "darkmagenta", textColor: 'white'},  // 3
  { text: "Approved", bkColor: "darkgreen", textColor: 'white'},      // 4
  { text: "Guessed rendering not yet approved", bkColor: "darkblue", textColor: 'white'}, // 5
  { text: "Needs checked", bkColor: "darkgoldenrod", textColor: 'white'}, // 6
];

var usfm = String.raw`\zdiagram-s |template="SMR1_185wbt - Philips Travels [sm]"\* 
\fig |src="185wbt - Philips Travels [sm] (fcr) @en.jpg" size="span" loc="paw" copy="WBT" ref="8:5-40"\fig*
\zlabel |key="philipstravels_title" termid="philipstravels_title" gloss="Philip’s Travels" label=""\*
\zlabel |key="jerusalem_nt" termid="Ἱεροσόλυμα-1" gloss="Jerusalem" label="Yarūśalēma"\*
\zlabel |key="apollonia" termid="Ἀπολλωνία" gloss="Apollonia" label=""\*
\zlabel |key="jordan_river_nt" termid="Ἰορδάνης" gloss="Jordan River" label="Yardana"\*
\zlabel |key="azotus" termid="Ἄζωτος" gloss="Azotus" label="Azotus–Asotus"\*
\zlabel |key="decapolis" termid="Δεκάπολις" gloss="Decapolis" label="daśa sahar"\*
\zdiagram-e \* `;

function mapFromUsfm(usfm) {
  // Extract template and \fig field
  const figMatch = usfm.match(/\\fig[\s\S]*?\\fig\*/);
  const templateMatch = usfm.match(/\\zdiagram-s\s+\|template="([^"]*)"/);
  
  // 
  let mapDefData;
  try {
    mapDefData = getMapData(templateMatch[1]);
    mapDefData.mapView = true;
    mapDefData.template = templateMatch[1];
  } catch (e) {
    mapDefData = {
      template: templateMatch ? templateMatch[1] : '',
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
        gloss,
        vernLabel: vernLabel || '',
        idx: maxIdx++ // Assign an index for ordering
      };
      mapDefData.labels.push(label);
    }
  }

  console.log('Parsed map definition:', mapDefData);
  return mapDefData;
}

var map = mapFromUsfm(usfm);
console.log('Map:', map);

// Fix Leaflet default marker icons (optional, not needed with custom SVG icons)
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// Function to create a map label
const createLabel = (labelText, align = 'right', angle = 0, size = 3, status, isSelected = false, labelScale = 1) => {
  const isLeft = align === 'left';
  const isCenter = align === 'center';
  const backgroundColor = statusValue[status].bkColor;
  const textColor = statusValue[status].textColor; 
  // Base font size in px (matches your app's base font size)
  const baseFontSize = 12 * labelScale;
  // Calculate scale factor for font size (matches previous logic)
  const fontSizePx = baseFontSize * (0.7 + 0.1 * (4 - size));
  // Use em units for all scalable properties
  const baseStyle = [
    `color: ${textColor};`,
    `font-size: ${fontSizePx}px;`,
    'font-weight: bold;',
    'white-space: nowrap;',
    `background: ${backgroundColor ? `color-mix(in srgb, ${backgroundColor} 75%, transparent)` : 'rgba(0,0,0,0.75)'};`,
    'padding: 0 0.5em;', // 0px top/bottom, 0.5em left/right
    'border-radius: 0.83em;', // 10px if font-size is 12px
    'line-height: 1.6em;', // scale height of label
    'position: absolute;'
  ];
  if (isCenter) {
    baseStyle.push(
      `left: 50%;`,
      `top: 50%;`,
      `transform: translate(-50%, -50%) rotate(-${angle}deg);`
    );
  } else {
    baseStyle.push(
      `transform: rotate(-${angle}deg);`,
      `transform-origin: ${isLeft ? 'left center' : 'right center'};`,
      isLeft ? 'left: 0.67em;' : 'right: 0.67em;'
    );
  }
  const spanStyle = baseStyle.join(' ');
  const html = `
    <div style="display: flex; align-items: center;${isCenter ? ' justify-content: center;' : ''} width: 2em; height: 2em; position: relative;">
      <span class="${isSelected ? 'selected-label' : ''}" style="${spanStyle}">${labelText}</span>
    </div>
  `;
  return L.divIcon({
    html,
    className: '',
  });
  // return L.divIcon({
  //   html,
  //   className: '',
  //   iconSize: [10 * (fontSizePx / baseFontSize), 2 * fontSizePx],
  //   iconAnchor: [1 * (fontSizePx / baseFontSize), 1 * fontSizePx],
  //   popupAnchor: [isLeft ? 5 * (fontSizePx / baseFontSize) : -2 * (fontSizePx / baseFontSize), -1 * fontSizePx],
  // });
};

// Bottom Pane component to display an image based on termId
function BottomPane({ termId }) {
  const gloss = mapBibTerms.getGloss(termId) || 'default';
  const imageUrl = termId ? `/assets/${gloss}.jpg` : '';
  console.log('Attempting to load image:', imageUrl);
  return (
    <div className="bottom-pane">
      {imageUrl && (
        <img
          key={imageUrl}
          src={imageUrl}
          alt={termId}
          style={{ width: '100%', height: 'auto', objectFit: 'cover' }}
          onError={(e) => {
            console.error('Failed to load image:', imageUrl);
            e.target.style.display = 'none';
          }}
        />
      )}
    </div>
  );
}

function usfmFromMap(map) {
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
    usfm += `\\zlabel |key="${label.mergeKey}" termid="${label.termId}" gloss="${label.gloss}" label="${label.vernLabel || ''}"\\*\n`;
  });
  usfm += '\\zdiagram-e \\*';
  // Remove unnecessary escaping for output
  return usfm.replace(/\\/g, '\\');
}

function App() {
  const [mapDef, setMapDef] = useState({template: map.template, fig: map.fig, mapView: map.mapView, imgFilename: map.imgFilename, width: map.width, height: map.height});
  const [locations, setLocations] = useState([]);
  const [selLocation, setSelLocation] = useState(0);
  const [mapWidth, setMapWidth] = useState(70);
  const [topHeight, setTopHeight] = useState(80);
  const [renderings, setRenderings] = useState('');
  const [isApproved, setIsApproved] = useState(false);
  const [mapPaneView, setMapPaneView] = useState(map.mapView ? 0 : 1); // 0: Map, 1: Table, 2: USFM
  const [labelScale, setLabelScale] = useState(() => {
    // Persist labelScale in localStorage
    const saved = localStorage.getItem('labelScale');
    return saved ? parseFloat(saved) : 1;
  });
  const [showSettings, setShowSettings] = useState(false);
  const isDraggingVertical = useRef(false);
  const isDraggingHorizontal = useRef(false);
  const termRenderings = useMemo(() => new TermRenderings('/data/term-renderings.json'), []);

  // Add ref for vernacular input
  const vernacularInputRef = useRef(null);

  const handleSelectLocation = useCallback((location) => {
    console.log('Selected location:', location);
    if (!location) return;
    setSelLocation(location.idx);
    const entry = termRenderings.data[location.termId];
    if (entry) {
      setRenderings(entry.renderings);
      setIsApproved(!entry.isGuessed);
    } else {
      setRenderings('');
      setIsApproved(false);
      //console.warn(`No term renderings entry for termId: ${location.termId}`);
    }
  }, [termRenderings, setRenderings, setIsApproved, setSelLocation]);

  const handleUpdateVernacular = useCallback((termId, newVernacular) => {
    setLocations(prevLocations => prevLocations.map(loc => {
      if (loc.termId === termId) {
        const status = termRenderings.getStatus(loc.termId, newVernacular);
        return { ...loc, vernLabel: newVernacular, status };
      }
      return loc;
    }));
  }, [termRenderings]);

  const handleNextLocation = useCallback((e) => {
    if ((e.key === 'Enter' || e.key === 'Tab')) {
      e.preventDefault();
      const currentIndex = selLocation;
      let nextIndex;
      if (e.shiftKey) {
        nextIndex = (currentIndex - 1 + locations.length) % locations.length;
      } else {
        nextIndex = (currentIndex + 1) % locations.length;
      }
      const nextLocation = locations[nextIndex];
      handleSelectLocation(nextLocation);
    }
  }, [locations, selLocation, handleSelectLocation]);

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

  const handleRenderingsChange = (e) => {
    setRenderings(e.target.value);
    const updatedData = { ...termRenderings.data };
    updatedData[locations[selLocation].termId] = {
      ...updatedData[locations[selLocation].termId],
      renderings: e.target.value
    };
    termRenderings.data = updatedData;
    // The renderings change might affect the status of the location indexed by selLocation
    const status = termRenderings.getStatus(locations[selLocation].termId, locations[selLocation].vernLabel || '');
    setLocations(prevLocations => prevLocations.map(loc => {
      if (loc.termId === locations[selLocation].termId) {
        return { ...loc, status };
      }
      return loc;
    }));
  };

  const handleApprovedChange = (e) => {
    const approved = e.target.checked;
    setIsApproved(approved);
    const updatedData = { ...termRenderings.data };
    updatedData[locations[selLocation].termId] = {
      ...updatedData[locations[selLocation].termId],
      isGuessed: !approved,
    };
    termRenderings.data = updatedData;
    // The renderings change might affect the status of the location indexed by selLocation
    const status = termRenderings.getStatus(locations[selLocation].termId, locations[selLocation].vernLabel || '');
    setLocations(prevLocations => prevLocations.map(loc => {
      if (loc.termId === locations[selLocation].termId) {
        return { ...loc, status };
      }
      return loc;
    }));
  };

  const handleSaveRenderings = async () => {
    const blob = new Blob([JSON.stringify(termRenderings.data, null, 2)], { type: 'application/json' });
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: 'term-renderings.json',
        types: [{ description: 'JSON Files', accept: { 'application/json': ['.json'] } }],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      console.log('Term renderings saved successfully');
    } catch (error) {
      console.error('Failed to save term renderings:', error);
      alert('Save failed. Please copy the JSON and save it manually:\n' + JSON.stringify(termRenderings.data, null, 2));
    }
  };

  // Handler for map image browse
  const handleBrowseMapTemplate = async () => {
    try {
      const [fileHandle] = await window.showOpenFilePicker({
        types: [
          {
            description: 'JPEG Images',
            accept: { 'image/jpeg': ['.jpg', '.jpeg'] },
          },
        ],
        multiple: false,
      });
      if (fileHandle) {
        // Strip .jpg or .jpeg extension
        const fileName = fileHandle.name.replace(/\.(jpg|jpeg)$/i, '');
        // Use the stripped filename as the template ID
        const foundTemplate = getMapData(fileName);
        if (!foundTemplate) {
          alert('No map template found for: ' + fileName);
          return;
        }
        // Set mapDef and locations 
        setMapDef({
          template: fileName,
          fig: foundTemplate.fig || '',
          mapView: true,
          imgFilename: foundTemplate.imgFilename,
          width: foundTemplate.width,
          height: foundTemplate.height
        });
        const newLocations = foundTemplate.labels.map(loc => {
          const status = termRenderings.getStatus(loc.termId, loc.vernLabel || '');
          return { ...loc, vernLabel: loc.vernLabel || '', status };
        });
        setLocations(newLocations);
        setMapPaneView(0); // Map View
      }
    } catch (e) {
      // User cancelled or not supported
    }
  };

  useEffect(() => {
    // Initialize locations only when termRenderings.data is loaded
    const checkData = () => {
      if (Object.keys(termRenderings.data).length === 0) {
        console.log('Waiting for term renderings data to load...');
        return false;
      }
      return true;
    };

    if (!checkData()) {
      const interval = setInterval(() => {
        if (checkData()) {
            const initialLocations = map.labels.map(loc => {
            // If vernLabel is empty, use getMapForm
            if (!loc.vernLabel) {
              loc.vernLabel = termRenderings.getMapForm(loc.termId);
            }

            const status = termRenderings.getStatus(loc.termId, loc.vernLabel);
            return { ...loc, status };
            });
          console.log('Initial locations with colors:', initialLocations);
          setLocations(initialLocations);
          if (initialLocations.length > 0) {
            handleSelectLocation(initialLocations[0]); // Auto-select first location
          }
          clearInterval(interval);
        }
      }, 100); // Check every 100ms
      return () => clearInterval(interval);
    }
  }, [termRenderings, handleSelectLocation]);

  // Focus vernacular input after selection or locations change
  useEffect(() => {
    if (vernacularInputRef.current) {
      vernacularInputRef.current.focus();
    }
  }, [selLocation]); // NOT locations, to avoid re-focusing while editing renderings

  // Table View component
  function TableView({ locations, selLocation, onUpdateVernacular, onNextLocation, termRenderings, onSelectLocation }) {
    const inputRefs = useRef([]);
    useEffect(() => {
      // Focus the input for the selected row
      const idx = selLocation;
      if (idx >= 0 && inputRefs.current[idx]) {
        inputRefs.current[idx].focus();
      }
    }, [selLocation, locations]);
    return (
      <div className="table-view-scroll-wrapper">
        <table className="table-view" style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th>Gloss</th>
              <th>Label</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {locations.map((loc, i) => {
              const status = termRenderings.getStatus(loc.termId, loc.vernLabel);
              const isSelected = selLocation === loc.idx;
              return (
                <tr
                key={loc.termId}
                style={{
                  background: statusValue[status].bkColor,
                  color: statusValue[status].textColor,
                  fontWeight: isSelected ? 'bold' : 'normal',
                  cursor: 'pointer',
                  border: isSelected ? '4px solid black' : undefined,
                  paddingTop: isSelected ? 12 : undefined,
                  paddingBottom: isSelected ? 12 : undefined,
                  // height: isSelected ? 48 : undefined,
                }}
                onClick={() => onSelectLocation(loc)}
                >
                <td style={isSelected ? { paddingTop: 4, paddingBottom: 4 } : {}}>{loc.gloss}</td>
                <td style={isSelected ? { paddingTop: 4, paddingBottom: 4 } : {}}>
                  <input
                  ref={el => inputRefs.current[i] = el}
                  type="text"
                  value={loc.vernLabel || ''}
                  onChange={e => onUpdateVernacular(loc.termId, e.target.value)}
                  onFocus={() => onSelectLocation(loc)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && e.shiftKey) {
                      // Shift+Enter: cycle backward
                      e.preventDefault();
                      const prevIdx = (i - 1 + locations.length) % locations.length;
                      if (inputRefs.current[prevIdx]) inputRefs.current[prevIdx].focus();
                      onSelectLocation(locations[prevIdx]);
                    } else if (e.key === 'Enter') {
                      // Enter: cycle forward
                      e.preventDefault();
                      const nextIdx = (i + 1) % locations.length;
                      if (inputRefs.current[nextIdx]) inputRefs.current[nextIdx].focus();
                      onSelectLocation(locations[nextIdx]);
                    } else if (e.key === 'ArrowUp') {
                      // Up arrow: cycle backward
                      e.preventDefault();
                      const prevIdx = (i - 1 + locations.length) % locations.length;
                      if (inputRefs.current[prevIdx]) inputRefs.current[prevIdx].focus();
                      onSelectLocation(locations[prevIdx]);
                    } else if (e.key === 'ArrowDown') {
                      // Down arrow: cycle forward
                      e.preventDefault();
                      const nextIdx = (i + 1) % locations.length;
                      if (inputRefs.current[nextIdx]) inputRefs.current[nextIdx].focus();
                      onSelectLocation(locations[nextIdx]);
                    }
                  }}
                  style={{ }}
                  />
                </td>
                <td style={isSelected ? { paddingTop: 4, paddingBottom: 4 } : {}}>{statusValue[status].text}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  // USFM View component (editable, uncontrolled)
  const usfmTextareaRef = useRef();
  const USFMView = React.memo(function USFMView({ usfmText }) {
    return (
      <textarea
        ref={usfmTextareaRef}
        style={{ width: '100%', height: '100%', minHeight: 300 }}
        defaultValue={usfmText}
      />
    );
  });

  // --- USFM state for editing ---
  const [usfmText, setUsfmText] = useState(() => usfmFromMap({ ...mapDef, labels: locations }));

  // Only update USFM text when switching TO USFM view (not on every locations change)
  const prevMapPaneView = useRef();
  useEffect(() => {
    if (prevMapPaneView.current !== 2 && mapPaneView === 2) {
      setUsfmText(usfmFromMap({ ...mapDef, labels: locations }));
    }
    prevMapPaneView.current = mapPaneView;
  }, [mapPaneView, locations]);

  // --- USFM to map/locations sync ---
  // Helper to update map/locations from USFM text
  const updateMapFromUsfm = useCallback(() => {
    if (!usfmTextareaRef.current) return;
    const text = usfmTextareaRef.current.value;
    try {
      const newMap = mapFromUsfm(text);
      // Re-init locations and selection
      const initialLocations = newMap.labels.map(loc => {
        if (!loc.vernLabel) {
          loc.vernLabel = termRenderings.getMapForm(loc.termId);
        }
        const status = termRenderings.getStatus(loc.termId, loc.vernLabel);
        return { ...loc, status };
      });
      setSelLocation(0);
      setLocations(initialLocations);
      //  update map object
      map.labels = newMap.labels;
      map.template = newMap.template;
      map.fig = newMap.fig;
      map.mapView = newMap.mapView;
      setUsfmText(text); // keep USFM text in sync after parse
      setMapDef({template: newMap.template, fig: newMap.fig, mapView: newMap.mapView, imgFilename: newMap.imgFilename, width: newMap.width, height: newMap.height});
    } catch (e) {
      alert('Invalid USFM format. Changes not applied.');
    }
  }, [termRenderings, setLocations, setSelLocation]);

  // Intercept view switch to update map if leaving USFM view
  const handleSwitchViewWithUsfm = useCallback(() => {
    if (mapPaneView === 2) {
      updateMapFromUsfm();
    }
    setMapPaneView(prev => {
      if (!map.mapView) {
        // Only cycle between Table (1) and USFM (2)
        return prev === 1 ? 2 : 1;
      }
      // Cycle through Map (0), Table (1), USFM (2)
      return (prev + 1) % 3;
    });
  }, [mapPaneView, updateMapFromUsfm]);

  // Intercept OK button in DetailsPane
  const handleOkWithUsfm = useCallback(() => {
    if (mapPaneView === 2) {
      updateMapFromUsfm();
    }
    // Optionally: do other OK logic here
    alert('OK clicked');
  }, [mapPaneView, updateMapFromUsfm]);
  console.log("map: ", map);
  return (
    <div className="app-container">
      <div className="top-section" style={{ flex: `0 0 ${topHeight}%` }}>
        <div className="map-pane" style={{ flex: `0 0 ${mapWidth}%` }}>
          {mapPaneView === 0 && map.mapView && (
            <MapPane
              key={mapDef.imgFilename || mapDef.template} // Force remount on template/image change
              imageUrl={mapDef.imgFilename ? `/assets/maps/${mapDef.imgFilename}` : ''}
              locations={locations}
              onSelectLocation={handleSelectLocation}
              selLocation={selLocation}
              labelScale={labelScale} // <-- pass labelScale
              mapDef={mapDef} // <-- pass map definition
            />
          )}
          {mapPaneView === 1 && (
            <TableView
              locations={locations}
              selLocation={selLocation}
              onSelectLocation={handleSelectLocation}
              onUpdateVernacular={handleUpdateVernacular}
              termRenderings={termRenderings}
              onNextLocation={handleNextLocation}
            />
          )}
          {mapPaneView === 2 && (
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
            onSaveRenderings={handleSaveRenderings}
            termRenderings={termRenderings}
            locations={locations}
            onSwitchView={handleSwitchViewWithUsfm}
            onOk={handleOkWithUsfm}
            mapPaneView={mapPaneView}
            onSetView={viewIdx => {
              if (viewIdx === 0 && !map.mapView) return;
              if (mapPaneView === 2) updateMapFromUsfm();
              setMapPaneView(viewIdx);
            }}
            onShowSettings={() => setShowSettings(true)} // <-- add onShowSettings
            mapDef={mapDef} // <-- pass map definition
            onBrowseMapTemplate={handleBrowseMapTemplate}
            vernacularInputRef={vernacularInputRef} // <-- pass ref
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
        <BottomPane termId={locations[selLocation]?.termId} />
      </div>
      <SettingsModal open={showSettings} onClose={() => setShowSettings(false)} labelScale={labelScale} setLabelScale={setLabelScale} />
    </div>
  );
}

function MapPane({ imageUrl, locations, onSelectLocation, selLocation, labelScale, mapDef }) {
  const imageHeight = mapDef.height;
  const imageWidth = mapDef.width;
  const bounds = useMemo(() => [[0, 0], [imageHeight, imageWidth]], [imageHeight, imageWidth]);
  const crs = L.CRS.Simple;

  // Calculate initial zoom to fit the image fully in the pane
  // Use a ref to store the calculated initial zoom
  const mapRef = useRef();
  const [initialZoom, setInitialZoom] = useState(null);

  useEffect(() => {
    if (mapRef.current) {
      const map = mapRef.current;
      map.fitBounds(bounds, { padding: [20, 20] }); // Add padding to ensure full image is visible
      setInitialZoom(map.getZoom());
    }
  }, [bounds]);

  const transformedLocations = locations.map((loc) => {
    const yLeaflet = imageHeight - loc.y;
    return { ...loc, yLeaflet };
  });

  return (
    <MapContainer
      crs={crs}
      bounds={bounds}
      // maxBounds and maxBoundsViscosity removed to allow panning and avoid snap-back
      style={{ height: '100%', width: '100%' }}
      minZoom={-2}
      maxZoom={3}
      zoom={initialZoom !== null ? initialZoom : 0}
      scrollWheelZoom={false}
      zoomDelta={0.25}
      zoomSnap={0.25}
      whenCreated={mapInstance => { mapRef.current = mapInstance; }}
      zoomControl={false}
    >
      <ZoomControl position="topright" />
      <ImageOverlay url={imageUrl} bounds={bounds} />
      {/* Only fit bounds on initial mount, not on every render */}
      {/* <FitBounds bounds={bounds} /> */}
      {transformedLocations.length > 0 ? (
        transformedLocations.map((loc) => (
          <Marker
            key={loc.termId}
            position={[loc.yLeaflet, loc.x]}
            icon={createLabel(
              loc.vernLabel || `(${loc.gloss})`, // Fallback to gloss if vernLabel is empty
              loc.align,
              loc.angle,
              loc.size,
              loc.status,
              selLocation === loc.idx,
              labelScale 
            )}
            eventHandlers={{ click: () => onSelectLocation(loc) }}
            aria-label={`Marker for ${loc.gloss}`}
            tabIndex={0}
          >
            {/* <Popup>{loc.gloss}</Popup> */}
          </Marker>
        ))
      ) : (
        <div>No locations to display</div>
      )}
    </MapContainer>
  );
}

function DetailsPane({ selLocation, onUpdateVernacular, onNextLocation, renderings, isApproved, onRenderingsChange, onApprovedChange, onSaveRenderings, termRenderings, locations, onSwitchView, mapPaneView, onSetView, onShowSettings, mapDef, onBrowseMapTemplate, vernacularInputRef }) {
  const [vernacular, setVernacular] = useState(locations[selLocation]?.vernLabel || '');
  const inputRef = useRef(null);
  const [showTemplateInfo, setShowTemplateInfo] = useState(false);
  const templateData = getMapData(mapDef.template) || {};

  useEffect(() => {
    setVernacular(locations[selLocation]?.vernLabel || '');
  }, [selLocation]);

  const handleVernChange = (e) => {
    const newVernacular = e.target.value;
    setVernacular(newVernacular); // Update state immediately
    onUpdateVernacular(locations[selLocation].termId, newVernacular);
  };

  // Tally status counts for all locations
  const statusTallies = useMemo(() => {
    const tally = {};
    if (locations && locations.length > 0) {
      locations.forEach(loc => {
        const status = termRenderings.getStatus(loc.termId, loc.vernLabel);
        if (!tally[status]) tally[status] = 0;
        tally[status]++;
      });
    }
    return tally;
  }, [locations, termRenderings]);

  // --- Button Row Handlers (implement as needed) ---
  const handleCancel = () => {
    alert('Cancel clicked');
  };
  const handleOk = () => {
    alert('OK clicked');
  };
  const handleSettings = () => {
    if (onShowSettings) onShowSettings();
  };

  // --- Template info/browse group ---
  // Access the template name from the global map object
  const templateName = mapDef.template || '(no template)';

  // Only show the button row if in USFM view
  if (mapPaneView === 2) {
    return (
      <div>
      {/* Button Row */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
        <button onClick={onSwitchView} style={{ marginRight: 60 }}>Switch view</button>
        <button onClick={handleCancel} style={{ marginRight: 8, width:80 }}>Cancel</button>
        <button onClick={handleOk}  style={{ width:80 }}>OK</button>
        <div style={{ flex: 1 }} />
        <button
        onClick={handleSettings}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          fontSize: 22,
          marginLeft: 8,
          color: '#555',
          padding: 4,
          alignSelf: 'flex-start'
        }}
        aria-label="Settings"
        >
        <span role="img" aria-label="Settings">&#9881;</span>
        </button>
      </div>
      </div>
    );
  }

  // Always compute status and color from latest data
  const status = termRenderings.getStatus(locations[selLocation]?.termId, vernacular);

  // Handler for Add to renderings button
  const handleAddToRenderings = () => {
    // Set renderings and isGuessed to false
    onRenderingsChange({ target: { value: vernacular } });
    if (termRenderings.data[locations[selLocation].termId]) {
      termRenderings.data[locations[selLocation].termId].isGuessed = false;
    }
    // Also update isApproved state to true (since isGuessed is now false)
    onApprovedChange({ target: { checked: true } });
  };

  return (
    <div>
      {/* Button Row */}
      {mapPaneView !== 2 && (
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
          {/* Icon view buttons */}
          <button
            onClick={() => onSetView(0)}
            disabled={!mapDef.mapView}
            style={{
              marginRight: 4,
              background: mapPaneView === 0 ? '#d0eaff' : undefined,
              border: mapPaneView === 0 ? '2px inset #2196f3' : undefined,
              opacity: mapDef.mapView ? 1 : 0.5,
              padding: '4px 8px',
              borderRadius: 4,
              height: 32,
              minWidth: 32,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            title="Map View"
          >
            {/* Marker icon (SVG) */}
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M10 2C6.686 2 4 4.686 4 8c0 3.314 4.09 8.36 5.29 9.79a1 1 0 0 0 1.42 0C11.91 16.36 16 11.314 16 8c0-3.314-2.686-6-6-6zm0 8.5A2.5 2.5 0 1 1 10 5a2.5 2.5 0 0 1 0 5.5z" fill="#2196f3" stroke="#1976d2" strokeWidth="1.2"/>
            </svg>
          </button>
          <button
            onClick={() => onSetView(1)}
            style={{
              marginRight: 4,
              background: mapPaneView === 1 ? '#d0eaff' : undefined,
              border: mapPaneView === 1 ? '2px inset #2196f3' : undefined,
              padding: '4px 8px',
              borderRadius: 4,
              height: 32,
              minWidth: 32,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            title="Table View"
          >
            {/* Table icon (SVG) */}
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="2" y="4" width="16" height="12" fill="#90caf9" stroke="#1976d2" strokeWidth="1.5"/>
              <line x1="2" y1="8" x2="18" y2="8" stroke="#1976d2" strokeWidth="1.5"/>
              <line x1="2" y1="12" x2="18" y2="12" stroke="#1976d2" strokeWidth="1.5"/>
              <line x1="7" y1="4" x2="7" y2="16" stroke="#1976d2" strokeWidth="1.5"/>
              <line x1="13" y1="4" x2="13" y2="16" stroke="#1976d2" strokeWidth="1.5"/>
            </svg>
          </button>
          <button
            onClick={() => onSetView(2)}
            style={{
              marginRight: 32,
              background: mapPaneView === 2 ? '#d0eaff' : undefined,
              border: mapPaneView === 2 ? '2px inset #2196f3' : undefined,
              padding: '4px 8px',
              borderRadius: 4,
              height: 32,
              minWidth: 32,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            title="USFM View"
          >
            {/* USFM icon (document with text lines) */}
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="4" y="3" width="12" height="14" rx="2" fill="#fffde7" stroke="#1976d2" strokeWidth="1.5"/>
              <line x1="6" y1="7" x2="14" y2="7" stroke="#1976d2" strokeWidth="1.2"/>
              <line x1="6" y1="10" x2="14" y2="10" stroke="#1976d2" strokeWidth="1.2"/>
              <line x1="6" y1="13" x2="12" y2="13" stroke="#1976d2" strokeWidth="1.2"/>
            </svg>
          </button>
          <button onClick={handleCancel} style={{ marginRight: 8, height: 32, minWidth: 80, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Cancel</button>
          <button onClick={handleOk} style={{ height: 32, minWidth: 80, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>OK</button>
          <div style={{ flex: 1 }} />
          <button
            onClick={handleSettings}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: 22,
              marginLeft: 8,
              color: '#555',
              padding: 4,
              alignSelf: 'flex-start'
            }}
            aria-label="Settings"
          >
            <span role="img" aria-label="Settings">&#9881;</span>
          </button>
        </div>
      )}

      {/* Template info/browse group */}
      <div className="details-group-frame" style={{ border: '1px solid #ccc', borderRadius: 6, marginBottom: 16, padding: 8, background: '#f9f9f9', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <span style={{ fontWeight: 'bold', color: 'black', fontSize: '0.6em' }}>{templateName}</span>
        <button
          title="Template info"
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginLeft: 8 }}
          onClick={() => setShowTemplateInfo(true)}
        >
          <span role="img" aria-label="info" style={{ fontSize: '1.2em', color: '#6cf' }}>ℹ️</span>
        </button>
        <button
          title="Browse for map template"
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginLeft: 8 }}
          onClick={onBrowseMapTemplate}
        >
          <span role="img" aria-label="browse" style={{ fontSize: '1.2em', color: '#fc6' }}>📂</span>
        </button>
      </div>

      {/* Modal dialog for template info */}
      {showTemplateInfo && (
        <div style={{
          position: 'fixed', left: 0, top: 0, width: '100vw', height: '100vh', zIndex: 1000,
          background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div style={{ background: 'white', borderRadius: 10, padding: 24, minWidth: 520, maxWidth: 900, boxShadow: '0 4px 24px #0008', position: 'relative' }}>
            <button onClick={() => setShowTemplateInfo(false)} style={{ position: 'absolute', top: 8, right: 12, background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#888' }} title="Close">×</button>
            <h4 style={{ marginTop: 0}}>{templateName}</h4>
            {templateData.title && <p style={{ margin: '8px 0', fontWeight: 'bold', fontStyle: 'italic'}}>{templateData.title}</p>}
            {templateData.description && <p style={{ margin: '8px 0' }}>{templateData.description}</p>}
            {templateData.mapTypes && <div style={{ margin: '8px 0' }}><b>Base layer types:</b> {templateData.mapTypes}</div>}
            {templateData.formats && <div style={{ margin: '8px 0' }}><b>File formats:</b> {templateData.formats}</div>}
            {templateData.owner && <div style={{ margin: '8px 0' }}><b>Owner:</b> {templateData.owner}</div>}
            {templateData.ownerRules && (
              <div style={{ margin: '8px 0' }}>
                <b>Usage and Attribution Rules:</b> <a href={templateData.ownerRules} target="_blank" rel="noopener noreferrer">{templateData.ownerRules}</a>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Status Tally Table */}
      <div style={{ border: '1px solid #ccc', borderRadius: 6, marginBottom: 16, padding: 8, background: '#f9f9f9' }}>
        <table >
          <tbody>
            {Object.entries(statusTallies).map(([status, count ]) => (
              <tr key={status}>
                <td style={{ color: statusValue[status].bkColor, fontWeight: 'bold', padding: '2px 8px' }}>{count}</td>
                <td style={{ color: statusValue[status].bkColor, fontWeight: 'bold', padding: '2px 8px' }}>{statusValue[status].text}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h2>{locations[selLocation]?.gloss}</h2>
      <p>
        {mapBibTerms.getDefinition(locations[selLocation]?.termId)} <span style={{ fontStyle: 'italic' }}>({locations[selLocation]?.termId})</span>
      </p>
      <div className="vernacularGroup" style={{ backgroundColor: statusValue[status].bkColor, margin: '10px', padding: '10px' }}>
        <input
          ref={vernacularInputRef}
          type="text"
          value={vernacular}
          onChange={handleVernChange}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              onNextLocation(e);
            }
          }}
          placeholder="Enter translated label"
          className="form-control mb-2"
          aria-label={`Translation for ${locations[selLocation]?.gloss}`}
          style={{ width: '100%', border: 'none' }}
        />
        <span style={{color: statusValue[status].textColor}}>
          {statusValue[status].text}
          {status === 2 && (  // If status is "no renderings", show Add to renderings button
            <button style={{ marginLeft: 8 }} onClick={handleAddToRenderings}>Add to renderings</button>
          )}
        </span>
      </div>
      <h4>Term Renderings</h4>
      <div className="term-renderings">
        <label>
          <input
            type="checkbox"
            checked={isApproved}
            onChange={onApprovedChange}
          /> Approved
        </label>
        <textarea
          value={renderings}
          onChange={onRenderingsChange}
          style={{ width: '100%', minHeight: '100px' }}
          placeholder={"Enter renderings here, one per line.\nOptionally, explicitly mark the map form of the rendering by adding it as a comment that begins with '@'.\ne.g. Misra* (@Misradesh)"}
        />
        <button onClick={onSaveRenderings}>Save Renderings</button>
      </div>
    </div>
  );
}

// Settings Modal Dialog
const SettingsModal = ({ open, onClose, labelScale, setLabelScale }) => {
  if (!open) return null;
  return (
    <div style={{
      position: 'fixed', left: 0, top: 0, width: '100vw', height: '100vh', zIndex: 2000,
      background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}>
      <div style={{ background: 'white', borderRadius: 10, padding: 32, minWidth: 400, maxWidth: 600, boxShadow: '0 4px 24px #0008', position: 'relative' }}>
        <button onClick={onClose} style={{ position: 'absolute', top: 8, right: 12, background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#888' }} title="Close">×</button>
        <h3 style={{ marginTop: 0 }}>UI Settings</h3>
        <div style={{ margin: '24px 0' }}>
          <label htmlFor="labelScaleSlider" style={{ fontWeight: 'bold', marginRight: 12 }}>Label Size</label>
          <input
            id="labelScaleSlider"
            type="range"
            min={0.3}
            max={2}
            step={0.01}
            value={labelScale}
            onChange={e => setLabelScale(parseFloat(e.target.value))}
            style={{ width: 200, verticalAlign: 'middle' }}
          />
          <span style={{ marginLeft: 16, fontFamily: 'monospace' }}>{labelScale.toFixed(2)}x</span>
        </div>
        {/* Future: interface language, etc. */}
      </div>
    </div>
  );
};

export default App;