import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { MapContainer, ImageOverlay, Marker, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import TermRenderings from './TermRenderings';
import './App.css';

// Fix Leaflet default marker icons (optional, not needed with custom SVG icons)
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// Function to create custom SVG icon with permanent label
const createCustomIcon = (englishName, vernacularName, labelPosition = 'right', labelRotation = 0, color, isSelected = false) => {
  const label = vernacularName || `(${englishName})`;

  const svg = `
    <svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="10" fill="${color}" fill-opacity="1" stroke="black" stroke-width="2"/>
    </svg>
  `;

  const isLeft = labelPosition === 'left';
  const labelHtml = `
    <span class="${isSelected ? 'selected-label' : ''}" style="
      color: ${color === 'green' ? '#006400' : color === 'red' ? '#8B0000' : '#000'};
      font-size: 14px;
      font-weight: bold;
      white-space: nowrap;
      background: ${isSelected ? '#FFFACD' : 'rgba(255, 255, 255, 0.9)'}; /* Pale yellow for selected */
      padding: 2px 6px;
      border-radius: 3px;
      transform: rotate(-${labelRotation}deg);
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

// Component to handle fitBounds
function FitBounds({ bounds }) {
  const map = useMap();
  useEffect(() => {
    map.fitBounds(bounds);
  }, [map, bounds]);
  return null;
}

// Third Pane component to display an image based on termId
function ThirdPane({ termId }) {
  const imageUrl = termId ? `/assets/${termId}.jpg` : '';
  console.log('Attempting to load image:', imageUrl);
  return (
    <div className="third-pane">
      {imageUrl && (
        <img
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

// Custom debounce hook
function useDebounce(callback, delay) {
  const callbackRef = useRef(callback);
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  const debouncedCallback = useCallback((...args) => {
    const handler = setTimeout(() => {
      callbackRef.current(...args);
    }, delay);

    return () => clearTimeout(handler);
  }, [delay]);

  return debouncedCallback;
}

function App() {
  const [locations, setLocations] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [mapWidth, setMapWidth] = useState(70);
  const [topHeight, setTopHeight] = useState(80);
  const [renderings, setRenderings] = useState('');
  const [isApproved, setIsApproved] = useState(false);
  const isDraggingVertical = useRef(false);
  const isDraggingHorizontal = useRef(false);
  const termRenderings = useMemo(() => new TermRenderings('/data/term-renderings.json'), []);

  // Memoize updateMarkerColor to prevent infinite loops
  const updateMarkerColor = useCallback(() => {
    const newLocations = locations.map(loc => {
      const { color } = termRenderings.getStatus(loc.termId, loc.vernacularName || '');
      return { ...loc, color };
    });
    if (JSON.stringify(newLocations) !== JSON.stringify(locations)) {
      setLocations(newLocations);
    }
    if (selectedLocation) {
      const { color } = termRenderings.getStatus(selectedLocation.termId, selectedLocation.vernacularName || '');
      if (selectedLocation.color !== color) {
        setSelectedLocation({ ...selectedLocation, color });
      }
    }
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
      console.warn(`No term renderings entry for termId: ${location.termId}`);
    }
    updateMarkerColor();
  }, [termRenderings, setRenderings, setIsApproved, updateMarkerColor]);

  const handleUpdateVernacular = useCallback((id, newVernacular) => {
    const newLocations = locations.map(loc =>
      loc.id === id ? { ...loc, vernacularName: newVernacular } : loc
    );
    setLocations(newLocations);
    if (selectedLocation && selectedLocation.id === id) {
      setSelectedLocation({ ...selectedLocation, vernacularName: newVernacular });
    }
    updateMarkerColor();
  }, [locations, selectedLocation, updateMarkerColor]);

  const handleNextLocation = useCallback((e) => {
    if ((e.key === 'Enter' || e.key === 'Tab') && selectedLocation) {
      e.preventDefault();
      const currentIndex = locations.findIndex(loc => loc.id === selectedLocation.id);
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
          const initialLocations = [
            {
              id: 1,
              englishName: 'Jerusalem',
              vernacularName: '',
              termId: 'Ἱεροσόλυμα',
              x: 603,
              y: 762,
              description: 'City of David',
              labelPosition: 'left',
              labelRotation: 0,
            },
            {
              id: 2,
              englishName: 'Bethlehem',
              vernacularName: '',
              termId: 'Βηθλεέμ',
              x: 594,
              y: 821,
              description: 'Birthplace of Jesus',
              labelPosition: 'right',
              labelRotation: 0,
            },
            {
              id: 3,
              englishName: 'Jordan River',
              vernacularName: '',
              termId: 'Ἰορδάνης',
              x: 820,
              y: 340,
              description: 'Site of Jesus’ baptism',
              labelPosition: 'right',
              labelRotation: 80,
            },
          ].map(loc => ({
            ...loc,
            vernacularName: loc.vernacularName || termRenderings.getMapForm(loc.termId),
            color: termRenderings.getStatus(loc.termId, loc.vernacularName || '').color,
          }));
          console.log('Initial locations:', initialLocations);
          setLocations(initialLocations);
          updateMarkerColor(); // Ensure initial colors are set
          if (initialLocations.length > 0) {
            handleSelectLocation(initialLocations[0]); // Auto-select first location
          }
          clearInterval(interval);
        }
      }, 100); // Check every 100ms
      return () => clearInterval(interval);
    }
  }, [termRenderings, updateMarkerColor, handleSelectLocation]);

  return (
    <div className="app-container">
      <div className="top-section" style={{ flex: `0 0 ${topHeight}%` }}>
        <div className="map-pane" style={{ flex: `0 0 ${mapWidth}%` }}>
          <MapPane
            imageUrl="/assets/biblical-map.jpg"
            locations={locations}
            onSelectLocation={handleSelectLocation}
            selectedLocation={selectedLocation}
          />
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
          />
        </div>
      </div>
      <div
        className="horizontal-divider"
        onMouseDown={handleHorizontalDragStart}
      >
        ═════
      </div>
      <div className="third-pane" style={{ flex: `0 0 ${100 - topHeight}%` }}>
        <ThirdPane termId={selectedLocation?.termId} />
      </div>
    </div>
  );
}

function MapPane({ imageUrl, locations, onSelectLocation, selectedLocation }) {
  const imageHeight = 988;
  const bounds = [[0, 0], [imageHeight, 1165]];
  const crs = L.CRS.Simple;

  const transformedLocations = locations.map((loc) => {
    const yLeaflet = imageHeight - loc.y;
    console.log(`Transformed: ${loc.englishName}, [${yLeaflet}, ${loc.x}], color: ${loc.color}`);
    return { ...loc, yLeaflet };
  });

  return (
    <MapContainer
      crs={crs}
      bounds={bounds}
      maxBounds={bounds}
      maxBoundsViscosity={1.0}
      style={{ height: '100%', width: '100%' }}
      zoom={0}
      minZoom={-2}
      maxZoom={3}
      center={[imageHeight / 2, 1165 / 2]}
      scrollWheelZoom={false}
    >
      <ImageOverlay url={imageUrl} bounds={bounds} />
      <FitBounds bounds={bounds} />
      {transformedLocations.length > 0 ? (
        transformedLocations.map((loc) => (
          <Marker
            key={loc.id}
            position={[loc.yLeaflet, loc.x]}
            icon={createCustomIcon(
              loc.englishName,
              loc.vernacularName,
              loc.labelPosition,
              loc.labelRotation,
              loc.color || 'gray',
              selectedLocation && selectedLocation.id === loc.id // Pass isSelected
            )}
            eventHandlers={{ click: () => onSelectLocation(loc) }}
            aria-label={`Marker for ${loc.englishName}`}
            tabIndex={0}
          >
            {/* <Popup>{loc.englishName}</Popup> */}
          </Marker>
        ))
      ) : (
        <div>No locations to display</div>
      )}
    </MapContainer>
  );
}

function DetailsPane({ selectedLocation, onUpdateVernacular, onNextLocation, renderings, isApproved, onRenderingsChange, onApprovedChange, onSaveRenderings, termRenderings }) {
  const [vernacular, setVernacular] = useState(selectedLocation?.vernacularName || '');
  const inputRef = useRef(null);

  // Debounce the onUpdateVernacular call to reduce re-renders
  const debouncedUpdateVernacular = useDebounce((id, newVernacular) => {
    onUpdateVernacular(id, newVernacular);
  }, 300);

  useEffect(() => {
    console.log('DetailsPane updating with selectedLocation:', selectedLocation);
    setVernacular(selectedLocation?.vernacularName || '');
  }, [selectedLocation]);

  useEffect(() => {
    if (selectedLocation && inputRef.current) {
      inputRef.current.focus();
    }
  }, [selectedLocation]);

  const handleChange = (e) => {
    const newVernacular = e.target.value;
    setVernacular(newVernacular);
    if (selectedLocation) {
      debouncedUpdateVernacular(selectedLocation.id, newVernacular);
    }
  };

  if (!selectedLocation) {
    console.log('No selected location, showing default message');
    return <div className="no-selection">Select a location</div>;
  }

  const status = selectedLocation ? termRenderings.getStatus(selectedLocation.termId, selectedLocation.vernacularName).status : '';

  return (
    <div>
      <h2>{selectedLocation.englishName}</h2>
      <p>
        {selectedLocation.description} <span style={{ fontStyle: 'italic' }}>({selectedLocation.termId})</span>
      </p>
      <div style={{ backgroundColor: selectedLocation.color || 'gray', margin: '10px', padding: '10px' }}>
        <input
          ref={inputRef}
          type="text"
          value={vernacular}
          onChange={handleChange}
          onKeyDown={onNextLocation}
          placeholder="Enter vernacular name"
          className="form-control mb-2"
          aria-label={`Vernacular name for ${selectedLocation.englishName}`}
          style={{ width: '100%', border: 'none' }} // Remove border, ensure it fits
        />
        {selectedLocation.color && <p>{status}</p>}
      </div>
      <h4>Term Renderings</h4> {/* Changed to h4 for smaller size */}
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