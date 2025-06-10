// This is a comprehensive fix for the electron-main.js file
// It specifically addresses issues with Paratext path handling and dialog display

const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'electron-main.js');
const backupPath = path.join(__dirname, 'electron-main.js.bak3');

console.log('Starting comprehensive fix for Paratext path handling');

// First, make a backup of the current file
try {
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf8');
    fs.writeFileSync(backupPath, content, 'utf8');
    console.log(`Backup created at ${backupPath}`);
  }
} catch (err) {
  console.error('Error creating backup:', err);
  process.exit(1);
}

// Now fix the validateParatextPath function
try {
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Replace the validateParatextPath function with a more reliable version
  const validatePattern = /\/\/ Function to validate the Paratext projects path[\s\S]*?function validateParatextPath\(folderPath\) \{[\s\S]*?return false;\s*\}\s*\}/;
  
  const newValidateFunction = `// Function to validate the Paratext projects path
function validateParatextPath(folderPath) {
  try {
    console.log(\`Validating Paratext path: "\${folderPath}"\`);
    
    // Check that the folder exists
    if (!fs.existsSync(folderPath)) {
      console.log(\`VALIDATION FAILED: Path does not exist: "\${folderPath}"\`);
      return false;
    }
      
    // Check for the _MapLabelerTemplates folder
    const mapLabelerTemplatesPath = path.join(folderPath, '_MapLabelerTemplates');
    if (!fs.existsSync(mapLabelerTemplatesPath)) {
      console.log(\`VALIDATION FAILED: Required _MapLabelerTemplates folder not found in: "\${folderPath}"\`);
      console.log('This folder must be installed separately before using this application');
      return false;
    }
    
    // Validation passed
    console.log(\`VALIDATION PASSED: "\${folderPath}" is a valid Paratext projects path\`);
    return true;
  } catch (err) {
    console.error('Error validating Paratext path:', err);
    return false;
  }
}`;

  // Replace the function
  content = content.replace(validatePattern, newValidateFunction);
  
  // Now fix the initParatextProjectsPath function
  const initPattern = /\/\/ Function to initialize and validate Paratext projects path[\s\S]*?async function initParatextProjectsPath\(\) \{[\s\S]*?return !!selectedPath;[\s\S]*?\}/;
  
  const newInitFunction = `// Function to initialize and validate Paratext projects path
async function initParatextProjectsPath() {
  try {
    // Check for existing path in localStorage
    const storedPath = getStoredProjectsPath();
    if (storedPath) {
      console.log(\`Found stored Paratext projects path: "\${storedPath}"\`);
      if (validateParatextPath(storedPath)) {
        PARATEXT_PROJECTS_PATH = storedPath;
        console.log(\`Using stored Paratext projects path: "\${PARATEXT_PROJECTS_PATH}"\`);
        return true;
      } else {
        console.log(\`Stored path "\${storedPath}" is invalid, will try other methods\`);
      }
    } else {
      console.log('No stored Paratext projects path found');
    }
    
    // Check default path
    const defaultPath = 'C:\\\\My Paratext 9 Projects';
    console.log(\`Checking default path: "\${defaultPath}"\`);
    if (fs.existsSync(defaultPath)) {
      console.log(\`Default path exists: "\${defaultPath}"\`);
      // Validate that the path has the required _MapLabelerTemplates folder
      if (validateParatextPath(defaultPath)) {
        PARATEXT_PROJECTS_PATH = defaultPath;
        console.log(\`Using default Paratext projects path: "\${PARATEXT_PROJECTS_PATH}"\`);
        saveProjectsPath(defaultPath);
        return true;
      } else {
        console.log(\`Default path "\${defaultPath}" exists but is invalid\`);
      }
    } else {
      console.log(\`Default Paratext folder not found: "\${defaultPath}"\`);
    }
    
    // Don't attempt to prompt the user here - we'll handle this in the app.whenReady() section
    console.log('Valid Paratext projects path not found. Will show dialog after window creation.');
    return false; // Return false to indicate we need to show a dialog
  } catch (err) {
    console.error('Error initializing Paratext projects path:', err);
    return false;
  }
}`;

  // Replace the function
  content = content.replace(initPattern, newInitFunction);
  
  // Now replace the app.whenReady() section
  const appReadyPattern = /\/\/ Initialize the Paratext projects path when the app is ready[\s\S]*?app\.whenReady\(\)\.then\(async \(\) => \{[\s\S]*?initialize\(\);/;
  
  const newAppReadySection = `// Initialize the Paratext projects path when the app is ready
app.whenReady().then(async () => {
  console.log('Application starting...');
  
  // First create the window so we have it for dialog parent
  console.log('Creating main window...');
  const mainWindow = createWindow();
  
  // Wait a moment to ensure the window is fully initialized and visible
  console.log('Waiting for window to be ready...');
  await new Promise((resolve) => {
    // If already visible, resolve immediately
    if (mainWindow.isVisible()) {
      console.log('Window is already visible');
      resolve();
    } else {
      // Otherwise wait for ready-to-show event
      console.log('Waiting for ready-to-show event...');
      mainWindow.once('ready-to-show', () => {
        console.log('Window ready-to-show event received');
        resolve();
      });
    }
  });
  
  // Additional small delay to ensure window is fully rendered
  await new Promise(resolve => setTimeout(resolve, 500));
  console.log('Window should be ready now');
  
  try {
    // Try to initialize Paratext projects path
    console.log('Starting Paratext projects path initialization...');
    const initSuccess = await initParatextProjectsPath();
    console.log(\`Paratext projects path initialization result: \${initSuccess ? 'Success' : 'Failed'}\`);
    console.log(\`Current Paratext projects path: \${PARATEXT_PROJECTS_PATH || 'Not set'}\`);
    
    // If initialization failed, show dialog
    if (!initSuccess) {
      console.log('WARNING: Failed to initialize Paratext projects path - showing dialog');
      
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
          console.log('User chose to browse for folder');
          const selectedPath = await promptUserForParatextPath();
          console.log(\`User selected path: \${selectedPath || 'No path selected'}\`);
          if (!selectedPath) {
            console.log('User canceled folder selection or selected an invalid folder');
            await dialog.showMessageBox(mainWindow, {
              type: 'warning',
              title: 'No Valid Path Selected',
              message: 'You chose to continue without selecting a valid Paratext projects folder.',
              detail: 'Some features of the application may not work correctly.',
              buttons: ['OK']
            });
          }
        } else {
          console.log('User chose to continue without selecting a path');
        }
      } catch (dialogErr) {
        console.error('Error showing dialog:', dialogErr);
      }
    }
  } catch (err) {
    console.error('Error during initialization:', err);
    try {
      await dialog.showMessageBox(mainWindow, {
        type: 'error',
        title: 'Initialization Error',
        message: 'An error occurred during application initialization.',
        detail: \`Error details: \${err.message}\`,
        buttons: ['OK']
      });
    } catch (dialogErr) {
      console.error('Error showing error dialog:', dialogErr);
    }
  }
});

initialize();`;

  // Replace the app.whenReady section
  content = content.replace(appReadyPattern, newAppReadySection);
  
  // Fix the createWindow function
  const createWindowPattern = /function createWindow\(\) \{[\s\S]*?win\.webContents\);/;
  const newCreateWindowFunction = `function createWindow() {
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
    win.focus(); // Ensure the window has focus for dialogs
    console.log('Window is now visible');
  });
  
  enable(win.webContents);`;
  
  content = content.replace(createWindowPattern, newCreateWindowFunction);
  
  // Write the modified content back to the file
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('Successfully updated electron-main.js with comprehensive fix');
  
} catch (err) {
  console.error('Error updating file:', err);
  process.exit(1);
}
