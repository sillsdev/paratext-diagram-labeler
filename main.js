const { app, BrowserWindow } = require('electron');
const { initialize, enable } = require('@electron/remote/main');
const { ipcMain, dialog } = require('electron');
const fs = require('fs');
const path = require('path');
const xml2js = require('xml2js');

// Initialize electron remote
initialize();

// Handle creating/removing shortcuts on Windows when installing/uninstalling
if (require('electron-squirrel-startup')) {
  app.quit();
}

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
  
  // Check if we're in development or production
  const isDev = process.env.NODE_ENV === 'development';
  
  if (isDev) {
    // For development: load React dev server
    win.loadURL('http://localhost:3000');
  } else {
    // For production: load built files
    const indexPath = path.join(__dirname, 'index.html');
    console.log('Loading index from:', indexPath);
    win.loadFile(indexPath);
  }
}

// This method will be called when Electron has finished initialization
app.whenReady().then(createWindow);

// Quit when all windows are closed, except on macOS
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On macOS it's common to re-create a window when the dock icon is clicked
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Import all the main process code from the original electron-main.js
const originalMain = require('./electron-main-original');
