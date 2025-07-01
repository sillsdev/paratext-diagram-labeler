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

// Handle IDML data merge export
ipcMain.handle(
  'export-data-merge',
  async (event, { locations, templateName, format, projectFolder }) => {
    await loadSettings(projectFolder);
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
      
      // Specifically check for _MapLabelerTemplates in the list
      const hasTemplateFolder = contents.includes('_MapLabelerTemplates');
      debugInfo.push(`_MapLabelerTemplates in directory listing: ${hasTemplateFolder}`);
    } catch (err) {
      debugInfo.push(`Failed to read working dir: ${err.message}`);
    }
    
    const templateFolderPath = path.join(workingDir, '_MapLabelerTemplates');
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
    
    // Verify the registry value was set correctly
    try {
      const verifyCommand = `reg query "${regKey}" /ve`;
      const { stdout: verifyOutput } = await execAsync(verifyCommand);
      console.log('Registry verification:', verifyOutput);
    } catch (verifyError) {
      console.warn('Could not verify registry value:', verifyError.message);
    }
    
    // Step 2: Broadcast Windows message to notify Paratext
    // This matches the Python ptxprint implementation exactly
    console.log('Broadcasting SantaFeFocus message to Paratext...');
    
    try {
      // Try a more robust PowerShell approach with verbose output and error handling
      const broadcastCmd = `powershell -ExecutionPolicy Bypass -NoProfile -Command "
        \\$VerbosePreference = 'Continue'
        \\$ErrorActionPreference = 'Stop'
        
        Write-Output 'Starting SantaFeFocus broadcast...'
        
        try {
          # Define the Win32 API functions
          \\$signature = @'
[DllImport(\\"user32.dll\\", SetLastError = true, CharSet = CharSet.Unicode)]
public static extern uint RegisterWindowMessage(string lpString);

[DllImport(\\"user32.dll\\", SetLastError = true)]
public static extern bool PostMessage(IntPtr hWnd, uint Msg, IntPtr wParam, IntPtr lParam);

[DllImport(\\"kernel32.dll\\")]
public static extern uint GetLastError();
'@
          
          Write-Output 'Adding Win32 API type...'
          Add-Type -MemberDefinition \\$signature -Name 'Win32' -Namespace 'SantaFe'
          Write-Output 'Win32 API type added successfully'
          
          # Register the custom message
          Write-Output 'Registering SantaFeFocus message...'
          \\$messageId = [SantaFe.Win32]::RegisterWindowMessage('SantaFeFocus')
          \\$lastError = [SantaFe.Win32]::GetLastError()
          Write-Output \\"RegisterWindowMessage returned: \\$messageId (LastError: \\$lastError)\\"
          
          if (\\$messageId -eq 0) {
            throw \\"RegisterWindowMessage failed with error: \\$lastError\\"
          }
          
          # Broadcast the message to all top-level windows (HWND_BROADCAST = 0xFFFF)
          Write-Output 'Broadcasting message to all windows...'
          \\$result = [SantaFe.Win32]::PostMessage([IntPtr]0xFFFF, \\$messageId, [IntPtr]1, [IntPtr]0)
          \\$lastError = [SantaFe.Win32]::GetLastError()
          Write-Output \\"PostMessage returned: \\$result (LastError: \\$lastError)\\"
          
          if (\\$result) {
            Write-Output 'SUCCESS: SantaFeFocus message broadcast completed'
          } else {
            Write-Output \\"WARNING: PostMessage returned false (Error: \\$lastError)\\"
          }
          
          Write-Output \\"Final result: MessageID=\\$messageId, Broadcast=\\$result\\"
          
        } catch {
          Write-Error \\"Exception occurred: \\$(\\_)\\"
          Write-Error \\"Exception type: \\$(\\_)?.GetType()?.FullName\\"
          Write-Error \\"Stack trace: \\$(\\_)?.ScriptStackTrace\\"
          exit 1
        }
      "`;
      
      console.log('Executing enhanced PowerShell broadcast command...');
      const { stdout: broadcastStdout, stderr: broadcastStderr } = await execAsync(broadcastCmd, { timeout: 20000 });
      
      console.log('Enhanced broadcast stdout:', broadcastStdout || '(no stdout)');
      if (broadcastStderr && broadcastStderr.trim()) {
        console.log('Enhanced broadcast stderr:', broadcastStderr);
      }
      
      // Try a simpler fallback approach
      let simpleStdout = '';
      if (!broadcastStdout || !broadcastStdout.includes('SUCCESS')) {
        console.log('Enhanced approach did not show success, trying simple fallback...');
        
        const simpleCmd = `powershell -Command "
          Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public class MsgAPI { [DllImport(\\"user32.dll\\")] public static extern uint RegisterWindowMessage(string s); [DllImport(\\"user32.dll\\")] public static extern bool PostMessage(IntPtr h, uint m, IntPtr w, IntPtr l); }'
          \\$m = [MsgAPI]::RegisterWindowMessage('SantaFeFocus')
          \\$r = [MsgAPI]::PostMessage([IntPtr]0xFFFF, \\$m, [IntPtr]1, [IntPtr]0)
          'MsgID:' + \\$m + ' Result:' + \\$r
        "`;
        
        const { stdout: simpleStdoutResult, stderr: simpleStderr } = await execAsync(simpleCmd, { timeout: 10000 });
        simpleStdout = simpleStdoutResult || '';
        console.log('Simple fallback result:', simpleStdout || '(no stdout)');
        if (simpleStderr && simpleStderr.trim()) {
          console.log('Simple fallback stderr:', simpleStderr);
        }
      }
      
      // Additional fallback: Use precompiled helper
      if (!broadcastStdout?.includes('SUCCESS') && !simpleStdout?.includes('Result:True')) {
        console.log('Previous PowerShell approaches unclear, trying precompiled helper...');
        
        try {
          const path = require('path');
          
          // Try to use the precompiled helper
          const precompiledHelper = path.join(__dirname, 'helpers', 'SantaFeBroadcast.exe');
          if (fs.existsSync(precompiledHelper)) {
            console.log('Using precompiled SantaFeBroadcast helper...');
            try {
              const { stdout: helperOut, stderr: helperErr } = await execAsync(`"${precompiledHelper}"`, { timeout: 5000 });
              console.log('Precompiled helper output:', helperOut || '(no output)');
              if (helperErr && helperErr.trim()) {
                console.log('Precompiled helper stderr:', helperErr);
              }
            } catch (helperError) {
              console.log('Precompiled helper failed:', helperError.message);
            }
          } else {
            console.log('Precompiled helper not found at:', precompiledHelper);
            console.log('Windows message broadcasting will rely on PowerShell approaches only.');
          }
          
        } catch (csError) {
          console.log('Helper execution error:', csError.message);
        }
      }
      
      console.log('All SantaFeFocus message broadcast attempts completed.');
      
      // Final status message for the user
      if (!broadcastStdout?.includes('SUCCESS') && !simpleStdout?.includes('Result:True')) {
        console.log('Windows message broadcasting was attempted but may not have succeeded.');
        console.log('However, the registry key has been set correctly, so Paratext should still receive the update.');
        console.log('If Paratext does not scroll to the reference, try restarting Paratext or manually navigating to the reference.');
      } else {
        console.log('Windows message broadcast appears to have succeeded.');
      }
      
    } catch (broadcastError) {
      console.warn('Warning: SantaFeFocus message broadcast failed:', broadcastError.message);
      console.log('Registry key has been set. Paratext may need to be restarted or manually refreshed.');
      
      // Final fallback: Try a direct Windows command
      try {
        console.log('Attempting direct Windows message using msg command...');
        const msgCmd = `msg * "SantaFeFocus registry update: ${cleanedRef}"`;
        await execAsync(msgCmd, { timeout: 5000 });
        console.log('Direct message command executed');
      } catch (msgError) {
        console.warn('Direct message command also failed:', msgError.message);
      }
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
  console.log('=== Scripture Map Labeler Starting ===');
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
