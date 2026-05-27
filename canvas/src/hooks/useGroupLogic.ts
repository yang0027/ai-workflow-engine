import { useCallback } from 'react';
import { Node } from '@xyflow/react';

/**
 * AI 智能画布节点一键组合/拆解层级逻辑自定义 Hook (对标 n8n 分组)
 */
export function useGroupLogic(
  nodes: Node[],
  setNodes: React.Dispatch<React.SetStateAction<Node[]>>
) {
  // A1. 组合选中节点为 Group 容器 (对标 n8n 分组)
  const handleCreateGroupFromSelected = useCallback(() => {
    const selectedNodes = nodes.filter(n => n.selected && n.type !== 'purple-group');
    if (selectedNodes.length === 0) {
      alert('💡 请先在画布上框选或按住 Shift 多选要组合的节点！');
      return;
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    selectedNodes.forEach(node => {
      // 计算绝对坐标 (处理可能已经存在的层级嵌套)
      let absX = node.position.x;
      let absY = node.position.y;
      let curr = node;
      while (curr.parentId) {
        const parent = nodes.find(n => n.id === curr.parentId);
        if (parent) {
          absX += parent.position.x;
          absY += parent.position.y;
          curr = parent;
        } else {
          break;
        }
      }

      // 获取节点测量出来的宽高，如无则使用兜底值
      const w = node.measured?.width ?? node.width ?? 280;
      const h = node.measured?.height ?? node.height ?? 220;

      minX = Math.min(minX, absX);
      minY = Math.min(minY, absY);
      maxX = Math.max(maxX, absX + w);
      maxY = Math.max(maxY, absY + h);
    });

    const paddingX = 50;
    const paddingY = 50;
    const titlePaddingY = 30; // 顶部由于有标题栏，稍微留出一些空间

    const groupX = minX - paddingX;
    const groupY = minY - paddingY - titlePaddingY;
    const groupW = (maxX - minX) + (paddingX * 2);
    const groupH = (maxY - minY) + (paddingY * 2) + titlePaddingY;

    const groupId = `group-${Date.now()}`;

    const newGroupNode = {
      id: groupId,
      type: 'purple-group',
      position: { x: groupX, y: groupY },
      width: groupW,
      height: groupH,
      style: { width: groupW, height: groupH },
      data: {
        label: '🎬 AI 智能工作流组'
      }
    };

    // 更新选中节点的相对坐标与 parentId
    const updatedNodes = nodes.map(n => {
      const isSelected = selectedNodes.some(sn => sn.id === n.id);
      if (isSelected) {
        // 计算绝对坐标
        let absX = n.position.x;
        let absY = n.position.y;
        let curr = n;
        while (curr.parentId) {
          const parent = nodes.find(p => p.id === curr.parentId);
          if (parent) {
            absX += parent.position.x;
            absY += parent.position.y;
            curr = parent;
          } else {
            break;
          }
        }

        const relX = absX - groupX;
        const relY = absY - groupY;

        return {
          ...n,
          parentId: groupId,
          extent: 'parent' as const,
          position: { x: relX, y: relY },
          selected: false
        };
      }
      return n;
    });

    setNodes([newGroupNode, ...updatedNodes]);
  }, [nodes, setNodes]);

  // A2. 拆解/解散 Group 容器
  const handleUngroup = useCallback((groupId: string) => {
    const groupNode = nodes.find(n => n.id === groupId);
    if (!groupNode) return;

    if (!confirm('确定解散并拆分该工作流组吗？(组内的所有子节点将被还原为常规绝对定位节点)')) return;

    const groupX = groupNode.position.x;
    const groupY = groupNode.position.y;

    const updatedNodes = nodes.map(n => {
      if (n.parentId === groupId) {
        // 将相对坐标恢复为绝对坐标
        const absX = n.position.x + groupX;
        const absY = n.position.y + groupY;

        return {
          ...n,
          parentId: undefined,
          extent: undefined,
          position: { x: absX, y: absY }
        };
      }
      return n;
    });

    const finalNodes = updatedNodes.filter(n => n.id !== groupId);
    setNodes(finalNodes);
  }, [nodes, setNodes]);

  return {
    handleCreateGroupFromSelected,
    handleUngroup
  };
}
