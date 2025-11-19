import React, { useState, useEffect, useMemo, useRef } from 'react';
import './MainApp.css';
import uiStr from './data/ui-strings.json';
import {
  MAP_VIEW,
  TABLE_VIEW,
  USFM_VIEW,
  STATUS_NO_RENDERINGS,
  STATUS_GUESSED,
  STATUS_MULTIPLE_RENDERINGS,
  STATUS_UNMATCHED,
} from './constants.js';
import { collectionManager, getCollectionIdFromTemplate, findCollectionIdAndTemplate } from './CollectionManager';
import { getMapDef } from './MapData';
import { inLang, statusValue, getMapForm, wordMatchesRenderings } from './Utils.js';
import { settingsService } from './services/SettingsService.js';
import labelDictionaryService from './services/LabelDictionaryService.js';
import { AutocorrectTextarea } from './components/AutocorrectTextarea';
import { useAutocorrect } from './hooks/useAutocorrect';

export default function DetailsPane({
  selectedLabelIndex,
  onUpdateVernacular,
  onNextLabel,
  renderings,
  isApproved,
  onRenderingsChange,
  onApprovedChange,
  termRenderings,
  labels,
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
  mapxPath,
  idmlPath,
  hasUnsavedChanges = false,
  onSaveLabels,
  onRevertLabels,
  templateGroup = null,
  templateGroupIndex = -1,
  onPreviousTemplate,
  onNextTemplate,
  activeTab = 0,
  onActiveTabChange,
}) {
  const [localIsApproved, setLocalIsApproved] = useState(isApproved);
  const [localRenderings, setLocalRenderings] = useState(renderings);
  const [showTemplateInfo, setShowTemplateInfo] = useState(false);
  const [templateData, setTemplateData] = useState({});
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [selectedExportFormat, setSelectedExportFormat] = useState('idml-full');
  const [lastUsedExportFormat, setLastUsedExportFormat] = useState(null);

  // Set export format based on last-used or precedence order when dialog opens
  useEffect(() => {
    if (!showExportDialog) return;
    
    // Determine available options
    const availableFormats = [];
    if (idmlPath) availableFormats.push('idml-full');
    if (mapxPath) availableFormats.push('mapx-full');
    if (templateData.formats && templateData.formats.includes('mapx')) availableFormats.push('mapx-txt');
    
    // If last-used format is available, use it
    if (lastUsedExportFormat && availableFormats.includes(lastUsedExportFormat)) {
      setSelectedExportFormat(lastUsedExportFormat);
    } else {
      // Otherwise, use precedence order: idml-full > mapx-full > mapx-txt
      if (availableFormats.length > 0) {
        setSelectedExportFormat(availableFormats[0]);
      } else {
        setSelectedExportFormat(null);
      }
    }
  }, [showExportDialog, mapxPath, idmlPath, templateData.formats, lastUsedExportFormat]);

  // Load template data when mapDef.template changes
  useEffect(() => {
    const loadTemplateData = async () => {
      if (!mapDef.template) {
        setTemplateData({});
        return;
      }

      try {
        console.log(`Loading template data for: ${mapDef.template}`);
        const [collectionId, templateName] = findCollectionIdAndTemplate(mapDef.template);
        const data = await getMapDef(templateName, collectionId);
        setTemplateData({ ...data, templateName });
      } catch (error) {
        console.error(`Error loading template data for ${mapDef.template}:`, error);
        setTemplateData({ templateName: mapDef.template });
      }
    };

    loadTemplateData();
  }, [mapDef.template]);

  // Simplified vernacular state management for debugging
  // const [localVernacular, setLocalVernacular] = useState(labels[selectedLabelIndex]?.vernLabel || '');

  // Re-enable autocorrect hook for vernacular input
  const {
    value: vernacularValue,
    setValue: setVernacularValue,
    handleChange: handleVernacularChange,
    textareaRef: vernacularAutocorrectRef,
  } = useAutocorrect(labels[selectedLabelIndex]?.vernLabel || '', text => {
    // console.log('DetailsPane: Vernacular changing to', text);
    const currentLabel = labels[selectedLabelIndex];
    onUpdateVernacular(
      currentLabel.mergeKey, 
      currentLabel.lblTemplate || currentLabel.mergeKey, 
      text,
      currentLabel.opCode || 'sync'
    );
  });

  // const vernacularAutocorrectRef = useRef(null);

  const prevSelectedLabelRef = useRef(selectedLabelIndex);
  
  // Forward the ref from useAutocorrect to the external vernacularInputRef
  useEffect(() => {
    if (vernacularInputRef && vernacularAutocorrectRef.current) {
      vernacularInputRef.current = vernacularAutocorrectRef.current;
    }
  }, [vernacularInputRef, vernacularAutocorrectRef]);
  
  useEffect(() => {
    // Sync local vernacular when selection changes
    const newVernacular = labels[selectedLabelIndex]?.vernLabel || '';
    setVernacularValue(newVernacular);
    setLocalIsApproved(isApproved);
    setLocalRenderings(renderings);
  }, [selectedLabelIndex, isApproved, renderings, labels, setVernacularValue]);

  useEffect(() => {
    // Only focus when selectedLabelIndex actually changes and we're in MAP_VIEW
    if (prevSelectedLabelRef.current !== selectedLabelIndex && mapPaneView === MAP_VIEW) {
      prevSelectedLabelRef.current = selectedLabelIndex;
      if (vernacularAutocorrectRef && vernacularAutocorrectRef.current) {
        console.log('Focusing vernacular input for label:', selectedLabelIndex);
        vernacularAutocorrectRef.current.focus();
      }
    } else if (prevSelectedLabelRef.current !== selectedLabelIndex) {
      prevSelectedLabelRef.current = selectedLabelIndex;
    }
  }, [selectedLabelIndex, mapPaneView, vernacularAutocorrectRef]);

  // Use the status from the label object which is already calculated in App.js
  // This is more reliable than recalculating it here
  const status = labels[selectedLabelIndex]?.status || 0;
  const collectionId = getCollectionIdFromTemplate(mapDef.template);
  let transliteration = collectionManager.getTransliteration(
    labels[selectedLabelIndex]?.mergeKey,
    collectionId
  );
  if (transliteration) {
    transliteration = ` /${transliteration}/`;
  }

  // Tally status counts for all labels
  const statusTallies = useMemo(() => {
    const tally = {};
    if (labels && labels.length > 0) {
      labels.forEach(label => {
        // Use the status already stored in the label object
        const status = label.status || 0;
        if (!tally[status]) tally[status] = 0;
        tally[status]++;
      });
    }
    return tally;
  }, [labels]);

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
    // Update the vernacular input using resolved template or getMapForm
    if (selectedLabelIndex >= 0 && selectedLabelIndex < labels.length) {
      const currentLabel = labels[selectedLabelIndex];
      const collectionId = getCollectionIdFromTemplate(mapDef.template);
      
      // Try to resolve template first
      let mapForm = '';
      if (currentLabel.lblTemplate) {
        mapForm = collectionManager.resolveTemplate(currentLabel.lblTemplate, collectionId, termRenderings) || '';
      }
      
      // Fallback to old method if needed
      if (!mapForm) {
        const altTermIds = collectionManager.getAltTermIds(currentLabel?.mergeKey, collectionId);
        mapForm = getMapForm(termRenderings, currentLabel.termId, altTermIds);
      }
      
      console.log('Refreshing label:', currentLabel.mergeKey, 'Map form:', mapForm);
      setVernacularValue(mapForm);
      onUpdateVernacular(
        currentLabel.mergeKey, 
        currentLabel.lblTemplate || currentLabel.mergeKey, 
        mapForm,
        currentLabel.opCode || 'sync'
      );
    }
  };

  // Helper function to generate USFM from the current map state
  // USFM now only contains the \fig field - labels are stored in .idml.txt files
  const generateUsfm = () => {
    console.log('Converting map to USFM (only \\fig field):', mapDef);
    // Only return the \fig...\fig* field
    let usfm = '';
    if (mapDef.fig && !/^\\fig/.test(mapDef.fig)) {
      usfm = `\\fig ${mapDef.fig}\\fig*`;
    } else if (mapDef.fig) {
      usfm = mapDef.fig;
    }
    return usfm;
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
    // Always show the export dialog to let users see all available options
    console.log('Opening export dialog');
    setShowExportDialog(true);
  };
  // Handle export after format selection
  const handleExportWithFormat = async format => {
    try {
      // Prepare labels with mapxKey computed for each label
      const labelsWithMapxKey = labels.map(label => {
        const mapxKey = collectionManager.getMapxKey(label.mergeKey, collectionId);
        return {
          ...label,
          mapxKey: mapxKey,
          vernLabel: label.vernLabel.replace(/[❪{]/g, '(').replace(/[❫}]/g, ')'), // Replace { and } with ( and )
        };
      });

      const result = await window.electronAPI.exportDataMerge({
        labels: labelsWithMapxKey,
        templateName: templateName,
        format: format,
        projectFolder: settingsService.getProjectFolder(),
        mapxPath: mapxPath,
        idmlPath: idmlPath,
        language: settingsService.getLanguage(),
        languageCode: settingsService.getLanguageCode(),
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
              marginRight: 32,
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
          {templateGroupIndex >= 0 && (
            <>
              <button
                onClick={onPreviousTemplate}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0,
                  marginLeft: 1,
                }}
                title={inLang(uiStr.previousTemplate, lang)}
              >
                <span style={{ fontSize: '1.2em', color: '#4a90e2' }}>
                  ◀
                </span>
              </button>
              <button
                onClick={onNextTemplate}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0,
                  marginLeft: 1,
                }}
                title={inLang(uiStr.nextTemplate, lang)}
              >
                <span style={{ fontSize: '1.2em', color: '#4a90e2' }}>
                  ▶
                </span>
              </button>
            </>
          )}
          <button
            onClick={onRevertLabels}
            disabled={!hasUnsavedChanges}
            style={{
              background: 'none',
              border: 'none',
              cursor: hasUnsavedChanges ? 'pointer' : 'not-allowed',
              padding: 0,
              marginLeft: 1,
              opacity: hasUnsavedChanges ? 1 : 0.3,
            }}
            title={inLang(uiStr.revertChanges, lang)}
          >
            {/* Revert icon: curved arrow going left */}
            <svg
              width="22"
              height="22"
              viewBox="0 0 22 22"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M8 11h8M8 11l3 3m-3-3l3-3M16 11a5 5 0 1 1-5-5"
                stroke={hasUnsavedChanges ? '#ff9800' : '#999'}
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <button
            onClick={onSaveLabels}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
              marginLeft: 1,
              opacity: 1,
            }}
            title={inLang(uiStr.saveChanges, lang)}
          >
            {/* Save icon: floppy disk */}
            <svg
              width="22"
              height="22"
              viewBox="0 0 22 22"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <rect
                x="4"
                y="3"
                width="14"
                height="16"
                rx="2"
                stroke={hasUnsavedChanges ? '#4caf50' : 'rgba(15, 72, 15, 1)'}
                strokeWidth="1.5"
                fill="none"
              />
              <rect
                x="7"
                y="3"
                width="8"
                height="5"
                fill={hasUnsavedChanges ? '#4caf50' : 'rgba(15, 72, 15, 1)'}
              />
              <rect
                x="6"
                y="12"
                width="10"
                height="7"
                fill="none"
                stroke={hasUnsavedChanges ? '#4caf50' : 'rgba(15, 72, 15, 1)'}
                strokeWidth="1.2"
              />
            </svg>
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
            <h4 style={{ marginTop: 0 }}>{inLang(uiStr.export, lang)}</h4>
            <div style={{ marginBottom: 16 }}>
              <p style={{ marginBottom: 12 }}>{inLang(uiStr.selectOutputFormat, lang)}</p>
              
              {/* IDML Full Export */}
              {idmlPath ? (
                <label style={{ display: 'block', marginBottom: 8, cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="exportFormat"
                    value="idml-full"
                    checked={selectedExportFormat === 'idml-full'}
                    onChange={e => setSelectedExportFormat(e.target.value)}
                    style={{ marginRight: 8 }}
                  />
                  InDesign file (.IDML)
                </label>
              ) : (
                <div style={{ 
                  display: 'block', 
                  marginLeft: 28, 
                  marginBottom: 8,
                  padding: '8px 12px',
                  backgroundColor: '#f8f9fa',
                  border: '1px solid #dee2e6',
                  borderRadius: '4px',
                  fontSize: '0.9em',
                  color: '#6c757d'
                }}>
                  {!templateData.formats || !templateData.formats.includes('idml') ? (
                    <span>This diagram is currently only available in MAPX format.</span>
                  ) : (
                    <span>
                      <b>IDML master file</b> not found.<br />
                      Specify the folder in ⚙️ Settings.
                    </span>
                  )}
                </div>
              )}
              
              {/* MAPX Full Export */}
              {mapxPath ? (
                <label style={{ display: 'block', marginBottom: 8, cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="exportFormat"
                    value="mapx-full"
                    checked={selectedExportFormat === 'mapx-full'}
                    onChange={e => setSelectedExportFormat(e.target.value)}
                    style={{ marginRight: 8 }}
                  />
                  Map Creator file (.MAPX)
                </label>
              ) : (
                <div style={{ 
                  display: 'block', 
                  marginLeft: 28, 
                  marginBottom: 8,
                  padding: '8px 12px',
                  backgroundColor: '#f8f9fa',
                  border: '1px solid #dee2e6',
                  borderRadius: '4px',
                  fontSize: '0.9em',
                  color: '#6c757d'
                }}>
                  {!templateData.formats || !templateData.formats.includes('mapx') ? (
                    <span>This diagram is currently only available in IDML format.</span>
                  ) : (
                    <span>
                      <b>MAPX master file</b> not found.<br />
                      Specify the folder in ⚙️ Settings.
                    </span>
                  )}
                </div>
              )}
              
              {/* MAPX Data Merge Export */}
              {templateData.formats && templateData.formats.includes('mapx') ? (
                <label style={{ display: 'block', marginBottom: 8, cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="exportFormat"
                    value="mapx-txt"
                    checked={selectedExportFormat === 'mapx-txt'}
                    onChange={e => setSelectedExportFormat(e.target.value)}
                    style={{ marginRight: 8 }}
                  />
                  Map Creator data merge file (.MAPX.TXT)
                </label>
              ) : null}
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
                  if (!selectedExportFormat) return;
                  setLastUsedExportFormat(selectedExportFormat);
                  setShowExportDialog(false);
                  await handleExportWithFormat(selectedExportFormat);
                }}
                disabled={!selectedExportFormat}
                style={{
                  padding: '8px 16px',
                  borderRadius: 4,
                  border: selectedExportFormat ? '1px solid #1976d2' : '1px solid #ccc',
                  background: selectedExportFormat ? '#1976d2' : '#e0e0e0',
                  color: selectedExportFormat ? 'white' : '#999',
                  cursor: selectedExportFormat ? 'pointer' : 'not-allowed',
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
                  <td style={{ paddingLeft: '8px' }}>
                    {status === STATUS_GUESSED.toString() && (
                      <button
                        onClick={() => {
                          // Find all labels with guessed status and approve them
                          const updatedData = { ...termRenderings };
                          let hasChanges = false;

                          labels.forEach(label => {
                            if (label.status === STATUS_GUESSED) {
                              const termId = label.termId;
                              if (updatedData[termId]) {
                                updatedData[termId] = {
                                  ...updatedData[termId],
                                  isGuessed: false,
                                };
                                hasChanges = true;
                              }
                            }
                          });

                          if (hasChanges) {
                            setTermRenderings(updatedData);
                            // If currently viewing a guessed item, update local state
                            if (labels[selectedLabelIndex]?.status === STATUS_GUESSED) {
                              setLocalIsApproved(true);
                            }
                          }
                        }}
                        style={{
                          padding: '2px 8px',
                          fontSize: '0.9em',
                          borderRadius: '4px',
                          border: '1px solid #4caf50',
                          background: '#e8f5e9',
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {inLang(uiStr.approveAll, lang)}
                      </button>
                    )}
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
        {/* Large gloss from mergekeys or placenames */}
        <h2 style={{ margin: '8px', marginBottom: 4 }}>
          {inLang(labels[selectedLabelIndex]?.gloss || { en: labels[selectedLabelIndex]?.mergeKey || '' }, lang)}
        </h2>
        {/* Smaller context/definition */}
        <p style={{ margin: '8px', marginTop: 4, fontSize: '0.9em', color: '#555' }}>
          {(() => {
            const currentLabel = labels[selectedLabelIndex];
            // Priority 1: Get from mergekeys
            const mergeKeyDef = collectionManager.getMergeKeyDefinition(currentLabel?.mergeKey, collectionId);
            if (mergeKeyDef && Object.values(mergeKeyDef).some(v => v)) {
              return inLang(mergeKeyDef, lang);
            }
            // Priority 2: Get from first placeName
            const placeNameIds = currentLabel?.placeNameIds || [];
            if (placeNameIds.length > 0) {
              const firstPlaceNameId = placeNameIds[0];
              return inLang(collectionManager.getDefinition(firstPlaceNameId, collectionId), lang);
            }
            return '';
          })()}
        </p>
        {/* Label vernacular box */}
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
          {/* OpCode radio buttons */}
          <div style={{ marginBottom: 8, display: 'flex', gap: 12, alignItems: 'center' }}>
            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
              <input
                type="radio"
                name="opCode"
                value="sync"
                checked={(labels[selectedLabelIndex]?.opCode || 'sync') === 'sync'}
                onChange={() => {
                  const currentLabel = labels[selectedLabelIndex];
                  onUpdateVernacular(
                    currentLabel.mergeKey,
                    currentLabel.lblTemplate || currentLabel.mergeKey,
                    currentLabel.vernLabel,
                    'sync'
                  );
                }}
                style={{ marginRight: 4 }}
              />
              {inLang(uiStr.opCodeSync, lang)}
            </label>
            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
              <input
                type="radio"
                name="opCode"
                value="override"
                checked={labels[selectedLabelIndex]?.opCode === 'override'}
                onChange={() => {
                  const currentLabel = labels[selectedLabelIndex];
                  onUpdateVernacular(
                    currentLabel.mergeKey,
                    currentLabel.lblTemplate || currentLabel.mergeKey,
                    currentLabel.vernLabel,
                    'override'
                  );
                }}
                style={{ marginRight: 4 }}
              />
              {inLang(uiStr.opCodeOverride, lang)}
            </label>
            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
              <input
                type="radio"
                name="opCode"
                value="omit"
                checked={labels[selectedLabelIndex]?.opCode === 'omit'}
                onChange={() => {
                  const currentLabel = labels[selectedLabelIndex];
                  onUpdateVernacular(
                    currentLabel.mergeKey,
                    currentLabel.lblTemplate || currentLabel.mergeKey,
                    '',
                    'omit'
                  );
                  setVernacularValue('');
                }}
                style={{ marginRight: 4 }}
              />
              {inLang(uiStr.opCodeOmit, lang)}
            </label>
          </div>
          <textarea
            ref={vernacularAutocorrectRef}
            value={vernacularValue}
            onChange={handleVernacularChange}
            disabled={labels[selectedLabelIndex]?.opCode === 'omit'}
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
            {inLang(uiStr.statusValue[status].help, lang)
              .replace('{listOfRenderingPatterns}', localRenderings.split('\n').filter(l => l.trim()).join(', '))}
            {status === STATUS_MULTIPLE_RENDERINGS && (
              <>
                <button style={{ marginLeft: 8 }} onClick={() => onAddMapForm()}>
                  {inLang(uiStr.addMapForm, lang)}
                </button>
                <button 
                  style={{ marginLeft: 8 }}
                  onClick={() => {
                    // Get active placeNameId
                    const currentLabel = labels[selectedLabelIndex];
                    const placeNameIds = currentLabel?.placeNameIds || [];
                    const activePlaceNameId = placeNameIds[activeTab] || placeNameIds[0];
                    
                    if (activePlaceNameId) {
                      labelDictionaryService.setConfirmed(activePlaceNameId, true);
                      // Trigger re-render by updating vernacular (no change to text)
                      onUpdateVernacular(
                        currentLabel.mergeKey,
                        currentLabel.lblTemplate || currentLabel.mergeKey,
                        currentLabel.vernLabel,
                        currentLabel.opCode || 'sync'
                      );
                    }
                  }}
                >
                  {inLang(uiStr.confirmPatterns, lang)}
                </button>
              </>
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
                  const termId = labels[selectedLabelIndex].termId;

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
        {/* Tabbed section for placeNames */}
        {(() => {
          const currentLabel = labels[selectedLabelIndex];
          const placeNameIds = currentLabel?.placeNameIds || [];
          
          if (placeNameIds.length === 0) return null;
          
          const showTabs = placeNameIds.length > 1;
          
          return (
            <div style={{ margin: '8px', marginTop: 12 }}>
              {/* Tabs if multiple placeNames */}
              {showTabs && (
                <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
                  {placeNameIds.map((placeNameId, index) => {
                    const placeName = collectionManager.getPlaceName(placeNameId, collectionId);
                    const placeStatus = currentLabel.perPlaceStatus?.[placeNameId] || 0;
                    const statusColor = statusValue[placeStatus]?.textColor || '#000';
                    return (
                      <button
                        key={placeNameId}
                        style={{
                          padding: '4px 12px',
                          background: activeTab === index ? '#d0eaff' : '#f0f0f0',
                          border: `2px solid ${statusColor}`,
                          borderRadius: 4,
                          cursor: 'pointer',
                          fontSize: '0.9em',
                        }}
                        onClick={() => onActiveTabChange(index)}
                      >
                        {inLang(placeName?.gloss, lang) || placeNameId}
                      </button>
                    );
                  })}
                </div>
              )}
              
              {/* Content for active placeName */}
              {placeNameIds.map((placeNameId, index) => {
                if (showTabs && index !== activeTab) return null;
                
                const placeName = collectionManager.getPlaceName(placeNameId, collectionId);
                const terms = placeName?.terms || [];
                const isJoined = labelDictionaryService.isJoined(placeNameId);
                
                return (
                  <div key={placeNameId} style={{ marginTop: showTabs ? 0 : 8 }}>
                    {/* Join checkbox for multi-term placeNames */}
                    {terms.length > 1 && (
                      <div style={{ marginBottom: 8 }}>
                        <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={isJoined}
                            onChange={(e) => {
                              labelDictionaryService.setJoined(placeNameId, e.target.checked);
                              // Trigger re-render
                              onUpdateVernacular(
                                currentLabel.mergeKey,
                                currentLabel.lblTemplate || currentLabel.mergeKey,
                                currentLabel.vernLabel,
                                currentLabel.opCode || 'sync'
                              );
                            }}
                            style={{ marginRight: 6 }}
                          />
                          <span style={{ fontSize: '0.9em' }}>{inLang(uiStr.joinCheckbox, lang)}</span>
                        </label>
                      </div>
                    )}
                    
                    {/* If joined, show term names above single textarea */}
                    {isJoined && terms.length > 1 ? (
                      <div>
                        {terms.map(term => {
                          const termGloss = inLang(term.gloss, lang);
                          const termTranslit = term.transliteration ? ` /${term.transliteration}/` : '';
                          return (
                            <div key={term.termId} style={{ fontSize: '0.9em', marginBottom: 4, fontWeight: 'bold' }}>
                              {term.termId} {termGloss}{termTranslit}
                            </div>
                          );
                        })}

                        {/* Single textarea for joined terms */}
                        <div style={{ marginTop: 8 }}>
                          <AutocorrectTextarea
                            value={termRenderings[terms[0].termId]?.renderings?.replace(/\|\|/g, '\n') || ''}
                            onChange={e => {
                              const newValue = e.target.value.replace(/\n/g, '||');
                              const updatedData = { ...termRenderings };
                              updatedData[terms[0].termId] = {
                                ...updatedData[terms[0].termId],
                                renderings: newValue,
                                isGuessed: false,
                              };
                              setTermRenderings(updatedData);
                            }}
                            style={{
                              width: '100%',
                              minHeight: '80px',
                              border: '1px solid #999',
                              borderRadius: '0.5em',
                              padding: '6px',
                              fontSize: '11px',
                              backgroundColor: termRenderings[terms[0].termId]?.isGuessed ? '#ffbf8f' : 'white',
                            }}
                            placeholder={inLang(uiStr.enterRenderings, lang)}
                            spellCheck={false}
                          />
                        </div>
                      </div>
                    ) : (
                      /* Not joined or single term - show each term with its own textarea */
                      terms.map(term => {
                        const termGloss = inLang(term.gloss, lang);
                        const termTranslit = term.transliteration ? ` /${term.transliteration}/` : '';
                        const termData = termRenderings[term.termId] || {};
                        
                        return (
                          <div key={term.termId} style={{ marginBottom: 12 }}>
                            <div style={{ fontSize: '0.9em', marginBottom: 4, fontWeight: 'bold' }}>
                              {term.termId} {termGloss}{termTranslit}
                            </div>
                            <AutocorrectTextarea
                              value={termData.renderings?.replace(/\|\|/g, '\n') || ''}
                              onChange={e => {
                                const newValue = e.target.value.replace(/\n/g, '||');
                                const updatedData = { ...termRenderings };
                                updatedData[term.termId] = {
                                  ...updatedData[term.termId],
                                  renderings: newValue,
                                  isGuessed: false,
                                };
                                setTermRenderings(updatedData);
                              }}
                              style={{
                                width: '100%',
                                minHeight: '80px',
                                border: '1px solid #999',
                                borderRadius: '0.5em',
                                padding: '6px',
                                fontSize: '11px',
                                backgroundColor: termData.isGuessed ? '#ffbf8f' : 'white',
                              }}
                              placeholder={inLang(uiStr.enterRenderings, lang)}
                              spellCheck={false}
                            />
                          </div>
                        );
                      })
                    )}
                  </div>
                );
              })}
            </div>
          );
        })()}
      </div>
    </div>
  );
}
