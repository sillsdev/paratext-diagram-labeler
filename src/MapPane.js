import React, { useEffect, useMemo } from 'react';
import Leaf from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { inLang, statusValue, getMatchTally } from './Utils.js';
import { collectionManager } from './CollectionManager';

// Component that handles map zoom and pan logic
function MapController({ 
  resetZoomFlag, 
  setResetZoomFlag, 
  selLocation, 
  transformedLocations, 
  imageHeight, 
  imageWidth 
}) {
  const { useMap } = require('react-leaflet');
  const map = useMap();

  // Effect for handling zoom reset
  useEffect(() => {
    if (!resetZoomFlag || !map) return;

    const timeoutId = setTimeout(() => {
      try {
        // Reset zoom and pan to fit the map image
        const bounds = [[0, 0], [imageHeight, imageWidth]];
        map.fitBounds(bounds, { animate: true, duration: 0.5 });
        
        // Clear the reset flag
        setResetZoomFlag(false);
      } catch (error) {
        console.error('Error resetting zoom:', error);
        setResetZoomFlag(false);
      }
    }, 50); // Small delay to ensure map is ready

    return () => clearTimeout(timeoutId);
  }, [resetZoomFlag, setResetZoomFlag, map, imageHeight, imageWidth]);

  // Effect for smart panning to selected location
  useEffect(() => {
    if (!selLocation || !map || !transformedLocations.length) return;

    const timeoutId = setTimeout(() => {
      try {
        const selectedLoc = transformedLocations.find(loc => loc.idx === selLocation);
        if (!selectedLoc) return;

        const targetPoint = [selectedLoc.yLeaflet, selectedLoc.x];
        const mapSize = map.getSize();

        // Calculate 15% buffer zone
        const bufferX = mapSize.x * 0.15;
        const bufferY = mapSize.y * 0.15;

        // Convert target point to pixel coordinates
        const targetPixel = map.latLngToContainerPoint(targetPoint);

        // Check if point is outside the buffer zone
        const needsPan = 
          targetPixel.x < bufferX || 
          targetPixel.x > (mapSize.x - bufferX) ||
          targetPixel.y < bufferY || 
          targetPixel.y > (mapSize.y - bufferY);

        if (needsPan) {
          // Calculate the center of the buffer zone
          const centerX = mapSize.x / 2;
          const centerY = mapSize.y / 2;
          
          // Calculate how much to adjust the pan
          let deltaX = 0;
          let deltaY = 0;

          if (targetPixel.x < bufferX) {
            deltaX = bufferX - targetPixel.x + 20; // Extra 20px margin
          } else if (targetPixel.x > (mapSize.x - bufferX)) {
            deltaX = (mapSize.x - bufferX) - targetPixel.x - 20;
          }

          if (targetPixel.y < bufferY) {
            deltaY = bufferY - targetPixel.y + 20;
          } else if (targetPixel.y > (mapSize.y - bufferY)) {
            deltaY = (mapSize.y - bufferY) - targetPixel.y - 20;
          }

          // Convert the adjusted pixel position back to lat/lng
          const newCenterPixel = {
            x: centerX + deltaX,
            y: centerY + deltaY
          };
          const newCenter = map.containerPointToLatLng(newCenterPixel);

          // Pan to the new center with animation
          map.panTo(newCenter, { animate: true, duration: 0.5 });
        }
      } catch (error) {
        console.error('Error panning to selected location:', error);
      }
    }, 100); // Small delay to ensure selection state is stable

    return () => clearTimeout(timeoutId);
  }, [selLocation, map, transformedLocations]);

  return null; // This component doesn't render anything
}

export default function MapPane({
  imageUrl,
  locations,
  onSelectLocation,
  selLocation,
  labelScale,
  mapDef,
  termRenderings,
  lang,
  resetZoomFlag,
  setResetZoomFlag,
  extractedVerses,
  collectionId = 'SMR',
}) {
  const { MapContainer, ImageOverlay, Marker, ZoomControl } = require('react-leaflet');
  const imageHeight = mapDef.height;
  const imageWidth = mapDef.width;
  const bounds = useMemo(
    () => [
      [0, 0],
      [imageHeight, imageWidth],
    ],
    [imageHeight, imageWidth]
  );
  const crs = Leaf.CRS.Simple;
  const transformedLocations = locations.map(loc => {
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
      zoomSnap={0.25}      zoomControl={false}
      // REMOVE: whenCreated={mapInstance => { if (mapRef) mapRef.current = mapInstance; }}
    >
      <MapController 
        resetZoomFlag={resetZoomFlag}
        setResetZoomFlag={setResetZoomFlag}
        selLocation={selLocation}
        transformedLocations={transformedLocations}
        imageHeight={imageHeight}
        imageWidth={imageWidth}
      />
      <ZoomControl position="topright" />
      {imageUrl ? (
        <ImageOverlay 
          key={`image-${mapDef.imgFilename || 'default'}`}
          bounds={[[0, 0], [mapDef.height, mapDef.width]]}
          url={imageUrl} 
        />
      ) : (
        <div
          className="image-loading-error"
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: 'rgba(0,0,0,0.7)',
            color: 'white',
            padding: '10px',
            borderRadius: '5px',
            zIndex: 1000,
          }}
        >
          {imageUrl === undefined
            ? 'Loading map image...'
            : 'Image loading failed. Please check the installation.'}
        </div>
      )}
      {transformedLocations.length > 0
        ? transformedLocations.map(loc => (
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
                frac(
                  getMatchTally(
                    termRenderings[loc.termId],
                    collectionManager.getRefs(loc.mergeKey, collectionId),
                    extractedVerses
                  ),
                  true
                )
              )}
              eventHandlers={{ click: () => onSelectLocation(loc) }}
              tabIndex={0}
            ></Marker>
          ))
        : null}
    </MapContainer>
  );
}

// Function to create a map label
function createLabel(
  labelText,
  align = 'right',
  angle = 0,
  size = 3,
  status,
  isSelected = false,
  labelScale = 1,
  extra
) {
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
    `background: ${
      backgroundColor
        ? `color-mix(in srgb, ${backgroundColor} 75%, transparent)`
        : 'rgba(0,0,0,0.75)'
    };`,
    'padding: 0 0.5em;', // 0px top/bottom, 0.5em left/right
    'border-radius: 0.83em;', // 10px if font-size is 12px
    'line-height: 1.6em;', // scale height of label
    'position: absolute;',
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
    <div style="display: flex; align-items: center;${
      isCenter ? ' justify-content: center;' : ''
    } width: 2em; height: 2em; position: relative;">
      <span class="${
        isSelected ? 'selected-label' : 'unselected-label'
      }" style="${spanStyle}">${labelText}${extra}</span>
    </div>
  `;

  return Leaf.divIcon({
    html,
    className: '',
  });
}

function frac([num, denom, anyDenials], show = true) {
  // console.log('Creating fraction:', num, denom, show);
  return !denom || num === denom || !show ? '' : ` <sup>${num}</sup>&frasl;<sub>${denom}</sub>`;
}
