import React, { useEffect, useRef } from 'react';
import './MainApp.css';
import uiStr from './data/ui-strings.json';
import { CheckmarkIcon, DeniedCheckmarkIcon, WarningIcon } from './TermIcons';
// import { MAP_VIEW, TABLE_VIEW, USFM_VIEW, STATUS_NO_RENDERINGS, STATUS_GUESSED } from './constants.js';
// Status values not yet used: STATUS_BLANK, STATUS_MULTIPLE,  STATUS_UNMATCHED, STATUS_MATCHED, STATUS_RENDERING_SHORT, STATUS_BAD_EXPLICIT_FORM
// import TermRenderings from './TermRenderings';
import { collectionManager } from './CollectionManager';
import { inLang, statusValue, getMatchTally, isLocationVisible } from './Utils.js';
import { AutocorrectInput } from './components/AutocorrectInput';

// Table View component
export default function TableView({
  locations,
  selLocation,
  onUpdateVernacular,
  onNextLocation,
  termRenderings,
  onSelectLocation,
  lang,
  extractedVerses,
  collectionId = 'SMR',
  selectedVariant = 0,
}) {
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
            <th style={{ textAlign: 'center' }}>{inLang(uiStr.tally, lang)}</th>
            <th style={{ textAlign: 'left' }}>{inLang(uiStr.found, lang)}</th>
            <th>{inLang(uiStr.status, lang)}</th>
          </tr>
        </thead>
        <tbody>
          {locations
            .filter(loc => isLocationVisible(loc, selectedVariant))
            .map((loc, i) => {
              // Use loc.status which is already calculated in App.js
              // This avoids inconsistencies with status calculations
              const status = loc.status;
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
                  <td style={isSelected ? { paddingTop: 4, paddingBottom: 4 } : {}}>
                    {inLang(loc.gloss, lang)}
                  </td>
                  <td style={isSelected ? { paddingTop: 4, paddingBottom: 4 } : {}}>
                    <AutocorrectInput
                      ref={el => (inputRefs.current[i] = el)}
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
                    />{' '}
                  </td>
                  <Frac
                    value={getMatchTally(
                      termRenderings[loc.termId],
                      collectionManager.getRefs(loc.mergeKey, collectionId),
                      extractedVerses
                    )}
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
