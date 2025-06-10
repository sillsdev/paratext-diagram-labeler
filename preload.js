// preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  loadTermRenderings: (folder) => ipcRenderer.invoke('load-term-renderings', folder),
  selectProjectFolder: () => ipcRenderer.invoke('select-project-folder'),
  getFilteredVerses: (folder, curRefs) => ipcRenderer.invoke('get-filtered-verses', folder, curRefs),
  saveTermRenderings: (folder, data) => ipcRenderer.invoke('save-term-renderings', folder, data),

});
