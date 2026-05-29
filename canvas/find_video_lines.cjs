const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'components', 'nodes', 'VideoFusionNode.tsx');
try {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  
  lines.forEach((l, idx) => {
    if (l.includes('🎬 图生视频') || l.includes('🎞️ 首尾帧视频')) {
      console.log(`Line ${idx+1}: ${l.trim()}`);
    }
  });
} catch (e) {
  console.error("Error reading file:", e);
}
