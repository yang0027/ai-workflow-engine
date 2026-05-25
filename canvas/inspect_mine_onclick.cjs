const fs = require('fs');
const path = require('path');

const filePath = path.resolve('gateway', 'src', 'app.ts');
console.log('Resolving path:', filePath);
if (fs.existsSync(filePath)) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  lines.forEach((line, index) => {
    if (line.includes('app.get') || line.includes('download') || line.includes('proxy') || line.includes('/api/')) {
      console.log(`Line ${index + 1}: ${line.trim()}`);
    }
  });
} else {
  console.log('Not found');
}
