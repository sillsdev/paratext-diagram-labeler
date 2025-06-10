const { app } = require('electron');
const fs = require('fs');
const path = require('path');

// Function to delete existing Paratext path configuration
function deleteParatextConfig() {
  try {
    // Wait for app to be ready so we can get user data path
    app.whenReady().then(() => {
      try {
        const userDataPath = app.getPath('userData');
        const configPath = path.join(userDataPath, 'paratext-config.json');
        
        if (fs.existsSync(configPath)) {
          fs.unlinkSync(configPath);
          console.log(`Deleted Paratext config at: ${configPath}`);
        } else {
          console.log(`No config file found at: ${configPath}`);
        }
        
        console.log('Testing for C:\\My Paratext 9 Projects folder...');
        if (fs.existsSync('C:\\My Paratext 9 Projects')) {
          console.log('WARNING: The C:\\My Paratext 9 Projects folder actually exists on this system. ' +
            'For testing purposes, you might want to temporarily rename it.');
        } else {
          console.log('C:\\My Paratext 9 Projects folder not found - this is good for our test.');
        }
        
        console.log('\nTest setup complete. Please run the application now to test the dialog behavior.');
        app.quit();
      } catch (err) {
        console.error('Error during test setup:', err);
        app.quit();
      }
    });
  } catch (err) {
    console.error('Failed to set up test:', err);
  }
}

deleteParatextConfig();
