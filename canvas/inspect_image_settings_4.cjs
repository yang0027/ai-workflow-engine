const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'components', 'nodes', 'image-sub-components', 'useImageNodeLogic.ts');
const content = fs.readFileSync(filePath, 'utf8');

const lines = content.split('\n');

lines.forEach((line, index) => {
  if (line.toLowerCase().includes('connectedprompt')) {
    console.log(`Line ${index + 1}: ${line.trim()}`);
  }
});
