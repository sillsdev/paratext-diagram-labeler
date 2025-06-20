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
        if (!selectedLoc) return;        const locationPoint = [selectedLoc.yLeaflet, selectedLoc.x];
        console.log('Selected location point:', locationPoint);

        // Get current map size and center
        const mapSize = map.getSize();
        const currentCenter = map.getCenter();
        console.log('Map size (pixels):', mapSize);
        console.log('Current center:', currentCenter);

        // Convert location to pixel coordinates
        const locationPixel = map.latLngToContainerPoint(locationPoint);
        console.log('Location in pixels:', locationPixel);

        // Calculate 15% buffer zone in pixels
        const bufferX = mapSize.x * 0.15;
        const bufferY = mapSize.y * 0.15;
        console.log('Buffer zone (pixels):', { bufferX, bufferY });

        // Define comfortable viewing area in pixel coordinates
        const comfortableLeft = bufferX;
        const comfortableRight = mapSize.x - bufferX;
        const comfortableTop = bufferY;
        const comfortableBottom = mapSize.y - bufferY;
        console.log('Comfortable pixel area:', {
          comfortableLeft,
          comfortableRight,
          comfortableTop,
          comfortableBottom
        });        // Check if location pixel is TOO CLOSE to any edge
        const tooCloseToLeft = locationPixel.x < comfortableLeft;
        const tooCloseToRight = locationPixel.x > comfortableRight;
        const tooCloseToTop = locationPixel.y < comfortableTop;
        const tooCloseToBottom = locationPixel.y > comfortableBottom;
        
        const needsPanning = tooCloseToTop || tooCloseToBottom || tooCloseToLeft || tooCloseToRight;
        console.log('Needs panning:', needsPanning, {
          tooCloseToTop,
          tooCloseToBottom,
          tooCloseToLeft,
          tooCloseToRight
        });        if (needsPanning) {
          // Calculate pixel adjustments needed
          const currentCenter = map.getCenter();
          let adjustX = 0;
          let adjustY = 0;

          if (tooCloseToLeft) {
            adjustX = comfortableLeft - locationPixel.x;
            console.log('Too close to left, adjusting by:', adjustX);
          } else if (tooCloseToRight) {
            adjustX = comfortableRight - locationPixel.x;
            console.log('Too close to right, adjusting by:', adjustX);
          }

          if (tooCloseToTop) {
            adjustY = comfortableTop - locationPixel.y;
            console.log('Too close to top, adjusting by:', adjustY);
          } else if (tooCloseToBottom) {
            adjustY = comfortableBottom - locationPixel.y;
            console.log('Too close to bottom, adjusting by:', adjustY);
          }

          // Convert pixel adjustment to map coordinate adjustment
          const centerPixel = map.latLngToContainerPoint(currentCenter);
          const newCenterPixel = {
            x: centerPixel.x - adjustX,
            y: centerPixel.y - adjustY
          };
          const newCenter = map.containerPointToLatLng(newCenterPixel);

          console.log('Panning to new center:', newCenter);
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
