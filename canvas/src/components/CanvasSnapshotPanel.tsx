import React, { useState, useEffect } from 'react';

// ============ CanvasSnapshotPanel - 画布历史快照面板 ============
// 显示指定画布的快照列表，支持查看和回滚
// 放在画布管理器内或独立弹出

interface Snapshot {
  id: string;
  canvasId: string;
  name: string;
  createdAt: string;
  nodes: any[];
  edges: any[];
}

interface CanvasSnapshotPanelProps {
  canvasId: string;
  onClose: () => void;
  onRollback: (nodes: any[], edges: any[]) => void;
}

const API_BASE = 'http://localhost:4000/api/v1';

export function CanvasSnapshotPanel({ canvasId, onClose, onRollback }: CanvasSnapshotPanelProps) {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSnapshot, setSelectedSnapshot] = useState<Snapshot | null>(null);

  useEffect(() => {
    loadSnapshots();
  }, [canvasId]);

  // 加载快照列表
  const loadSnapshots = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/canvases/${canvasId}/snapshots`);
      const data = await res.json();
      setSnapshots(data.snapshots || []);
    } catch (err) {
      console.error('Failed to load snapshots:', err);
    }
    setLoading(false);
  };

  // 回滚到指定快照
  const handleRollback = async (snapshot: Snapshot) => {
    if (!confirm(`确定要回滚到"${snapshot.name}"吗？当前未保存的更改将会丢失。`)) {
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/canvases/${canvasId}/rollback/${snapshot.id}`, {
        method: 'POST'
      });
      const data = await res.json();
      if (data.success && data.canvas) {
        onRollback(data.canvas.nodes, data.canvas.edges);
        alert('已成功回滚到指定版本');
        onClose();
      }
    } catch (err) {
      console.error('Failed to rollback:', err);
      alert('回滚失败');
    }
  };

  // 预览快照内容
  const handlePreview = async (snapshot: Snapshot) => {
    setSelectedSnapshot(snapshot);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(4px)',
        zIndex: 9500,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="glass-panel"
        style={{
          width: '600px',
          maxHeight: '75vh',
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
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#fff' }}>📜 历史快照</h3>
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

        {/* 加载状态 */}
        {loading && (
          <div style={{ textAlign: 'center', padding: '40px', color: 'rgba(255,255,255,0.5)' }}>
            加载中...
          </div>
        )}

        {/* 快照列表 */}
        {!loading && (
          <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
            {snapshots.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: 'rgba(255,255,255,0.5)' }}>
                <p style={{ margin: 0 }}>暂无快照记录</p>
                <p style={{ margin: '8px 0 0 0', fontSize: '12px' }}>保存画布时会自动创建快照</p>
              </div>
            ) : (
              snapshots.map((snapshot, index) => (
                <div
                  key={snapshot.id}
                  style={{
                    padding: '14px',
                    marginBottom: '10px',
                    borderRadius: '10px',
                    background: selectedSnapshot?.id === snapshot.id 
                      ? 'hsl(var(--accent-primary) / 0.12)' 
                      : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${selectedSnapshot?.id === snapshot.id 
                      ? 'hsl(var(--accent-primary) / 0.4)' 
                      : 'rgba(255,255,255,0.08)'}`,
                    transition: 'all 0.15s'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 500, color: '#fff', marginBottom: '4px' }}>
                        {snapshot.name}
                      </div>
                      <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>
                        {new Date(snapshot.createdAt).toLocaleString('zh-CN')}
                      </div>
                      <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', marginTop: '6px' }}>
                        📊 节点: {snapshot.nodes?.length || 0} | 连线: {snapshot.edges?.length || 0}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        onClick={() => handlePreview(snapshot)}
                        style={{
                          padding: '5px 10px',
                          fontSize: '11px',
                          borderRadius: '5px',
                          border: '1px solid rgba(255,255,255,0.15)',
                          background: 'transparent',
                          color: 'rgba(255,255,255,0.7)',
                          cursor: 'pointer'
                        }}
                      >
                        👁️ 预览
                      </button>
                      {index > 0 && (  // 不允许回滚到最新版本（那是当前状态）
                        <button
                          onClick={() => handleRollback(snapshot)}
                          style={{
                            padding: '5px 10px',
                            fontSize: '11px',
                            borderRadius: '5px',
                            border: '1px solid hsl(var(--accent-primary) / 0.5)',
                            background: 'hsl(var(--accent-primary) / 0.1)',
                            color: '#fff',
                            cursor: 'pointer'
                          }}
                        >
                          ⏪ 回滚
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* 预览面板 */}
        {selectedSnapshot && (
          <div
            style={{
              marginTop: '16px',
              padding: '14px',
              borderRadius: '10px',
              background: 'rgba(0,0,0,0.3)',
              border: '1px solid rgba(255,255,255,0.1)'
            }}
          >
            <div style={{ fontSize: '12px', fontWeight: 500, color: '#fff', marginBottom: '10px' }}>
              👁️ 快照预览: {selectedSnapshot.name}
            </div>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)', maxHeight: '200px', overflowY: 'auto' }}>
              <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                {JSON.stringify({
                  nodes: selectedSnapshot.nodes?.slice(0, 3),  // 只显示前3个节点
                  edges: selectedSnapshot.edges?.slice(0, 3),
                  ...(selectedSnapshot.nodes?.length > 3 && { moreNodes: `...还有 ${selectedSnapshot.nodes.length - 3} 个节点` })
                }, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
