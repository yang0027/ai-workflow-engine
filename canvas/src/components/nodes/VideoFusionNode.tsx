import { useState, useEffect, useRef } from 'react';
import { Handle, Position, useReactFlow, useStore, useNodes } from '@xyflow/react';
import { ResolvedMedia } from '../ResolvedMedia';
import { useVideoNodeLogic } from './video-sub-components/useVideoNodeLogic';
import ConfigPanel from './video-sub-components/ConfigPanel';

interface VideoFusionNodeProps {
  id: string;
  data: {
    label?: string;
    title?: string;
    progress?: number;
    inputs?: {
      prompt?: string;
      refImage?: string;
      refVideo?: string;
      refAudio?: string;
      image?: string;
      audio?: string;
      providerId?: string;
      model?: string;
      width?: number;
      height?: number;
      duration?: number;
      activeTab?: 'standard' | 'aix';
      runningHubTemplateId?: string;
      [key: string]: any;
    };
    outputs?: {
      video?: string;
      errorMsg?: string;
      output?: string;
    };
  };
  selected?: boolean;
}

export default function VideoFusionNode({ id, data, selected }: VideoFusionNodeProps) {
  const { setNodes, setEdges } = useReactFlow();
  const edges = useStore((state) => state.edges);
  const nodes = useNodes();

  // 多选检测：只有单选时才显示菜单
  const isMultiSelected = useStore((state) => {
    return state.nodes.filter(n => n.selected).length > 1;
  });

  // 1. 挂载高度解耦自定义 Hooks，彻底剥离业务核心逻辑与复杂状态
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
      className="relative text-left video-node-container" 
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

      {/* 节点主体 180 * 180 */}
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
        {/* 悬浮下载/全屏小圆纽 */}
        {showVid && selected && !isMultiSelected && (
          <div style={{ position: 'absolute', top: '8px', right: '8px', display: 'flex', gap: '6px', zIndex: 20 }}>
            <button 
              onClick={(e) => { e.stopPropagation(); handleDownloadVideo(); }}
              style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'rgba(15,23,42,0.85)', border: '1px solid rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '11px', cursor: 'pointer', outline: 'none' }}
              title="下载视频"
            >
              ⬇️
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); setIsFullscreen(true); }}
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
        ) : showVid ? (
          <ResolvedMedia 
            url={showVid || ''} 
            type="video"
            autoPlay 
            loop 
            muted 
            playsInline
            style={{ 
              width: '100%', 
              height: '100%', 
              objectFit: 'cover',
              borderRadius: '15px'
            }} 
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', padding: '8px', width: '100%', justifyContent: 'center' }}>
            <span style={{ fontSize: '20px' }}>📹</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '100%', alignItems: 'center' }}>
              <button
                onClick={(e) => { e.stopPropagation(); handleSpawnSingleUpload(); }}
                style={{
                  background: 'rgba(168, 85, 247, 0.1)',
                  border: '1px solid rgba(168, 85, 247, 0.3)',
                  borderRadius: '8px',
                  padding: '4px 6px',
                  color: '#e9d5ff',
                  fontSize: '9px',
                  cursor: 'pointer',
                  width: '95%',
                  textAlign: 'center',
                  fontWeight: 600,
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(168, 85, 247, 0.25)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(168, 85, 247, 0.1)'}
              >
                🎬 图生视频
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); handleSpawnDoubleUpload(); }}
                style={{
                  background: 'rgba(236, 72, 153, 0.1)',
                  border: '1px solid rgba(236, 72, 153, 0.3)',
                  borderRadius: '8px',
                  padding: '4px 6px',
                  color: '#fbcfe8',
                  fontSize: '9px',
                  cursor: 'pointer',
                  width: '95%',
                  textAlign: 'center',
                  fontWeight: 600,
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(236, 72, 153, 0.25)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(236, 72, 153, 0.1)'}
              >
                🎞️ 首尾帧视频
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); handleSpawnTripleUpload(); }}
                style={{
                  background: 'rgba(59, 130, 246, 0.1)',
                  border: '1px solid rgba(59, 130, 246, 0.3)',
                  borderRadius: '8px',
                  padding: '4px 6px',
                  color: '#bfdbfe',
                  fontSize: '9px',
                  cursor: 'pointer',
                  width: '95%',
                  textAlign: 'center',
                  fontWeight: 600,
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(59, 130, 246, 0.25)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(59, 130, 246, 0.1)'}
              >
                🔮 全能参考
              </button>
            </div>
          </div>
        )}

        {/* 统一高保真进度条 */}
        {(fusing || (data.progress !== undefined && data.progress < 100)) && (
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
            <span 
              style={{ 
                fontSize: '11px', 
                color: 'rgba(168, 85, 247, 1)', 
                fontWeight: 600, 
                marginBottom: '8px',
                textAlign: 'center'
              }}
            >
              📹 正在融合成片中... {progressPercent}%
            </span>
            <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
              <div 
                style={{
                  width: `${progressPercent}%`,
                  height: '100%',
                  background: 'linear-gradient(90deg, #a855f7, #ec4899)',
                  transition: 'width 0.3s ease-out'
                }} 
              />
            </div>
          </div>
        )}
      </div>

      {/* 极极简智能连接手柄 Left Input (+) */}
      <Handle
        type="target"
        position={Position.Left}
        id="input"
        style={{
          ...handleStyle,
          left: '-12px',
          opacity: selected ? 1 : 0,
          pointerEvents: selected ? 'all' : 'none',
          visibility: selected ? 'visible' : 'hidden'
        }}
      >
        ＋
      </Handle>

      {/* 极极简智能连接手柄 Right Output (+) */}
      <Handle
        type="source"
        position={Position.Right}
        id="output"
        style={{
          ...handleStyle,
          right: '-12px',
          opacity: selected ? 1 : 0,
          pointerEvents: selected ? 'all' : 'none',
          visibility: selected ? 'visible' : 'hidden'
        }}
      >
        ＋
      </Handle>

      {/* 选中态底部悬浮配置面板 (完美解耦！) */}
      {selected && !isMultiSelected && (
        <ConfigPanel id={id} data={data} logic={logic} />
      )}

      {/* 全屏 Lightbox 高清全屏预览弹层 */}
      {isFullscreen && (
        <div
          style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(5, 7, 12, 0.95)',
            backdropFilter: 'blur(30px)',
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            animation: 'fadeIn 0.25s'
          }}
          onClick={() => setIsFullscreen(false)}
        >
          <div style={{ position: 'relative', width: '80%', height: '80%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
            <ResolvedMedia 
              url={showVid || ''}
              type="video"
              controls
              autoPlay
              style={{
                maxWidth: '100%',
                maxHeight: '85%',
                objectFit: 'contain',
                borderRadius: '16px',
                border: '1.5px solid rgba(255, 255, 255, 0.1)',
                boxShadow: '0 25px 60px rgba(0, 0, 0, 0.8), 0 0 40px rgba(168, 85, 247, 0.2)'
              }}
            />
            <div style={{ color: '#fff', fontSize: '13px', marginTop: '16px', fontWeight: 600, textShadow: '0 2px 4px #000', display: 'flex', gap: '20px', alignItems: 'center', justifyContent: 'center' }}>
              <span>🎬 Toonflow Canvas 高清全屏视频播放预览</span>
              <button 
                onClick={(e) => { e.stopPropagation(); handleDownloadVideo(); }}
                style={{ padding: '6px 16px', background: 'rgba(168, 85, 247, 0.3)', border: '1px solid rgba(168, 85, 247, 0.5)', borderRadius: '6px', color: '#fff', fontSize: '11px', cursor: 'pointer', outline: 'none' }}
              >
                ⬇️ 极速下载视频
              </button>
            </div>
            <button
              onClick={() => setIsFullscreen(false)}
              style={{
                position: 'absolute',
                top: '-40px',
                right: '0',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '50%',
                color: '#fff',
                width: '32px',
                height: '32px',
                fontSize: '16px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              ×
            </button>
          </div>
        </div>
      )}

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
          .video-node-container:hover .derive-wing-btn,
          .video-node-container:focus-within .derive-wing-btn {
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

        {/* 左翼：智能溯源 */}
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

        {/* 右翼：智能派生 */}
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
