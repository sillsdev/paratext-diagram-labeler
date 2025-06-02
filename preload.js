// preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  loadTermRenderings: (folder) => ipcRenderer.invoke('load-term-renderings', folder),
  selectProjectFolder: () => ipcRenderer.invoke('select-project-folder')
});
