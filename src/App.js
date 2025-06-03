import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import Leaf from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { FaPencilAlt } from 'react-icons/fa';
import './App.css';
import uiStr from './data/ui-strings.json';
import supportedLanguages from './data/ui-languages.json';
import { CheckmarkIcon, DeniedCheckmarkIcon, CrossIcon, WarningIcon } from './TermIcons';
import { MATCH_PRE_B, MATCH_POST_B, MATCH_W, DEMO_PROJECT_FOLDER, INITIAL_USFM } from './demo.js';
import { MAP_VIEW, TABLE_VIEW, USFM_VIEW, STATUS_NO_RENDERINGS, STATUS_GUESSED } from './constants.js';
// Status values not yet used: STATUS_BLANK, STATUS_MULTIPLE,  STATUS_UNMATCHED, STATUS_MATCHED, STATUS_RENDERING_SHORT, STATUS_BAD_EXPLICIT_FORM 
import TermRenderings from './TermRenderings';
import MapBibTerms from './MapBibTerms';
import { getMapData } from './MapData';

const statusValue = [
  { bkColor: "dimgray", textColor: "white", sort: 1  },  // 0  - blank
  { bkColor: "cyan",    textColor: "black", sort: 5  },  // 1 - multiple
  { bkColor: "blue",    textColor: "white", sort: 3  },  // 2 - no renderings
  { bkColor: "yellow",  textColor: "black", sort: 4  },  // 3 - unmatched
  { bkColor: "white",   textColor: "black", sort: 0  },  // 4 - matched  
  { bkColor: "#FF8000", textColor: "black", sort: 2  },  // 5 - guessed : #FF8000 : #e56300
  { bkColor: "crimson", textColor: "white", sort: 6  },  // 6 - Rendering shorter than label
  { bkColor: "#80FF00", textColor: "black", sort: 7  },  // 7 - Bad explicit form : #80FF00
];
const bookNames = 'GEN,EXO,LEV,NUM,DEU,JOS,JDG,RUT,1SA,2SA,1KI,2KI,1CH,2CH,EZR,NEH,EST,JOB,PSA,PRO,ECC,SNG,ISA,JER,LAM,EZK,DAN,HOS,JOL,AMO,OBA,JON,MIC,NAM,HAB,ZEP,HAG,ZEC,MAL,MAT,MRK,LUK,JHN,ACT,ROM,1CO,2CO,GAL,EPH,PHP,COL,1TH,2TH,1TI,2TI,TIT,PHM,HEB,JAS,1PE,2PE,1JN,2JN,3JN,JUD,REV,TOB,JDT,ESG,WIS,SIR,BAR,LJE,S3Y,SUS,BEL,1MA,2MA,3MA,4MA,1ES,2ES,MAN,PS2,ODA,PSS';

const electronAPI = window.electronAPI;
const mapBibTerms = new MapBibTerms();

var usfm = INITIAL_USFM;
var map = mapFromUsfm(usfm);
console.log('Map:', map);

// Fix Leaflet default marker icons (optional, not needed with custom SVG icons)
delete Leaf.Icon.Default.prototype._getIconUrl;
Leaf.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});


function prettyRef(ref) {
  // ref is a 9 digit string. First 3 digits are the book code, next 3 are chapter, last 3 are verse.
  const bookCode = parseInt(ref.slice(0, 3), 10) - 1;
  const chapter = parseInt(ref.slice(3,  6), 10);    
  const verse = parseInt(ref.slice(6, 9), 10);
  const bookName = bookNames.slice(bookCode*4, bookCode*4+3); // Use the top-level bookNames constant, 4 chars per code.
  return `${bookName} ${chapter}:${verse}`;
}

function getMatchTally(entry, refs, extractedVerses) {
  let anyDenials = false;
  try {
    let renderingList = [];
    if (!entry) {
      return [0, 0, false]; // No entry found, return zero tally
    }
    if (entry.renderings) {
      renderingList = entry.renderings
        .replace(/\|\|/g, '\n').split(/(\r?\n)/)
        .map(r => r.replace(/\(.*/g, '').replace(/.*\)/g, '')) // Remove content in parentheses (comments), even if only partially enclosed. (The user may be typing a comment.)
        .map(r => r.trim())
        .filter(r => r.length > 0)
        .map(r => {
          let pattern = r;
          // Insert word boundary at start if not starting with *
          if (!pattern.startsWith('*')) pattern = MATCH_PRE_B + pattern;
          // Insert word boundary at end if not ending with *
          if (!pattern.endsWith('*')) pattern = pattern + MATCH_POST_B;
          // Replace * [with [\w-]* (word chars + dash)
          pattern = pattern.replace(/\*/g, MATCH_W + '*');
          // console.log(`Creating regex for rendering "${r}" with pattern "${pattern}"`);
          try {
            return new RegExp(pattern, 'iu');
          } catch (e) {
            // Invalid regex, skip it
            return null;
          }
        })
        .filter(Boolean); // Remove nulls (invalid regexes)
    }
    // console.log(`getMatchTally("${termId}")`, entry.renderings);
    // console.log(`num refs: ${refs.length}`, renderingList);
    // Compute match tally
    let matchCount = 0;
    let deniedRefs = entry?.denials || [];

    refs.map(refId => {
      const verse = extractedVerses[refId] || '';
      const hasMatch = renderingList.some(r => r.test(verse));
      if (hasMatch) {
        matchCount++;
      } else {
        if (deniedRefs.includes(refId)) {
          anyDenials = true;
          matchCount++;
        }
      }
      return hasMatch;
    });
    return [matchCount, refs.length, anyDenials];
  } catch (error) {
    console.error(`Error in getMatchTally":`, error);
    return [0,0, false];
  }
}

function getRefList(labels, mapBibTerms) {
  const rl = Array.from(
    new Set(
      labels
        .map(label => mapBibTerms.getRefs(label.termId)) 
        .flat()
    )
  ).sort();
  console.log('getRefList:', rl.length, 'refs for', labels.length, 'labels from mapBibTerms:', mapBibTerms);
  return rl;
}

function encodeUTF16LE(str, bom = false) {
  if (bom) {  
    str = '\uFEFF' + str; // Add BOM if requested
  }
  const buf = new Uint8Array(str.length * 2);
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    buf[i * 2] = code & 0xFF;
    buf[i * 2 + 1] = code >> 8;
  }
  return buf;
}

function decodeFileAsString(arrayBuffer) {
  const uint8 = new Uint8Array(arrayBuffer);
  // UTF-8 BOM: EF BB BF
  if (uint8[0] === 0xEF && uint8[1] === 0xBB && uint8[2] === 0xBF) {
    // console.log('Detected UTF-8 BOM');
    return new TextDecoder('utf-8').decode(uint8.subarray(3));
  }
  // UTF-16LE BOM: FF FE
  if (uint8[0] === 0xFF && uint8[1] === 0xFE) {
    // console.log('Detected UTF-16LE BOM');
    return new TextDecoder('utf-16le').decode(uint8.subarray(2));
  }
  // UTF-16BE BOM: FE FF
  if (uint8[0] === 0xFE && uint8[1] === 0xFF) {
    // console.log('Detected UTF-16BE BOM');
    return new TextDecoder('utf-16be').decode(uint8.subarray(2));
  }
  // Default: utf-8
  // console.log('Assuming UTF-8 encoding');
  return new TextDecoder('utf-8').decode(uint8);
}

function mapFromUsfm(usfm) {
  // Extract template and \fig field
  const figMatch = usfm.match(/\\fig[\s\S]*?\\fig\*/);
  const templateMatch = usfm.match(/\\zdiagram-s\s+\|template="([^"]*)"/);
  
  let mapDefData;
  try {
    mapDefData = getMapData(templateMatch[1], mapBibTerms);
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
        gloss: { en: gloss },
        vernLabel: vernLabel || '',
        idx: maxIdx++ // Assign an index for ordering
      };
      mapDefData.labels.push(label);
    }
  }

  console.log('Parsed map definition:', mapDefData);
  return mapDefData;
}

function frac([num, denom, anyDenials], show=true) {
  // console.log('Creating fraction:', num, denom, show);
  return (!denom || num===denom || !show) ? '' : ` <sup>${num}</sup>&frasl;<sub>${denom}</sub>`;
}

function Frac({ value }) {
  if (!value || !Array.isArray(value)) return (<><td></td><td></td></>);
  const [num, denom, anyDenials] = value;
  if (!denom) return (<><td></td><td></td></>);
  let icon;
  if (num === denom) {
    icon = anyDenials ? <DeniedCheckmarkIcon /> : <CheckmarkIcon />;
  } else {
    icon = <WarningIcon />;
  }
  return (
    <>
      <td style={{ textAlign: 'center' }}>{num}/{denom}</td>
      <td style={{ textAlign: 'left' }}>{icon}</td>
    </>
  );
}


function inLang(prop, lang = 'en') {
  if (!prop) return '';
  if (typeof prop === 'string') return prop;
  return prop[lang] || prop['en'] || Object.values(prop)[0] || '';
}

// Function to create a map label
const createLabel = (labelText, align = 'right', angle = 0, size = 3, status, isSelected = false, labelScale = 1, extra) => {
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
  // TODO: Insert fraction like frac(num, denom) if needed
  return Leaf.divIcon({
    html,
    className: '',
  });
  // return Leaf.divIcon({
  //   html,
  //   className: '',
  //   iconSize: [10 * (fontSizePx / baseFontSize), 2 * fontSizePx],
  //   iconAnchor: [1 * (fontSizePx / baseFontSize), 1 * fontSizePx],
  //   popupAnchor: [isLeft ? 5 * (fontSizePx / baseFontSize) : -2 * (fontSizePx / baseFontSize), -1 * fontSizePx],
  // });
};

// Bottom Pane component to display a scrollable list of verses referencing the termId
function BottomPane({ termId, renderings, onAddRendering, onReplaceRendering, renderingsTextareaRef, lang, termRenderings, setRenderings, onDenialsChanged, extractedVerses }) {
  const paneRef = React.useRef();
  const [selectedText, setSelectedText] = React.useState('');
  // Add a local state to force re-render on denial toggle
  const [denialToggle, setDenialToggle] = React.useState(false);

  React.useEffect(() => {
    function handleSelectionChange() {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed) {
        setSelectedText('');
        return;
      }
      if (paneRef.current && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        if (paneRef.current.contains(range.commonAncestorContainer)) {
          setSelectedText(selection.toString());
        } else {
          setSelectedText('');
        }
      } else {
        setSelectedText('');
      }
    }
    document.addEventListener('mouseup', handleSelectionChange);
    document.addEventListener('keyup', handleSelectionChange);
    return () => {
      document.removeEventListener('mouseup', handleSelectionChange);
      document.removeEventListener('keyup', handleSelectionChange);
    };
  }, []);

  if (!termId) return <div className="bottom-pane" ref={paneRef} />;
  const refs = mapBibTerms.getRefs(termId);

  // Prepare renderings: remove comments, split, trim, and convert to regex patterns
  let renderingList = [];
  if (renderings) {
    renderingList = renderings
      .replace(/\|\|/g, '\n').split(/(\r?\n)/)
      .map(r => r.replace(/\(.*/g, '').replace(/.*\)/g, '')) // Remove content in parentheses (comments), even if only partially enclosed. (The user may be typing a comment.)
      .map(r => r.trim())
      .filter(r => r.length > 0)
      .map(r => {
        let pattern = r;
        // Insert word boundary at start if not starting with *
        if (!pattern.startsWith('*')) pattern = MATCH_PRE_B + pattern;
        // Insert word boundary at end if not ending with *
        if (!pattern.endsWith('*')) pattern = pattern + MATCH_POST_B;
        // Replace * [with [\w-]* (word chars + dash)
        pattern = pattern.replace(/\*/g, MATCH_W + '*');
        console.log(`Creating regex for rendering "${r}" with pattern "${pattern}"`);
        try {
          return new RegExp(pattern, 'iu');
        } catch (e) {
          // Invalid regex, skip it
          return null;
        }
      })
      .filter(Boolean); // Remove nulls (invalid regexes)
  }

  // Helper to highlight match in verse text
  function highlightMatch(text, patterns) {
    for (const regex of patterns) {
      let match;
      try {
        match = text.match(regex);
      } catch (e) {
        // Invalid regex, skip this pattern
        continue;
      }
      if (match) {
        const start = match.index;
        const end = start + match[0].length;
        return (
          <>
            {text.slice(0, start)}
            <span style={{ background: '#c8f7c5', fontWeight: 'bold' }}>{text.slice(start, end)}</span>
            {text.slice(end)}
          </>
        );
      }
    }
    return text;
  }

  // Compute match tally
  let deniedRefs = termRenderings.data[termId]?.denials || [];
  // if (deniedRefs.length !== 0) {
  //   console.log(`Term "${termId}" has denied references:`, deniedRefs);
  // } else {
  //   console.log(`compute match tally for ${termId}`, termRenderings);
  // }
  let matchCount = 0;
  const matchResults = refs.map(refId => {
    const verse = extractedVerses[refId] || '';
    const hasMatch = renderingList.some(r => r.test(verse));
    if (hasMatch || deniedRefs.includes(refId)) matchCount++;
    return hasMatch;
  });

  return (
    <div className="bottom-pane" ref={paneRef} style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%', // Fill parent (resizes with pane)
      minHeight: 0,   // Allow flex children to shrink
      padding: 4
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center', // <-- FIXED: added value for alignItems
        fontSize: 13,
        color: '#333',
        marginBottom: 0,
        padding: '0 2px',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        position: 'sticky',
        top: 0,
        background: '#fff',
        zIndex: 1,
        borderBottom: '1px solid #eee',
        minHeight: 28
      }}>
        <span>{inLang(uiStr.found, lang)}: {matchCount}/{refs.length}</span>
        {selectedText && (
          <>
            <button
              style={{ marginLeft: 8, fontSize: 13, padding: '1px 6px', borderRadius: 4, background: '#e0ffe0', border: '1px solid #b2dfdb', cursor: 'pointer', height: 22 }}
              onClick={() => onAddRendering(selectedText)}
            >
              {inLang(uiStr.addRendering, lang)}
            </button>
            <button
              style={{ marginLeft: 6, fontSize: 13, padding: '1px 6px', borderRadius: 4, background: '#ffe0e0', border: '1px solid #dfb2b2', cursor: 'pointer', height: 22 }}
              onClick={() => onReplaceRendering(selectedText)}
            >
              {inLang(uiStr.replaceRenderings, lang)}
            </button>
          </>
        )}
      </div>
      <div style={{
        overflowY: 'auto',
        flex: 1,
        minHeight: 0
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'auto' }}>
          <tbody>
            {refs.length === 0 ? (
              <tr><td colSpan={2} style={{ color: '#888', textAlign: 'center', padding: 4 }}>{inLang(uiStr.noReferences, lang)}</td></tr>
            ) : (
              refs.map((refId, i) => {
                // Reference denialToggle to force re-render
                void denialToggle;
                const verse = extractedVerses[refId] || '';
                const hasMatch = matchResults[i];
                const isDenied = deniedRefs.includes(refId);
                // Handler must be in this scope
                const handleToggleDenied = () => {
                  const data = termRenderings.data;
                  let denials = Array.isArray(data[termId]?.denials) ? [...data[termId].denials] : [];
                  if (isDenied) {
                    denials = denials.filter(r => r !== refId);
                  } else {
                    if (!denials.includes(refId)) denials.push(refId);
                  }
                  if (!data[termId]) data[termId] = {};
                  data[termId].denials = denials;
                  termRenderings.data = { ...data };
                  if (typeof setRenderings === 'function') setRenderings(r => r + '');
                  setDenialToggle(t => !t);
                  if (typeof onDenialsChanged === 'function') onDenialsChanged(); // <-- update locations in App
                };
                return (
                  <tr key={refId} style={{ borderBottom: '1px solid #eee', verticalAlign: 'top' }}>
                    <td style={{ width: 38, textAlign: 'center', padding: '2px 0', verticalAlign: 'top', whiteSpace: 'nowrap' }}>
                      {hasMatch ? (
                        <CheckmarkIcon title="Match found" />
                      ) : (
                        <span style={{ cursor: 'pointer', display: 'inline-block' }} onClick={handleToggleDenied} title={isDenied ? 'Remove denial' : 'Mark as denied'}>
                          {isDenied ? <DeniedCheckmarkIcon /> : <CrossIcon title="No match (Click to deny)" />}
                        </span>
                      )}
                      <button
                        style={{
                          background: 'none',
                          border: 'none',
                          padding: 0,
                          marginLeft: 4,
                          cursor: 'pointer',
                          color: '#888',
                          fontSize: 14,
                          display: 'inline-flex',
                          alignItems: 'center',
                          verticalAlign: 'top',
                        }}
                        title="Edit"
                        aria-label="Edit"
                        onClick={() => alert(`Editing is not yet implemented for verse: ${prettyRef(refId)}`)}
                      >
                        <FaPencilAlt />
                      </button>
                    </td>
                    <td style={{ padding: '2px 0 2px 8px', verticalAlign: 'top', wordBreak: 'break-word', whiteSpace: 'normal' }}>
                      <span style={{ fontWeight: 'bold', marginRight: 4 }}>{prettyRef(refId)} </span>
                      {hasMatch ? highlightMatch(verse, renderingList) : verse || <span style={{ color: '#888' }}>[Verse not found]</span>}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function usfmFromMap(map, lang) {
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
    usfm += `\\zlabel |key="${label.mergeKey}" termid="${label.termId}" gloss="${inLang(label.gloss, lang)}" label="${label.vernLabel || ''}"\\*\n`;
  });
  usfm += '\\zdiagram-e \\*';
  // Remove unnecessary escaping for output
  return usfm.replace(/\\/g, '\\');
}

function App() {
  // Project folder state
  const [projectFolder, setProjectFolder] = useState(DEMO_PROJECT_FOLDER);
  const [lang, setLang] = useState('en');
  const [mapDef, setMapDef] = useState(map);
  const [locations, setLocations] = useState([]);
  const [selLocation, setSelLocation] = useState(0);
  const [mapWidth, setMapWidth] = useState(70);
  const [topHeight, setTopHeight] = useState(80);
  const [renderings, setRenderings] = useState('');
  const [isApproved, setIsApproved] = useState(false);
  const [mapPaneView, setMapPaneView] = useState(map.mapView ? MAP_VIEW : TABLE_VIEW); // 0: Map, 1: Table, 2: USFM
  const [labelScale, setLabelScale] = useState(() => {
    // Persist labelScale in localStorage
    const saved = localStorage.getItem('labelScale');
    return saved ? parseFloat(saved) : 1;
  });
  const [showSettings, setShowSettings] = useState(false);
  // --- Add resetZoomFlag for controlling Leaflet map ---
  const [resetZoomFlag, setResetZoomFlag] = useState(false);
  const isDraggingVertical = useRef(false);
  const isDraggingHorizontal = useRef(false);
  // Initialize TermRenderings without a file path
  const termRenderings = useMemo(() => new TermRenderings(), []);

  // Add ref for vernacular input
  const vernacularInputRef = useRef(null);
  const renderingsTextareaRef = useRef();
  const [extractedVerses, setExtractedVerses] = useState({});
  // Load term-renderings.json from selected project folder
  const loadTermRenderingsFromFolder = useCallback(async (folderPath) => {
    if (!electronAPI || !folderPath) return;
    try {
      const data = await electronAPI.loadTermRenderings(folderPath);
      console.log('[IPC] Loaded term renderings:', data, 'from folder:', folderPath);
      if (data && !data.error) {
        termRenderings.setData(data);
        setProjectFolder(folderPath);
        // Re-init locations from map and new termRenderings
        const initialLocations = map.labels.map(loc => {
          if (!loc.vernLabel) {
            loc.vernLabel = termRenderings.getMapForm(loc.termId);
          }
          const status = termRenderings.getStatus(loc.termId, loc.vernLabel);
          return { ...loc, status };
        });
        setLocations(initialLocations);
        if (initialLocations.length > 0) {
          setSelLocation(0); // Select first location directly
        }
      } else {
        alert('Failed to load term-renderings.json: ' + (data && data.error));
      }
    } catch (e) {
      console.log(`Failed to load term-renderings.json from project folder <${folderPath}>.`, e);
    }
  }, [termRenderings, setLocations, setSelLocation]);

  useEffect(() => {
    if (!projectFolder || !mapDef.labels?.length) return;
    const refs = getRefList(mapDef.labels, mapBibTerms);
    if (!refs.length) {
      setExtractedVerses({});
      return;
    }
    electronAPI.getFilteredVerses(projectFolder, refs).then(verses => {
      console.log('[IPC] getFilteredVerses:', projectFolder, 'for refs:', refs.length);
      if (verses && !verses.error) {
        setExtractedVerses(verses);
        // console.log('[IPC] getFilteredVerses:', Object.keys(verses).length, 'for refs:', refs.length);
      } else {
        setExtractedVerses({});
        alert('Failed to requested filtered verses ' + (verses && verses.error));
      }
    });
  }, [projectFolder, mapDef.labels]);

  // UI handler to select project folder
  const handleSelectProjectFolder = useCallback(async () => {
    if (!electronAPI) return;
    try {
      const folderPath = await electronAPI.selectProjectFolder();
      if (folderPath) {
        await loadTermRenderingsFromFolder(folderPath);
        console.log('[IPC] loaded term renderings');
      }
    } catch (e) {
      alert('Failed to select project folder.');
    }
  }, [loadTermRenderingsFromFolder]);

  // On first load, prompt for project folder if not set
  useEffect(() => {
    if (!projectFolder && electronAPI) {
      handleSelectProjectFolder();
    }
    // eslint-disable-next-line
  }, [projectFolder]);

  // ...existing code...

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

  const handleNextLocation = useCallback((fwd) => {
    const currentIndex = selLocation;
    let nextIndex;
    if (fwd) {
      nextIndex = (currentIndex + 1) % locations.length;
    } else {
      nextIndex = (currentIndex - 1 + locations.length) % locations.length;
    }
    const nextLocation = locations[nextIndex];
    handleSelectLocation(nextLocation);
  }, [locations, selLocation, handleSelectLocation]);

  // --- Pan map after selection changes, if needed ---
  // (Removed old useEffect that referenced map.getBounds and map.panTo)

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

  // Handler for map image browse
  const handleBrowseMapTemplate = async () => {
    try {
      const [fileHandle] = await window.showOpenFilePicker({
        types: [
          {
            description: 'Sample Map Images',
            accept: { 'image/jpeg': ['.jpg'] },
          },
          {
            description: 'Data Merge Files',
            accept: { 'text/plain': ['.txt'] },
          },
        ],
        multiple: false,
      });
      if (fileHandle) {
        let newTemplateBase = fileHandle.name.replace(/\..*$/, '').trim().replace(/^\w+_/, '').replace(/\s*[@(].*/, '');
        const labels = {};
        if (fileHandle.name.endsWith('.txt')) {
          // Handle data merge file
          const file = await fileHandle.getFile();
          console.log('Reading data merge file:', file.name);
          // const text = await file.text();
          // console.log('Data merge file content:', text);
          const fileText = decodeFileAsString(await file.arrayBuffer());
          console.log('Imported data merge file:', file.name, ">" + fileText + "<");
          // For now, assume it's an IDML data merge file
          const lines = fileText.split('\n');
          const mergeKeys = lines[0].split('\t');
          const verns = lines[1].split('\t');
          if (verns.length === mergeKeys.length) {
            // Create labels from merge keys and vernaculars
            for (let i = 0; i < mergeKeys.length; i++) {
              labels[mergeKeys[i]] = verns[i];
            }
            console.log('Labels from data merge:', labels);
          } else {
            alert(inLang(uiStr.invalidDataMerge, lang));
            return;
          }
        } else if (fileHandle.name.endsWith('.jpg') || fileHandle.name.endsWith('.jpeg')) {
          // Handle map image file
        } else {
          return;
        }
        const foundTemplate = getMapData('SMR1_' + newTemplateBase, mapBibTerms);
        if (!foundTemplate) {
          alert(inLang(uiStr.noTemplate, lang) + ": " + newTemplateBase);
          return;
        }
        // Set mapDef and locations 
        setMapDef({
          template: 'SMR1_' + newTemplateBase,
          fig: foundTemplate.fig || '',
          mapView: true,
          imgFilename: foundTemplate.imgFilename,
          width: foundTemplate.width,
          height: foundTemplate.height,
          labels: foundTemplate.labels
        });
        const newLocations = foundTemplate.labels.map(loc => {
          const status = termRenderings.getStatus(loc.termId, loc.vernLabel || '');
          return { ...loc, vernLabel: loc.vernLabel || '', status };
        });

        const initialLocations = newLocations.map(loc => {
          if (labels[loc.mergeKey]) {
            loc.vernLabel = labels[loc.mergeKey]; // Use label from data merge if available
          } else if (!loc.vernLabel) {
            loc.vernLabel = termRenderings.getMapForm(loc.termId);
          }

          const status = termRenderings.getStatus(loc.termId, loc.vernLabel);
          return { ...loc, status };
        });
        console.log('Initial locations:', initialLocations);
        setLocations(initialLocations);
        if (initialLocations.length > 0) {
          handleSelectLocation(initialLocations[0]); // Auto-select first location
        }


        //setLocations(newLocations);
        setMapPaneView(MAP_VIEW); // Map View
      }
    } catch (e) {
      // User cancelled or not supported
      console.log('Map template browse cancelled or not supported:', e);
    }
  };

useEffect(() => {
  if (projectFolder) {
    loadTermRenderingsFromFolder(projectFolder);
  }
  // eslint-disable-next-line
}, [projectFolder]);

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
          console.log('Initial locations:', initialLocations);
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
    if (vernacularInputRef.current && mapPaneView === MAP_VIEW) {
      vernacularInputRef.current.focus();
    }
  }, [selLocation, mapPaneView]); 

  // Table View component
  function TableView({ locations, selLocation, onUpdateVernacular, onNextLocation, termRenderings, onSelectLocation, lang }) {
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
        <tr style={{ background: '#444', color: '#e0e0e0' }}>
          <th>{inLang(uiStr.gloss, lang)}</th>
          <th>{inLang(uiStr.label, lang)}</th>
          <th style={{textAlign: 'center'}}>{inLang(uiStr.tally, lang)}</th>
          <th style={{textAlign: 'left'}}>{inLang(uiStr.found, lang)}</th>
          <th>{inLang(uiStr.status, lang)}</th>
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
            fontWeight: isSelected ? 'bold' : 'normal',
            cursor: 'pointer',
            border: (isSelected ? '6px' : '1px') + ' solid ' + statusValue[status].bkColor,
            paddingTop: isSelected ? 12 : undefined,
            paddingBottom: isSelected ? 12 : undefined,
            }}
            onClick={() => onSelectLocation(loc)}
          >
            <td style={isSelected ? { paddingTop: 4, paddingBottom: 4 } : {}}>{inLang(loc.gloss, lang)}</td>
            <td style={isSelected ? { paddingTop: 4, paddingBottom: 4 } : {}}>
            <input
            ref={el => inputRefs.current[i] = el}
            type="text"
            value={loc.vernLabel || ''}
            onChange={e => onUpdateVernacular(loc.termId, e.target.value)}
            onFocus={() => onSelectLocation(loc)}
            onKeyDown={e => {
            if (e.key === 'ArrowDown') {
              onNextLocation(true);
              e.preventDefault();
              e.stopPropagation();
            } else if (e.key === 'ArrowUp') {
              onNextLocation(false);
              e.preventDefault();
              e.stopPropagation();
            }
            }}
            style={{}}
            spellCheck={false}
            />
            </td>
            <Frac value={getMatchTally(termRenderings.getEntry(loc.termId), mapBibTerms.getRefs(loc.termId), extractedVerses)} />
            <td>

            <span
            style={{
            border: '1px solid black',
            background: statusValue[status].bkColor,
            color: statusValue[status].textColor,
            borderRadius: '0.7em',
            padding: '0 10px',
            display: 'inline-block',
            fontWeight: 'bold',
            whiteSpace: 'nowrap'
            }}
            >
            {inLang(uiStr.statusValue[status].text, lang)}
            </span>
            </td>
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
        spellCheck={false}
      />
    );
  });

  // --- USFM state for editing ---
  const [usfmText, setUsfmText] = useState(() => usfmFromMap({ ...mapDef, labels: locations }, lang));

  // Only update USFM text when switching TO USFM view (not on every locations change)
  const prevMapPaneView = useRef();
  useEffect(() => {
    if (prevMapPaneView.current !== USFM_VIEW && mapPaneView === USFM_VIEW) {
      setUsfmText(usfmFromMap({ ...mapDef, labels: locations }, lang));
    }
    prevMapPaneView.current = mapPaneView;
  }, [mapPaneView, locations, mapDef, lang]);

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
      alert(inLang(uiStr.invalidUsfm, lang));
    }
  }, [termRenderings, setLocations, setSelLocation, lang]);

  // Intercept view switch to update map if leaving USFM view
  const handleSwitchViewWithUsfm = useCallback(() => {
    if (mapPaneView === USFM_VIEW) {
      updateMapFromUsfm();
    }
    setMapPaneView(prev => {
      if (!map.mapView) {
        // Only cycle between Table (1) and USFM (2)
        return prev === TABLE_VIEW ? USFM_VIEW : TABLE_VIEW;
      }
      // Cycle through Map (0), Table (1), USFM (2)
      return (prev + 1) % 3;  // Maybe this can be simplified now that Switch View is only from USFM
    });
  }, [mapPaneView, updateMapFromUsfm]);

  // Intercept OK button in DetailsPane
  const handleOkWithUsfm = useCallback(() => {
    if (mapPaneView === USFM_VIEW) {
      updateMapFromUsfm();
    }
    // Optionally: do other OK logic here
    alert("At this point, the USFM text would be saved to Paratext.");  // TODO: 
  }, [mapPaneView, updateMapFromUsfm]);

  // Add rendering from bottom pane selection
  const handleAddRendering = useCallback((text) => {
    if (!locations[selLocation]) return;
    const termId = locations[selLocation].termId;
    let currentRenderings = renderings || '';
    let newRenderings = currentRenderings.trim() ? `${currentRenderings.trim()}\n${text.trim()}` : text.trim();
    setRenderings(newRenderings);
    const updatedData = { ...termRenderings.data };
    updatedData[termId] = {
      ...updatedData[termId],
      renderings: newRenderings,
      isGuessed: false
    };
    termRenderings.data = updatedData;
    setIsApproved(true);
    setLocations(prevLocations => prevLocations.map(loc => {
      if (loc.termId === termId) {
        const status = termRenderings.getStatus(loc.termId, loc.vernLabel);
        return { ...loc, status };
      }
      return loc;
    }));
    setTimeout(() => {
      if (renderingsTextareaRef.current) renderingsTextareaRef.current.focus();
    }, 0);
  }, [renderings, selLocation, locations, termRenderings]);

  // Replace all renderings with selected text
  const handleReplaceRendering = useCallback((text) => {
    if (!locations[selLocation]) return;
    const termId = locations[selLocation].termId;
    const newRenderings = text.trim();
    setRenderings(newRenderings);
    const updatedData = { ...termRenderings.data };
    updatedData[termId] = {
      ...updatedData[termId],
      renderings: newRenderings,
      isGuessed: false
    };
    termRenderings.data = updatedData;
    setIsApproved(true);
    // Also set vernacular label to the new rendering
    
    

    setLocations(prevLocations => prevLocations.map(loc => {
      if (loc.termId === termId) {
        const vernLabel = newRenderings;
        const status = termRenderings.getStatus(loc.termId, vernLabel);
        return { ...loc, status, vernLabel };
      }
      return loc;
    }));
    setTimeout(() => {
      if (renderingsTextareaRef.current) renderingsTextareaRef.current.focus();
    }, 0);
  }, [selLocation, locations, termRenderings]);

  // Add global PageUp/PageDown navigation for Map and Table views
useEffect(() => {
  function handleGlobalKeyDown(e) {
    if (mapPaneView === USFM_VIEW) return; // Do not trigger in USFM view
    // Ctrl+9 triggers zoom reset
    if (e.ctrlKey && (e.key === '9' || e.code === 'Digit9')) {
      console.log('Resetting zoom');
      setResetZoomFlag(true);
      e.preventDefault();
      return;
    }
    if (e.key === 'PageDown') {
      handleNextLocation(true);
      e.preventDefault();
    } else if (e.key === 'PageUp') {
      handleNextLocation(false);
      e.preventDefault();
    }
  }
  window.addEventListener('keydown', handleGlobalKeyDown);
  return () => window.removeEventListener('keydown', handleGlobalKeyDown);
}, [mapPaneView, handleNextLocation]); // Remove mapDef, mapRef from deps

  // console.log("map: ", map);
  // Memoize locations and mapDef to prevent MapPane remounts
  const memoizedLocations = useMemo(() => locations, [locations]);
  const memoizedMapDef = useMemo(() => mapDef, [mapDef]);
  const memoizedHandleSelectLocation = useCallback(handleSelectLocation, [handleSelectLocation]);

  // Add this function to update locations when denials change
  const handleDenialsChanged = useCallback(() => {
    setLocations(prevLocations => prevLocations.map(loc => {
      const status = termRenderings.getStatus(loc.termId, loc.vernLabel || '');
      return { ...loc, status };
    }));
  }, [termRenderings]);

  // Debounced save of termRenderings.data to disk via IPC
useEffect(() => {
  if (!projectFolder || !electronAPI) return;
  if (!termRenderings.data || Object.keys(termRenderings.data).length === 0) return;

  const handler = setTimeout(() => {
    electronAPI.saveTermRenderings(projectFolder, termRenderings.data);
    console.log('[IPC] Auto-saved termRenderings to disk:', projectFolder);
    // Optionally: show a "saved" indicator here
    // console.log('Auto-saved termRenderings to disk');
  }, 2000); // 2 seconds after last change

  return () => clearTimeout(handler);
}, [termRenderings.data, projectFolder]);

  return (
    <div className="app-container">
      <div className="top-section" style={{ flex: `0 0 ${topHeight}%` }}>
        <div className="map-pane" style={{ flex: `0 0 ${mapWidth}%` }}>
          {mapPaneView === MAP_VIEW && map.mapView && (
            <MapPane
              imageUrl={memoizedMapDef.imgFilename ? `/assets/maps/${memoizedMapDef.imgFilename}` : ''}
              locations={memoizedLocations}
              onSelectLocation={memoizedHandleSelectLocation}
              selLocation={selLocation}
              labelScale={labelScale}
              mapDef={memoizedMapDef}
              termRenderings={termRenderings}
              lang={lang}
              resetZoomFlag={resetZoomFlag} // Pass to MapPane
              setResetZoomFlag={setResetZoomFlag} // Pass setter to MapPane
              extractedVerses={extractedVerses} // Pass extracted verses
            />
          )}
          {mapPaneView === TABLE_VIEW && (
            <TableView
              locations={locations}
              selLocation={selLocation}
              onSelectLocation={handleSelectLocation}
              onUpdateVernacular={handleUpdateVernacular}
              termRenderings={termRenderings}
              onNextLocation={handleNextLocation}
              lang={lang} // <-- pass lang
            />
          )}
          {mapPaneView === USFM_VIEW && (
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
            termRenderings={termRenderings}
            locations={locations}
            onSwitchView={handleSwitchViewWithUsfm}
            onOk={handleOkWithUsfm}
            mapPaneView={mapPaneView}
            onSetView={viewIdx => {
              if (viewIdx === 0 && !map.mapView) return;
              if (mapPaneView === USFM_VIEW) updateMapFromUsfm();
              setMapPaneView(viewIdx);
            }}
            onShowSettings={() => setShowSettings(true)} // <-- add onShowSettings
            mapDef={mapDef} // <-- pass map definition
            onBrowseMapTemplate={handleBrowseMapTemplate}
            vernacularInputRef={vernacularInputRef} // <-- pass ref
            renderingsTextareaRef={renderingsTextareaRef}
            lang={lang} // <-- pass lang
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
        <BottomPane
          termId={locations[selLocation]?.termId}
          renderings={renderings}
          onAddRendering={handleAddRendering}
          onReplaceRendering={handleReplaceRendering}
          renderingsTextareaRef={renderingsTextareaRef}
          lang={lang}
          termRenderings={termRenderings}
          setRenderings={setRenderings}
          onDenialsChanged={handleDenialsChanged}
          extractedVerses={extractedVerses}
        />
      </div>
      <SettingsModal 
        open={showSettings} 
        onClose={() => setShowSettings(false)} 
        labelScale={labelScale} 
        setLabelScale={setLabelScale}
        lang={lang}
        setLang={setLang}
        projectFolder={projectFolder}
        handleSelectProjectFolder={handleSelectProjectFolder}
      />
    </div>
  );
}

function MapPane({ imageUrl, locations, onSelectLocation, selLocation, labelScale, mapDef, termRenderings, lang, resetZoomFlag, setResetZoomFlag, extractedVerses }) {
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
              frac(getMatchTally(termRenderings.getEntry(loc.termId), mapBibTerms.getRefs(loc.termId), extractedVerses), true)
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

function DetailsPane({ selLocation, onUpdateVernacular, onNextLocation, renderings, isApproved, onRenderingsChange, onApprovedChange, termRenderings, locations, onSwitchView, mapPaneView, onSetView, onShowSettings, mapDef, onBrowseMapTemplate, vernacularInputRef, renderingsTextareaRef, lang }) {
  const [vernacular, setVernacular] = useState(locations[selLocation]?.vernLabel || '');
  const [localIsApproved, setLocalIsApproved] = useState(isApproved);
  const [localRenderings, setLocalRenderings] = useState(renderings);
  const [showTemplateInfo, setShowTemplateInfo] = useState(false);
  const templateData = getMapData(mapDef.template, mapBibTerms) || {};

  useEffect(() => {
    setVernacular(locations[selLocation]?.vernLabel || '');
    setLocalIsApproved(isApproved);
    setLocalRenderings(renderings);
  }, [selLocation, isApproved, renderings, locations]);

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
    alert('At this point, the USFM text would be discarded and not saved.'); // TODO:
  };
  const handleOk = () => {
    alert("At this point, the USFM text would be saved to Paratext.");  // TODO: 
  };
  const handleSettings = () => {
    if (onShowSettings) onShowSettings();
  };

  // --- Template info/browse group ---
  // Access the template name from the global map object
  const templateName = mapDef.template || '(' + inLang({en: 'no template'}, lang) + ')';

  // Export to data merge file handler
  const handleExportDataMerge = async () => {
    try {
      // Prepare IDML data merge content
      const dataMergeHeader = locations.map(loc => loc.mergeKey).join('\t');
      const dataMergeContent = locations.map(loc => loc.vernLabel || '').join('\t');
      const data =  dataMergeHeader + '\n' + dataMergeContent + '\n';
      
      // Write to file using the browser file system API
      const fileHandle = await window.showSaveFilePicker({
        suggestedName: templateName + '.idml.txt',
        startIn: 'documents',
        types: [
          {
            description: 'IDML Data Merge Files',
            accept: { 'text/plain': ['.idml.txt'] },
          },
        ],
      });
      if (fileHandle) {
        const writable = await fileHandle.createWritable();
        await writable.write(encodeUTF16LE(data, true));
        await writable.close();
      }
    } catch (e) {
      // User cancelled or not supported
    }
  };

  // Only show the button row if in USFM view
  if (mapPaneView === USFM_VIEW) {
    return (
      <div>
      {/* Button Row */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
        <button onClick={onSwitchView} style={{ marginRight: 60 }}>Switch view</button>
        <button onClick={handleCancel} style={{ marginRight: 8, width:80 }}>{inLang(uiStr.cancel, lang)}</button>
        <button onClick={handleOk}  style={{ width:80 }}>{inLang(uiStr.ok, lang)}</button>
        <button
          onClick={handleExportDataMerge}
          style={{ marginLeft: 16, width: 40, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#e3f2fd', border: '1px solid #1976d2', borderRadius: 4, cursor: 'pointer' }}
          title={inLang(uiStr.export, lang)}
        >
          {/* Export icon: two stacked files with an arrow */}
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="4" y="4" width="10" height="14" rx="2" fill="#fff" stroke="#1976d2" strokeWidth="1.2"/>
            <rect x="8" y="2" width="10" height="14" rx="2" fill="#e3f2fd" stroke="#1976d2" strokeWidth="1.2"/>
            <path d="M13 10v5m0 0l-2-2m2 2l2-2" stroke="#1976d2" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
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
    onRenderingsChange({ target: { value: vernacular } });
    if (termRenderings.data[locations[selLocation].termId]) {
      termRenderings.data[locations[selLocation].termId].isGuessed = false;
    }
    onApprovedChange({ target: { checked: true } });
  };

  let transliteration = mapBibTerms.getTransliteration(locations[selLocation]?.termId);
  if (transliteration) { transliteration = ` /${transliteration}/`; }

  return (
    <div>
      {/* Button Row */}
      {mapPaneView !== USFM_VIEW && (
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
          {/* Icon view buttons */}
          <button
            onClick={() => onSetView(0)}
            disabled={!mapDef.mapView}
            style={{
              marginRight: 4,
              background: mapPaneView === MAP_VIEW ? '#d0eaff' : undefined,
              border: mapPaneView === MAP_VIEW ? '2px inset #2196f3' : undefined,
              opacity: mapDef.mapView ? 1 : 0.5,
              padding: '4px 8px',
              borderRadius: 4,
              height: 32,
              minWidth: 32,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            title={inLang(uiStr.mapView, lang)}
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
              background: mapPaneView === TABLE_VIEW ? '#d0eaff' : undefined,
              border: mapPaneView === TABLE_VIEW ? '2px inset #2196f3' : undefined,
              padding: '4px 8px',
              borderRadius: 4,
              height: 32,
              minWidth: 32,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            title={inLang(uiStr.tableView, lang)}
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
              background: mapPaneView === USFM_VIEW ? '#d0eaff' : undefined,
              border: mapPaneView === USFM_VIEW ? '2px inset #2196f3' : undefined,
              padding: '4px 8px',
              borderRadius: 4,
              height: 32,
              minWidth: 32,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            title={inLang(uiStr.usfmView, lang)}
          >
            {/* USFM icon (document with text lines) */}
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="4" y="3" width="12" height="14" rx="2" fill="#fffde7" stroke="#1976d2" strokeWidth="1.5"/>
              <line x1="6" y1="7" x2="14" y2="7" stroke="#1976d2" strokeWidth="1.2"/>
              <line x1="6" y1="10" x2="14" y2="10" stroke="#1976d2" strokeWidth="1.2"/>
              <line x1="6" y1="13" x2="12" y2="13" stroke="#1976d2" strokeWidth="1.2"/>
            </svg>
          </button>
          <button onClick={handleCancel} style={{ marginRight: 8, height: 32, minWidth: 80, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{inLang(uiStr.cancel, lang)}</button>
          <button onClick={handleOk} style={{ height: 32, minWidth: 80, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{inLang(uiStr.ok, lang)}</button>
          <div style={{ flex:  1 }} />
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
              alignSelf: 'flex-start',
            }}
            title={inLang(uiStr.settings, lang)}
         
          >
            <span role="img" aria-label="Settings">&#9881;</span>
          </button>
        </div>
      )}

      {/* Template info/browse group */}
           <div className="details-group-frame" style={{ border: '1px solid #ccc', borderRadius: 6, marginBottom: 16, padding: 8, background: '#f9f9f9', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <span style={{ fontWeight: 'bold', color: 'black', fontSize: '0.8em' }}>{templateName}</span>
        <button
          title={inLang(uiStr.templateInfo, lang)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginLeft: 1 }}
          onClick={() => setShowTemplateInfo(true)}
        >
          <span role="img" aria-label="info" style={{ fontSize: '1.2em', color: '#6cf' }}>ℹ️</span>
        </button>
        <button
          title={inLang(uiStr.browseTemplate, lang)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginLeft: 1 }}
          onClick={onBrowseMapTemplate}
        >
          <span role="img" aria-label="browse" style={{ fontSize: '1.2em', color: '#fc6' }}>📂</span>
        </button>
          <button
            onClick={handleExportDataMerge}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginLeft: 1 }}
            title={inLang(uiStr.export, lang)}
          >
            {/* Export icon: two stacked files with a down arrow */}
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="4" y="4" width="10" height="14" rx="2" fill="#fff" stroke="#1976d2" strokeWidth="1.2"/>
              <rect x="8" y="2" width="10" height="14" rx="2" fill="#e3f2fd" stroke="#1976d2" strokeWidth="1.2"/>
              <path d="M13 10v5m0 0l-2-2m2 2l2-2" stroke="#1976d2" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>

      </div>

      {/* Modal dialog for template info */}
      {showTemplateInfo && (
        <div style={{
          position: 'fixed', left: 0, top: 0, width: '100vw', height: '100vh', zIndex: 1000,
          background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div style={{ background: 'white', borderRadius: 10, padding: 24, minWidth: 520, maxWidth: 900, boxShadow: '0 4px 24px #0008', position: 'relative' }}>
            <button onClick={() => setShowTemplateInfo(false)} style={{ position: 'absolute', top:  8, right: 12, background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#888' }} title="Close">×</button>
            <h4 style={{ marginTop: 0}}>{templateName}</h4>
            {inLang(templateData.title, lang) && <p style={{ margin: '8px 0', fontWeight: 'bold', fontStyle: 'italic'}}>{inLang(templateData.title, lang)}</p>}
            {inLang(templateData.description, lang) && <p style={{ margin: '8px 0' }}>{inLang(templateData.description, lang)}</p>}
            {templateData.mapTypes && <div style={{ margin: '8px 0' }}><b>{inLang(uiStr.baseLayerTypes, lang)}:</b> {templateData.mapTypes}</div>}
            {templateData.formats && <div style={{ margin: '8px 0' }}><b>{inLang(uiStr.fileFormats, lang)}:</b> {templateData.formats}</div>}
            {templateData.owner && <div style={{ margin: '8px 0' }}><b>{inLang(uiStr.owner, lang)}:</b> {templateData.owner}</div>}
            {templateData.ownerRules && (
              <div style={{ margin: '8px 0' }}>
                <b>{inLang(uiStr.usageRules, lang)}:</b> <a href={templateData.ownerRules} target="_blank" rel="noopener noreferrer">{templateData.ownerRules}</a>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Status Tally Table */}
      <div style={{ border: '1px solid #ccc', borderRadius: 6, marginBottom: 16, padding: 8, background: '#f9f9f9', fontSize: '0.8em' }}>
        <table >
          <tbody>
            {Object.entries(statusTallies).sort((a, b) => statusValue[a[0]].sort - statusValue[b[0]].sort).map(([status, count ]) => (
              <tr key={status}>
                <td style={{ fontWeight: 'bold', padding: '2px 8px', textAlign: 'right' }}>{count}</td>
                <td style={{  }}>
                  <span
                    style={{
                    border: '1px solid black',
                    background: statusValue[status].bkColor,
                    color: statusValue[status].textColor,
                    borderRadius: '0.7em',
                    padding: '0 10px',
                    display: 'inline-block',
                    fontWeight: 'bold',
                    whiteSpace: 'nowrap'
                    }}
                    >
                    {inLang(uiStr.statusValue[status].text, lang)}
                  </span>
                  </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ border: '1px solid #ccc', borderRadius: 6, marginBottom: 16, padding: 8, background: '#f9f9f9' }}>
        <h2>{inLang(locations[selLocation]?.gloss, lang)}</h2>
        <p><span style={{ fontStyle: 'italic' }}>({locations[selLocation]?.termId})  <span style={{ display: 'inline-block', width: 12 }} />{transliteration}</span><br />
          {inLang(mapBibTerms.getDefinition(locations[selLocation]?.termId), lang)}
        </p>
        <div className="vernacularGroup" style={{ backgroundColor: statusValue[status].bkColor, margin: '8px', padding: '8px', border: '1px solid black', borderRadius: '0.7em' }}>
          <input
            ref={vernacularInputRef}
            type="text"
            value={vernacular}
            onChange={handleVernChange}
            placeholder={inLang(uiStr.enterLabel, lang)}
            className="form-control mb-2"
            style={{ width: '100%', border: '1px solid black' }}
            spellCheck={false}
          />
          <span style={{color: statusValue[status].textColor, fontSize: '0.8em'}}>
            <span style={{ fontWeight: 'bold' }}>{inLang(uiStr.statusValue[status].text, lang) + ": "}</span>
            {inLang(uiStr.statusValue[status].help, lang)}
            {status === STATUS_NO_RENDERINGS && (  // If status is "no renderings", show Add to renderings button
              <button style={{ marginLeft: 8 }} onClick={handleAddToRenderings}>{inLang(uiStr.addToRenderings, lang)}</button>
            )}{status === STATUS_GUESSED && (  // If status is "guessed", show Add to renderings button
              <button
              style={{ marginLeft: 8 }}
              onClick={() => {
                setLocalIsApproved(true);
                const updatedData = { ...termRenderings.data };
                updatedData[locations[selLocation].termId] = {
                  ...updatedData[locations[selLocation].termId],
                  isGuessed: false,
                };
                termRenderings.data = updatedData;  // TODO: move this to a setter function
                onApprovedChange({ target: { checked: true } });
              }}>{inLang(uiStr.approveRendering, lang)}
            </button>
            )}
          </span>
        </div>
        <h5>{inLang(uiStr.termRenderings, lang)}  {localRenderings && !localIsApproved ? '(' + inLang(uiStr.guessed, lang) +')' : ''}</h5>
        <div className="term-renderings" style={{ margin: '8px' }}>
          <textarea
            ref={renderingsTextareaRef}
            value={localRenderings}
            onChange={e => {
              setLocalRenderings(e.target.value);
              const updatedData = { ...termRenderings.data };
              updatedData[locations[selLocation].termId] = {
                ...updatedData[locations[selLocation].termId],
                renderings: e.target.value,  // TODO: move this to a setter function
              };
              // If not approved, auto-approve on edit
              if (!localIsApproved) {
                setLocalIsApproved(true);
                updatedData[locations[selLocation].termId].isGuessed = false;  
                onApprovedChange({ target: { checked: true } });
              }
              termRenderings.data = updatedData;  // TODO: move this to a setter function
              // The renderings change might affect the status of the location indexed by selLocation
              //const status = termRenderings.getStatus(locations[selLocation].termId, locations[selLocation].vernLabel || '');
              onRenderingsChange({ target: { value: e.target.value } });
            }}
            style={{ width: '100%', minHeight: '100px', border: '1px solid black', borderRadius: '0.5em', padding: '8px', fontSize: '12px', backgroundColor: localRenderings && !localIsApproved ? '#ffbf8f' : 'white' }}

            placeholder={inLang(uiStr.enterRenderings, lang)}
            spellCheck={false}
          />
        </div>
      </div>
    </div>
  );
}

// Settings Modal Dialog
const SettingsModal = ({ open, onClose, labelScale, setLabelScale, lang, setLang, projectFolder, handleSelectProjectFolder }) => {
  if (!open) return null;
  return (
    <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.2)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="modal-content" style={{ background: '#fff', borderRadius: 8, padding: 24, minWidth: 320, maxWidth: 600, boxShadow: '0 2px 16px rgba(0,0,0,0.2)' }}>
        <h2 style={{ marginTop: 0, textAlign: 'center'  }}>{inLang(uiStr.settings, lang)}</h2>
        {/* Project folder selector UI */}
        {/*}
        <div style={{ padding: '6px 12px', background: '#f0f0f0', borderBottom: '1px solid #ccc', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontWeight: 'bold' }}>Project Folder:</span>
          <span style={{ color: projectFolder ? '#333' : '#888', fontFamily: 'monospace', fontSize: 13, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{projectFolder || '(none selected)'}</span>
          <button onClick={handleSelectProjectFolder} style={{ padding: '2px 10px', borderRadius: 4, border: '1px solid #888', background: '#e3f2fd', cursor: 'pointer' }}>Change…</button>
        </div>
        */}
        <div style={{ marginBottom: 16, textAlign: 'center'  }}>
          <label style={{ fontWeight: 'bold', marginRight: 8, textAlign: 'center'  }}>{inLang(uiStr.labelSize, lang)}:</label>
          <input
            type="range"
            min={0.5}
            max={2}
            step={0.05}
            value={labelScale}
            onChange={e => setLabelScale(parseFloat(e.target.value))}
            style={{ verticalAlign: 'middle', marginRight: 8 }}
          />
          <span>{labelScale.toFixed(2)}x</span>
        </div>
        <div style={{ marginBottom: 16, textAlign: 'center'  }}>
          <label style={{ fontWeight: 'bold', marginRight: 8 }}>{inLang(uiStr.language, lang)}:</label>
          <select
            value={lang}
            onChange={e => {
              setLang(e.target.value);
              localStorage.setItem('lang', e.target.value);
            }}
            style={{ fontSize: 15, padding: '2px 8px', borderRadius: 4 }}
          >
            {supportedLanguages.map(ling => (
              <option key={ling.code} value={ling.code}>{ling.name}</option>
            ))}
          </select>
        </div>
        <div style={{ textAlign: 'center' }}>
          <button onClick={onClose} style={{ fontSize: 15, padding: '4px 16px', borderRadius: 4 }}>{inLang(uiStr.close, lang)}</button>
        </div>
      </div>
       </div>
  );
};

export default App;