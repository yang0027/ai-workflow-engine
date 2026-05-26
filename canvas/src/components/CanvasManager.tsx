import React, { useState, useEffect } from 'react';

interface CanvasInfo {
  id: string;
  name: string;
  updatedAt: string;
  deletedAt?: string | null;
}

interface CanvasManagerProps {
  isOpen: boolean;
  onClose: () => void;
  currentCanvasId: string | null;
  onSwitch: (id: string, canvas: CanvasInfo) => void;
  onNew: () => void;
  onRename: (id: string, currentName: string) => void;
  onDelete: (id: string) => void;
  onRestore: (id: string) => void;
  onPermanentDelete?: (id: string) => void;
  onShowSnapshots?: (canvasId: string) => void;  // 查看快照
}

const API_BASE = 'http://localhost:4000/api/v1';

export function CanvasManager({
  isOpen,
  onClose,
  currentCanvasId,
  onSwitch,
  onNew,
  onRename,
  onDelete,
  onRestore,
  onPermanentDelete,
  onShowSnapshots
}: CanvasManagerProps) {
  const [canvasList, setCanvasList] = useState<CanvasInfo[]>([]);
  const [deletedCanvases, setDeletedCanvases] = useState<CanvasInfo[]>([]);
  const [showDeleted, setShowDeleted] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadCanvases();
    }
  }, [isOpen]);

  const loadCanvases = async () => {
    setLoading(true);
    try {
      const [normalRes, deletedRes] = await Promise.all([
        fetch(`${API_BASE}/canvases`),
        fetch(`${API_BASE}/canvases/deleted`)
      ]);
      const normalData = await normalRes.json();
      const deletedData = await deletedRes.json();
      setCanvasList(normalData.canvases || []);
      setDeletedCanvases(deletedData.canvases || []);
    } catch (err) {
      console.error('Failed to load canvases:', err);
    }
    setLoading(false);
  };

  const handleSwitch = async (id: string) => {
    try {
      const res = await fetch(`${API_BASE}/canvases/${id}`);
      const data = await res.json();
      if (data.canvas) {
        onSwitch(id, data.canvas);
      }
    } catch (err) {
      console.error('Failed to load canvas:', err);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(4px)',
        zIndex: 9000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="glass-panel"
        style={{
          width: '480px',
          maxHeight: '70vh',
          padding: '20px',
          borderRadius: '16px',
          background: 'rgba(11, 15, 25, 0.95)',
          border: '1px solid rgba(255,255,255,0.1)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
          animation: 'fadeIn 0.2s'
        }}
      >
        {/* 头部 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#fff' }}>📋 画布管理</h3>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => { onNew(); setTimeout(loadCanvases, 100); }}
              style={{
                padding: '6px 12px',
                fontSize: '12px',
                borderRadius: '6px',
                border: '1px solid hsl(var(--accent-primary) / 0.5)',
                background: 'hsl(var(--accent-primary) / 0.1)',
                color: '#fff',
                cursor: 'pointer'
              }}
            >
              + 新建画布
            </button>
            <button
              onClick={onClose}
              style={{
                padding: '6px 12px',
                fontSize: '12px',
                borderRadius: '6px',
                border: 'none',
                background: 'rgba(255,255,255,0.1)',
                color: '#fff',
                cursor: 'pointer'
              }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* 加载状态 */}
        {loading && (
          <div style={{ textAlign: 'center', padding: '20px', color: 'rgba(255,255,255,0.5)' }}>
            加载中...
          </div>
        )}

        {/* 画布列表 */}
        {!loading && (
          <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
            {canvasList.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: 'rgba(255,255,255,0.5)' }}>
                <p style={{ margin: '0 0 12px 0' }}>暂无画布</p>
                <p style={{ margin: 0, fontSize: '12px' }}>点击上方"新建画布"开始创作</p>
              </div>
            ) : (
              canvasList.map((canvas) => (
                <CanvasItem
                  key={canvas.id}
                  canvas={canvas}
                  isActive={canvas.id === currentCanvasId}
                  onSelect={() => handleSwitch(canvas.id)}
                  onRename={() => onRename(canvas.id, canvas.name)}
                  onDelete={() => { onDelete(canvas.id); setTimeout(loadCanvases, 100); }}
                  onShowSnapshots={onShowSnapshots ? () => onShowSnapshots(canvas.id) : undefined}
                />
              ))
            )}
          </div>
        )}

        {/* 回收站 */}
        {!loading && deletedCanvases.length > 0 && (
          <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
            <div
              onClick={() => setShowDeleted(!showDeleted)}
              style={{
                fontSize: '12px',
                color: 'rgba(255,255,255,0.5)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                marginBottom: showDeleted ? '12px' : '0'
              }}
            >
              🗑️ 回收站 ({deletedCanvases.length})
              <span style={{ transform: showDeleted ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }}>▶</span>
            </div>
            {showDeleted && deletedCanvases.map((canvas) => (
              <DeletedCanvasItem
                key={canvas.id}
                canvas={canvas}
                onRestore={() => { onRestore(canvas.id); setTimeout(loadCanvases, 100); }}
                onPermanentDelete={onPermanentDelete ? () => { onPermanentDelete(canvas.id); setTimeout(loadCanvases, 100); } : undefined}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// 画布项组件
function CanvasItem({
  canvas,
  isActive,
  onSelect,
  onRename,
  onDelete,
  onShowSnapshots
}: {
  canvas: CanvasInfo;
  isActive: boolean;
  onSelect: () => void;
  onRename: () => void;
  onDelete: () => void;
  onShowSnapshots?: () => void;
}) {
  return (
    <div
      onClick={onSelect}
      style={{
        padding: '12px 14px',
        marginBottom: '8px',
        borderRadius: '8px',
        background: isActive ? 'hsl(var(--accent-primary) / 0.15)' : 'rgba(255,255,255,0.03)',
        border: `1px solid ${isActive ? 'hsl(var(--accent-primary) / 0.4)' : 'rgba(255,255,255,0.08)'}`,
        cursor: 'pointer',
        transition: 'all 0.15s',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}
      onMouseEnter={(e) => {
        if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
      }}
      onMouseLeave={(e) => {
        if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
      }}
    >
      <div>
        <div style={{ fontSize: '13px', fontWeight: 500, color: '#fff', marginBottom: '2px' }}>{canvas.name}</div>
        <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>
          {new Date(canvas.updatedAt).toLocaleString('zh-CN')}
        </div>
      </div>
      <div style={{ display: 'flex', gap: '6px' }}>
        <button
          onClick={(e) => { e.stopPropagation(); onRename(); }}
          style={{
            padding: '4px 8px',
            fontSize: '10px',
            borderRadius: '4px',
            border: '1px solid rgba(255,255,255,0.15)',
            background: 'transparent',
            color: 'rgba(255,255,255,0.6)',
            cursor: 'pointer'
          }}
          title="重命名"
        >
          ✏️
        </button>
        {onShowSnapshots && (
          <button
            onClick={(e) => { e.stopPropagation(); onShowSnapshots(); }}
            style={{
              padding: '4px 8px',
              fontSize: '10px',
              borderRadius: '4px',
              border: '1px solid hsl(var(--accent-secondary) / 0.4)',
              background: 'transparent',
              color: 'hsl(var(--accent-secondary))',
              cursor: 'pointer'
            }}
            title="历史快照"
          >
            📜
          </button>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          style={{
            padding: '4px 8px',
            fontSize: '10px',
            borderRadius: '4px',
            border: '1px solid rgba(239,68,68,0.3)',
            background: 'transparent',
            color: '#ef4444',
            cursor: 'pointer'
          }}
          title="删除"
        >
          🗑️
        </button>
      </div>
    </div>
  );
}

// 回收站项组件
function DeletedCanvasItem({
  canvas,
  onRestore,
  onPermanentDelete
}: {
  canvas: CanvasInfo;
  onRestore: () => void;
  onPermanentDelete?: () => void;
}) {
  return (
    <div
      style={{
        padding: '10px 12px',
        marginBottom: '6px',
        borderRadius: '6px',
        background: 'rgba(239,68,68,0.08)',
        border: '1px solid rgba(239,68,68,0.2)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}
    >
      <div>
        <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)', textDecoration: 'line-through' }}>{canvas.name}</div>
        <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)' }}>
          删除于 {canvas.deletedAt ? new Date(canvas.deletedAt).toLocaleString('zh-CN') : ''}
        </div>
      </div>
      <div style={{ display: 'flex', gap: '6px' }}>
        <button
          onClick={onRestore}
          style={{
            padding: '4px 10px',
            fontSize: '11px',
            borderRadius: '4px',
            border: '1px solid hsl(var(--accent-primary) / 0.4)',
            background: 'hsl(var(--accent-primary) / 0.1)',
            color: '#fff',
            cursor: 'pointer'
          }}
        >
          还原
        </button>
        {onPermanentDelete && (
          <button
            onClick={() => {
              if (confirm('彻底删除后无法恢复，确定要永久删除吗？')) {
                onPermanentDelete();
              }
            }}
            style={{
              padding: '4px 8px',
              fontSize: '11px',
              borderRadius: '4px',
              border: '1px solid rgba(239,68,68,0.5)',
              background: 'rgba(239,68,68,0.15)',
              color: '#ef4444',
              cursor: 'pointer'
            }}
          >
            彻底删除
          </button>
        )}
      </div>
    </div>
  );
}
