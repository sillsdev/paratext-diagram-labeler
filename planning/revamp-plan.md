# Plan for a major restructure of the architecture that links merges keys to Biblical terms and Scripture references.

## Current architecture
- The purpose of this Paratext Diagram Labeler (PDL) app is to enable a Paratext user to create maps/diagrams using labels extracted from a Paratext project. (A Paratext project is a translation of the Bible into a specified language. The project contains the vernacular text and closely associated data (stored in USFM format in .SFM files) and various kinds of settings and metadata, typically stored in XML files in the project folder. For example, the project's TermRenderings.xml file specifies the vernacular rendering patterns for major Paratext terms.)
- Maps/diagrams are provided by various organizations as collections of data-mergeable documents in IDML (InDesign) or MAPX (Map Creator) format.
- In order for this PDL app to prepare labels for the maps in that collection, all data for that collection is stored in a folder under the "_LabelerTemplates" folder. This folder can be found in the root of the current workspace. For example, data for the collection called the "SIL Map Repository" is stored in the SMR subfolder of _LabelerTemplates.
- Data shared in common by all collections is placed directly in the _LablerTemplates folder. At present this is the core-termlist.json file.
- Each collection subfolder contains certain settings files: 
    - collection.json (details about the collection)
    - language.json (specifying GUI languages supported by the collection)
    - map-defs.json (containing definitions of each map in the collection, including which IDML merge key is associated with each label on the map)
    - mergekeys.json (mapping from IDML merge keys primarily to Paratext terms)
    - termlist.json (providing details on each Paratext term, such as a transliteration, gloss, and context/description, along with a list of references of Bible verses where that Paratext term is expected to occur. These properties of a Paratext term are mapped to by the Paratext "termId", which is generally a Hebrew or Greek term from the source texts, sometimes suffixed with a sense number or other disambiguator. For example, the termId "Βηθανία-2" refers to the Bethany on the Mount of Olives. )
- The collection subfolder also contains a folder named "@en" that contains sample image files with English labels. Within that folder is a folder named "preview", containing optional composite images for certain maps for which the documents provide multiple base imagery options.
- Optionally, in parallel to the "@en" folder there may be other-language versions, such as "@es" for Spanish maps. The "@en" folder serves as the fallback for all other languages.
 
### map-defs.json (Collection-level file)
- Each collection's map-defs.json file contains definitions for multiple maps. For example, here's the definition for the map template in the SMR collection named `SMR_065wbt - Ruth`:
	  "SMR_065wbt - Ruth": {
		"mapTypes": "mcr bwr",
		"formats": "idml",
		"width": 1000,
		"height": 810,
		"owner": "SIL Global",
		"ownerRules": "https://tiny.cc/wbt-rules",
		"imgFilename": "smr_065wbt - Ruth.jpg",
		"mapGroup": "",
		"refs": "RUT01, RUT02, RUT03",
		"title": {
		  "en": "Ruth's journey",
		  "es": "El viaje de Ruth"
		},
		"keywords": {
		  "en": "",
		  "es": ""
		},
		"variants": {},
		"labels": [
		  {
			"mergeKey": "title_ruth",
			"x": 223,
			"y": 722,
			"align": "center",
			"angle": 0,
			"variant": 0,
			"size": 1,
			"type": 1
		  },
		  {
			"mergeKey": "mt_gilboa",
			"x": 480,
			"y": 32,
			"align": "right",
			"angle": 0,
			"variant": 0,
			"size": 3,
			"type": 0
		  },
		  {
			"mergeKey": "jordan_river_ot",
			"x": 514,
			"y": 130,
			"align": "center",
			"angle": 84,
			"variant": 0,
			"size": 3,
			"type": 0
		  },
		  {
			"mergeKey": "israel",
			"x": 418,
			"y": 233,
			"align": "center",
			"angle": 0,
			"variant": 0,
			"size": 2,
			"type": 0
		  },
		  {
			"mergeKey": "mediterranean_sea",
			"x": 158,
			"y": 242,
			"align": "center",
			"angle": 60,
			"variant": 0,
			"size": 2,
			"type": 0
		  },
		  {
			"mergeKey": "ammon",
			"x": 787,
			"y": 263,
			"align": "center",
			"angle": 0,
			"variant": 0,
			"size": 3,
			"type": 0
		  },
		  {
			"mergeKey": "jerusalem_ot",
			"x": 420,
			"y": 300,
			"align": "right",
			"angle": 0,
			"variant": 0,
			"size": 3,
			"type": 0
		  },
		  {
			"mergeKey": "bethlehem_ot",
			"x": 405,
			"y": 334,
			"align": "right",
			"angle": 0,
			"variant": 0,
			"size": 3,
			"type": 0
		  },
		  {
			"mergeKey": "philistia",
			"x": 217,
			"y": 343,
			"align": "center",
			"angle": 62,
			"variant": 0,
			"size": 2,
			"type": 0
		  },
		  {
			"mergeKey": "dead_sea",
			"x": 511,
			"y": 401,
			"align": "center",
			"angle": 78,
			"variant": 0,
			"size": 3,
			"type": 0
		  },
		  {
			"mergeKey": "judah",
			"x": 321,
			"y": 445,
			"align": "center",
			"angle": 0,
			"variant": 0,
			"size": 3,
			"type": 0
		  },
		  {
			"mergeKey": "moab",
			"x": 668,
			"y": 547,
			"align": "center",
			"angle": 0,
			"variant": 0,
			"size": 2,
			"type": 0
		  },
		  {
			"mergeKey": "edom",
			"x": 510,
			"y": 711,
			"align": "center",
			"angle": 0,
			"variant": 0,
			"size": 3,
			"type": 0
		  },
		  {
			"mergeKey": "route_ruth",
			"x": 271,
			"y": 751,
			"align": "center",
			"angle": 0,
			"variant": 0,
			"size": 3,
			"type": 0
		  }
		]
	  },
- The map definition includes a mergeKey for each label on the map. (The mergeKey is the data merge field name used by the IDML document.)
- While the app does not currently use the "type" property of a label, a value of 1 indicates that this label is the title. (At most one label on a map can have this value.) A value of 2 indicates a sub-title. A value of 3 indicates a scripture reference for the map. (At most one label on a map can have this value.) A future feature for suppressing the title and using it instead as a caption will make use of the "type" property.

### TermRenderings.xml (Project-level file)
- When a new map is opened in the app, we try to pre-populate the vernacular text for each label from the current Paratext project's TermRenderings.xml data. 
- The project's TermRenderings.xml file maps specific Paratext termId values to rendering patterns that indicate how the term should appear throughout the project's verse text. For example, for the termId "Βηθανία-2" (Bethany on the Mount of Olives), a project may have a rendering pattern of "Betaniya*" (including a wildcard character at the end), meaning that it matches "Betaniya" with any optional suffix.
- Term rendering patterns may have a status of guessed (if software came up with the value) or approved (if the user came up with it, or approved the guessed rendering).
- In general, the vernacular text for pre-filling the label is determined by stripping any wildcards from the rendering pattern.

### termlist.json  (Collection-level file) and core-termlist.json (App-level fallback file)
- The termlist.json file (and core-termlist.json as a fallback file) provides data for Paratext termId values like this (displayed here with shortened refs lists):
	  "Βηθλέεμ": {
		"transliteration": "Bēthleem",
		"gloss": {
		  "en": "Bethlehem",
		  "es": "Belén",
		  "fr": "Bethléem"
		},
		"context": {
		  "en": "a town south of Jerusalem",
		  "es": "Pueblo de la región de Judea, al sur de Jerusalén.",
		  "fr": "une ville au sud de Jérusalem"
		},
		"refs": [
				"040002001",
				"042002001",
				"043007042"
		]
	  },
	  "בֵּית לֶחֶם": {
		"transliteration": "bêt leḥem",
		"gloss": {
		  "en": "Bethlehem",
		  "es": "Belén",
		  "fr": "Bethléem"
		},
		"context": {
		  "en": "town; territory of Judah",
		  "es": "Lugar en el territorio de Judá.",
		  "fr": "ville; territoire de Juda"
		},
		"refs": [
				"001035019",
				"009016001",
				"033005002",
		]
	  }, 
- The refs identify the verses in which the term is expected to appear. The are in BCV9 format, using 3 digits for each of Book, Chapter, and Verse numbers.

### mergekeys.json (Collection-level file)
- Every mergeKey has one associated termId. No other mergeKey has the same termId. 
- Some map labels are for locations not named in the Scripture verse text, such as Mediterranean Sea. In this case, we make up a Latin-script term ID like "mediterranean_sea", typically but not necessarily the same value as the merge key. This currently gets stored in the TermRenderings.xml file as if it was like any other termId.
- Sometimes the rendering pattern(s) for a termId do not make it possible to determine what the vernacular label should be, either because there is more than one pattern, or because the map form requires more than the pattern can provide. (e.g. For the Jordan River, the rendering pattern may be just `Jordán*`, but for a map label we need `río Jordán`.) In such cases, we add a special comment (in parentheses, beginning with `@`) to the rendering pattern to explicitly specify the map form. Thus the rendering pattern and comment look like this:
      `Jordán* (@río Jordán)`
- A map collection's mergekeys.json file maps merge keys to Paratext termId values like this:
		  "bethlehem_nt": {
			"termId": "Βηθλέεμ",
			"mapxKey": "Bethlehem",
			"altTermIds": "בֵּית לֶחֶם, Βηθλέεμ-2"
		  },
		  "bethlehem_ot": {
			"termId": "בֵּית לֶחֶם",
			"mapxKey": "Bethlehem",
			"altTermIds": "Βηθλέεμ, Βηθλέεμ-2"
		  },
    - `mapxKey` is the equivalent of mergeKey for Map Creator data merge files (*.mapx.txt), though there may be more than one  mergeKey that has the same mapxKey, as in the Bethlehem example above.
    - "altTermIds" specifies additional related termId values that can serve as fallback source to find values to pre-populate with. For example, the Old Testament (OT) termId for Bethlehem (a Hebrew term) lists the corresponding New Testament (NT) term.
- The bottom pane of the app displays the verses referenced by "refs". This enables the user to verify that the term has been spelled consistently in each of the verses in which is is expected to appear. If a verse is missing a rendering of the term, it's marked with a red X. The user can either click the Edit button to edit the verse text in Paratext, or the Deny button to deny that the missing rendering is a problem. (e.g. The current translation project may have needed to use a pronoun in its place in that verse.) Denials are stored as BCV8 references for the termId in the TermRenderings.xml file. (BCV8 format uses just 2 digits for the book number).
    
## Problems:
- Different map collections may want to associate different labels with the same Paratext key term. One collection may need a label for "Way of Shur" while another needs a label for "Shur", and both want to associate their label with the corresponding Hebrew term; The location of Ziklag is uncertain, so the Biblica map collection indicates uncertain collection by using a different map symbol, while the SMR map collection puts a question mark after the place-name. This means that the Biblica map collection wants to store `Ziklag` on the termId, while the SMR collection wants to store `Ziklag?`; Or one collection may use the Kidron term for `Kidron Valley` and the other wants to use it for `Kidron River`.
- We need to ensure consistency of terms that are just part of a label. e.g. "To Jericho"; "Jebus (Jerusalem)"; "Azotus / Ashdod", "Cana: Jesus turns water into wine. (Jn. 2)"
- Many maps make a good deal of use of Scripture references as labels or within labels, which shouldn't have to all be retyped. e.g. "(Act. 8:23-28)" We can use the Paratext project settings to generate the reference in the appropriate abbreviated form.
- The current model of loading all map definitions, all merge keys, all key terms, and all their references into memory might not scale well when adding the hundreds of Biblica maps.
- There is no mechanism to ensure that placenames that should be spelled consistently between Old and New Testaments are. e.g. If you spell it "Harran" for the NT Greek term, you should also spell it "Harran" for the OT Hebrew term. (Currently we link a placename to either a Greek or a Hebrew term, but not to both.)
- Our "explicit map form" hack, such as `(@Jordan River)` might not be feasible with the next version of Paratext (PT10).
- Our "custom termId" hack, such as `mediterranean_sea`, might not be feasible with PT10.

## Possible Components of a Solution:

### _LabelerCollections
- The revamped version of the app will work with files in _LabelerCollections rather than in the current _LabelerTemplates. As this will be distributed with the revised version of the app, we do not need to be concerned with issues of migration. The starting point for _LabelerCollections is that it is a copy of _LabelerTemplates, with changes made as described below.

### placenames.json and core-placenames.json
- These files replace termlist.json and core-termlist.json respectively.
- We can ensure consistency between OT and NT renderings by the use of "placeName" entities that unify Paratext terms.
- We define a "placeName" as an object that contains data for a place entity, regardless of whether it is used in the OT or the NT. The identifier for a placeName is its placeNameId, which in general is the identifier used by the Bible Aquifer ACAI places dataset, such as "Arabia". The data for this placeName (as an item in placenames.json or core-placenames.json) looks like this:

  "Arabia": {
    "gloss": {
      "en": "Arabia",
      "es": "Arabia",
      "fr": "Arabie"
    },
    "context": {
      "en": "Arabia (probably a reference to the Sinai Peninsula)",
      "es": "Región ubicada al sureste de Palestina.",
      "fr": "Arabie (probablement une référence à la péninsule du Sinaï)"
    },
    "terms": [
      {
        "termId": "Ἀραβία",
        "transliteration": "Arabia",
        "refs": [
          "048001017",
          "048004025"
        ]
      },
      {
        "termId": "עַרְבִי",
        "transliteration": "ʿarbiy",
        "refs": [
          "014017011",
          "014021016",
          "014022001",
          "014026007",
          "016002019",
          "016004001",
          "016006001"
        ]
      }
    ],
    "altTermIds": ""
  },

- This is essentially the unifying of the OT and NT terms from the previous termlist.json, under the ACAI place ID.
- Some additional records are included for non-Biblical placenames. e.g. MediterraneanSea; PacificOcean.
- placeNames in the collection's placenames.json take precedence over placeNames in the app-wide core-placenames.json. They may include entries with custom IDs and references. e.g. "Londinium" (with no refs); "goads" (with ref of ACT 26:14).

### Label Dictionary (Project-level)
- All labels for all saved maps (from whichever map collection) are to be stored in a project-wide label dictionary (LabelDictionary.json) that maps "label templates" to the vernacular text for that label template. For example:
    "{Aphek.2}" : "Afeka Sahar"
- Vernacular labels themselves are no longer written back into the TermRenderings.xml file, though their initially-proposed contents may be derived from term renderings and may need to match term renderings.
- A label template is a string that contains a mix of literal text and field codes that may optionally include usage tags, like this:
    |Label Template| Examples|
    |---|---|
    |`{Jerusalem}`|`Jerusalem`|
    |`{q#Ziklag}`|`Ziclág?`  `زِقْلَغ؟`|
    |`{Jebus} ({Jerusalem})`|`Jebus (Jerusalem)`|
    |`{to#Jericho}`|`To Jericho`  `Yerikolai`|
    |`{Azotus} / {Ashdod}`|`Azotus / Ashdod`|
    |`{Cana}: Jesus turns water into wine. {r#JHN 2}`|`Cana: Jesus turns water into wine (Jn. 2)`|
    |`{r#1SA 2.3}`|`1 Sam. 2:3`|
 
- Usage tags are primarily a way to enable different usages of a placeName to co-exist in the dictionary without interfering with each other, while still linking to all the relevant references. We do not currently attempt to use these in a generative manner, such as to predict the vernacular form of a template string that uses tags. A collection may introduce additional tags if necessary.
    `{to#__}`    Direction. e.g. "To Jericho"
    `{q#__}`  Uncertain. e.g. "Ziklag?"  
    `{#__}`  Number. e.g. 100 (on km scale)
    `{mt#__}` Mountain.  e.g. "Mt. Tabor"
    `{riv#__}`   River. e.g. "Jordan R."

- Exception: One usage tag is generative, as it indicates that a scripture reference should be generated according to the Paratext project's rules for composing an abbreviated reference:
    `{r#__}`  Scripture reference

### PlaceNameData.json (Project-level)
- Here's an example of a problem that is exacerbated by having from a unified placeName system: Sometimes there are legitimate reasons for a Paratext term to have multiple approved rendering patterns, perhaps due to the variation that occurs depending on morphophonemics. It seems that by storing the correct map form in the Label Dictionary, we've indicated that the other rendering pattern has been examined and approved, so we don't need to flag any problems using the label status. However, it's possible that additional rendering patterns will be added later without such consideration. This becomes particularly likely to happen when it's in a separate Paratext term. For example, suppose the user consistently spelled the place that Terah moved to as "Harrán" in the NT, and made a map using that spelling. The Label Dictionary now maps "{Haran}" to "Harrán". Later, when the OT is translated, the translators are inconsistent, and spell it as "Harán". Paratext's OT term only sees that it is spelled consistently across the OT, while the NT term only sees that it is spelled consistently across the NT, but not that these are different spellings. The Label Dictionary shows that we already have an approved map form, and the app can see that there are different rendering patterns between the NT and the OT term, but it has no way of knowing whether that other rendering pattern was approved at the time the Label Dictionary entry was created, or if it it indicates a problem.
- The solution is to have an accompanying dictionary named PlaceNameData.json that maps placeNameId values (not template strings) to alternative rendering patterns that have been approved within the app. e.g. 
    "Aphek.2" : { "altRenderings": ["Aphik*"] }
- If no such entry exists, the label status indicates the issue until it is dealt with, or the new rendering pattern is added to the altRenderings list.
- PlaceNameData.json may also track if the user selects to join renderings of OT and NT terms. For example,
    "Jerusalem" : { "joined": "true" }
  A joined=true property indicates that the OT and NT rendering patterns should be kept in sync with each other.

### mergekeys.json
- mergeKeys now map to labelTemplate values rather than 1:1 directly to termId or even placeNameId values.
  "bethlehem_nt": {
    "lblTemplate": "{Bethlehem}",
    "mapxKey": "Bethlehem"
  },
  "bethlehem_ot": {
    "lblTemplate": "{Bethlehem}",
    "mapxKey": "Bethlehem"
  },
  "sea_of_galilee_ot": {
    "lblTemplate": "{sea#Chinnereth} ({Galilee})",
    "mapxKey": "Sea of Chinnereth (Galilee)",
    "gloss": { "en": "Sea of Chinnereth (Galilee)" },
    "context": {"en": "Sea between the regions of Galilee and Golan; also called Sea of Galilee"}
  },
- mergeKeys no longer have an altTermsId property, as this is now part of a placeName definition.
- mergeKeys may provide gloss and context properties that take precedence over corresponding placeName definitions. If the lblTemplate is more complex that a simple placename with curly braces (that is, it doesn't match the regex `^\{[^#\{\s]+\}$`), gloss and context are required, at least in English.

### Op Codes & Map supplementary file
- When a map is saved (to IDML.txt), an optional supplementary json file stores additional data:
    - caption and ref, and whether to suppress the internal title (or other elements?)
    - an operation code for each field, which is one of these values:
        - sync: Auto update this label to stay in sync with the label dictionary.  (default.) In other words, changing the value here also changes the dictionary value, and opening a map for which this label's value is different than the dictionary value will update this value.
        - override: This label overrides the label dictionary value on this map, but doesn't change it.
        - omit: This label should be omitted from this map. Make the stored value empty, even if the dictionary has a value for it.
- After loading a map (and initializing the state for reverting), for any label with an op code of sync, if the value in the label is different to the value in the dictionary, we update the label to match the dictionary. We set the dirty bit so that this map is treated as having unsaved changes. e.g revert button is enabled to revert to state before.

## GUI Implications
- A row of three checkboxes must accompany the textarea in which the user enters/modifies the label:
    [ ] sync    [ ] override    [ ] omit
- If a label template references a placeName that has more than one Paratext term (e.g. both OT and NT termId values), they may need separate term renderings textareas. Ideally, the two will be automatically mergeable (e.g. one is empty, or they have identical contents), so we can show only one textarea, and any changes made there will be saved back to both entries in TermRenderings.xml. But we need to allow for the possibility that the user does not want to join these, so there should be a means to toggle the join on/off. As previously mentioned, the joined status is stored in the project's PlaceNameData.json file. If joined, the app will keep the rendering patterns of both/all terms the same. 
    - Note that in the case that a placeName has more than one term, if the user denies a missing rendering in the bottom pane, we'll need to check which term that reference came from, and update the term's denial status in TermRenderings.xml accordingly.
- Because a label template may reference more than one placename, the user needs to be able to address each one individually. In this situation, we can do this by putting the placename-specific content in a tabbed space, so that clicking on a tab makes that placeName the current one. Whichever placename is the current one is the placename for which the bottom pane contains the references. Because each placename may have a different status, the color of the tab reflects the status color of its placename. For example, the placename "Jebus" may show as "Guessed" while the placename of "Jerusalem" shows as "Incomplete". The label itself inherits whichever status color is the more serious issue, in this case, "Guessed".
- See the image details-revamp.png in this folder for an approximate mock-up of such a GUI in the Details pane.