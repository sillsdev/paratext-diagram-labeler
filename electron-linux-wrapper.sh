#!/bin/bash
# Wrapper script to fix GTK conflicts on Linux

# Set environment variables before launching Electron
export GDK_BACKEND=x11
export ELECTRON_OZONE_PLATFORM_HINT=auto
export LIBGL_ALWAYS_SOFTWARE=1

# Launch the electron app with all arguments passed through
exec electron "$@"
