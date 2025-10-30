import supportedLanguages from './data/ui-languages.json';
import { inLang } from './Utils.js';
import uiStr from './data/ui-strings.json';
import packageInfo from '../package.json';

// Settings Modal Dialog
export default function SettingsModal({ 
  open, 
  onClose, 
  labelScale, 
  setLabelScale, 
  labelOpacity, 
  setLabelOpacity, 
  lang, 
  setLang, 
  showFrac, 
  setShowFrac,
  mapxPaths,
  setMapxPaths
}) {
  const electronAPI = window.electronAPI;
  
  const handleAddMapxPath = async () => {
    if (!electronAPI) {
      alert('File selection not supported in web environment');
      return;
    }
    
    try {
      const selectedPath = await electronAPI.selectProjectFolder();
      if (selectedPath && !mapxPaths.includes(selectedPath)) {
        setMapxPaths([...mapxPaths, selectedPath]);
      }
    } catch (error) {
      console.error('Error selecting MAPX folder:', error);
      alert('Error selecting folder: ' + error.message);
    }
  };

  const handleRemoveMapxPath = (pathToRemove) => {
    setMapxPaths(mapxPaths.filter(path => path !== pathToRemove));
  };

  if (!open) return null;
  return (
    <div
      className="modal-overlay"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        background: 'rgba(0,0,0,0.2)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        className="modal-content"
        style={{
          background: '#fff',
          borderRadius: 8,
          padding: 24,
          minWidth: 320,
          maxWidth: 600,
          boxShadow: '0 2px 16px rgba(0,0,0,0.2)',
        }}
      >
        <h2 style={{ marginTop: 0, textAlign: 'center' }}>{inLang(uiStr.settings, lang)}</h2>

        <div style={{ marginBottom: 16, textAlign: 'center' }}>
          <label style={{ fontWeight: 'bold', marginRight: 8, textAlign: 'center' }}>
            {inLang(uiStr.labelSize, lang)}:
          </label>
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
        <div style={{ marginBottom: 16, textAlign: 'center' }}>
          <label style={{ fontWeight: 'bold', marginRight: 8, textAlign: 'center' }}>
            {inLang(uiStr.labelOpacity, lang)}:
          </label>
          <input
            type="range"
            min={10}
            max={100}
            step={1}
            value={labelOpacity}
            onChange={e => setLabelOpacity(parseFloat(e.target.value))}
            style={{ verticalAlign: 'middle', marginRight: 8 }}
          />
          <span>{labelOpacity.toFixed(0)}%</span>
        </div>
        <div style={{ marginBottom: 16, textAlign: 'center' }}>
          <label style={{ fontWeight: 'bold', marginRight: 8 }}>
            {inLang(uiStr.language, lang)}:
          </label>{' '}
          <select
            value={lang}
            onChange={e => {
              const newLang = e.target.value;
              // Update state in parent component, which will trigger the useEffect
              // in App.js to save it to settings and maintain consistency
              setLang(newLang);
            }}
            style={{
              fontSize: 15,
              padding: '2px 8px',
              borderRadius: 4,
              width: 'auto',
              minWidth: '120px',
            }}
          >
            {supportedLanguages.map(ling => (
              <option key={ling.code} value={ling.code}>
                {ling.name}
              </option>
            ))}          </select>
        </div>
        <div style={{ marginBottom: 16, textAlign: 'center' }}>
          <label style={{ fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <input
              type="checkbox"
              checked={showFrac}
              onChange={e => setShowFrac(e.target.checked)}
              style={{ transform: 'scale(1.2)' }}
            />
            {inLang(uiStr.showTallyFractions, lang)}
          </label>
        </div>

        {/* MAPX Paths Section */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 'bold', marginBottom: 8, textAlign: 'center' }}>
            {inLang(uiStr.mapxPaths, lang)}:
          </div>
          <div style={{ 
            border: '1px solid #ccc', 
            borderRadius: 4, 
            padding: 8, 
            minHeight: 60,
            maxHeight: 120,
            overflowY: 'auto',
            backgroundColor: '#f9f9f9',
            marginBottom: 8
          }}>
            {mapxPaths.length === 0 ? (
              <div style={{ color: '#666', fontStyle: 'italic', textAlign: 'center' }}>
                No MAPX paths configured
              </div>
            ) : (
              mapxPaths.map((path, index) => (
                <div key={index} style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  marginBottom: 4, 
                  padding: 4,
                  backgroundColor: 'white',
                  borderRadius: 2,
                  border: '1px solid #ddd'
                }}>
                  <span style={{ 
                    flex: 1, 
                    fontSize: '0.9em', 
                    wordBreak: 'break-all' 
                  }}>
                    {path}
                  </span>
                  <button
                    onClick={() => handleRemoveMapxPath(path)}
                    style={{
                      marginLeft: 8,
                      padding: '2px 6px',
                      fontSize: '0.8em',
                      backgroundColor: '#ff4444',
                      color: 'white',
                      border: 'none',
                      borderRadius: 3,
                      cursor: 'pointer'
                    }}
                  >
                    {inLang(uiStr.removeMapxPath, lang)}
                  </button>
                </div>
              ))
            )}
          </div>
          <div style={{ textAlign: 'center' }}>
            <button
              onClick={handleAddMapxPath}
              style={{
                padding: '6px 12px',
                fontSize: '0.9em',
                backgroundColor: '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: 4,
                cursor: 'pointer'
              }}
            >
              {inLang(uiStr.addMapxPath, lang)}
            </button>
          </div>
        </div>
        
        {/* Version information */}
        <div style={{ 
          marginTop: 20, 
          paddingTop: 16, 
          paddingBottom: 16,
          borderTop: '1px solid #eee',
          fontSize: '0.85em',
          color: '#666',
          textAlign: 'center'
        }}>
          {inLang(uiStr.paratextDiagramLabeler, lang)} (PT9 standalone edition) v. {packageInfo.version}-beta
        </div>
        
        <div style={{ textAlign: 'center' }}>
          <button onClick={onClose} style={{ fontSize: 15, padding: '4px 16px', borderRadius: 4 }}>
            {inLang(uiStr.close, lang)}
          </button>
        </div>
      </div>
    </div>
  );
}
