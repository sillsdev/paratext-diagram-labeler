// This file is a direct fix for the electron-main.js file
// It replaces the entire app.whenReady() section with a properly structured version

const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'electron-main.js');
const backupPath = path.join(__dirname, 'electron-main.js.bak2');

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

// Now find and replace the app.whenReady section
try {
  let content = fs.readFileSync(filePath, 'utf8');
  
  const startPattern = /\/\/ Initialize the Paratext projects path when the app is ready/;
  const endPattern = /initialize\(\);/;
  
  const startMatch = content.match(startPattern);
  const endMatch = content.match(endPattern);
  
  if (!startMatch || !endMatch) {
    console.error('Could not find the app.whenReady section to replace');
    process.exit(1);
  }
  
  const startPos = startMatch.index;
  const endPos = endMatch.index + endMatch[0].length;
  
  const newSection = `// Initialize the Paratext projects path when the app is ready
app.whenReady().then(async () => {
  console.log('Application starting...');
  
  // First create the window so we have it for dialog parent
  const mainWindow = createWindow();
  
  // Wait a moment to ensure the window is fully initialized
  await new Promise(resolve => setTimeout(resolve, 500));
  
  try {
    // Try to initialize Paratext projects path
    console.log('Starting Paratext projects path initialization...');
    const initSuccess = await initParatextProjectsPath();
    console.log(\`Paratext projects path initialization result: \${initSuccess ? 'Success' : 'Failed'}\`);
    console.log(\`Current Paratext projects path: \${PARATEXT_PROJECTS_PATH || 'Not set'}\`);
    
    // If initialization failed, show dialog
    if (!initSuccess) {
      console.log('WARNING: Failed to initialize Paratext projects path');
      
      console.log('Showing Paratext path configuration dialog...');
      try {
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
          if (!selectedPath) {
            console.log('User canceled folder selection or selected an invalid folder');
          }
        }
      } catch (dialogErr) {
        console.error('Error showing dialog:', dialogErr);
      }
    }
  } catch (err) {
    console.error('Error during initialization:', err);
    console.log('Showing error dialog...');
    try {
      await dialog.showMessageBox(mainWindow, {
        type: 'error',
        title: 'Initialization Error',
        message: 'An error occurred during application initialization',
        detail: \`Error details: \${err.message}\`,
        buttons: ['OK']
      });
    } catch (dialogErr) {
      console.error('Error showing error dialog:', dialogErr);
    }
  }
});

initialize();`;

  // Replace the section
  const newContent = content.substring(0, startPos) + newSection + content.substring(endPos);
  
  // Write the modified content back to the file
  fs.writeFileSync(filePath, newContent, 'utf8');
  console.log('Successfully updated app.whenReady section');
  
} catch (err) {
  console.error('Error updating file:', err);
  process.exit(1);
}
