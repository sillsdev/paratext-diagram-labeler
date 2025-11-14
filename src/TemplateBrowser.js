import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { collectionManager } from './CollectionManager';
import { inLang } from './Utils';
import uiStr from './data/ui-strings.json';
import './TemplateBrowser.css';

function checkColorMatch(mapTypes, colorFilter) {
  if (!mapTypes) return false;
  const types = mapTypes.toLowerCase().split(' ');
  
  switch (colorFilter) {
    case 'color':
      return types.some(t => t.startsWith('fc') || t.startsWith('mc'));
    case 'bluebrown':
      return types.some(t => t.startsWith('bb'));
    case 'grayscale':
      return types.some(t => t.startsWith('bw'));
    default:
      return true;
  }
}

function checkTextureMatch(mapTypes, textureFilter) {
  if (!mapTypes) return false;
  const types = mapTypes.toLowerCase().split(' ');
  
  switch (textureFilter) {
    case 'relief':
      return types.some(t => t.endsWith('r'));
    case 'flat':
      return types.some(t => t.endsWith('f'));
    default:
      return true;
  }
}

export default function TemplateBrowser({ 
  open, 
  onClose, 
  onSelectDiagram,
  onSelectGroup,
  lang,
  projectFolder,
  templateFolder,
  initialFilters = {},
  initialSelectedTemplate = null
}) {
  const [selectedTemplate, setSelectedTemplate] = useState(initialSelectedTemplate);
  const [searchTerm, setSearchTerm] = useState(initialFilters.searchTerm || '');
  const [formatFilter, setFormatFilter] = useState(initialFilters.formatFilter || 'any');
  const [collectionFilter, setCollectionFilter] = useState(initialFilters.collectionFilter || 'all');
  const [colorFilter, setColorFilter] = useState(initialFilters.colorFilter || 'any');
  const [textureFilter, setTextureFilter] = useState(initialFilters.textureFilter || 'any');
  const [savedFilter, setSavedFilter] = useState(initialFilters.savedFilter || 'all');
  const [sortColumn, setSortColumn] = useState('collection');
  const [sortDirection, setSortDirection] = useState('asc');
  const [previewImageData, setPreviewImageData] = useState(null);
  const [savedFilesCache, setSavedFilesCache] = useState({});
  const [dividerPosition, setDividerPosition] = useState(50); // Percentage
  const isDragging = useRef(false);
  const selectedRowRef = useRef(null);
  const searchInputRef = useRef(null);

  // Focus search input when browser opens
  useEffect(() => {
    if (open && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [open]);

  // Load saved files cache
  useEffect(() => {
    if (!open || !projectFolder) return;
    
    const checkSavedFiles = async () => {
      const cache = {};
      const collections = collectionManager.getAllCollectionIds();
      
      for (const collectionId of collections) {
        const mapDefs = collectionManager.getMapDefs(collectionId);
        for (const templateName of Object.keys(mapDefs)) {
          try {
            const result = await window.electronAPI.loadLabelsFromIdmlTxt(
              projectFolder, 
              templateName
            );
            cache[templateName] = result.success && result.labels !== null;
          } catch {
            cache[templateName] = false;
          }
        }
      }
      
      setSavedFilesCache(cache);
    };
    
    checkSavedFiles();
  }, [open, projectFolder]);

  // Filter and sort templates
  const filteredTemplates = useMemo(() => {
    if (!open) return [];
    
    let results = [];
    
    // Get all collections
    const collections = collectionFilter === 'all' 
      ? collectionManager.getAllCollectionIds() 
      : [collectionFilter];
    
    collections.forEach(collectionId => {
      const mapDefs = collectionManager.getMapDefs(collectionId);
      
      Object.entries(mapDefs).forEach(([templateName, mapDef]) => {
        let include = true;
        
        // Format filter (formats is a comma-and-space separated string like "idml, mapx")
        if (formatFilter !== 'any') {
          const formats = mapDef.formats?.toLowerCase().split(',').map(f => f.trim()) || [];
          if (!formats.includes(formatFilter.toLowerCase())) {
            include = false;
          }
        }
        
        // Color filter
        if (colorFilter !== 'any' && include) {
          const hasColor = checkColorMatch(mapDef.mapTypes, colorFilter);
          if (!hasColor) include = false;
        }
        
        // Texture filter
        if (textureFilter !== 'any' && include) {
          const hasTexture = checkTextureMatch(mapDef.mapTypes, textureFilter);
          if (!hasTexture) include = false;
        }
        
        // Search term (search in multiple fields)
        if (searchTerm && include) {
          const searchLower = searchTerm.toLowerCase();
          const searchable = [
            mapDef.mapGroup || '',
            mapDef.refs || '',
            inLang(mapDef.title, lang) || '',
            inLang(mapDef.keywords, lang) || '',
            templateName
          ].join(' ').toLowerCase();
          
          if (!searchable.includes(searchLower)) {
            include = false;
          }
        }
        
        // Saved filter
        if (savedFilter === 'saved' && include) {
          if (!savedFilesCache[templateName]) {
            include = false;
          }
        }
        
        if (include) {
          results.push({
            collectionId,
            templateName,
            mapDef
          });
        }
      });
    });
    
    // Apply sorting
    results.sort((a, b) => {
      let aVal, bVal;
      switch (sortColumn) {
        case 'collection':
          // Primary sort by collection, secondary by template name
          if (a.collectionId !== b.collectionId) {
            aVal = a.collectionId;
            bVal = b.collectionId;
          } else {
            aVal = a.templateName.replace(/^[^_]*_/, '');
            bVal = b.templateName.replace(/^[^_]*_/, '');
          }
          break;
        case 'template':
          aVal = a.templateName.replace(/^[^_]*_/, '');
          bVal = b.templateName.replace(/^[^_]*_/, '');
          break;
        case 'title':
          aVal = inLang(a.mapDef.title, lang) || '';
          bVal = inLang(b.mapDef.title, lang) || '';
          break;
        default:
          return 0;
      }
      
      const comparison = aVal.localeCompare(bVal);
      return sortDirection === 'asc' ? comparison : -comparison;
    });
    
    return results;
  }, [open, searchTerm, formatFilter, collectionFilter, colorFilter, textureFilter, 
      savedFilter, sortColumn, sortDirection, lang, savedFilesCache]);

  // Auto-select first item when filtered list changes and current selection is not in the list
  const prevFilteredTemplatesRef = useRef(filteredTemplates);
  useEffect(() => {
    if (!open || filteredTemplates.length === 0) {
      if (selectedTemplate !== null) {
        setSelectedTemplate(null);
      }
      prevFilteredTemplatesRef.current = filteredTemplates;
      return;
    }

    // Only run selection logic if filteredTemplates changed
    if (prevFilteredTemplatesRef.current !== filteredTemplates) {
      // Check if current selection is in the filtered list
      const currentStillExists = selectedTemplate && filteredTemplates.some(
        t => t.templateName === selectedTemplate.templateName && 
             t.collectionId === selectedTemplate.collectionId
      );

      // If no selection or current selection not in list, select first item
      if (!currentStillExists && filteredTemplates[0] !== selectedTemplate) {
        setSelectedTemplate(filteredTemplates[0]);
      }
    }
    prevFilteredTemplatesRef.current = filteredTemplates;
  }, [open, filteredTemplates, selectedTemplate]);

  // Load preview image when selected template changes
  useEffect(() => {
    if (!selectedTemplate || !templateFolder) {
      console.log('[TemplateBrowser] No selected template or templateFolder:', { selectedTemplate, templateFolder });
      setPreviewImageData(null);
      return;
    }

    const imageFilename = selectedTemplate.mapDef.imgFilename;
    if (!imageFilename) {
      console.log('[TemplateBrowser] No imgFilename in mapDef');
      setPreviewImageData(null);
      return;
    }

    let imagePath;
    if (imageFilename.includes('/') || imageFilename.includes('\\')) {
      imagePath = imageFilename;
    } else {
      imagePath = `${templateFolder}/${selectedTemplate.collectionId}/${imageFilename}`;
    }

    console.log('[TemplateBrowser] Loading preview image from:', imagePath);
    
    if (window.electronAPI) {
      window.electronAPI.loadImage(imagePath).then(dataUrl => {
        console.log('[TemplateBrowser] Image loaded:', dataUrl ? `${dataUrl.length} bytes` : 'null');
        if (dataUrl) {
          setPreviewImageData(dataUrl);
        } else {
          console.log('[TemplateBrowser] Image load returned null');
          setPreviewImageData(null);
        }
      }).catch(error => {
        console.log('[TemplateBrowser] Image load error:', error);
        setPreviewImageData(null);
      });
    } else {
      console.log('[TemplateBrowser] electronAPI not available');
    }
  }, [selectedTemplate, templateFolder]);

  // Handle sorting
  const handleSort = (column) => {
    if (sortColumn === column) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  // Handle row click
  const handleRowClick = (template) => {
    setSelectedTemplate(template);
  };

  // Handle row double-click - equivalent to selecting and clicking "Select Diagram"
  const handleRowDoubleClick = (template) => {
    setSelectedTemplate(template);
    handleSelectDiagram();
  };

  // Handle reset filters
  const handleResetFilters = () => {
    setSearchTerm('');
    setFormatFilter('any');
    setCollectionFilter('all');
    setColorFilter('any');
    setTextureFilter('any');
    setSavedFilter('all');
  };

  // Handle select diagram
  const handleSelectDiagram = useCallback(() => {
    if (!selectedTemplate) return;
    
    const currentFilters = {
      searchTerm,
      formatFilter,
      collectionFilter,
      colorFilter,
      textureFilter,
      savedFilter
    };
    
    onSelectDiagram(selectedTemplate, currentFilters, filteredTemplates, -1); // -1 means no group navigation
  }, [selectedTemplate, searchTerm, formatFilter, collectionFilter, colorFilter, 
      textureFilter, savedFilter, filteredTemplates, onSelectDiagram]);

  // Handle select group
  const handleSelectGroup = useCallback(() => {
    if (!selectedTemplate) return;
    
    const currentFilters = {
      searchTerm,
      formatFilter,
      collectionFilter,
      colorFilter,
      textureFilter,
      savedFilter
    };
    
    const currentIndex = filteredTemplates.findIndex(
      t => t.templateName === selectedTemplate.templateName && t.collectionId === selectedTemplate.collectionId
    );
    
    onSelectGroup(selectedTemplate, currentFilters, filteredTemplates, currentIndex);
  }, [selectedTemplate, searchTerm, formatFilter, collectionFilter, colorFilter, 
      textureFilter, savedFilter, filteredTemplates, onSelectGroup]);

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;
    
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedTemplate(prev => {
          const currentIndex = filteredTemplates.findIndex(
            t => t.templateName === prev?.templateName && t.collectionId === prev?.collectionId
          );
          const nextIndex = Math.min(currentIndex + 1, filteredTemplates.length - 1);
          return filteredTemplates[nextIndex] || prev;
        });
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedTemplate(prev => {
          const currentIndex = filteredTemplates.findIndex(
            t => t.templateName === prev?.templateName && t.collectionId === prev?.collectionId
          );
          const nextIndex = Math.max(currentIndex - 1, 0);
          return filteredTemplates[nextIndex] || prev;
        });
      } else if (e.key === 'Enter' && selectedTemplate) {
        e.preventDefault();
        handleSelectDiagram();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, filteredTemplates, selectedTemplate, handleSelectDiagram, onClose]);

  // Scroll selected row into view
  useEffect(() => {
    if (selectedRowRef.current) {
      selectedRowRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [selectedTemplate]);

  // Divider dragging
  const handleDividerMouseDown = useCallback((e) => {
    e.preventDefault();
    isDragging.current = true;
    document.body.style.cursor = 'ew-resize';
    document.body.style.userSelect = 'none';
  }, []);

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDragging.current) return;
      
      const modal = document.querySelector('.template-browser-content');
      if (!modal) return;
      
      const rect = modal.getBoundingClientRect();
      const newPosition = ((e.clientX - rect.left) / rect.width) * 100;
      setDividerPosition(Math.max(30, Math.min(70, newPosition)));
    };

    const handleMouseUp = () => {
      isDragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    if (open) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [open]);

  if (!open) return null;

  const allCollections = collectionManager.getAllCollectionIds();

  return (
    <div className="template-browser-overlay" onClick={onClose}>
      <div className="template-browser-content" onClick={e => e.stopPropagation()}>
        {/* Selection Pane */}
        <div className="template-selection-pane" style={{ width: `${dividerPosition}%` }}>
          {/* Template Details Section */}
          <div className="template-details-section">
            {selectedTemplate ? (
              <>
                <h3 style={{ marginBottom: '8px', fontSize: '16px' }}>
                  {inLang(selectedTemplate.mapDef.title, lang) || selectedTemplate.templateName}
                </h3>
                <div className="template-info" style={{ marginBottom: '8px' }}>
                  <div style={{ marginBottom: '4px', fontSize: '13px', color: '#666' }}>
                    {selectedTemplate.templateName}
                    {selectedTemplate.mapDef.owner && (
                      <> ({selectedTemplate.mapDef.owner})</>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '20px', fontSize: '12px', color: '#888' }}>
                    {selectedTemplate.mapDef.formats && (
                      <div><strong>Formats:</strong> {selectedTemplate.mapDef.formats.toUpperCase()}</div>
                    )}
                    {selectedTemplate.mapDef.mapTypes && (
                      <div><strong>Base Layers:</strong> {selectedTemplate.mapDef.mapTypes.toUpperCase()}</div>
                    )}
                  </div>
                </div>
                <div className="template-actions">
                  <button onClick={handleSelectDiagram} className="select-button">
                    {inLang(uiStr.selectDiagram, lang) || 'Select Diagram'}
                  </button>
                  {filteredTemplates.length > 1 && (
                    <button onClick={handleSelectGroup} className="select-button">
                      {inLang(uiStr.selectGroup, lang) || 'Select Group'}
                    </button>
                  )}
                </div>
              </>
            ) : (
              <>
                <h3 style={{ marginBottom: '8px', fontSize: '16px', color: '#999' }}>
                  {filteredTemplates.length === 0 ? 'No matching items found' : 'Select a template'}
                </h3>
                <div className="template-info" style={{ marginBottom: '8px', minHeight: '40px' }}>
                  <div style={{ marginBottom: '4px', fontSize: '13px', color: '#999' }}>
                    {filteredTemplates.length === 0 
                      ? 'Try adjusting your search or filters'
                      : 'Click a row below to see details'}
                  </div>
                </div>
                <div className="template-actions" style={{ minHeight: '38px' }}>
                </div>
              </>
            )}
          </div>

          {/* Search and Filter Section */}
          <div className="template-filters-section">
            <div className="filter-row">
              <input
                ref={searchInputRef}
                type="text"
                placeholder={inLang(uiStr.searchTemplates, lang) || 'Search templates...'}
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="search-input"
              />
              <button 
                onClick={handleResetFilters}
                className="reset-filters-button"
                title="Reset all filters"
                style={{
                  background: 'none',
                  border: '1px solid #ccc',
                  borderRadius: '3px',
                  cursor: 'pointer',
                  padding: '5px 10px',
                  marginLeft: '5px',
                  fontSize: '16px',
                }}
              >
                🔄
              </button>
            </div>
            <div className="filter-row">
              <select value={formatFilter} onChange={e => setFormatFilter(e.target.value)}>
                <option value="any">{inLang(uiStr.anyFormat, lang) || 'Any Format'}</option>
                <option value="idml">IDML</option>
                <option value="mapx">MAPX</option>
              </select>
              <select value={collectionFilter} onChange={e => setCollectionFilter(e.target.value)}>
                <option value="all">{inLang(uiStr.allCollections, lang) || 'All Collections'}</option>
                {allCollections.map(coll => (
                  <option key={coll} value={coll}>
                    {collectionManager.getCollectionName(coll)} ({coll})
                  </option>
                ))}
              </select>
            </div>
            <div className="filter-row">
              <select value={colorFilter} onChange={e => setColorFilter(e.target.value)}>
                <option value="any">{inLang(uiStr.anyColorMode, lang) || 'Any Color Mode'}</option>
                <option value="color">{inLang(uiStr.fullColor, lang) || 'Full Color'}</option>
                <option value="bluebrown">{inLang(uiStr.blueBrown, lang) || 'Blue & Brown'}</option>
                <option value="grayscale">{inLang(uiStr.grayscale, lang) || 'Grayscale'}</option>
              </select>
              <select value={textureFilter} onChange={e => setTextureFilter(e.target.value)}>
                <option value="any">{inLang(uiStr.anyTexture, lang) || 'Any Texture'}</option>
                <option value="relief">{inLang(uiStr.relief, lang) || 'Relief'}</option>
                <option value="flat">{inLang(uiStr.flat, lang) || 'Flat'}</option>
              </select>
            </div>
            <div className="filter-row">
              <select value={savedFilter} onChange={e => setSavedFilter(e.target.value)}>
                <option value="all">{inLang(uiStr.allTemplates, lang) || 'Saved or not'}</option>
                <option value="saved">{inLang(uiStr.savedOnly, lang) || 'Saved Only'}</option>
              </select>
              <div className="results-count">
                {filteredTemplates.length} {inLang(uiStr.results, lang) || 'results'}
              </div>
            </div>
          </div>

          {/* Results Table */}
          <div className="template-results-section">
            <table className="template-table">
              <thead>
                <tr>
                  <th onClick={() => handleSort('collection')} className="sortable">
                    {inLang(uiStr.collection, lang) || 'Coll'} {sortColumn === 'collection' && (sortDirection === 'asc' ? '▲' : '▼')}
                  </th>
                  <th onClick={() => handleSort('template')} className="sortable">
                    {inLang(uiStr.template, lang) || 'Template'} {sortColumn === 'template' && (sortDirection === 'asc' ? '▲' : '▼')}
                  </th>
                  <th onClick={() => handleSort('title')} className="sortable">
                    {inLang(uiStr.mapTitle, lang) || 'Map Title'} {sortColumn === 'title' && (sortDirection === 'asc' ? '▲' : '▼')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredTemplates.map((template, idx) => {
                  const isSelected = selectedTemplate?.templateName === template.templateName && 
                                   selectedTemplate?.collectionId === template.collectionId;
                  return (
                    <tr
                      key={`${template.collectionId}-${template.templateName}`}
                      ref={isSelected ? selectedRowRef : null}
                      className={isSelected ? 'selected' : ''}
                      onClick={() => handleRowClick(template)}
                      onDoubleClick={() => handleRowDoubleClick(template)}
                    >
                      <td>{template.collectionId}</td>
                      <td>{template.templateName.replace(/^[^_]*_/, '')}</td>
                      <td>{inLang(template.mapDef.title, lang) || ''}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Divider */}
        <div className="template-divider" onMouseDown={handleDividerMouseDown} />

        {/* Preview Pane */}
        <div className="template-preview-pane" style={{ width: `${100 - dividerPosition}%` }}>
          {previewImageData ? (
            <img 
              src={previewImageData} 
              alt="Template Preview" 
              className="template-preview-image"
            />
          ) : (
            <div className="no-preview">
              {inLang(uiStr.noPreviewAvailable, lang) || 'No preview available'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
