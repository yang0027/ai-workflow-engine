const fs = require('fs');
const path = require('path');

const keywords = ['download', 'Download', 'zoom', 'Zoom', '放大', '下载'];
const srcDir = path.join(__dirname, 'src');

console.log(`Scanning: ${srcDir}`);

function walk(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      walk(fullPath);
    } else if (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.js') || file.endsWith('.jsx')) {
      try {
        const content = fs.readFileSync(fullPath, 'utf8');
        const found = [];
        for (const kw of keywords) {
          if (content.includes(kw)) {
            found.append ? found.append(kw) : found.push(kw);
          }
        }
        if (found.length > 0) {
          console.log(`${path.relative(__dirname, fullPath)}: found [${found.join(', ')}]`);
        }
      } catch (err) {
        console.error(`Error reading ${fullPath}: ${err.message}`);
      }
    }
  }
}

walk(srcDir);
