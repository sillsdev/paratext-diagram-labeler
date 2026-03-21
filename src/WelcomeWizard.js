import React, { useState } from 'react';
import { inLang } from './Utils.js';
import uiStr from './data/ui-strings.json';

/**
 * Welcome wizard shown on first launch.
 * Asks the user which map software they use (for the format filter default)
 * and optionally collects template folder paths.
 *
 * Props:
 *   open          – boolean, whether to render
 *   onDone        – function(formatPref: string, paths: string[])
 *   lang          – language code
 *   initialPaths  – existing templatePaths array (may already be non-empty)
 */
export default function WelcomeWizard({ open, onDone, lang, initialPaths = [] }) {
  const [step, setStep] = useState(0);               // 0 = format, 1 = paths
  const [formatPref, setFormatPref] = useState('any'); // 'any' | 'mapx' | 'idml'
  const [paths, setPaths] = useState(initialPaths);

  const electronAPI = window.electronAPI;

  const handleAddPath = async () => {
    if (!electronAPI?.selectProjectFolder) return;
    try {
      const selected = await electronAPI.selectProjectFolder();
      if (selected && !paths.includes(selected)) {
        setPaths(prev => [...prev, selected]);
      }
    } catch (err) {
      console.error('[WelcomeWizard] Error selecting folder:', err);
    }
  };

  const handleRemovePath = (p) => {
    setPaths(prev => prev.filter(x => x !== p));
  };

  const handleDone = () => {
    onDone(formatPref, paths);
  };

  if (!open) return null;

  const formatOptions = [
    { value: 'any',  label: inLang(uiStr.welcomeBothFormats,    lang) },
    { value: 'mapx', label: inLang(uiStr.welcomeMapCreatorOnly,  lang) },
    { value: 'idml', label: inLang(uiStr.welcomeInDesignOnly,    lang) },
  ];

  return (
    <div
      style={{
        position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
        background: 'rgba(0,0,0,0.55)', zIndex: 2000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div
        style={{
          background: '#fff', borderRadius: 10, padding: '32px 36px',
          minWidth: 440, maxWidth: 560, boxShadow: '0 6px 40px rgba(0,0,0,0.35)',
          display: 'flex', flexDirection: 'column', gap: 18,
        }}
      >
        {/* Step indicator */}
        <div style={{ display: 'flex', gap: 6, alignSelf: 'center' }}>
          {[0, 1].map(i => (
            <div
              key={i}
              style={{
                width: 10, height: 10, borderRadius: '50%',
                background: i === step ? '#1a5276' : '#ccc',
                transition: 'background 0.2s',
              }}
            />
          ))}
        </div>

        {step === 0 ? (
          /* ── Step 0: Format preference ── */
          <>
            <h2 style={{ margin: 0, fontSize: '1.35em', color: '#1a5276' }}>
              {inLang(uiStr.welcomeTitle, lang)}
            </h2>
            <p style={{ margin: 0, color: '#555', fontSize: '0.95em' }}>
              {inLang(uiStr.welcomeIntro, lang)}
            </p>
            <p style={{ margin: 0, fontWeight: 'bold', marginTop: 4 }}>
              {inLang(uiStr.welcomeFormatQuestion, lang)}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {formatOptions.map(opt => (
                <label
                  key={opt.value}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '10px 14px', borderRadius: 7, cursor: 'pointer',
                    border: `2px solid ${formatPref === opt.value ? '#1a5276' : '#d0d0d0'}`,
                    background: formatPref === opt.value ? '#eaf2ff' : '#fafafa',
                    fontWeight: formatPref === opt.value ? '600' : 'normal',
                    transition: 'border-color 0.15s, background 0.15s',
                  }}
                >
                  <input
                    type="radio"
                    name="formatPref"
                    value={opt.value}
                    checked={formatPref === opt.value}
                    onChange={() => setFormatPref(opt.value)}
                    style={{ accentColor: '#1a5276', width: 16, height: 16 }}
                  />
                  {opt.label}
                </label>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
              <button
                onClick={() => setStep(1)}
                style={{
                  padding: '8px 24px', background: '#1a5276', color: 'white',
                  border: 'none', borderRadius: 6, fontSize: '1em', cursor: 'pointer',
                  boxShadow: '0 2px 6px rgba(26,82,118,0.3)',
                }}
              >
                {inLang(uiStr.welcomeNext, lang)} →
              </button>
            </div>
          </>
        ) : (
          /* ── Step 1: Template folder paths ── */
          <>
            <h2 style={{ margin: 0, fontSize: '1.35em', color: '#1a5276' }}>
              {inLang(uiStr.welcomePathsTitle, lang)}
            </h2>
            <p style={{ margin: 0, color: '#555', fontSize: '0.9em', lineHeight: 1.5 }}>
              {inLang(uiStr.welcomePathsDesc, lang)}
            </p>

            {/* Paths list */}
            <div
              style={{
                border: '1px solid #ccc', borderRadius: 5,
                padding: 8, minHeight: 60, maxHeight: 160,
                overflowY: 'auto', background: '#f9f9f9',
              }}
            >
              {paths.length === 0 ? (
                <div style={{ color: '#999', fontStyle: 'italic', textAlign: 'center', paddingTop: 14, fontSize: '0.9em' }}>
                  No folders added yet
                </div>
              ) : (
                paths.map((p, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      marginBottom: 4, padding: '4px 8px',
                      background: 'white', borderRadius: 3, border: '1px solid #e0e0e0',
                    }}
                  >
                    <span style={{ flex: 1, fontSize: '0.82em', wordBreak: 'break-all', color: '#333' }}>
                      {p}
                    </span>
                    <button
                      onClick={() => handleRemovePath(p)}
                      style={{
                        padding: '2px 7px', fontSize: '0.8em',
                        background: '#e53935', color: 'white',
                        border: 'none', borderRadius: 3, cursor: 'pointer',
                        flexShrink: 0,
                      }}
                    >
                      ✕
                    </button>
                  </div>
                ))
              )}
            </div>

            <button
              onClick={handleAddPath}
              style={{
                padding: '6px 14px', background: '#0077cc', color: 'white',
                border: 'none', borderRadius: 5, cursor: 'pointer',
                alignSelf: 'flex-start', fontSize: '0.9em',
              }}
            >
              + {inLang(uiStr.welcomeAddFolder, lang)}
            </button>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
              <button
                onClick={() => setStep(0)}
                style={{
                  padding: '8px 16px', background: '#f0f0f0', color: '#444',
                  border: '1px solid #ccc', borderRadius: 6, cursor: 'pointer', fontSize: '0.95em',
                }}
              >
                ← {inLang(uiStr.welcomeBack, lang)}
              </button>
              <button
                onClick={handleDone}
                style={{
                  padding: '8px 24px', background: '#27ae60', color: 'white',
                  border: 'none', borderRadius: 6, fontSize: '1em', cursor: 'pointer',
                  boxShadow: '0 2px 6px rgba(39,174,96,0.3)',
                }}
              >
                {inLang(uiStr.welcomeGetStarted, lang)} →
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
