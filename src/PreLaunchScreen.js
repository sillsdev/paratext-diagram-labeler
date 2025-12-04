import React, { useState, useCallback } from 'react';
import './PreLaunchScreen.css';
import uiStr from './data/ui-strings.json';
import { inLang } from './Utils.js';

// Icons for valid/invalid status
const CheckIcon = () => <span className="status-icon valid">✓</span>;

const ErrorIcon = () => <span className="status-icon invalid">✗</span>;

const PreLaunchScreen = ({ settings, errors, onSettingsChange, onLaunch, language = 'en', paratextProjects = [] }) => {
  // Use local state for editing but rely on parent for validated errors
  const [editedSettings, setEditedSettings] = useState({ ...settings });

  const handleSettingChange = useCallback(
    (key, value) => {
      const updatedSettings = {
        ...editedSettings,
        [key]: value,
      };
      setEditedSettings(updatedSettings);
      // Always notify parent component of changes for validation
      if (onSettingsChange) {
        onSettingsChange(updatedSettings);
      }
    },
    [editedSettings, onSettingsChange]
  ); // Handle folder picker - use useCallback to avoid recreation

  const handleSelectFolder = useCallback(
    async key => {
      try {
        const folder = await window.electronAPI.selectProjectFolder();
        if (folder) {
          // Update local state and notify parent - the parent will handle validation and saving
          handleSettingChange(key, folder);
        }
      } catch (error) {
        console.error('Error selecting folder:', error);
      }
    },
    [handleSettingChange]
  ); // Handle Paratext project selection from dropdown

  const handleParatextProjectSelect = useCallback(
    (event) => {
      const selectedPath = event.target.value;
      if (selectedPath && selectedPath !== '') {
        // Update the project folder setting when a project is selected
        handleSettingChange('projectFolder', selectedPath);
      }
    },
    [handleSettingChange]
  );

  const handleLaunch = useCallback(() => {
    // Let the parent component handle all validation and saving
    // Just pass the current settings to launch
    onLaunch(editedSettings);
  }, [editedSettings, onLaunch]);

  
  return (
    <div className="pre-launch-screen">
      <div className="pre-launch-header">
        <div className="header-content">
          <div className="logo-container">
            <img src="./assets/logo.svg" alt="Paratext Diagram Labeler Logo" className="app-logo" />
          </div>
          <div className="header-text">
            <h1>{inLang(uiStr.paratextDiagramLabeler, language)} </h1>
            <h2>Paratext 9 standalone edition</h2>
            <p>
              <a href="https://software.sil.org/labeler" target="_blank" rel="noopener noreferrer">
                software.sil.org/labeler
              </a>
            </p>
          </div>
        </div>
      </div>
      {/* Launch Button */}
      <div className="launch-container">
        {Object.keys(errors).length === 0 ? (
          <button
            className="launch-button"
            onClick={handleLaunch}
            tabIndex="0"
            aria-label="Launch Application"
            // ref={launchButtonRef}
          >
            Launch
          </button>
        ) : (
          <div className="launch-error">
            Please provide the required settings below in order to launch the application.
          </div>
        )}
      </div>
      <div className="settings-container">
        {/* Project Folder Setting */}
        <div className="setting-row">
          <div className="setting-status">
            {errors.projectFolder ? <ErrorIcon /> : <CheckIcon />}
          </div>
          <div className="setting-content">
            {/* Paratext Project Dropdown */}
            {paratextProjects.length > 0 && (
              <div className="setting-input-group">
                <label>{inLang(uiStr.selectParatextProject, language)}</label>
                <select
                  value={
                    paratextProjects.find(p => p.path === editedSettings.projectFolder)?.path || ''
                  }
                  onChange={handleParatextProjectSelect}
                >
                  <option value="">
                    {inLang(uiStr.chooseParatextProject, language)}
                  </option>
                  {paratextProjects.map(project => {
                    // Clean up language code display: collapse multiple colons and remove trailing colon
                    const cleanLanguageCode = project.language 
                      ? project.language.replace(/::+/g, ':').replace(/:$/, '')
                      : '';
                    
                    return (
                      <option key={project.path} value={project.path}>
                        {project.fullName || project.name}
                        {cleanLanguageCode && ` (${cleanLanguageCode})`}
                      </option>
                    );
                  })}
                </select>
              </div>
            )}
            
            {/* Show helpful message when no projects found */}
            {paratextProjects.length === 0 && (
              <div className="setting-help-text">
                {inLang(uiStr.noParatextProjectsFound, language)}
              </div>
            )}
            
            {/* Manual Project Folder Input */}
            <div className="setting-input-group">
              <label>{inLang(uiStr.projectFolder, language)}</label>
              <input
                type="text"
                value={editedSettings.projectFolder || ''}
                onChange={e => handleSettingChange('projectFolder', e.target.value)}
                className={errors.projectFolder ? 'error' : ''}
                spellCheck={false}
              />
              <button onClick={() => handleSelectFolder('projectFolder')}>Browse...</button>
            </div>
            {errors.projectFolder && <div className="error-message">{errors.projectFolder}</div>}
          </div>
        </div>

        {/* Save Renderings To Setting */}
        <div className="setting-row">
          <div className="setting-status">
            <CheckIcon />
          </div>
          <div className="setting-content">
            <div className="setting-input-group">
              <label>Save Renderings To:</label>
              <select
                value={editedSettings.saveToDemo ? 'true' : 'false'}
                onChange={e => handleSettingChange('saveToDemo', e.target.value === 'true')}
              >
                <option value="true">TermRenderings-Demo.xml</option>
                <option value="false">TermRenderings.xml</option>
              </select>
            </div>
          </div>
        </div>

        {/* USFM Setting */}
        <div className="setting-row">
          <div className="setting-status">{errors.usfm ? <ErrorIcon /> : <CheckIcon />}</div>
          <div className="setting-content">
            <div className="setting-header">
              <label>USFM In/Out:</label>
            </div>
            <textarea
              className={errors.usfm ? 'usfm-textarea error' : 'usfm-textarea'}
              value={editedSettings.usfm || ''}
              onChange={e => handleSettingChange('usfm', e.target.value)}
              rows={2}
              placeholder="Enter USFM \fig field here, or select a template after launch..."
              style={{ whiteSpace: 'nowrap' }}
              wrap="off"
              spellCheck={false}
            />
            {errors.usfm && <div className="error-message">{errors.usfm}</div>}
          </div>
        </div>

        {/* Collections Folder Setting */}
        <div className="setting-row">
          <div className="setting-status">
            {errors.collectionsFolder ? <ErrorIcon /> : <CheckIcon />}
          </div>
          <div className="setting-content">
            <div className="setting-input-group">
              <label>{inLang(uiStr.templateFolder, language)}</label>
              <input
                type="text"
                value={editedSettings.collectionsFolder || ''}
                onChange={e => handleSettingChange('collectionsFolder', e.target.value)}
                className={errors.collectionsFolder ? 'error' : ''}
                spellCheck={false}
              />
              <button onClick={() => handleSelectFolder('collectionsFolder')}>Browse...</button>
            </div>
            {errors.collectionsFolder && <div className="error-message">{errors.collectionsFolder}</div>}
          </div>
        </div>
      </div>{' '}
      {/* settings-container */}
    </div>
  );
};

export default PreLaunchScreen;
