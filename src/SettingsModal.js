import { useState, useEffect } from 'react';
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
  templatePaths,
  setTemplatePaths,
  projectFolder,
  collectionId,
  collectionsFolder
}) {
  const electronAPI = window.electronAPI;
  const [numberScript, setNumberScript] = useState('Latn');
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importTargetLanguages, setImportTargetLanguages] = useState([]);
  const [selectedTargetLanguage, setSelectedTargetLanguage] = useState('');
  const [importXmlPath, setImportXmlPath] = useState('');
  
  // Number script options with sample digits
  const numberScriptOptions = [
    { value: 'Latn', label: 'European (Western Arabic) [0123456789]' },
    { value: 'Arab', label: 'Arabic (Eastern Arabic) [٠١٢٣٤٥٦٧٨٩]' },
    { value: 'Deva', label: 'Devanagari [०१२३४५६७८९]' },
    { value: 'Beng', label: 'Bengali [০১২৩৪৫৬৭৮৯]' },
    { value: 'Guru', label: 'Gurmukhi [੦੧੨੩੪੫੬੭੮੯]' },
    { value: 'Gujr', label: 'Gujarati [૦૧૨૩૪૫૬૭૮૯]' },
    { value: 'Orya', label: 'Odia [୦୧୨୩୪୫୬୭୮୯]' },
    { value: 'Taml', label: 'Tamil [௦௧௨௩௪௫௬௭௮௯]' },
    { value: 'Telu', label: 'Telugu [౦౧౨౩౪౫౬౭౮౯]' },
    { value: 'Knda', label: 'Kannada [೦೧೨೩೪೫೬೭೮೯]' },
    { value: 'Mlym', label: 'Malayalam [൦൧൨൩൪൫൬൭൮൯]' },
    { value: 'Thai', label: 'Thai [๐๑๒๓๔๕๖๗๘๙]' },
    { value: 'Laoo', label: 'Lao [໐໑໒໓໔໕໖໗໘໙]' },
    { value: 'Tibt', label: 'Tibetan [༠༡༢༣༤༥༦༧༨༩]' },
    { value: 'Mymr', label: 'Myanmar [၀၁၂၃၄၅၆၇၈၉]' },
    { value: 'Aran', label: 'Arabic (Perso-Arabic) [٠١٢٣٤٥٦٧٨٩]' },
    { value: 'Arabext', label: 'Arabic Extended [۰۱۲۳۴۵۶۷۸۹]' }
  ];
  
  // Load project settings when modal opens
  useEffect(() => {
    if (open && projectFolder && electronAPI?.getProjectSettings) {
      electronAPI.getProjectSettings(projectFolder).then(settings => {
        setNumberScript(settings.digits || 'Latn');
      }).catch(error => {
        console.error('Failed to load project settings:', error);
      });
    }
  }, [open, projectFolder, electronAPI]);
  
  const handleNumberScriptChange = async (newScript) => {
    setNumberScript(newScript);
    if (projectFolder && electronAPI?.setProjectSettings) {
      try {
        const result = await electronAPI.setProjectSettings(projectFolder, { digits: newScript });
        if (!result.success) {
          console.error('Failed to save number script:', result.error);
          alert('Failed to save number script: ' + result.error);
        }
      } catch (error) {
        console.error('Error saving number script:', error);
        alert('Error saving number script: ' + error.message);
      }
    }
  };
  
  const handleAddTemplatePath = async () => {
    if (!electronAPI) {
      alert('File selection not supported in web environment');
      return;
    }
    
    try {
      const selectedPath = await electronAPI.selectProjectFolder();
      if (selectedPath && !templatePaths.includes(selectedPath)) {
        setTemplatePaths([...templatePaths, selectedPath]);
      }
    } catch (error) {
      console.error('Error selecting template folder:', error);
      alert('Error selecting folder: ' + error.message);
    }
  };

  const handleRemoveTemplatePath = (pathToRemove) => {
    setTemplatePaths(templatePaths.filter(path => path !== pathToRemove));
  };

  const handleImportMapCreatorDictionary = async () => {
    if (!electronAPI?.selectXmlFile) {
      alert('File selection not supported');
      return;
    }
    
    try {
      const xmlPath = await electronAPI.selectXmlFile();
      if (!xmlPath) return;
      
      // Parse XML to get target languages
      const targetLanguages = await electronAPI.parseMapCreatorDictionary(xmlPath);
      if (!targetLanguages || targetLanguages.length === 0) {
        alert('No target languages found with en_US source in the selected file.');
        return;
      }
      
      setImportXmlPath(xmlPath);
      setImportTargetLanguages(targetLanguages);
      setSelectedTargetLanguage(targetLanguages[0]);
      setShowImportDialog(true);
    } catch (error) {
      console.error('Error selecting XML file:', error);
      alert('Error reading XML file: ' + error.message);
    }
  };

  const handleConfirmImport = async () => {
    if (!selectedTargetLanguage || !importXmlPath) return;
    
    try {
      const result = await electronAPI.importMapCreatorDictionary({
        xmlPath: importXmlPath,
        targetLanguage: selectedTargetLanguage,
        projectFolder: projectFolder,
        collectionId: collectionId,
        collectionsFolder: collectionsFolder
      });
      
      if (result.success) {
        alert(`Successfully imported ${result.count} items into the Labeler dictionary.`);
        setShowImportDialog(false);
      } else {
        alert('Import failed: ' + (result.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error importing dictionary:', error);
      alert('Import error: ' + error.message);
    }
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

        {/* MAPX and IDML Paths Section */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 'bold', marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <span>{inLang(uiStr.templatePaths, lang)}:</span>
            <button
              onClick={handleAddTemplatePath}
              title={inLang(uiStr.addTemplatePath, lang)}
              style={{
                padding: '2px 8px',
                fontSize: '1.2em',
                backgroundColor: '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: 4,
                cursor: 'pointer',
                lineHeight: 1
              }}
            >
              +
            </button>
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
            {templatePaths.length === 0 ? (
              <div style={{ color: '#666', fontStyle: 'italic', textAlign: 'center' }}>
                No template paths configured
              </div>
            ) : (
              templatePaths.map((path, index) => (
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
                    onClick={() => handleRemoveTemplatePath(path)}
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
                    {inLang(uiStr.remove, lang)}
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
        
        {/* Project Settings */}
        {projectFolder && (
          <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid #eee' }}>
            <h3 style={{ marginTop: 0, marginBottom: 12, fontSize: '1.1em' }}>
              {inLang(uiStr.projectSettings, lang)}
            </h3>
            <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <label style={{ fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                {inLang(uiStr.numberScript, lang)}:
              </label>
              <select
                value={numberScript}
                onChange={(e) => handleNumberScriptChange(e.target.value)}
                style={{
                  flex: 1,
                  padding: '4px 8px',
                  fontSize: '0.9em',
                  borderRadius: 4,
                  border: '1px solid #ccc'
                }}
              >
                {numberScriptOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ marginBottom: 16, textAlign: 'center' }}>
              <button
                onClick={handleImportMapCreatorDictionary}
                disabled={!projectFolder}
                style={{
                  padding: '6px 12px',
                  fontSize: '0.9em',
                  backgroundColor: projectFolder ? '#28a745' : '#ccc',
                  color: 'white',
                  border: 'none',
                  borderRadius: 4,
                  cursor: projectFolder ? 'pointer' : 'not-allowed'
                }}
              >
                Import Map Creator dictionary
              </button>
            </div>
          </div>
        )}
        
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
      
      {/* Import Dialog */}
      {showImportDialog && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            background: 'rgba(0,0,0,0.4)',
            zIndex: 2000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 8,
              padding: 24,
              minWidth: 400,
              boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
            }}
          >
            <h3 style={{ marginTop: 0, marginBottom: 16 }}>Import Map Creator Dictionary</h3>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: 8 }}>
              Select the target language to import into the Labeler dictionary:
            </label>
            <select
              value={selectedTargetLanguage}
              onChange={(e) => setSelectedTargetLanguage(e.target.value)}
              style={{
                width: '100%',
                padding: '8px',
                fontSize: '1em',
                borderRadius: 4,
                border: '1px solid #ccc',
                marginBottom: 20
              }}
            >
              {importTargetLanguages.map(lang => (
                <option key={lang} value={lang}>
                  {lang}
                </option>
              ))}
            </select>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowImportDialog(false)}
                style={{
                  padding: '6px 16px',
                  fontSize: '0.95em',
                  backgroundColor: '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: 4,
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmImport}
                style={{
                  padding: '6px 16px',
                  fontSize: '0.95em',
                  backgroundColor: '#007bff',
                  color: 'white',
                  border: 'none',
                  borderRadius: 4,
                  cursor: 'pointer'
                }}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
