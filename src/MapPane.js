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
  imageWidth,
}) {
  const { useMap } = require('react-leaflet');
  const map = useMap();

  // Effect for handling zoom reset
  useEffect(() => {
    if (!resetZoomFlag || !map) return;

    const timeoutId = setTimeout(() => {
      try {
        // Reset zoom and pan to fit the map image
        const bounds = [
          [0, 0],
          [imageHeight, imageWidth],
        ];
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

        const locationPoint = [selectedLoc.yLeaflet, selectedLoc.x];
        console.log('Selected location point:', locationPoint);

        // Get current map bounds in image coordinates
        const bounds = map.getBounds();
        const currentTopLeft = [bounds.getNorth(), bounds.getWest()];
        const currentBottomRight = [bounds.getSouth(), bounds.getEast()];
        console.log('Current map bounds:', {
          currentTopLeft,
          currentBottomRight,
        });

        // Calculate buffer zone in image coordinates (15% of current view)
        const viewHeight = currentBottomRight[0] - currentTopLeft[0];
        const viewWidth = currentBottomRight[1] - currentTopLeft[1];
        console.log('Current view dimensions:', { viewHeight, viewWidth });
        const bufferY = viewHeight * 0.15;
        const bufferX = viewWidth * 0.15;
        console.log('Buffer zone:', { bufferY, bufferX });

        // Define comfortable viewing area boundaries
        const comfortableTop = currentTopLeft[0] + bufferY;
        const comfortableBottom = currentBottomRight[0] - bufferY;
        const comfortableLeft = currentTopLeft[1] + bufferX;
        const comfortableRight = currentBottomRight[1] - bufferX;
        console.log('Comfortable viewing area:', {
          comfortableTop,
          comfortableBottom,
          comfortableLeft,
          comfortableRight,
        });

        // Check if location is outside comfortable viewing area
        const needsPanning =
          locationPoint[0] < comfortableTop || // Above comfort zone
          locationPoint[0] > comfortableBottom || // Below comfort zone
          locationPoint[1] < comfortableLeft || // Left of comfort zone
          locationPoint[1] > comfortableRight; // Right of comfort zone
        console.log('Needs panning:', needsPanning);

        if (needsPanning) {
          // Calculate new center to bring location into comfortable zone
          const currentCenter = map.getCenter();
          let newLat = currentCenter.lat;
          let newLng = currentCenter.lng;
          console.log('Current map center:', currentCenter);

          // Adjust vertically if needed
          if (locationPoint[0] < comfortableTop) {
            // Location is above comfort zone, pan up (decrease lat)
            newLat = currentCenter.lat - (comfortableTop - locationPoint[0]);
            console.log('Panning up to new lat:', newLat);
          } else if (locationPoint[0] > comfortableBottom) {
            // Location is below comfort zone, pan down (increase lat)
            newLat = currentCenter.lat + (locationPoint[0] - comfortableBottom);
            console.log('Panning down to new lat:', newLat);
          }

          // Adjust horizontally if needed
          if (locationPoint[1] < comfortableLeft) {
            // Location is left of comfort zone, pan left (decrease lng)
            newLng = currentCenter.lng - (comfortableLeft - locationPoint[1]);
            console.log('Panning left to new lng:', newLng);
          } else if (locationPoint[1] > comfortableRight) {
            // Location is right of comfort zone, pan right (increase lng)
            newLng = currentCenter.lng + (locationPoint[1] - comfortableRight);
            console.log('Panning right to new lng:', newLng);
          }

          // Pan to the new center with smooth animation
          map.panTo([newLat, newLng], { animate: true, duration: 0.5 });
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
      zoomSnap={0.25}
      zoomControl={false}
      attributionControl={false} // Disable attribution
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
          bounds={[
            [0, 0],
            [mapDef.height, mapDef.width],
          ]}
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
