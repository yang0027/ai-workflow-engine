import React, { useState } from 'react';
import { Handle, Position, useStore } from '@xyflow/react';
import { useUploadNodeLogic } from './upload-sub-components/useUploadNodeLogic';
import { NodeVisual } from './upload-sub-components/NodeVisual';
import { VideoActionPanel } from './upload-sub-components/VideoActionPanel';
import { ImageActionPanel } from './upload-sub-components/ImageActionPanel';
import { ResolvedMedia } from '../ResolvedMedia';

export interface UploadNodeProps {
  id: string;
  data: {
    label?: string;
    progress?: number;
    inputs?: {
      fileType?: 'image' | 'video' | 'audio';
      fileUrl?: string;
      fileName?: string;
    };
    outputs?: {
      output?: string;
      fileType?: 'image' | 'video' | 'audio';
      errorMsg?: string;
    };
    isNew?: boolean;
  };
  selected?: boolean;
}

export default function UploadNode({ id, data, selected }: UploadNodeProps) {
  const logic = useUploadNodeLogic({ id, data });

  // 多选检测：只有单选时才显示创意工具箱
  const isMultiSelected = useStore((state) => {
    return state.nodes.filter(n => n.selected).length > 1;
  });

  // 智能管线导流舱菜单状态 (左右翼派生)
  const [showLeftDerive, setShowLeftDerive] = useState(false);
  const [showRightDerive, setShowRightDerive] = useState(false);

  const upstreamTypes: any[] = [];
  const downstreamTypes = [
    { type: 'image-service', label: '🎨 智能生图 Agent' },
    { type: 'video-fusion', label: '📹 视频合成 Fusion' }
  ];

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
  };

  return (
    <div
      className="relative upload-node-container"
      style={{
        position: 'relative',
        width: '180px',
        height: '180px',
        fontFamily: 'var(--font-sans)',
        userSelect: 'none',
      }}
    >
      {/* 嵌入微调样式 */}
      <style>{`
        .upload-node-container .react-flow__handle::after {
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
        .video-container-box {
          position: relative;
          width: 100%;
          height: 100%;
          border-radius: 15px;
          overflow: hidden;
        }
        .video-controls-overlay {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          border-radius: 15px;
          cursor: pointer;
          z-index: 4;
        }
        .video-container-box .video-controls-overlay.playing {
          background: transparent !important;
        }
        .video-container-box .video-controls-overlay.playing button {
          opacity: 0 !important;
          transform: scale(0) !important;
          pointer-events: none;
        }
        .video-container-box .video-controls-overlay.paused {
          background: rgba(0, 0, 0, 0.35) !important;
        }
        .video-container-box .video-controls-overlay.paused button {
          opacity: 1 !important;
          transform: scale(1) !important;
        }
        .video-container-box .video-controls-overlay.paused button:hover {
          background: rgba(168, 85, 247, 0.8) !important;
          box-shadow: 0 0 20px rgba(168, 85, 247, 0.8) !important;
          transform: scale(1.1) !important;
        }
        @keyframes nodePulseGlow {
          0% {
            box-shadow: 0 0 4px rgba(168, 85, 247, 0.2);
            border-color: rgba(255, 255, 255, 0.08);
          }
          50% {
            box-shadow: 0 0 35px rgba(168, 85, 247, 0.95);
            border-color: rgba(168, 85, 247, 0.95);
          }
          100% {
            box-shadow: 0 0 4px rgba(168, 85, 247, 0.2);
            border-color: rgba(255, 255, 255, 0.08);
          }
        }
        .new-node-glow {
          animation: nodePulseGlow 1.5s infinite ease-in-out;
        }
      `}</style>

      {/* 可编辑的 Dynamic Type Tag Label */}
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
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          zIndex: 10,
        }}
      >
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
              background: 'rgba(11, 15, 25, 0.95)',
              border: '1px solid rgba(168, 85, 247, 0.6)',
              borderRadius: '4px',
              padding: '1px 4px',
              color: '#fff',
              fontSize: '11px',
              fontWeight: 700,
              width: '140px',
              outline: 'none',
            }}
          />
        ) : (
          <>
            <span
              onDoubleClick={() => logic.setIsEditingName(true)}
              style={{ cursor: 'text', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '120px' }}
              title="双击以重命名"
            >
              {logic.localName}
            </span>
            <span
              onClick={() => logic.setIsEditingName(true)}
              style={{ cursor: 'pointer', opacity: 0.6, fontSize: '10px', userSelect: 'none' }}
              title="点击重命名"
              onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
              onMouseLeave={(e) => e.currentTarget.style.opacity = '0.6'}
            >
              ✏️
            </span>
          </>
        )}
      </div>

      {/* 物理删除按钮 (右上角悬浮) */}
      <button
        onClick={logic.handleDelete}
        className="nodrag"
        style={{
          position: 'absolute',
          top: '-26px',
          right: '4px',
          width: '20px',
          height: '20px',
          borderRadius: '50%',
          background: 'rgba(239, 68, 68, 0.15)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          color: '#ef4444',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '11px',
          cursor: 'pointer',
          padding: 0,
          zIndex: 10,
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(239,68,68,0.35)')}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(239,68,68,0.15)')}
      >
        ×
      </button>

      {/* Video Fullscreen floating preview button in Video mode */}
      {logic.fileType === 'video' && logic.fileUrl && (
        <button
          onClick={() => logic.handleOpenFullscreenPreview()}
          className="nodrag"
          style={{
            position: 'absolute',
            top: '-26px',
            right: '32px',
            width: '20px',
            height: '20px',
            borderRadius: '50%',
            background: 'rgba(168, 85, 247, 0.25)',
            border: '1px solid rgba(168, 85, 247, 0.5)',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '10px',
            cursor: 'pointer',
            padding: 0,
            zIndex: 10,
            boxShadow: '0 0 6px rgba(168, 85, 247, 0.4)',
          }}
          title="全屏预览视频"
          onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(168,85,247,0.45)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(168, 85, 247, 0.25)')}
        >
          [ ]
        </button>
      )}

      {/* Main Glass Card (NodeVisual UI Sub Component) */}
      <div
        className={`glass-card ${data.isNew ? 'new-node-glow' : ''}`}
        onDoubleClick={() => {
          if (!logic.fileUrl) return;
          if (logic.fileType === 'image') {
            const event = new CustomEvent('toonflow-open-image-editor', {
              detail: { nodeId: id, imageUrl: logic.fileUrl }
            });
            window.dispatchEvent(event);
          } else {
            logic.handleOpenFullscreenPreview();
          }
        }}
        style={{
          width: '100%',
          height: '100%',
        }}
      >
        <NodeVisual
          id={id}
          fileUrl={logic.fileUrl}
          fileType={logic.fileType}
          fileName={logic.fileName}
          isPlayingAudio={logic.isPlayingAudio}
          audioProgress={logic.audioProgress}
          isPlayingVideo={logic.isPlayingVideo}
          videoProgress={logic.videoProgress}
          setVideoElement={logic.setVideoElement}
          setAudioElement={logic.setAudioElement}
          togglePlayVideo={logic.togglePlayVideo}
          togglePlayAudio={logic.togglePlayAudio}
          handleOpenFullscreenPreview={logic.handleOpenFullscreenPreview}
          handleOpenWorkroom={logic.handleOpenWorkroom}
          fileInputRef={logic.fileInputRef}
          handleFileChange={logic.handleFileChange}
          handleDragOver={logic.handleDragOver}
          handleDrop={logic.handleDrop}
          selected={selected}
        />
      </div>

      {/* Target and Source Handles (Dual Handles) */}
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

      {/* Video Lightbox Player */}
      {logic.isFullscreenVideo && logic.fileUrl && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(5, 7, 12, 0.95)',
            backdropFilter: 'blur(30px)',
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            animation: 'fadeIn 0.25s',
          }}
          onClick={(e) => {
            e.stopPropagation();
            logic.setIsFullscreenVideo(false);
          }}
        >
          <div
            style={{
              position: 'relative',
              width: '80%',
              height: '80%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'column',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {logic.fileType === 'video' ? (
              <ResolvedMedia
                url={logic.fileUrl}
                type="video"
                controls
                autoPlay
                style={{
                  maxWidth: '100%',
                  maxHeight: '85%',
                  objectFit: 'contain',
                  borderRadius: '16px',
                  border: '1.5px solid rgba(255, 255, 255, 0.1)',
                  boxShadow: '0 25px 60px rgba(0, 0, 0, 0.8), 0 0 40px rgba(168, 85, 247, 0.2)',
                }}
              />
            ) : (
              <ResolvedMedia
                url={logic.fileUrl}
                type="image"
                style={{
                  maxWidth: '100%',
                  maxHeight: '85%',
                  objectFit: 'contain',
                  borderRadius: '16px',
                  border: '1.5px solid rgba(255, 255, 255, 0.1)',
                  boxShadow: '0 25px 60px rgba(0, 0, 0, 0.8), 0 0 40px rgba(168, 85, 247, 0.2)',
                }}
              />
            )}
            <div
              style={{
                color: '#fff',
                fontSize: '13px',
                marginTop: '16px',
                fontWeight: 600,
                textShadow: '0 2px 4px #000',
                display: 'flex',
                gap: '20px',
                alignItems: 'center',
              }}
            >
              <span>🎥 Toonflow Canvas {logic.fileType === 'video' ? '视频' : '图像'} 4K Lightbox 全屏预览</span>
              <button
                onClick={logic.handleDownload}
                style={{
                  padding: '6px 16px',
                  background: 'rgba(168, 85, 247, 0.3)',
                  border: '1px solid rgba(168, 85, 247, 0.5)',
                  borderRadius: '6px',
                  color: '#fff',
                  fontSize: '11px',
                  cursor: 'pointer',
                }}
              >
                ⬇️ 下载媒体资源
              </button>
            </div>
            <button
              onClick={() => logic.setIsFullscreenVideo(false)}
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
                justifyContent: 'center',
              }}
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* 🔮 视频高保真悬浮工具条 */}
      {selected && !isMultiSelected && logic.fileType === 'video' && logic.fileUrl && (
        <VideoActionPanel
          id={id}
          fileUrl={logic.fileUrl}
          fileName={logic.fileName}
          activeVideoPanel={logic.activeVideoPanel}
          setActiveVideoPanel={logic.setActiveVideoPanel}
          videoActionProgress={logic.videoActionProgress}
          videoActionLabel={logic.videoActionLabel}
          handleCaptureFrame={logic.handleCaptureFrame}
          handleAudioSplit={logic.handleAudioSplit}
          handleVideoFixAction={logic.handleVideoFixAction}
          handleOpenFullscreenPreview={logic.handleOpenFullscreenPreview}
          selected={selected}
        />
      )}

      {/* 🎨 图像创意工具箱 */}
      {selected && !isMultiSelected && logic.fileType === 'image' && logic.fileUrl && (
        <ImageActionPanel
          id={id}
          fileUrl={logic.fileUrl}
          activeSubPanel={logic.activeSubPanel}
          setActiveSubPanel={logic.setActiveSubPanel}
          angleVal={logic.angleVal}
          setAngleVal={logic.setAngleVal}
          selectedDir={logic.selectedDir}
          handleDirSelect={logic.handleDirSelect}
          lightTab={logic.lightTab}
          setLightTab={logic.setLightTab}
          lightColor={logic.lightColor}
          setLightColor={logic.setLightColor}
          lightIntensity={logic.lightIntensity}
          setLightIntensity={logic.setLightIntensity}
          selectedLightPreset={logic.selectedLightPreset}
          setSelectedLightPreset={logic.setSelectedLightPreset}
          cropRatio={logic.cropRatio}
          setCropRatio={logic.setCropRatio}
          cropOffset={logic.cropOffset}
          setCropOffset={logic.setCropOffset}
          triggerChainAction={logic.triggerChainAction}
          handleOpenFullscreenPreview={logic.handleOpenFullscreenPreview}
        />
      )}

      {/* 🧬 左右翼智能管线导流舱 */}
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
            alignItems: center;
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
