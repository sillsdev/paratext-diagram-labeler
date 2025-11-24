import React, { useEffect, useRef } from 'react';

/**
 * Simple modal alert dialog to replace native alert()
 * Prevents keyboard focus issues that occur with Electron's native dialogs
 */
export default function AlertDialog({ message, onClose }) {
  const buttonRef = useRef(null);

  useEffect(() => {
    // Focus the OK button when dialog opens
    if (buttonRef.current) {
      buttonRef.current.focus();
    }

    // Handle Escape key
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' || e.key === 'Enter') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!message) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: '8px',
          padding: '20px',
          minWidth: '300px',
          maxWidth: '500px',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            marginBottom: '20px',
            fontSize: '14px',
            lineHeight: '1.5',
            color: '#333',
          }}
        >
          {message}
        </div>
        <div style={{ textAlign: 'right' }}>
          <button
            ref={buttonRef}
            onClick={onClose}
            style={{
              padding: '8px 24px',
              fontSize: '14px',
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: '500',
            }}
            onMouseEnter={(e) => {
              e.target.style.backgroundColor = '#0056b3';
            }}
            onMouseLeave={(e) => {
              e.target.style.backgroundColor = '#007bff';
            }}
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
