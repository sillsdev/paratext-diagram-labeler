export const MAP_VIEW = 0;
export const TABLE_VIEW = 1;
export const USFM_VIEW = 2;

// Status codes (priority order: highest severity first)
export const STATUS_BLANK = 0;              // Blank - needs content
export const STATUS_PARTIAL = 1;            // Partial - literal text needs translation
export const STATUS_MULTIPLE = 2;           // Multiple Options - needs user selection
export const STATUS_NO_RENDERINGS = 3;      // No renderings - project missing data
export const STATUS_UNMATCHED = 4;          // Unmatched label - doesn't match renderings
export const STATUS_MULTIPLE_RENDERINGS = 5; // Multiple renderings - needs pattern confirmation
export const STATUS_GUESSED = 6;            // Guessed - needs approval
export const STATUS_INCOMPLETE = 7;         // Incomplete - missing in some verses
export const STATUS_OK = 8;                 // OK - all good

// export const MATCH_PRE_B = '\\b';
// export const MATCH_POST_B = '\\b';
// export const MATCH_W = '\\w';

export const MATCH_PRE_B = '(?<=[^\\p{L}|\\p{M}|\\p{Cf}-]|^)'; //TODO: handle cases where \b is ^
export const MATCH_POST_B = '(?=$|[^\\p{L}|\\p{M}|\\p{Cf}-])'; // TOOD: handle cases where \b is $
export const MATCH_W = '[\\p{L}|\\p{M}|\\p{Cf}-]';

// export const INITIAL_USFM = String.raw`\fig |src="smr_185wbt - Philips Travels [sm] (fcr) @en.jpg" size="span" loc="paw" copy="WBT" ref="8:5-40"\fig*`;

export const BOOK_NAMES = 'GEN,EXO,LEV,NUM,DEU,JOS,JDG,RUT,1SA,2SA,1KI,2KI,1CH,2CH,EZR,NEH,EST,JOB,PSA,PRO,ECC,SNG,ISA,JER,LAM,EZK,DAN,HOS,JOL,AMO,OBA,JON,MIC,NAM,HAB,ZEP,HAG,ZEC,MAL,MAT,MRK,LUK,JHN,ACT,ROM,1CO,2CO,GAL,EPH,PHP,COL,1TH,2TH,1TI,2TI,TIT,PHM,HEB,JAS,1PE,2PE,1JN,2JN,3JN,JUD,REV,TOB,JDT,ESG,WIS,SIR,BAR,LJE,S3Y,SUS,BEL,1MA,2MA,3MA,4MA,1ES,2ES,MAN,PS2,ODA,PSS';

