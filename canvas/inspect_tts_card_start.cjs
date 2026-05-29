const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'components', 'nodes', 'TTSServiceNode.tsx');
try {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  
  console.log("=== Lines 880 to 920 ===");
  for (let i = 880; i <= 920; i++) {
    console.log(`${i}: ${lines[i-1]}`);
  }
} catch (e) {
  console.error("Error reading file:", e);
}
