import React, { useEffect, useMemo } from 'react';
import Leaf from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { inLang, statusValue, getMatchTally, isLabelVisible } from './Utils.js';
import { collectionManager } from './CollectionManager';
import uiStr from './data/ui-strings.json';

// Component that handles map zoom and pan logic
function MapController({
  resetZoomFlag,
  setResetZoomFlag,
  selectedLabelIndex,
  transformedLabels,
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
  }, [resetZoomFlag, setResetZoomFlag, map, imageHeight, imageWidth]); // Effect for smart panning to selected label

  useEffect(() => {
    if (selectedLabelIndex === null || selectedLabelIndex === undefined || !map || !transformedLabels.length)
      return;

    const timeoutId = setTimeout(() => {
      try {
        // console.log('Looking for selectedLabelIndex:', selectedLabelIndex);
        // console.log('Available transformedLabels length:', transformedLabels.length);

        // selectedLabelIndex is an index into the transformedLabels array
        const selectedLbl = transformedLabels[selectedLabelIndex];
        if (!selectedLbl) {
          console.log('No label found at index:', selectedLabelIndex);
          return;
        }

        const labelPoint = [selectedLbl.yLeaflet, selectedLbl.x];
        // console.log('Selected label point:', labelPoint);

        // Get current map size and center
        const mapSize = map.getSize();
        // const currentCenter = map.getCenter();
        // console.log('Map size (pixels):', mapSize);
        // console.log('Current center:', currentCenter);

        // Convert label to pixel coordinates
        const labelPixel = map.latLngToContainerPoint(labelPoint);
        // console.log('Label in pixels:', labelPixel);

        // Calculate 6% buffer zone in pixels
        const bufferX = mapSize.x * 0.06;
        const bufferY = mapSize.y * 0.06;
        // console.log('Buffer zone (pixels):', { bufferX, bufferY });

        // Define comfortable viewing area in pixel coordinates
        const comfortableLeft = bufferX;
        const comfortableRight = mapSize.x - bufferX;
        const comfortableTop = bufferY;
        const comfortableBottom = mapSize.y - bufferY;
        // console.log('Comfortable pixel area:', {
        //   comfortableLeft,
        //   comfortableRight,
        //   comfortableTop,
        //   comfortableBottom
        // });        // Calculate label endpoints based on alignment and rotation
        // Optimization: use simple point-based logic for centered, non-rotated labels
        const angle = selectedLbl.angle || 0;
        const align = selectedLbl.align || 'center';
        let startPoint, endPoint;

        // Calculate start and end points based on alignment and angle.
        const labelLengthPixels = mapSize.x * 0.2; // Approximate label length as 20% of horizontal viewable area
        startPoint = endPoint = labelPixel;
        if (!angle) {
          if (align === 'center') {
            startPoint.x -= labelLengthPixels / 2;
            endPoint.x += labelLengthPixels / 2;
          } else if (align === 'left') {
            endPoint.x += labelLengthPixels;
          } else if (align === 'right') {
            startPoint.x -= labelLengthPixels;
          }
          // console.log('Non-rotated label has endpoints:', { startPoint, endPoint } );
        } else {
          // Convert angle to radians (0° = horizontal right, negative or 270-360° = down-right)
          const angleRad = (angle * Math.PI) / 180;

          // Calculate label direction vector (unit vector)
          const labelDirX = Math.cos(angleRad);
          const labelDirY = Math.sin(angleRad);

          // console.log('Label calculation:', {
          //   angle,
          //   align,
          //   labelLengthPixels,
          //   labelDirX,
          //   labelDirY
          // });

          // Calculate start and end points based on alignment
          if (align === 'left') {
            // Label extends rightward from anchor
            startPoint = labelPixel;
            endPoint = {
              x: labelPixel.x + labelLengthPixels * labelDirX,
              y: labelPixel.y + labelLengthPixels * labelDirY,
            };
          } else if (align === 'right') {
            // Label extends leftward from anchor
            endPoint = labelPixel;
            startPoint = {
              x: labelPixel.x - labelLengthPixels * labelDirX,
              y: labelPixel.y - labelLengthPixels * labelDirY,
            };
          } else {
            // center
            // Label extends both ways from anchor
            const halfLength = labelLengthPixels / 2;
            startPoint = {
              x: labelPixel.x - halfLength * labelDirX,
              y: labelPixel.y - halfLength * labelDirY,
            };
            endPoint = {
              x: labelPixel.x + halfLength * labelDirX,
              y: labelPixel.y + halfLength * labelDirY,
            };
          }

          // console.log('Label endpoints:', { startPoint, endPoint });
        }

        // Check if either endpoint violates buffer zone
        const startViolations = {
          left: startPoint.x < comfortableLeft,
          right: startPoint.x > comfortableRight,
          top: startPoint.y < comfortableTop,
          bottom: startPoint.y > comfortableBottom,
        };

        const endViolations = {
          left: endPoint.x < comfortableLeft,
          right: endPoint.x > comfortableRight,
          top: endPoint.y < comfortableTop,
          bottom: endPoint.y > comfortableBottom,
        };

        const anyViolation =
          Object.values(startViolations).some(v => v) || Object.values(endViolations).some(v => v);

        // console.log('Buffer violations:', {
        //   startViolations,
        //   endViolations,
        //   anyViolation
        // });
        const needsPanning = anyViolation;
        // console.log('Needs panning:', needsPanning);
        if (needsPanning) {
          // Calculate minimum adjustments needed to bring label within buffer zone
          // Priority: keep anchor point visible
          const currentCenter = map.getCenter();
          let adjustmentX = 0;
          let adjustmentY = 0;

          // Handle horizontal violations
          if (startViolations.left || endViolations.left) {
            const minX = Math.min(startPoint.x, endPoint.x);
            const neededAdjustment = comfortableLeft - minX;
            adjustmentX = Math.max(adjustmentX, neededAdjustment);
            // console.log('Left violation, adjusting by:', neededAdjustment);
          }
          if (startViolations.right || endViolations.right) {
            const maxX = Math.max(startPoint.x, endPoint.x);
            const neededAdjustment = comfortableRight - maxX;
            adjustmentX = Math.min(adjustmentX, neededAdjustment);
            // console.log('Right violation, adjusting by:', neededAdjustment);
          }

          // Handle vertical violations
          if (startViolations.top || endViolations.top) {
            const minY = Math.min(startPoint.y, endPoint.y);
            const neededAdjustment = comfortableTop - minY;
            adjustmentY = Math.max(adjustmentY, neededAdjustment);
            // console.log('Top violation, adjusting by:', neededAdjustment);
          }
          if (startViolations.bottom || endViolations.bottom) {
            const maxY = Math.max(startPoint.y, endPoint.y);
            const neededAdjustment = comfortableBottom - maxY;
            adjustmentY = Math.min(adjustmentY, neededAdjustment);
            // console.log('Bottom violation, adjusting by:', neededAdjustment);
          }

          // Convert pixel adjustment to map coordinate adjustment
          const centerPixel = map.latLngToContainerPoint(currentCenter);
          const newCenterPixel = {
            x: centerPixel.x - adjustmentX,
            y: centerPixel.y - adjustmentY,
          };
          const newCenter = map.containerPointToLatLng(newCenterPixel);

          // console.log('Panning to new center:', newCenter);
          map.panTo(newCenter, { animate: true, duration: 0.5 });
        }
      } catch (error) {
        // console.error('Error panning to selected label:', error);
      }
    }, 100); // Small delay to ensure selection state is stable

    return () => clearTimeout(timeoutId);
  }, [selectedLabelIndex, map, transformedLabels]);

  return null; // This component doesn't render anything
}

export default function MapPane({
  imageUrl,
  labels,
  onSelectLabel,
  selectedLabelIndex,
  labelScale,
  labelOpacity = 85,
  mapDef,
  termRenderings,
  lang,
  resetZoomFlag,
  setResetZoomFlag,
  extractedVerses,
  collectionId = 'SMR',
  showFrac,
  selectedVariant = 0,
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
  const transformedLabels = labels
    .filter(label => isLabelVisible(label, selectedVariant))
    .map(label => {
      const yLeaflet = imageHeight - label.y;
      return { ...label, yLeaflet };
    });
  
  // Debug: Log first 3 labels to see their status values
  if (transformedLabels.length > 0) {
    const labelInfo = transformedLabels.slice(0, 3).map(l => `${l.mergeKey}:${l.status}`).join(', ');
    console.log('[MapPane] Rendering with labels:', labelInfo);
  }
  
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
        selectedLabelIndex={selectedLabelIndex}
        transformedLabels={transformedLabels}
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
            ? inLang(uiStr.loadingMapImage, lang)
            : inLang(uiStr.imageLoadingFailed, lang)}
        </div>
      )}
      {transformedLabels.length > 0
        ? transformedLabels.map(label => (
            <Marker
              key={`${label.mergeKey}-${label.status}`}
              position={[label.yLeaflet, label.x]}
              icon={createLabel(
                label.vernLabel || `(${inLang(label.gloss, lang)})`,
                label.align,
                label.angle,
                label.size,
                label.status,
                selectedLabelIndex === label.idx,
                labelScale,
                labelOpacity,
                label.opCode,
                label.lines,
                showFrac && label.placeNameIds?.length > 0
                  ? (() => {
                      // Aggregate match tallies from all terms in all placeNames
                      let totalMatches = 0;
                      let totalRefs = 0;
                      let anyDenials = false;
                      
                      label.placeNameIds.forEach(placeNameId => {
                        const terms = collectionManager.getTermsForPlace(placeNameId, collectionId) || [];
                        terms.forEach(term => {
                          if (termRenderings[term.termId]) {
                            const [matches, refs, denials] = getMatchTally(
                              termRenderings[term.termId],
                              term.refs || [],
                              extractedVerses
                            );
                            totalMatches += matches;
                            totalRefs += refs;
                            anyDenials = anyDenials || denials;
                          }
                        });
                      });
                      
                      return frac([totalMatches, totalRefs, anyDenials], true);
                    })()
                  : ''
              )}
              eventHandlers={{ click: () => onSelectLabel(label) }}
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
  labelOpacity = 85,
  opCode = 'sync',
  lines = 1,
  extra
) {
  // Add visual indicator for override and omit opCodes
  const opCodeIndicator = opCode === 'override' ? '🔒' : opCode === 'omit' ? '🚫' : '';
  const isLeft = align === 'left';
  const isCenter = align === 'center';
  const backgroundColor = statusValue[status].bkColor;
  const textColor = statusValue[status].textColor;
  // Base font size in px (matches your app's base font size)
  const baseFontSize = 18 * labelScale;
  // Calculate scale factor for font size (matches previous logic)
  const fontSizePx = baseFontSize * (0.7 + 0.1 * (4 - size));
  // Use em units for all scalable properties
  const textOpacity = Math.min(Math.round(labelOpacity * 1.2), 100);
  
  // Use the lines property from the label definition (defaults to 1)
  const numLines = lines || 1;
  
  // Function to balance text across multiple lines by inserting line breaks
  const balanceTextLines = (text, targetLines) => {
    if (targetLines === 1) return text;
    
    // Split into words
    const words = text.split(/\s+/);
    if (words.length < targetLines) return text; // Not enough words to split
    
    // Calculate target characters per line (with some tolerance)
    const totalChars = text.length;
    const targetCharsPerLine = totalChars / targetLines;
    
    // Build lines by trying to balance actual character counts
    const lines = [];
    let currentLine = '';
    let currentLength = 0;
    
    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      const wordLength = word.length + (currentLine ? 1 : 0); // +1 for space
      const nextWord = i < words.length - 1 ? words[i + 1] : null;
      
      // Add word to current line
      if (currentLine) {
        currentLine += ' ' + word;
        currentLength += wordLength;
      } else {
        currentLine = word;
        currentLength = word.length;
      }
      
      // Decide if we should break here
      if (lines.length < targetLines - 1) {
        // Calculate how far we are from the target
        const distanceFromTarget = Math.abs(currentLength - targetCharsPerLine);
        
        // Calculate what the distance would be if we add the next word
        const nextWordLength = nextWord ? nextWord.length + 1 : 0;
        const distanceWithNext = Math.abs(currentLength + nextWordLength - targetCharsPerLine);
        
        // Don't break if current line starts with opening punctuation and is very short
        const startsWithOpening = /^[(\[{《]/.test(currentLine);
        const tooShortToBreak = currentLength < targetCharsPerLine * 0.3;
        
        // Break if we're at or past target, and adding next word would be worse
        // But avoid breaking too early after opening punctuation
        if (nextWord && 
            currentLength >= targetCharsPerLine * 0.5 && // At least 50% of target
            !(startsWithOpening && tooShortToBreak) &&
            distanceWithNext > distanceFromTarget) {
          // Start new line
          lines.push(currentLine);
          currentLine = '';
          currentLength = 0;
        }
      }
    }
    
    // Add final line
    if (currentLine) lines.push(currentLine);
    
    return lines.join('<br>');
  };
  
  // Apply line balancing to label text
  const fullText = labelText + opCodeIndicator + (extra || '');
  const balancedLabel = balanceTextLines(fullText, numLines);
  const lineHeightEm = 1.2;
  
  const baseStyle = [
    `color: color-mix(in srgb, ${textColor} ${textOpacity}%, transparent);`,
    `font-size: ${fontSizePx}px;`,
    'font-weight: bold;',
    numLines > 1 ? 'white-space: pre;' : 'white-space: nowrap;', // pre = only break on explicit line breaks
    `background: ${
      backgroundColor
        ? `color-mix(in srgb, ${backgroundColor} ${labelOpacity}%, transparent)`
        : 'rgba(0,0,0,0.75)'
    };`,
    'padding: 0 0.5em;', // 0px top/bottom, 0.5em left/right
    'border-radius: 0.83em;', // 10px if font-size is 12px
    `line-height: ${lineHeightEm}em;`, // scale height of label
    'position: absolute;',
  ];
  
  // Add multi-line specific styles when needed
  if (numLines > 1) {
    baseStyle.push(
      'display: inline-block;',
      'text-align: center;' // Center text within the label
    );
  }
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
      }" style="${spanStyle}">${balancedLabel}</span>
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
