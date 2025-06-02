const { app, BrowserWindow } = require('electron');
const { initialize, enable } = require('@electron/remote/main');
const { ipcMain, dialog } = require('electron');
const fs = require('fs');
const path = require('path');

initialize();

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 900,
    webPreferences: {
      nodeIntegration: false, // more secure
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  enable(win.webContents);
  // For development: load React dev server
  win.loadURL('http://localhost:3000');
  // For production: load built files
  // win.loadFile(path.join(__dirname, 'build', 'index.html'));
}

ipcMain.handle('load-term-renderings', async (event, projectFolder) => {
  try {
    const filePath = path.join(projectFolder, 'term-renderings.json');
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
  } catch (e) {
    return { error: e.message };
  }
});

ipcMain.handle('save-term-renderings', async (event, projectFolder, data) => {
  try {
    const filePath = path.join(projectFolder, 'term-renderings.json');
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    return { success: true };
  } catch (e) {
    return { error: e.message };
  }
});

ipcMain.handle('select-project-folder', async (event) => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory'],
  });
  if (result.canceled || !result.filePaths.length) {
    return null;
  }
  return result.filePaths[0];
});

ipcMain.handle('get-filtered-verses', async (event, projectFolder, curRefs) => {
  try {
    const filePath = path.join(projectFolder, 'all_verses.json');
    const allVerses = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const filtered = Object.fromEntries(
      curRefs.filter(ref => allVerses.hasOwnProperty(ref)).map(ref => [ref, allVerses[ref]])
    );
    return filtered;
  } catch (e) {
    return { error: e.message };
  }
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
