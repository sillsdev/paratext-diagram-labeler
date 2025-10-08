import { useState, useEffect, useCallback, useRef } from 'react';
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

  // Use a ref to store the latest validateSettings function to avoid infinite loops
  const validateSettingsRef = useRef();

  // Validate all settings and return any errors
  const validateSettings = useCallback(async settingsToValidate => {
    const errors = {};

    // Check templateFolder exists
    if (!settingsToValidate.templateFolder) {
      errors.templateFolder = inLang(uiStr.specifyTemplateFolder, currentLanguage);
    } else {
      try {
        const exists = await window.electronAPI.statPath(settingsToValidate.templateFolder);
        if (!exists || !exists.isDirectory) {
          errors.templateFolder = inLang(uiStr.templateFolderNotFound, currentLanguage);
        }
      } catch (error) {
        errors.templateFolder = `${inLang(uiStr.errorCheckingTemplateFolder, currentLanguage)}: ${error.message}`;
      }
    }

    // Check projectFolder exists (but don't load term renderings here)
    if (!settingsToValidate.projectFolder) {
      errors.projectFolder = inLang(uiStr.specifyProjectFolder, currentLanguage);
    } else {
      try {
        const exists = await window.electronAPI.statPath(settingsToValidate.projectFolder);
        if (!exists || !exists.isDirectory) {
          errors.projectFolder = inLang(uiStr.projectFolderNotFound, currentLanguage);
        } else {
          // Check term renderings state (loaded separately in useEffect)
          if (!termRenderings) {
            errors.projectFolder = inLang(uiStr.failedToLoadTermRenderingsFromFolder, currentLanguage);
          }
          // If termRenderings exists, no error for project folder
        }
      } catch (error) {
        errors.projectFolder = `${inLang(uiStr.errorCheckingProjectFolder, currentLanguage)}: ${error.message}`;
      }
    }

    // Validate USFM if present
    if (settingsToValidate.usfm) {
      // if (!settingsToValidate.usfm.includes('\\zdiagram-s')) {
      //   errors.usfm = 'USFM does not appear to be valid diagram markup';
      // }
    }

    return errors;
  }, [currentLanguage, termRenderings]);

  // Store the latest validateSettings in a ref to avoid infinite loops
  validateSettingsRef.current = validateSettings;

  // Function to load term renderings and re-validate
  const loadTermRenderingsAndRevalidate = useCallback(async (settingsParam = null) => {
    const settings = settingsParam || settingsService.getSettings();
    
    // Only load if we have a valid project folder
    if (!settings.projectFolder) {
      setTermRenderings(null);
      // Re-validate after clearing term renderings - use inline validation to avoid dependency loop
      const errors = {};
      errors.projectFolder = inLang(uiStr.specifyProjectFolder, currentLanguage);
      if (!settings.templateFolder) {
        errors.templateFolder = inLang(uiStr.specifyTemplateFolder, currentLanguage);
      }
      setSettingsErrors(errors);
      return;
    }

    try {
      const exists = await window.electronAPI.statPath(settings.projectFolder);
      if (!exists || !exists.isDirectory) {
        setTermRenderings(null);
        // Re-validate after clearing term renderings
        const errors = {};
        errors.projectFolder = inLang(uiStr.projectFolderNotFound, currentLanguage);
        if (!settings.templateFolder) {
          errors.templateFolder = inLang(uiStr.specifyTemplateFolder, currentLanguage);
        }
        setSettingsErrors(errors);
        return;
      }

      // console.log('[IPC] Loading term renderings...');
      
      const newTermRenderings = await window.electronAPI.loadTermRenderings(
        settings.projectFolder,
        settings.saveToDemo
      );
      
      setTermRenderings(newTermRenderings);
      
      // CRITICAL: Re-validate after term renderings finish loading
      // Use the ref to avoid dependency loop
      const errors = await validateSettingsRef.current(settings);
      setSettingsErrors(errors);
      
      console.log(
        'Term renderings loaded and validation updated:',
        newTermRenderings,
        'from folder:',
        settings.projectFolder,
        'saveToDemo:',
        settings.saveToDemo
      );
      
    } catch (error) {
      console.error('Error loading term renderings:', error);
      setTermRenderings(null);
      
      // Re-validate after error
      const errors = {};
      errors.projectFolder = `${inLang(uiStr.errorCheckingProjectFolder, currentLanguage)}: ${error.message}`;
      if (!settings.templateFolder) {
        errors.templateFolder = inLang(uiStr.specifyTemplateFolder, currentLanguage);
      }
      setSettingsErrors(errors);
    }
  }, [currentLanguage]);

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
  }, [validateSettings]);

  // Initial load of term renderings when component mounts
  useEffect(() => {
    // Only run after initial settings load is complete
    if (!isLoadingSettings) {
      // Pass the already-loaded settings to avoid double settings load
      loadTermRenderingsAndRevalidate(settingsService.getSettings());
    }
  }, [isLoadingSettings, loadTermRenderingsAndRevalidate]);

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
    const currentSettings = settingsService.getSettings();
    
    // Check if project-related settings changed
    const projectChanged = 
      currentSettings.projectFolder !== newSettings.projectFolder ||
      currentSettings.saveToDemo !== newSettings.saveToDemo;
    
    await settingsService.updateSettings(newSettings);
    
    if (projectChanged) {
      // Project settings changed - manually reload term renderings and validate
      await loadTermRenderingsAndRevalidate();
    } else {
      // For non-project changes (like USFM), just validate without reloading term renderings
      const errors = await validateSettings(newSettings);
      setSettingsErrors(errors);
    }
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
