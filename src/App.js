import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { MapContainer, ImageOverlay, Marker, ZoomControl } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import TermRenderings from './TermRenderings';
import './App.css';
import MapBibTerms from './MapBibTerms';
import { allMapData } from './AllMapData.json';
//const mapDef = require(mapDefFilename);

const mapBibTerms = new MapBibTerms();

var usfm = String.raw`\zdiagram-s |template="SMP2_185wbt-sm"\* 
\fig |src="185wbt - Philips Travels [sm] (fcr) @en.jpg" size="span" loc="paw" copy="WBT" ref="8:5-40"\fig*
\zlabel |key="philipstravels_title" termid="philipstravels_title" gloss="Philip’s Travels" label=""\*
\zlabel |key="jerusalem_nt" termid="Ἱεροσόλυμα-1" gloss="Jerusalem" label="Yarūśalēma"\*
\zlabel |key="apollonia" termid="Ἀπολλωνία" gloss="Apollonia" label=""\*
\zlabel |key="jordan_river_nt" termid="Ἰορδάνης" gloss="Jordan River" label="Yardana"\*
\zlabel |key="azotus" termid="Ἄζωτος" gloss="Azotus" label="Azotus–Asotus"\*
\zlabel |key="decapolis" termid="Δεκάπολις" gloss="Decapolis" label="daśa sahar"\*
\zdiagram-e \* `;

function mapFromUsfm(usfm) {
  // Extract template value from \zdiagram-s |template="..." line
  const templateMatch = usfm.match(/\\zdiagram-s\s+\|template="([^"]*)"/);
  const figMatch = usfm.match(/\\fig\s[^\\]*\\fig\*"/);
  const map = {
    template: templateMatch ? templateMatch[1] : '',
    fig: figMatch ? figMatch[0] : '',
    mapView: false,
    labels: []
  };
  const regex = /\\zlabel\s+\|key="([^"]+)"\s+termid="([^"]+)"\s+gloss="([^"]+)"\s+label="([^"]*)"/g;
  let match;
  while ((match = regex.exec(usfm)) !== null) {
    const [_, key, termId, gloss, label] = match;
    map.labels.push({ mergeKey: key, termId: termId, gloss: gloss, vernLabel: label });
  }
  
  try {
      const mapDefData = allMapData[map.template];
      Object.keys(mapDefData).forEach(key => {
        if (key !== 'labels') {
          map[key] = mapDefData[key];
        }
      });
      const usfmLabelsByTermId = {};
      map.labels.forEach(label => {
        usfmLabelsByTermId[label.termId] = label;
      });
      map.labels = mapDefData.labels.map(jsonLabel => {
        const usfmLabel = usfmLabelsByTermId[jsonLabel.termId] || {};
        return { ...usfmLabel, ...jsonLabel };
      });
      map.mapView = true;
    
  } catch (err) {
    console.warn('Could not load map definition for:', map.template, err);
    // If loading fails, leave map as-is and mapView as false
  }
  return map;
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

// Function to create custom SVG icon with permanent label
const createCustomIcon = (gloss, vernLabel, align = 'right', angle = 0, size = 3, color, isSelected = false) => {
  const label = vernLabel || `(${gloss})`;

  const svg = `
    <svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="10" fill="${color}" fill-opacity="1" stroke="black" stroke-width="2"/>
    </svg>
  `;

  const isLeft = align === 'left';
  const labelHtml = `
    <span class="${isSelected ? 'selected-label' : ''}" style="
      color: ${color};
      font-size: ${12 + 6 * (4 - size)}px;
      font-weight: bold;
      white-space: nowrap;
      background: ${isSelected ? '#FFFACD' : 'rgba(255, 255, 255, 0.9)'}; /* Pale yellow for selected */
      padding: 2px 6px;
      border-radius: 3px;
      transform: rotate(-${angle}deg);
      transform-origin: ${isLeft ? 'right center' : 'left center'};
      position: absolute;
      ${isLeft ? 'right: 24px;' : 'left: 24px;'}
      line-height: 24px;
    ">${label}</span>
  `;

  const html = `
    <div style="display: flex; align-items: center; width: 24px; height: 24px; position: relative;">
      ${svg}
      ${labelHtml}
    </div>
  `;

  return L.divIcon({
    html,
    className: '',
    iconSize: [120, 24],
    iconAnchor: [12, 12],
    popupAnchor: [isLeft ? -24 : 60, -12],
  });
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
  // Reconstruct USFM string from current map state
  let usfm = `\\zdiagram-s |template="${map.template}"\\*\n`;
  if (map.fig) usfm += `${map.fig}\n`;
  map.labels.forEach(label => {
    usfm += `\\zlabel |key="${label.mergeKey}" termid="${label.termId}" gloss="${label.gloss}" label="${label.vernLabel || ''}"\\*\n`;
  });
  usfm += '\\zdiagram-e \\*';
  return usfm;
}

function App() {
  const [locations, setLocations] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [mapWidth, setMapWidth] = useState(70);
  const [topHeight, setTopHeight] = useState(80);
  const [renderings, setRenderings] = useState('');
  const [isApproved, setIsApproved] = useState(false);
  const [mapPaneView, setMapPaneView] = useState(map.mapView ? 0 : 1); // 0: Map, 1: Table, 2: USFM
  const isDraggingVertical = useRef(false);
  const isDraggingHorizontal = useRef(false);
  const termRenderings = useMemo(() => new TermRenderings('/data/term-renderings.json'), []);

  // Memoize updateMarkerColor to prevent infinite loops
  const updateMarkerColor = useCallback(() => {
    const newLocations = locations.map(loc => {
      const { color } = termRenderings.getStatus(loc.termId, loc.vernLabel || '');
      return { ...loc, color };
    });
    if (JSON.stringify(newLocations) !== JSON.stringify(locations)) {
      setLocations(newLocations);
    }
    if (selectedLocation) {
      const { color } = termRenderings.getStatus(selectedLocation.termId, selectedLocation.vernLabel || '');
      if (selectedLocation.color !== color) {
        setSelectedLocation(prev => ({ ...prev, color }));
      }
    }
    console.log('Updated colors:', newLocations.map(l => ({ termId: l.termId, color: l.color })), 'Selected:', selectedLocation ? { termId: selectedLocation.termId, color: selectedLocation.color } : null);
  }, [locations, selectedLocation, termRenderings]);

  const handleSelectLocation = useCallback((location) => {
    console.log('Selected location:', location);
    setSelectedLocation(location);
    const entry = termRenderings.data[location.termId];
    if (entry) {
      setRenderings(entry.renderings);
      setIsApproved(!entry.isGuessed);
    } else {
      setRenderings('');
      setIsApproved(false);
      //console.warn(`No term renderings entry for termId: ${location.termId}`);
    }
    updateMarkerColor();
  }, [termRenderings, setRenderings, setIsApproved, updateMarkerColor]);

  const handleUpdateVernacular = useCallback((termId, newVernacular) => {
    setLocations(prevLocations => prevLocations.map(loc => {
      if (loc.termId === termId) {
        const { color } = termRenderings.getStatus(loc.termId, newVernacular);
        return { ...loc, vernLabel: newVernacular, color };
      }
      return loc;
    }));
    setSelectedLocation(prev => {
      if (prev && prev.termId === termId) {
        const { color } = termRenderings.getStatus(prev.termId, newVernacular);
        return { ...prev, vernLabel: newVernacular, color };
      }
      return prev;
    });
  }, [termRenderings]);

  const handleNextLocation = useCallback((e) => {
    if ((e.key === 'Enter' || e.key === 'Tab') && selectedLocation) {
      e.preventDefault();
      const currentIndex = locations.findIndex(loc => loc.termId === selectedLocation.termId);
      let nextIndex;
      if (e.shiftKey) {
        nextIndex = (currentIndex - 1 + locations.length) % locations.length;
      } else {
        nextIndex = (currentIndex + 1) % locations.length;
      }
      const nextLocation = locations[nextIndex];
      handleSelectLocation(nextLocation);
    }
  }, [locations, selectedLocation, handleSelectLocation]);

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
    if (selectedLocation) {
      const updatedData = { ...termRenderings.data };
      updatedData[selectedLocation.termId] = {
        ...updatedData[selectedLocation.termId],
        renderings: e.target.value,
      };
      termRenderings.data = updatedData;
      updateMarkerColor();
    }
  };

  const handleApprovedChange = (e) => {
    const approved = e.target.checked;
    setIsApproved(approved);
    if (selectedLocation) {
      const updatedData = { ...termRenderings.data };
      updatedData[selectedLocation.termId] = {
        ...updatedData[selectedLocation.termId],
        isGuessed: !approved,
      };
      termRenderings.data = updatedData;
      updateMarkerColor();
    }
  };

  const handleSaveRenderings = async () => {
    if (!selectedLocation) return;
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

            const { color } = termRenderings.getStatus(loc.termId, loc.vernLabel);
            return { ...loc, color };
            });
          console.log('Initial locations with colors:', initialLocations);
          setLocations(initialLocations);
          if (initialLocations.length > 0) {
            handleSelectLocation(initialLocations[0]); // Auto-select first location
            updateMarkerColor(); // Ensure colors are applied
          }
          clearInterval(interval);
        }
      }, 100); // Check every 100ms
      return () => clearInterval(interval);
    }
  }, [termRenderings, updateMarkerColor, handleSelectLocation]);

  // Table View component
  function TableView({ locations, selectedLocation, onUpdateVernacular, onNextLocation, termRenderings, onSelectLocation }) {
    const inputRefs = useRef([]);
    useEffect(() => {
      // Focus the input for the selected row
      const idx = locations.findIndex(l => l.termId === selectedLocation?.termId);
      if (idx >= 0 && inputRefs.current[idx]) {
        inputRefs.current[idx].focus();
      }
    }, [selectedLocation, locations]);
    return (
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
            const { status, color } = termRenderings.getStatus(loc.termId, loc.vernLabel);
            const isSelected = selectedLocation && selectedLocation.termId === loc.termId;
            return (
              <tr
              key={loc.termId}
              style={{
                background: color,
                color: "white",
                fontWeight: isSelected ? 'bold' : 'normal',
                cursor: 'pointer',
                border: isSelected ? '4px solid black' : undefined,
                paddingTop: isSelected ? 12 : undefined,
                paddingBottom: isSelected ? 12 : undefined,
                height: isSelected ? 48 : undefined,
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
              <td style={isSelected ? { paddingTop: 4, paddingBottom: 4 } : {}}>{status}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    );
  }

  // USFM View component (now editable, uncontrolled)
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
  const [usfmText, setUsfmText] = useState(() => usfmFromMap({ ...map, labels: locations }));

  // Only update USFM text when switching TO USFM view (not on every locations change)
  const prevMapPaneView = useRef();
  useEffect(() => {
    if (prevMapPaneView.current !== 2 && mapPaneView === 2) {
      setUsfmText(usfmFromMap({ ...map, labels: locations }));
    }
    prevMapPaneView.current = mapPaneView;
  }, [mapPaneView]);

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
        const { color } = termRenderings.getStatus(loc.termId, loc.vernLabel);
        return { ...loc, color };
      });
      setLocations(initialLocations);
      if (initialLocations.length > 0) {
        setSelectedLocation(initialLocations[0]);
      } else {
        setSelectedLocation(null);
      }
      // Optionally update map object if needed elsewhere
      map.labels = newMap.labels;
      map.template = newMap.template;
      map.fig = newMap.fig;
      map.mapView = newMap.mapView;
      setUsfmText(text); // keep USFM text in sync after parse
    } catch (e) {
      alert('Invalid USFM format. Changes not applied.');
    }
  }, [termRenderings, setLocations, setSelectedLocation]);

  // Intercept view switch to update map if leaving USFM view
  const handleSwitchViewWithUsfm = useCallback(() => {
    if (mapPaneView === 2) {
      updateMapFromUsfm();
    }
    setMapPaneView(prev => {
      if (!map.mapView) return (prev + 2) % 3;
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

  return (
    <div className="app-container">
      <div className="top-section" style={{ flex: `0 0 ${topHeight}%` }}>
        <div className="map-pane" style={{ flex: `0 0 ${mapWidth}%` }}>
          {mapPaneView === 0 && map.mapView && (
            <MapPane
              imageUrl="/assets/SMP2_185wbt-sm.jpg"
              locations={locations}
              onSelectLocation={handleSelectLocation}
              selectedLocation={selectedLocation}
            />
          )}
          {mapPaneView === 1 && (
            <TableView
              locations={locations}
              selectedLocation={selectedLocation}
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
            selectedLocation={selectedLocation}
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
        <BottomPane termId={selectedLocation?.termId} />
      </div>
    </div>
  );
}

function MapPane({ imageUrl, locations, onSelectLocation, selectedLocation }) {
  const imageHeight = 852;
  const imageWidth = 1000;
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
            icon={createCustomIcon(
              loc.gloss,
              loc.vernLabel,
              loc.align,
              loc.angle,
              loc.size,
              loc.color || 'gray',
              selectedLocation && selectedLocation.termId === loc.termId
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

function DetailsPane({ selectedLocation, onUpdateVernacular, onNextLocation, renderings, isApproved, onRenderingsChange, onApprovedChange, onSaveRenderings, termRenderings, locations, onSwitchView, mapPaneView }) {
  const [vernacular, setVernacular] = useState(selectedLocation?.vernLabel || '');
  const inputRef = useRef(null);

  useEffect(() => {
    setVernacular(selectedLocation?.vernLabel || '');
  }, [selectedLocation]);

  useEffect(() => {
    if (selectedLocation && inputRef.current) {
      inputRef.current.focus();
    }
  }, [selectedLocation]);

  const handleChange = (e) => {
    const newVernacular = e.target.value;
    setVernacular(newVernacular); // Update state immediately
    if (selectedLocation) {
      onUpdateVernacular(selectedLocation.termId, newVernacular);
    }
  };

  // Tally status counts for all locations
  const statusTallies = useMemo(() => {
    const tally = {};
    if (locations && locations.length > 0) {
      locations.forEach(loc => {
        const { status, color } = termRenderings.getStatus(loc.termId, loc.vernLabel);
        if (!tally[status]) tally[status] = { count: 0, color };
        tally[status].count++;
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
    alert('Settings clicked');
  };

  // Only show the button row if in USFM view
  if (mapPaneView === 2) {
    return (
      <div>
        {/* Button Row */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
          <button onClick={onSwitchView} style={{ marginRight: 8 }}>Switch view</button>
          <button onClick={handleCancel} style={{ marginRight: 8 }}>Cancel</button>
          <button onClick={handleOk}>OK</button>
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

  // If no selection, show nothing (prevents null.termId error)
  if (!selectedLocation) {
    return null;
  }

  // Always compute status and color from latest data
  const { status, color } = termRenderings.getStatus(selectedLocation.termId, vernacular);

  // Handler for Add to renderings button
  const handleAddToRenderings = () => {
    if (selectedLocation) {
      // Set renderings and isGuessed to false
      onRenderingsChange({ target: { value: vernacular } });
      if (termRenderings.data[selectedLocation.termId]) {
        termRenderings.data[selectedLocation.termId].isGuessed = false;
      }
      // Also update isApproved state to true (since isGuessed is now false)
      onApprovedChange({ target: { checked: true } });
    }
  };

  return (
    <div>
      {/* Button Row */}
      {mapPaneView !== 2 && (
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
          <button onClick={onSwitchView} style={{ marginRight: 8 }}>Switch view</button>
          <button onClick={handleCancel} style={{ marginRight: 8 }}>Cancel</button>
          <button onClick={handleOk}>OK</button>
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
      {/* Status Tally Table */}
      <div style={{ border: '1px solid #ccc', borderRadius: 6, marginBottom: 16, padding: 8, background: '#f9f9f9' }}>
        <table >
          <tbody>
            {Object.entries(statusTallies).map(([status, { count, color }]) => (
              <tr key={status}>
                <td style={{ color, fontWeight: 'bold', padding: '2px 8px' }}>{count}</td>
                <td style={{ color, fontWeight: 'bold', padding: '2px 8px' }}>{status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h2>{selectedLocation.gloss}</h2>
      <p>
        {mapBibTerms.getDefinition(selectedLocation.termId)} <span style={{ fontStyle: 'italic' }}>({selectedLocation.termId})</span>
      </p>
      <div className="vernacularGroup" style={{ backgroundColor: color, margin: '10px', padding: '10px' }}>
        <input
          ref={inputRef}
          type="text"
          value={vernacular}
          onChange={handleChange}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              onNextLocation(e);
            }
            // Tab key now does default behavior (move to next control)
          }}
          placeholder="Enter vernacular name"
          className="form-control mb-2"
          aria-label={`Vernacular name for ${selectedLocation.gloss}`}
          style={{ width: '100%', border: 'none' }}
        />
        <span style={{color: "white"}}>
          {status}
          {status === 'No renderings' && (
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
          placeholder="Enter renderings (use \n for new lines)"
        />
        <button onClick={onSaveRenderings}>Save Renderings</button>
      </div>
    </div>
  );
}

export default App;