const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'components', 'nodes', 'image-sub-components', 'ConfigPanel.tsx');
const content = fs.readFileSync(filePath, 'utf8');

const lines = content.split('\n');

lines.forEach((line, index) => {
  if (line.includes('refImages.map') || line.includes('画廊') || line.includes('参考图') || line.includes('gallery')) {
    console.log(`Line ${index + 1}: ${line.trim()}`);
  }
});
