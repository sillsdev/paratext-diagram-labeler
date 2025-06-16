import React, { useEffect, useMemo, useRef } from 'react';
import Leaf from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { inLang, statusValue, getMatchTally } from './Utils.js';
import { collectionManager } from './CollectionManager';


export default function MapPane({ imageUrl, locations, onSelectLocation, selLocation, labelScale, mapDef, termRenderings, lang, resetZoomFlag, setResetZoomFlag, extractedVerses, collectionId = 'SMR' }) {
  // Log all props to check for identity changes
  // console.log('[MapPane] render', {
  //   imageUrl,
  //   locations,
  //   onSelectLocation,
  //   selLocation,
  //   labelScale,
  //   mapDef,
  //   termRenderings,
  //   lang,
  // });
  // console.log('[MapPane] Component render/mount');
  const { MapContainer, ImageOverlay, Marker, ZoomControl, useMap } = require('react-leaflet');
  const imageHeight = mapDef.height;
  const imageWidth = mapDef.width;
  const bounds = useMemo(() => [[0, 0], [imageHeight, imageWidth]], [imageHeight, imageWidth]);
  const crs = Leaf.CRS.Simple;
  // --- Robust panning logic: ensure selected marker is in view ---
  function MapPanController({ selLocation, locations, mapDef, resetZoomFlag, setResetZoomFlag }) {
    const map = useMap();
    // --- Extract selectedLocation for dependency
    const selectedLocation = locations[selLocation];
    // Use ref to track mounted state
    const isMountedRef = useRef(true);
    // Ref to track timeout IDs for cleanup
    const timeoutRef = useRef(null);
    
    // Setup mounted flag and cleanup
    useEffect(() => {
      isMountedRef.current = true;
      
      return () => {
        // Mark component as unmounted first
        isMountedRef.current = false;
        
        // Clear any pending timeouts
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
        
        // Cleanup any map event handlers or timers when unmounting
        if (map) {
          try {
            // Remove all event listeners
            map.off();
            // Cancel any animations
            map.stop();
          } catch (err) {
            console.log("Error during map cleanup:", err);
            // Ignore errors during cleanup
          }
        }
      };
    }, [map]);
    
    useEffect(() => {
      if (!map || !selectedLocation || !isMountedRef.current) {
        return;
      }
      
      try {
        const loc = selectedLocation;
        const yLeaflet = mapDef.height - loc.y;
        const markerLatLng = [yLeaflet, loc.x];
        
        // Guard against map being destroyed
        if (!map._loaded || !isMountedRef.current) return;
        
        const bounds = map.getBounds();
        const paddingLat = (bounds.getNorth() - bounds.getSouth()) * 0.15; // 15% padding
        const paddingLng = (bounds.getEast() - bounds.getWest()) * 0.15;
        let newLat = map.getCenter().lat;
        let newLng = map.getCenter().lng;
        
        // Check latitude (vertical)
        if (markerLatLng[0] > bounds.getNorth() - paddingLat) {
          newLat = markerLatLng[0] - (bounds.getNorth() - newLat) + paddingLat;
        } else if (markerLatLng[0] < bounds.getSouth() + paddingLat) {
          newLat = markerLatLng[0] - (bounds.getSouth() - newLat) - paddingLat;
        }
        
        // Check longitude (horizontal)
        if (markerLatLng[1] > bounds.getEast() - paddingLng) {
          newLng = markerLatLng[1] - (bounds.getEast() - newLng) + paddingLng;
        } else if (markerLatLng[1] < bounds.getWest() + paddingLng) {
          newLng = markerLatLng[1] - (bounds.getWest() - newLng) - paddingLng;
        }
        
        // Only pan if needed and component is still mounted
        if (isMountedRef.current && map._loaded && (newLat !== map.getCenter().lat || newLng !== map.getCenter().lng)) {
          map.panTo([newLat, newLng], { animate: true });
          
          // Clear any previous pending timeout
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
          }
          
          // Set a new timeout and store its ID
          timeoutRef.current = setTimeout(() => {
            if (isMountedRef.current && map._loaded) {
              try {
                map.invalidateSize();
              } catch (err) {
                console.log("Error invalidating map size:", err);
              }
            }
          }, 500);
        }
      } catch (err) {
        console.log("Error in map pan controller:", err);
      }
    }, [selLocation, selectedLocation, mapDef, map, locations]);    // Also re-run pan logic when zoom changes
    useEffect(() => {
      if (!map || !isMountedRef.current) return;
      
      // Store timeout ID for cleanup
      let zoomTimeoutId = null;
      
      const handleZoom = () => {
        try {
          // Check if component is still mounted and map is valid
          if (!isMountedRef.current || !map._loaded) return;
          
          // Trigger the same pan logic as on selection
          if (!locations.length || !locations[selLocation]) return;
          
          const loc = locations[selLocation];
          const yLeaflet = mapDef.height - loc.y;
          const markerLatLng = [yLeaflet, loc.x];
          
          // Guard against map being destroyed
          if (!map._loaded || !isMountedRef.current) return;
          
          const bounds = map.getBounds();
          const paddingLat = (bounds.getNorth() - bounds.getSouth()) * 0.15;
          const paddingLng = (bounds.getEast() - bounds.getWest()) * 0.15;
          let newLat = map.getCenter().lat;
          let newLng = map.getCenter().lng;
          
          if (markerLatLng[0] > bounds.getNorth() - paddingLat) {
            newLat = markerLatLng[0] - (bounds.getNorth() - newLat) + paddingLat;
          } else if (markerLatLng[0] < bounds.getSouth() + paddingLat) {
            newLat = markerLatLng[0] - (bounds.getSouth() - newLat) - paddingLat;
          }
          
          if (markerLatLng[1] > bounds.getEast() - paddingLng) {
            newLng = markerLatLng[1] - (bounds.getEast() - newLng) + paddingLng;
          } else if (markerLatLng[1] < bounds.getWest() + paddingLng) {
            newLng = markerLatLng[1] - (bounds.getWest() - newLng) - paddingLng;
          }
          
          // Only pan if needed and component is still mounted
          if (isMountedRef.current && map._loaded && (newLat !== map.getCenter().lat || newLng !== map.getCenter().lng)) {
            map.panTo([newLat, newLng], { animate: true });
            
            // Clear any existing timeout
            if (zoomTimeoutId) {
              clearTimeout(zoomTimeoutId);
            }
            
            // Create new timeout
            zoomTimeoutId = setTimeout(() => {
              if (isMountedRef.current && map._loaded) {
                try {
                  map.invalidateSize();
                } catch (err) {
                  // Ignore map errors during cleanup
                }
              }
            }, 500);
          }
        } catch (err) {
          console.log("Error in zoom handler:", err);
        }
      };
      
      try {
        map.on('zoomend', handleZoom);
      } catch (err) {
        console.log("Error setting zoom handler:", err);
      }
      
      return () => {
        // Clear any pending timeout
        if (zoomTimeoutId) {
          clearTimeout(zoomTimeoutId);
        }
        
        // Remove the event listener
        try {
          if (map && map.off) {
            map.off('zoomend', handleZoom);
          }
        } catch (err) {
          // Ignore cleanup errors
        }
      };
    }, [map, selLocation, locations, mapDef, isMountedRef]);    // --- Reset zoom to fit bounds when resetZoomFlag changes ---
    useEffect(() => {
      if (!map || !isMountedRef.current || !resetZoomFlag) return;
      
      try {
        if (map._loaded) {
          map.fitBounds([[0, 0], [mapDef.height, mapDef.width]]);
        }
      } catch (err) {
        console.log("Error resetting zoom:", err);
      } finally {
        // Always reset the flag to prevent getting stuck
        if (isMountedRef.current) {
          setResetZoomFlag(false);
        }
      }
    }, [resetZoomFlag, map, mapDef.height, mapDef.width, setResetZoomFlag, isMountedRef]);

    return null;
  }

  const transformedLocations = locations.map((loc) => {
    const yLeaflet = imageHeight - loc.y;
    return { ...loc, yLeaflet };
  });
  return (
    <MapContainer
      crs={crs}
      bounds={bounds}
      style={{ height: '100%', width: '100%' }}
      minZoom={-2}
      maxZoom={3}
      zoom={0}
      scrollWheelZoom={false}
      zoomDelta={0.25}
      zoomSnap={0.25}
      zoomControl={false}
      // REMOVE: whenCreated={mapInstance => { if (mapRef) mapRef.current = mapInstance; }}
    >      <ZoomControl position="topright" />
      {imageUrl ? (
        <ImageOverlay url={imageUrl} bounds={bounds} />
      ) : (
        <div className="image-loading-error" style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          background: 'rgba(0,0,0,0.7)',
          color: 'white',
          padding: '10px',
          borderRadius: '5px',
          zIndex: 1000
        }}>
          {imageUrl === undefined ? 
            "Loading map image..." : 
            "Image loading failed. Please check the installation."}
        </div>
      )}
      <MapPanController selLocation={selLocation} locations={locations} mapDef={mapDef} resetZoomFlag={resetZoomFlag} setResetZoomFlag={setResetZoomFlag} />
      {transformedLocations.length > 0 ? (
        transformedLocations.map((loc) => (
          <Marker
            key={loc.termId}
            position={[loc.yLeaflet, loc.x]}
            icon={createLabel(
              loc.vernLabel || `(${inLang(loc.gloss, lang)})`,
              loc.align,
              loc.angle,
              loc.size,
              loc.status,
              selLocation === loc.idx,              labelScale,
              frac(getMatchTally(termRenderings[loc.termId], collectionManager.getRefs(loc.mergeKey, collectionId), extractedVerses), true)
            )}
            eventHandlers={{ click: () => onSelectLocation(loc) }}
            tabIndex={0}
          >
          </Marker>
        ))
      ) : null}
    </MapContainer>
  );
}

// Function to create a map label
function createLabel(labelText, align = 'right', angle = 0, size = 3, status, isSelected = false, labelScale = 1, extra) {
  const isLeft = align === 'left';
  const isCenter = align === 'center';
  const backgroundColor = statusValue[status].bkColor;
  const textColor = statusValue[status].textColor; 
  // Base font size in px (matches your app's base font size)
  const baseFontSize = 18 * labelScale;
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
      <span class="${isSelected ? 'selected-label' : 'unselected-label'}" style="${spanStyle}">${labelText}${extra}</span>
    </div>
  `;
 
  return Leaf.divIcon({
    html,
    className: '',
  });
};

function frac([num, denom, anyDenials], show=true) {
  // console.log('Creating fraction:', num, denom, show);
  return (!denom || num===denom || !show) ? '' : ` <sup>${num}</sup>&frasl;<sub>${denom}</sub>`;
}

