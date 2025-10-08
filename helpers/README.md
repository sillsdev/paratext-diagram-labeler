# SantaFeBroadcast Helper

This directory contains a precompiled Windows executable that helps broadcast "SantaFeFocus" messages to Paratext.

## Files

- `SantaFeBroadcast.cs` - C# source code for the helper
- `SantaFeBroadcast.exe` - Precompiled executable (no .NET runtime required)
- `compile-helper.bat` - Batch file to recompile if needed

## What it does

The helper executable:
1. Registers a custom Windows message called "SantaFeFocus"
2. Broadcasts this message to all top-level windows
3. This notifies Paratext to immediately refresh and scroll to the scripture reference that was set in the registry

## Compilation

The helper is compiled with .NET Framework 4.0, which is available on all Windows systems by default. No additional runtime dependencies are required.

To recompile (if you modify the source):
1. Run `compile-helper.bat`
2. The script will find an available C# compiler and create `SantaFeBroadcast.exe`

## Integration

The Electron app automatically uses this precompiled helper when:
1. PowerShell-based message broadcasting doesn't work or show clear success
2. The helper exists at `helpers/SantaFeBroadcast.exe`

This provides reliable Paratext integration without requiring users to have .NET SDK installed.
