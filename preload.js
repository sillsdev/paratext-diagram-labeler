// preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  loadTermRenderings: (folder, saveToDemo) =>
    ipcRenderer.invoke('load-term-renderings', folder, saveToDemo),

  saveTermRenderings: (folder, saveToDemo, data) =>
    ipcRenderer.invoke('save-term-renderings', folder, saveToDemo, data),

  selectProjectFolder: () => ipcRenderer.invoke('select-project-folder'),

  discoverParatextProjects: () => ipcRenderer.invoke('discover-paratext-projects'),

  getFilteredVerses: (folder, curRefs) =>
    ipcRenderer.invoke('get-filtered-verses', folder, curRefs),

  loadFromJson: (jsonPath, jsonFilename) =>
    ipcRenderer.invoke('load-from-json', jsonPath, jsonFilename),

  loadTermsFromJson: (jsonPath, jsonFilename, projectFolder) =>
    ipcRenderer.invoke('load-terms-from-json', jsonPath, jsonFilename, projectFolder),

  saveToJson: (jsonPath, jsonFilename, settings) =>
    ipcRenderer.invoke('save-to-json', jsonPath, jsonFilename, settings),

  statPath: path => ipcRenderer.invoke('stat-path', path),

  loadImage: imagePath => ipcRenderer.invoke('load-image', imagePath),

  loadImageWithFallback: (templateFolder, templateName, filename, languageCode, isPreview) =>
    ipcRenderer.invoke('load-image-with-fallback', { templateFolder, templateName, filename, languageCode, isPreview }),

  exportDataMerge: data => ipcRenderer.invoke('export-data-merge', data),

  getDefaultTemplateFolder: () => ipcRenderer.invoke('getDefaultTemplateFolder'),

  readFile: filePath => ipcRenderer.invoke('read-file', filePath),

  broadcastReference: reference => ipcRenderer.invoke('broadcast-reference', reference),

  restoreWindowFocus: () => ipcRenderer.invoke('restore-window-focus'),

  // selectTemplateFile: () => ipcRenderer.invoke('select-template-file'),

  discoverCollections: templateFolderPath =>
    ipcRenderer.invoke('discover-collections', templateFolderPath),

  loadLabelsFromIdmlTxt: (projectFolder, templateName) =>
    ipcRenderer.invoke('load-labels-from-idml-txt', projectFolder, templateName),

  saveLabelsToIdmlTxt: (projectFolder, templateName, labels) =>
    ipcRenderer.invoke('save-labels-to-idml-txt', projectFolder, templateName, labels),

  // Path utilities
  path: {
    join: (...paths) => ipcRenderer.invoke('path-join', ...paths),
  },

  // File system utilities
  fileExists: (filePath) => ipcRenderer.invoke('file-exists', filePath),

  // Add listener for fit-map event from menu
  onFitMap: (callback) => ipcRenderer.on('fit-map', callback),
  
  // Remove listener for fit-map event
  removeFitMapListener: (callback) => ipcRenderer.removeListener('fit-map', callback),

  // Add listeners for navigation events from menu
  onNextLabel: (callback) => ipcRenderer.on('next-label', callback),
  onPreviousLabel: (callback) => ipcRenderer.on('previous-label', callback),
  
  // Remove listeners for navigation events
  removeNextLabelListener: (callback) => ipcRenderer.removeListener('next-label', callback),
  removePreviousLabelListener: (callback) => ipcRenderer.removeListener('previous-label', callback),
});
