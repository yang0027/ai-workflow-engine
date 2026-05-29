const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'components', 'nodes', 'UploadNode.tsx');
const content = fs.readFileSync(filePath, 'utf8');

const lines = content.split('\n');

lines.forEach((line, index) => {
  if (line.toLowerCase().includes('fullscreen') || line.toLowerCase().includes('放大') || line.toLowerCase().includes('preview')) {
    console.log(`Line ${index + 1}: ${line.trim()}`);
  }
});
