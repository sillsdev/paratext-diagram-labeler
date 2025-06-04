import React from 'react';
import { FaPencilAlt } from 'react-icons/fa';
import uiStr from './data/ui-strings.json';
import { CheckmarkIcon, DeniedCheckmarkIcon, CrossIcon } from './TermIcons';
import { MATCH_PRE_B, MATCH_POST_B, MATCH_W } from './demo.js';
// import { MAP_VIEW, TABLE_VIEW, USFM_VIEW, STATUS_NO_RENDERINGS, STATUS_GUESSED } from './constants.js';
// Status values not yet used: STATUS_BLANK, STATUS_MULTIPLE,  STATUS_UNMATCHED, STATUS_MATCHED, STATUS_RENDERING_SHORT, STATUS_BAD_EXPLICIT_FORM 
// import TermRenderings from './TermRenderings';
import { collectionTerms } from './CollectionTerms.js';
import { inLang } from './Utils.js';

const bookNames = 'GEN,EXO,LEV,NUM,DEU,JOS,JDG,RUT,1SA,2SA,1KI,2KI,1CH,2CH,EZR,NEH,EST,JOB,PSA,PRO,ECC,SNG,ISA,JER,LAM,EZK,DAN,HOS,JOL,AMO,OBA,JON,MIC,NAM,HAB,ZEP,HAG,ZEC,MAL,MAT,MRK,LUK,JHN,ACT,ROM,1CO,2CO,GAL,EPH,PHP,COL,1TH,2TH,1TI,2TI,TIT,PHM,HEB,JAS,1PE,2PE,1JN,2JN,3JN,JUD,REV,TOB,JDT,ESG,WIS,SIR,BAR,LJE,S3Y,SUS,BEL,1MA,2MA,3MA,4MA,1ES,2ES,MAN,PS2,ODA,PSS';

function prettyRef(ref) {
  // ref is a 9 digit string. First 3 digits are the book code, next 3 are chapter, last 3 are verse.
  const bookCode = parseInt(ref.slice(0, 3), 10) - 1;
  const chapter = parseInt(ref.slice(3,  6), 10);    
  const verse = parseInt(ref.slice(6, 9), 10);
  const bookName = bookNames.slice(bookCode*4, bookCode*4+3); // Use the top-level bookNames constant, 4 chars per code.
  return `${bookName} ${chapter}:${verse}`;
}

// Bottom Pane component to display a scrollable list of verses referencing the termId
function BottomPane({ termId, renderings, onAddRendering, onReplaceRendering, renderingsTextareaRef, lang, termRenderings, setRenderings, onDenialsChanged, extractedVerses, setTermRenderings }) {
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
  const refs = collectionTerms.getRefs(termId);

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
  let deniedRefs = termRenderings[termId]?.denials || [];
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
                  const data = termRenderings;
                  let denials = Array.isArray(data[termId]?.denials) ? [...data[termId].denials] : [];
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

export default BottomPane;

