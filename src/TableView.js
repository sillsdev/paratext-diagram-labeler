import React, { useEffect, useRef } from 'react';
import './MainApp.css';
import uiStr from './data/ui-strings.json';
import { CheckmarkIcon, DeniedCheckmarkIcon, WarningIcon } from './TermIcons';
import { collectionManager } from './CollectionManager';
import { inLang, statusValue, getMatchTally, isLabelVisible } from './Utils.js';
import { AutocorrectInput } from './components/AutocorrectInput';

// Table View component
export default function TableView({
  labels,
  selectedLabelIndex,
  onUpdateVernacular,
  onNextLabel,
  termRenderings,
  onSelectLabel,
  lang,
  extractedVerses,
  collectionId = 'SMR',
  selectedVariant = 0,
}) {
  const inputRefs = useRef([]);
  const prevSelectedLabelRef = useRef(selectedLabelIndex);
  
  useEffect(() => {
    // Only focus when selectedLabelIndex actually changes, not when labels array is updated
    if (prevSelectedLabelRef.current !== selectedLabelIndex) {
      prevSelectedLabelRef.current = selectedLabelIndex;
      
      // Focus the input for the selected row
      const idx = selectedLabelIndex;
      if (idx >= 0 && inputRefs.current[idx]) {
        inputRefs.current[idx].focus();
        console.log('TableView: Focus set on input for label:', selectedLabelIndex);  
      }
    }
  }, [selectedLabelIndex]);
  return (
    <div className="table-view-scroll-wrapper">
      <table className="table-view" style={{ borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: '#444', color: '#e0e0e0' }}>
            <th>{inLang(uiStr.gloss, lang)}</th>
            <th>{inLang(uiStr.label, lang)}</th>
            <th style={{ textAlign: 'center' }}>{inLang(uiStr.tally, lang)}</th>
            <th style={{ textAlign: 'left' }}>{inLang(uiStr.found, lang)}</th>
            <th>{inLang(uiStr.status, lang)}</th>
          </tr>
        </thead>
        <tbody>
          {labels
            .filter(label => isLabelVisible(label, selectedVariant))
            .map((label, i) => {
              // Use label.status which is already calculated in App.js
              // This avoids inconsistencies with status calculations
              const status = label.status;
              const isSelected = selectedLabelIndex === label.idx;
              return (
                <tr
                  key={label.mergeKey}
                  style={{
                    fontWeight: isSelected ? 'bold' : 'normal',
                    cursor: 'pointer',
                    border: (isSelected ? '6px' : '1px') + ' solid ' + statusValue[status].bkColor,
                    paddingTop: isSelected ? 12 : undefined,
                    paddingBottom: isSelected ? 12 : undefined,
                  }}
                  onClick={() => onSelectLabel(label)}
                >
                  <td style={isSelected ? { paddingTop: 4, paddingBottom: 4 } : {}}>
                    {inLang(label.gloss, lang)}
                  </td>
                  <td style={isSelected ? { paddingTop: 4, paddingBottom: 4 } : {}}>
                    <AutocorrectInput
                      ref={el => (inputRefs.current[i] = el)}
                      type="text"
                      value={label.vernLabel || ''}
                      onChange={e => onUpdateVernacular(
                        label.mergeKey, 
                        label.lblTemplate || label.mergeKey, 
                        e.target.value,
                        label.opCode || 'sync'
                      )}
                      onFocus={() => onSelectLabel(label)}
                      onKeyDown={e => {
                        if (e.key === 'ArrowDown') {
                          onNextLabel(true);
                          e.preventDefault();
                          e.stopPropagation();
                        } else if (e.key === 'ArrowUp') {
                          onNextLabel(false);
                          e.preventDefault();
                          e.stopPropagation();
                        }
                      }}
                      style={{}}
                      spellCheck={false}
                    />{' '}
                  </td>
                  <Frac
                    value={(() => {
                      // Aggregate match tallies from all terms in all placeNames
                      let totalMatches = 0;
                      let totalRefs = 0;
                      let anyDenials = false;
                      
                      if (label.placeNameIds && label.placeNameIds.length > 0) {
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
                        return [totalMatches, totalRefs, anyDenials];
                      }
                      return null;
                    })()}
                  />
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
                        whiteSpace: 'nowrap',
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

function Frac({ value }) {
  if (!value || !Array.isArray(value))
    return (
      <>
        <td></td>
        <td></td>
      </>
    );
  const [num, denom, anyDenials] = value;
  if (!denom)
    return (
      <>
        <td></td>
        <td></td>
      </>
    );
  let icon;
  if (num === denom) {
    icon = anyDenials ? <DeniedCheckmarkIcon /> : <CheckmarkIcon />;
  } else {
    icon = <WarningIcon />;
  }
  return (
    <>
      <td style={{ textAlign: 'center' }}>
        {num}/{denom}
      </td>
      <td style={{ textAlign: 'left' }}>{icon}</td>
    </>
  );
}
