const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'components', 'nodes', 'VideoFusionNode.tsx');
try {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  
  console.log("=== Lines 810 to 880 ===");
  for (let i = 810; i <= 880; i++) {
    console.log(`${i}: ${lines[i-1]}`);
  }
} catch (e) {
  console.error("Error reading file:", e);
}
