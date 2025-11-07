# Resources Directory

This directory contains static assets and build resources for the application.

## Required Icons

For production builds, you need to provide the following icons:

### Windows
- `icon.ico` - Windows icon file (256x256 recommended)

### macOS
- `icon.icns` - macOS icon file (512x512@2x recommended)

### Linux
- `icon.png` - Linux icon file (512x512 recommended)

## Creating Icons

You can use online tools or command-line utilities to convert your icon:

### Online Tools
- [iConvert](https://iconverticons.com/online/)
- [CloudConvert](https://cloudconvert.com/)

### Command Line
- For macOS: Use `iconutil` (built-in on macOS)
- For Windows: Use tools like ImageMagick
- For Linux: Any PNG editor

## Placeholder

For development, the app will use default Electron icons if these files are not present.
