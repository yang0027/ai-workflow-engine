// PurpleGroupNode.tsx
// 工作流组节点 UI 组件

import React from 'react';
import { Handle, Position, NodeResizer } from '@xyflow/react';
import { PurpleGroupNodeProps, THEMES } from './PurpleGroupNode.config';
import { usePurpleGroupLogic } from './PurpleGroupNode.logic';

export default function PurpleGroupNode({ id, data, selected }: PurpleGroupNodeProps) {
  const logic = usePurpleGroupLogic({ id });
  
  const {
    showColorPicker,
    setShowColorPicker,
    handleSelectColor,
    handleUngroup,
    handleLayoutGroup,
    handleExecuteGroup,
    handleCreateWorkflow
  } = logic;

  const activeTheme = data.bgColor || 'purple';
  const theme = THEMES[activeTheme] || THEMES.purple;

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
