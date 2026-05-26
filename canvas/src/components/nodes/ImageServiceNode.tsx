import React, { useMemo } from 'react';
import { Handle, Position, useReactFlow, useStore, useNodes, NodeToolbar } from '@xyflow/react';
import { useImageNodeLogic } from './image-sub-components/useImageNodeLogic';
import { NodeVisual } from './image-sub-components/NodeVisual';
import { ConfigPanel } from './image-sub-components/ConfigPanel';

interface ImageServiceNodeProps {
  id: string;
  data: any;
  selected?: boolean;
}

export default function ImageServiceNode({ id, data, selected = false }: ImageServiceNodeProps) {
  const { setNodes, setEdges } = useReactFlow();

  // 多选检测：只有单选时才显示菜单
  const isMultiSelected = useStore((state) => {
    return state.nodes.filter(n => n.selected).length > 1;
  });

  // 智能管线导流舱菜单状态
  const [showLeftDerive, setShowLeftDerive] = React.useState(false);
  const [showRightDerive, setShowRightDerive] = React.useState(false);

  const upstreamTypes = [
    { type: 'llm-service', label: '🧠 剧本分镜专家' },
    { type: 'upload-node', label: '📦 本地上传' }
  ];
  const downstreamTypes = [
    { type: 'video-fusion', label: '📹 视频合成 Fusion' },
    { type: 'grid-splitter', label: '⊞ 智能切片' },
    { type: 'loop-node', label: '🔄 循环迭代' }
  ];

  // 1. 连线与上游智能流入提取
  const edges = useStore((state) => state.edges);
  const nodes = useNodes();

  // 2. 引入逻辑解耦 Hook
  const logic = useImageNodeLogic({
    id,
    data,
    setNodes,
    setEdges,
    edges,
    nodes
  });

  const progressPercent = data.progress !== undefined ? data.progress : (logic.generating ? 45 : 0);
  const showImg = logic.generatedImg || data.outputs?.image;
  const currentPrompt = logic.isPromptConnected ? logic.connectedPrompt : logic.promptInput;

  // 3. 连接手柄 Handle 的高保真样式
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
        showImg={showImg}
        generating={logic.generating}
        progressPercent={progressPercent}
        setLocalName={logic.setLocalName}
        setIsEditingName={logic.setIsEditingName}
        setIsFullscreen={logic.setIsFullscreen}
        handleSaveName={logic.handleSaveName}
        handleDelete={logic.handleDelete}
        handleDownloadImage={logic.handleDownloadImage}
        handleSpawnPromptSource={logic.handleSpawnPromptSource}
        handleSpawnUploadNode={() => logic.setActivePopover('gallery')} // 选中图像时直接激活画廊浮窗
      />

      {/* 极窄配置命令面板 (图二规范) - 直接内挂在节点 DOM 内，享受浏览器 GPU 级别的绝对同步，绝无分离 */}
      {selected && !isMultiSelected && (
        <ConfigPanel
          id={id}
          data={data}
          providerId={logic.providerId}
          size={logic.size}
          cfg={logic.cfg}
          steps={logic.steps}
          refImages={logic.refImages}
          promptInput={logic.promptInput}
          showMentionList={logic.showMentionList}
          mentionSearch={logic.mentionSearch}
          connectedImages={logic.connectedImages}
          activeTab={logic.activeTab}
          currentTemplate={logic.currentTemplate}
          currentProviderModels={logic.currentProviderModels}
          model={logic.model}
          currentPrompt={currentPrompt}
          isPromptConnected={logic.isPromptConnected}
          isFaceRefConnected={logic.isFaceRefConnected}
          generating={logic.generating}
          activePopover={logic.activePopover}
          fileInputRef={logic.fileInputRef}
          handleTabChange={logic.handleTabChange}
          handleInputChange={logic.handleInputChange}
          handleFileChange={logic.handleFileChange}
          handleRemoveRefImage={logic.handleRemoveRefImage}
          handleOpenAssetsModal={logic.handleOpenAssetsModal}
          handleSelectMention={logic.handleSelectMention}
          handlePromptChange={logic.handlePromptChange}
          handleGenerateImage={logic.handleGenerateImage}
          handleDownloadImage={logic.handleDownloadImage}
          setActivePopover={logic.setActivePopover}
          handleAddRefImagePhysicalNode={logic.handleAddRefImagePhysicalNode}
        />
      )}

      {/* 嵌入高阶 CSS：控制 Handle 磁力自动吸附与高级过渡动画 */}
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
        /* 物理大热区：让指针靠近 14px 时即可自动感应并吸附连线，体验流畅至极 */
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
      `}</style>

      {/* ReactFlow 连接桩 Handle */}
      {/* 输入连接口 - 支持来自 Prompt 或 Upload 的流 */}
      <Handle
        type="target"
        position={Position.Left}
        id="input"
        style={{
          ...handleStyle,
          left: '-12px',
          opacity: selected ? 1 : 0,
          pointerEvents: selected ? 'all' : 'none',
          borderColor: (logic.isPromptConnected || logic.isFaceRefConnected) ? 'rgba(168, 85, 247, 1)' : 'rgba(255,255,255,0.2)',
          boxShadow: (logic.isPromptConnected || logic.isFaceRefConnected) ? '0 0 10px rgba(168, 85, 247, 0.45)' : 'none',
          visibility: selected ? 'visible' : 'hidden'
        }}
      >
        <span style={{ fontSize: '13px', pointerEvents: 'none', transform: 'translateY(-1.5px)', display: 'block', fontWeight: 'bold' }}>+</span>
      </Handle>

      {/* 输出连接口 */}
      <Handle
        type="source"
        position={Position.Right}
        id="image"
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
          .relative:hover .derive-wing-btn,
          .relative:focus-within .derive-wing-btn {
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

        {/* 左翼：溯源 (仅在 upstreamTypes 存在且长度大于 0 时渲染) */}
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
