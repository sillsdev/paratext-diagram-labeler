const { app, BrowserWindow, dialog } = require('electron');
const path = require('path');

console.log('Starting simple dialog test...');

function createWindow() {
  console.log('Creating test window...');
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });
  
  win.loadURL('about:blank');
  return win;
}

async function testDialogs(win) {
  try {
    console.log('Testing dialog display...');
    
    // Test a simple message box
    console.log('Showing test message dialog...');
    const result = await dialog.showMessageBox(win, {
      type: 'info',
      title: 'Dialog Test',
      message: 'This is a test dialog.',
      detail: 'If you can see this dialog, then dialog functionality is working correctly.',
      buttons: ['OK', 'Cancel']
    });
    
    console.log(`Dialog result: ${JSON.stringify(result)}`);
    
    // Test a folder selection dialog
    console.log('Showing folder selection dialog...');
    const folderResult = await dialog.showOpenDialog(win, {
      properties: ['openDirectory'],
      title: 'Test Folder Selection',
      message: 'Please select any folder to test dialog functionality.'
    });
    
    console.log(`Folder selection result: ${JSON.stringify(folderResult)}`);
    
    // Show final result
    if (!folderResult.canceled) {
      await dialog.showMessageBox(win, {
        type: 'info',
        title: 'Test Successful',
        message: 'All dialogs displayed correctly.',
        detail: `You selected: ${folderResult.filePaths[0]}`,
        buttons: ['OK']
      });
    } else {
      await dialog.showMessageBox(win, {
        type: 'info',
        title: 'Test Partially Successful',
        message: 'Message dialog worked, but folder selection was canceled.',
        buttons: ['OK']
      });
    }
    
    console.log('Dialog test complete');
  } catch (err) {
    console.error('Error during dialog test:', err);
  } finally {
    app.quit();
  }
}

app.whenReady().then(async () => {
  const win = createWindow();
  
  // Wait a moment for the window to be ready
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  await testDialogs(win);
});
