const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'src', 'components', 'nodes', 'ImageServiceNode.tsx');
if (fs.existsSync(filePath)) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  console.log('Total lines:', lines.length);
  lines.forEach((line, idx) => {
    if (line.includes('return (') && idx > 500) {
      console.log(`Line ${idx + 1}: ${line.trim()}`);
    }
  });
} else {
  console.log('File does not exist!');
}
