import React from 'react';
import { FaPencilAlt } from 'react-icons/fa';
import uiStr from './data/ui-strings.json';
import { CheckmarkIcon, DeniedCheckmarkIcon, CrossIcon, NoneIcon } from './TermIcons';
import { MATCH_PRE_B, MATCH_POST_B, MATCH_W } from './constants.js';
import { collectionManager } from './CollectionManager';
import { inLang, prettyRef } from './Utils.js';

// Bottom Pane component to display a scrollable list of verses referencing the termId
function BottomPane({
  termId,
  mergeKey,
  renderings,
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
}) {
  const paneRef = React.useRef();
  const [selectedText, setSelectedText] = React.useState('');
  // Add a local state to force re-render on denial toggle
  const [denialToggle, setDenialToggle] = React.useState(false);
  const [showOnlyMissing, setShowOnlyMissing] = React.useState(false);

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
  const refs = collectionManager.getRefs(mergeKey, collectionId);

  // Prepare renderings: remove comments, split, trim, and convert to regex patterns
  let renderingList = [];
  if (renderings) {
    renderingList = renderings
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
        // Replace * [with [\w-]* (word chars + dash)
        pattern = pattern.replace(/\*/g, MATCH_W + '*');
        // console.log(`BP: Creating regex for rendering "${r}" with pattern "${pattern}"`);
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

  // Compute match tally
  let deniedRefs = termRenderings[termId]?.denials || [];
  // if (deniedRefs.length !== 0) {
  //   console.log(`Term "${termId}" has denied references:`, deniedRefs);
  // } else {
  //   console.log(`compute match tally for ${termId}`, termRenderings);
  // }
  let matchCount = 0;
  let nonEmptyRefCt = 0; // Count of non-empty references
  const matchResults = refs.map(refId => {
    const verse = extractedVerses[refId] || '';
    if (!verse) {
      // Skip empty verses
      return false;
    }
    nonEmptyRefCt++;
    const hasMatch = renderingList.some(r => r.test(verse));
    if (hasMatch || deniedRefs.includes(refId)) matchCount++;
    return hasMatch;
  });

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
        <span>
          {inLang(uiStr.found, lang)}: {matchCount}/{nonEmptyRefCt}
        </span>{' '}
        <button
          style={{
            marginLeft: 8,
            fontSize: 13,
            padding: '4px 4px',
            borderRadius: 4,
            background: showOnlyMissing ? '#d0eaff' : undefined,
            border: showOnlyMissing ? '2px inset #2196f3' : '1px solid #b2dfdb',
            cursor: 'pointer',
            height: 22,
            minWidth: 22,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onClick={() => setShowOnlyMissing(!showOnlyMissing)}
          title={
            showOnlyMissing
              ? inLang(uiStr.showAllVerses, lang)
              : inLang(uiStr.showOnlyMissing, lang)
          }
        >
          {/* Filter icon (SVG) */}
          <svg
            width="20"
            height="20"
            viewBox="0 0 20 20"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M3 6h14l-4 4v6l-2-2v-4L3 6z"
              fill={showOnlyMissing ? '#1976d2' : '#666'}
              stroke={showOnlyMissing ? '#1976d2' : '#666'}
              strokeWidth="1"
            />
          </svg>
        </button>
        {selectedText && (
          <>
            <button
              style={{
                marginLeft: 8,
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
              refs
                .map((refId, i) => {
                  // Reference denialToggle to force re-render
                  void denialToggle;
                  const verse = extractedVerses[refId] || '';
                  const hasMatch = matchResults[i];
                  const isDenied = deniedRefs.includes(refId);

                  // Apply filtering logic
                  if (showOnlyMissing) {
                    // Only show if verse exists, no match, and not denied
                    if (!(verse && !hasMatch && !isDenied)) {
                      return null; // Skip this row
                    }
                  }

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
                    if (typeof onDenialsChanged === 'function') onDenialsChanged(); // <-- update locations in App
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
                                alert(`Could not send reference to Paratext: ${result.error}`);
                              }
                            } catch (error) {
                              console.error('Error broadcasting reference:', error);
                              alert(`Error sending reference to Paratext: ${error.message}`);
                            }
                            alert(`Please go edit ${prettyRef(refId)} in Paratext, and then click "OK" refresh the verse text here.`);
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
                })
                .filter(Boolean) // Remove null values from filtered results
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default BottomPane;
