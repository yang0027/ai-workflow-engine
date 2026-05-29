const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'components', 'nodes', 'PromptSourceNode.tsx');
const content = fs.readFileSync(filePath, 'utf8');

const lines = content.split('\n');

lines.forEach((line, index) => {
  if (line.includes('selected') || line.includes('text') || line.includes('ActiveSubPanel') || line.includes('activeTab') || line.includes('showTextPanel')) {
    console.log(`Line ${index + 1}: ${line.trim()}`);
  }
});
