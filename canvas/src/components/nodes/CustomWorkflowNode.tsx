import React, { useMemo } from 'react';
import { Handle, Position, useReactFlow, useStore, useNodes } from '@xyflow/react';
import { RunningHubService } from '../../services/runninghub.service';
import { UploadService } from '../../services/upload.service';
import { WorkflowTextarea } from '../WorkflowTextarea';

interface InputMapping {
  portId: string;
  nodeId: string;
  fieldName: string;
  displayName: string;
}

interface CustomNodeData {
  label?: string;
  source?: 'local_comfyui' | 'runninghub';
  workflowIdOrJson?: string;
  mappings?: InputMapping[];
  inputs?: Record<string, any>; // 缓存用户手动输入或连线灌装的参数值
  outputs?: {
    errorMsg?: string;
    output?: string;
  };
  outputUrl?: string;
  onEdit?: (id: string) => void;
  isRunning?: boolean;
}

interface CustomWorkflowNodeProps {
  id: string;
  data: CustomNodeData;
  selected?: boolean;
}

export default function CustomWorkflowNode({ id, data, selected = false }: CustomWorkflowNodeProps) {
  const source = data.source || 'local_comfyui';
  const mappings = data.mappings || [];
  const outputUrl = data.outputs?.output || data.outputUrl || '';
  const isRunning = data.isRunning || false;
  const { setNodes, setEdges, deleteElements } = useReactFlow();

  // 连线检测
  const edges = useStore((state) => state.edges);
  const isPortConnected = (portId: string) => {
    return edges.some(e => e.target === id && e.targetHandle === portId);
  };

  const nodes = useNodes();
  // 从前级节点智能提取流入的数据
  const getConnectedVal = (portId: string) => {
    const edge = edges.find(e => e.target === id && e.targetHandle === portId);
    if (!edge) return '';
    const srcNode = nodes.find(n => n.id === edge.source);
    const srcData = srcNode?.data as any;
    return srcData?.outputs?.[edge.sourceHandle || ''] || srcData?.outputs?.image || srcData?.outputs?.audio || srcData?.outputs?.storyboard || srcData?.inputs?.text || '';
  };

  // 物理删除节点与连线
  const handleDelete = () => {
    deleteElements({ nodes: [{ id }] });
  };

  // 更新输入参数
  const handleParamChange = (portId: string, val: any) => {
    setNodes((nodes) =>
      nodes.map((n) => {
        if (n.id === id) {
          return {
            ...n,
            data: {
              ...n.data,
              inputs: {
                ...((n.data as any)?.inputs || {}),
                [portId]: val
              }
            }
          };
        }
        return n;
      })
    );
  };

  // 物理触发单节点ComfyUI/RunningHub异步执行
  const handleExecuteSingleNode = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isRunning) return;

    setNodes((nds) =>
      nds.map((n) => {
        if (n.id === id) {
          return {
            ...n,
            data: {
              ...n.data,
              isRunning: true,
              outputs: { ...(n.data.outputs || {}), errorMsg: undefined }
            }
          };
        }
        return n;
      })
    );

    try {
      const inputsVal: Record<string, any> = {};
      mappings.forEach(map => {
        const connected = isPortConnected(map.portId);
        inputsVal[map.portId] = connected ? getConnectedVal(map.portId) : (data.inputs?.[map.portId] || '');
      });

      const targetWorkflowOrJson = source === 'local_comfyui'
        ? (data.inputs?.jsonContent || data.workflowIdOrJson || '')
        : (data.workflowIdOrJson || '');

      if (!targetWorkflowOrJson) {
        throw new Error(source === 'local_comfyui' ? '未检测到 ComfyUI JSON 拓扑配置，请先上传或粘贴配置。' : '未检测到 RunningHub 工作流 ID，请先进行配置。');
      }

      const resOutputUrl = await RunningHubService.executeCustomWorkflow(
        source,
        targetWorkflowOrJson,
        inputsVal,
        mappings
      );

      setNodes((nds) =>
        nds.map((n) => {
          if (n.id === id) {
            return {
              ...n,
              data: {
                ...n.data,
                isRunning: false,
                outputUrl: resOutputUrl,
                outputs: { ...(n.data.outputs || {}), output: resOutputUrl, errorMsg: undefined }
              }
            };
          }
          return n;
        })
      );

      try {
        const savedHistory = localStorage.getItem('toonflow_history_assets_v2');
        const historyList = savedHistory ? JSON.parse(savedHistory) : [];
        const detectedType = resOutputUrl.toLowerCase().includes('.mp4') ? 'video' : (resOutputUrl.toLowerCase().includes('.mp3') || resOutputUrl.toLowerCase().includes('.wav') ? 'audio' : 'image');
        historyList.unshift({
          id: `custom-out-${Date.now()}`,
          type: detectedType,
          url: resOutputUrl,
          nodeName: `⚙️ [${data.label || '自定义工作流'}] 生成成果`
        });
        localStorage.setItem('toonflow_history_assets_v2', JSON.stringify(historyList.slice(0, 100)));
      } catch (err: any) {}

    } catch (err: any) {
      console.error(err);
      setNodes((nds) =>
        nds.map((n) => {
          if (n.id === id) {
            return {
              ...n,
              data: {
                ...n.data,
                isRunning: false,
                outputs: { ...(n.data.outputs || {}), errorMsg: err.message }
              }
            };
          }
          return n;
        })
      );
    }
  };

  // 智能提取和去重模式匹配
  const { textParams, imageParams, customParams } = useMemo(() => {
    const text: InputMapping[] = [];
    const image: InputMapping[] = [];
    const custom: InputMapping[] = [];

    mappings.forEach(map => {
      const fieldLower = (map.fieldName || '').toLowerCase();
      const displayLower = (map.displayName || '').toLowerCase();

      const isText = fieldLower.includes('prompt') || fieldLower.includes('text') || fieldLower.includes('instruction') || displayLower.includes('提示词') || displayLower.includes('指令') || displayLower.includes('文本');
      const isImage = fieldLower.includes('image') || fieldLower.includes('pic') || displayLower.includes('图片') || displayLower.includes('图像') || displayLower.includes('图');

      if (isText) {
        text.push(map);
      } else if (isImage) {
        image.push(map);
      } else {
        custom.push(map);
      }
    });

    return { textParams: text, imageParams: image, customParams: custom };
  }, [mappings]);

  // 判定媒体类型
  const detectMediaType = (url: string) => {
    if (!url) return 'none';
    const cleanUrl = url.split('?')[0].toLowerCase();
    if (cleanUrl.endsWith('.mp4')) return 'video';
    if (cleanUrl.endsWith('.mp3') || cleanUrl.endsWith('.wav')) return 'audio';
    return 'image';
  };

  const mediaType = outputUrl ? detectMediaType(outputUrl) : 'none';
  const isImage = mediaType === 'image';
  const isVideo = mediaType === 'video';
  const isAudio = mediaType === 'audio';

  return (
    <div
      className="relative text-left"
      style={{
        position: 'relative',
        width: '180px',
        height: '180px',
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
            zIndex: 25
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(239,68,68,0.3)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(239,68,68,0.1)'}
        >
          ×
        </button>
      )}

      {/* 悬浮标题 Label */}
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
          zIndex: 15,
          textOverflow: 'ellipsis',
          overflow: 'hidden',
          whiteSpace: 'nowrap',
          maxWidth: '150px'
        }}
      >
        {data.label || '自定义工作流'}
      </div>

      {/* 180x180 视觉主卡片体 */}
      <div
        className="glass-card"
        style={{
          width: '100%',
          height: '100%',
          background: outputUrl 
            ? '#000' 
            : 'linear-gradient(135deg, rgba(20, 24, 33, 0.75) 0%, rgba(10, 12, 16, 0.95) 100%)',
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
        {/* 全屏大光箱预览 */}
        {outputUrl && selected && isImage && (
          <div style={{ position: 'absolute', top: '8px', right: '8px', display: 'flex', gap: '6px', zIndex: 20 }}>
            <button 
              onClick={(e) => { 
                e.stopPropagation(); 
                if (typeof (window as any).setFullScreenMedia === 'function') {
                  (window as any).setFullScreenMedia({ url: outputUrl, type: 'image' });
                }
              }}
              style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'rgba(15,23,42,0.85)', border: '1px solid rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '11px', cursor: 'pointer', outline: 'none' }}
              title="全屏预览"
            >
              ⛶
            </button>
          </div>
        )}

        {data.outputs?.errorMsg ? (
          <div 
            style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center', 
              justifyContent: 'center',
              gap: '6px', 
              padding: '12px',
              textAlign: 'center',
              background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.15) 0%, rgba(20, 10, 10, 0.8) 100%)',
              width: '100%',
              height: '100%',
              borderRadius: '15px'
            }}
          >
            <span style={{ fontSize: '24px', animation: 'pulse 1.5s infinite' }}>⚠️</span>
            <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#ef4444' }}>生成失败</span>
            <span 
              style={{ 
                fontSize: '8px', 
                color: 'rgba(255,255,255,0.4)', 
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: '-webkit-box',
                WebkitLineClamp: 3,
                WebkitBoxOrient: 'vertical',
                lineHeight: '1.3',
                maxHeight: '32px'
              }}
              title={data.outputs.errorMsg}
            >
              {data.outputs.errorMsg}
            </span>
          </div>
        ) : outputUrl ? (
          <>
            {isImage && (
              <img 
                src={outputUrl} 
                alt="Generated Thumbnail" 
                style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '15px' }} 
              />
            )}
            {isVideo && (
              <video 
                src={outputUrl} 
                autoPlay loop muted playsInline
                style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '15px' }} 
              />
            )}
            {isAudio && (
              <div 
                onDoubleClick={() => {
                  const aud = new Audio(outputUrl);
                  aud.play().catch(e => console.log('Audio error:', e));
                }}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', background: 'rgba(0,0,0,0.3)', borderRadius: '15px', cursor: 'pointer' }}
                title="双击试听音频成果"
              >
                <span style={{ fontSize: '32px', animation: 'floatPill 3s infinite ease-in-out' }}>🎵</span>
                <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', marginTop: '6px' }}>双击试听音频</span>
              </div>
            )}
          </>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', padding: '8px', width: '100%', height: '100%', justifyContent: 'center' }}>
            <span style={{ fontSize: '26px' }}>🔮</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                // 选中当前节点，从而呼出右侧高级悬浮菜单
                setNodes(nds => nds.map(n => n.id === id ? { ...n, selected: true } : n));
              }}
              style={{
                background: 'rgba(168, 85, 247, 0.1)',
                border: '1px solid rgba(168, 85, 247, 0.3)',
                borderRadius: '8px',
                padding: '4px 10px',
                color: '#e9d5ff',
                fontSize: '10px',
                cursor: 'pointer',
                fontWeight: 600,
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(168, 85, 247, 0.25)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(168, 85, 247, 0.1)'}
            >
              ⚙️ 点击配置参数
            </button>
          </div>
        )}

        {/* 统一高保真进度条 */}
        {isRunning && (
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
            <span style={{ fontSize: '20px', animation: 'spin 1.5s linear infinite', display: 'block' }}>🔄</span>
            <span 
              style={{ 
                fontSize: '10px', 
                color: 'rgba(168, 85, 247, 1)', 
                fontWeight: 600, 
                marginTop: '8px',
                textAlign: 'center'
              }}
            >
              执行中并轮询中...
            </span>
          </div>
        )}
      </div>

      {/* 绝对定位浮动 ConfigPanel */}
      {selected && (
        <div
          className="nodrag glass-panel"
          onMouseDown={(e) => e.stopPropagation()}
          style={{
            position: 'absolute',
            left: '196px',
            top: '0px',
            width: '320px',
            zIndex: 50,
            borderRadius: '16px',
            background: 'rgba(11, 15, 25, 0.95)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5), 0 0 15px rgba(168, 85, 247, 0.15)',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
            maxHeight: '440px',
            overflowY: 'auto',
            animation: 'slideInPopup 0.2s ease'
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '8px' }}>
            <h4 style={{ fontSize: '12px', fontWeight: 700, color: '#fff', margin: 0 }}>
              🔮 工作流高级配置菜单
            </h4>
            <span style={{ fontSize: '9px', background: 'rgba(255,255,255,0.06)', padding: '2px 6px', borderRadius: '4px', color: 'rgba(255,255,255,0.5)' }}>
              {source === 'local_comfyui' ? 'ComfyUI API' : 'RunningHub'}
            </span>
          </div>

          {/* Body */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            
            {/* 1. 文本输入区 (Prompt) */}
            {textParams.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {textParams.map(map => {
                  const connected = isPortConnected(map.portId);
                  const connectedVal = connected ? getConnectedVal(map.portId) : '';
                  const displayVal = connected ? connectedVal : (data.inputs?.[map.portId] || '');
                  return (
                    <div key={map.portId} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', fontWeight: 600, display: 'flex', justifyContent: 'space-between' }}>
                        <span>{map.displayName || map.portId}</span>
                        {connected && <span style={{ color: '#8b5cf6' }}>🔗 连线驱动中</span>}
                      </label>
                      <WorkflowTextarea
                        disabled={connected}
                        value={displayVal}
                        onChange={(val) => handleParamChange(map.portId, val)}
                        mentionItems={connected ? [{ id: `${map.portId}-upstream`, name: '上游连线输入', type: 'text', token: '@[文本1] ' }] : []}
                        placeholder={connected ? '🔗 连线驱动中...' : '请输入提示词或文本...'}
                        style={{
                          padding: '6px 10px',
                          color: connected ? '#a3a3a3' : '#fff',
                          fontFamily: 'inherit'
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            )}

            {/* 2. 图像参考区 (Reference Images) */}
            {imageParams.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {imageParams.map(map => {
                  const connected = isPortConnected(map.portId);
                  const connectedVal = connected ? getConnectedVal(map.portId) : '';
                  const displayVal = connected ? connectedVal : (data.inputs?.[map.portId] || '');
                  let finalImgUrl = displayVal;
                  if (displayVal.startsWith('db://')) {
                    const mediaId = displayVal.replace('db://', '');
                    finalImgUrl = `http://localhost:3000/api/v1/assets/media/${mediaId}`;
                  }
                  return (
                    <div key={map.portId} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', fontWeight: 600, display: 'flex', justifyContent: 'space-between' }}>
                        <span>{map.displayName || map.portId}</span>
                        {connected && <span style={{ color: '#8b5cf6' }}>🔗 连线驱动中</span>}
                      </label>
                      
                      {connected ? (
                        <div style={{ padding: '10px', background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(139,92,246,0.3)', borderRadius: '8px', fontSize: '10px', color: '#a3a3a3', textAlign: 'center' }}>
                          🔗 图像连线驱动中
                        </div>
                      ) : (
                        <div
                          onClick={() => document.getElementById(`upload-input-${map.portId}`)?.click()}
                          style={{
                            height: '70px',
                            border: '1px dashed rgba(255,255,255,0.15)',
                            borderRadius: '8px',
                            background: 'rgba(0,0,0,0.2)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            overflow: 'hidden',
                            position: 'relative'
                          }}
                        >
                          {displayVal ? (
                            <img src={finalImgUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)' }}>📥 点击上传参考图</span>
                          )}
                          <input
                            type="file"
                            accept="image/*"
                            id={`upload-input-${map.portId}`}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                const reader = new FileReader();
                                reader.onload = async (evt) => {
                                  const b64 = evt.target?.result as string;
                                  if (b64) {
                                    // 统一走 MinIO 上传，不再写入 db:// 或 IndexedDB
                                    try {
                                      const minioUrl = await UploadService.uploadBase64(
                                        b64,
                                        `ref-image-${Date.now()}.png`,
                                        'image'
                                      );
                                      handleParamChange(map.portId, minioUrl);
                                    } catch (err) {
                                      console.error('[CustomWorkflowNode] MinIO 上传失败:', err);
                                      // MinIO 失败时直接报错，不降级到 db://
                                      alert('图片上传失败，请检查 MinIO 存储服务是否正常运行。');
                                    }
                                  }
                                };
                                reader.readAsDataURL(file);
                              }
                            }}
                            style={{ display: 'none' }}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* 3. 微调数值与自定义参数区 */}
            {customParams.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '10px' }}>
                <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', fontWeight: 600 }}>🎛️ 自定义微调参数</span>
                {customParams.map(map => {
                  const connected = isPortConnected(map.portId);
                  const connectedVal = connected ? getConnectedVal(map.portId) : '';
                  const displayVal = connected ? connectedVal : (data.inputs?.[map.portId] || '');
                  const key = map.fieldName.toLowerCase();

                  const isSlider = key.includes('cfg') || key.includes('denoise') || key.includes('steps');
                  const minVal = key.includes('denoise') ? 0 : 1;
                  const maxVal = key.includes('denoise') ? 1 : (key.includes('cfg') ? 20 : 100);
                  const stepVal = key.includes('denoise') ? 0.01 : (key.includes('cfg') ? 0.1 : 1);

                  return (
                    <div key={map.portId} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '10px', color: '#e9d5ff' }}>{map.displayName || map.portId}</span>
                        <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace' }}>{displayVal}</span>
                      </div>

                      {connected ? (
                        <div style={{ padding: '6px', background: 'rgba(255,255,255,0.01)', border: '1px dashed rgba(139,92,246,0.2)', borderRadius: '4px', fontSize: '9px', color: '#a3a3a3', textAlign: 'center' }}>
                          🔗 连线驱动中
                        </div>
                      ) : isSlider ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <input
                            type="range"
                            min={minVal}
                            max={maxVal}
                            step={stepVal}
                            value={parseFloat(displayVal) || minVal}
                            className="nodrag"
                            onMouseDown={(e) => e.stopPropagation()}
                            onChange={(e) => handleParamChange(map.portId, e.target.value)}
                            style={{ flex: 1, height: '4px', borderRadius: '2px', background: 'rgba(255,255,255,0.1)', outline: 'none' }}
                          />
                        </div>
                      ) : (
                        <input
                          type="text"
                          value={displayVal}
                          className="nodrag"
                          onMouseDown={(e) => e.stopPropagation()}
                          onChange={(e) => handleParamChange(map.portId, e.target.value)}
                          placeholder="手动输入参数..."
                          style={{
                            width: '100%',
                            background: 'rgba(0,0,0,0.25)',
                            border: '1px solid rgba(255,255,255,0.08)',
                            borderRadius: '4px',
                            padding: '4px 8px',
                            color: '#fff',
                            fontSize: '10px',
                            outline: 'none',
                            fontFamily: 'monospace'
                          }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}

          </div>

          {/* ⚡ 开始运行单节点物理按钮 */}
          <button
            onClick={handleExecuteSingleNode}
            disabled={isRunning}
            style={{
              width: '100%',
              padding: '8px 12px',
              background: isRunning 
                ? 'rgba(255,255,255,0.06)' 
                : 'linear-gradient(135deg, hsl(var(--accent-primary)), hsl(var(--accent-secondary)))',
              border: 'none',
              borderRadius: '8px',
              color: isRunning ? 'rgba(255,255,255,0.3)' : '#fff',
              fontSize: '11px',
              fontWeight: 700,
              cursor: isRunning ? 'not-allowed' : 'pointer',
              boxShadow: isRunning ? 'none' : '0 4px 12px hsl(var(--accent-primary) / 0.25)',
              transition: 'all 0.2s ease',
              marginTop: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
            onMouseEnter={(e) => {
              if (!isRunning) {
                e.currentTarget.style.transform = 'scale(1.01)';
                e.currentTarget.style.boxShadow = '0 6px 16px hsl(var(--accent-primary) / 0.35)';
              }
            }}
            onMouseLeave={(e) => {
              if (!isRunning) {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.boxShadow = '0 4px 12px hsl(var(--accent-primary) / 0.25)';
              }
            }}
          >
            {isRunning ? '🔄 物理计算中...' : '⚡ 开始运行工作流'}
          </button>
        </div>
      )}

      {/* 嵌入高阶 CSS */}
      <style>{`
        .react-flow__handle {
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1) !important;
        }
        .react-flow__handle:hover {
          transform: translateY(-50%) scale(1.3) !important;
          background: rgba(168, 85, 247, 1) !important;
          border-color: #fff !important;
          box-shadow: 0 0 18px rgba(168, 85, 247, 0.95) !important;
        }
        .react-flow__handle::after {
          content: '';
          position: absolute;
          top: -14px;
          left: -14px;
          right: -14px;
          bottom: -14px;
          border-radius: 50%;
          background: transparent;
          cursor: crosshair;
          z-index: 10;
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>

      {/* ReactFlow 连接桩 Handle */}
      {/* 输入连接口 - 支持多个端口，根据 mappings 垂直等分分布在左边缘 */}
      {mappings.map((map, idx) => (
        <Handle
          key={map.portId}
          type="target"
          position={Position.Left}
          id={map.portId}
          style={{
            width: '10px',
            height: '10px',
            background: 'rgba(15, 23, 42, 0.95)',
            border: isPortConnected(map.portId) ? '2px solid rgba(168, 85, 247, 1)' : '2.5px solid rgba(255, 255, 255, 0.45)',
            borderRadius: '50%',
            left: '-6px',
            top: `${((idx + 1) * 100) / (mappings.length + 1)}%`,
            transform: 'translateY(-50%)',
            boxShadow: isPortConnected(map.portId) ? '0 0 8px rgba(168, 85, 247, 0.65)' : 'none',
            zIndex: 10
          }}
          title={map.displayName || map.portId}
        />
      ))}

      {/* 输出连接口 - 居右边缘中心 */}
      <Handle
        type="source"
        position={Position.Right}
        id="output"
        style={{
          width: '10px',
          height: '10px',
          background: 'rgba(15, 23, 42, 0.95)',
          border: outputUrl ? '2px solid rgba(168, 85, 247, 1)' : '2.5px solid rgba(255, 255, 255, 0.45)',
          borderRadius: '50%',
          right: '-6px',
          top: '50%',
          transform: 'translateY(-50%)',
          boxShadow: outputUrl ? '0 0 8px rgba(168, 85, 247, 0.65)' : 'none',
          zIndex: 10
        }}
      />
    </div>
  );
}
