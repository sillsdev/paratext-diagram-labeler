# Contributing

Thanks for your interest in contributing! Please follow these guidelines:

## Development
- Clone the repo and install dependencies with `npm install`.
- Run the app in development with `npm run dev-mode`.
- Lint and test before submitting changes: `npm test`.

## Pull Requests
- Create a feature branch off the default branch.
- Keep PRs focused and small when possible.
- Include screenshots or videos for UI changes.
- Ensure CI passes.

## Commit Style
- Use clear commit messages.
- Reference issues where applicable (e.g., "Fixes #123").

## Building installers
Installers are build on Github Actions with every push to master and with every release.

## Release process
First update the submodule as follows:

`git submodule update --remote resources`

`git add resources`

`git commit -m "Update sil-map-definitions submodule to latest commit" || echo "No submodule update needed"`

`git push`

Tag a commit on master with the version number convention vX.X.X and push that tag
e.g. `git tag v0.1.0 && git push origin v0.1.0`
This will build the installers and create a draft release.  You manually mark the release as published by editing the description and click "Publish"

## Reporting Issues
- Use the issue templates and include steps to reproduce, expected vs actual behavior, and environment details.

## Contact
Questions? Open an issue or email paratextdiagramlabeler@gmail.com .
