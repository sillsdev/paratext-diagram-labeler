// filepath: c:\git\mapLabelerExt\biblical-map-app\src\InitializationProvider.js
import React, { createContext, useContext, useState, useEffect } from 'react';
import { collectionManager } from './CollectionManager';
import { settingsService } from './services/SettingsService';

const InitializationContext = createContext({
  isInitialized: false,
  settings: null,
  error: null
});

export function InitializationProvider({ children }) {
  const [state, setState] = useState({
    isInitialized: false,
    isLoading: true,
    isLoadingSettings: true,
    settings: null,
    error: null
  });
  
  useEffect(() => {
    async function initialize() {
      try {
        // First step: Load settings
        setState(prev => ({ ...prev, isLoadingSettings: true }));
        
        console.log("Loading application settings...");
        const settings = await settingsService.loadSettings();
        
        setState(prev => ({ 
          ...prev, 
          isLoadingSettings: false, 
          settings 
        }));
          // Second step: Initialize collections with both the paratext path and template folder path
        console.log("Loading map collections...");
        try {
          await collectionManager.initializeAllCollections(
            settings.paratextProjects, 
            settings.templateFolder
          );
          
          // Everything is initialized
          setState(prev => ({
            ...prev,
            isInitialized: true,
            isLoading: false
          }));
        } catch (collectionError) {
          console.error("Failed to initialize map collections:", collectionError);
          
          // Check if this is a template folder issue
          if (collectionError.message && collectionError.message.includes('Template folder not found')) {
            // Prompt user to select the template folder
            alert("The configured template folder could not be found.\n\nPlease select the location of your map template folder.");
            
            try {
              const selectedFolder = await window.electronAPI.selectProjectFolder();
              if (selectedFolder) {
                // Update settings with the new folder
                await settingsService.updateTemplateFolder(selectedFolder);
                
                // Try initializing again with the new folder
                await collectionManager.initializeAllCollections(
                  settings.paratextProjects, 
                  selectedFolder
                );
                
                // Success!
                setState(prev => ({
                  ...prev,
                  isInitialized: true,
                  isLoading: false,
                  settings: {...prev.settings, templateFolder: selectedFolder}
                }));
                
                return; // Exit early on successful recovery
              }
            } catch (retryError) {
              console.error("Failed to retry initialization after template folder selection:", retryError);
            }
          }
          
          // If we got here, the recovery failed or this was some other error
          setState(prev => ({
            ...prev,
            isInitialized: false, 
            isLoading: false,
            error: collectionError.message || "Failed to initialize map collections"
          }));
        }
      } catch (error) {
        console.error("Initialization error:", error);
        setState(prev => ({
          ...prev,
          isInitialized: false,
          isLoadingSettings: false,
          isLoading: false,
          error: error.message || "Failed to initialize"
        }));
      }
    }
    
    initialize();
  }, []); // Run once on component mount

  return (
    <InitializationContext.Provider value={state}>
      {children}
    </InitializationContext.Provider>
  );
}

export function useInitialization() {
  return useContext(InitializationContext);
}
