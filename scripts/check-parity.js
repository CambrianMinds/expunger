const fs = require('fs');
const path = require('path');

const parityMap = [
  { ext: 'extension/eligibility.js', app: 'docs/app/eligibility.js' },
  { ext: 'extension/content.js', app: 'docs/app/content.js' },
  { ext: 'extension/sidepanel/county-directory.js', app: 'docs/app/county-directory.js' },
  { ext: 'extension/sidepanel/pdf-generator.js', app: 'docs/app/pdf-generator.js' },
  { ext: 'extension/sidepanel/profile.js', app: 'docs/app/profile.js' },
  { ext: 'extension/sidepanel/state.js', app: 'docs/app/state.js' },
  { ext: 'extension/sidepanel/ui.js', app: 'docs/app/ui.js' },
  { ext: 'extension/sidepanel/utils.js', app: 'docs/app/utils.js' },
  { ext: 'extension/sidepanel/i18n.js', app: 'docs/app/i18n.js' }
];

// Note: generator.js and scanner.js and main.js might have environment specific code, 
// wait, the user rules say: "They share near-identical ES6 module sub-folders"
// "Logic changes that touch eligibility, PDF generation, county data, scanner, profile, or state must be applied to both trees."
// So we should check those files too, maybe scanner.js is fully identical?
// I will check the parity manually first before deciding which files to enforce strict parity on.

let allMatch = true;

for (const pair of parityMap) {
  const extPath = path.resolve(__dirname, '..', pair.ext);
  const appPath = path.resolve(__dirname, '..', pair.app);
  
  if (!fs.existsSync(extPath) || !fs.existsSync(appPath)) {
    console.error(`Missing file in parity pair: ${pair.ext} or ${pair.app}`);
    allMatch = false;
    continue;
  }

  const extContent = fs.readFileSync(extPath, 'utf8');
  const appContent = fs.readFileSync(appPath, 'utf8');

  if (extContent !== appContent) {
    console.error(`PARITY FAILURE: ${pair.ext} and ${pair.app} do not match!`);
    allMatch = false;
  }
}

if (!allMatch) {
  console.error('\nParity check failed. Please ensure shared logic files are identical between the extension and the web app.');
  process.exit(1);
} else {
  console.log('Parity check passed: Shared files are identical.');
  process.exit(0);
}
