// tools/fetch-templates.js
// Fetches the _LabelerTemplates folder from the external GitHub repo using sparse checkout.
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const REPO = 'https://github.com/sillsdev/sil-map-definitions.git';
const SUBDIR = '_LabelerTemplates';
const DEST = path.join(__dirname, '..', 'buildResources', '_LabelerTemplates');

function run(cmd, opts = {}) {
  console.log(`$ ${cmd}`);
  execSync(cmd, { stdio: 'inherit', ...opts });
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

(function main() {
  ensureDir(DEST);
  const tmp = path.join(__dirname, '..', '.tmp-templates');
  if (fs.existsSync(tmp)) {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  ensureDir(tmp);
  process.chdir(tmp);

  // Use sparse-checkout to only fetch the needed folder
  run(`git init`);
  run(`git remote add origin ${REPO}`);
  run(`git config core.sparseCheckout true`);
  const sparseFile = path.join(tmp, '.git', 'info', 'sparse-checkout');
  fs.writeFileSync(sparseFile, `${SUBDIR}\n`);
  run(`git pull --depth=1 origin main`);

  const src = path.join(tmp, SUBDIR);
  if (!fs.existsSync(src)) {
    console.error(`Failed to fetch ${SUBDIR} from repo.`);
    process.exit(1);
  }

  // Copy into buildResources/_LabelerTemplates
  run(`cp -R "${src}" "${DEST}"`);

  // Clean up
  process.chdir(path.join(__dirname, '..'));
  fs.rmSync(tmp, { recursive: true, force: true });

  console.log(`Templates fetched to ${DEST}`);
})();
