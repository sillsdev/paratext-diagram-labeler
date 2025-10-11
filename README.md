# Getting Started

[![Sponsor](https://img.shields.io/badge/Sponsor-This%20Project-ff69b4?logo=GitHub%20Sponsors&logoColor=white)](FUNDING.md)

Biblical map app should run cross-platform on Windows, Mac and Linux

First do

`npm install`

To run the app in development mode:

`npm run dev-mode`

Runs the app in the development mode.

### `build-release.bat`

Launches the test runner in the interactive watch mode.\
See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

### `npm run build`

Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.\
Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

### `npm run eject`

**Note: this is a one-way operation. Once you `eject`, you can't go back!**

If you aren't satisfied with the build tool and configuration choices, you can `eject` at any time. This command will remove the single build dependency from your project.

Instead, it will copy all the configuration files and the transitive dependencies (webpack, Babel, ESLint, etc) right into your project so you have full control over them. All of the commands except `eject` will still work, but they will point to the copied scripts so you can tweak them. At this point you're on your own.

You don't have to ever use `eject`. The curated feature set is suitable for small and middle deployments, and you shouldn't feel obligated to use this feature. However we understand that this tool wouldn't be useful if you couldn't customize it when you are ready for it.

## Learn More

You can learn more in the [Create React App documentation](https://facebook.github.io/create-react-app/docs/getting-started).

To learn React, check out the [React documentation](https://reactjs.org/).

### Code Splitting

This section has moved here: [https://facebook.github.io/create-react-app/docs/code-splitting](https://facebook.github.io/create-react-app/docs/code-splitting)

### Analyzing the Bundle Size

This section has moved here: [https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size](https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size)

### Making a Progressive Web App

This section has moved here: [https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app](https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app)

### Advanced Configuration

This section has moved here: [https://facebook.github.io/create-react-app/docs/advanced-configuration](https://facebook.github.io/create-react-app/docs/advanced-configuration)

### Deployment

This section has moved here: [https://facebook.github.io/create-react-app/docs/deployment](https://facebook.github.io/create-react-app/docs/deployment)

### `npm run build` fails to minify

This section has moved here: [https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify](https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify)

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
