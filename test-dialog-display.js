const { app, BrowserWindow, dialog } = require('electron');
const fs = require('fs');
const path = require('path');

// Test configuration
const TEST_TIMEOUT_MS = 3000; // 3 seconds

// Create a test Window
function createTestWindow() {
  console.log('Creating test window...');
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    show: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  win.loadURL('about:blank');
  console.log('Window created');
  return win;
}

// Test showing a dialog
async function testShowingDialog(mainWindow) {
  console.log('Testing dialog display...');
  try {
    // Show dialog with a deliberate delay
    console.log('Will show dialog in 1 second...');
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    console.log('Showing test dialog...');
    const { response } = await dialog.showMessageBox(mainWindow, {
      type: 'warning',
      title: 'TEST: Paratext Path Dialog',
      message: 'This is a test dialog that should be displayed. Can you see this dialog?',
      detail: 'If you can see this dialog, then the fix is likely to work.',
      buttons: ['Yes, I see it', 'No, nothing appears']
    });
    
    console.log(`Dialog response: ${response}`);
    
    if (response === 0) {
      console.log('SUCCESS: User confirmed seeing the dialog');
      await dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'Test Successful',
        message: 'The dialog display test was successful.',
        buttons: ['Continue']
      });
    } else {
      console.log('FAILED: User reported not seeing the dialog');
    }
  } catch (err) {
    console.error('Error in test:', err);
  }
}

// Main test runner
async function runTest() {
  try {
    // Delete any existing configuration
    const userDataPath = app.getPath('userData');
    const configPath = path.join(userDataPath, 'paratext-config.json');
    
    if (fs.existsSync(configPath)) {
      fs.unlinkSync(configPath);
      console.log(`Deleted existing config at ${configPath}`);
    }
    
    // Create window and test dialog
    const window = createTestWindow();
    
    // Run the test
    await testShowingDialog(window);
    
    // Cleanup and exit after timeout
    setTimeout(() => {
      console.log('Test completed. Exiting...');
      app.quit();
    }, TEST_TIMEOUT_MS);
  } catch (err) {
    console.error('Test failed:', err);
    app.quit();
  }
}

// Run the test when the app is ready
app.whenReady().then(runTest);
