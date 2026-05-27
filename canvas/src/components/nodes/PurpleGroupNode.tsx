import React, { useState } from 'react';
import { useReactFlow, Handle, Position, NodeResizer } from '@xyflow/react';

interface PurpleGroupNodeProps {
  id: string;
  data: {
    label?: string;
    bgColor?: 'purple' | 'blue' | 'green' | 'amber' | 'rose';
  };
  selected?: boolean;
}

const THEMES = {
  purple: {
    bg: 'rgba(168, 85, 247, 0.025)',
    border: 'rgba(168, 85, 247, 0.35)',
    borderActive: 'rgba(168, 85, 247, 0.85)',
    glow: 'rgba(168, 85, 247, 0.15)',
    text: 'rgba(168, 85, 247, 1)',
    dot: '#a855f7',
    name: '经典黛紫'
  },
  blue: {
    bg: 'rgba(59, 130, 246, 0.025)',
    border: 'rgba(59, 130, 246, 0.35)',
    borderActive: 'rgba(59, 130, 246, 0.85)',
    glow: 'rgba(59, 130, 246, 0.15)',
    text: 'rgba(59, 130, 246, 1)',
    dot: '#3b82f6',
    name: '极客科技蓝'
  },
  green: {
    bg: 'rgba(16, 185, 129, 0.025)',
    border: 'rgba(16, 185, 129, 0.35)',
    borderActive: 'rgba(16, 185, 129, 0.85)',
    glow: 'rgba(16, 185, 129, 0.15)',
    text: 'rgba(16, 185, 129, 1)',
    dot: '#10b981',
    name: '北极极光绿'
  },
  amber: {
    bg: 'rgba(245, 158, 11, 0.025)',
    border: 'rgba(245, 158, 11, 0.35)',
    borderActive: 'rgba(245, 158, 11, 0.85)',
    glow: 'rgba(245, 158, 11, 0.15)',
    text: 'rgba(245, 158, 11, 1)',
    dot: '#f59e0b',
    name: '落日琥珀黄'
  },
  rose: {
    bg: 'rgba(244, 63, 94, 0.025)',
    border: 'rgba(244, 63, 94, 0.35)',
    borderActive: 'rgba(244, 63, 94, 0.85)',
    glow: 'rgba(244, 63, 94, 0.15)',
    text: 'rgba(244, 63, 94, 1)',
    dot: '#f43f5e',
    name: '浅绯珊瑚粉'
  }
};

export default function PurpleGroupNode({ id, data, selected }: PurpleGroupNodeProps) {
  const { setNodes, getNodes } = useReactFlow();
  const [showColorPicker, setShowColorPicker] = useState(false);

  const activeTheme = data.bgColor || 'purple';
  const theme = THEMES[activeTheme] || THEMES.purple;

  // 1. 背景颜色转换器
  const handleSelectColor = (color: 'purple' | 'blue' | 'green' | 'amber' | 'rose') => {
    setNodes(nds => nds.map(n => n.id === id ? { ...n, data: { ...n.data, bgColor: color } } : n));
    setShowColorPicker(false);
  };

  // 2. 解组 (物理剥离组容器，但完美保留和自愈重映射子节点)
  const handleUngroup = (e: React.MouseEvent) => {
    e.stopPropagation();
    const currentNodes = getNodes();
    const groupNode = currentNodes.find(n => n.id === id);
    if (!groupNode) return;
    const groupX = groupNode.position.x;
    const groupY = groupNode.position.y;

    const children = currentNodes.filter(n => n.parentId === id);

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
  };

  // 3. 智能排版对齐 (横向线性流，自适应扩张外框容器大小)
  const handleLayoutGroup = (e: React.MouseEvent) => {
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
  };

  // 4. 整组执行
  const handleExecuteGroup = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.dispatchEvent(new CustomEvent('run-group-nodes', { detail: { groupId: id } }));
  };

  // 5. 打包创建模板
  const handleCreateWorkflow = (e: React.MouseEvent) => {
    e.stopPropagation();
    window.dispatchEvent(new CustomEvent('save-group-as-template', { detail: { groupId: id } }));
  };

  const handleStyle: React.CSSProperties = {
    width: '24px',
    height: '24px',
    background: 'rgba(15, 23, 42, 0.98)',
    border: `2px solid ${theme.text}`,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
    cursor: 'crosshair',
    boxShadow: `0 0 15px ${theme.glow}`,
    fontWeight: 'bold',
    fontSize: '14px',
    top: '50%',
    transform: 'translateY(-50%)',
    position: 'absolute',
    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
    zIndex: 50,
  };

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        background: theme.bg,
        border: selected 
          ? `2px dashed ${theme.borderActive}` 
          : `2px dashed ${theme.border}`,
        boxShadow: selected 
          ? `inset 0 0 20px ${theme.glow}, 0 0 30px ${theme.glow}` 
          : `inset 0 0 10px rgba(255,255,255,0.01)`,
        borderRadius: '16px',
        position: 'relative',
        pointerEvents: 'none', // 穿透交互，使得用户可以直接拖拽框选内部节点
        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
      }}
    >
      {/* 🚀 高保真 corner 和 edge 缩放手柄，强行恢复 pointerEvents */}
      <NodeResizer 
        color={theme.dot} 
        minWidth={150} 
        minHeight={150} 
        isVisible={!!selected} 
        handleStyle={{ 
          width: '10px', 
          height: '10px', 
          borderRadius: '50%', 
          background: '#fff', 
          border: `2.5px solid ${theme.dot}`, 
          pointerEvents: 'all' 
        }}
        lineStyle={{ 
          borderWidth: '1.5px', 
          borderStyle: 'dashed', 
          borderColor: theme.dot, 
          pointerEvents: 'all' 
        }}
      />

      {/* 🔮 选中后动态浮现的 capsule 小药丸悬浮工具栏 */}
      {selected && (
        <div
          className="nodrag"
          onMouseDown={(e) => e.stopPropagation()}
          style={{
            position: 'absolute',
            top: '-50px',
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            alignItems: 'center',
            gap: '3px',
            background: 'rgba(11, 15, 26, 0.92)',
            backdropFilter: 'blur(16px)',
            border: '1.2px solid rgba(255, 255, 255, 0.12)',
            borderRadius: '24px',
            padding: '4px 6px',
            boxShadow: '0 12px 40px rgba(0, 0, 0, 0.65), 0 0 20px rgba(168, 85, 247, 0.15)',
            zIndex: 100,
            pointerEvents: 'all',
            userSelect: 'none',
            whiteSpace: 'nowrap'
          }}
        >
          <style>{`
            .group-toolbar-btn {
              background: transparent;
              border: none;
              color: rgba(255, 255, 255, 0.85);
              font-size: 11px;
              font-weight: 700;
              padding: 6px 12px;
              border-radius: 14px;
              cursor: pointer;
              display: flex;
              align-items: center;
              gap: 6px;
              transition: all 0.2s;
              outline: none;
            }
            .group-toolbar-btn:hover {
              background: rgba(255, 255, 255, 0.08);
              color: #fff;
              transform: translateY(-1px);
            }
            .group-toolbar-btn:active {
              transform: translateY(0);
            }
            .group-divider {
              width: 1px;
              height: 14px;
              background: rgba(255, 255, 255, 0.08);
            }
            .color-dot-btn {
              width: 16px;
              height: 16px;
              border-radius: 50%;
              border: 1.5px solid rgba(255, 255, 255, 0.25);
              cursor: pointer;
              transition: transform 0.2s;
            }
            .color-dot-btn:hover {
              transform: scale(1.2);
              border-color: #fff;
            }
          `}</style>

          {/* 1. ⭕ 颜色选择器 */}
          <div style={{ position: 'relative' }}>
            <button className="group-toolbar-btn" onClick={() => setShowColorPicker(!showColorPicker)}>
              <span style={{ color: theme.dot }}>●</span> 选区背景
            </button>
            {showColorPicker && (
              <div
                style={{
                  position: 'absolute',
                  top: '36px',
                  left: '12px',
                  background: 'rgba(11, 15, 26, 0.98)',
                  backdropFilter: 'blur(20px)',
                  border: '1.2px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: '12px',
                  padding: '8px 12px',
                  display: 'flex',
                  gap: '8px',
                  boxShadow: '0 8px 30px rgba(0, 0, 0, 0.8)',
                  zIndex: 200,
                  alignItems: 'center'
                }}
              >
                {Object.entries(THEMES).map(([key, t]) => (
                  <button
                    key={key}
                    className="color-dot-btn"
                    style={{ background: t.dot }}
                    onClick={() => handleSelectColor(key as any)}
                    title={t.name}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="group-divider" />

          {/* 2. 㗊 智能对齐 */}
          <button className="group-toolbar-btn" onClick={handleLayoutGroup} title="自动规整并水平排列组内所有子节点">
            <span>㗊</span> 智能排版
          </button>

          <div className="group-divider" />

          {/* 3. ▶️ 整组执行 (高亮绿色) */}
          <button className="group-toolbar-btn" onClick={handleExecuteGroup} style={{ color: '#10b981' }} title="仅执行该组内的节点管线">
            <span>▶️</span> 整组执行
          </button>

          <div className="group-divider" />

          {/* 4. 📄 打包创建工作流 */}
          <button className="group-toolbar-btn" onClick={handleCreateWorkflow} title="将当前组内的节点组合存为画布模板">
            <span>📄</span> 创建工作流
          </button>

          <div className="group-divider" />

          {/* 5. 㗊 解组 */}
          <button className="group-toolbar-btn" onClick={handleUngroup} style={{ color: '#f43f5e' }} title="解组容器 (仅去掉虚线框，子节点物理安全保留)">
            <span>㗊</span> 解组
          </button>
        </div>
      )}

      {/* 🏷️ 非选中状态下展示的简洁顶部标签 */}
      {!selected && (
        <div
          style={{
            position: 'absolute',
            top: '-16px',
            left: '20px',
            background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(30, 41, 59, 0.95))',
            border: `1.2px solid ${theme.border}`,
            borderRadius: '20px',
            padding: '4px 12px',
            color: '#ffffff',
            fontSize: '11px',
            fontWeight: '700',
            letterSpacing: '0.5px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
            zIndex: 10
          }}
        >
          <span>{data.label || '🎬 AI 智能工作流组'}</span>
        </div>
      )}

      {/* ＋ 双向漂亮物理连线手柄 (仅选中可见) */}
      <Handle
        type="target"
        position={Position.Left}
        id="group-input"
        style={{
          ...handleStyle,
          left: '-12px',
          opacity: selected ? 1 : 0,
          pointerEvents: selected ? 'all' : 'none',
          visibility: selected ? 'visible' : 'hidden'
        }}
      >
        ＋
      </Handle>

      <Handle
        type="source"
        position={Position.Right}
        id="group-output"
        style={{
          ...handleStyle,
          right: '-12px',
          opacity: selected ? 1 : 0,
          pointerEvents: selected ? 'all' : 'none',
          visibility: selected ? 'visible' : 'hidden'
        }}
      >
        ＋
      </Handle>
    </div>
  );
}
