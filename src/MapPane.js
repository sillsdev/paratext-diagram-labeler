import React, { useEffect, useMemo } from 'react';
import Leaf from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { inLang, statusValue, getMatchTally } from './Utils.js';
import { collPlacenames } from './CollPlacenamesAndRefs.js';


export default function MapPane({ imageUrl, locations, onSelectLocation, selLocation, labelScale, mapDef, termRenderings, lang, resetZoomFlag, setResetZoomFlag, extractedVerses }) {
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
    // console.log('[MapPanController] render', selLocation, locations.length);
    // --- Extract selectedLocation for dependency
    const selectedLocation = locations[selLocation];
    useEffect(() => {
      // console.log('[MapPanController] useEffect triggered', selLocation, locations.length);
      if (!map || !selectedLocation) {
        // console.log('[MapPanController] map or location missing', map, locations.length, selLocation);
        return;
      }
      const loc = selectedLocation;
      const yLeaflet = mapDef.height - loc.y;
      const markerLatLng = [yLeaflet, loc.x];
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
      // Only pan if needed
      if (newLat !== map.getCenter().lat || newLng !== map.getCenter().lng) {
        map.panTo([newLat, newLng], { animate: true });
        setTimeout(() => {
          map.invalidateSize();
        }, 500);
      }
    }, [selLocation, selectedLocation, mapDef, map, locations]);

    // Also re-run pan logic when zoom changes
    useEffect(() => {
      if (!map) return;
      const handleZoom = () => {
        // Trigger the same pan logic as on selection
        if (!locations.length || !locations[selLocation]) return;
        const loc = locations[selLocation];
        const yLeaflet = mapDef.height - loc.y;
        const markerLatLng = [yLeaflet, loc.x];
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
        if (newLat !== map.getCenter().lat || newLng !== map.getCenter().lng) {
          map.panTo([newLat, newLng], { animate: true });
          setTimeout(() => map.invalidateSize(), 500);
        }
      };
      map.on('zoomend', handleZoom);
      return () => map.off('zoomend', handleZoom);
    }, [map, selLocation, locations, mapDef]);

    // --- Reset zoom to fit bounds when resetZoomFlag changes ---
    useEffect(() => {
      // console.log('[MapPanController] Resetting zoom to fit bounds', resetZoomFlag);
      if (!map) return;
      if (resetZoomFlag) {
        map.fitBounds([[0, 0], [mapDef.height, mapDef.width]]);
        setResetZoomFlag(false);
      }
    }, [resetZoomFlag, map, mapDef.height, mapDef.width, setResetZoomFlag]);

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
    >
      <ZoomControl position="topright" />
      <ImageOverlay url={imageUrl} bounds={bounds} />
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
              selLocation === loc.idx,
              labelScale,
              frac(getMatchTally(termRenderings[loc.termId], collPlacenames.getRefs(loc.mergeKey), extractedVerses), true)
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

