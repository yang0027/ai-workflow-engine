const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'App.tsx');
try {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  
  lines.forEach((l, idx) => {
    if (l.includes('activeFloatingPopup ===') && l.includes('templates')) {
      console.log(`Line ${idx+1}: ${l.trim()}`);
    }
    if (l.includes('templateLargeTab')) {
      console.log(`Line ${idx+1}: ${l.trim()}`);
    }
  });
} catch (e) {
  console.error("Error reading file:", e);
}
