import React, { useState, useEffect, useMemo } from 'react';
import './MainApp.css';
import uiStr from './data/ui-strings.json';
import {
  MAP_VIEW,
  TABLE_VIEW,
  USFM_VIEW,
  STATUS_NO_RENDERINGS,
  STATUS_GUESSED,
} from './constants.js';
import { collectionManager, getCollectionIdFromTemplate } from './CollectionManager';
import { getMapDef } from './MapData';
import { inLang, statusValue } from './Utils.js';
import { settingsService } from './services/SettingsService.js';

export default function DetailsPane({
  selLocation,
  onUpdateVernacular,
  onNextLocation,
  renderings,
  isApproved,
  onRenderingsChange,
  onApprovedChange,
  termRenderings,
  locations,
  onSwitchView,
  mapPaneView,
  onSetView,
  onShowSettings,
  mapDef,
  onBrowseMapTemplate,
  vernacularInputRef,
  renderingsTextareaRef,
  lang,
  setTermRenderings,
  onCreateRendering,
  onExit,
  selectedVariant = 0,
  onVariantChange,
}) {
  const [vernacular, setVernacular] = useState(locations[selLocation]?.vernLabel || '');
  const [localIsApproved, setLocalIsApproved] = useState(isApproved);
  const [localRenderings, setLocalRenderings] = useState(renderings);
  const [showTemplateInfo, setShowTemplateInfo] = useState(false);
  const [templateData, setTemplateData] = useState({});

  // Load template data when mapDef.template changes
  useEffect(() => {
    const loadTemplateData = async () => {
      if (!mapDef.template) {
        setTemplateData({});
        return;
      }

      try {
        const collectionId = getCollectionIdFromTemplate(mapDef.template);
        const data = await getMapDef(mapDef.template, collectionId);
        setTemplateData(data || {});
      } catch (error) {
        console.error(`Error loading template data for ${mapDef.template}:`, error);
        setTemplateData({});
      }
    };

    loadTemplateData();
  }, [mapDef.template]);

  useEffect(() => {
    setVernacular(locations[selLocation]?.vernLabel || '');
    setLocalIsApproved(isApproved);
    setLocalRenderings(renderings);
  }, [selLocation, isApproved, renderings, locations]);

  useEffect(() => {
    if (vernacularInputRef && vernacularInputRef.current && mapPaneView === MAP_VIEW) {
      vernacularInputRef.current.focus();
    }
  }, [selLocation, mapPaneView, vernacularInputRef]);

  const handleVernChange = e => {
    const newVernacular = e.target.value;
    setVernacular(newVernacular); // Update state immediately
    onUpdateVernacular(locations[selLocation].termId, newVernacular);
  };

  // Tally status counts for all locations
  const statusTallies = useMemo(() => {
    const tally = {};
    if (locations && locations.length > 0) {
      locations.forEach(loc => {
        // Use the status already stored in the location object
        const status = loc.status || 0;
        if (!tally[status]) tally[status] = 0;
        tally[status]++;
      });
    }
    return tally;
  }, [locations]);

  // --- Button Row Handlers (implement as needed) ---
  const handleCancel = () => {
    onExit();
  };

  // Helper function to generate USFM from the current map state // TODO: compare with usfmFromMap(). Could probably be consolidated.
  const generateUsfm = () => {
    console.log('Converting map to USFM:', mapDef);
    // Reconstruct USFM string from current map state
    let usfm = `\\zdiagram-s |template="${mapDef.template}"\\*\n`;

    // Always include the \fig line if present, and ensure it is in correct USFM format
    if (mapDef.fig && !/^\\fig/.test(mapDef.fig)) {
      usfm += `\\fig ${mapDef.fig}\\fig*\n`;
    } else if (mapDef.fig) {
      usfm += `${mapDef.fig}\n`;
    }

    // Add each label as a \zlabel entry
    locations.forEach(label => {
      usfm += `\\zlabel |key="${label.mergeKey}" termid="${label.termId}" gloss="${inLang(
        label.gloss,
        lang
      )}" label="${label.vernLabel || ''}"\\*\n`;
    });

    usfm += '\\zdiagram-e \\*';
    // Remove unnecessary escaping for output
    return usfm.replace(/\\/g, '\\');
  };

  const handleOk = () => {
    // Save current USFM to settings.usfm
    const currentUsfm = generateUsfm();
    console.log('OK! Generated USFM:', currentUsfm);
    settingsService
      .updateUsfm(currentUsfm)
      // .then(() => {settingsService.saveSettings();})
      .then(() => console.log('USFM saved to settings successfully'))
      .catch(err => console.error('Error saving USFM to settings:', err));
    // At this point, close the MainApplication and return to the pre-launch screen
    onExit();
  };

  const handleSettings = () => {
    if (onShowSettings) onShowSettings();
  };

  // --- Template info/browse group ---
  // Access the template name from the global map object
  const templateName = mapDef.template || '(' + inLang(uiStr.noTemplate, lang) + ')'; // Export to data merge file handler
  const handleExportDataMerge = async () => {
    try {
      const result = await window.electronAPI.exportDataMerge({
        locations: locations,
        templateName: templateName,
        projectFolder: settingsService.getProjectFolder(),
      });

      if (result.success) {
        // Success - no alert needed as file was saved successfully
        console.log('Export successful:', result.message);
      } else if (result.canceled) {
        // User cancelled - no error message needed
        console.log('Export cancelled by user');
      } else {
        alert(`Export failed: ${result.error}`);
      }
    } catch (error) {
      console.error('Export error:', error);
      alert(`Export failed: ${error.message}`);
    }
  };

  // Only show the button row if in USFM view
  if (mapPaneView === USFM_VIEW) {
    return (
      <div>
        {/* Button Row */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
          <button onClick={onSwitchView} style={{ marginRight: 60, whiteSpace: 'nowrap' }}>
            {inLang(uiStr.switchView, lang)}
          </button>
          <button
            onClick={handleCancel}
            style={{ marginRight: 8, width: 80, whiteSpace: 'nowrap' }}
          >
            {inLang(uiStr.cancel, lang)}
          </button>
          <button onClick={handleOk} style={{ width: 80, whiteSpace: 'nowrap' }}>
            {inLang(uiStr.ok, lang)}
          </button>
          <button
            onClick={handleExportDataMerge}
            style={{
              marginLeft: 16,
              width: 40,
              height: 32,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: '#e3f2fd',
              border: '1px solid #1976d2',
              borderRadius: 4,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
            title={inLang(uiStr.export, lang)}
          >
            {/* Export icon: two stacked files with an arrow */}
            <svg
              width="22"
              height="22"
              viewBox="0 0 22 22"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <rect
                x="4"
                y="4"
                width="10"
                height="14"
                rx="2"
                fill="#fff"
                stroke="#1976d2"
                strokeWidth="1.2"
              />
              <rect
                x="8"
                y="2"
                width="10"
                height="14"
                rx="2"
                fill="#e3f2fd"
                stroke="#1976d2"
                strokeWidth="1.2"
              />
              <path
                d="M13 10v5m0 0l-2-2m2 2l2-2"
                stroke="#1976d2"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
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
              alignSelf: 'flex-start',
            }}
            aria-label="Settings"
          >
            <span role="img" aria-label="Settings">
              &#9881;
            </span>
          </button>
        </div>
      </div>
    );
  }
  // Use the status from the location object which is already calculated in App.js
  // This is more reliable than recalculating it here
  const status = locations[selLocation]?.status || 0;
  const collectionId = getCollectionIdFromTemplate(mapDef.template);
  let transliteration = collectionManager.getTransliteration(
    locations[selLocation]?.mergeKey,
    collectionId
  );
  if (transliteration) {
    transliteration = ` /${transliteration}/`;
  }

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
            <svg
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M10 2C6.686 2 4 4.686 4 8c0 3.314 4.09 8.36 5.29 9.79a1 1 0 0 0 1.42 0C11.91 16.36 16 11.314 16 8c0-3.314-2.686-6-6-6zm0 8.5A2.5 2.5 0 1 1 10 5a2.5 2.5 0 0 1 0 5.5z"
                fill="#2196f3"
                stroke="#1976d2"
                strokeWidth="1.2"
              />
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
            <svg
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <rect
                x="2"
                y="4"
                width="16"
                height="12"
                fill="#90caf9"
                stroke="#1976d2"
                strokeWidth="1.5"
              />
              <line x1="2" y1="8" x2="18" y2="8" stroke="#1976d2" strokeWidth="1.5" />
              <line x1="2" y1="12" x2="18" y2="12" stroke="#1976d2" strokeWidth="1.5" />
              <line x1="7" y1="4" x2="7" y2="16" stroke="#1976d2" strokeWidth="1.5" />
              <line x1="13" y1="4" x2="13" y2="16" stroke="#1976d2" strokeWidth="1.5" />
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
            <svg
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <rect
                x="4"
                y="3"
                width="12"
                height="14"
                rx="2"
                fill="#fffde7"
                stroke="#1976d2"
                strokeWidth="1.5"
              />
              <line x1="6" y1="7" x2="14" y2="7" stroke="#1976d2" strokeWidth="1.2" />
              <line x1="6" y1="10" x2="14" y2="10" stroke="#1976d2" strokeWidth="1.2" />
              <line x1="6" y1="13" x2="12" y2="13" stroke="#1976d2" strokeWidth="1.2" />
            </svg>
          </button>
          <button
            onClick={handleCancel}
            style={{
              marginRight: 8,
              height: 32,
              minWidth: 60,
              whiteSpace: 'nowrap',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {inLang(uiStr.cancel, lang)}
          </button>
          <button
            onClick={handleOk}
            style={{
              height: 32,
              minWidth: 60,
              whiteSpace: 'nowrap',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {inLang(uiStr.ok, lang)}
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
              alignSelf: 'flex-start',
            }}
            title={inLang(uiStr.settings, lang)}
          >
            <span role="img" aria-label="Settings">
              &#9881;
            </span>
          </button>
        </div>
      )}

      {/* Template info/browse group */}      <div
        className="details-group-frame"
        style={{
          border: '1px solid #ccc',
          borderRadius: 6,
          marginBottom: 16,
          padding: 8,
          background: '#f9f9f9',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
          <span style={{ fontWeight: 'bold', color: 'black', fontSize: '0.8em' }}>
            {templateName}
          </span>
          {mapDef.variants && Object.keys(mapDef.variants).length > 0 && (
            <select
              id="variant-select"
              value={selectedVariant}
              onChange={e => onVariantChange(parseInt(e.target.value))}
              style={{ fontSize: '0.8em', padding: '2px 4px', width: 'fit-content' }}
            >
              {Object.entries(mapDef.variants).map(([id, variant]) => (
                <option key={id} value={parseInt(id)}>
                  {inLang(variant.variantName, lang)}
                </option>
              ))}
            </select>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        <button
          title={inLang(uiStr.templateInfo, lang)}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
            marginLeft: 1,
          }}
          onClick={() => setShowTemplateInfo(true)}
        >
          <span role="img" aria-label="info" style={{ fontSize: '1.2em', color: '#6cf' }}>
            ℹ️
          </span>
        </button>
        <button
          title={inLang(uiStr.browseTemplate, lang)}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
            marginLeft: 1,
          }}
          onClick={onBrowseMapTemplate}
        >
          <span role="img" aria-label="browse" style={{ fontSize: '1.2em', color: '#fc6' }}>
            📂
          </span>
        </button>
        <button
          onClick={handleExportDataMerge}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
            marginLeft: 1,
          }}
          title={inLang(uiStr.export, lang)}
        >
          {/* Export icon: two stacked files with a down arrow */}
          <svg
            width="22"
            height="22"
            viewBox="0 0 22 22"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <rect
              x="4"
              y="4"
              width="10"
              height="14"
              rx="2"
              fill="#fff"
              stroke="#1976d2"
              strokeWidth="1.2"
            />
            <rect
              x="8"
              y="2"
              width="10"
              height="14"
              rx="2"
              fill="#e3f2fd"
              stroke="#1976d2"
              strokeWidth="1.2"
            />
            <path
              d="M13 10v5m0 0l-2-2m2 2l2-2"
              stroke="#1976d2"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />          </svg>
        </button>
        </div>
      </div>

      {/* Modal dialog for template info */}
      {showTemplateInfo && (
        <div
          style={{
            position: 'fixed',
            left: 0,
            top: 0,
            width: '100vw',
            height: '100vh',
            zIndex: 1000,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              background: 'white',
              borderRadius: 10,
              padding: 24,
              minWidth: 520,
              maxWidth: 900,
              boxShadow: '0 4px 24px #0008',
              position: 'relative',
            }}
          >
            <button
              onClick={() => setShowTemplateInfo(false)}
              style={{
                position: 'absolute',
                top: 8,
                right: 12,
                background: 'none',
                border: 'none',
                fontSize: 22,
                cursor: 'pointer',
                color: '#888',
              }}
              title={inLang(uiStr.close, lang)}
            >
              ×
            </button>
            <h4 style={{ marginTop: 0 }}>{templateName}</h4>
            {inLang(templateData.title, lang) && (
              <p style={{ margin: '8px 0', fontWeight: 'bold', fontStyle: 'italic' }}>
                {inLang(templateData.title, lang)}
              </p>
            )}
            {inLang(templateData.description, lang) && (
              <p style={{ margin: '8px 0' }}>{inLang(templateData.description, lang)}</p>
            )}
            {templateData.mapTypes && (
              <div style={{ margin: '8px 0' }}>
                <b>{inLang(uiStr.baseLayerTypes, lang)}:</b> {templateData.mapTypes}
              </div>
            )}
            {templateData.formats && (
              <div style={{ margin: '8px 0' }}>
                <b>{inLang(uiStr.fileFormats, lang)}:</b> {templateData.formats}
              </div>
            )}
            {templateData.owner && (
              <div style={{ margin: '8px 0' }}>
                <b>{inLang(uiStr.owner, lang)}:</b> {templateData.owner}
              </div>
            )}
            {templateData.ownerRules && (
              <div style={{ margin: '8px 0' }}>
                <b>{inLang(uiStr.usageRules, lang)}:</b>{' '}
                <a href={templateData.ownerRules} target="_blank" rel="noopener noreferrer">
                  {templateData.ownerRules}
                </a>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Status Tally Table */}
      <div
        style={{
          border: '1px solid #ccc',
          borderRadius: 6,
          marginBottom: 16,
          padding: 8,
          background: '#f9f9f9',
          fontSize: '0.8em',
        }}
      >
        <table>
          <tbody>
            {Object.entries(statusTallies)
              .sort((a, b) => statusValue[a[0]].sort - statusValue[b[0]].sort)
              .map(([status, count]) => (
                <tr key={status}>
                  <td style={{ fontWeight: 'bold', padding: '2px 8px', textAlign: 'right' }}>
                    {count}
                  </td>
                  <td style={{}}>
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
              ))}
          </tbody>
        </table>
      </div>
      <div
        style={{
          border: '1px solid #ccc',
          borderRadius: 6,
          marginBottom: 16,
          padding: 8,
          background: '#f9f9f9',
        }}
      >
        <h2>{inLang(locations[selLocation]?.gloss, lang)}</h2>{' '}
        <p>
          <span style={{ fontStyle: 'italic' }}>
            ({locations[selLocation]?.termId}){' '}
            <span style={{ display: 'inline-block', width: 12 }} />
            {transliteration}
          </span>
          <br />
          {inLang(
            collectionManager.getDefinition(locations[selLocation]?.mergeKey, collectionId),
            lang
          )}
        </p>
        <div
          className="vernacularGroup"
          style={{
            backgroundColor: statusValue[status].bkColor,
            margin: '8px',
            padding: '8px',
            border: '1px solid black',
            borderRadius: '0.7em',
          }}
        >
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
          <span style={{ color: statusValue[status].textColor, fontSize: '0.8em' }}>
            <span style={{ fontWeight: 'bold' }}>
              {inLang(uiStr.statusValue[status].text, lang) + ': '}
            </span>
            {inLang(uiStr.statusValue[status].help, lang)}
            {status === STATUS_NO_RENDERINGS && ( // If status is "no renderings", show Add to renderings button
              <button style={{ marginLeft: 8 }} onClick={() => onCreateRendering(vernacular)}>
                {inLang(uiStr.addToRenderings, lang)}
              </button>
            )}
            {status === STATUS_GUESSED && ( // If status is "guessed", show Approve rendering button
              <button
                style={{ marginLeft: 8 }}
                onClick={() => {
                  const termId = locations[selLocation].termId;

                  // Update local state
                  setLocalIsApproved(true);

                  // Create a proper updated termRenderings object
                  const updatedData = { ...termRenderings };
                  updatedData[termId] = {
                    ...updatedData[termId],
                    isGuessed: false,
                  };

                  // Update state via parent component handlers
                  setTermRenderings(updatedData);
                  onApprovedChange({ target: { checked: true } });
                }}
              >
                {inLang(uiStr.approveRendering, lang)}
              </button>
            )}
          </span>
        </div>
        <h5>
          {inLang(uiStr.termRenderings, lang)}{' '}
          {localRenderings && !localIsApproved ? '(' + inLang(uiStr.guessed, lang) + ')' : ''}
        </h5>
        <div className="term-renderings" style={{ margin: '8px' }}>
          {' '}
          <textarea
            ref={renderingsTextareaRef}
            value={localRenderings}
            onChange={e => {
              const termId = locations[selLocation].termId;
              const newValue = e.target.value;

              // Update local state
              setLocalRenderings(newValue);

              // Create updated renderings data
              const updatedData = { ...termRenderings };

              // Create entry if it doesn't exist
              if (!updatedData[termId]) {
                updatedData[termId] = { renderings: newValue };
              } else {
                updatedData[termId] = {
                  ...updatedData[termId],
                  renderings: newValue,
                };
              }

              // If not approved, auto-approve on edit
              if (!localIsApproved) {
                setLocalIsApproved(true);
                updatedData[termId].isGuessed = false;
                onApprovedChange({ target: { checked: true } });
              }

              // Update parent state
              setTermRenderings(updatedData);
              onRenderingsChange({ target: { value: newValue } });
            }}
            style={{
              width: '100%',
              minHeight: '100px',
              border: '1px solid black',
              borderRadius: '0.5em',
              padding: '8px',
              fontSize: '12px',
              backgroundColor: localRenderings && !localIsApproved ? '#ffbf8f' : 'white',
            }}
            placeholder={inLang(uiStr.enterRenderings, lang)}
            spellCheck={false}
          />
        </div>
      </div>
    </div>
  );
}
