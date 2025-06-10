// Debug script to test Paratext path detection
const fs = require('fs');
const path = require('path');
const { app, dialog, BrowserWindow } = require('electron');

// Log all steps for debugging
console.log('=== Paratext Path Detection Debugger ===');

let debugWin = null;

// Create a function to show diagnostic information in both console and UI
function logInfo(message) {
  console.log(message);
  if (debugWin && !debugWin.isDestroyed()) {
    debugWin.webContents.executeJavaScript(`
      document.getElementById('log').innerHTML += '<div>${message.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>';
      window.scrollTo(0, document.body.scrollHeight);
    `).catch(err => console.error('Error updating log:', err));
  }
}

// Function to check default path
function checkDefaultPath() {
  const defaultPath = 'C:\\My Paratext 9 Projects';
  logInfo(`Checking default path: ${defaultPath}`);
  
  if (fs.existsSync(defaultPath)) {
    logInfo(`✅ Default path exists: ${defaultPath}`);
    
    // Check for _MapLabelerTemplates folder
    const templatesPath = path.join(defaultPath, '_MapLabelerTemplates');
    if (fs.existsSync(templatesPath)) {
      logInfo(`✅ _MapLabelerTemplates folder exists: ${templatesPath}`);
      return { exists: true, path: defaultPath };
    } else {
      logInfo(`❌ _MapLabelerTemplates folder not found: ${templatesPath}`);
      return { exists: false, error: 'Missing _MapLabelerTemplates folder' };
    }
  } else {
    logInfo(`❌ Default path does not exist: ${defaultPath}`);
    return { exists: false, error: 'Default path not found' };
  }
}

// Prompt user to select Paratext folder
async function promptForPath() {
  logInfo('Prompting user to select Paratext Projects folder...');
  
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory'],
    title: 'Select Paratext Projects Folder',
    buttonLabel: 'Select Folder',
    message: 'Please select your Paratext Projects folder (usually "My Paratext 9 Projects")'
  });
  
  if (result.canceled || !result.filePaths.length) {
    logInfo('❌ User canceled folder selection');
    return { exists: false, error: 'Selection canceled' };
  }
  
  const selectedPath = result.filePaths[0];
  logInfo(`User selected: ${selectedPath}`);
  
  // Check for _MapLabelerTemplates folder
  const templatesPath = path.join(selectedPath, '_MapLabelerTemplates');
  if (fs.existsSync(templatesPath)) {
    logInfo(`✅ _MapLabelerTemplates folder exists in selected path: ${templatesPath}`);
    return { exists: true, path: selectedPath };
  } else {
    logInfo(`❌ _MapLabelerTemplates folder not found in selected path: ${templatesPath}`);
    return { exists: false, error: 'Missing _MapLabelerTemplates folder', path: selectedPath };
  }
}

// Main diagnostic function
async function runDiagnostics() {
  // First check default path
  const defaultPathResult = checkDefaultPath();
  
  // If default path doesn't exist or is invalid, prompt user
  if (!defaultPathResult.exists) {
    logInfo('Will prompt user for path selection...');
    
    // Show dialog asking if user wants to select a folder
    const { response } = await dialog.showMessageBox({
      type: 'question',
      title: 'Paratext Projects Folder Not Found',
      message: 'The default Paratext Projects folder was not found or does not have the required _MapLabelerTemplates subfolder.',
      detail: `Error: ${defaultPathResult.error}`,
      buttons: ['Browse for Folder', 'Skip']
    });
    
    if (response === 0) {
      // User wants to browse
      const promptResult = await promptForPath();
      logInfo(`Prompt result: ${JSON.stringify(promptResult)}`);
    } else {
      // User skipped
      logInfo('User skipped folder selection');
    }
  } else {
    logInfo('Using default path, no need to prompt user');
  }
  
  logInfo('Diagnostics complete');
}

// Initialize and run diagnostics when app is ready
app.whenReady().then(() => {
  // Create a debug window to show results
  debugWin = new BrowserWindow({
    width: 800, 
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    title: 'Paratext Path Debugging'
  });
  
  // Load HTML content
  debugWin.loadURL(`data:text/html;charset=utf-8,
    <html>
      <head>
        <title>Paratext Path Detection Debugger</title>
        <style>
          body { font-family: monospace; padding: 20px; background: #f0f0f0; }
          h1 { color: #333; }
          #log { background: #fff; border: 1px solid #ccc; padding: 10px; height: 70vh; overflow-y: auto; white-space: pre-wrap; }
          .actions { margin-top: 15px; }
          button { padding: 8px 16px; margin-right: 10px; }
        </style>
      </head>
      <body>
        <h1>Paratext Path Detection Debugger</h1>
        <div id="log"></div>
        <div class="actions">
          <button onclick="window.electronAPI.checkPath()">Check Default Path</button>
          <button onclick="window.electronAPI.promptPath()">Prompt for Path</button>
          <button onclick="window.electronAPI.runAll()">Run Full Diagnostics</button>
        </div>
        <script>
          window.electronAPI = {
            checkPath: () => { console.log('Check path clicked'); },
            promptPath: () => { console.log('Prompt path clicked'); },
            runAll: () => { console.log('Run all clicked'); }
          };
        </script>
      </body>
    </html>
  `);
  
  // Run diagnostics after a short delay to allow the UI to initialize
  setTimeout(runDiagnostics, 500);
  
  // Open DevTools to see JS console
  debugWin.webContents.openDevTools();
});

// Keep app running until all windows are closed
app.on('window-all-closed', () => {
  app.quit();
});
