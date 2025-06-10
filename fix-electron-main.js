// Fix script for electron-main.js
const fs = require('fs');
const path = require('path');

// Path to electron-main.js
const mainJsPath = path.join(__dirname, 'electron-main.js');

console.log(`Reading ${mainJsPath}...`);

try {
  // Read the current file
  const content = fs.readFileSync(mainJsPath, 'utf8');
  
  // Fix the app.whenReady() section
  const updatedContent = content.replace(
    /\/\/ Initialize the Paratext projects path when the app is ready[\s\S]*?app\.whenReady\(\)\.then\(async \(\) => \{[\s\S]*?createWindow\(\);[\s\S]*?\}\);/,
    `// Initialize the Paratext projects path when the app is ready
app.whenReady().then(async () => {
  console.log('Application starting...');
  
  // First create the window so we have it for dialog parent
  const mainWindow = createWindow();
  
  try {
    // Try to initialize Paratext projects path
    console.log('Starting Paratext projects path initialization...');
    const initSuccess = await initParatextProjectsPath();
    console.log(\`Paratext projects path initialized: \${initSuccess}. Path: \${PARATEXT_PROJECTS_PATH}\`);
    
    // If initialization failed, show dialog
    if (!initSuccess) {
      console.log('WARNING: Failed to initialize Paratext projects path');
      
      // Wait a moment for the window to be fully loaded
      setTimeout(async () => {
        try {
          console.log('Showing Paratext path configuration dialog...');
          const { response } = await dialog.showMessageBox(mainWindow, {
            type: 'warning',
            title: 'Paratext Path Configuration Issue',
            message: 'Biblical Map App could not locate a valid Paratext projects folder with the _MapLabelerTemplates subfolder.',
            detail: 'You must have the _MapLabelerTemplates folder installed in your Paratext Projects directory for this application to work properly.',
            buttons: ['Browse for Folder', 'Continue Anyway']
          });
          
          console.log(\`Dialog response: \${response}\`);
          
          // If user chooses to browse for folder
          if (response === 0) {
            const selectedPath = await promptUserForParatextPath();
            console.log(\`User selected path: \${selectedPath || 'No path selected'}\`);
          }
        } catch (dialogErr) {
          console.error('Error showing dialog:', dialogErr);
        }
      }, 1000); // Wait 1 second for the window to be ready
    }
  } catch (err) {
    console.error('Error during initialization:', err);
  }
});`
  );
  
  // Also fix the createWindow function to return the window object
  const updatedContent2 = updatedContent.replace(
    /function createWindow\(\) \{[\s\S]*?\/\/ Handle squirrel events for Windows installer[\s\S]*?app\.quit\(\);[\s\S]*?\}/,
    `function createWindow() {
  console.log('Creating BrowserWindow...');
  const win = new BrowserWindow({
    width: 1200,
    height: 900,
    icon: path.join(__dirname, 'icon.ico'), // This sets the window icon
    webPreferences: {
      nodeIntegration: false, // more secure
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    show: false, // Don't show until ready
  });
  
  // Show window when ready to avoid white flashing
  win.once('ready-to-show', () => {
    win.show();
    console.log('Window is now visible');
  });
  
  enable(win.webContents);
  
  // Check if we're in development or production
  const isDev = process.env.NODE_ENV === 'development';
  
  if (isDev) {
    // For development: load React dev server
    console.log('Running in development mode...');
    win.loadURL('http://localhost:3000');
    // Open DevTools in development mode
    win.webContents.openDevTools();
  } else {
    // For production: load built files
    const indexPath = path.join(__dirname, 'index.html');
    console.log('Running in production mode, loading index from:', indexPath);
    
    // Enable more verbose logging for debugging
    win.webContents.on('did-start-loading', () => {
      console.log('Started loading the page');
    });
    
    win.webContents.on('did-finish-load', () => {
      console.log('Page loaded successfully');
    });
    
    win.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
      console.error('Failed to load:', errorCode, errorDescription);
    });
    
    win.webContents.on('console-message', (event, level, message, line, sourceId) => {
      console.log(\`Console \${level}: \${message}\`);
    });
    
    // Load the index.html file
    win.loadFile(indexPath);
  }
  
  // Handle squirrel events for Windows installer
  if (require('electron-squirrel-startup')) {
    app.quit();
  }
  
  return win; // Return the window object
}`
  );
  
  // Write the fixed file
  const backupPath = path.join(__dirname, 'electron-main.js.bak');
  console.log(`Creating backup at ${backupPath}...`);
  fs.writeFileSync(backupPath, content);
  
  console.log(`Writing fixed file to ${mainJsPath}...`);
  fs.writeFileSync(mainJsPath, updatedContent2);
  
  console.log('Fix completed successfully!');
} catch (error) {
  console.error('Error fixing electron-main.js:', error);
}
