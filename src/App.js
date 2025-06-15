import { useState, useEffect } from 'react';
// import { useInitialization } from './InitializationProvider';
import { settingsService } from './services/SettingsService';
import MainApp from './MainApp';

// const electronAPI = window.electronAPI;


function App() {
  const [ isLoadingSettings, setIsLoadingSettings ] = useState(true);
  // // Get initialization state and settings from context
  // const { isInitialized, settings } = useInitialization();
  const [launched, setLaunched] = useState(false);
  const [settings, setSettings] = useState(null);

  useEffect(() => {  // Run once on component mount
    async function initialize() {
      console.log("Loading application settings...");
      const newSettings = await settingsService.loadSettings();
      setSettings(newSettings);
      setIsLoadingSettings(false);        
    }
    
    initialize();
  }, []); // Run once on component mount

  if (isLoadingSettings) {
    return null;
  }
  if (!launched) {
    return (
      <div className="pre-launch">
        <h2>Paratext 9 standalone preview of the</h2>
        <h1>Scripture Map Labeler extension for Paratext 10</h1>
        <p>In the Paratext 10 extension, the settings below will come from the installation.</p>
        <p>
          <button onClick={() => {
            settingsService.saveSettings();  //TODO: do this when settings change
            setLaunched(true);
          }}>
            Launch App
          </button>
        </p>
        <p>Template folder: {settings.templateFolder}</p>
        <p>Project folder: {settings.projectFolder}</p>
      </div>
    )    
  }
  return (
        <div className="main-content">
          <MainApp settings={settings}/>
        </div>
  );
}

export default App;