const fs = require('fs');
const path = require('path');

const appPath = path.join(__dirname, 'src', 'App.tsx');
const content = fs.readFileSync(appPath, 'utf8');

const lines = content.split('\n');

function findLines(keyword) {
  console.log(`=== Matches for: ${keyword} ===`);
  lines.forEach((line, index) => {
    if (line.toLowerCase().includes(keyword.toLowerCase())) {
      console.log(`Line ${index + 1}: ${line.trim()}`);
    }
  });
}

findLines('download');
findLines('historyAssets');
findLines('zoom');
findLines('放大');
