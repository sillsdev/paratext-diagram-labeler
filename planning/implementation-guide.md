# Implementation Guide for Remaining Tasks

## Overview
This guide outlines the remaining work to complete the major architectural restructure from term-centric to placeName-template-centric architecture.

## Completed Foundation (Tasks 1-4)
✅ **LabelDictionaryService** - Project-level label and placeName data management  
✅ **LabelTemplateParser** - Parse {placeNameId}, {tag#placeNameId}, {r#REF} syntax  
✅ **ReferenceFormatter** - Format scripture references using scrBookNames.xml  
✅ **CollectionManager** - Refactored for NEW format (placenames.json, lblTemplate)  
✅ **Status System** - Updated to 8-status hierarchy (0-7 priority order)

## Architecture Key Points
- **TermRenderings.xml** (Paratext) - Still used for rendering patterns from Biblical Terms
- **LabelDictionary.json** (project) - Maps lblTemplate → vernacular label text
- **PlaceNameData.json** (project) - Stores altRenderings confirmations and joined flags
- **placenames.json** (collection) - Maps placeNameId → {gloss, context, terms[]}
- **mergekeys.json** (collection) - Maps mergeKey → lblTemplate (not termId)

## Label Data Flow
1. Map label has **mergeKey** (e.g. "bethlehem_ot")
2. mergeKey → **lblTemplate** via mergekeys.json (e.g. "{Bethlehem}")
3. lblTemplate parsed → **placeNameIds** via LabelTemplateParser (e.g. ["Bethlehem"])
4. placeNameId → **terms** via placenames.json (e.g. [{termId: "בֵּית לֶחֶם", refs: [...]}])
5. lblTemplate → **vernacular** via LabelDictionary.json (e.g. "Belén")

## Task 5-8: DetailsPane Redesign

### Current State Analysis
- DetailsPane currently works with `labels[selectedLabelIndex]`
- Each label has: `{mergeKey, termId, vernLabel, gloss, status, ...}`
- Currently calls `onUpdateVernacular(termId, text)` to save changes
- Currently uses `termRenderings[termId]` for rendering patterns in bottom textarea

### Required Changes

#### Phase 1: Update Data Model in MainApp.js
**File**: `src/MainApp.js`

1. **Enhance label objects** when loading templates:
```javascript
// Current: labels have {mergeKey, termId, vernLabel, gloss, status}
// NEW: labels need {mergeKey, lblTemplate, placeNameIds[], vernLabel, opCode, status, perPlaceStatus{}}

const newLabels = foundTemplate.labels.map(label => {
  const lblTemplate = collectionManager.getLabelTemplate(label.mergeKey, collectionId);
  const parsed = templateParser.parseTemplate(lblTemplate);
  const placeNameIds = parsed.placeNameIds;
  
  // Get vernacular from Label Dictionary (default opCode='sync')
  const opCode = getOpCode(mapDef.template, label.mergeKey) || 'sync';
  const dictVernacular = labelDictService.getVernacular(lblTemplate);
  const vernLabel = dictVernacular || resolveTemplate(lblTemplate, collectionId);
  
  // Calculate status per placeName
  const perPlaceStatus = {};
  placeNameIds.forEach(placeNameId => {
    const terms = collectionManager.getTermsForPlace(placeNameId, collectionId);
    // Calculate status for each term, take most severe
    const statuses = terms.map(term => 
      getStatus(termRenderings, term.termId, vernLabel, term.refs, extractedVerses)
    );
    perPlaceStatus[placeNameId] = Math.min(...statuses);
  });
  
  // Label status = most severe of all placeNames
  const status = Math.min(...Object.values(perPlaceStatus));
  
  return {
    ...label,
    lblTemplate,
    placeNameIds,
    vernLabel,
    opCode,
    status,
    perPlaceStatus
  };
});
```

2. **Update onUpdateVernacular handler**:
```javascript
// Current: onUpdateVernacular(termId, text)
// NEW: onUpdateVernacular(mergeKey, lblTemplate, text, opCode)

const handleUpdateVernacular = (mergeKey, lblTemplate, text, opCode) => {
  // Update label in state
  setLabels(labels.map(label => 
    label.mergeKey === mergeKey 
      ? {...label, vernLabel: text, opCode}
      : label
  ));
  
  // If opCode is 'sync', update Label Dictionary
  if (opCode === 'sync') {
    labelDictService.setVernacular(lblTemplate, text, 'sync');
    
    // Check for conflicts: other maps using this lblTemplate with opCode='override'
    const conflicts = findConflicts(lblTemplate, text);
    if (conflicts.length > 0) {
      // Show 3-button dialog: "Keep Override" | "Update Dictionary" | "Cancel"
      showSyncConflictDialog(conflicts, lblTemplate, text);
    }
  }
  
  setHasUnsavedChanges(true);
};
```

3. **Implement supplementary metadata loading** in `loadTemplate`:
```javascript
// After loading .idml.txt labels, load supplementary @project.json
const suppFilePath = `${projectFolder}/${templateName} @${projectName}.json`;
try {
  const suppData = await electronAPI.readFile(suppFilePath);
  const parsed = JSON.parse(suppData);
  
  // Apply opCode overrides from supplementary file
  Object.entries(parsed.labels || {}).forEach(([mergeKey, {opCode, vernLabel}]) => {
    const labelIndex = newLabels.findIndex(l => l.mergeKey === mergeKey);
    if (labelIndex >= 0) {
      newLabels[labelIndex].opCode = opCode || 'sync';
      if (opCode === 'override' && vernLabel) {
        newLabels[labelIndex].vernLabel = vernLabel;
      } else if (opCode === 'omit') {
        newLabels[labelIndex].vernLabel = '';
      }
    }
  });
} catch (err) {
  // Supplementary file doesn't exist yet - that's ok
}
```

4. **Update handleSaveLabels** to save both files:
```javascript
const handleSaveLabels = async () => {
  // Save .idml.txt with vernacular labels
  const labelsToSave = {};
  labels.forEach(label => {
    if (label.mergeKey && label.vernLabel) {
      labelsToSave[label.mergeKey] = label.vernLabel;
    }
  });
  
  await electronAPI.saveLabelsToIdmlTxt(projectFolder, mapDef.template, labelsToSave);
  
  // Save supplementary @project.json with opCode data
  const suppData = {
    labels: {}
  };
  labels.forEach(label => {
    if (label.opCode && label.opCode !== 'sync') {
      suppData.labels[label.mergeKey] = {
        opCode: label.opCode,
        ...(label.opCode === 'override' ? {vernLabel: label.vernLabel} : {})
      };
    }
  });
  
  const suppFilePath = `${projectFolder}/${mapDef.template} @${projectName}.json`;
  await electronAPI.writeFile(suppFilePath, JSON.stringify(suppData, null, 2));
  
  setHasUnsavedChanges(false);
};
```

#### Phase 2: Update DetailsPane.js

**File**: `src/DetailsPane.js`

1. **Update imports**:
```javascript
// Remove obsolete imports
import {
  STATUS_NO_RENDERINGS,
  STATUS_GUESSED,
  STATUS_MULTIPLE_RENDERINGS,  // Keep this one
  STATUS_UNMATCHED,
  // Remove STATUS_RENDERING_SHORT
} from './constants.js';

// Add new imports
import { labelDictionaryService } from './services/LabelDictionaryService';
import { LabelTemplateParser } from './services/LabelTemplateParser';
```

2. **Add state for opCode**:
```javascript
const [opCode, setOpCode] = useState(labels[selectedLabelIndex]?.opCode || 'sync');
const [activeTab, setActiveTab] = useState(0); // For multi-placeName templates
```

3. **Add opCode radio buttons** (before vernacular textarea):
```javascript
<div style={{display: 'flex', gap: 16, marginBottom: 8}}>
  <label>
    <input 
      type="radio" 
      checked={opCode === 'sync'} 
      onChange={() => handleOpCodeChange('sync')}
    />
    Sync
  </label>
  <label>
    <input 
      type="radio" 
      checked={opCode === 'override'} 
      onChange={() => handleOpCodeChange('override')}
    />
    Override
  </label>
  <label>
    <input 
      type="radio" 
      checked={opCode === 'omit'} 
      onChange={() => handleOpCodeChange('omit')}
    />
    Omit
  </label>
</div>
```

4. **Implement opCode change handler**:
```javascript
const handleOpCodeChange = (newOpCode) => {
  const currentLabel = labels[selectedLabelIndex];
  
  if (newOpCode === 'sync' && opCode === 'override') {
    // Switching from override to sync - check for dictionary conflict
    const dictValue = labelDictionaryService.getVernacular(currentLabel.lblTemplate);
    if (dictValue && dictValue !== vernacularValue) {
      // Show 3-button dialog
      showOverrideToSyncDialog(currentLabel.lblTemplate, vernacularValue, dictValue);
      return;
    }
  }
  
  if (newOpCode === 'omit') {
    setVernacularValue('');
  }
  
  setOpCode(newOpCode);
  onUpdateVernacular(currentLabel.mergeKey, currentLabel.lblTemplate, vernacularValue, newOpCode);
};
```

5. **Add tabbed interface** for multi-placeName templates:
```javascript
const currentLabel = labels[selectedLabelIndex];
const placeNameIds = currentLabel?.placeNameIds || [];

{placeNameIds.length > 1 && (
  <div style={{display: 'flex', gap: 4, marginBottom: 8}}>
    {placeNameIds.map((placeNameId, index) => {
      const placeName = collectionManager.getPlaceName(placeNameId, collectionId);
      const statusColor = statusValue[currentLabel.perPlaceStatus[placeNameId]].textColor;
      return (
        <button
          key={placeNameId}
          style={{
            padding: '4px 12px',
            background: activeTab === index ? '#d0eaff' : '#f0f0f0',
            border: `2px solid ${statusColor}`,
            cursor: 'pointer'
          }}
          onClick={() => setActiveTab(index)}
        >
          {inLang(placeName.gloss, lang)}
        </button>
      );
    })}
  </div>
)}
```

6. **Add Join checkbox** (for multi-term placeNames):
```javascript
const activePlaceNameId = placeNameIds[activeTab];
const terms = collectionManager.getTermsForPlace(activePlaceNameId, collectionId);

{terms.length > 1 && (
  <label style={{display: 'block', marginBottom: 8}}>
    <input
      type="checkbox"
      checked={labelDictionaryService.isJoined(activePlaceNameId)}
      onChange={(e) => {
        labelDictionaryService.setJoined(activePlaceNameId, e.target.checked);
        // If joining, merge rendering patterns
        if (e.target.checked) {
          mergeTermRenderings(terms);
        }
      }}
    />
    Join OT and NT renderings
  </label>
)}
```

7. **Make textareas dynamic height**:
```javascript
const [vernacularRows, setVernacularRows] = useState(1);

<textarea
  ref={vernacularAutocorrectRef}
  value={vernacularValue}
  onChange={(e) => {
    handleVernacularChange(e);
    // Auto-resize
    const lines = e.target.value.split('\n').length;
    setVernacularRows(Math.max(1, lines));
  }}
  rows={vernacularRows}
  style={{
    resize: 'vertical',
    minHeight: '32px',
    overflow: 'auto'
  }}
/>
```

8. **Update Term Renderings section** to show tabs if multiple terms:
```javascript
{terms.length > 1 && !labelDictionaryService.isJoined(activePlaceNameId) ? (
  // Show separate textareas for each term
  terms.map(term => (
    <div key={term.termId}>
      <h6>{term.termId} ({term.transliteration})</h6>
      <AutocorrectTextarea
        value={termRenderings[term.termId]?.renderings || ''}
        onChange={e => handleRenderingsChange(term.termId, e.target.value)}
      />
    </div>
  ))
) : (
  // Show single textarea (joined or single term)
  <AutocorrectTextarea
    ref={renderingsTextareaRef}
    value={localRenderings}
    onChange={handleRenderingsChange}
  />
)}
```

9. **Add Confirm button** for STATUS_MULTIPLE_RENDERINGS:
```javascript
{status === STATUS_MULTIPLE_RENDERINGS && (
  <button 
    style={{marginLeft: 8}}
    onClick={() => {
      const patterns = extractRenderingPatterns(localRenderings);
      labelDictionaryService.addAltRendering(activePlaceNameId, patterns);
      // Recalculate status
      updateLabelStatus();
    }}
  >
    Confirm these patterns
  </button>
)}
```

## Task 9: Simplify BottomPane Display

**File**: `src/BottomPane.js`

### Current State
- BottomPane receives `termId` and displays refs from `collectionManager.getRefs(mergeKey, collectionId)`
- Refs are already in storage order (no grouping currently)
- Denial marking works by toggling `termRenderings[termId].denials`

### Required Changes

1. **Update props** to accept multiple terms:
```javascript
function BottomPane({
  mergeKey,
  lblTemplate,
  activePlaceNameId,  // NEW: which placeName is active in tabs
  renderings,
  // ... other props
}) {
```

2. **Get refs for active placeName**:
```javascript
const placeName = collectionManager.getPlaceName(activePlaceNameId, collectionId);
const terms = placeName.terms;

// Combine refs from all terms in display order (NT first, then OT)
const allRefs = [];
terms.forEach(term => {
  term.refs.forEach(ref => {
    if (!allRefs.includes(ref)) {
      allRefs.push(ref);
    }
  });
});
```

3. **Determine which term contains a ref** (for denial marking):
```javascript
const findTermForRef = (refId) => {
  for (const term of terms) {
    if (term.refs.includes(refId)) {
      return term.termId;
    }
  }
  return null;
};
```

4. **Update denial handler**:
```javascript
const handleToggleDenied = (refId) => {
  const termId = findTermForRef(refId);
  if (!termId) return;
  
  const data = termRenderings;
  let denials = Array.isArray(data[termId]?.denials) 
    ? [...data[termId].denials] 
    : [];
    
  const isDenied = denials.includes(refId);
  
  if (isDenied) {
    denials = denials.filter(r => r !== refId);
  } else {
    if (!denials.includes(refId)) denials.push(refId);
  }
  
  if (!data[termId]) data[termId] = {};
  data[termId].denials = denials;
  
  setTermRenderings({...data});
  setDenialToggle(t => !t);
  if (typeof onDenialsChanged === 'function') onDenialsChanged();
};
```

5. **Display refs in storage order** (already done, just verify):
```javascript
// Refs are already displayed in the order they appear in allRefs array
// No grouping is needed - just iterate and display each ref
{allRefs.map((refId, index) => {
  const verse = extractedVerses[refId] || '';
  // ... render row
})}
```

## Task 10 & 11: Remaining Features

### Task 10: Map Supplementary Metadata
✅ Already covered in Phase 1 of MainApp.js updates above

### Task 11: AltRenderings Confirmation
✅ Already covered in Phase 2 of DetailsPane.js updates above

Additional work needed in **Utils.js getStatus()**:
```javascript
// In getStatus function, before returning STATUS_MULTIPLE_RENDERINGS:
if (hasMultiplePatterns) {
  // Check if patterns have been confirmed
  const confirmed = labelDictionaryService.isPatternsConfirmed(placeNameId, patterns);
  if (confirmed) {
    return STATUS_MATCHED; // Or appropriate status
  }
  return STATUS_MULTIPLE_RENDERINGS;
}
```

## Testing Strategy

### Phase 1: Foundation Testing
1. Verify LabelDictionaryService loads/saves correctly
2. Verify LabelTemplateParser extracts placeNameIds
3. Verify CollectionManager.resolveTemplate() works
4. Test status calculation with new hierarchy

### Phase 2: Integration Testing
1. Load a map with simple labels (single placeName)
2. Verify vernacular comes from Label Dictionary
3. Test opCode radio buttons (sync/override/omit)
4. Verify saving creates both .idml.txt and @project.json

### Phase 3: Complex Template Testing
1. Load map with multi-placeName labels
2. Verify tabs appear with correct status colors
3. Test switching between tabs
4. Verify bottom pane shows correct refs per tab

### Phase 4: Join Feature Testing
1. Find placeName with both OT and NT terms
2. Verify Join checkbox appears
3. Test joining renders (should merge patterns)
4. Test unjoining (should show separate textareas)

### Phase 5: AltRenderings Testing
1. Create placeName with multiple rendering patterns
2. Verify STATUS_MULTIPLE_RENDERINGS appears
3. Click "Confirm these patterns"
4. Verify status updates to matched/appropriate

## Migration Notes

### For Developers
- OLD architecture files remain in `_LabelerTemplates` (not distributed)
- NEW architecture files in `_LabelerCollections` (distributed with app)
- No migration needed - clean break with new version
- Both formats can coexist during development

### For Users
- Existing project TermRenderings.xml still used (no changes needed)
- New files created in project folder:
  - `LabelDictionary.json` (created on first save)
  - `PlaceNameData.json` (created when confirming patterns or joining)
  - `{template} @{project}.json` (created when using override/omit opCodes)

## File Structure Summary

```
_LabelerCollections/
  core-placenames.json          # App-wide placeName definitions
  SMR/
    collection.json
    languages.json
    map-defs.json
    mergekeys.json              # Maps mergeKey → lblTemplate
    placenames.json             # Maps placeNameId → {gloss, context, terms[]}
    @en/
    @es/

<ProjectFolder>/
  TermRenderings.xml            # Paratext terms (existing, still used)
  LabelDictionary.json          # lblTemplate → vernacular mappings (NEW)
  PlaceNameData.json            # placeNameId → {altRenderings[], joined} (NEW)
  <template> @<project>.json    # Per-map opCode overrides (NEW)
  <template>.idml.txt           # Vernacular labels UTF-16 LE (existing)
```

## Key Architectural Decisions

1. **TermRenderings.xml remains authoritative** for rendering patterns
2. **LabelDictionary.json is the NEW authoritative source** for map labels
3. **opCode='sync' is default** - most labels auto-update from dictionary
4. **Status calculation per placeName**, label inherits most severe
5. **Tabs for multi-placeName** templates, Join for multi-term placeNames
6. **Supplementary @project.json** stores per-map overrides (opCode, etc.)
7. **No escaping needed** in template syntax - {placeNameId} is literal

## Next Steps for Implementation

1. Start with MainApp.js Phase 1 (enhance label data model)
2. Update DetailsPane.js imports and basic structure
3. Implement opCode UI and handlers
4. Add tab interface for multi-placeName
5. Implement Join checkbox and dynamic textareas
6. Update BottomPane for multi-term ref lookups
7. Add Confirm button and altRenderings logic
8. Test incrementally with real data

## Open Questions

1. Should STATUS_MULTIPLE_RENDERINGS auto-confirm if patterns were previously seen?
2. How to handle lblTemplate changes in mergekeys.json after labels exist in dictionary?
3. Should Join=true automatically merge existing patterns or wait for user action?
4. What happens to opCode when switching templates (keep override, reset to sync)?

---

**Last Updated**: 2025-11-19
**Status**: Foundational services complete, GUI updates pending
**Next Milestone**: Complete DetailsPane Phase 1 (data model updates in MainApp.js)
