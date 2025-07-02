import React, { useState, useEffect, useMemo, useRef } from 'react';
import './MainApp.css';
import uiStr from './data/ui-strings.json';
import {
  MAP_VIEW,
  TABLE_VIEW,
  USFM_VIEW,
  STATUS_NO_RENDERINGS,
  STATUS_GUESSED,
  STATUS_RENDERING_SHORT,
  STATUS_MULTIPLE_RENDERINGS,
  STATUS_UNMATCHED,
} from './constants.js';
import { collectionManager, getCollectionIdFromTemplate } from './CollectionManager';
import { getMapDef } from './MapData';
import { inLang, statusValue, getMapForm, wordMatchesRenderings } from './Utils.js';
import { settingsService } from './services/SettingsService.js';
import { AutocorrectTextarea } from './components/AutocorrectTextarea';
import { useAutocorrect } from './hooks/useAutocorrect';

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
  const [localIsApproved, setLocalIsApproved] = useState(isApproved);
  const [localRenderings, setLocalRenderings] = useState(renderings);
  const [showTemplateInfo, setShowTemplateInfo] = useState(false);
  const [templateData, setTemplateData] = useState({});
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [selectedExportFormat, setSelectedExportFormat] = useState('idml');

  // Load template data when mapDef.template changes
  useEffect(() => {
    const loadTemplateData = async () => {
      if (!mapDef.template) {
        setTemplateData({});
        return;
      }

      try {
        console.log(`Loading template data for: ${mapDef.template}`);
        const collectionId = getCollectionIdFromTemplate(mapDef.template);
        const data = await getMapDef(mapDef.template, collectionId);
        setTemplateData({ ...data, templateName: mapDef.template });
      } catch (error) {
        console.error(`Error loading template data for ${mapDef.template}:`, error);
        setTemplateData({ templateName: mapDef.template });
      }
    };

    loadTemplateData();
  }, [mapDef.template]);

  // Simplified vernacular state management for debugging
  // const [localVernacular, setLocalVernacular] = useState(locations[selLocation]?.vernLabel || '');

  // Re-enable autocorrect hook for vernacular input
  const {
    value: vernacularValue,
    setValue: setVernacularValue,
    handleChange: handleVernacularChange,
    textareaRef: vernacularAutocorrectRef,
  } = useAutocorrect(locations[selLocation]?.vernLabel || '', text => {
    // console.log('DetailsPane: Vernacular changing to', text);
    onUpdateVernacular(locations[selLocation].termId, text);
  });

  // const vernacularAutocorrectRef = useRef(null);

  const prevSelLocationRef = useRef(selLocation);
  
  // Forward the ref from useAutocorrect to the external vernacularInputRef
  useEffect(() => {
    if (vernacularInputRef && vernacularAutocorrectRef.current) {
      vernacularInputRef.current = vernacularAutocorrectRef.current;
    }
  }, [vernacularInputRef, vernacularAutocorrectRef]);
  
  useEffect(() => {
    // Sync local vernacular when selection changes
    const newVernacular = locations[selLocation]?.vernLabel || '';
    setVernacularValue(newVernacular);
    setLocalIsApproved(isApproved);
    setLocalRenderings(renderings);
  }, [selLocation, isApproved, renderings, locations, setVernacularValue]);

  useEffect(() => {
    // Only focus when selLocation actually changes and we're in MAP_VIEW
    if (prevSelLocationRef.current !== selLocation && mapPaneView === MAP_VIEW) {
      prevSelLocationRef.current = selLocation;
      if (vernacularAutocorrectRef && vernacularAutocorrectRef.current) {
        console.log('Focusing vernacular input for location:', selLocation);
        vernacularAutocorrectRef.current.focus();
      }
    } else if (prevSelLocationRef.current !== selLocation) {
      prevSelLocationRef.current = selLocation;
    }
  }, [selLocation, mapPaneView, vernacularAutocorrectRef]);

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

  const onAddMapForm = () => {
    // This function is called when the user clicks the "Add Map" button
    // Append the contents of the vernacular input to the renderings textarea
    if (vernacularAutocorrectRef && vernacularAutocorrectRef.current) {
      const vernacularText = vernacularValue.trim();
      // Append the vernacular text to the renderings textarea
      if (renderingsTextareaRef && renderingsTextareaRef.current) {
        const currentRenderings = renderingsTextareaRef.current.value
          .split('\n')
          .map(line => line.trim())
          .filter(line => line.length > 0)
          .join('\n');
        console.log(`Current renderings: "${currentRenderings}"`);

        const whichRendering = wordMatchesRenderings(vernacularText, currentRenderings, false);
        console.log(`Matched rendering index: ${whichRendering}`);
        const mapForm = ` (@${vernacularText})`;
        try {
          // insert mapForm into renderingsTextareaRef.current.value at the end of the rendering whose 1-based index is whichRendering
          const lines = currentRenderings.split('\n');
          lines[whichRendering - 1] += mapForm;
          renderingsTextareaRef.current.value = lines.join('\n');
        } catch (e) {
          renderingsTextareaRef.current.value = currentRenderings + mapForm;
        }
        onRenderingsChange({ target: { value: renderingsTextareaRef.current.value } });
      }
    }
  };

  const onRefreshLabel = () => {
    // This function is called when the user clicks the "Refresh Labels" button.
    // Update the vernacular input using getMapForm
    if (selLocation >= 0 && selLocation < locations.length) {
      const currentLocation = locations[selLocation];
      const altTermIds = collectionManager.getAltTermIds(currentLocation?.mergeKey, getCollectionIdFromTemplate(mapDef.template));
      const mapForm = getMapForm(termRenderings, currentLocation.termId, altTermIds);
      console.log('Refreshing label for location:', currentLocation.mergeKey, 'Map form:', mapForm);
      setVernacularValue(mapForm);
      onUpdateVernacular(currentLocation.termId, mapForm);
    }
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
    // console.log('OK! Generated USFM:', currentUsfm);
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
  const templateName = mapDef.template || '(' + inLang(uiStr.noTemplate, lang) + ')';

  // Export to data merge file handler
  const handleExportDataMerge = async () => {
    let outputFormat = templateData.formats;
    console.log('Exporting data merge with format:', outputFormat);
    if (outputFormat.includes('mapx')) {  // Even a mapx-only template can be exported to idml.txt so that it can be reloaded here later.
      // Prompt user to select output format. Return if user cancels.
      console.log('Prompting user to select export format');
      setShowExportDialog(true);
      return; // Exit here, the dialog will handle the rest
    }

    // Use the helper function for direct export
    await handleExportWithFormat(outputFormat);
  };
  // Handle export after format selection
  const handleExportWithFormat = async format => {
    try {
      // Prepare locations with mapxKey computed for each location
      const locationsWithMapxKey = locations.map(location => {
        const mapxKey = collectionManager.getMapxKey(location.mergeKey, collectionId);
        return {
          ...location,
          mapxKey: mapxKey,
          vernLabel: location.vernLabel.replace(/[❪{]/g, '(').replace(/[❫}]/g, ')'), // Replace { and } with ( and )
        };
      });

      const result = await window.electronAPI.exportDataMerge({
        locations: locationsWithMapxKey,
        templateName: templateName,
        format: format,
        projectFolder: settingsService.getProjectFolder(),
      });

      if (result.success || result.canceled) {
        console.log('Export successful or cancelled:', result.message);
      } else {
        // Show error message
        alert(inLang(uiStr.exportCancelled, lang) + (result.message ? ': ' + result.message : ''));
      }
    } catch (error) {
      console.error('Export error:', error);
      alert(inLang(uiStr.notExported, lang) + (error.message ? ': ' + error.message : ''));
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
      {/* Template info/browse group */}{' '}
      <div
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
              />{' '}
            </svg>
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
            )}{' '}
          </div>
        </div>
      )}
      {/* Modal dialog for export format selection */}
      {showExportDialog && (
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
              minWidth: 400,
              maxWidth: 500,
              boxShadow: '0 4px 24px #0008',
              position: 'relative',
            }}
          >
            <h4 style={{ marginTop: 0 }}>{inLang(uiStr.exportToDataMergeFile, lang)}</h4>
            <div style={{ marginBottom: 16 }}>
              <p style={{ marginBottom: 12 }}>{inLang(uiStr.selectOutputFormat, lang)}</p>
              <label style={{ display: 'block', marginBottom: 8, cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="exportFormat"
                  value="idml"
                  checked={selectedExportFormat === 'idml'}
                  onChange={e => setSelectedExportFormat(e.target.value)}
                  style={{ marginRight: 8 }}
                />
                InDesign (IDML)
              </label>
              <label style={{ display: 'block', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="exportFormat"
                  value="mapx"
                  checked={selectedExportFormat === 'mapx'}
                  onChange={e => setSelectedExportFormat(e.target.value)}
                  style={{ marginRight: 8 }}
                />
                Map Creator (MAPX)
              </label>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                onClick={() => setShowExportDialog(false)}
                style={{
                  padding: '8px 16px',
                  borderRadius: 4,
                  border: '1px solid #ccc',
                  background: '#f5f5f5',
                  cursor: 'pointer',
                }}
              >
                {inLang(uiStr.cancel, lang)}
              </button>
              <button
                onClick={async () => {
                  setShowExportDialog(false);
                  await handleExportWithFormat(selectedExportFormat);
                }}
                style={{
                  padding: '8px 16px',
                  borderRadius: 4,
                  border: '1px solid #1976d2',
                  background: '#1976d2',
                  color: 'white',
                  cursor: 'pointer',
                }}
              >
                {inLang(uiStr.ok, lang)}
              </button>
            </div>
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
          {' '}
          <textarea
            ref={vernacularAutocorrectRef}
            value={vernacularValue}
            onChange={handleVernacularChange}
            onKeyDown={e => {
              // Prevent line breaks but allow other keys
              if (e.key === 'Enter') {
                e.preventDefault();
              }
              // console.log('Vernacular textarea KEYDOWN:', e.key);
            }}
            placeholder={inLang(uiStr.enterLabel, lang)}
            className="form-control mb-2"
            style={{
              width: '100%',
              border: '1px solid black',
              minHeight: '32px',
              resize: 'vertical',
              whiteSpace: 'pre-wrap',
              overflowWrap: 'break-word',
              fontFamily: 'inherit',
              fontSize: 'inherit',
            }}
            spellCheck={false}
            rows={1}
          />{' '}
          <span
            style={{
              color: statusValue[status].textColor,
              fontSize: '0.8em',
              lineHeight: '1.2',
              display: 'block',
              marginTop: '4px',
            }}
          >
            <span style={{ fontWeight: 'bold' }}>
              {inLang(uiStr.statusValue[status].text, lang) + ': '}
            </span>
            {inLang(uiStr.statusValue[status].help, lang)}
            {(status === STATUS_RENDERING_SHORT || status === STATUS_MULTIPLE_RENDERINGS) && ( // If status is "short", show Add Map Form button
              <button style={{ marginLeft: 8 }} onClick={() => onAddMapForm()}>
                {inLang(uiStr.addMapForm, lang)}
              </button>
            )}
            {status === STATUS_UNMATCHED && (
              <button style={{ marginLeft: 8 }} onClick={() => onRefreshLabel()}>
                {inLang(uiStr.refreshLabel, lang)}
              </button>
            )}
            {status === STATUS_NO_RENDERINGS && ( // If status is "no renderings", show Add to renderings button
              <button style={{ marginLeft: 8 }} onClick={() => onCreateRendering(vernacularValue || '')}>
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
          <AutocorrectTextarea
            ref={renderingsTextareaRef}
            value={localRenderings}
            onChange={e => {
              console.log('Renderings onChange called with:', e.target.value);
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
