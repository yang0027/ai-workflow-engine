import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Handle, Position, useReactFlow, useStore, useNodes } from '@xyflow/react';
import { ResolvedMedia } from '../ResolvedMedia';
import { UploadService } from '../../services/upload.service';

interface GridNodeProps {
  id: string;
  data: {
    label?: string;
    progress?: number;
    inputs?: {
      gridType?: '2x2' | '3x3';
      gap?: number;
      bgColor?: string;
      borderRadius?: number;
      outputSize?: number;
      localImages?: Record<number, string>;
      [key: string]: any;
    };
    outputs?: {
      output?: string;
      errorMsg?: string;
    };
  };
  selected?: boolean;
}

export default function GridNode({ id, data, selected }: GridNodeProps) {
  const { setNodes, deleteElements } = useReactFlow();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeSlot, setActiveSlot] = useState<number | null>(null);

  // 多选检测
  const isMultiSelected = useStore((state) => {
    return state.nodes.filter(n => n.selected).length > 1;
  });

  const edges = useStore((state) => state.edges);
  const nodes = useNodes();

  // 当前节点的配置
  const gridType = data.inputs?.gridType || '2x2';
  const gap = data.inputs?.gap !== undefined ? data.inputs.gap : 8;
  const bgColor = data.inputs?.bgColor || '#0f172a';
  const borderRadius = data.inputs?.borderRadius !== undefined ? data.inputs.borderRadius : 8;
  const outputSize = data.inputs?.outputSize || 2048; // 默认像素级 2K 高清合成
  const localImages = data.inputs?.localImages || {};

  const cols = gridType === '2x2' ? 2 : 3;
  const totalSlots = cols * cols;

  // 扫描上游并按槽位解析连接图片
  const slotImages = useMemo(() => {
    const images: Record<number, string> = { ...localImages };
    
    // 寻找连入当前节点的 edges
    const connectedEdges = edges.filter(e => e.target === id);
    connectedEdges.forEach(edge => {
      // 这里的 edge.targetHandle 可能是 'img-0', 'img-1' 等
      const targetHandle = edge.targetHandle;
      if (targetHandle && targetHandle.startsWith('img-')) {
        const slotIdx = parseInt(targetHandle.replace('img-', ''), 10);
        if (slotIdx >= 0 && slotIdx < totalSlots) {
          const srcNode = nodes.find(n => n.id === edge.source);
          if (srcNode) {
            const outputs = (srcNode.data?.outputs || {}) as any;
            const inputs = (srcNode.data?.inputs || {}) as any;
            const val = outputs.output || outputs.image || inputs.image || '';
            if (val && typeof val === 'string') {
              images[slotIdx] = val;
            }
          }
        }
      }
    });

    return images;
  }, [edges, nodes, id, localImages, totalSlots]);

  const [synthesizing, setSynthesizing] = useState(false);
  const [outputImage, setOutputImage] = useState<string>(data.outputs?.output || '');
  const [isEditingName, setIsEditingName] = useState(false);
  const [localName, setLocalName] = useState(data.label || '⊞ 宫格排版合成');

  useEffect(() => {
    if (data.label) {
      setLocalName(data.label);
    }
  }, [data.label]);

  useEffect(() => {
    if (data.outputs?.output) {
      setOutputImage(data.outputs.output);
    } else {
      setOutputImage('');
    }
  }, [data.outputs?.output]);

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

  const handleSlotClick = (slotIdx: number) => {
    setActiveSlot(slotIdx);
    setTimeout(() => {
      fileInputRef.current?.click();
    }, 50);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (activeSlot === null) return;
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        const updatedLocal = { ...localImages, [activeSlot]: reader.result };
        handleInputChange('localImages', updatedLocal);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = ''; // 重置 file value
  };

  const handleClearSlot = (e: React.MouseEvent, slotIdx: number) => {
    e.stopPropagation();
    const updatedLocal = { ...localImages };
    delete updatedLocal[slotIdx];
    handleInputChange('localImages', updatedLocal);
  };

  // 高保真像素排版拼接算法 (Canvas Level Composition)
  const handleCompose = async () => {
    setSynthesizing(true);

    try {
      // 1. 创建高清 Canvas 离屏画布
      const canvas = document.createElement('canvas');
      canvas.width = outputSize;
      canvas.height = outputSize;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('无法初始化 Canvas 绘图上下文');

      // 2. 绘制背景色
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, outputSize, outputSize);

      // 3. 计算宫格尺寸布局
      const spacing = gap * (outputSize / 512); // 根据输出尺寸自适应间隙比率
      const slotWidth = (outputSize - (spacing * (cols + 1))) / cols;
      const slotHeight = slotWidth; // 正方形布局

      // 4. 并发加载并绘制所有的槽位图
      const loadPromises = Array.from({ length: totalSlots }).map(async (_, idx) => {
        const src = slotImages[idx];
        if (!src) return;

        // 智能获取真实 Base64 自愈降级 (防 db 虚拟协议)
        let resolvedSrc = src;
        if (src.startsWith('db://')) {
          const mediaId = src.replace('db://', '');
          const getMedia = (window as any).getMediaFromDB;
          if (typeof getMedia === 'function') {
            try {
              const base64 = await getMedia(mediaId);
              if (base64) resolvedSrc = base64;
            } catch (err) {
              console.warn('[GridNode] Failed to resolve db:// URL:', err);
            }
          }
        }

        return new Promise<void>((resolve, reject) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => {
            const colIdx = idx % cols;
            const rowIdx = Math.floor(idx / cols);

            // 计算该槽位在画布上的绝对坐标
            const x = spacing + colIdx * (slotWidth + spacing);
            const y = spacing + rowIdx * (slotHeight + spacing);

            // 绘制圆角裁切区域 (如果配置了圆角且圆角 > 0)
            ctx.save();
            if (borderRadius > 0) {
              const r = borderRadius * (outputSize / 512); // 圆角自适应
              ctx.beginPath();
              ctx.moveTo(x + r, y);
              ctx.arcTo(x + slotWidth, y, x + slotWidth, y + slotHeight, r);
              ctx.arcTo(x + slotWidth, y + slotHeight, x, y + slotHeight, r);
              ctx.arcTo(x, y + slotHeight, x, y, r);
              ctx.arcTo(x, y, x + slotWidth, y, r);
              ctx.closePath();
              ctx.clip();
            }

            // 5. 像素级 Object-Fit Cover 智能缩放剪裁算法
            const imgRatio = img.width / img.height;
            const slotRatio = slotWidth / slotHeight;

            let sWidth = img.width;
            let sHeight = img.height;
            let sx = 0;
            let sy = 0;

            if (imgRatio > slotRatio) {
              // 图像太宽了，剪切左右
              sWidth = img.height * slotRatio;
              sx = (img.width - sWidth) / 2;
            } else {
              // 图像太高了，剪切上下
              sHeight = img.width / slotRatio;
              sy = (img.height - sHeight) / 2;
            }

            ctx.drawImage(img, sx, sy, sWidth, sHeight, x, y, slotWidth, slotHeight);
            ctx.restore();
            resolve();
          };
          img.onerror = () => {
            console.warn(`[GridNode] 槽位 ${idx + 1} 图像加载失败:`, resolvedSrc);
            resolve(); // 宽容处理，加载失败不阻塞整体合成
          };
          img.src = resolvedSrc;
        });
      });

      await Promise.all(loadPromises);

      // 6. 导出合成大图
      const composedBase64 = canvas.toDataURL('image/jpeg', 0.92);

      // 7. 统一云原生存储物理上传服务 (MinIO 标准 HTTP URL 化，网络异常自动执行高自愈 Base64 降级直出)
      const finalComposedUrl = await UploadService.uploadBase64(
        composedBase64,
        `toonflow-composed-${id}-${Date.now()}.jpg`,
        'image'
      );

      // 8. 存盘与更新 outputs
      setOutputImage(finalComposedUrl);
      setNodes((nodes) =>
        nodes.map((n) => {
          if (n.id === id) {
            return {
              ...n,
              data: {
                ...n.data,
                outputs: {
                  output: finalComposedUrl
                }
              }
            };
          }
          return n;
        })
      );

      // 发送成功通知日志
      window.dispatchEvent(
        new CustomEvent('add-success-log', {
          detail: {
            nodeId: id,
            nodeName: localName,
            model: `宫格排版合成 [${gridType}]`,
            errorMsg: `高清排版合成成功！已拼接 ${totalSlots} 格，物理存盘至 MinIO。`
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
            model: `宫格排版合成 [${gridType}]`,
            errorMsg: e.message || '图像像素拼接遇到硬件兼容报错。'
          }
        })
      );
      alert(`❌ 合成失败: ${e.message}`);
    } finally {
      setSynthesizing(false);
    }
  };

  const handleDownloadOutput = () => {
    if (!outputImage) return;
    const a = document.createElement('a');
    a.href = outputImage;
    a.download = `toonflow-grid-composed-${id}.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleDelete = () => {
    deleteElements({ nodes: [{ id }] });
  };

  const handleStyle: React.CSSProperties = {
    width: '20px',
    height: '20px',
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
    fontSize: '12px',
    userSelect: 'none',
    lineHeight: '20px',
    position: 'absolute',
    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
    zIndex: 10
  };

  return (
    <div 
      className="relative text-left custom-drag-handle" 
      style={{
        position: 'relative',
        width: '200px',
        height: '200px',
        fontFamily: 'var(--font-sans)',
        userSelect: 'none'
      }}
    >
      {/* 隐藏的本地图片 File Input */}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        accept="image/*" 
        style={{ display: 'none' }} 
      />

      {/* 物理删除悬浮按钮 */}
      {selected && !isMultiSelected && (
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
          letterSpacing: '1.2px',
          textShadow: '0 0 6px rgba(168, 85, 247, 0.45)',
          pointerEvents: 'none'
        }}
      >
        Grid Composition
      </div>

      {/* 节点主体 */}
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
          flexDirection: 'column',
          padding: '8px',
          boxSizing: 'border-box',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
        }}
      >
        {/* 如果有已经合成好的大图，且处于非编辑预览模式，我们可以展示大图预览 */}
        {outputImage && !selected ? (
          <div style={{ position: 'relative', width: '100%', height: '100%', borderRadius: '10px', overflow: 'hidden' }}>
            <ResolvedMedia url={outputImage} type="image" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            <div 
              style={{ 
                position: 'absolute', 
                bottom: '8px', 
                left: '50%', 
                transform: 'translateX(-50%)',
                background: 'rgba(0,0,0,0.6)', 
                backdropFilter: 'blur(10px)',
                borderRadius: '12px',
                padding: '3px 8px',
                fontSize: '9px',
                color: '#22c55e',
                fontWeight: 'bold',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <span>✅ 拼接就绪</span>
            </div>
          </div>
        ) : (
          /* 格子编辑预览面板 */
          <div 
            style={{ 
              display: 'grid', 
              gridTemplateColumns: `repeat(${cols}, 1fr)`, 
              gap: `${gap / 2.5}px`, // 节点预览等比缩小 gap
              width: '100%', 
              height: '100%',
              background: bgColor,
              borderRadius: `${borderRadius / 1.5}px`,
              padding: '4px',
              boxSizing: 'border-box',
              overflow: 'hidden'
            }}
          >
            {Array.from({ length: totalSlots }).map((_, idx) => {
              const src = slotImages[idx];
              return (
                <div 
                  key={idx} 
                  onClick={() => handleSlotClick(idx)}
                  style={{ 
                    position: 'relative', 
                    borderRadius: `${borderRadius / 2}px`, 
                    overflow: 'hidden', 
                    cursor: 'pointer',
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px dashed rgba(255, 255, 255, 0.12)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.borderColor = 'rgba(168, 85, 247, 0.6)'}
                  onMouseLeave={(e) => e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.12)'}
                  title={`点击导入槽位 ${idx + 1} 图片`}
                >
                  {src ? (
                    <>
                      <ResolvedMedia url={src} type="image" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      {localImages[idx] && (
                        <button
                          onClick={(e) => handleClearSlot(e, idx)}
                          style={{
                            position: 'absolute',
                            top: '2px',
                            right: '2px',
                            background: 'rgba(0, 0, 0, 0.7)',
                            border: 'none',
                            color: '#ef4444',
                            borderRadius: '50%',
                            width: '12px',
                            height: '12px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '8px',
                            cursor: 'pointer',
                            zIndex: 5
                          }}
                          title="清除槽位导入"
                        >
                          ×
                        </button>
                      )}
                    </>
                  ) : (
                    <span style={{ fontSize: gridType === '2x2' ? '12px' : '9px', color: 'rgba(255,255,255,0.25)' }}>
                      {idx + 1}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* 统一高保真进度条 */}
        {synthesizing && (
          <div 
            style={{
              position: 'absolute',
              top: 0, left: 0, right: 0, bottom: 0,
              background: 'rgba(9, 13, 22, 0.85)',
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
              排版像素拼接中...
            </span>
            <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
              <div 
                style={{
                  width: '60%',
                  height: '100%',
                  background: 'linear-gradient(90deg, #a855f7, #ec4899)',
                  animation: 'pulse 1.2s infinite'
                }} 
              />
            </div>
          </div>
        )}
      </div>

      {/* 动态输入 handles 渲染 */}
      {Array.from({ length: totalSlots }).map((_, idx) => {
        // 将 slots 均分在左侧，用于上游连线输入
        const topPercent = 10 + (idx * (80 / (totalSlots - 1)));
        return (
          <Handle
            key={idx}
            type="target"
            position={Position.Left}
            id={`img-${idx}`}
            style={{ 
              ...handleStyle, 
              left: '-10px', 
              top: `${topPercent}%`,
              transform: 'translateY(-50%)',
              borderColor: slotImages[idx] ? 'rgba(34, 197, 94, 0.85)' : 'rgba(168, 85, 247, 0.85)',
              opacity: selected ? 1 : 0,
              pointerEvents: selected ? 'all' : 'none',
              visibility: selected ? 'visible' : 'hidden'
            }}
            title={`连接大图输入源槽位 ${idx + 1}`}
          >
            {idx + 1}
          </Handle>
        );
      })}

      {/* 极简智能输出连接手柄 Right Output (+) */}
      <Handle
        type="source"
        position={Position.Right}
        id="output"
        style={{ 
          ...handleStyle, 
          right: '-10px', 
          top: '50%', 
          transform: 'translateY(-50%)',
          opacity: selected ? 1 : 0,
          pointerEvents: selected ? 'all' : 'none',
          visibility: selected ? 'visible' : 'hidden'
        }}
      >
        ＋
      </Handle>

      {/* 选中态底部配置面板 */}
      {selected && !isMultiSelected && (
        <div
          className="nodrag"
          style={{
            position: 'absolute',
            top: '220px',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '580px',
            background: 'rgba(11, 15, 26, 0.96)',
            backdropFilter: 'blur(20px)',
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
              <span style={{ fontSize: '16px' }}>⊞</span>
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
            <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.45)' }}>高清宫格拼接排版大图合成</span>
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid rgba(255, 255, 255, 0.08)', margin: '2px 0' }} />

          {/* 拼接样式参数 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div>
                <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)', display: 'block', marginBottom: '6px' }}>
                  排版网格规格 (Grid Layout)
                </span>
                <div style={{ display: 'flex', background: 'rgba(0,0,0,0.3)', padding: '2px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <button
                    onClick={() => handleInputChange('gridType', '2x2')}
                    style={{
                      flex: 1,
                      padding: '6px 12px',
                      borderRadius: '6px',
                      background: gridType === '2x2' ? 'rgba(168, 85, 247, 0.25)' : 'transparent',
                      border: 'none',
                      color: gridType === '2x2' ? '#fff' : 'rgba(255,255,255,0.5)',
                      fontSize: '11px',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      outline: 'none'
                    }}
                  >
                    四宫格 (2x2)
                  </button>
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
                </div>
              </div>

              {/* Spacing Spans & Rounded borders */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)', display: 'block', marginBottom: '6px' }}>缝隙宽度 (Gap px)</span>
                  <input
                    type="number"
                    min={0}
                    max={40}
                    value={gap}
                    onChange={(e) => handleInputChange('gap', parseInt(e.target.value, 10) || 0)}
                    style={{
                      width: '100%',
                      padding: '6px 10px',
                      background: 'rgba(0,0,0,0.3)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '6px',
                      color: '#fff',
                      fontSize: '11px',
                      outline: 'none'
                    }}
                  />
                </div>
                <div>
                  <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)', display: 'block', marginBottom: '6px' }}>图像圆角 (Radius px)</span>
                  <input
                    type="number"
                    min={0}
                    max={50}
                    value={borderRadius}
                    onChange={(e) => handleInputChange('borderRadius', parseInt(e.target.value, 10) || 0)}
                    style={{
                      width: '100%',
                      padding: '6px 10px',
                      background: 'rgba(0,0,0,0.3)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '6px',
                      color: '#fff',
                      fontSize: '11px',
                      outline: 'none'
                    }}
                  />
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div>
                <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)', display: 'block', marginBottom: '6px' }}>背景底色 (Bg Color)</span>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <input
                    type="color"
                    value={bgColor}
                    onChange={(e) => handleInputChange('bgColor', e.target.value)}
                    style={{
                      border: 'none',
                      background: 'none',
                      cursor: 'pointer',
                      width: '28px',
                      height: '28px',
                      padding: 0
                    }}
                  />
                  <input
                    type="text"
                    value={bgColor}
                    onChange={(e) => handleInputChange('bgColor', e.target.value)}
                    style={{
                      flex: 1,
                      padding: '6px 10px',
                      background: 'rgba(0,0,0,0.3)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '6px',
                      color: '#fff',
                      fontSize: '11px',
                      outline: 'none'
                    }}
                  />
                </div>
              </div>

              <div>
                <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)', display: 'block', marginBottom: '6px' }}>
                  高清输出规格 (Resolution)
                </span>
                <select
                  value={outputSize}
                  onChange={(e) => handleInputChange('outputSize', parseInt(e.target.value, 10))}
                  style={{
                    width: '100%',
                    padding: '6px 10px',
                    background: 'rgba(11, 15, 26, 0.95)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '6px',
                    color: '#fff',
                    fontSize: '11px',
                    outline: 'none',
                    cursor: 'pointer'
                  }}
                >
                  <option value={1024}>1024 x 1024 (普清)</option>
                  <option value={2048}>2048 x 2048 (2K 超清)</option>
                  <option value={4096}>4096 x 4096 (4K 极清)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Action Footer */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
            <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.45)' }}>
              {outputImage ? '✨ 高清合成完毕！点击右侧按钮下载或进行下游流转。' : '上游连线或手动导入小图后，点击一键物理拼接。'}
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              {outputImage && (
                <button
                  onClick={handleDownloadOutput}
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
                  📥 下载合成大图
                </button>
              )}
              <button
                onClick={handleCompose}
                disabled={synthesizing}
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
                {synthesizing ? '合成中...' : '一键拼接合成'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
