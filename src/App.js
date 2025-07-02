import { useState, useEffect } from 'react';
import { settingsService } from './services/SettingsService';
import MainApp from './MainApp';
import PreLaunchScreen from './PreLaunchScreen';
import './App.css';
import uiStr from './data/ui-strings.json';
import { inLang } from './Utils.js';

function App() {
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);
  const [launched, setLaunched] = useState(false);
  const [settingsErrors, setSettingsErrors] = useState({});
  const [currentLanguage, setCurrentLanguage] = useState('en'); // Default to English
  const [termRenderings, setTermRenderings] = useState(null);

  // Load settings when component mounts
  useEffect(() => {
    async function initialize() {
      // console.log('Loading application settings...');
      const newSettings = await settingsService.loadSettings();

      // Set the current language from settings
      setCurrentLanguage(newSettings.language || 'en');

      // Validate settings
      if (!newSettings.templateFolder) {
        newSettings.templateFolder = await window.electronAPI.getDefaultTemplateFolder();
      }
      const errors = await validateSettings(newSettings);
      setSettingsErrors(errors);
      setIsLoadingSettings(false);
    }

    initialize();
  }, []); // Run once on component mount

  // Validate all settings and return any errors
  const validateSettings = async settingsToValidate => {
    const errors = {};

    // Check templateFolder exists
    if (!settingsToValidate.templateFolder) {
      errors.templateFolder =
        'Please specify the location of the folder containing the map templates';
    } else {
      try {
        const exists = await window.electronAPI.statPath(settingsToValidate.templateFolder);
        if (!exists || !exists.isDirectory) {
          errors.templateFolder =
            'Template folder not found. Please specify the location of the folder containing the map templates.';
        }
      } catch (error) {
        errors.templateFolder = `Error checking template folder: ${error.message}`;
      }
    }

    // Check projectFolder exists
    if (!settingsToValidate.projectFolder) {
      errors.projectFolder = 'Please specify the location of your Paratext project folder';
      setTermRenderings(null); // Reset term renderings if no project folder
    } else {
      try {
        const exists = await window.electronAPI.statPath(settingsToValidate.projectFolder);
        if (!exists || !exists.isDirectory) {
          errors.projectFolder =
            'Project folder not found. Please specify the location of your Paratext project folder.';
            setTermRenderings(null); // Reset term renderings if no valid project folder
        } else {
          // console.log('[IPC] Starting term renderings load...');

          const newTermRenderings = await window.electronAPI.loadTermRenderings(
            settingsToValidate.projectFolder,
            settingsToValidate.saveToDemo
          );
          setTermRenderings(newTermRenderings);
          if (!newTermRenderings) {
            errors.projectFolder = 'Failed to load term renderings from project folder. Please check the folder and try again.';
          }
          console.log(
            'Term renderings loaded:',
            newTermRenderings,
            'from folder:',
            settingsToValidate.projectFolder,
            'saveToDemo:',
            settingsToValidate.saveToDemo
          );
        }
      } catch (error) {
        errors.projectFolder = `Error checking project folder: ${error.message}`;
      }
    }

    // Validate USFM if present
    if (settingsToValidate.usfm) {
      // if (!settingsToValidate.usfm.includes('\\zdiagram-s')) {
      //   errors.usfm = 'USFM does not appear to be valid diagram markup';
      // }
    }

    return errors;
  };

  // Handle onExit to return to pre-launch screen
  const handleExit = async () => {
    try {
      console.log('App: Preparing to exit MainApp');

      // Re-validate settings to update error state
      const errors = await validateSettings(settingsService.getSettings());
      setSettingsErrors(errors);
      console.log('App: Settings validated');

      // Give the app time to process cleanup before unmounting
      // This helps prevent issues with map cleanup
      console.log('App: Scheduling unmount with delay');
      setTimeout(() => {
        // Switch back to pre-launch mode
        console.log('App: Unmounting MainApp component now');
        setLaunched(false);
      }, 100);
    } catch (error) {
      console.error('Error during exit handling:', error);
      // Force exit even if there was an error
      setTimeout(() => setLaunched(false), 100);
    }
  };

  // Handle settings changes
  const handleSettingsChange = async newSettings => {
    // setSettings(newSettings);
    await settingsService.updateSettings(newSettings);
    const errors = await validateSettings(newSettings);
    setSettingsErrors(errors);
  };

  // Handle launching the app
  const handleLaunch = async updatedSettings => {
    // Final validation
    if (Object.keys(settingsErrors).length > 0 || !termRenderings) {
      console.error('Cannot launch with validation errors:', settingsErrors);
      return;
    }
    // Update settings
    await settingsService.updateSettings(updatedSettings);
    setLaunched(true);
  };

  // Show loading state
  if (isLoadingSettings) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner"></div>
        <p>{inLang(uiStr.loadingSettings, currentLanguage)}</p>
      </div>
    );
  }
  return (
    <div className="app-container">
      {!launched ? (
        <PreLaunchScreen
          settings={settingsService.getSettings()}
          errors={settingsErrors}
          onSettingsChange={handleSettingsChange}
          onLaunch={handleLaunch}
          language={currentLanguage}
        />
      ) : (
        <div className="main-content">
          <MainApp
            key="main-app-instance" // Adding a key forces recreation when re-rendering
            settings={settingsService.getSettings()}
            templateFolder={settingsService.getSettings().templateFolder}
            onExit={handleExit}
            termRenderings={termRenderings}
            setTermRenderings={setTermRenderings} // Pass setter to allow MainApp to update term renderings
          />
        </div>
      )}
    </div>
  );
}

export default App;
