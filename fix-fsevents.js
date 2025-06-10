const fs = require('fs-extra');
const path = require('path');

// Create an empty fsevents directory to satisfy electron-builder
const fseventsDir = path.join(__dirname, 'node_modules', 'fsevents');
fs.ensureDirSync(fseventsDir);

console.log('Created empty fsevents directory to work around the build issue.');
