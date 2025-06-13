// preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  loadTermRenderings: (folder) => ipcRenderer.invoke('load-term-renderings', folder),
  selectProjectFolder: () => ipcRenderer.invoke('select-project-folder'),
  getFilteredVerses: (folder, curRefs) => ipcRenderer.invoke('get-filtered-verses', folder, curRefs),
  saveTermRenderings: (folder, data) => ipcRenderer.invoke('save-term-renderings', folder, data),
  loadFromJson: (jsonPath, jsonFilename) => ipcRenderer.invoke('load-from-json', jsonPath, jsonFilename),
  saveToJson: (jsonPath, jsonFilename, settings) => ipcRenderer.invoke('save-to-json', jsonPath, jsonFilename, settings),
  statPath: (path) => ipcRenderer.invoke('stat-path', path)
});
