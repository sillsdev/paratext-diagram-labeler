const fs = require('fs');
const path = require('path');

console.log('Fixing HTML paths for Electron...');

// Path to the built index.html file
const indexPath = path.join(__dirname, 'build', 'index.html');

// Read the file content
let htmlContent = fs.readFileSync(indexPath, 'utf8');

// Replace absolute paths with relative paths
// Replace "/static/" with "./static/"
htmlContent = htmlContent.replace(/="\//g, '="./');

// Write the modified content back
fs.writeFileSync(indexPath, htmlContent);

console.log('HTML paths fixed successfully!');
