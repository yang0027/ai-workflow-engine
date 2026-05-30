// PurpleGroupNode.logic.ts
// 工作流组节点逻辑控制器

import { useState, useCallback } from 'react';
import { useReactFlow } from '@xyflow/react';

interface UsePurpleGroupLogicProps {
  id: string;
}

export function usePurpleGroupLogic({ id }: UsePurpleGroupLogicProps) {
  const { setNodes, getNodes } = useReactFlow();
  const [showColorPicker, setShowColorPicker] = useState(false);

  // 1. 背景颜色转换器
  const handleSelectColor = useCallback((color: 'purple' | 'blue' | 'green' | 'amber' | 'rose') => {
    setNodes(nds => nds.map(n => n.id === id ? { ...n, data: { ...n.data, bgColor: color } } : n));
    setShowColorPicker(false);
  }, [id, setNodes]);

  // 2. 解组 (物理剥离组容器，但完美保留和自愈重映射子节点)
  const handleUngroup = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const currentNodes = getNodes();
    const groupNode = currentNodes.find(n => n.id === id);
    if (!groupNode) return;
    const groupX = groupNode.position.x;
    const groupY = groupNode.position.y;

    // 将子节点的相对坐标转换为绝对坐标，并删除组容器本身
    setNodes(nds => {
      const filtered = nds.filter(n => n.id !== id);
      return filtered.map(n => {
        if (n.parentId === id) {
          return {
            ...n,
            parentId: undefined,
            extent: undefined,
            position: {
              x: n.position.x + groupX,
              y: n.position.y + groupY
            }
          };
        }
        return n;
      });
    });
  }, [id, getNodes, setNodes]);

  // 3. 智能排版对齐 (横向线性流，自适应扩张外框容器大小)
  const handleLayoutGroup = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const currentNodes = getNodes();
    const children = currentNodes.filter(n => n.parentId === id);
    if (children.length === 0) {
      alert('⚠️ 工作流组内暂无子节点，请先拖入节点后再触发智能对齐排版！');
      return;
    }

    // 按照原来的 X 相对坐标对子节点进行排序，保持用户原有的先后流转意图
    const sorted = [...children].sort((a, b) => a.position.x - b.position.x);

    const gap = 240; // 节点水平间距
    const startX = 60; // 相对起点的左侧 padding
    const startY = 80; // 相对顶部的上侧 padding

    // 一键重映射子节点位置
    setNodes(nds => nds.map(n => {
      if (n.parentId === id) {
        const idx = sorted.findIndex(s => s.id === n.id);
        return {
          ...n,
          position: {
            x: startX + idx * gap,
            y: startY
          }
        };
      }
      return n;
    }));

    // 动态调整组容器宽度与高度以完美收纳子节点
    const newWidth = startX + children.length * gap + 40;
    const newHeight = startY + 260; // 适配 180px 卡片加上下 padding

    setNodes(nds => nds.map(n => {
      if (n.id === id) {
        return {
          ...n,
          width: newWidth,
          height: newHeight,
          style: {
            ...n.style,
            width: newWidth,
            height: newHeight
          }
        };
      }
      return n;
    }));
  }, [id, getNodes, setNodes]);

  // 4. 整组执行
  const handleExecuteGroup = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    window.dispatchEvent(new CustomEvent('run-group-nodes', { detail: { groupId: id } }));
  }, [id]);

  // 5. 打包创建模板
  const handleCreateWorkflow = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    window.dispatchEvent(new CustomEvent('save-group-as-template', { detail: { groupId: id } }));
  }, [id]);

  return {
    showColorPicker,
    setShowColorPicker,
    handleSelectColor,
    handleUngroup,
    handleLayoutGroup,
    handleExecuteGroup,
    handleCreateWorkflow
  };
}
