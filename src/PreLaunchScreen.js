import React, { useState, useCallback } from 'react';
import './PreLaunchScreen.css';

// Icons for valid/invalid status
const CheckIcon = () => <span className="status-icon valid">✓</span>;

const ErrorIcon = () => <span className="status-icon invalid">✗</span>;

const PreLaunchScreen = ({ settings, errors, onSettingsChange, onLaunch }) => {
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
  ); // Save settings and launch app - use useCallback to prevent recreating on every render

  const handleLaunch = useCallback(() => {
    // Let the parent component handle all validation and saving
    // Just pass the current settings to launch
    onLaunch(editedSettings);
  }, [editedSettings, onLaunch]);

  // Trigger validation when component mounts to ensure errors are displayed correctly
  // useEffect(() => {
  //   // Only trigger if we have settings and onSettingsChange handler
  //   if (settings && onSettingsChange) {
  //     // Re-validate the settings by notifying the parent
  //     onSettingsChange({...settings});
  //   }
  // }, []); // Empty dependency array runs only on mount

  return (
    <div className="pre-launch-screen">
      <div className="pre-launch-header">
        <div className="header-content">
          <div className="logo-container">
            <img src="/assets/logo.svg" alt="Scripture Map Labeler Logo" className="app-logo" />
          </div>
          <div className="header-text">
            <h2>Paratext 9 standalone proposed UX preview of the</h2>
            <h1>Scripture Map Labeler </h1>
            <h2>extension for Paratext 10</h2>
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
        {/* Template Folder Setting */}
        <div className="setting-row">
          <div className="setting-status">
            {errors.templateFolder ? <ErrorIcon /> : <CheckIcon />}
          </div>
          <div className="setting-content">
            <div className="setting-input-group">
              <label>Template Folder:</label>
              <input
                type="text"
                value={editedSettings.templateFolder || ''}
                onChange={e => handleSettingChange('templateFolder', e.target.value)}
                className={errors.templateFolder ? 'error' : ''}
                spellCheck={false}
              />
              <button onClick={() => handleSelectFolder('templateFolder')}>Browse...</button>
            </div>
            {errors.templateFolder && <div className="error-message">{errors.templateFolder}</div>}
          </div>
        </div>

        {/* Project Folder Setting */}
        <div className="setting-row">
          <div className="setting-status">
            {errors.projectFolder ? <ErrorIcon /> : <CheckIcon />}
          </div>
          <div className="setting-content">
            <div className="setting-input-group">
              <label>Project Folder:</label>
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
              rows={10}
              placeholder="Enter USFM content here, or select a sample image or data merge file after launch..."
              style={{ whiteSpace: 'nowrap' }}
              wrap="off"
              spellCheck={false}
            />
            {errors.usfm && <div className="error-message">{errors.usfm}</div>}
          </div>
        </div>
      </div>{' '}
      {/* settings-container */}
    </div> /* pre-launch-screen */
  );
};

export default PreLaunchScreen;
