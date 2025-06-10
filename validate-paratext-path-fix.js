// Validation script for the Paratext path dialog fix
const { app, BrowserWindow, dialog } = require('electron');
const fs = require('fs');
const path = require('path');

// Time to wait between steps in ms
const STEP_DELAY = 1000;

// Initialize app and create a window
async function run() {
  console.log('======= VALIDATION TEST FOR PARATEXT PATH FIX =======');
  console.log('Starting test...');

  try {
    // Force reset the Paratext configuration
    const userDataPath = app.getPath('userData');
    const configPath = path.join(userDataPath, 'paratext-config.json');
    
    console.log(`Checking for existing config at: ${configPath}`);
    if (fs.existsSync(configPath)) {
      console.log('Backing up existing config...');
      fs.copyFileSync(configPath, `${configPath}.bak`);
      console.log('Removing existing config to simulate fresh install...');
      fs.unlinkSync(configPath);
    } else {
      console.log('No existing config found - good for testing fresh install scenario');
    }
    
    // Create a main window
    console.log('Creating test window...');
    const win = new BrowserWindow({
      width: 800,
      height: 600,
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    });

    // Show window
    win.once('ready-to-show', () => {
      win.show();
      console.log('Test window is now visible');
    });

    win.loadURL('about:blank');
    
    // Wait for window to be visible
    await new Promise((resolve) => {
      if (win.isVisible()) {
        resolve();
      } else {
        win.once('ready-to-show', resolve);
      }
    });

    // Additional delay to ensure window is fully rendered
    await new Promise(resolve => setTimeout(resolve, STEP_DELAY));
    
    console.log('Simulating missing Paratext path scenario...');
    
    // This simulates what our app.whenReady() does in electron-main.js
    const result = await dialog.showMessageBox(win, {
      type: 'warning',
      title: 'TEST: Paratext Path Configuration',
      message: 'TEST: Biblical Map App could not locate a valid Paratext projects folder.',
      detail: 'This is a test dialog to verify that dialogs are appearing correctly.',
      buttons: ['Select Folder', 'Cancel Test']
    });
    
    console.log(`First dialog response: ${result.response}`);
    
    if (result.response === 0) {
      console.log('User chose to select a folder');
      
      // Show a folder selection dialog
      const folderResult = await dialog.showOpenDialog(win, {
        properties: ['openDirectory'],
        title: 'TEST: Select Paratext Projects Folder',
        buttonLabel: 'Select Folder',
        message: 'Please select your Paratext Projects folder'
      });
      
      console.log('Folder selection result:', folderResult);
      
      if (!folderResult.canceled && folderResult.filePaths.length > 0) {
        const selectedPath = folderResult.filePaths[0];
        console.log(`User selected path: "${selectedPath}"`);
        
        // Show a final confirmation dialog
        await dialog.showMessageBox(win, {
          type: 'info',
          title: 'TEST: Path Selected',
          message: `Selected path: ${selectedPath}`,
          detail: 'Dialog test completed successfully! The dialogs are displaying correctly.',
          buttons: ['OK']
        });
      } else {
        console.log('User canceled folder selection');
      }
    }
    
    // Clean up after a short delay
    setTimeout(() => {
      console.log('Test completed, cleaning up...');
      win.close();
      app.quit();
    }, 1000);

  } catch (err) {
    console.error('ERROR during test:', err);
    dialog.showErrorBox('Test Error', `An error occurred during testing: ${err.message}`);
    app.quit();
  }
}

// Run the test when the app is ready
app.whenReady().then(run);
