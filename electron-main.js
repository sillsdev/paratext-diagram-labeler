const { app, BrowserWindow } = require('electron');
const { initialize, enable } = require('@electron/remote/main');
const { ipcMain, dialog } = require('electron');
const fs = require('fs');
const path = require('path');
const xml2js = require('xml2js');

initialize();

// Add IPC handler for loading images
ipcMain.handle('load-image', async (event, imagePath) => {
  try {
    console.log(`[IPC] Attempting to load image from: ${imagePath}`);

    // Check if path is valid
    if (!imagePath) {
      console.error('[IPC] Image path is empty or invalid');
      throw new Error('Image path is empty or invalid');
    }

    // Normalize path to handle any potential issues with slashes
    const normalizedPath = path.normalize(imagePath);
    console.log(`[IPC] Normalized image path: ${normalizedPath}`);

    // Check if file exists with more detailed error
    try {
      const stats = fs.statSync(normalizedPath);
      if (!stats.isFile()) {
        console.error(`[IPC] Path exists but is not a file: ${normalizedPath}`);
        throw new Error(`Path exists but is not a file: ${normalizedPath}`);
      }
    } catch (err) {
      console.error(`[IPC] Image not found at path: ${normalizedPath}`, err.message);
      throw new Error(`Image file not found: ${path.basename(normalizedPath)}`);
    }

    // Read the file and convert to base64
    const buffer = await fs.promises.readFile(normalizedPath);

    // Verify that we have actual data
    if (!buffer || buffer.length === 0) {
      console.error(`[IPC] Read zero bytes from file: ${normalizedPath}`);
      throw new Error(`Image file is empty: ${path.basename(normalizedPath)}`);
    }

    // Determine mime type based on file extension
    const ext = path.extname(normalizedPath).toLowerCase();
    let mimeType = 'image/jpeg'; // Default

    switch (ext) {
      case '.png':
        mimeType = 'image/png';
        break;
      case '.gif':
        mimeType = 'image/gif';
        break;
      case '.svg':
        mimeType = 'image/svg+xml';
        break;
      case '.webp':
        mimeType = 'image/webp';
        break;
      case '.bmp':
        mimeType = 'image/bmp';
        break;
      default:
        // Use default image/jpeg for all other cases
        break;
    }

    const dataUrl = `data:${mimeType};base64,${buffer.toString('base64')}`;
    console.log(`[IPC] Successfully loaded image (${buffer.length} bytes) from: ${normalizedPath}`);
    return dataUrl;
  } catch (error) {
    console.error(`[IPC] Error loading image: ${imagePath}`, error);
    return null;
  }
});

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
  // Check if we're in development or production
  const isDev = process.env.NODE_ENV === 'development';

  if (isDev) {
    // For development: load React dev server
    win.loadURL('http://localhost:3000');
    // Open DevTools in development mode
    win.webContents.openDevTools();
  } else {
    // For production: load built files
    const indexPath = path.join(__dirname, 'index.html');
    console.log('Loading index from:', indexPath);

    // Enable more verbose logging for debugging
    win.webContents.on('did-start-loading', () => {
      console.log('Started loading the page');
    });

    win.webContents.on('did-finish-load', () => {
      console.log('Page loaded successfully');
    });

    win.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
      console.error('Failed to load:', errorCode, errorDescription);
    });

    win.webContents.on('console-message', (event, level, message, line, sourceId) => {
      console.log(`Console ${level}: ${message}`);
    });
    // Load the index.html file
    win.loadFile(indexPath);

    // Uncomment this line during development if you need to debug production builds
    // win.webContents.openDevTools();
  }

  // Handle squirrel events for Windows installer
  if (require('electron-squirrel-startup')) {
    app.quit();
  }
}

function BCV(ref) {
  const bookNum = parseInt(ref.slice(0, 3), 10) - 1;
  const chapter = parseInt(ref.slice(3, 6), 10);
  const verse = parseInt(ref.slice(6, 9), 10);
  return [bookNum, chapter, verse];
}

function bookName(bookNum, projectFolder) {
  const bookPrefixes =
    '01GEN,02EXO,03LEV,04NUM,05DEU,06JOS,07JDG,08RUT,091SA,102SA,111KI,122KI,131CH,142CH,15EZR,16NEH,17EST,18JOB,19PSA,20PRO,21ECC,22SNG,23ISA,24JER,25LAM,26EZK,27DAN,28HOS,29JOL,30AMO,31OBA,32JON,33MIC,34NAM,35HAB,36ZEP,37HAG,38ZEC,39MAL,41MAT,42MRK,43LUK,44JHN,45ACT,46ROM,471CO,482CO,49GAL,50EPH,51PHP,52COL,531TH,542TH,551TI,562TI,57TIT,58PHM,59HEB,60JAS,611PE,622PE,631JN,642JN,653JN,66JUD,67REV,68TOB,69JDT,70ESG,71WIS,72SIR,73BAR,74LJE,75S3Y,76SUS,77BEL,781MA,792MA,803MA,814MA,821ES,832ES,84MAN,85PS2,86ODA,87PSS,A4EZA,A55EZ,A66EZ,B2DAG,B3PS3,B42BA,B5LBA,B6JUB,B7ENO,B81MQ,B92MQ,C03MQ,C1REP,C24BA,C3LAO,A0FRT,A1BAK,A2OTH,A7INT,A8CNC,A9GLO,B0TDX,B1NDX,94XXA,95XXB,96XXC,97XXD,98XXE,99XXF';
  const bookPrefix = bookPrefixes.slice(bookNum * 6, bookNum * 6 + 5);
  const folderName = path.basename(projectFolder);
  return path.join(projectFolder, bookPrefix + folderName + '.sfm');
}

async function termsXmlToObject(xmlString) {
  try {
    // Parse XML string
    const result = await xml2js.parseStringPromise(xmlString.replace(/\r/g, ''), {
      explicitArray: false, // Avoid arrays for single elements
      mergeAttrs: true, // Merge attributes (like Id, Guess) into the object
    });

    // Transform to desired structure
    const termRenderings = result.TermRenderingsList.TermRendering;
    const output = {};

    // Handle single or multiple TermRendering elements
    const termArray = Array.isArray(termRenderings) ? termRenderings : [termRenderings];

    termArray.forEach(term => {
      const id = term.Id;
      // Unicode normalization for Id
      const key = id.normalize('NFC');
      output[key] = {
        originalId: id,
        renderings: term.Renderings.replace(/\|\|/g, '\n'),
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

async function termsObjectToXml(obj) {
  try {
    const builder = new xml2js.Builder({
      xmldec: { version: '1.0', encoding: 'utf-8' },
      renderOpts: { pretty: true },
    });

    // Build the TermRenderingsList structure
    const xmlObj = {
      TermRenderingsList: {
        TermRendering: Object.entries(obj).map(([id, data]) => ({
          $: { Id: data.originalId ?? id, Guess: data.isGuessed.toString() }, // Attributes
          Renderings: data.renderings.replace(/\n/g, '||'), // Convert newlines to ||
          Glossary: data._glossary || {}, // Preserve empty or existing
          Changes: data._changes || {}, // Preserve empty or existing
          Notes: data._notes || {}, // Preserve empty or existing
          Denials: data.denials?.length ? { Denial: data.denials } : {}, // Handle denials array
        })),
      },
    };

    return builder
      .buildObject(xmlObj)
      .replace(/\/>/g, ' />') // Add original space to self-closing tags
      .replace(/\n/g, '\r\n') // Revert newlines to CRLF
      .replace(
        /<Change>\s*\n\s*<UserName>([^<]*)<\/UserName>\s*\n\s*<Date>([^<]*)<\/Date>/g,
        '<Change UserName="$1" Date="$2">'
      ); // Convert Change elements to attributes
  } catch (error) {
    console.error('Error building XML:', error);
    throw error;
  }
}

ipcMain.handle('load-term-renderings', async (event, projectFolder, saveToDemo) => {
  try {
    const xmlFilePath = path.join(projectFolder, 'TermRenderings.xml');
    const xmlFilePathDemo = path.join(
      projectFolder,
      saveToDemo ? 'TermRenderings-Demo.xml' : 'TermRenderings.xml'
    );

    let xmlFilePathToUse = xmlFilePath;
    if (fs.existsSync(xmlFilePathDemo)) {
      xmlFilePathToUse = xmlFilePathDemo;
    }
    console.log('Loading term renderings from:', xmlFilePathToUse);
    // Read the XML file into a javascript object
    if (fs.existsSync(xmlFilePathToUse)) {
      const data = fs.readFileSync(xmlFilePathToUse, 'utf8');
      const obj = await termsXmlToObject(data);
      return obj;
    } else {
      console.log('no xml renderings.');
    }
  } catch (e) {
    console.log('error loading term renderings:', e);
  }
  return {};
});

ipcMain.handle('save-term-renderings', async (event, projectFolder, saveToDemo, data) => {
  try {
    const filePath = path.join(
      projectFolder,
      saveToDemo ? 'TermRenderings-Demo.xml' : 'TermRenderings.xml'
    );
    const xmlOutput = await termsObjectToXml(data);
    fs.writeFileSync(filePath, xmlOutput, 'utf8');
    console.log('Term renderings saved successfully.');
    return { success: true };
  } catch (e) {
    return { error: e.message };
  }
});

ipcMain.handle('select-project-folder', async event => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory'],
  });
  if (result.canceled || !result.filePaths.length) {
    return null;
  }
  return result.filePaths[0];
});

function getVerseText(usfmChapterText, verseNum) {
  // Regular expression to match verse markers (single or bridged, e.g., \v 12 or \v 11-14)
  const verseRegex = /\\v (\d+(?:\u200f?-\d+)?)(.*?)(?=(?:\\v \d+(?:\u200f?-\d+)?|$))/gs;

  let result = '';
  let match;

  // Iterate through all verse matches
  while ((match = verseRegex.exec(usfmChapterText)) !== null) {
    const verseRange = match[1]; // e.g., "12" or "11-14"
    const verseContent = match[2].trim(); // Content after the verse marker

    // Check if verseNum is a single number or part of a range
    if (verseRange.includes('-')) {
      // Handle bridged verses (e.g., "11-14")
      const [start, end] = verseRange.split(/\u200f?-/).map(Number);
      if (verseNum >= start && verseNum <= end) {
        return verseContent;
      }
    } else {
      // Handle single verse (e.g., "12")
      if (parseInt(verseRange) === verseNum) {
        return verseContent;
      }
    }
  }
  // if (usfmChapterText && !result) {
  console.log('There is chapter text but verse not found:', verseNum);
  // }
  return result; // Return empty string if verse not found
}

// Helper to clean USFM verse text (remove markers, keep readable text)
function cleanUsfmText(usfmText) {
  //TODO: Verify this cleans things accurately.
  // Remove footnotes, cross-references, and all \...* blocks
  usfmText = usfmText.replace(/\\f .*?\\f\*/gs, '');
  usfmText = usfmText.replace(/\\x .*?\\x\*/gs, '');
  usfmText = usfmText.replace(/\\ft .*?\\ft\*/gs, '');
  usfmText = usfmText.replace(/\\add .*?\\add\*/gs, '');
  // Remove section headings, parallel passage refs, etc.
  usfmText = usfmText.replace(/\\s[0-9]? .*/g, '');
  usfmText = usfmText.replace(/\\r .*/g, '');
  usfmText = usfmText.replace(/\\p/g, '');
  usfmText = usfmText.replace(/\\q[0-9]?/g, '');
  // Remove formatting markers but keep their content
  usfmText = usfmText.replace(/\\[a-zA-Z0-9]+\*/g, '');
  usfmText = usfmText.replace(/\\[a-zA-Z0-9]+/g, '');
  // Remove word-level markup: \w ...|...
  usfmText = usfmText.replace(/\\w ([^|]+)\|[^\\]+\\w\*/g, '$1');
  // Remove extra whitespace
  usfmText = usfmText.replace(/\s+/g, ' ').trim();
  return usfmText;
}

ipcMain.handle('get-filtered-verses', async (event, projectFolder, curRefs) => {
  try {
    const requestedVerses = {};
    const chapterVersePerBook = {};
    // For each reference, push chapter and verse onto the array for that book
    curRefs.forEach(ref => {
      const [bookNum, chapter, verse] = BCV(ref);
      const bName = bookName(bookNum, projectFolder);
      if (!chapterVersePerBook[bName]) {
        chapterVersePerBook[bName] = [];
      }
      chapterVersePerBook[bName].push([chapter, verse, ref]);
    });
    // console.log('chapterVersePerBook:', chapterVersePerBook);

    // For each key in chapterVersePerBook, read the SFM file and add the verses to requestedVerses
    for (const [bName, refArray] of Object.entries(chapterVersePerBook)) {
      const filePath = bName;
      if (fs.existsSync(filePath)) {
        // console.log(`Processing book: ${bName}`);
        const usfmText = fs.readFileSync(filePath, 'utf8');
        const chapters = {};
        usfmText
          .split(/(\\c \d+)/)
          .slice(1)
          .forEach((content, i, arr) => {
            if (i % 2 === 0) {
              // Chapter marker
              const chapterNum = parseInt(content.match(/\d+/)[0]);
              chapters[chapterNum] = arr[i + 1] || '';
            }
          });
        // console.log(`Found ${Object.keys(chapters).length} chapters in book: ${bName}`, refArray);
        for (const [chapter, verse, ref] of refArray) {
          // console.log(`Processing ref: ${ref} (Chapter: ${chapter}, Verse: ${verse})`);
          if (chapters[chapter]) {
            const verseText = getVerseText(chapters[chapter], verse);
            // console.log(`Found verse text for ${ref}:`, verseText);
            if (verseText) {
              const cleanedText = cleanUsfmText(verseText);
              requestedVerses[ref] = cleanedText;
              // console.log(`Added verse ${verse} from chapter ${chapter} of book ${bName}:`, cleanedText);
            } else {
              console.warn(`Verse ${verse} not found in chapter ${chapter} of book ${bName}`);
            }
          } else {
            console.warn(`Chapter ${chapter} not found in book ${bName}`);
          }
        }
        // const filePath = path.join(projectFolder, 'all_verses.json');
        // const allVerses = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        // const filtered = Object.fromEntries(
        //   curRefs.filter(ref => allVerses.hasOwnProperty(ref)).map(ref => [ref, allVerses[ref]])
        // );
        // return filtered;
      } else {
        console.log(`File not found: ${filePath}`);
      }
    }
    return requestedVerses;
  } catch (e) {
    console.log('Error getting filtered verses:', e);
    return { error: e.message };
  }
});

// Function to load settings
function loadFromJson(jsonPath, jsonFilename) {
  if (!jsonPath) {
    jsonPath = app.getPath('userData');
  }
  const jsonFilePath = path.join(jsonPath, jsonFilename);
  console.log('Loading from:', jsonFilePath);
  try {
    if (fs.existsSync(jsonFilePath)) {
      console.log('File exists, reading content');
      const data = fs.readFileSync(jsonFilePath, 'utf8');
      const parsed = JSON.parse(data);
      const entryCount = parsed ? Object.keys(parsed).length : 0;
      console.log(`Successfully parsed JSON with ${entryCount} entries`);
      return parsed;
    } else {
      console.error(`File not found: ${jsonFilePath}`);
    }
  } catch (error) {
    console.error('Failed to load JSON file:', error);
  }
  return {}; // Return empty settings if file doesn't exist or has an error
}

// Function to save settings
function saveToJson(jsonPath, jsonFilename, settings) {
  if (!jsonPath) {
    jsonPath = app.getPath('userData');
  }
  const jsonFilePath = path.join(jsonPath, jsonFilename);
  console.log('Saving settings to:', jsonFilePath);
  try {
    fs.writeFileSync(jsonFilePath, JSON.stringify(settings, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error('Failed to save settings:', error);
    return false;
  }
}

// Expose these functions via IPC
ipcMain.handle('load-from-json', async (event, jsonPath, jsonFilename) => {
  return loadFromJson(jsonPath, jsonFilename);
});

ipcMain.handle('save-to-json', async (event, jsonPath, jsonFilename, settings) => {
  return saveToJson(jsonPath, jsonFilename, settings);
});

// Handler to check path status
ipcMain.handle('stat-path', async (event, filePath) => {
  try {
    // Normalize the path for Windows
    const normalizedPath = path.normalize(filePath);
    console.log(`Checking if path exists: ${normalizedPath}`);

    const stats = fs.statSync(normalizedPath);
    const isDir = stats.isDirectory();
    console.log(`Path ${normalizedPath} exists and isDirectory: ${isDir}`);

    return {
      exists: true,
      isFile: stats.isFile(),
      isDirectory: isDir, // Boolean value, not a function
      size: stats.size,
      modifiedTime: stats.mtime,
    };
  } catch (error) {
    return {
      exists: false,
      error: error.message,
    };
  }
});

// Handle IDML data merge export
ipcMain.handle(
  'export-data-merge',
  async (event, { locations, templateName, format, projectFolder }) => {
    try {
      // Determine default output folder
      const localFiguresPath = path.join(projectFolder, 'local', 'figures');
      let defaultPath;

      try {
        await fs.promises.access(localFiguresPath);
        defaultPath = localFiguresPath;
      } catch {
        defaultPath = projectFolder;
      }

      let data;
      if (format === 'idml') {
        // Prepare IDML data merge content
        const dataMergeHeader = locations.map(loc => loc.mergeKey).join('\t');
        const dataMergeContent = locations.map(loc => loc.vernLabel || '').join('\t');
        data = dataMergeHeader + '\n' + dataMergeContent + '\n';
      } else {        // Prepare MAPX data merge content
        // For each location, use the provided mapxKey and vernacular label, separated by a tab.
        data = locations
          .map(loc => {
            const mapxKey = loc.mapxKey;
            const vernacularLabel = loc.vernLabel || '';
            return `${mapxKey}\t${vernacularLabel}`;
          })
          .join('\n');
      }

      // Generate suggested filename
      const projectName = path.basename(projectFolder);
      const suggestedFilename = `${templateName} @${projectName}.${format}.txt`;
      const suggestedPath = path.join(defaultPath, suggestedFilename);

      // Show save dialog
      const fmtUpper = format.toUpperCase();
      const result = await dialog.showSaveDialog({
        title: `Export ${fmtUpper} Data Merge`,
        defaultPath: suggestedPath,
        filters: [
          {
            name: `${fmtUpper} Data Merge Files`,
            extensions: [`${format}.txt`],
          },
        ],
      });

      if (result.canceled) {
        return {
          success: false,
          canceled: true,
          message: 'Export canceled by user',
        };
      }

      if (format === 'idml') {
        // Write idml.txt file with BOM and UTF-16 LE encoding.
        await fs.promises.writeFile(result.filePath, '\uFEFF' + data, { encoding: 'utf16le' });
      } else {
        // Write mapx.txt file with BOM and UTF-8 encoding
        await fs.promises.writeFile(result.filePath, '\uFEFF' + data, 'utf8');
      }

      return {
        success: true,
        filePath: result.filePath,
        message: `Data merge exported successfully to ${path.basename(result.filePath)}`,
      };
    } catch (error) {
      console.error('Export data merge error:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }
);

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
