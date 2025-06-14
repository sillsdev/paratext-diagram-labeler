/* // filepath: c:\git\mapLabelerExt\biblical-map-app\src\InitializationProvider.js
import React, { createContext, useContext, useState, useEffect } from 'react';
import { collectionManager } from './CollectionManager';

const InitializationContext = createContext({
  isInitialized: false,
  settings: null,
  error: null
});

export function InitializationProvider({ children, settings }) {
  const [state, setState] = useState({
    isInitialized: false,
    isLoading: true,
    settings: settings, // Use the settings passed as props
    error: null
  });
    useEffect(() => {
    async function initializeCollections() {
      try {
        if (!settings) {
          return;
        }
        // Load collections using the provided settings
        console.log("Loading map collections...");
        
        // Make sure we have the required settings
        if (!settings || !settings.templateFolder) {
          console.error("Template folder setting is missing", settings);
          throw new Error("Template folder setting is missing");
        }
        
        try {
          await collectionManager.initializeAllCollections(
            settings.paratextProjects,
            settings.templateFolder
          );
          
          // Collections successfully initialized
          setState(prev => ({
            ...prev,
            isInitialized: true,
            isLoading: false
          }));
        } catch (collectionError) {
          console.error("Failed to initialize map collections:", collectionError);
          
          // Check if this is a template folder issue
          if (collectionError.message && collectionError.message.includes('Template folder not found')) {
            // This would now be handled in the PreLaunchScreen or settings validation
            // We just report the error here
            setState(prev => ({
              ...prev,
              isInitialized: false, 
              isLoading: false,
              error: "Template folder not found. Please check your settings."
            }));
          } else {
            // Some other error occurred
            setState(prev => ({
              ...prev,
              isInitialized: false, 
              isLoading: false,
              error: collectionError.message || "Failed to initialize map collections"
            }));
          }
        }
      } catch (error) {
        console.error("Initialization error:", error);
        setState(prev => ({
          ...prev,
          isInitialized: false,
          isLoading: false,
          error: error.message || "Failed to initialize"
        }));
      }
    }
    
    initializeCollections();
  }, [settings]); // Depend on settings prop

  return (
    <InitializationContext.Provider value={state}>
      {children}
    </InitializationContext.Provider>
  );
}

export function useInitialization() {
  return useContext(InitializationContext);
}
 */