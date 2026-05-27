import React, { useMemo, useState } from 'react';
import { Handle, Position, useReactFlow, useStore, useNodes } from '@xyflow/react';
import { useTTSNodeLogic } from './tts-sub-components/useTTSNodeLogic';
import { NodeVisual } from './tts-sub-components/NodeVisual';
import { ConfigPanel } from './tts-sub-components/ConfigPanel';

interface TTSServiceNodeProps {
  id: string;
  data: any;
  selected?: boolean;
}

export default function TTSServiceNode({ id, data, selected = false }: TTSServiceNodeProps) {
  const { setNodes, setEdges } = useReactFlow();

  // 多选检测：只有单选时才显示菜单
  const isMultiSelected = useStore((state) => {
    return state.nodes.filter(n => n.selected).length > 1;
  });

  // 智能管线导流舱菜单状态
  const [showLeftDerive, setShowLeftDerive] = useState(false);
  const [showRightDerive, setShowRightDerive] = useState(false);

  const upstreamTypes = [
    { type: 'llm-service', label: '🧠 剧本分镜专家' }
  ];
  const downstreamTypes = [
    { type: 'video-fusion', label: '📹 视频合成 Fusion' }
  ];

  // 1. 连线与智能流入自愈解析器
  const edges = useStore((state) => state.edges);
  const nodes = useNodes();

  const { connectedPrompt, connectedRefAudio } = useMemo(() => {
    const connectedEdges = edges.filter(e => e.target === id && e.targetHandle === 'input');
    const connectedPrompts: string[] = [];
    const connectedAuds: string[] = [];

    connectedEdges.forEach(edge => {
      const srcNode = nodes.find(n => n.id === edge.source);
      if (!srcNode) return;
      const outputs = (srcNode.data?.outputs || {}) as any;
      const inputs = (srcNode.data?.inputs || {}) as any;
      const val = outputs.output || outputs.audio || outputs.text || outputs.prompt || outputs.storyboard || inputs.fileUrl || inputs.text || '';
      if (!val) return;

      if (typeof val === 'string') {
        const lowerVal = val.toLowerCase();
        if (srcNode.type === 'tts-service' || lowerVal.includes('audio') || val.endsWith('.mp3') || val.endsWith('.wav') || val.endsWith('.ogg') || val.endsWith('.m4a') || val.startsWith('data:audio/')) {
          connectedAuds.push(val);
        } else {
          connectedPrompts.push(val);
        }
      }
    });

    return {
      connectedPrompt: connectedPrompts.join('\n'),
      connectedRefAudio: connectedAuds[0] || ''
    };
  }, [edges, nodes, id]);

  const isTextConnected = !!connectedPrompt;
  const isRefAudioConnected = !!connectedRefAudio;

  // 2. 引入解耦后的业务逻辑 Hooks
  const logic = useTTSNodeLogic({
    id,
    data,
    setNodes,
    setEdges,
    connectedPrompt,
    connectedRefAudio,
    isRefAudioConnected,
    isTextConnected
  });

  const progressPercent = data.progress !== undefined ? data.progress : (logic.cloning ? 45 : 0);
  const showAud = logic.clonedAudio || data.outputs?.audio;
  const currentText = isTextConnected ? connectedPrompt : (data.inputs?.text || '');

  // 3. ReactFlow 连线 Handle 高保真样式
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
      className="relative text-left tts-node-container custom-drag-handle" 
      style={{
        position: 'relative',
        width: '180px',
        height: '180px',
        fontFamily: 'var(--font-sans)',
        userSelect: 'none'
      }}
    >
      {/* 物理删除悬浮按钮 */}
      {selected && !isMultiSelected && (
        <button
          onClick={logic.handleDelete}
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
      {logic.isEditingName ? (
        <input
          value={logic.localName}
          onChange={(e) => logic.setLocalName(e.target.value)}
          onBlur={logic.handleSaveName}
          onKeyDown={(e) => {
            if (e.key === 'Enter') logic.handleSaveName();
          }}
          autoFocus
          className="nodrag"
          style={{
            position: 'absolute',
            top: '-28px',
            left: '12px',
            background: 'rgba(0,0,0,0.3)',
            border: '1px solid rgba(168, 85, 247, 0.6)',
            borderRadius: '4px',
            padding: '2px 6px',
            color: '#fff',
            fontSize: '11px',
            fontWeight: 700,
            width: '120px',
            outline: 'none',
            zIndex: 15
          }}
        />
      ) : (
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
            cursor: 'text',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            zIndex: 15
          }}
          onDoubleClick={() => logic.setIsEditingName(true)}
          title="双击以重命名"
        >
          <span>{logic.localName}</span>
          <span
            onClick={(e) => { e.stopPropagation(); logic.setIsEditingName(true); }}
            style={{ cursor: 'pointer', opacity: 0.5, fontSize: '9px', userSelect: 'none' }}
            title="点击重命名"
          >
            ✏️
          </span>
        </div>
      )}

      {/* 节点主体渲染 */}
      <NodeVisual
        id={id}
        data={data}
        selected={selected}
        localName={logic.localName}
        isEditingName={logic.isEditingName}
        showAud={showAud}
        isPlaying={logic.isPlaying}
        cloning={logic.cloning}
        progressPercent={progressPercent}
        audioPreviewRef={logic.audioPreviewRef}
        setLocalName={logic.setLocalName}
        setIsEditingName={logic.setIsEditingName}
        setIsPlaying={logic.setIsPlaying}
        handleSaveName={logic.handleSaveName}
        handleDelete={logic.handleDelete}
        handleDownloadAudio={logic.handleDownloadAudio}
        handleTogglePlay={logic.handleTogglePlay}
        handleSpawnPromptSource={logic.handleSpawnPromptSource}
        handleSpawnAudioUpload={logic.handleSpawnAudioUpload}
      />

      {/* 底部悬浮配置面板 */}
      {selected && !isMultiSelected && (
        <ConfigPanel
          id={id}
          data={data}
          activeTab={logic.activeTab}
          providerId={logic.providerId}
          activeProviders={logic.activeProviders}
          settings={logic.settings}
          currentRefAudio={logic.currentRefAudio}
          isRefAudioConnected={isRefAudioConnected}
          currentText={currentText}
          isTextConnected={isTextConnected}
          currentProviderModels={logic.currentProviderModels}
          model={logic.model}
          characterName={logic.characterName}
          mode={logic.mode}
          cloning={logic.cloning}
          currentTemplate={logic.currentTemplate}
          unifiedParams={logic.unifiedParams}
          fileInputRef={logic.fileInputRef}
          handleTabChange={logic.handleTabChange}
          handleOpenAssetsModal={logic.handleOpenAssetsModal}
          handleFileChange={logic.handleFileChange}
          handleInputChange={logic.handleInputChange}
          handleVoiceClone={logic.handleVoiceClone}
        />
      )}

      {/* ReactFlow 连接桩 Handle */}
      {/* 输入端口 - 智能接收文本连线 */}
      <Handle
        type="target"
        position={Position.Left}
        id="input"
        style={{
          ...handleStyle,
          left: '-12px',
          opacity: selected ? 1 : 0,
          pointerEvents: selected ? 'all' : 'none',
          visibility: selected ? 'visible' : 'hidden',
          borderColor: isTextConnected ? 'rgba(168, 85, 247, 1)' : 'rgba(255,255,255,0.2)',
          boxShadow: isTextConnected ? '0 0 10px rgba(168, 85, 247, 0.45)' : 'none'
        }}
      >
        <span style={{ fontSize: '13px', pointerEvents: 'none', transform: 'translateY(-1.5px)', display: 'block', fontWeight: 'bold' }}>+</span>
      </Handle>

      {/* 输出端口 - 音频生成流向下游 */}
      <Handle
        type="source"
        position={Position.Right}
        id="audio"
        style={{
          ...handleStyle,
          right: '-12px',
          opacity: selected ? 1 : 0,
          pointerEvents: selected ? 'all' : 'none',
          visibility: selected ? 'visible' : 'hidden'
        }}
      >
        <span style={{ fontSize: '13px', pointerEvents: 'none', transform: 'translateY(-1.5px)', display: 'block', fontWeight: 'bold' }}>+</span>
      </Handle>

      {/* 🧬 左右翼智能管线导流舱 (Derive Wings) */}
      <div 
        className="derive-wings-overlay"
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          zIndex: 40,
          display: 'none'
        }}
      >
        <style>{`
          .derive-wing-btn {
            pointer-events: all;
            width: 20px;
            height: 48px;
            border-radius: 6px;
            background: rgba(15, 23, 42, 0.9);
            backdrop-filter: blur(8px);
            border: 1px solid rgba(168, 85, 247, 0.4);
            color: rgba(168, 85, 247, 1);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 11px;
            cursor: pointer;
            box-shadow: 0 0 10px rgba(168, 85, 247, 0.25);
            transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
            position: absolute;
            top: 50%;
            transform: translateY(-50%);
            opacity: 0;
            padding: 0;
          }
          /* 当 Hover 节点容器时，浮现两侧导流翅膀 */
          .tts-node-container:hover .derive-wing-btn,
          .tts-node-container:focus-within .derive-wing-btn {
            opacity: 1;
          }
          .derive-wing-btn:hover {
            background: rgba(168, 85, 247, 0.95);
            color: #fff;
            border-color: #fff;
            box-shadow: 0 0 18px rgba(168, 85, 247, 0.75);
          }
          .derive-menu-list {
            position: absolute;
            top: 50%;
            transform: translateY(-50%);
            background: rgba(11, 15, 25, 0.98);
            backdrop-filter: blur(20px);
            border: 1px solid rgba(168, 85, 247, 0.5);
            border-radius: 8px;
            padding: 4px;
            display: flex;
            flex-direction: column;
            gap: 4px;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.75), 0 0 20px rgba(168, 85, 247, 0.3);
            z-index: 100;
            pointer-events: all;
            animation: fadeIn 0.15s ease-out;
            width: 130px;
          }
          .derive-menu-item {
            width: 100%;
            padding: 6px 10px;
            border: none;
            background: transparent;
            color: rgba(255, 255, 255, 0.85);
            font-size: 11px;
            font-weight: 500;
            text-align: left;
            cursor: pointer;
            border-radius: 6px;
            transition: all 0.15s;
          }
          .derive-menu-item:hover {
            background: rgba(168, 85, 247, 0.2);
            color: #fff;
            transform: translateX(3px);
          }
        `}</style>

        {/* 左翼：溯源 */}
        {upstreamTypes.length > 0 && (
          <div style={{ position: 'absolute', left: '-22px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
            <button 
              className="derive-wing-btn"
              onClick={() => { setShowLeftDerive(!showLeftDerive); setShowRightDerive(false); }}
              title="一键溯源上游输入"
            >
              ◀
            </button>
            {showLeftDerive && (
              <div className="derive-menu-list" style={{ right: '28px' }}>
                <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', fontWeight: 'bold', padding: '4px 8px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>🔌 接入上游输入:</div>
                {upstreamTypes.map(up => (
                  <button 
                    key={up.type} 
                    className="derive-menu-item"
                    onClick={() => {
                      if (typeof (window as any).handleDeriveNode === 'function') {
                        (window as any).handleDeriveNode(id, up.type, 'upstream');
                      }
                      setShowLeftDerive(false);
                    }}
                  >
                    {up.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 右翼：派生 */}
        {downstreamTypes.length > 0 && (
          <div style={{ position: 'absolute', right: '-22px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
            <button 
              className="derive-wing-btn"
              onClick={() => { setShowRightDerive(!showRightDerive); setShowLeftDerive(false); }}
              title="一键派生下游输出"
            >
              ▶
            </button>
            {showRightDerive && (
              <div className="derive-menu-list" style={{ left: '28px' }}>
                <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', fontWeight: 'bold', padding: '4px 8px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>⚡ 派生下游成果:</div>
                {downstreamTypes.map(down => (
                  <button 
                    key={down.type} 
                    className="derive-menu-item"
                    onClick={() => {
                      if (typeof (window as any).handleDeriveNode === 'function') {
                        (window as any).handleDeriveNode(id, down.type, 'downstream');
                      }
                      setShowRightDerive(false);
                    }}
                  >
                    {down.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
