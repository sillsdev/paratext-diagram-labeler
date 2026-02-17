import React from 'react';
import { FaPencilAlt } from 'react-icons/fa';
import uiStr from './data/ui-strings.json';
import { CheckmarkIcon, DeniedCheckmarkIcon, CrossIcon, NoneIcon, ShowAllIcon, ShowHideEmptyIcon, ShowMissingIcon, ShowUniqueIcon } from './TermIcons';
import { MATCH_PRE_B, MATCH_POST_B, MATCH_W } from './constants.js';
import { collectionManager } from './CollectionManager';
import { inLang, prettyRef } from './Utils.js';

// Filter mode constants
const FILTER_SHOW_ALL = 'all';
const FILTER_HIDE_EMPTY = 'hideEmpty';
const FILTER_SHOW_MISSING = 'missing';
const FILTER_SHOW_UNIQUE = 'unique';

// Bottom Pane component to display a scrollable list of verses referencing terms in the active placeName
function BottomPane({
  termId, // Deprecated - kept for backward compatibility
  mergeKey,
  renderings, // Deprecated - computed from placeNameIds
  onAddRendering,
  onReplaceRendering,
  lang,
  termRenderings,
  setRenderings,
  onDenialsChanged,
  extractedVerses,
  setTermRenderings,
  collectionId = 'SMR',
  onReloadExtractedVerses,
  placeNameIds = [], // NEW: Array of placeNameIds in the label
  activeTab = 0, // NEW: Index of active placeName tab
}) {
  const paneRef = React.useRef();
  const [selectedText, setSelectedText] = React.useState('');
  // Add a local state to force re-render on denial toggle
  const [denialToggle, setDenialToggle] = React.useState(false);
  const [filterMode, setFilterMode] = React.useState(FILTER_HIDE_EMPTY);

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
  
  // Get active placeName and its terms
  const activePlaceNameId = placeNameIds[activeTab] || placeNameIds[0];
  const placeName = activePlaceNameId ? collectionManager.getPlaceName(activePlaceNameId, collectionId) : null;
  const terms = placeName?.terms || [];
  
  if (terms.length === 0) {
    return <div className="bottom-pane" ref={paneRef} style={{ padding: 16, color: '#666' }}>
      {inLang({ en: 'No terms found for this label' }, lang)}
    </div>;
  }
  
  // Collect refs from all terms in the active placeName
  const refs = [];
  const allTermIds = [];
  terms.forEach(term => {
    allTermIds.push(term.termId);
    if (term.refs) {
      term.refs.forEach(ref => {
        if (!refs.includes(ref)) refs.push(ref);
      });
    }
  });
  
  // Prepare combined renderings from all terms
  let renderingList = [];
  terms.forEach(term => {
    const termData = termRenderings[term.termId];
    if (termData && termData.renderings) {
      const termRenderingPatterns = termData.renderings
        .replace(/\|\|/g, '\n')
        .split(/(\r?\n)/)
        .map(r => r.replace(/\(.*/g, '').replace(/.*\)/g, '')) // Remove content in parentheses (comments), even if only partially enclosed. (The user may be typing a comment.)
        .map(r => r.trim())
        .filter(r => r.length > 0)
        .map(r => {
          let pattern = r;
          // Insert word boundary at start if not starting with *
          if (!pattern.startsWith('*')) pattern = MATCH_PRE_B + pattern;
          // Insert word boundary at end if not ending with *
          if (!pattern.endsWith('*')) pattern = pattern + MATCH_POST_B;
          // Replace * with [\w-]* (word chars + dash)
          pattern = pattern.replace(/\*/g, MATCH_W + '*');
          try {
            return new RegExp(pattern, 'iu');
          } catch (e) {
            // Invalid regex, skip it
            return null;
          }
        })
        .filter(Boolean); // Remove nulls (invalid regexes)
      
      renderingList.push(...termRenderingPatterns);
    }
  });

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
            <span style={{ background: '#c8f7c5', fontWeight: 'bold' }}>
              {text.slice(start, end)}
            </span>
            {text.slice(end)}
          </>
        );
      }
    }
    return text;
  }

  // Compute match tally and filter-specific counts
  // Collect denials from all terms
  let deniedRefs = [];
  terms.forEach(term => {
    const termDenials = termRenderings[term.termId]?.denials || [];
    deniedRefs.push(...termDenials);
  });
  deniedRefs = [...new Set(deniedRefs)]; // Remove duplicates
  
  let matchCount = 0;
  let nonEmptyRefCt = 0; // Count of non-empty references
  let missingCount = 0; // Count of missing (non-matching, non-denied) verses
  let uniqueCount = 0; // Count of unique forms (calculated separately)
  
  const matchResults = refs.map(refId => {
    const verse = extractedVerses[refId] || '';
    if (!verse) {
      // Skip empty verses
      return false;
    }
    nonEmptyRefCt++;
    const hasMatch = renderingList.some(r => r.test(verse));
    const isDenied = deniedRefs.includes(refId);
    
    if (hasMatch || isDenied) {
      matchCount++;
    } else {
      missingCount++;
    }
    
    return hasMatch;
  });

  // Calculate unique forms count for Show Unique mode
  if (filterMode === FILTER_SHOW_UNIQUE) {
    const seenForms = new Set();
    refs.forEach((refId, i) => {
      const verse = extractedVerses[refId] || '';
      const hasMatch = matchResults[i];
      
      if (hasMatch && verse) {
        // Extract matched text (case-insensitive, preserve diacritics/punctuation)
        for (const regex of renderingList) {
          const match = verse.match(regex);
          if (match) {
            const matchedText = match[0].toLowerCase();
            if (!seenForms.has(matchedText)) {
              seenForms.add(matchedText);
              uniqueCount++;
            }
            break;
          }
        }
      }
    });
  }

  return (
    <div
      className="bottom-pane"
      ref={paneRef}
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%', // Fill parent (resizes with pane)
        minHeight: 0, // Allow flex children to shrink
        padding: 4,
      }}
    >
      <div
        style={{
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
          minHeight: 28,
        }}
      >
        <div style={{ display: 'flex' }}>
          {/* Show All Button */}
          <button
            style={{
              fontSize: 13,
              padding: '4px 4px',
              borderRadius: '4px 0 0 4px',
              background: filterMode === FILTER_SHOW_ALL ? '#d0eaff' : undefined,
              border: filterMode === FILTER_SHOW_ALL ? '2px inset #2196f3' : '1px solid #b2dfdb',
              cursor: 'pointer',
              height: 22,
              minWidth: 22,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            onClick={() => setFilterMode(FILTER_SHOW_ALL)}
            title={inLang(uiStr.showAllVerses, lang)}
          >
            <ShowAllIcon />
          </button>
          
          {/* Hide Empty Verses Button */}
          <button
            style={{
              fontSize: 13,
              padding: '4px 4px',
              borderRadius: 0,
              background: filterMode === FILTER_HIDE_EMPTY ? '#d0eaff' : undefined,
              border: filterMode === FILTER_HIDE_EMPTY ? '2px inset #2196f3' : '1px solid #b2dfdb',
              cursor: 'pointer',
              height: 22,
              minWidth: 22,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            onClick={() => setFilterMode(FILTER_HIDE_EMPTY)}
            title={inLang(uiStr.hideEmptyVerses, lang)}
          >
            <ShowHideEmptyIcon />
          </button>
          
          {/* Show Missing Button */}
          <button
            style={{
              fontSize: 13,
              padding: '4px 4px',
              borderRadius: 0,
              background: filterMode === FILTER_SHOW_MISSING ? '#d0eaff' : undefined,
              border: filterMode === FILTER_SHOW_MISSING ? '2px inset #2196f3' : '1px solid #b2dfdb',
              cursor: 'pointer',
              height: 22,
              minWidth: 22,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            onClick={() => setFilterMode(FILTER_SHOW_MISSING)}
            title={inLang(uiStr.showOnlyMissing, lang)}
          >
            <ShowMissingIcon />
          </button>
          
          {/* Show Unique Button */}
          <button
            style={{
              fontSize: 13,
              padding: '4px 4px',
              borderRadius: '0 4px 4px 0',
              background: filterMode === FILTER_SHOW_UNIQUE ? '#d0eaff' : undefined,
              border: filterMode === FILTER_SHOW_UNIQUE ? '2px inset #2196f3' : '1px solid #b2dfdb',
              cursor: 'pointer',
              height: 22,
              minWidth: 22,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            onClick={() => {
              setFilterMode(FILTER_SHOW_UNIQUE);
              // Note: unique forms are now calculated per-render, no state reset needed
            }}
            title={inLang(uiStr.showUniqueForms, lang)}
          >
            <ShowUniqueIcon />
          </button>
        </div>
        <span style={{ marginLeft: 8 }}>
          {filterMode === FILTER_SHOW_ALL && `${inLang(uiStr.found, lang)}: ${matchCount}/${nonEmptyRefCt}`}
          {filterMode === FILTER_HIDE_EMPTY && `${inLang(uiStr.found, lang)}: ${matchCount}/${nonEmptyRefCt}`}
          {filterMode === FILTER_SHOW_MISSING && `${inLang(uiStr.missing, lang)}: ${missingCount}/${nonEmptyRefCt}`}
          {filterMode === FILTER_SHOW_UNIQUE && `${inLang(uiStr.unique, lang)}: ${uniqueCount}`}
        </span>
        {selectedText && (
          <>
            <button
              style={{
                marginLeft: 16,
                fontSize: 13,
                padding: '1px 6px',
                borderRadius: 4,
                background: '#e0ffe0',
                border: '1px solid #b2dfdb',
                cursor: 'pointer',
                height: 22,
              }}
              onClick={() => onAddRendering(selectedText)}
            >
              {inLang(uiStr.addRendering, lang)}
            </button>
            <button
              style={{
                marginLeft: 6,
                fontSize: 13,
                padding: '1px 6px',
                borderRadius: 4,
                background: 'gold',
                border: '1px solid #dfb2b2',
                cursor: 'pointer',
                height: 22,
              }}
              onClick={() => onReplaceRendering(selectedText)}
            >
              {inLang(uiStr.replaceRenderings, lang)}
            </button>
          </>
        )}
      </div>
      <div
        style={{
          overflowY: 'auto',
          flex: 1,
          minHeight: 0,
        }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'auto' }}>
          <tbody>
            {refs.length === 0 ? (
              <tr>
                <td colSpan={2} style={{ color: '#888', textAlign: 'center', padding: 4 }}>
                  {inLang(uiStr.noReferences, lang)}
                </td>
              </tr>
            ) : (
              (() => {
                // Pre-calculate unique forms for FILTER_SHOW_UNIQUE mode
                const currentSeenForms = new Set();
                const filteredRefs = [];
                
                refs.forEach((refId, i) => {
                  // Reference denialToggle to force re-render
                  void denialToggle;
                  const verse = extractedVerses[refId] || '';
                  const hasMatch = matchResults[i];
                  const isDenied = deniedRefs.includes(refId);

                  // Apply filtering logic
                  let shouldShow = true;
                  
                  if (filterMode === FILTER_HIDE_EMPTY) {
                    shouldShow = !!verse;
                  } else if (filterMode === FILTER_SHOW_MISSING) {
                    shouldShow = verse && !hasMatch && !isDenied;
                  } else if (filterMode === FILTER_SHOW_UNIQUE) {
                    if (!hasMatch || !verse) {
                      shouldShow = false;
                    } else {
                      // Extract matched text (case-insensitive, preserve diacritics/punctuation)
                      let matchedText = null;
                      for (const regex of renderingList) {
                        const match = verse.match(regex);
                        if (match) {
                          matchedText = match[0].toLowerCase();
                          break;
                        }
                      }
                      
                      if (!matchedText || currentSeenForms.has(matchedText)) {
                        shouldShow = false;
                      } else {
                        currentSeenForms.add(matchedText);
                      }
                    }
                  }
                  // FILTER_SHOW_ALL shows everything (existing behavior)
                  
                  if (shouldShow) {
                    filteredRefs.push({ refId, i, verse, hasMatch, isDenied });
                  }
                });

                return filteredRefs.map(({ refId, i, verse, hasMatch, isDenied }) => {

                  // Handler must be in this scope
                  const handleToggleDenied = () => {
                    const data = termRenderings;
                    let denials = Array.isArray(data[termId]?.denials)
                      ? [...data[termId].denials]
                      : [];
                    if (isDenied) {
                      denials = denials.filter(r => r !== refId);
                    } else {
                      if (!denials.includes(refId)) denials.push(refId);
                    }
                    if (!data[termId]) data[termId] = {};
                    data[termId].denials = denials;
                    const updatedData = { ...data };
                    setTermRenderings(updatedData);
                    if (typeof setRenderings === 'function') setRenderings(r => r + '');
                    setDenialToggle(t => !t);
                    if (typeof onDenialsChanged === 'function') onDenialsChanged(); // <-- update labels in App
                  };
                  return (
                    <tr
                      key={refId}
                      style={{ borderBottom: '1px solid #eee', verticalAlign: 'top' }}
                    >
                      <td
                        style={{
                          width: 38,
                          textAlign: 'center',
                          padding: '2px 0',
                          verticalAlign: 'top',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {!verse ? (
                          <NoneIcon title="No verse text yet" />
                        ) : hasMatch ? (
                          <CheckmarkIcon title="Match found" />
                        ) : (
                          <span
                            style={{ cursor: 'pointer', display: 'inline-block' }}
                            onClick={handleToggleDenied}
                            title={isDenied ? 'Remove denial' : 'Mark as denied'}
                          >
                            {isDenied ? (
                              <DeniedCheckmarkIcon />
                            ) : (
                              <CrossIcon title="No match (Click to deny)" />
                            )}
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
                          title="Send reference to Paratext"
                          aria-label="Send reference to Paratext"
                          onClick={async () => {
                            try {
                              const result = await window.electronAPI.broadcastReference(prettyRef(refId));
                              if (result.success) {
                                console.log(`Successfully sent reference to Paratext: ${result.reference}`);
                              } else {
                                console.warn(`Failed to send reference to Paratext: ${result.error}`);
                                alert(inLang(uiStr.couldNotSendToParatext, lang) + (result.error ? ': ' + result.error : ''));
                                return;
                              }
                            } catch (error) {
                              console.error('Error broadcasting reference:', error);
                              alert(inLang(uiStr.errorSendingToParatext, lang) + (error.message ? ': ' + error.message : ''));
                              return;
                            }
                            // Use Electron's dialog which properly awaits user response
                            await window.electronAPI.showMessageBox({
                              type: 'info',
                              buttons: ['OK'],
                              title: 'Paratext',
                              message: inLang(uiStr.paratextInstructions, lang).replace('{reference}', prettyRef(refId)),
                            });
                            // Reload the extracted verses to reflect changes
                            if (onReloadExtractedVerses) {
                              await onReloadExtractedVerses(termId, mergeKey);
                            }

                          }}
                        >
                          <FaPencilAlt />
                        </button>
                      </td>
                      <td
                        className="context-text"
                        style={{
                          padding: '2px 0 2px 8px',
                          verticalAlign: 'top',
                          wordBreak: 'break-word',
                          whiteSpace: 'normal',
                        }}
                      >
                        <span style={{ fontWeight: 'bold', marginRight: 4 }}>
                          {prettyRef(refId)}{' '}
                        </span>
                        {hasMatch
                          ? highlightMatch(verse, renderingList)
                          : verse || <span style={{ color: '#888' }}>[No verse text yet]</span>}
                      </td>
                    </tr>
                  );
                });
              })() // Close the IIFE
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default BottomPane;
