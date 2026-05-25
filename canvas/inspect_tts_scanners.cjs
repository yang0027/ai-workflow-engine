const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'components', 'nodes', 'tts-sub-components', 'useTTSNodeLogic.ts');
const content = fs.readFileSync(filePath, 'utf8');

const lines = content.split('\n');

lines.forEach((line, index) => {
  if (line.includes('add-success-log') || line.includes('dispatchEvent') || line.includes('output') || line.includes('audio')) {
    console.log(`Line ${index + 1}: ${line.trim()}`);
  }
});
