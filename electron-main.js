const { app, BrowserWindow } = require('electron');
const { initialize, enable } = require('@electron/remote/main');
const { ipcMain, dialog } = require('electron');
const fs = require('fs');
const path = require('path');
const xml2js = require('xml2js');

// Settings relating to Settings.xml
let curProjectFolder = '';
let settings = {};

// Reference to the main window for focus restoration
let mainWindow = null;

// Function to load settings from Settings.xml, if not already loaded
async function loadSettings(projectFolder) {
  if (projectFolder === curProjectFolder) {
    console.log(`[Settings] Settings already loaded for project: ${curProjectFolder}`);
    return;
  }
  curProjectFolder = projectFolder;
  const settingsPath = path.join(curProjectFolder, 'Settings.xml');
  settings = { 
    language: path.basename(curProjectFolder),
    pre: '',
    post: path.basename(curProjectFolder) + '.sfm',
    use41: true,
    useMAT: true,
    versification: '4',
    name: path.basename(curProjectFolder),
  }

  try {
    const rawContents = await fs.promises.readFile(settingsPath, 'utf8');
    // extract the Naming attributes
    const match = rawContents.match(/<Naming PrePart="(.*)" PostPart="(.*)" BookNameForm="(.*)"/);
    if (match) {
      settings.pre = match[1];
      settings.post = match[2];
      settings.useMAT = match[3].includes('MAT');
      settings.use41 = match[3].includes('41');
    }
    // if rawContents contains <Versification> tag, extract it
    const versificationMatch = rawContents.match(/<Versification>(\d+)<\/Versification>/);
    if (versificationMatch) {
      settings.versification = versificationMatch[1];
    } 
    // if rawContents contains <Language> tag, extract it
    const languageMatch = rawContents.match(/<Language>(.*?)<\/Language>/);
    if (languageMatch) {
      settings.language = languageMatch[1];
    }   
    // if rawContents contains <Name> tag, extract it
    const nameMatch = rawContents.match(/<Name>(.*?)<\/Name>/);
    if (nameMatch) {
      settings.name = nameMatch[1];
    }
    console.log(`[Settings] Loaded settings from ${settingsPath}`, settings);
  } catch (error) {
    console.error(`[Settings] Failed to load settings from ${settingsPath}:`, error);
  }
}

initialize();

// File logging setup for production debugging
const logToFile = (message) => {
  const logPath = path.join(app.getPath('userData'), 'electron-main.log');
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] ${message}\n`;
  
  try {
    fs.appendFileSync(logPath, logEntry, 'utf8');
  } catch (error) {
    // Fallback - at least try to show in any available console
    console.error('Failed to write to log file:', error);
  }
};

// Override console methods to also log to file
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

console.log = (...args) => {
  const message = args.join(' ');
  originalConsoleLog(...args);
  logToFile(`LOG: ${message}`);
};

console.error = (...args) => {
  const message = args.join(' ');
  originalConsoleError(...args);
  logToFile(`ERROR: ${message}`);
};

console.warn = (...args) => {
  const message = args.join(' ');
  originalConsoleWarn(...args);
  logToFile(`WARN: ${message}`);
};

// Helper function to get the correct icon path
function getIconPath() {
  if (app.isPackaged) {
    // In production, icon is in resources
    return path.join(process.resourcesPath, 'icon.ico');
  } else {
    // In development, icon is in buildResources
    return path.join(__dirname, 'buildResources', 'icon.ico');
  }
}

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
    icon: getIconPath(),
    webPreferences: {
      nodeIntegration: false, // more secure
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });
  
  // Store reference to main window for focus restoration
  mainWindow = win;
  
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

function bookName(bookNum) {
  const bookSchemes =
    '01GEN,02EXO,03LEV,04NUM,05DEU,06JOS,07JDG,08RUT,091SA,102SA,111KI,122KI,131CH,142CH,15EZR,16NEH,17EST,18JOB,19PSA,20PRO,21ECC,22SNG,23ISA,24JER,25LAM,26EZK,27DAN,28HOS,29JOL,30AMO,31OBA,32JON,33MIC,34NAM,35HAB,36ZEP,37HAG,38ZEC,39MAL,41MAT,42MRK,43LUK,44JHN,45ACT,46ROM,471CO,482CO,49GAL,50EPH,51PHP,52COL,531TH,542TH,551TI,562TI,57TIT,58PHM,59HEB,60JAS,611PE,622PE,631JN,642JN,653JN,66JUD,67REV,68TOB,69JDT,70ESG,71WIS,72SIR,73BAR,74LJE,75S3Y,76SUS,77BEL,781MA,792MA,803MA,814MA,821ES,832ES,84MAN,85PS2,86ODA,87PSS,A4EZA,A55EZ,A66EZ,B2DAG,B3PS3,B42BA,B5LBA,B6JUB,B7ENO,B81MQ,B92MQ,C03MQ,C1REP,C24BA,C3LAO,A0FRT,A1BAK,A2OTH,A7INT,A8CNC,A9GLO,B0TDX,B1NDX,94XXA,95XXB,96XXC,97XXD,98XXE,99XXF';
  let start = (bookNum * 6) + (settings.use41 ? 0 : 2);
  let length = (settings.useMAT ? 3 : 0) + (settings.use41 ? 2 : 0);
  const bookScheme = bookSchemes.slice(start, start + length);
  console.log(`[BookName] Book number: ${bookNum}, Start: ${start}, Length: ${length}, Use MAT: ${settings.useMAT}, Use 41: ${settings.use41}, Book scheme: ${bookScheme}, pre: ${settings.pre}, post: ${settings.post}`);
  return path.join(curProjectFolder, settings.pre + bookScheme + settings.post);
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
  return null;
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

// Handler for selecting template files (images or IDML merge files)
ipcMain.handle('select-template-file', async (event) => {
  try {
    const result = await dialog.showOpenDialog({
      title: 'Select a template image or an IDML merge file',
      properties: ['openFile'],
      filters: [
        {
          name: 'All Template Files',
          extensions: ['jpg', 'jpeg', 'idml.txt']
        },
        {
          name: 'JPEG Images',
          extensions: ['jpg', 'jpeg']
        },
        {
          name: 'IDML Merge Files',
          extensions: ['idml.txt']
        },
        {
          name: 'All Files',
          extensions: ['*']
        }
      ]
    });

    if (result.canceled || !result.filePaths.length) {
      return { canceled: true };
    }

    const filePath = result.filePaths[0];
    const fileName = path.basename(filePath);
    
    // Read file content if it's a text file
    let fileContent = null;
    if (fileName.toLowerCase().endsWith('.txt')) {
      try {
        const buffer = await fs.promises.readFile(filePath);
        fileContent = buffer;
      } catch (error) {
        console.error('Error reading file content:', error);
        return { 
          success: false, 
          error: `Failed to read file: ${error.message}` 
        };
      }
    }

    return {
      success: true,
      filePath,
      fileName,
      fileContent // Will be null for non-text files
    };
  } catch (error) {
    console.error('Error in select-template-file:', error);
    return { 
      success: false, 
      error: error.message 
    };
  }
});

function getVerseText(usfmChapterText, verseNum) {
  // Handle verse 0 - content after chapter marker but before first verse
  if (verseNum === 0) {
    const firstVerseMatch = usfmChapterText.match(/\\v \d+/);
    if (firstVerseMatch) {
      // Return content from start of chapter to first verse marker
      const beforeFirstVerse = usfmChapterText.substring(0, firstVerseMatch.index);
      return beforeFirstVerse.trim();
    } else {
      // No verses found, return entire chapter content
      return usfmChapterText.trim();
    }
  }
  
  // Handle regular verses (1+)
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
    await loadSettings(projectFolder);
    // For each reference, push chapter and verse onto the array for that book
    curRefs.forEach(ref => {
      const [bookNum, chapter, verse] = BCV(ref);
      const bName = bookName(bookNum);
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

// Handle IDML/MAPX data merge export
ipcMain.handle(
  'export-data-merge',
  async (event, { locations, templateName, format, projectFolder }) => {
    await loadSettings(projectFolder);
    try {
      // Automatically create shared/labeler folder structure
      const sharedPath = path.join(projectFolder, 'shared');
      const sharedLabelerPath = path.join(sharedPath, 'labeler');
      
      // Create 'shared' folder if it doesn't exist
      try {
        await fs.promises.access(sharedPath);
      } catch {
        console.log(`Creating shared folder: ${sharedPath}`);
        await fs.promises.mkdir(sharedPath, { recursive: true });
      }
      
      // Create 'labeler' folder if it doesn't exist
      try {
        await fs.promises.access(sharedLabelerPath);
      } catch {
        console.log(`Creating labeler folder: ${sharedLabelerPath}`);
        await fs.promises.mkdir(sharedLabelerPath, { recursive: true });
      }
      
      // Use the shared/labeler path as default
      const defaultPath = sharedLabelerPath;

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
      const projectName = settings.name;
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

// Handler to get default template folder
ipcMain.handle('getDefaultTemplateFolder', async (event) => {
  const debugInfo = [];
  
  try {
    const workingDir = process.cwd();
    debugInfo.push(`Working directory: ${workingDir}`);
    
    // Check if working directory exists and is readable
    try {
      const workingStats = fs.statSync(workingDir);
      debugInfo.push(`Working dir exists: ${workingStats.isDirectory()}`);
    } catch (err) {
      debugInfo.push(`Working dir error: ${err.message}`);
    }
    
    // List contents of working directory
    try {
      const contents = fs.readdirSync(workingDir);
      debugInfo.push(`Working dir contents (${contents.length} items): ${contents.slice(0, 10).join(', ')}${contents.length > 10 ? '...' : ''}`);
      
      // Specifically check for _LabelerTemplates in the list
      const hasTemplateFolder = contents.includes('_LabelerTemplates');
      debugInfo.push(`_LabelerTemplates in directory listing: ${hasTemplateFolder}`);
    } catch (err) {
      debugInfo.push(`Failed to read working dir: ${err.message}`);
    }
    
    const templateFolderPath = path.join(workingDir, '_LabelerTemplates');
    debugInfo.push(`Template folder path: ${templateFolderPath}`);
    
    try {
      const stats = fs.statSync(templateFolderPath);
      if (stats.isDirectory()) {
        const normalizedPath = path.resolve(templateFolderPath);
        debugInfo.push(`SUCCESS: Template folder found: ${normalizedPath}`);
        console.log('getDefaultTemplateFolder DEBUG:\n' + debugInfo.join('\n'));
        return normalizedPath;
      } else {
        debugInfo.push('Template path exists but is not a directory');
      }
    } catch (error) {
      debugInfo.push(`Template folder not found: ${error.code} - ${error.message}`);
    }
    
    console.log('getDefaultTemplateFolder DEBUG:\n' + debugInfo.join('\n'));
    return '';
    
  } catch (error) {
    debugInfo.push(`Unexpected error: ${error.message}`);
    console.error('getDefaultTemplateFolder DEBUG:\n' + debugInfo.join('\n'));
    return '';
  }
});

// Handler to read text files (for autocorrect.txt)
ipcMain.handle('read-file', async (event, filePath) => {
  try {
    const content = await fs.promises.readFile(filePath, 'utf8');
    return content;
  } catch (error) {
    throw error;
  }
});

// Handler to broadcast scripture reference to Paratext
ipcMain.handle('broadcast-reference', async (event, reference) => {
  // Only works on Windows
  if (process.platform !== 'win32') {
    console.log('Reference broadcasting only supported on Windows');
    return { success: false, error: 'Only supported on Windows' };
  }

  try {
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);
    
    // Clean the reference format (similar to cleanRef in Python)
    const cleanedRef = cleanReference(reference);
    
    // Step 1: Set the registry value
    const regKey = 'HKCU\\Software\\SantaFe\\Focus\\ScriptureReference';
    const regCommand = `reg add "${regKey}" /ve /t REG_SZ /d "${cleanedRef}" /f`;
    
    console.log(`Executing registry command: ${regCommand}`);
    
    const { stdout, stderr } = await execAsync(regCommand);
    
    if (stderr && stderr.trim() !== '') {
      console.error('Registry command stderr:', stderr);
      // Don't fail if there's just a warning
      if (!stderr.toLowerCase().includes('error')) {
        console.log('Registry command completed with warnings');
      } else {
        throw new Error(`Registry command failed: ${stderr}`);
      }
    }
    
    console.log('Registry command stdout:', stdout);
    console.log(`Successfully set reference in registry: ${cleanedRef}`);
    
    // Step 2: Broadcast SantaFeFocus message (like the working precompiled helper)
    console.log('Broadcasting SantaFeFocus message to Paratext...');
    
    try {
      // First, try to use the existing helper if available
      const helperPath = path.join(__dirname, 'helpers', 'SantaFeBroadcast.exe');
      
      if (fs.existsSync(helperPath)) {
        console.log('Using existing SantaFeBroadcast.exe helper...');
        const { stdout: helperStdout, stderr: helperStderr } = await execAsync(`"${helperPath}"`, { timeout: 5000 });
        console.log('Helper stdout:', helperStdout || '(no stdout)');
        if (helperStderr && helperStderr.trim()) {
          console.log('Helper stderr:', helperStderr);
        }
        
        if (helperStdout && helperStdout.includes('SUCCESS: SantaFeFocus broadcast completed')) {
          console.log('SantaFeFocus message broadcast succeeded using helper.');
          return;
        }
      }
      
      // If helper doesn't exist or failed, compile and run C# code directly
      console.log('Compiling and running C# broadcast code...');
      
      // Create a temporary C# file
      const tempDir = path.join(__dirname, 'temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir);
      }
      
      const tempCsFile = path.join(tempDir, 'TempBroadcast.cs');
      const tempExeFile = path.join(tempDir, 'TempBroadcast.exe');
      
      // Write the exact same C# code as the working helper
      const csCode = `using System;
using System.Runtime.InteropServices;

class Program
{
    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    static extern uint RegisterWindowMessage(string lpString);
    
    [DllImport("user32.dll")]
    static extern bool PostMessage(IntPtr hWnd, uint Msg, IntPtr wParam, IntPtr lParam);
    
    static int Main(string[] args)
    {
        try
        {
            Console.WriteLine("Registering SantaFeFocus message...");
            uint msgId = RegisterWindowMessage("SantaFeFocus");
            Console.WriteLine("Message ID: " + msgId);
            
            if (msgId == 0)
            {
                Console.WriteLine("ERROR: RegisterWindowMessage failed");
                return 1;
            }
            
            Console.WriteLine("Broadcasting message...");
            bool result = PostMessage((IntPtr)0xFFFF, msgId, (IntPtr)1, IntPtr.Zero);
            Console.WriteLine("PostMessage result: " + result);
            
            if (result)
            {
                Console.WriteLine("SUCCESS: SantaFeFocus broadcast completed");
                return 0;
            }
            else
            {
                Console.WriteLine("ERROR: PostMessage failed");
                return 1;
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine("EXCEPTION: " + ex.Message);
            return 1;
        }
    }
}`;

      fs.writeFileSync(tempCsFile, csCode);
      
      // Compile the C# code
      console.log('Compiling C# broadcast code...');
      const cscPath = 'C:\\Windows\\Microsoft.NET\\Framework64\\v4.0.30319\\csc.exe';
      const compileCmd = `"${cscPath}" /out:"${tempExeFile}" "${tempCsFile}"`;
      
      try {
        await execAsync(compileCmd, { timeout: 10000 });
        console.log('C# code compiled successfully');
        
        // Run the compiled executable
        console.log('Running compiled broadcast executable...');
        const { stdout: exeStdout, stderr: exeStderr } = await execAsync(`"${tempExeFile}"`, { timeout: 5000 });
        
        console.log('Broadcast stdout:', exeStdout || '(no stdout)');
        if (exeStderr && exeStderr.trim()) {
          console.log('Broadcast stderr:', exeStderr);
        }
        
        // Clean up temp files
        try {
          fs.unlinkSync(tempCsFile);
          fs.unlinkSync(tempExeFile);
        } catch (cleanupError) {
          console.log('Note: Could not clean up temp files:', cleanupError.message);
        }
        
        if (exeStdout && exeStdout.includes('SUCCESS: SantaFeFocus broadcast completed')) {
          console.log('SantaFeFocus message broadcast succeeded.');
        } else {
          console.log('SantaFeFocus message may have failed. Check Paratext for reference update.');
        }
        
      } catch (compileError) {
        console.log('C# compilation failed, falling back to PowerShell...');
        
        // Final fallback - try a very basic PowerShell approach
        const basicCmd = `powershell -NoProfile -Command "
          try {
            [System.Reflection.Assembly]::LoadWithPartialName('System.Windows.Forms') | Out-Null
            Add-Type -TypeDefinition 'using System;using System.Runtime.InteropServices;public class User32{[DllImport(\\"user32.dll\\")]public static extern uint RegisterWindowMessage(string s);[DllImport(\\"user32.dll\\")]public static extern bool PostMessage(IntPtr h,uint m,IntPtr w,IntPtr l);}'
            \\$id=[User32]::RegisterWindowMessage('SantaFeFocus')
            \\$r=[User32]::PostMessage(0xFFFF,\\$id,1,0)
            Write-Host \\"ID:\\$id Result:\\$r\\"
          } catch { Write-Host \\"Error:\\$_\\" }
        "`;
        
        const { stdout: basicStdout } = await execAsync(basicCmd, { timeout: 5000 });
        console.log('Basic PowerShell result:', basicStdout || '(no output)');
      }
      
    } catch (broadcastError) {
      console.warn('Warning: All SantaFeFocus broadcast attempts failed:', broadcastError.message);
      console.log('Registry key has been set. Paratext may need to be restarted or manually refreshed.');
    }
    
    return { success: true, reference: cleanedRef };
  } catch (error) {
    console.error('Error broadcasting reference:', error);
    return { success: false, error: error.message };
  }
});

// Handler to restore window focus after operations that disrupt input
ipcMain.handle('restore-window-focus', async (event) => {
  try {
    if (!mainWindow || mainWindow.isDestroyed()) {
      console.log('No main window available for focus restoration');
      return { success: false, error: 'Main window not available' };
    }

    console.log('Attempting to restore window focus...');
    
    // Force the window to lose and regain focus to reset Electron's input routing
    if (mainWindow.isFocused()) {
      console.log('Window is focused, blurring and refocusing...');
      mainWindow.blur();
      // Small delay to ensure the blur takes effect
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    // Bring window to front and focus
    mainWindow.show();
    mainWindow.focus();
    mainWindow.focusOnWebView();
    
    console.log('Window focus restoration completed');
    return { success: true };
    
  } catch (error) {
    console.error('Error restoring window focus:', error);
    return { success: false, error: error.message };
  }
});

// Handler to discover collections by scanning template folder
ipcMain.handle('discover-collections', async (event, templateFolderPath) => {
  try {
    console.log(`Discovering collections in: ${templateFolderPath}`);
    
    if (!templateFolderPath) {
      throw new Error('Template folder path is required');
    }

    // Check if template folder exists
    try {
      const stat = await fs.promises.stat(templateFolderPath);
      if (!stat.isDirectory()) {
        throw new Error('Template folder path is not a directory');
      }
    } catch (error) {
      throw new Error(`Template folder not found: ${templateFolderPath}`);
    }

    // Read all subdirectories
    const entries = await fs.promises.readdir(templateFolderPath, { withFileTypes: true });
    const collections = [];
    
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const collectionPath = path.join(templateFolderPath, entry.name);
        const configPath = path.join(collectionPath, 'collection.json');
        
        try {
          // Check if collection.json exists
          await fs.promises.access(configPath);
          
          // Read and parse collection.json
          const configData = await fs.promises.readFile(configPath, 'utf8');
          const config = JSON.parse(configData);
          
          // Add the collection path and ensure ID is set
          config.path = collectionPath;
          config.id = config.id || entry.name.toUpperCase();
          
          console.log(`Found collection: ${config.name} (${config.id})`);
          collections.push(config);
        } catch (error) {
          // Skip directories without valid collection.json
          console.warn(`Skipping directory ${entry.name}: ${error.message}`);
        }
      }
    }
    
    console.log(`Discovered ${collections.length} collections`);
    return collections;
  } catch (error) {
    console.error('Error discovering collections:', error);
    throw error;
  }
});

// Helper function to clean reference format
function cleanReference(reference) {
  // Convert formats like "JHN1.4" to "JHN 1:4" or "MRKL12.14" to "MRK 12:14"
  const pattern = /([123A-Z]{3})\s?(?:[LRA-G]?)(\d+)\.(\d+)/;
  const match = reference.match(pattern);
  if (match) {
    const [, book, chapter, verse] = match;
    // Remove any suffix letters from book name (like MRKL -> MRK)
    const cleanBook = book.replace(/[LRA-G]$/, '');
    const cleaned = `${cleanBook} ${chapter}:${verse}`;
    console.log(`Cleaned reference: "${reference}" -> "${cleaned}"`);
    return cleaned;
  }
  console.log(`Reference passed through unchanged: "${reference}"`);
  return reference; // Return as-is if no match
}

app.whenReady().then(() => {
  console.log('=== Paratext Diagram Labeler Starting ===');
  console.log(`App version: ${app.getVersion()}`);
  console.log(`Electron version: ${process.versions.electron}`);
  console.log(`Node version: ${process.versions.node}`);
  console.log(`Platform: ${process.platform}`);
  console.log(`Working directory: ${process.cwd()}`);
  console.log(`App path: ${app.getAppPath()}`);
  console.log(`User data path: ${app.getPath('userData')}`);
  console.log(`Log file location: ${path.join(app.getPath('userData'), 'electron-main.log')}`);
  console.log('=====================================');
  
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
