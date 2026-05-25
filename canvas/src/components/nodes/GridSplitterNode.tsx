import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Handle, Position, useReactFlow, useStore, useNodes } from '@xyflow/react';

interface GridSplitterNodeProps {
  id: string;
  data: {
    label?: string;
    progress?: number;
    inputs?: {
      image?: string;
      gridType?: '3x3' | '5x5';
      [key: string]: any;
    };
    outputs?: {
      images?: string[];
      errorMsg?: string;
      output?: string;
    };
  };
  selected?: boolean;
}

export default function GridSplitterNode({ id, data, selected }: GridSplitterNodeProps) {
  const { setNodes, deleteElements } = useReactFlow();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 扫描上游连线
  const edges = useStore((state) => state.edges);
  const nodes = useNodes();

  const connectedImage = useMemo(() => {
    const connectedEdges = edges.filter(e => e.target === id);
    for (const edge of connectedEdges) {
      const srcNode = nodes.find(n => n.id === edge.source);
      if (!srcNode) continue;
      const outputs = (srcNode.data?.outputs || {}) as any;
      const inputs = (srcNode.data?.inputs || {}) as any;
      const val = outputs.output || outputs.image || inputs.image || '';
      if (val && typeof val === 'string' && (val.startsWith('data:image/') || val.includes('.png') || val.includes('.jpg') || val.includes('.jpeg') || val.includes('.webp') || val.startsWith('db://'))) {
        return val;
      }
    }
    return '';
  }, [edges, nodes, id]);

  const isImageConnected = !!connectedImage;
  const gridType = data.inputs?.gridType || '3x3';
  const localImage = data.inputs?.image || '';
  const currentImage = isImageConnected ? connectedImage : localImage;

  const [splitting, setSplitting] = useState(false);
  const [splitImages, setSplitImages] = useState<string[]>(data.outputs?.images || []);
  const [isEditingName, setIsEditingName] = useState(false);
  const [localName, setLocalName] = useState(data.label || '✂️ 宫格切分工具');

  useEffect(() => {
    if (data.label) {
      setLocalName(data.label);
    }
  }, [data.label]);

  useEffect(() => {
    if (data.outputs?.images) {
      setSplitImages(data.outputs.images);
    }
  }, [data.outputs?.images]);

  const handleSaveName = () => {
    setIsEditingName(false);
    if (localName.trim()) {
      setNodes((nds) =>
        nds.map((n) => {
          if (n.id === id) {
            return {
              ...n,
              data: {
                ...n.data,
                label: localName.trim(),
              },
            };
          }
          return n;
        })
      );
    }
  };

  const handleInputChange = (field: string, val: any) => {
    setNodes((nodes) =>
      nodes.map((n) => {
        if (n.id === id) {
          return {
            ...n,
            data: {
              ...n.data,
              inputs: {
                ...((n.data as any)?.inputs || {}),
                [field]: val
              }
            }
          };
        }
        return n;
      })
    );
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        handleInputChange('image', reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSplit = async () => {
    if (!currentImage) {
      alert('请上传或通过连线输入源图片！');
      return;
    }

    setSplitting(true);
    // 采用微小延迟以获得平滑的高端加载微动画效果
    setTimeout(() => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const cols = gridType === '3x3' ? 3 : 5;
          const rows = gridType === '3x3' ? 3 : 5;
          const tileWidth = img.width / cols;
          const tileHeight = img.height / rows;

          const results: string[] = [];
          for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
              const canvas = document.createElement('canvas');
              canvas.width = tileWidth;
              canvas.height = tileHeight;
              const ctx = canvas.getContext('2d');
              if (ctx) {
                ctx.drawImage(
                  img,
                  c * tileWidth,
                  r * tileHeight,
                  tileWidth,
                  tileHeight,
                  0,
                  0,
                  tileWidth,
                  tileHeight
                );
                results.push(canvas.toDataURL('image/png'));
              }
            }
          }

          setSplitImages(results);
          setNodes((nodes) =>
            nodes.map((n) => {
              if (n.id === id) {
                return {
                  ...n,
                  data: {
                    ...n.data,
                    outputs: {
                      images: results,
                      output: results[0] // 默认流入下游首张图
                    }
                  }
                };
              }
              return n;
            })
          );

          window.dispatchEvent(
            new CustomEvent('add-success-log', {
              detail: {
                nodeId: id,
                nodeName: localName,
                model: `${gridType} 切分`,
                errorMsg: `宫格切分成功！已生成 ${results.length} 张切片。`
              }
            })
          );
        } catch (e: any) {
          console.error(e);
          window.dispatchEvent(
            new CustomEvent('add-failure-log', {
              detail: {
                nodeId: id,
                nodeName: localName,
                model: `${gridType} 切分`,
                errorMsg: e.message || '切分失败，可能是跨域引起的图片读取限制。'
              }
            })
          );
        } finally {
          setSplitting(false);
        }
      };
      img.onerror = () => {
        alert('图片加载失败，请检查格式！');
        setSplitting(false);
      };
      img.src = currentImage;
    }, 600);
  };

  const handleDownloadTile = (tile: string, idx: number) => {
    const a = document.createElement('a');
    a.href = tile;
    a.download = `toonflow-grid-${id}-${idx + 1}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleDelete = () => {
    deleteElements({ nodes: [{ id }] });
  };

  const cols = gridType === '3x3' ? 3 : 5;

  const handleStyle: React.CSSProperties = {
    width: '24px',
    height: '24px',
    background: 'rgba(15, 23, 42, 0.95)',
    border: '1.5px solid rgba(168, 85, 247, 0.85)',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'rgba(168, 85, 247, 1)',
    cursor: 'crosshair',
    boxShadow: '0 0 10px rgba(168, 85, 247, 0.45)',
    fontWeight: 'bold',
    fontSize: '14px',
    userSelect: 'none',
    lineHeight: '24px',
    top: '50%',
    transform: 'translateY(-50%)',
    position: 'absolute',
    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
    zIndex: 10
  };

  return (
    <div 
      className="relative text-left" 
      style={{
        position: 'relative',
        width: '180px',
        height: '180px',
        fontFamily: 'var(--font-sans)',
        userSelect: 'none'
      }}
    >
      {/* 物理删除悬浮按钮 */}
      {selected && (
        <button
          onClick={handleDelete}
          style={{
            position: 'absolute',
            top: '-28px',
            right: '0px',
            width: '20px',
            height: '20px',
            borderRadius: '50%',
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            color: '#ef4444',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '11px',
            cursor: 'pointer',
            padding: 0,
            zIndex: 10
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(239,68,68,0.3)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(239,68,68,0.1)'}
        >
          ×
        </button>
      )}

      {/* 悬浮 Label */}
      <div 
        style={{
          position: 'absolute',
          top: '-24px',
          left: '12px',
          fontSize: '11px',
          fontWeight: 700,
          color: 'rgba(168, 85, 247, 0.9)',
          textTransform: 'uppercase',
          letterSpacing: '1px',
          textShadow: '0 0 6px rgba(168, 85, 247, 0.45)',
          pointerEvents: 'none'
        }}
      >
        Grid Splitter
      </div>

      {/* 节点主体 180 * 180 */}
      <div 
        className="glass-card"
        style={{
          width: '100%',
          height: '100%',
          background: 'linear-gradient(135deg, rgba(20, 24, 33, 0.75) 0%, rgba(10, 12, 16, 0.95) 100%)',
          border: selected 
            ? '1.5px solid rgba(168, 85, 247, 0.85)' 
            : '1px solid rgba(255, 255, 255, 0.08)',
          boxShadow: selected 
            ? '0 0 25px rgba(168, 85, 247, 0.35)' 
            : '0 8px 32px rgba(0, 0, 0, 0.4)',
          borderRadius: '16px',
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
        }}
      >
        {splitImages.length > 0 ? (
          <div 
            style={{ 
              display: 'grid', 
              gridTemplateColumns: `repeat(${cols}, 1fr)`, 
              gap: '2px', 
              width: '100%', 
              height: '100%', 
              padding: '6px',
              boxSizing: 'border-box'
            }}
          >
            {splitImages.map((tile, idx) => (
              <div 
                key={idx} 
                style={{ 
                  position: 'relative', 
                  borderRadius: '2px', 
                  overflow: 'hidden', 
                  cursor: 'pointer' 
                }}
                onClick={(e) => { e.stopPropagation(); handleDownloadTile(tile, idx); }}
                title="点击单独下载切片"
              >
                <img src={tile} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
            ))}
          </div>
        ) : currentImage ? (
          <div style={{ position: 'relative', width: '100%', height: '100%' }}>
            <img src={currentImage} alt="Input source" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
              <span style={{ fontSize: '11px', color: '#fff', fontWeight: 'bold' }}>图片已就绪</span>
              <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.6)' }}>双击节点开始配置切片</span>
            </div>
          </div>
        ) : (
          <div 
            onClick={() => fileInputRef.current?.click()}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', cursor: 'pointer', width: '100%', height: '100%', justifyContent: 'center' }}
          >
            <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" style={{ display: 'none' }} />
            <span style={{ fontSize: '28px', opacity: 0.8 }}>✂️</span>
            <span style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.4)', fontWeight: 500 }}>上传或连线切片图</span>
          </div>
        )}

        {/* 统一高保真进度条 */}
        {splitting && (
          <div 
            style={{
              position: 'absolute',
              top: 0, left: 0, right: 0, bottom: 0,
              background: 'rgba(9, 13, 22, 0.8)',
              backdropFilter: 'blur(8px)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '15px',
              zIndex: 10,
              padding: '0 16px'
            }}
          >
            <span style={{ fontSize: '11px', color: 'rgba(168, 85, 247, 1)', fontWeight: 600, marginBottom: '8px' }}>
              正在执行切片算法...
            </span>
            <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
              <div 
                style={{
                  width: '50%',
                  height: '100%',
                  background: 'linear-gradient(90deg, #a855f7, #ec4899)',
                  animation: 'pulse 1.2s infinite'
                }} 
              />
            </div>
          </div>
        )}
      </div>

      {/* 极简智能连接手柄 Left Input (+) */}
      <Handle
        type="target"
        position={Position.Left}
        id="input"
        style={{ ...handleStyle, left: '-12px' }}
      >
        ＋
      </Handle>

      {/* 极简智能连接手柄 Right Output (+) */}
      <Handle
        type="source"
        position={Position.Right}
        id="output"
        style={{ ...handleStyle, right: '-12px' }}
      >
        ＋
      </Handle>

      {/* 选中态底部配置面板 */}
      {selected && (
        <div
          className="nodrag"
          style={{
            position: 'absolute',
            top: '200px',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '580px',
            background: 'rgba(11, 15, 26, 0.95)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.65), 0 0 30px rgba(168, 85, 247, 0.1)',
            borderRadius: '16px',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            zIndex: 1000,
            animation: 'slideUpGridNode 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
          }}
        >
          <style>{`
            @keyframes slideUpGridNode {
              from { transform: translate(-50%, 15px); opacity: 0; }
              to { transform: translate(-50%, 0); opacity: 1; }
            }
          `}</style>

          {/* Title Row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '16px' }}>✂️</span>
              {isEditingName ? (
                <input
                  value={localName}
                  onChange={(e) => setLocalName(e.target.value)}
                  onBlur={handleSaveName}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveName();
                  }}
                  autoFocus
                  style={{
                    background: 'rgba(0,0,0,0.3)',
                    border: '1px solid rgba(168, 85, 247, 0.6)',
                    borderRadius: '4px',
                    padding: '2px 6px',
                    color: '#fff',
                    fontSize: '12px',
                    fontWeight: 600,
                    width: '180px',
                    outline: 'none'
                  }}
                />
              ) : (
                <span onDoubleClick={() => setIsEditingName(true)} style={{ fontWeight: 'bold', color: '#fff', fontSize: '13px', cursor: 'text' }}>
                  {localName} (双击重命名)
                </span>
              )}
            </div>
            <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.45)' }}>智能九宫格/二十五宫格切图工具</span>
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid rgba(255, 255, 255, 0.08)', margin: '2px 0' }} />

          {/* Settings */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '12px', alignItems: 'center' }}>
            <div>
              <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)', display: 'block', marginBottom: '6px' }}>切片矩阵规格 (Matrix Type)</span>
              <div style={{ display: 'flex', background: 'rgba(0,0,0,0.3)', padding: '2px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <button
                  onClick={() => handleInputChange('gridType', '3x3')}
                  style={{
                    flex: 1,
                    padding: '6px 12px',
                    borderRadius: '6px',
                    background: gridType === '3x3' ? 'rgba(168, 85, 247, 0.25)' : 'transparent',
                    border: 'none',
                    color: gridType === '3x3' ? '#fff' : 'rgba(255,255,255,0.5)',
                    fontSize: '11px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    outline: 'none'
                  }}
                >
                  九宫格 (3x3)
                </button>
                <button
                  onClick={() => handleInputChange('gridType', '5x5')}
                  style={{
                    flex: 1,
                    padding: '6px 12px',
                    borderRadius: '6px',
                    background: gridType === '5x5' ? 'rgba(168, 85, 247, 0.25)' : 'transparent',
                    border: 'none',
                    color: gridType === '5x5' ? '#fff' : 'rgba(255,255,255,0.5)',
                    fontSize: '11px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    outline: 'none'
                  }}
                >
                  二十五宫格 (5x5)
                </button>
              </div>
            </div>

            <div>
              <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)', display: 'block', marginBottom: '6px' }}>本地图片导入</span>
              <button
                onClick={() => fileInputRef.current?.click()}
                style={{
                  width: '100%',
                  padding: '7px 10px',
                  borderRadius: '6px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  color: '#fff',
                  fontSize: '11px',
                  cursor: 'pointer',
                  fontWeight: 'bold'
                }}
              >
                📁 选择切分源图
              </button>
            </div>
          </div>

          {/* Action Footer */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
            <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.45)' }}>
              {splitImages.length > 0 ? `已成功切出 ${splitImages.length} 个独立片段，点击小图即可下载。` : '导入源图片后，点击开始执行切分。'}
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              {splitImages.length > 0 && (
                <button
                  onClick={() => {
                    splitImages.forEach((tile, idx) => {
                      setTimeout(() => handleDownloadTile(tile, idx), idx * 100);
                    });
                  }}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    color: '#fff',
                    fontSize: '11px',
                    fontWeight: 'bold',
                    cursor: 'pointer'
                  }}
                >
                  📥 一键批量下载
                </button>
              )}
              <button
                onClick={handleSplit}
                disabled={splitting || !currentImage}
                style={{
                  padding: '8px 24px',
                  borderRadius: '8px',
                  background: 'linear-gradient(135deg, #a855f7 0%, #ec4899 100%)',
                  border: 'none',
                  color: '#fff',
                  fontSize: '11px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(168, 85, 247, 0.3)'
                }}
              >
                {splitting ? '正在切分...' : '开始切分'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
