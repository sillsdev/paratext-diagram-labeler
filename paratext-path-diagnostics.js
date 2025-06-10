// A standalone debugging tool for investigating the Paratext path issue
const { app, BrowserWindow, dialog } = require('electron');
const fs = require('fs');
const path = require('path');

// Global state
let mainWindow = null;
let paratextPath = null;
const userDataPath = app.getPath('userData');
const configPath = path.join(userDataPath, 'paratext-config.json');

// Debugging functions
function logDebug(message) {
  const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
  console.log(`[DEBUG ${timestamp}] ${message}`);
}

// Create main window
function createWindow() {
  logDebug('Creating window...');
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    show: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  mainWindow.loadURL('about:blank');
  mainWindow.webContents.executeJavaScript(`
    document.body.innerHTML = '<h1>Paratext Path Debugging Tool</h1><pre id="log"></pre>';
    window.updateLog = (msg) => {
      const log = document.getElementById('log');
      log.textContent += msg + '\\n';
    };
  `);
  
  logDebug('Window created');
  return mainWindow;
}

// Update the UI with a log message
function updateUI(message) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    logDebug(message);
    mainWindow.webContents.executeJavaScript(`window.updateLog("${message.replace(/"/g, '\\"')}")`);
  } else {
    logDebug(`[UI NOT READY] ${message}`);
  }
}

// Check if the default Paratext path exists
function checkDefaultPath() {
  const defaultPath = 'C:\\My Paratext 9 Projects';
  updateUI(`Checking default path: "${defaultPath}"`);
  
  if (fs.existsSync(defaultPath)) {
    updateUI(`✓ Default path exists: "${defaultPath}"`);
    
    const templatesPath = path.join(defaultPath, '_MapLabelerTemplates');
    if (fs.existsSync(templatesPath)) {
      updateUI(`✓ _MapLabelerTemplates folder exists at: "${templatesPath}"`);
      paratextPath = defaultPath;
      return true;
    } else {
      updateUI(`✗ _MapLabelerTemplates folder NOT found at: "${templatesPath}"`);
      return false;
    }
  } else {
    updateUI(`✗ Default path NOT found: "${defaultPath}"`);
    return false;
  }
}

// Check stored path in the app config
function checkStoredPath() {
  updateUI(`Checking for stored path in: "${configPath}"`);
  
  try {
    if (fs.existsSync(configPath)) {
      const configData = fs.readFileSync(configPath, 'utf8');
      const config = JSON.parse(configData);
      
      if (config.projectsPath) {
        updateUI(`✓ Found stored path: "${config.projectsPath}"`);
        
        if (fs.existsSync(config.projectsPath)) {
          updateUI(`✓ Stored path exists on disk: "${config.projectsPath}"`);
          
          const templatesPath = path.join(config.projectsPath, '_MapLabelerTemplates');
          if (fs.existsSync(templatesPath)) {
            updateUI(`✓ _MapLabelerTemplates folder exists at: "${templatesPath}"`);
            paratextPath = config.projectsPath;
            return true;
          } else {
            updateUI(`✗ _MapLabelerTemplates folder NOT found at: "${templatesPath}"`);
            return false;
          }
        } else {
          updateUI(`✗ Stored path does NOT exist on disk: "${config.projectsPath}"`);
          return false;
        }
      } else {
        updateUI(`✗ No projects path found in config file`);
        return false;
      }
    } else {
      updateUI(`✗ Config file NOT found: "${configPath}"`);
      return false;
    }
  } catch (err) {
    updateUI(`✗ Error checking stored path: ${err.message}`);
    return false;
  }
}

// Delete the stored config
async function resetConfig() {
  try {
    if (fs.existsSync(configPath)) {
      fs.unlinkSync(configPath);
      updateUI(`✓ Deleted config file: "${configPath}"`);
    } else {
      updateUI(`✓ No config file to delete`);
    }
  } catch (err) {
    updateUI(`✗ Error deleting config file: ${err.message}`);
  }
}

// Show a test dialog
async function showTestDialog(message) {
  try {
    updateUI(`Showing test dialog...`);
    const result = await dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Test Dialog',
      message: message,
      buttons: ['OK', 'Cancel']
    });
    
    updateUI(`✓ Dialog shown successfully, response: ${result.response}`);
    return result.response;
  } catch (err) {
    updateUI(`✗ Error showing dialog: ${err.message}`);
    return -1;
  }
}

// Prompt user to select Paratext path
async function promptForParatextPath() {
  try {
    updateUI(`Prompting user to select Paratext projects folder...`);
    
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
      title: 'Select Paratext Projects Folder',
      buttonLabel: 'Select Folder',
      message: 'Please select your Paratext Projects folder (usually "My Paratext 9 Projects")'
    });
    
    if (result.canceled || !result.filePaths.length) {
      updateUI(`✗ User canceled folder selection`);
      return null;
    }
    
    const selectedPath = result.filePaths[0];
    updateUI(`✓ User selected: "${selectedPath}"`);
    
    // Check for _MapLabelerTemplates folder
    const templatesPath = path.join(selectedPath, '_MapLabelerTemplates');
    if (fs.existsSync(templatesPath)) {
      updateUI(`✓ _MapLabelerTemplates folder exists at: "${templatesPath}"`);
      
      // Save the path
      const configData = JSON.stringify({ projectsPath: selectedPath });
      fs.writeFileSync(configPath, configData, 'utf8');
      updateUI(`✓ Saved path to config: "${configPath}"`);
      
      paratextPath = selectedPath;
      return selectedPath;
    } else {
      updateUI(`✗ _MapLabelerTemplates folder NOT found at: "${templatesPath}"`);
      
      // Prompt about the missing folder
      const response = await dialog.showMessageBox(mainWindow, {
        type: 'error',
        title: 'Missing _MapLabelerTemplates Folder',
        message: 'The selected folder does not contain the required _MapLabelerTemplates folder.',
        detail: 'You must first install the _MapLabelerTemplates folder in your Paratext Projects directory before using this application.',
        buttons: ['OK']
      });
      
      updateUI(`✓ Showed missing folder dialog, response: ${response.response}`);
      return null;
    }
  } catch (err) {
    updateUI(`✗ Error prompting for path: ${err.message}`);
    return null;
  }
}

// Main diagnostic function
async function runDiagnostics() {
  try {
    updateUI('Starting Paratext path diagnostics...');
    
    // First, check if the stored path is valid
    const storedValid = checkStoredPath();
    
    // Then check if the default path is valid
    const defaultValid = checkDefaultPath();
    
    // If neither path is valid, prompt the user
    if (!storedValid && !defaultValid) {
      updateUI('No valid Paratext path found, showing dialog...');
      
      // Test dialog display
      const testResponse = await showTestDialog('We need to ask you for the Paratext projects folder. Click OK to continue.');
      
      if (testResponse === 0) {
        // Prompt for path
        const selectedPath = await promptForParatextPath();
        
        if (selectedPath) {
          updateUI(`✓ Successfully configured Paratext path: "${selectedPath}"`);
        } else {
          updateUI(`✗ Failed to configure a valid Paratext path`);
        }
      } else {
        updateUI('User canceled the test dialog');
      }
    } else {
      updateUI(`✓ Found valid Paratext path: "${paratextPath}"`);
    }
    
    // Final diagnostic summary
    updateUI('\n--- DIAGNOSTIC SUMMARY ---');
    updateUI(`User data path: "${userDataPath}"`);
    updateUI(`Config file path: "${configPath}"`);
    updateUI(`Config file exists: ${fs.existsSync(configPath) ? 'Yes' : 'No'}`);
    updateUI(`Default path exists: ${fs.existsSync('C:\\My Paratext 9 Projects') ? 'Yes' : 'No'}`);
    updateUI(`Current Paratext path: "${paratextPath || 'Not set'}"`);
    
    // Ask user if they want to reset the config
    const resetResponse = await dialog.showMessageBox(mainWindow, {
      type: 'question',
      title: 'Reset Configuration?',
      message: 'Do you want to reset the Paratext path configuration for testing?',
      buttons: ['Yes, Reset', 'No, Keep Current']
    });
    
    if (resetResponse.response === 0) {
      await resetConfig();
      updateUI('Configuration reset completed');
    } else {
      updateUI('Configuration kept as is');
    }
    
    // Final message
    updateUI('\nDiagnostics complete. You can close this window.');
  } catch (err) {
    updateUI(`ERROR in diagnostics: ${err.message}`);
  }
}

// Run the app
app.whenReady().then(async () => {
  createWindow();
  
  // Wait for window to be ready
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Run diagnostics
  await runDiagnostics();
});
