const { app } = require('electron');
const fs = require('fs');
const path = require('path');

// Run this script to reset the stored Paratext path configuration
// This simulates a fresh installation or missing Paratext path

app.whenReady().then(() => {
  try {
    // Get the user data path
    const userDataPath = app.getPath('userData');
    const configPath = path.join(userDataPath, 'paratext-config.json');
    
    console.log(`Looking for Paratext config at: ${configPath}`);
    
    if (fs.existsSync(configPath)) {
      // Backup the existing config
      const backupPath = `${configPath}.bak-${Date.now()}`;
      console.log(`Creating backup at: ${backupPath}`);
      fs.copyFileSync(configPath, backupPath);
      
      // Delete the config
      console.log('Deleting Paratext configuration file...');
      fs.unlinkSync(configPath);
      console.log('Paratext configuration has been reset');
    } else {
      console.log('No Paratext configuration found - already in fresh state');
    }
  } catch (err) {
    console.error('Error resetting Paratext configuration:', err);
  } finally {
    app.quit();
  }
});
