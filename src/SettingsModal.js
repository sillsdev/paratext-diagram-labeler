import supportedLanguages from './data/ui-languages.json';
import { inLang } from './Utils.js';
import uiStr from './data/ui-strings.json';

// Settings Modal Dialog
export default function SettingsModal ({open, onClose, labelScale, setLabelScale, lang, setLang, projectFolder, handleSelectProjectFolder}) {
  if (!open) return null;
  return (
    <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.2)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="modal-content" style={{ background: '#fff', borderRadius: 8, padding: 24, minWidth: 320, maxWidth: 600, boxShadow: '0 2px 16px rgba(0,0,0,0.2)' }}>
        <h2 style={{ marginTop: 0, textAlign: 'center'  }}>{inLang(uiStr.settings, lang)}</h2>
        {/* Project folder selector UI */}
        {/*}
        <div style={{ padding: '6px 12px', background: '#f0f0f0', borderBottom: '1px solid #ccc', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontWeight: 'bold' }}>Project Folder:</span>
          <span style={{ color: projectFolder ? '#333' : '#888', fontFamily: 'monospace', fontSize: 13, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{projectFolder || '(none selected)'}</span>
          <button onClick={handleSelectProjectFolder} style={{ padding: '2px 10px', borderRadius: 4, border: '1px solid #888', background: '#e3f2fd', cursor: 'pointer' }}>Change…</button>
        </div>
        */}
        <div style={{ marginBottom: 16, textAlign: 'center'  }}>
          <label style={{ fontWeight: 'bold', marginRight: 8, textAlign: 'center'  }}>{inLang(uiStr.labelSize, lang)}:</label>
          <input
            type="range"
            min={0.5}
            max={2}
            step={0.05}
            value={labelScale}
            onChange={e => setLabelScale(parseFloat(e.target.value))}
            style={{ verticalAlign: 'middle', marginRight: 8 }}
          />
          <span>{labelScale.toFixed(2)}x</span>
        </div>
        <div style={{ marginBottom: 16, textAlign: 'center'  }}>
          <label style={{ fontWeight: 'bold', marginRight: 8 }}>{inLang(uiStr.language, lang)}:</label>
          <select
            value={lang}
            onChange={e => {
              setLang(e.target.value);
              localStorage.setItem('lang', e.target.value);
            }}
            style={{ fontSize: 15, padding: '2px 8px', borderRadius: 4 }}
          >
            {supportedLanguages.map(ling => (
              <option key={ling.code} value={ling.code}>{ling.name}</option>
            ))}
          </select>
        </div>
        <div style={{ textAlign: 'center' }}>
          <button onClick={onClose} style={{ fontSize: 15, padding: '4px 16px', borderRadius: 4 }}>{inLang(uiStr.close, lang)}</button>
        </div>
      </div>
       </div>
  );
};
