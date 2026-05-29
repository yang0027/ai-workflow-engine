const fs = require('fs');
const path = require('path');

const files = [
  'CustomWorkflowNode.tsx',
  'GridSplitterNode.tsx',
  'PromptSourceNode.tsx',
  'TTSServiceNode.tsx',
  'UploadNode.tsx',
  'VideoFusionNode.tsx'
];

files.forEach(f => {
  const filePath = path.join(__dirname, 'src', 'components', 'nodes', f);
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, 'utf8');
  console.log(`=== ${f} ===`);
  const lines = content.split('\n');
  lines.forEach((line, index) => {
    if (line.includes('<Handle') || line.includes('position={Position') || line.includes('left:') || line.includes('right:')) {
      console.log(`Line ${index + 1}: ${line.trim()}`);
    }
  });
});
