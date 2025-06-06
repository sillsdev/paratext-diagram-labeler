# Biblical Map Labeler - Distribution Guide

## Overview

Biblical Map Labeler is an Electron application for labeling biblical maps. This guide explains how to distribute the application with its required map images.

## Common Issues and Solutions

### Map Images Not Displaying

If maps aren't displaying in the released application:

1. **Ensure maps are in the `base-maps` folder** - The application looks for maps in a `base-maps` folder located next to the executable.
2. **Check paths in MapPane.js** - The component should use relative paths like `./base-maps/filename.jpg`.
3. **Run verify-and-fix-paths.bat** - This script will check all paths and attempt to fix common issues.

### Blank Window or Missing UI Elements

If the application shows a blank window or missing UI:

1. **Check HTML paths** - Run `fix-html-paths.js` to ensure all HTML references use relative paths.
2. **Use file protocol handler** - The app uses a custom protocol handler in electron-main.js to correctly resolve file URLs.
3. **Check browser console for errors** - Use DevTools to identify specific loading failures.

## Application Structure

When built and packaged, the application has the following structure:

```
Biblical Map Labeler/
├── Biblical Map Labeler.exe  (main executable)
├── base-maps/               (folder containing all map images)
│   ├── SMR1_015wbt - Ancient World.jpg
│   ├── SMR1_055wbt - Exodus.jpg
│   └── ... (other map images)
├── resources/               (application resources)
└── ... (other application files)
```

## Map Images

The application looks for map images in a `base-maps` folder that exists in the same directory as the main executable. When distributing the application:

1. Make sure the `base-maps` folder is included in the distribution package
2. All map images should be placed inside this folder
3. Do not change the filenames of the map images as they are referenced directly in the application

## Distribution Options

### Installer Version

The NSIS installer automatically includes the `base-maps` folder and places it in the installation directory.

### Portable Version

The portable version also includes the `base-maps` folder. Users can move the portable .exe file and the `base-maps` folder together to any location, but the folder structure must be maintained.

## Adding New Maps

To add new maps to an existing installation:

1. Simply place the new map images in the `base-maps` folder
2. The application will detect and be able to use these maps
3. Map filenames should follow the convention: `SMR1_[number][initials] - [Description].jpg`

## Troubleshooting

If map images aren't appearing in the application:

1. Check that the `base-maps` folder exists in the same directory as the application executable
2. Verify that the map images are in the correct format (.jpg)
3. Ensure the map filenames match those referenced in the application

## Building from Source

When building from source:

```
npm run build           # Build the React application
npm run copy-resources  # Copy resources to build folder
npm run copy-maps       # Copy map images to base-maps folder
node fix-html-paths.js  # Fix paths in HTML files
```

For full packaging, use the provided batch scripts:

```
build-release.bat       # Build complete release (installer + portable)
build-portable.bat      # Build portable version only
verify-and-fix-paths.bat # Verify and fix path issues
```

These scripts will automatically handle the copying of map images and fixing paths to ensure resources load correctly.

### Path Resolution

The application uses several techniques to ensure paths resolve correctly:

1. **Relative paths in HTML/CSS/JS files** - All resources use relative paths (e.g. `./static/css/main.css`)
2. **Base href tag** - Added to HTML to set base URL for relative paths
3. **Protocol handler** - Custom protocol handler in Electron to properly resolve file:// URLs
4. **Base maps folder** - Maps are stored in `base-maps` folder next to the executable
