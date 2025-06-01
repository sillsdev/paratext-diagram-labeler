const { app, BrowserWindow } = require('electron');
const { initialize, enable } = require('@electron/remote/main');
const path = require('path');

initialize();

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 900,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: true,
      // preload: path.join(__dirname, 'preload.js'), // For secure IPC in the future
    },
  });

  enable(win.webContents);
  // For development: load React dev server
  win.loadURL('http://localhost:3000');
  // For production: load built files
  // win.loadFile(path.join(__dirname, 'build', 'index.html'));
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
