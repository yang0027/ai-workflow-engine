const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'App.tsx');
const content = fs.readFileSync(filePath, 'utf8');

const lines = content.split('\n');

lines.forEach((line, index) => {
  if (line.includes('add-success-log')) {
    console.log(`Line ${index + 1}: ${line.trim()}`);
  }
});
