const fs = require('fs');
const path = require('path');

const appPath = path.join(__dirname, 'src', 'App.tsx');
const content = fs.readFileSync(appPath, 'utf8');

const lines = content.split('\n');

let output = '';
function findLines(keyword) {
  output += `=== Matches for: ${keyword} ===\n`;
  lines.forEach((line, index) => {
    if (line.toLowerCase().includes(keyword.toLowerCase())) {
      output += `Line ${index + 1}: ${line.trim()}\n`;
    }
  });
}

findLines('download');
findLines('historyAssets');
findLines('zoom');
findLines('放大');
findLines('history');

fs.writeFileSync(path.join(__dirname, 'output.txt'), output, 'utf8');
console.log('Done writing output.txt');
