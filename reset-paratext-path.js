const { app } = require('electron');
const fs = require('fs');
const path = require('path');

// Set an invalid Paratext path to test dialog functionality
function setInvalidParatextPath() {
  try {
    const userDataPath = app.getPath('userData');
    const configPath = path.join(userDataPath, 'paratext-config.json');
    
    // Set to a non-existent path
    const configData = JSON.stringify({ projectsPath: 'C:\\NonExistentPath' });
    fs.writeFileSync(configPath, configData, 'utf8');
    console.log('Set invalid Paratext projects path for testing');
    return true;
  } catch (err) {
    console.error('Error setting invalid Paratext path:', err);
    return false;
  }
}

// Run the function when this script is executed
app.whenReady().then(() => {
  const success = setInvalidParatextPath();
  console.log(`Path reset ${success ? 'successful' : 'failed'}`);
  app.quit();
});
