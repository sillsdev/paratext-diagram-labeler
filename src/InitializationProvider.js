import React, { createContext, useContext, useState, useEffect } from 'react';
import { collectionManager } from './CollectionManager';

const InitializationContext = createContext({
  isInitialized: false,
  error: null
});

export function InitializationProvider({ children }) {
  const [state, setState] = useState({
    isInitialized: false,
    isLoading: true,
    error: null
  });
  
  useEffect(() => {
    async function initialize() {
      try {
        await collectionManager.initializeAllCollections();
        setState({
          isInitialized: true,
          isLoading: false,
          error: null
        });
      } catch (error) {
        setState({
          isInitialized: false,
          isLoading: false,
          error
        });
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
        Loading map collections...
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
