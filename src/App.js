import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, ImageOverlay, Marker, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import './App.css';

// Fix Leaflet default marker icons (optional, not needed with custom SVG icons)
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// Function to create custom SVG icon with permanent label
const createCustomIcon = (englishName, vernacularName, labelPosition = 'right', labelRotation = 0, selected = false) => {
  const hasVernacular = vernacularName && vernacularName.trim() !== '';
  const markerColor = hasVernacular ? '#00FF00' : '#FF0000'; // Green if vernacular exists, else red
  const labelColor = hasVernacular ? '#006400' : '#8B0000'; // Dark green or dark red
  const label = hasVernacular ? vernacularName : `(${englishName})`;

  // Simplified SVG with explicit fill-opacity
  const svg = `
    <svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="10" fill="${markerColor}" fill-opacity="1" stroke="black" stroke-width="2"/>
    </svg>
  `;

  // Determine label placement (left or right of marker)
  const isLeft = labelPosition === 'left';
  const labelHtml = `
    <span style="
      color: ${labelColor};
      font-size: 14px;
      font-weight: bold;
      white-space: nowrap;
      background: ${selected ? '#FFFFE0' : 'rgba(255, 255, 255, 0.9)'};
      ${selected ? 'border: 2px solid black;' : 'border: none;'}
      padding: 2px 6px;
      border-radius: 3px;
      transform: rotate(-${labelRotation}deg);
      transform-origin: ${isLeft ? 'right center' : 'left center'};
      position: absolute;
      ${isLeft ? 'right: 24px;' : 'left: 24px;'}
      line-height: 24px;
    ">${label}</span>
  `;

  // Use flex container with marker as anchor, label positioned absolutely
  const html = `
    <div style="display: flex; align-items: center; width: 24px; height: 24px; position: relative;">
      ${svg}
      ${labelHtml}
    </div>
  `;

  return L.divIcon({
    html,
    className: '', // Avoid CSS conflicts
    iconSize: [120, 24], // Wider to accommodate long labels
    iconAnchor: [12, 12], // Center the marker on coordinates
    popupAnchor: [isLeft ? -24 : 60, -12], // Adjust popup for label position (currently disabled)
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

function App() {
  const [locations, setLocations] = useState([
    {
      id: 1,
      englishName: 'Jerusalem',
      vernacularName: '', // Red marker, (Jerusalem) label on left
      x: 603,
      y: 762,
      description: 'City of David',
      labelPosition: 'left',
      labelRotation: 0,
    },
    {
      id: 2,
      englishName: 'Bethlehem',
      vernacularName: 'Bayt Lahm', // Green marker, Bayt Lahm label on right
      x: 594,
      y: 821,
      description: 'Birthplace of Jesus',
      labelPosition: 'right',
      labelRotation: 0,
    },
    {
      id: 3,
      englishName: 'Jordan River',
      vernacularName: '', // Red marker, (Jordan River) label rotated 80deg
      x: 820,
      y: 340,
      description: 'Site of Jesus’ baptism',
      labelPosition: 'right',
      labelRotation: 80,
    },
  ]);
  const [selectedLocation, setSelectedLocation] = useState(null);

  const handleSelectLocation = (location) => setSelectedLocation(location);

  const handleUpdateVernacular = (id, newVernacular) => {
    setLocations(locations.map((loc) =>
      loc.id === id ? { ...loc, vernacularName: newVernacular } : loc
    ));
  };

  const handleNextLocation = (e) => {
    if ((e.key === 'Enter' || e.key === 'Tab') && selectedLocation) {
      e.preventDefault(); // Prevent default Tab behavior (e.g., moving focus)
      const currentIndex = locations.findIndex(loc => loc.id === selectedLocation.id);
      let nextIndex;
      if (e.shiftKey) {
        // Cycle backwards with Shift+Tab or Shift+Enter
        nextIndex = (currentIndex - 1 + locations.length) % locations.length;
      } else {
        // Cycle forward with Tab or Enter
        nextIndex = (currentIndex + 1) % locations.length;
      }
      const nextLocation = locations[nextIndex];
      handleSelectLocation(nextLocation);
    }
  };

  return (
    <div className="app-container">
      <div className="map-pane">
        <MapPane
          imageUrl="/assets/biblical-map.jpg"
          locations={locations}
          onSelectLocation={handleSelectLocation}
          selectedLocation={selectedLocation}
        />
      </div>
      <div className="details-pane">
        <DetailsPane
          selectedLocation={selectedLocation}
          onUpdateVernacular={handleUpdateVernacular}
          onNextLocation={handleNextLocation}
        />
      </div>
    </div>
  );
}

function MapPane({ imageUrl, locations, onSelectLocation, selectedLocation }) {
  const imageHeight = 988;
  const bounds = [[0, 0], [imageHeight, 1165]];
  const crs = L.CRS.Simple;

  const transformedLocations = locations.map((loc) => {
    const yLeaflet = imageHeight - loc.y; // Convert bottom-left y to top-left
    console.log(`Transformed: ${loc.englishName}, [${yLeaflet}, ${loc.x}]`);
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
      {transformedLocations.map((loc) => (
        <Marker
          key={loc.id}
          position={[loc.yLeaflet, loc.x]}
          icon={createCustomIcon(
            loc.englishName,
            loc.vernacularName,
            loc.labelPosition,
            loc.labelRotation,
            selectedLocation && selectedLocation.id === loc.id
          )}
          eventHandlers={{ click: () => onSelectLocation(loc) }}
          aria-label={`Marker for ${loc.englishName}`}
          tabIndex={0}
        >
          {/* <Popup>{loc.englishName}</Popup> */}
        </Marker>
      ))}
    </MapContainer>
  );
}

function DetailsPane({ selectedLocation, onUpdateVernacular, onNextLocation }) {
  const [vernacular, setVernacular] = useState(selectedLocation?.vernacularName || '');
  const inputRef = useRef(null);

  // Sync vernacular state with selectedLocation changes
  useEffect(() => {
    setVernacular(selectedLocation?.vernacularName || '');
  }, [selectedLocation]);

  // Focus the input field whenever selectedLocation changes
  useEffect(() => {
    if (selectedLocation && inputRef.current) {
      inputRef.current.focus();
    }
  }, [selectedLocation]);

  // Update vernacular name as user types
  const handleChange = (e) => {
    const newVernacular = e.target.value;
    setVernacular(newVernacular);
    if (selectedLocation) {
      onUpdateVernacular(selectedLocation.id, newVernacular);
    }
  };

  if (!selectedLocation) return <div className="no-selection">Select a location</div>;

  return (
    <div>
      <h2>{selectedLocation.englishName}</h2>
      <p>{selectedLocation.description}</p>
      <input
        ref={inputRef}
        type="text"
        value={vernacular}
        onChange={handleChange}
        onKeyDown={onNextLocation}
        placeholder="Enter vernacular name"
        className="form-control mb-2"
        aria-label={`Vernacular name for ${selectedLocation.englishName}`}
      />
    </div>
  );
}

export default App;