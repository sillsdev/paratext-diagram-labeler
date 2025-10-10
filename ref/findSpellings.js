#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const xml2js = require('xml2js');

// Configuration
const PROJECTS_FOLDER = "C:\\My Paratext 9 Projects\\";
const PROJECTS = [ ["zMaps", "N"], 
                    ["zN84", "n"],
                    ["zE16", "E"],
                    ["zG92", "G"],
                    ["zR52", "R"],
                    ["zT08", "T"],
                    ["zK54", "K"]                    
];
const XML_INPUT_FILE = path.join(__dirname, 'BiblicalTerms-eng.xml');
const JSON_OUTPUT_FILE = path.join(__dirname, 'BiblicalTermsWithSpellings.json');

// Current project being processed
let currentProjectFolder = '';

// Settings for the project (similar to electron-main.js)
let settings = {
  language: 'zMaps',
  pre: '',
  post: 'zMaps.SFM',
  use41: true,
  useMAT: true,
  versification: '4',
  name: 'zMaps',
};

// Load project settings from Settings.xml
async function loadSettings(projectFolder) {
  const settingsPath = path.join(projectFolder, 'Settings.xml');
  
  try {
    const rawContents = await fs.promises.readFile(settingsPath, 'utf8');
    // Extract the Naming attributes
    const match = rawContents.match(/<Naming PrePart="(.*)" PostPart="(.*)" BookNameForm="(.*)"/);
    if (match) {
      settings.pre = match[1];
      settings.post = match[2];
      settings.useMAT = match[3].includes('MAT');
      settings.use41 = match[3].includes('41');
    }
    // Extract other settings
    const versificationMatch = rawContents.match(/<Versification>(\d+)<\/Versification>/);
    if (versificationMatch) {
      settings.versification = versificationMatch[1];
    }
    const languageMatch = rawContents.match(/<Language>(.*?)<\/Language>/);
    if (languageMatch) {
      settings.language = languageMatch[1];
    }
    const nameMatch = rawContents.match(/<Name>(.*?)<\/Name>/);
    if (nameMatch) {
      settings.name = nameMatch[1];
    }
    console.log('Loaded settings:', settings);
  } catch (error) {
    console.log('Using default settings - could not load Settings.xml:', error.message);
  }
}

// Convert BCV9 format to book, chapter, verse
function BCV(ref) {
  const bookNum = parseInt(ref.slice(0, 3), 10) - 1;
  const chapter = parseInt(ref.slice(3, 6), 10);
  const verse = parseInt(ref.slice(6, 9), 10);
  return [bookNum, chapter, verse];
}

// Get book filename based on book number
function bookName(bookNum) {
  const bookSchemes =
    '01GEN,02EXO,03LEV,04NUM,05DEU,06JOS,07JDG,08RUT,091SA,102SA,111KI,122KI,131CH,142CH,15EZR,16NEH,17EST,18JOB,19PSA,20PRO,21ECC,22SNG,23ISA,24JER,25LAM,26EZK,27DAN,28HOS,29JOL,30AMO,31OBA,32JON,33MIC,34NAM,35HAB,36ZEP,37HAG,38ZEC,39MAL,41MAT,42MRK,43LUK,44JHN,45ACT,46ROM,471CO,482CO,49GAL,50EPH,51PHP,52COL,531TH,542TH,551TI,562TI,57TIT,58PHM,59HEB,60JAS,611PE,622PE,631JN,642JN,653JN,66JUD,67REV,68TOB,69JDT,70ESG,71WIS,72SIR,73BAR,74LJE,75S3Y,76SUS,77BEL,781MA,792MA,803MA,814MA,821ES,832ES,84MAN,85PS2,86ODA,87PSS,A4EZA,A55EZ,A66EZ,B2DAG,B3PS3,B42BA,B5LBA,B6JUB,B7ENO,B81MQ,B92MQ,C03MQ,C1REP,C24BA,C3LAO,A0FRT,A1BAK,A2OTH,A7INT,A8CNC,A9GLO,B0TDX,B1NDX,94XXA,95XXB,96XXC,97XXD,98XXE,99XXF';
  let start = (bookNum * 6) + (settings.use41 ? 0 : 2);
  let length = (settings.useMAT ? 3 : 0) + (settings.use41 ? 2 : 0);
  const bookScheme = bookSchemes.slice(start, start + length);
  return path.join(currentProjectFolder, settings.pre + bookScheme + settings.post);
}

// Extract verse text from USFM chapter content
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
  const verseRegex = /\\v (\d+(?:\u200f?-\d+)?)(.*?)(?=(?:\\v \d+(?:\u200f?-\d+)?|$))/gs;
  let match;

  while ((match = verseRegex.exec(usfmChapterText)) !== null) {
    const verseRange = match[1];
    const verseContent = match[2].trim();

    if (verseRange.includes('-')) {
      // Handle bridged verses (e.g., "11-14")
      const [start, end] = verseRange.split(/\u200f?-/).map(Number);
      if (verseNum >= start && verseNum <= end) {
        return verseContent;
      }
    } else {
      // Handle single verse
      if (parseInt(verseRange) === verseNum) {
        return verseContent;
      }
    }
  }
  return '';
}

// Clean USFM text to remove markers
function cleanUsfmText(usfmText) {
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

// Parse multiple alternatives from gloss (separated by comma, semicolon, slash, or "or")
function parseGlossAlternatives(gloss) {
  if (!gloss) return [];
  
  // Split by comma, semicolon, forward slash, or " or " (with spaces), then clean up
  return gloss.split(/[,;\/]|\s+or\s+/i)
    .map(alt => alt.trim())
    .filter(alt => alt.length > 0);
}

// Calculate Levenshtein distance for fuzzy matching
function levenshteinDistance(str1, str2) {
  const matrix = Array(str2.length + 1).fill().map(() => Array(str1.length + 1).fill(0));
  
  for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
  for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;
  
  for (let j = 1; j <= str2.length; j++) {
    for (let i = 1; i <= str1.length; i++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j - 1][i] + 1,     // deletion
        matrix[j][i - 1] + 1,     // insertion
        matrix[j - 1][i - 1] + cost // substitution
      );
    }
  }
  
  return matrix[str2.length][str1.length];
}

// Calculate similarity score (0-1, where 1 is identical)
function calculateSimilarity(str1, str2) {
  if (!str1 || !str2) return 0;
  
  const maxLen = Math.max(str1.length, str2.length);
  if (maxLen === 0) return 1;
  
  const distance = levenshteinDistance(str1.toLowerCase(), str2.toLowerCase());
  return 1 - (distance / maxLen);
}

// Check if a word contains the root of the gloss (e.g., "Ammonites" contains "Ammon")
function containsRoot(word, gloss) {
  const wordLower = word.toLowerCase();
  const glossLower = gloss.toLowerCase();
  
  // Direct substring match
  if (wordLower.includes(glossLower)) return true;
  
  // Check if gloss is a root of the word (remove common suffixes)
  const suffixes = ['ites', 'ite', 'ans', 'an', 'ese', 'ish', 's'];
  for (const suffix of suffixes) {
    if (wordLower.endsWith(suffix)) {
      const root = wordLower.slice(0, -suffix.length);
      if (root === glossLower || root.includes(glossLower)) return true;
    }
  }
  
  return false;
}

// Find the best matching word/phrase in a verse for a given gloss
function findBestMatch(verseText, gloss) {
  if (!verseText || !gloss) return null;
  
  const words = verseText.split(/\s+/);
  const candidates = [];
  
  // Check individual words
  for (const word of words) {
    const cleanWord = word.replace(/[^\w\s'-]/g, ''); // Remove punctuation except apostrophes and hyphens
    if (cleanWord.length < 2) continue;
    
    const similarity = calculateSimilarity(cleanWord, gloss);
    const hasRoot = containsRoot(cleanWord, gloss);
    
    // Only consider if similarity is decent or if it contains the root
    if (similarity > 0.4 || hasRoot) {
      candidates.push({
        text: cleanWord,
        similarity,
        hasRoot,
        score: hasRoot ? similarity + 0.3 : similarity // Boost score if contains root
      });
    }
  }
  
  // Check 2-word phrases
  for (let i = 0; i < words.length - 1; i++) {
    const phrase = words.slice(i, i + 2).join(' ').replace(/[^\w\s'-]/g, '');
    if (phrase.length < 3) continue;
    
    const similarity = calculateSimilarity(phrase, gloss);
    const hasRoot = containsRoot(phrase, gloss);
    
    if (similarity > 0.3 || hasRoot) {
      candidates.push({
        text: phrase,
        similarity,
        hasRoot,
        score: hasRoot ? similarity + 0.3 : similarity
      });
    }
  }
  
  // Check 3-word phrases
  for (let i = 0; i < words.length - 2; i++) {
    const phrase = words.slice(i, i + 3).join(' ').replace(/[^\w\s'-]/g, '');
    if (phrase.length < 4) continue;
    
    const similarity = calculateSimilarity(phrase, gloss);
    const hasRoot = containsRoot(phrase, gloss);
    
    if (similarity > 0.25 || hasRoot) {
      candidates.push({
        text: phrase,
        similarity,
        hasRoot,
        score: hasRoot ? similarity + 0.3 : similarity
      });
    }
  }
  
  // Filter out very common words that might have high frequency but low relevance
  const commonWords = ['the', 'and', 'of', 'to', 'in', 'that', 'he', 'she', 'it', 'they', 'them', 'his', 'her', 'its', 'their', 'was', 'were', 'is', 'are', 'be', 'been', 'have', 'has', 'had', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'do', 'did', 'does', 'go', 'went', 'come', 'came', 'get', 'got', 'see', 'saw', 'know', 'knew', 'think', 'thought', 'say', 'said', 'tell', 'told', 'give', 'gave', 'take', 'took', 'make', 'made', 'find', 'found', 'look', 'looked', 'use', 'used', 'work', 'worked', 'call', 'called', 'try', 'tried', 'ask', 'asked', 'need', 'needed', 'feel', 'felt', 'become', 'became', 'leave', 'left', 'put', 'move', 'moved', 'like', 'want', 'wanted', 'show', 'showed', 'hear', 'heard', 'play', 'played', 'run', 'ran', 'turn', 'turned', 'bring', 'brought', 'build', 'built', 'stay', 'stayed', 'fall', 'fell', 'cut', 'send', 'sent', 'open', 'opened', 'close', 'closed', 'read', 'walk', 'walked', 'talk', 'talked', 'sit', 'sat', 'stand', 'stood', 'lose', 'lost', 'pay', 'paid', 'meet', 'met', 'include', 'included', 'continue', 'continued', 'set', 'lead', 'led', 'understand', 'understood', 'watch', 'watched', 'follow', 'followed', 'stop', 'stopped', 'create', 'created', 'speak', 'spoke', 'spend', 'spent', 'grow', 'grew', 'allow', 'allowed', 'win', 'won', 'offer', 'offered', 'remember', 'remembered', 'love', 'loved', 'consider', 'considered', 'appear', 'appeared', 'buy', 'bought', 'wait', 'waited', 'serve', 'served', 'die', 'died', 'kill', 'killed', 'remain', 'remained', 'suggest', 'suggested', 'raise', 'raised', 'pass', 'passed', 'sell', 'sold', 'require', 'required', 'report', 'reported', 'decide', 'decided', 'pull', 'pulled', 'break', 'broke', 'reach', 'reached', 'thank', 'thanked', 'catch', 'caught', 'pick', 'picked', 'happen', 'happened', 'carry', 'carried', 'write', 'wrote', 'let', 'keep', 'kept', 'hold', 'held', 'wear', 'wore', 'hit', 'cut', 'shoot', 'shot', 'fill', 'filled', 'join', 'joined', 'seek', 'sought', 'teach', 'taught', 'sit', 'eat', 'ate', 'drink', 'drank', 'help', 'helped', 'live', 'lived', 'believe', 'believed', 'hope', 'hoped', 'change', 'changed', 'place', 'placed', 'form', 'formed', 'provide', 'provided', 'produce', 'produced', 'cover', 'covered', 'receive', 'received', 'return', 'returned', 'develop', 'developed', 'carry', 'carried', 'result', 'resulted', 'manage', 'managed', 'study', 'studied', 'increase', 'increased', 'add', 'added', 'expect', 'expected', 'learn', 'learned', 'control', 'controlled', 'face', 'faced', 'plan', 'planned', 'apply', 'applied', 'experience', 'experienced', 'support', 'supported', 'identify', 'identified', 'occur', 'occurred', 'involve', 'involved', 'argue', 'argued', 'maintain', 'maintained', 'indicate', 'indicated', 'achieve', 'achieved', 'determine', 'determined', 'accept', 'accepted', 'contain', 'contained', 'obtain', 'obtained', 'concern', 'concerned', 'relate', 'related', 'attempt', 'attempted', 'avoid', 'avoided', 'perform', 'performed', 'establish', 'established', 'represent', 'represented', 'agree', 'agreed', 'reduce', 'reduced', 'enjoy', 'enjoyed', 'discuss', 'discussed', 'protect', 'protected', 'remove', 'removed', 'describe', 'described', 'encourage', 'encouraged', 'explain', 'explained', 'survive', 'survived', 'discover', 'discovered', 'prepare', 'prepared', 'exist', 'existed', 'introduce', 'introduced', 'enter', 'entered', 'arrive', 'arrived', 'save', 'saved', 'treat', 'treated', 'choose', 'chose', 'compare', 'compared', 'suffer', 'suffered', 'improve', 'improved', 'train', 'trained', 'mention', 'mentioned', 'cost', 'cost', 'check', 'checked', 'cause', 'caused', 'reveal', 'revealed', 'deal', 'dealt', 'examine', 'examined', 'attack', 'attacked', 'recognize', 'recognized', 'visit', 'visited', 'handle', 'handled', 'prevent', 'prevented', 'respond', 'responded', 'realize', 'realized', 'design', 'designed', 'seek', 'sought', 'claim', 'claimed', 'base', 'based', 'demand', 'demanded', 'focus', 'focused', 'throw', 'threw', 'present', 'presented', 'express', 'expressed', 'review', 'reviewed', 'worry', 'worried', 'progress', 'progressed', 'operate', 'operated', 'replace', 'replaced', 'wonder', 'wondered', 'organize', 'organized', 'publish', 'published', 'regard', 'regarded', 'warn', 'warned', 'tend', 'tended', 'influence', 'influenced', 'confirm', 'confirmed', 'mark', 'marked', 'enter', 'entered', 'ignore', 'ignored', 'admit', 'admitted', 'pretend', 'pretended', 'connect', 'connected', 'refer', 'referred', 'balance', 'balanced', 'intend', 'intended', 'relax', 'relaxed', 'count', 'counted', 'promote', 'promoted', 'imagine', 'imagined', 'celebrate', 'celebrated', 'search', 'searched', 'bother', 'bothered', 'recommend', 'recommended', 'exercise', 'exercised', 'belong', 'belonged', 'notice', 'noticed', 'struggle', 'struggled', 'escape', 'escaped', 'commit', 'committed', 'deliver', 'delivered', 'affect', 'affected', 'challenge', 'challenged', 'acquire', 'acquired', 'launch', 'launched', 'complete', 'completed', 'import', 'imported', 'estimate', 'estimated', 'attract', 'attracted', 'arrange', 'arranged', 'force', 'forced', 'reflect', 'reflected', 'demand', 'demanded', 'link', 'linked', 'gather', 'gathered', 'fix', 'fixed', 'assist', 'assisted', 'communicate', 'communicated', 'proceed', 'proceeded', 'handle', 'handled', 'adapt', 'adapted', 'explore', 'explored', 'defend', 'defended', 'extend', 'extended', 'invest', 'invested', 'share', 'shared', 'settle', 'settled', 'gain', 'gained', 'secure', 'secured', 'assume', 'assumed', 'ensure', 'ensured', 'exchange', 'exchanged', 'advance', 'advanced', 'transfer', 'transferred', 'permit', 'permitted', 'ignore', 'ignored', 'recover', 'recovered', 'predict', 'predicted', 'engage', 'engaged', 'monitor', 'monitored', 'benefit', 'benefited', 'combine', 'combined', 'divide', 'divided', 'earn', 'earned', 'track', 'tracked', 'attempt', 'attempted', 'generate', 'generated', 'preserve', 'preserved', 'stress', 'stressed', 'feature', 'featured', 'surprise', 'surprised', 'conclude', 'concluded', 'distribute', 'distributed', 'locate', 'located', 'expand', 'expanded', 'address', 'addressed', 'contact', 'contacted', 'respond', 'responded', 'adopt', 'adopted', 'install', 'installed', 'record', 'recorded', 'release', 'released', 'access', 'accessed', 'assess', 'assessed', 'encourage', 'encouraged', 'promote', 'promoted', 'construct', 'constructed', 'participate', 'participated', 'enable', 'enabled', 'conduct', 'conducted', 'inform', 'informed', 'transform', 'transformed', 'illustrate', 'illustrated', 'demonstrate', 'demonstrated', 'celebrate', 'celebrated'];
  
  const filteredCandidates = candidates.filter(candidate => {
    const lowerText = candidate.text.toLowerCase();
    return !commonWords.includes(lowerText) || candidate.hasRoot;
  });
  
  if (filteredCandidates.length === 0) return null;
  
  // Sort by score (similarity + root bonus)
  filteredCandidates.sort((a, b) => b.score - a.score);
  
  return filteredCandidates[0];
}

// Get verses for a list of references
async function getFilteredVerses(references) {
  const requestedVerses = {};
  const chapterVersePerBook = {};
  
  // Group references by book
  references.forEach(ref => {
    const [bookNum, chapter, verse] = BCV(ref);
    const bName = bookName(bookNum);
    if (!chapterVersePerBook[bName]) {
      chapterVersePerBook[bName] = [];
    }
    chapterVersePerBook[bName].push([chapter, verse, ref]);
  });
  
  // Process each book
  for (const [bName, refArray] of Object.entries(chapterVersePerBook)) {
    if (fs.existsSync(bName)) {
      try {
        const usfmText = fs.readFileSync(bName, 'utf8');
        const chapters = {};
        
        // Split into chapters
        usfmText
          .split(/(\\c \d+)/)
          .slice(1)
          .forEach((content, i, arr) => {
            if (i % 2 === 0) {
              const chapterNum = parseInt(content.match(/\d+/)[0]);
              chapters[chapterNum] = arr[i + 1] || '';
            }
          });
        
        // Extract verses
        for (const [chapter, verse, ref] of refArray) {
          if (chapters[chapter]) {
            const verseText = getVerseText(chapters[chapter], verse);
            if (verseText) {
              const cleanedText = cleanUsfmText(verseText);
              requestedVerses[ref] = cleanedText;
            }
          }
        }
      } catch (error) {
        console.warn(`Error reading book file ${bName}:`, error.message);
      }
    } else {
      console.warn(`Book file not found: ${bName}`);
    }
  }
  
  return requestedVerses;
}

// Process a single term to find its spelling
async function processTermSpelling(term, projectCode, logErrors = true) {
  const termId = term.$.Id;
  const gloss = term.Gloss;
  const category = term.Category;
  const domain = term.Domain;
  
  // Determine if we should log errors for this term
  const shouldLogErrors = logErrors && category === 'PN' && domain !== 'person';
  
  if (!term.References || !term.References.Verse) {
    if (shouldLogErrors) {
      console.warn(`Term ${termId} has no references`);
    }
    return {
      [`spell-${projectCode}`]: '',
      [`pc-${projectCode}`]: 0
    };
  }
  
  // Get references (handle both single verse and array of verses)
  const verses = Array.isArray(term.References.Verse) ? term.References.Verse : [term.References.Verse];
  
  // Convert to BCV9 format (take only first 9 digits)
  const references = verses.map(verse => verse.toString().substring(0, 9));
  
  try {
    // Get verse texts
    const verseTexts = await getFilteredVerses(references);
    
    if (Object.keys(verseTexts).length === 0) {
      if (shouldLogErrors) {
        console.warn(`No verse texts found for term ${termId} (${gloss})`);
      }
      return {
        [`spell-${projectCode}`]: '',
        [`pc-${projectCode}`]: 0
      };
    }
    
    // Parse gloss alternatives (e.g., "Babel, Babylon, Babylonia")
    const glossAlternatives = parseGlossAlternatives(gloss);
    
    // If no alternatives found, use the original gloss
    if (glossAlternatives.length === 0) {
      glossAlternatives.push(gloss);
    }
    
    // Find matches for each gloss alternative
    const allSpellings = {};
    let totalVerses = 0;
    
    for (const [ref, verseText] of Object.entries(verseTexts)) {
      totalVerses++;
      
      // Try each gloss alternative and find the best match for this verse
      let bestMatch = null;
      let bestScore = 0;
      
      for (const alternative of glossAlternatives) {
        const match = findBestMatch(verseText, alternative);
        if (match && match.score > bestScore && match.score > 0.4) {
          bestMatch = match;
          bestScore = match.score;
        }
      }
      
      // Record the best match found for this verse
      if (bestMatch) {
        const spelling = bestMatch.text;
        if (!allSpellings[spelling]) {
          allSpellings[spelling] = { count: 0, totalScore: 0 };
        }
        allSpellings[spelling].count++;
        allSpellings[spelling].totalScore += bestMatch.score;
      }
    }
    
    if (Object.keys(allSpellings).length === 0) {
      if (shouldLogErrors) {
        console.warn(`No suitable spellings found for term ${termId} (${gloss}) in ${totalVerses} verses`);
      }
      return {
        [`spell-${projectCode}`]: '',
        [`pc-${projectCode}`]: 0
      };
    }
    
    // Find the best spelling (highest frequency * average score)
    let bestSpelling = '';
    let bestScore = 0;
    
    for (const [spelling, data] of Object.entries(allSpellings)) {
      const avgScore = data.totalScore / data.count;
      const combinedScore = data.count * avgScore;
      
      if (combinedScore > bestScore) {
        bestScore = combinedScore;
        bestSpelling = spelling;
      }
    }
    
    const foundTally = allSpellings[bestSpelling].count;
    const foundPercent = Math.round((foundTally / totalVerses) * 100);
    
    console.log(`Term ${termId} (${gloss}) [${projectCode}]: Found "${bestSpelling}" in ${foundTally}/${totalVerses} verses (${foundPercent}%)`);
    
    return {
      [`spell-${projectCode}`]: bestSpelling,
      [`pc-${projectCode}`]: foundPercent
    };
    
  } catch (error) {
    if (shouldLogErrors) {
      console.error(`Error processing term ${termId} (${gloss}) [${projectCode}]:`, error.message);
    }
    return {
      [`spell-${projectCode}`]: '',
      [`pc-${projectCode}`]: 0
    };
  }
}

// Main function
async function main() {
  console.log('Finding spellings for Biblical terms across multiple projects...');
  console.log(`Projects folder: ${PROJECTS_FOLDER}`);
  console.log(`Input XML: ${XML_INPUT_FILE}`);
  console.log(`Output JSON: ${JSON_OUTPUT_FILE}`);
  
  try {
    // Read and parse XML file
    console.log('Reading BiblicalTerms.xml...');
    const xmlContent = await fs.promises.readFile(XML_INPUT_FILE, 'utf8');
    
    console.log('Parsing XML...');
    const parser = new xml2js.Parser({ explicitArray: false });
    const result = await parser.parseStringPromise(xmlContent);
    
    if (!result.BiblicalTermsList || !result.BiblicalTermsList.Term) {
      throw new Error('Invalid XML structure - expected BiblicalTermsList.Term');
    }
    
    const terms = Array.isArray(result.BiblicalTermsList.Term) ? result.BiblicalTermsList.Term : [result.BiblicalTermsList.Term];
    console.log(`Found ${terms.length} terms to process`);
    
    // Initialize processedTerms with basic structure
    const processedTerms = terms.map(term => ({
      Id: term.$.Id,
      Strong: term.Strong,
      Transliteration: term.Transliteration,
      Gloss: term.Gloss,
      Definition: term.Definition,
      Category: term.Category,
      Domain: term.Domain,
      References: term.References && term.References.Verse 
        ? (Array.isArray(term.References.Verse) ? term.References.Verse : [term.References.Verse])
          .map(ref => ref.toString().substring(0, 9))
        : []
    }));
    
    // Process each project
    for (const [projectName, projectCode] of PROJECTS) {
      currentProjectFolder = path.join(PROJECTS_FOLDER, projectName);
      console.log(`\nProcessing project: ${projectName} (${projectCode})`);
      console.log(`Project folder: ${currentProjectFolder}`);
      
      // Load project settings
      await loadSettings(currentProjectFolder);
      
      // Process each term for this project
      let processed = 0;
      for (let i = 0; i < terms.length; i++) {
        processed++;
        if (processed % 50 === 0) {
          console.log(`  Processed ${processed}/${terms.length} terms for ${projectName}...`);
        }
        
        const term = terms[i];
        const spellingInfo = await processTermSpelling(term, projectCode);
        
        // Add project-specific properties to the corresponding processed term
        Object.assign(processedTerms[i], spellingInfo);
      }
      
      console.log(`Completed project ${projectName}: ${processed} terms processed`);
    }
    
    // Write JSON output
    console.log(`\nWriting output to ${JSON_OUTPUT_FILE}...`);
    await fs.promises.writeFile(JSON_OUTPUT_FILE, JSON.stringify(processedTerms, null, 2), 'utf8');
    
    console.log('Processing complete!');
    console.log(`Processed ${processedTerms.length} terms across ${PROJECTS.length} projects`);
    
    // Summary statistics
    for (const [projectName, projectCode] of PROJECTS) {
      const spellProp = `spell-${projectCode}`;
      const pcProp = `pc-${projectCode}`;
      
      const withSpellings = processedTerms.filter(t => t[spellProp] && t[spellProp].length > 0);
      const highConfidence = processedTerms.filter(t => t[pcProp] >= 50);
      
      console.log(`${projectName} (${projectCode}): ${withSpellings.length}/${processedTerms.length} with spellings (${Math.round(withSpellings.length/processedTerms.length*100)}%), ${highConfidence.length} high confidence (≥50%)`);
    }
    
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = {
  processTermSpelling,
  findBestMatch,
  calculateSimilarity,
  loadSettings,
  getFilteredVerses
};