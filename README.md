# Paratext Diagram Labeler

[![Latest Release](https://img.shields.io/github/v/release/sillsdev/paratext-diagram-labeler?include_prereleases&sort=semver&display_name=tag)](https://github.com/sillsdev/paratext-diagram-labeler/releases/latest)
[![Build Status](https://img.shields.io/github/actions/workflow/status/sillsdev/paratext-diagram-labeler/build-installers.yml?branch=master)](https://github.com/sillsdev/paratext-diagram-labeler/actions/workflows/build-installers.yml)
[![Download Count](https://img.shields.io/github/downloads/sillsdev/paratext-diagram-labeler/total)](https://github.com/sillsdev/paratext-diagram-labeler/releases)
[![License](https://img.shields.io/github/license/sillsdev/paratext-diagram-labeler)](LICENSE.md)
[![Last Commit](https://img.shields.io/github/last-commit/sillsdev/paratext-diagram-labeler)](https://github.com/sillsdev/paratext-diagram-labeler/commits/master)
[![Contributors](https://img.shields.io/github/contributors/sillsdev/paratext-diagram-labeler)](https://github.com/sillsdev/paratext-diagram-labeler/graphs/contributors)
[![Sponsor](https://img.shields.io/badge/Sponsor-This%20Project-ff69b4?logo=GitHub%20Sponsors&logoColor=white)](FUNDING.md)

> Interactive map labeling tool for biblical diagrams with Paratext integration

## 📥 Download

| Platform | Download |
|----------|----------|
| 🪟 **Windows** | [Download exe installer](https://github.com/sillsdev/paratext-diagram-labeler/releases/latest) |
| 🐧 **Linux** | [Download deb or appImage package](https://github.com/sillsdev/paratext-diagram-labeler/releases/latest) |
| 🍎 **macOS** | [Download dmg (unsigned) installer](https://github.com/sillsdev/paratext-diagram-labeler/releases/latest) |

> 💡 **Note**: All download links automatically point to the latest release. Choose your platform-specific installer from the release page.

## Developers

Head on over to [CONTRIBUTING.md](CONTRIBUTING.md) for details

# Biblical Map Labeler

This is an Electron-based application for labeling biblical maps with scripture references.

## Features

- **Map Labeling**: Interactive map labeling with scripture references
- **Paratext Integration**: Send scripture references directly to Paratext (Windows only)
  - Click the pencil icon next to any verse reference to send it to Paratext
  - Sets the registry key and broadcasts a Windows message for immediate scrolling
  - Uses a precompiled helper executable (no .NET runtime required)
- **Template Management**: Load and manage map labeling templates

## Paratext Integration

The "Send reference to Paratext" feature works by:
1. Setting the registry key `HKCU\Software\SantaFe\Focus\ScriptureReference`
2. Broadcasting a "SantaFeFocus" Windows message to notify Paratext
3. Paratext automatically scrolls to the specified reference

This matches the exact behavior used by PTXprint and other SIL tools.
Builds the app.
