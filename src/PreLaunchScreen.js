import React, { useState, useEffect } from 'react';
import './PreLaunchScreen.css';

// Icons for valid/invalid status
const CheckIcon = () => (
  <span className="status-icon valid">✓</span>
);

const ErrorIcon = () => (
  <span className="status-icon invalid">✗</span>
);

const PreLaunchScreen = ({ settings, onLaunch }) => {
  const [editedSettings, setEditedSettings] = useState({ ...settings });
  const [errors, setErrors] = useState({});
  const [isUsfmExpanded, setIsUsfmExpanded] = useState(false);

  // Function to validate all settings
  const validateSettings = async () => {
    const newErrors = {};
    
    // Validate template folder
    if (!editedSettings.templateFolder) {
      newErrors.templateFolder = 'Template folder is required';
    } else {
      try {
        const exists = await window.electronAPI.statPath(editedSettings.templateFolder);
        if (!exists || !exists.isDirectory) {
          newErrors.templateFolder = 'Template folder not found';
        }
      } catch (error) {
        newErrors.templateFolder = `Error: ${error.message}`;
      }
    }
    
    // Validate project folder if present
    if (editedSettings.projectFolder) {
      try {
        const exists = await window.electronAPI.statPath(editedSettings.projectFolder);
        if (!exists || !exists.isDirectory) {
          newErrors.projectFolder = 'Project folder not found';
        }
      } catch (error) {
        newErrors.projectFolder = `Error: ${error.message}`;
      }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  // Validate settings whenever they change
  useEffect(() => {
    const runValidation = async () => {
      await validateSettings();
    };
    runValidation();
    // We're intentionally only running this when editedSettings changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editedSettings]);

  // Handle settings changes
  const handleSettingChange = (key, value) => {
    setEditedSettings(prev => ({
      ...prev,
      [key]: value
    }));
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
  };

  // Save settings and launch app
  const handleLaunch = async () => {
    // Final validation before launching
    const isValid = await validateSettings();
    if (!isValid) {
      alert('Please fix all errors before launching');
      return;
    }
    
    // Save settings
    try {
      // Update app's settings
      await window.electronAPI.saveToJson(editedSettings, null, "MapLabelerSettings.json");
      
      // Launch the app
      onLaunch(editedSettings);
    } catch (error) {
      console.error('Failed to save settings:', error);
      setErrors(prev => ({
        ...prev,
        general: `Failed to save settings: ${error.message}`
      }));
    }
  };

  return (
    <div className="pre-launch-screen">
      <div className="pre-launch-header">
        <h2>Paratext 9 standalone preview of the</h2>
        <h1>Scripture Map Labeler extension for Paratext 10</h1>
        <p className="subheading">In the Paratext 10 extension, the settings below will come from the installation.</p>
      </div>

      <div className="settings-container">
        <h3>Application Settings</h3>
        
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
              />
              <button onClick={() => handleSelectFolder('projectFolder')}>Browse...</button>
            </div>
            {errors.projectFolder && <div className="error-message">{errors.projectFolder}</div>}
          </div>
        </div>
        
        {/* Language Setting */}
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
        </div>
        
        {/* USFM Setting */}
        <div className="setting-row">
          <div className="setting-status">
            {/* USFM is optional, so always show checkmark */}
            <CheckIcon />
          </div>
          <div className="setting-content">
            <div className="setting-header" onClick={() => setIsUsfmExpanded(!isUsfmExpanded)}>
              <label>USFM Content</label>
              <span className={`expand-icon ${isUsfmExpanded ? 'expanded' : ''}`}>▼</span>
            </div>
            {isUsfmExpanded && (
              <textarea
                value={editedSettings.lastUsfm || ''}
                onChange={(e) => handleSettingChange('lastUsfm', e.target.value)}
                rows={10}
                placeholder="Enter USFM content here (optional)"
              />
            )}
          </div>
        </div>
      </div>
      
      {/* Launch Button */}
      <div className="launch-container">
        {Object.keys(errors).length === 0 ? (
          <button className="launch-button" onClick={handleLaunch}>
            Launch Application
          </button>
        ) : (
          <div className="launch-error">
            Please fix all errors before launching the application
          </div>
        )}
      </div>
    </div>
  );
};

export default PreLaunchScreen;
