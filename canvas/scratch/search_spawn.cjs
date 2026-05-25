const fs = require('fs');
const path = require('path');

const appPath = path.join(__dirname, '..', 'src', 'App.tsx');
console.log('App.tsx path:', appPath);
if (fs.existsSync(appPath)) {
  const content = fs.readFileSync(appPath, 'utf8');
  const lines = content.split('\n');
  console.log('Total lines:', lines.length);
  lines.forEach((line, idx) => {
    if (line.toLowerCase().includes('spawn') || line.toLowerCase().includes('linked') || line.toLowerCase().includes('window.')) {
      console.log(`Line ${idx + 1}: ${line.trim()}`);
    }
  });
} else {
  console.log('App.tsx does not exist!');
}
