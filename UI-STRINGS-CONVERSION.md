# UI Strings Conversion Scripts

These Node.js scripts allow you to convert between JSON and TSV formats for the ui-strings.json file, making it easier to work with translations in spreadsheet applications.

## Files

- `json-to-tsv.js` - Converts ui-strings.json to TSV format
- `tsv-to-json.js` - Converts TSV format back to JSON

## TSV Format

The TSV file has 5 columns:
- **key** - The translation key
- **en** - English text
- **es** - Spanish text  
- **fr** - French text
- **ne** - Nepali text

### Key Format

- For regular properties: Uses the literal key from the JSON object (e.g., `addMapForm`, `cancel`)
- For statusValue array items: Uses the format `statusValue_{index}_{property}` where:
  - `{index}` is the array index (0, 1, 2, ...)
  - `{property}` is either `text` or `help`
  - Examples: `statusValue_0_text`, `statusValue_0_help`, `statusValue_1_text`

## Usage

### Convert JSON to TSV
```bash
# Use default files (src/data/ui-strings.json → ui-strings.tsv)
node json-to-tsv.js

# Specify custom input and output files
node json-to-tsv.js path/to/input.json path/to/output.tsv
```

### Convert TSV to JSON
```bash
# Use default files (ui-strings.tsv → src/data/ui-strings.json)
node tsv-to-json.js

# Specify custom input and output files
node tsv-to-json.js path/to/input.tsv path/to/output.json
```

## Features

- Handles embedded tabs and newlines in text properly
- Preserves the original JSON structure including the statusValue array
- Validates TSV header format
- Skips empty/invalid rows with warnings
- Removes empty language values to keep JSON clean

## Example Workflow

1. Convert JSON to TSV for editing:
   ```bash
   node json-to-tsv.js
   ```

2. Edit `ui-strings.tsv` in Excel, LibreOffice Calc, or any text editor

3. Convert back to JSON:
   ```bash
   node tsv-to-json.js ui-strings.tsv src/data/ui-strings.json
   ```

The scripts handle round-trip conversion correctly, preserving all data and structure.
