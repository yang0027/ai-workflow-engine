const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'components', 'nodes', 'TTSServiceNode.tsx');
try {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  console.log(`Total lines: ${lines.length}`);
  const start = 1120;
  const end = 1250;
  for (let i = start; i <= end; i++) {
    console.log(`${i}: ${lines[i - 1]}`);
  }
} catch (e) {
  console.error("Error reading file:", e);
}
