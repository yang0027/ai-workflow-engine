import React from 'react';
import { useReactFlow, Handle, Position } from '@xyflow/react';

interface PurpleGroupNodeProps {
  id: string;
  data: {
    label?: string;
  };
  selected?: boolean;
}

export default function PurpleGroupNode({ id, data, selected }: PurpleGroupNodeProps) {
  const { deleteElements } = useReactFlow();

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('确认删除整个工作流组容器吗？(子节点不会被一同物理删除，除非手动框选)')) {
      deleteElements({ nodes: [{ id }] });
    }
  };

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        background: 'rgba(168, 85, 247, 0.02)',
        border: selected 
          ? '2px dashed rgba(168, 85, 247, 0.85)' 
          : '2px dashed rgba(168, 85, 247, 0.35)',
        boxShadow: selected 
          ? 'inset 0 0 20px rgba(168, 85, 247, 0.15), 0 0 30px rgba(168, 85, 247, 0.2)' 
          : 'inset 0 0 10px rgba(168, 85, 247, 0.05)',
        borderRadius: '16px',
        position: 'relative',
        pointerEvents: 'none', // 穿透交互，使得用户可以直接点击拖拽内部的子节点
        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
      }}
    >
      {/* 顶部悬浮的标签标题栏 - 可穿透交互放开以便于拖拽和删除整个 Group */}
      <div
        className="nodrag"
        style={{
          position: 'absolute',
          top: '-16px',
          left: '20px',
          background: 'linear-gradient(135deg, rgba(88, 28, 135, 0.9), rgba(124, 58, 237, 0.9))',
          border: '1px solid rgba(168, 85, 247, 0.4)',
          boxShadow: '0 4px 12px rgba(168, 85, 247, 0.3)',
          borderRadius: '20px',
          padding: '4px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          color: '#ffffff',
          fontSize: '11px',
          fontWeight: '600',
          letterSpacing: '0.5px',
          pointerEvents: 'all', // 恢复交互
          zIndex: 10,
        }}
      >
        <span>{data.label || '🎬 AI 智能工作流组'}</span>
        <button
          onClick={handleDelete}
          style={{
            background: 'rgba(255, 255, 255, 0.15)',
            border: 'none',
            color: '#fff',
            width: '16px',
            height: '16px',
            borderRadius: '50%',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '9px',
            transition: 'background 0.2s',
            padding: 0,
            marginLeft: '4px',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(239, 68, 68, 0.8)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
          }}
          title="删除组外框"
        >
          ×
        </button>
      </div>

      {/* 组输出组合管道接口 */}
      <Handle
        type="source"
        position={Position.Right}
        id="group-output"
        style={{
          width: '24px',
          height: '24px',
          background: 'rgba(15, 23, 42, 0.95)',
          border: '2.5px solid rgba(168, 85, 247, 1)',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          cursor: 'crosshair',
          boxShadow: '0 0 15px rgba(168, 85, 247, 0.75)',
          fontWeight: 'bold',
          fontSize: '13px',
          right: '-12px',
          top: '50%',
          transform: 'translateY(-50%)',
          position: 'absolute',
          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
          zIndex: 50,
          pointerEvents: 'all' // 强行恢复交互
        }}
      >
        🧬
      </Handle>
    </div>
  );
}
