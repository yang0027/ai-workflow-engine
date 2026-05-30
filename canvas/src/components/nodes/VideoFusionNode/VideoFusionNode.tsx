// VideoFusionNode.tsx
// 视频合成节点 UI 组件

import { useState, useMemo } from 'react';
import { Handle, Position, useReactFlow, useStore, useNodes } from '@xyflow/react';
import { useVideoNodeLogic } from '../video-sub-components/useVideoNodeLogic';
import ConfigPanel from '../video-sub-components/ConfigPanel';
import { getUpstreamData } from '../../../hooks/getUpstreamData';
import { VideoFusionNodeProps } from './VideoFusionNode.config';
import { ResolvedMedia } from '../../ResolvedMedia';

export default function VideoFusionNode({ id, data, selected }: VideoFusionNodeProps) {
  const { setNodes, setEdges } = useReactFlow();
  const edges = useStore((state) => state.edges);
  const nodes = useNodes();

  // 多选检测：只有单选时才显示菜单
  const isMultiSelected = useStore((state) => {
    return state.nodes.filter(n => n.selected).length > 1;
  });

  // 1. 连线与上游数据（使用统一 getUpstreamData 钩子重构）
  const upstreamData = useMemo(() => getUpstreamData(id, edges, nodes), [id, edges, nodes]);
  
  // 智能提取 Prompt、首帧图像、视频参考、声音参考
  const connectedPrompt = upstreamData.text;
  const connectedRefImage = upstreamData.image;
  const connectedRefVideo = upstreamData.video;
  const connectedRefAudio = upstreamData.audio;

  // 2. 挂载高度解耦自定义 Hooks，彻底剥离业务核心逻辑与复杂状态
  const logic = useVideoNodeLogic({
    id,
    data,
    setNodes,
    setEdges,
    edges,
    nodes
  });

  const {
    fusing,
    fusedVideo,
    isFullscreen,
    setIsFullscreen,
    isEditingName,
    setIsEditingName,
    localName,
    setLocalName,
    handleSaveName,
    handleDownloadVideo,
    handleSpawnSingleUpload,
    handleSpawnDoubleUpload,
    handleSpawnTripleUpload,
    handleDeleteNode
  } = logic;

  // 翅膀翼智能派生状态
  const [showLeftDerive, setShowLeftDerive] = useState(false);
  const [showRightDerive, setShowRightDerive] = useState(false);

  const upstreamTypes = [
    { type: 'image-service', label: '🎨 智能生图 Agent' },
    { type: 'tts-service', label: '🗣️ 声音克隆 Agent' }
  ];
  const downstreamTypes = [
    { type: 'grid-splitter', label: '⊞ 宫格排版合成' }
  ];

  const progressPercent = data.progress !== undefined ? data.progress : (fusing ? 45 : 0);
  const showVid = fusedVideo || data.outputs?.video;

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
      className="relative text-left video-node-container custom-drag-handle" 
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
          onClick={handleDeleteNode}
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
      {isEditingName ? (
        <input
          value={localName}
          onChange={(e) => setLocalName(e.target.value)}
          onBlur={handleSaveName}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSaveName();
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
          onDoubleClick={() => setIsEditingName(true)}
          title="双击以重命名"
        >
          <span>{localName}</span>
          <span
            onClick={(e) => { e.stopPropagation(); setIsEditingName(true); }}
            style={{ cursor: 'pointer', opacity: 0.5, fontSize: '9px', userSelect: 'none' }}
            title="点击重命名"
          >
            ✏️
          </span>
        </div>
      )}

      {/* 节点主体渲染 - ToonFlow 磨砂毛玻璃影视海报拟态 */}
      <div 
        className="glass-card"
        style={{
          width: '100%',
          height: '100%',
          background: showVid
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
        {/* 全屏与下载浮动层 */}
        {showVid && selected && (
          <div style={{ position: 'absolute', top: '8px', right: '8px', display: 'flex', gap: '6px', zIndex: 20 }}>
            <button 
              onClick={(e) => { 
                e.stopPropagation(); 
                if (typeof (window as any).setFullScreenMedia === 'function') {
                  (window as any).setFullScreenMedia({ url: showVid, type: 'video', nodeId: id });
                } else {
                  setIsFullscreen(true);
                }
              }}
              style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'rgba(15,23,42,0.85)', border: '1px solid rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '11px', cursor: 'pointer', outline: 'none' }}
              title="全屏放映"
            >
              ⛶
            </button>
          </div>
        )}

        {/* 失败兜底与播放 */}
        {data.outputs?.errorMsg ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', padding: '12px', textAlign: 'center', background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.15) 0%, rgba(20, 10, 10, 0.8) 100%)', width: '100%', height: '100%', borderRadius: '15px' }}>
            <span style={{ fontSize: '24px', animation: 'pulse 1.5s infinite' }}>⚠️</span>
            <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#ef4444' }}>合成失败</span>
            <span style={{ fontSize: '8px', color: 'rgba(255,255,255,0.4)', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', lineHeight: '1.3', maxHeight: '32px' }} title={data.outputs.errorMsg}>
              {data.outputs.errorMsg}
            </span>
          </div>
        ) : showVid ? (
          <ResolvedMedia 
            url={showVid} 
            type="video" 
            controls 
            style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '15px' }} 
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', padding: '8px', width: '100%', justifyContent: 'center' }}>
            <span style={{ fontSize: '20px' }}>📹</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '100%', alignItems: 'center' }}>
              <button
                onClick={(e) => { e.stopPropagation(); handleSpawnSingleUpload(); }}
                style={{ background: 'rgba(168, 85, 247, 0.1)', border: '1px solid rgba(168, 85, 247, 0.3)', borderRadius: '8px', padding: '3px 6px', color: '#e9d5ff', fontSize: '9px', cursor: 'pointer', width: '95%', textAlign: 'center', fontWeight: 600 }}
              >
                📹 单帧图片生视频
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); handleSpawnDoubleUpload(); }}
                style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '8px', padding: '3px 6px', color: '#d1fae5', fontSize: '9px', cursor: 'pointer', width: '95%', textAlign: 'center', fontWeight: 600 }}
              >
                ↔️ 双向首尾插帧
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); handleSpawnTripleUpload(); }}
                style={{ background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.3)', borderRadius: '8px', padding: '3px 6px', color: '#bfdbfe', fontSize: '9px', cursor: 'pointer', width: '95%', textAlign: 'center', fontWeight: 600 }}
              >
                🧬 极致多轨音视频融合
              </button>
            </div>
          </div>
        )}

        {/* 动态渲染进度条 */}
        {(fusing || (data.progress !== undefined && data.progress < 100)) && (
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(9, 13, 22, 0.8)', backdropFilter: 'blur(8px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderRadius: '15px', zIndex: 10, padding: '0 16px' }}>
            <span style={{ fontSize: '11px', color: 'rgba(168, 85, 247, 1)', fontWeight: 600, marginBottom: '8px', textAlign: 'center' }}>
              🎬 视频超感融合渲染中... {progressPercent}%
            </span>
            <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', overflow: 'hidden' }}>
              <div style={{ width: `${progressPercent}%`, height: '100%', background: 'linear-gradient(90deg, #a855f7 0%, #ec4899 100%)', borderRadius: '2px', transition: 'width 0.2s' }} />
            </div>
          </div>
        )}
      </div>

      {/* 极窄配置面板 (图二规范) - 直接内挂在节点 DOM 内 */}
      {selected && !isMultiSelected && (
        <ConfigPanel
          id={id}
          data={data}
          logic={logic}
        />
      )}

      {/* 嵌入高阶 CSS：控制 Handle 磁力自动吸附与高级过渡动画 */}
      <style>{`
        .video-node-container .react-flow__handle {
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1) !important;
        }
        .video-node-container .react-flow__handle:hover {
          transform: translateY(-50%) scale(1.3) !important;
          background: rgba(168, 85, 247, 1) !important;
          border-color: #fff !important;
          box-shadow: 0 0 18px rgba(168, 85, 247, 0.95) !important;
        }
        .video-node-container .react-flow__handle::after {
          content: '';
          position: absolute;
          top: -4px;
          left: -4px;
          right: -4px;
          bottom: -4px;
          border-radius: 50%;
          background: transparent;
          cursor: crosshair;
          z-index: 10;
        }
      `}</style>

      {/* ReactFlow 连接桩 Handle */}
      <Handle
        type="target"
        position={Position.Left}
        id="input"
        style={{
          ...handleStyle,
          left: '-12px',
          opacity: selected ? 1 : 0,
          pointerEvents: selected ? 'all' : 'none',
          borderColor: (connectedPrompt.length > 0 || connectedRefImage.length > 0 || connectedRefVideo.length > 0 || connectedRefAudio.length > 0) ? 'rgba(168, 85, 247, 1)' : 'rgba(255,255,255,0.2)',
          boxShadow: (connectedPrompt.length > 0 || connectedRefImage.length > 0 || connectedRefVideo.length > 0 || connectedRefAudio.length > 0) ? '0 0 10px rgba(168, 85, 247, 0.45)' : 'none',
          visibility: selected ? 'visible' : 'hidden'
        }}
      >
        <span style={{ fontSize: '13px', pointerEvents: 'none', transform: 'translateY(-1.5px)', display: 'block', fontWeight: 'bold' }}>+</span>
      </Handle>

      <Handle
        type="source"
        position={Position.Right}
        id="video"
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
            justifyContent: center;
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
