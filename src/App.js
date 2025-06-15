import { useState, useEffect } from 'react';
import { settingsService } from './services/SettingsService';
import MainApp from './MainApp';
import PreLaunchScreen from './PreLaunchScreen';
import './App.css';


function App() {
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);
  const [launched, setLaunched] = useState(false);
  const [settings, setSettings] = useState(null);
  const [settingsErrors, setSettingsErrors] = useState({});

  // Load settings when component mounts
  useEffect(() => {
    async function initialize() {
      console.log("Loading application settings...");
      const newSettings = await settingsService.loadSettings();
      setSettings(newSettings);
      
      // Validate settings
      const errors = await validateSettings(newSettings);
      setSettingsErrors(errors);
      
      setIsLoadingSettings(false);        
    }
    
    initialize();
  }, []); // Run once on component mount

  // Validate all settings and return any errors
  const validateSettings = async (settingsToValidate) => {
    const errors = {};
    
    // Check templateFolder exists
    if (!settingsToValidate.templateFolder) {
      errors.templateFolder = 'Template folder is required';
    } else {
      try {
        const exists = await window.electronAPI.statPath(settingsToValidate.templateFolder);
        if (!exists || !exists.isDirectory) {
          errors.templateFolder = 'Template folder not found';
        }
      } catch (error) {
        errors.templateFolder = `Error checking template folder: ${error.message}`;
      }
    }
    
    // Check projectFolder exists if provided
    if (settingsToValidate.projectFolder) {
      try {
        const exists = await window.electronAPI.statPath(settingsToValidate.projectFolder);
        if (!exists || !exists.isDirectory) {
          errors.projectFolder = 'Project folder not found';
        }
      } catch (error) {
        errors.projectFolder = `Error checking project folder: ${error.message}`;
      }
    }
    
    // Validate USFM if present
    if (settingsToValidate.usfm) {
      if (!settingsToValidate.usfm.includes('\\zdiagram-s')) {
        errors.usfm = 'USFM does not appear to be valid diagram markup';
      }
    }
    
    return errors;
  };

  // Handle onExit to return to pre-launch screen
  const handleExit = () => {
    setSettings(settingsService.getSettings())
    setLaunched(false);
    setSettingsErrors({});
  };
  
  // Handle settings changes
  const handleSettingsChange = async (newSettings) => {
    setSettings(newSettings);
    const errors = await validateSettings(newSettings);
    setSettingsErrors(errors);
    await settingsService.saveSettings(newSettings);
  };

  // Handle launching the app
  const handleLaunch = async (updatedSettings) => {
    // Final validation
    const errors = await validateSettings(updatedSettings);
    if (Object.keys(errors).length > 0) {
      console.error("Cannot launch with validation errors:", errors);
      return;
    }
    
    // Update settings
    await settingsService.saveSettings(updatedSettings);
    setSettings(updatedSettings);
    setLaunched(true);
  };

  // Show loading state
  if (isLoadingSettings) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner"></div>
        <p>Loading settings...</p>
      </div>
    );
  }

  if (!launched) {
    return (
      <div className="app-container">
        <PreLaunchScreen 
          settings={settings}
          errors={settingsErrors}
          onSettingsChange={handleSettingsChange}
          onLaunch={handleLaunch}
          hasErrors={Object.keys(settingsErrors).length > 0}
        />
      </div>
    );   
  }
  
  return (
    <div className="app-container">
      <div className="main-content">
        <MainApp settings={settings} onExit={handleExit}/>
      </div>
    </div>
  );
}

export default App;