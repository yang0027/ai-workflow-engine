const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'canvas/src/App.tsx');
let content = fs.readFileSync(file, 'utf8');

// 统一 Windows 与 Linux 换行符
content = content.replace(/\r\n/g, '\n');

// 替换 handleOpenLargeModal 里的冗余引用 (使用无缩进的精准方法)
const openModalIndex = content.indexOf('handleOpenLargeModal = (e: Event) => {');
const openModalEndIndex = content.indexOf("handleOpenSettings = (e: Event) => {");

if (openModalIndex !== -1 && openModalEndIndex !== -1 && openModalIndex < openModalEndIndex) {
  // 向上寻找该行开始的缩进 'const '
  let startPos = openModalIndex;
  while (startPos > 0 && content.substring(startPos - 6, startPos) !== 'const ') {
    startPos--;
  }
  startPos -= 6; // 包含 'const '
  // 继续向左包含它的缩进空格
  while (startPos > 0 && (content[startPos - 1] === ' ' || content[startPos - 1] === '\t')) {
    startPos--;
  }

  let endPos = openModalEndIndex;
  while (endPos > 0 && content.substring(endPos - 6, endPos) !== 'const ') {
    endPos--;
  }
  endPos -= 6; // 包含 'const '
  // 继续向左包含它的缩进空格
  while (endPos > 0 && (content[endPos - 1] === ' ' || content[endPos - 1] === '\t')) {
    endPos--;
  }

  content = content.substring(0, startPos) + 
`    const handleOpenLargeModal = (e: Event) => {
      const customEvent = e as CustomEvent;
      const { tab, nodeTarget, type } = customEvent.detail || {};
      
      let targetTab: any = tab;
      if (tab === 'workflows') {
        targetTab = 'templates';
      }
      
      setActiveFloatingPopup(targetTab);
      setModalNodeTarget(nodeTarget || null);
      setModalMediaType(type || null);
    };\n\n` + content.substring(endPos);
  
  fs.writeFileSync(file, content, 'utf8');
  console.log("Success! App.tsx handleOpenLargeModal cleaned and setAssetLargeTab references completely removed!");
} else {
  console.log("Error: Could not locate handleOpenLargeModal or handleOpenSettings!");
}
