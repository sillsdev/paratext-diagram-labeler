const { app, BrowserWindow } = require('electron');
const { initialize, enable } = require('@electron/remote/main');
const { ipcMain, dialog } = require('electron');
const fs = require('fs');
const path = require('path');
const xml2js = require('xml2js');

initialize();

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 900,
    webPreferences: {
      nodeIntegration: false, // more secure
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  enable(win.webContents);
  // For development: load React dev server
  win.loadURL('http://localhost:3000');
  // For production: load built files
  // win.loadFile(path.join(__dirname, 'build', 'index.html'));
}


async function xmlToObject(xmlString) {
  try {
    // Parse XML string
    const result = await xml2js.parseStringPromise(xmlString, {
      explicitArray: false, // Avoid arrays for single elements
      mergeAttrs: true, // Merge attributes (like Id, Guess) into the object
    });

    // Transform to desired structure
    const termRenderings = result.TermRenderingsList.TermRendering;
    const output = {};

    // Handle single or multiple TermRendering elements
    const termArray = Array.isArray(termRenderings) ? termRenderings : [termRenderings];

    termArray.forEach((term) => {
      const id = term.Id;
      output[id] = {
        renderings: term.Renderings,
        isGuessed: term.Guess === 'true', // Convert string 'true'/'false' to boolean
        denials: term.Denials?.Denial
          ? Array.isArray(term.Denials.Denial)
            ? term.Denials.Denial
            : [term.Denials.Denial]
          : [],
        // Store additional elements for preservation
        _glossary: term.Glossary,
        _changes: term.Changes,
        _notes: term.Notes,
      };
    });

    return output;
  } catch (error) {
    console.error('Error parsing XML:', error);
    throw error;
  }
}

async function objectToXml(obj) {
  try {
    const builder = new xml2js.Builder({
      xmldec: { version: '1.0', encoding: 'utf-8' },
      renderOpts: { pretty: true },
    });

    // Build the TermRenderingsList structure
    const xmlObj = {
      TermRenderingsList: {
        TermRendering: Object.entries(obj).map(([id, data]) => ({
          $: { Id: id, Guess: data.isGuessed.toString() }, // Attributes
          Renderings: data.renderings,
          Glossary: data._glossary || {}, // Preserve empty or existing
          Changes: data._changes || {}, // Preserve empty or existing
          Notes: data._notes || {}, // Preserve empty or existing
          Denials: data.denials.length ? { Denial: data.denials } : {}, // Handle denials array
        })),
      },
    };

    return builder.buildObject(xmlObj);
  } catch (error) {
    console.error('Error building XML:', error);
    throw error;
  }
}

ipcMain.handle('load-term-renderings', async (event, projectFolder) => {
  try {
    const xmlFilePath = path.join(projectFolder, 'term-renderings.xml');

    // Read the XML file into a javascript object
    if (fs.existsSync(xmlFilePath)) {
      const data = fs.readFileSync(xmlFilePath, 'utf8');
      const obj = await xmlToObject(data);
      return obj;
    } else {
      console.log('no xml renderings.')
    }
  } catch (e) {
      console.log('error loading term renderings:', e);
  }
  return {};
});

ipcMain.handle('save-term-renderings', async (event, projectFolder, data) => {
  try {
    const filePath = path.join(projectFolder, 'term-renderings.xml');
    const xmlOutput = await objectToXml(data);
    fs.writeFileSync(filePath, xmlOutput, 'utf8');
    console.log('Term renderings saved successfully.');
    return { success: true };
  } catch (e) {
    return { error: e.message };
  }
});

ipcMain.handle('select-project-folder', async (event) => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory'],
  });
  if (result.canceled || !result.filePaths.length) {
    return null;
  }
  return result.filePaths[0];
});

ipcMain.handle('get-filtered-verses', async (event, projectFolder, curRefs) => {
  try {
    const filePath = path.join(projectFolder, 'all_verses.json');
    const allVerses = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const filtered = Object.fromEntries(
      curRefs.filter(ref => allVerses.hasOwnProperty(ref)).map(ref => [ref, allVerses[ref]])
    );
    return filtered;
  } catch (e) {
    return { error: e.message };
  }
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
