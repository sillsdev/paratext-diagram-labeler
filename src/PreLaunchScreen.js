import React, { useState, useEffect, useCallback } from 'react';
import './PreLaunchScreen.css';

// Icons for valid/invalid status
const CheckIcon = () => (
  <span className="status-icon valid">✓</span>
);

const ErrorIcon = () => (
  <span className="status-icon invalid">✗</span>
);

const PreLaunchScreen = ({ settings, errors: propErrors, onSettingsChange, onLaunch, hasErrors }) => {  const [editedSettings, setEditedSettings] = useState({ ...settings });
  const [errors, setErrors] = useState(propErrors || {});  // Function to validate all settings - use useCallback to prevent recreating on every render
  const validateSettings = useCallback(async () => {
    const newErrors = {};
    
    // Validate template folder
    if (!editedSettings.templateFolder) {
      newErrors.templateFolder = 'Please specify the location of the folder containing the map templates';
    } else {
      try {
        const exists = await window.electronAPI.statPath(editedSettings.templateFolder);
        if (!exists || !exists.isDirectory) {
          newErrors.templateFolder = 'Please specify the location of the folder containing the map templates';
        }
      } catch (error) {
        newErrors.templateFolder = `Error: ${error.message}`;
      }
    }
    
    // Validate project folder if present
    if (!editedSettings.projectFolder) {
        newErrors.projectFolder = 'Please specify the location of your Paratext project folder';
    } else {
      try {
        const exists = await window.electronAPI.statPath(editedSettings.projectFolder);
        if (!exists || !exists.isDirectory) {
          newErrors.projectFolder = 'Project folder not found';
        }
      } catch (error) {
        newErrors.projectFolder = `Error: ${error.message}`;
      }
    }
    
    // Validate USFM if present
    if (editedSettings.usfm) {
      if (!editedSettings.usfm.includes('\\zdiagram-s')) {
        newErrors.usfm = 'USFM does not appear to be valid diagram markup';
      }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [editedSettings]);// Update local errors when prop errors change
  useEffect(() => {
    if (propErrors) {
      setErrors(propErrors);
    }
  }, [propErrors]);
  
  // Validate settings if no external validation is provided
  useEffect(() => {
    const runValidation = async () => {
      // Only run internal validation if we don't have external validation
      if (!onSettingsChange) {
        await validateSettings();
      }
    };
    runValidation();
    // We're intentionally only running this when editedSettings changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editedSettings]);
  // Handle settings changes
  const handleSettingChange = (key, value) => {
    const updatedSettings = {
      ...editedSettings,
      [key]: value
    };
    setEditedSettings(updatedSettings);
    
    // Notify parent component of changes
    if (onSettingsChange) {
      onSettingsChange(updatedSettings);
    }
  };

  // Handle folder picker
  const handleSelectFolder = async (key) => {
    try {
      const folder = await window.electronAPI.selectProjectFolder();
      if (folder) {
        handleSettingChange(key, folder);
      }
    } catch (error) {
      console.error('Error selecting folder:', error);
    }
  };  // Save settings and launch app - use useCallback to prevent recreating on every render
  const handleLaunch = useCallback(async () => {
    // If we're handling validation internally, do a final check
    if (!onSettingsChange) {
      const isValid = await validateSettings();
      if (!isValid) {
        alert('Please fix all errors before launching');
        return;
      }
      
      // Save settings if we're managing them internally
      try {
        await window.electronAPI.saveToJson(editedSettings, null, "MapLabelerSettings.json");
      } catch (error) {
        console.error('Failed to save settings:', error);
        setErrors(prev => ({
          ...prev,
          general: `Failed to save settings: ${error.message}`
        }));
        return;
      }
    }
    
    // Launch the app with current settings
    onLaunch(editedSettings);
  }, [editedSettings, onLaunch, onSettingsChange, validateSettings, setErrors]);
  // Handle Enter key press - use useCallback to ensure the function doesn't change on every render
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !hasErrors && Object.keys(errors).length === 0) {
      handleLaunch();
    }
  }, [errors, hasErrors, handleLaunch]);

  // Add event listener for Enter key when component mounts
  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]); // Only depends on handleKeyDown which is memoized with useCallback
  return (
    <div className="pre-launch-screen">
      <div className="pre-launch-header">
        <div className="header-content">
          <div className="logo-container">
            <img src="/assets/logo.svg" alt="Scripture Map Labeler Logo" className="app-logo" />
          </div>
          <div className="header-text">
            <h2>Paratext 9 standalone UX preview of the</h2>
            <h1>Scripture Map Labeler </h1>
            <h2>extension for Paratext 10</h2>
          </div>
        </div>
      </div>
        {/* Launch Button */}
      <div className="launch-container">        {!hasErrors && Object.keys(errors).length === 0 ? (
          <button 
            className="launch-button" 
            onClick={handleLaunch}
            tabIndex="0"
            aria-label="Launch Application"
          >
            Launch Application
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
            <label>Template Folder</label>
            <div className="setting-input-group">
              <input 
                type="text" 
                value={editedSettings.templateFolder || ''} 
                onChange={(e) => handleSettingChange('templateFolder', e.target.value)}
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
            <label>Project Folder</label>
            <div className="setting-input-group">
              <input 
                type="text" 
                value={editedSettings.projectFolder || ''} 
                onChange={(e) => handleSettingChange('projectFolder', e.target.value)}
                className={errors.projectFolder ? 'error' : ''}
                spellCheck={false}
              />
              <button onClick={() => handleSelectFolder('projectFolder')}>Browse...</button>
            </div>
            {errors.projectFolder && <div className="error-message">{errors.projectFolder}</div>}
          </div>
        </div>
        
        {/* Language Setting 
        <div className="setting-row">
          <div className="setting-status">
            <CheckIcon />
          </div>
          <div className="setting-content">
            <label>Interface Language</label>
            <select 
              value={editedSettings.language || 'en'} 
              onChange={(e) => handleSettingChange('language', e.target.value)}
            >
              <option value="en">English</option>
              <option value="fr">Français</option>
              <option value="es">Español</option>
              <option value="pt">Português</option>
            </select>
          </div>
        </div>*/}          {/* USFM Setting */}
        <div className="setting-row">
          <div className="setting-status">
            {errors.usfm ? <ErrorIcon /> : (editedSettings.usfm ? <CheckIcon /> : null)}
          </div>
          <div className="setting-content">
            <div className="setting-header">
              <label>USFM Content</label>
            </div>            <textarea
              className={errors.usfm ? "usfm-textarea error" : "usfm-textarea"}
              value={editedSettings.usfm || ''}
              onChange={(e) => handleSettingChange('usfm', e.target.value)}
              rows={10}
              placeholder="Enter USFM content here..."
              style={{ whiteSpace: 'nowrap' }}
              wrap="off"
              spellCheck={false}
            />
            {errors.usfm && (
              <div className="error-message">{errors.usfm}</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PreLaunchScreen;
