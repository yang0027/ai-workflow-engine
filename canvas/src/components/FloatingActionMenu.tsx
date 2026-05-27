import React, { useMemo } from 'react';
import { useReactFlow, useStore } from '@xyflow/react';

export interface FloatingActionMenuProps {
  nodes: any[];
  edges: any[];
  onCreateGroup: () => void;
  onSaveAsTemplate: () => void;
}

export const FloatingActionMenu: React.FC<FloatingActionMenuProps> = ({
  nodes,
  edges,
  onCreateGroup,
  onSaveAsTemplate
}) => {
  const { flowToScreenPosition } = useReactFlow();

  // 1. 从 useStore 中实时读取缩放和平移参数，确保在画布移动和缩放时，悬浮框能够动态跟踪对齐
  const transform = useStore((state) => state.transform);

  // 2. 过滤得到所有非组选中的自定义卡片节点
  const selectedNodes = useMemo(() => {
    return nodes.filter(n => n.selected && n.type !== 'purple-group');
  }, [nodes]);

  // 3. 动态计算选中节点的物理包围盒与屏幕绝对定位坐标
  const menuPosition = useMemo(() => {
    if (selectedNodes.length < 2) return null;

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;

    selectedNodes.forEach(n => {
      const x = n.position.x;
      const y = n.position.y;
      // 预估节点宽高以紧贴包围盒，生图等已被强力脱水为 180px
      const w = n.width || 180;
      
      if (x < minX) minX = x;
      if (x + w > maxX) maxX = x + w;
      if (y < minY) minY = y;
    });

    if (minX === Infinity) return null;

    // 计算连线网络顶部中心点
    const topCenterX = minX + (maxX - minX) / 2;
    const topCenterY = minY;

    try {
      // 转换为相对于 viewport container 容器的绝对屏幕像素坐标
      const screenPos = flowToScreenPosition({ x: topCenterX, y: topCenterY });
      return {
        x: screenPos.x,
        y: screenPos.y - 48 // 悬浮在包围盒上方 48px
      };
    } catch (e) {
      return null;
    }
  }, [selectedNodes, flowToScreenPosition, transform]); // 级联关联 transform 以实时跟踪画布位移和缩放

  if (!menuPosition) return null;

  return (
    <div
      className="nodrag"
      onMouseDown={(e) => e.stopPropagation()}
      style={{
        position: 'fixed',
        left: `${menuPosition.x}px`,
        top: `${menuPosition.y}px`,
        transform: 'translateX(-50%)',
        zIndex: 9990, // 高于画布层，低于模态框层
        pointerEvents: 'all',
        animation: 'actionPillFadeIn 0.22s cubic-bezier(0.16, 1, 0.3, 1)'
      }}
    >
      {/* 动画及高质感皮肤定义 */}
      <style>{`
        @keyframes actionPillFadeIn {
          from { opacity: 0; transform: translate(-50%, 8px); }
          to { opacity: 1; transform: translate(-50%, 0); }
        }
        .premium-action-pill {
          display: flex;
          align-items: center;
          gap: 4px;
          background: rgba(11, 15, 26, 0.88);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border: 1px solid rgba(168, 85, 247, 0.35);
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5), 0 0 20px rgba(168, 85, 247, 0.2);
          border-radius: 20px;
          padding: 4px 6px;
          user-select: none;
          transition: all 0.2s;
        }
        .action-pill-btn {
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
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          outline: none;
        }
        .action-pill-btn:hover {
          background: rgba(168, 85, 247, 0.16);
          color: #fff;
          transform: translateY(-1px);
        }
        .action-pill-btn:active {
          transform: translateY(0);
        }
        .action-divider {
          width: 1px;
          height: 14px;
          background: rgba(255, 255, 255, 0.08);
        }
      `}</style>

      <div className="premium-action-pill">
        <button className="action-pill-btn" onClick={onCreateGroup} title="将选中节点打包进虚线组容器中">
          <span>🧬</span> 物理成组
        </button>
        <div className="action-divider" />
        <button className="action-pill-btn" onClick={onSaveAsTemplate} style={{ color: '#c084fc' }} title="将选中节点的参数和连线关系存盘为自建模板">
          <span>💾</span> 打包存为模板
        </button>
      </div>
    </div>
  );
};
