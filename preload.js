// preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  loadTermRenderings: (folder, saveToDemo) =>
    ipcRenderer.invoke('load-term-renderings', folder, saveToDemo),

  saveTermRenderings: (folder, saveToDemo, data) =>
    ipcRenderer.invoke('save-term-renderings', folder, saveToDemo, data),

  selectProjectFolder: () => ipcRenderer.invoke('select-project-folder'),

  getFilteredVerses: (folder, curRefs) =>
    ipcRenderer.invoke('get-filtered-verses', folder, curRefs),

  loadFromJson: (jsonPath, jsonFilename) =>
    ipcRenderer.invoke('load-from-json', jsonPath, jsonFilename),

  saveToJson: (jsonPath, jsonFilename, settings) =>
    ipcRenderer.invoke('save-to-json', jsonPath, jsonFilename, settings),

  statPath: path => ipcRenderer.invoke('stat-path', path),  loadImage: imagePath => ipcRenderer.invoke('load-image', imagePath),

  exportDataMerge: (data) => ipcRenderer.invoke('export-data-merge', data),
});
