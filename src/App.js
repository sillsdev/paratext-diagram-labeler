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
      errors.templateFolder = 'Please to specify the location of the folder containing the map templates';
    } else {
      try {
        const exists = await window.electronAPI.statPath(settingsToValidate.templateFolder);
        if (!exists || !exists.isDirectory) {
          errors.templateFolder = 'Template folder not found. Please to specify the location of the folder containing the map templates.';
        }
      } catch (error) {
        errors.templateFolder = `Error checking template folder: ${error.message}`;
      }
    }
    
    // Check projectFolder exists 
    if (!settingsToValidate.projectFolder) {
      errors.projectFolder = 'Please to specify the location of your Paratext project folder';
    } else {
      try {
        const exists = await window.electronAPI.statPath(settingsToValidate.projectFolder);
        if (!exists || !exists.isDirectory) {
          errors.projectFolder = 'Project folder not found. Please to specify the location of your Paratext project folder.';
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
  };  // Handle onExit to return to pre-launch screen
  const handleExit = async () => {
    try {
      console.log("App: Preparing to exit MainApp");
      
      // First ensure the settingsService internal state is updated with our latest settings
      await settingsService.updateSettings(settings);
      console.log("App: Settings updated in service");
      
      // Explicitly get settings from file to ensure we have the latest version
      const currentSettings = await settingsService.loadSettings();
      console.log("App: Fresh settings loaded from disk");
      
      // Set the settings state first
      setSettings(currentSettings);
      
      // Re-validate settings to update error state
      const errors = await validateSettings(currentSettings);
      setSettingsErrors(errors);
      console.log("App: Settings validated");
      
      // Give the app time to process cleanup before unmounting
      // This helps prevent issues with map cleanup
      console.log("App: Scheduling unmount with delay");
      setTimeout(() => {
        // Switch back to pre-launch mode
        console.log("App: Unmounting MainApp component now");
        setLaunched(false);
      }, 100);
    } catch (error) {
      console.error("Error during exit handling:", error);
      // Force exit even if there was an error
      setTimeout(() => setLaunched(false), 100);
    }
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
  return (
    <div className="app-container">
      {!launched ? (
        <PreLaunchScreen 
          settings={settings}
          errors={settingsErrors}
          onSettingsChange={handleSettingsChange}
          onLaunch={handleLaunch}
          hasErrors={Object.keys(settingsErrors).length > 0}
        />
      ) : (
        <div className="main-content">
          <MainApp 
            key="main-app-instance" // Adding a key forces recreation when re-rendering
            settings={settings} 
            templateFolder={settings.templateFolder} 
            onExit={handleExit}
          />
        </div>
      )}
    </div>
  );
}

export default App;