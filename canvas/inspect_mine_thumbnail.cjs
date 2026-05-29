const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'App.tsx');
try {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  
  console.log("=== Lines 4310 to 4345 ===");
  for (let i = 4310; i <= 4345; i++) {
    console.log(`${i}: ${lines[i-1]}`);
  }
} catch (e) {
  console.error("Error reading file:", e);
}
