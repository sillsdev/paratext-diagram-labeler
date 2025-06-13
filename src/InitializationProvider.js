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
        
        // Second step: Initialize collections with the paratext path
        console.log("Loading map collections...");
        await collectionManager.initializeAllCollections(settings.paratextProjects);
        
        // Everything is initialized
        setState(prev => ({
          ...prev,
          isInitialized: true,
          isLoading: false
        }));
      } catch (error) {
        console.error("Initialization error:", error);
        setState(prev => ({
          ...prev,
          isInitialized: false,
          isLoadingSettings: false,
          isLoading: false,
          error: error
        }));
      }
    }
    
    initialize();
  }, []);
    // Show loading or error UI while initializing
  if (state.isLoading) {
    return (
      <div className="initializing" style={{ 
        padding: '2rem', 
        textAlign: 'center', 
        fontSize: '1.2rem',
        color: '#444' 
      }}>
        {state.isLoadingSettings ? "Loading application settings..." : "Loading map collections..."}
      </div>
    );
  }
  
  if (state.error) {
    return (
      <div className="initialization-error" style={{ 
        padding: '2rem', 
        textAlign: 'center', 
        color: '#d32f2f' 
      }}>
        <h2>Error Loading Map Collections</h2>
        <p>{state.error.message || 'Unknown error'}</p>
        <button onClick={() => window.location.reload()}>
          Retry
        </button>
      </div>
    );
  }
  
  return (
    <InitializationContext.Provider value={state}>
      {children}
    </InitializationContext.Provider>
  );
}

export function useInitialization() {
  return useContext(InitializationContext);
}
