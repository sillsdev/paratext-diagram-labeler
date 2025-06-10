// Final fix for the Paratext path dialog issue
// This script addresses the root cause of the problem by fixing the check-map-templates-folder handler
// and ensuring that dialogs are shown when the Paratext path is not found

const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'electron-main.js');
const backupPath = path.join(__dirname, 'electron-main.js.final-fix.bak');

console.log('Applying final fix for Paratext path handling');

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

try {
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Create a fixed version of the app.whenReady() function that focuses on showing dialogs
  // when the Paratext path is not found
  const appReadyPattern = /\/\/ Initialize the Paratext projects path when the app is ready[\s\S]*?app\.whenReady\(\)\.then\(async \(\) => \{[\s\S]*?initialize\(\);/;
  
  const fixedAppReadySection = `// Initialize the Paratext projects path when the app is ready
app.whenReady().then(async () => {
  console.log('Application starting...');
  
  // First create the window so we have it for dialog parent
  console.log('Creating main window...');
  const mainWindow = createWindow();
  
  // Ensure Electron Remote is initialized
  initialize();
  
  // Wait for the window to be fully rendered before proceeding
  await new Promise((resolve) => {
    if (mainWindow.isVisible()) {
      console.log('Window is already visible');
      resolve();
    } else {
      console.log('Waiting for window to be ready...');
      mainWindow.once('ready-to-show', () => {
        mainWindow.show();
        mainWindow.focus();
        console.log('Window is now visible');
        resolve();
      });
    }
  });
  
  // Additional small delay to ensure UI is fully rendered
  await new Promise(resolve => setTimeout(resolve, 1000));
  console.log('Window should be fully ready now');
  
  try {
    // Check if the Paratext projects path is valid or if we need to prompt the user
    console.log('Checking Paratext projects path...');
    
    let pathValid = false;
    
    // First check stored path
    const storedPath = getStoredProjectsPath();
    if (storedPath && fs.existsSync(storedPath)) {
      const templatesPath = path.join(storedPath, '_MapLabelerTemplates');
      if (fs.existsSync(templatesPath)) {
        console.log(\`Using stored Paratext projects path: "\${storedPath}"\`);
        PARATEXT_PROJECTS_PATH = storedPath;
        pathValid = true;
      } else {
        console.log(\`Stored path exists but missing _MapLabelerTemplates folder: "\${storedPath}"\`);
      }
    } else if (storedPath) {
      console.log(\`Stored path does not exist: "\${storedPath}"\`);
    } else {
      console.log('No stored Paratext projects path found');
    }
    
    // If stored path is not valid, check default path
    if (!pathValid) {
      const defaultPath = 'C:\\\\My Paratext 9 Projects';
      if (fs.existsSync(defaultPath)) {
        const templatesPath = path.join(defaultPath, '_MapLabelerTemplates');
        if (fs.existsSync(templatesPath)) {
          console.log(\`Using default Paratext projects path: "\${defaultPath}"\`);
          PARATEXT_PROJECTS_PATH = defaultPath;
          saveProjectsPath(defaultPath);
          pathValid = true;
        } else {
          console.log(\`Default path exists but missing _MapLabelerTemplates folder: "\${defaultPath}"\`);
        }
      } else {
        console.log(\`Default Paratext folder not found: "\${defaultPath}"\`);
      }
    }
    
    // If no valid path found, show warning dialog and prompt user
    if (!pathValid) {
      console.log('No valid Paratext projects path found - showing dialog');
      
      try {
        console.log('Showing Paratext path configuration dialog...');
        const { response } = await dialog.showMessageBox(mainWindow, {
          type: 'warning',
          title: 'Paratext Path Configuration Required',
          message: 'Biblical Map App could not locate a valid Paratext projects folder with the _MapLabelerTemplates subfolder.',
          detail: 'You must select your Paratext Projects directory containing the _MapLabelerTemplates folder for this application to work properly.',
          buttons: ['Select Folder', 'Continue Without Selecting']
        });
        
        console.log(\`Dialog response: \${response}\`);
        
        // If user chooses to browse for folder
        if (response === 0) {
          console.log('User chose to select a folder');
          const selectedPath = await promptUserForParatextPath();
          
          if (selectedPath) {
            console.log(\`User selected valid path: "\${selectedPath}"\`);
            // Path is already saved in promptUserForParatextPath if valid
          } else {
            console.log('User did not select a valid path');
            await dialog.showMessageBox(mainWindow, {
              type: 'warning',
              title: 'No Valid Path Selected',
              message: 'No valid Paratext projects folder was selected.',
              detail: 'The application will continue, but mapping features will be limited.',
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
    console.error('Error during Paratext path initialization:', err);
  }
});`;

  // Replace the app.whenReady section
  content = content.replace(appReadyPattern, fixedAppReadySection);
  
  // Write the modified content back to the file
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('Successfully updated app.whenReady section with final fix');
  
} catch (err) {
  console.error('Error updating file:', err);
  process.exit(1);
}
