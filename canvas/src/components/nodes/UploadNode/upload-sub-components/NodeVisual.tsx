import React from 'react';
import { ResolvedMedia } from '../../../ResolvedMedia';

export interface NodeVisualProps {
  id: string;
  fileUrl: string;
  fileType: string | null;
  fileName: string;
  isPlayingAudio: boolean;
  audioProgress: number;
  isPlayingVideo: boolean;
  videoProgress: number;
  setVideoElement: (el: HTMLVideoElement | null) => void;
  setAudioElement: (el: HTMLAudioElement | null) => void;
  togglePlayVideo: () => void;
  togglePlayAudio: () => void;
  handleOpenFullscreenPreview: () => void;
  handleOpenWorkroom: (tab: 'crop' | 'mask' | 'brush' | 'grid') => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleDragOver: (e: React.DragEvent) => void;
  handleDrop: (e: React.DragEvent) => void;
  selected?: boolean;
}

export const NodeVisual: React.FC<NodeVisualProps> = ({
  fileUrl, fileType, fileName, isPlayingAudio, audioProgress, isPlayingVideo, videoProgress,
  setVideoElement, setAudioElement, togglePlayVideo, togglePlayAudio,
  handleOpenFullscreenPreview, handleOpenWorkroom, fileInputRef,
  handleFileChange, handleDragOver, handleDrop, selected
}) => {
  return (
    <div
      className="relative upload-node-visual-inner"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      style={{
        width: '100%', height: '100%',
        background: fileUrl ? '#000' : 'linear-gradient(135deg, rgba(20, 24, 33, 0.75) 0%, rgba(10, 12, 16, 0.95) 100%)',
        border: selected ? '1.5px solid rgba(168, 85, 247, 0.85)' : '1px solid rgba(255, 255, 255, 0.08)',
        boxShadow: selected ? '0 0 25px rgba(168, 85, 247, 0.35)' : '0 8px 32px rgba(0, 0, 0, 0.4)',
        borderRadius: '16px', position: 'relative', overflow: 'hidden',
        display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      }}
    >
      <input type="file" ref={fileInputRef as any} onChange={handleFileChange} accept="image/*,video/*,audio/*" style={{ display: 'none' }} />

      {fileUrl ? (
        <>
          {/* 替换按钮 */}
          <button onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }} className="nodrag"
            style={{ position: 'absolute', top: '12px', right: '12px', padding: '4px 10px', borderRadius: '8px', background: 'rgba(11, 15, 25, 0.75)', border: '1px solid rgba(255, 255, 255, 0.15)', color: '#fff', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 500, cursor: 'pointer', zIndex: 20, backdropFilter: 'blur(4px)', transition: 'all 0.2s' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(168, 85, 247, 0.35)'; e.currentTarget.style.borderColor = 'rgba(168, 85, 247, 0.6)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(11, 15, 25, 0.75)'; e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)'; }}>
            <span style={{ transform: 'translateY(-1px)' }}>↑</span> 替换
          </button>

          {fileType === 'image' && (
            <>
              <ResolvedMedia url={fileUrl} type="image" style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: '15px' }} />
              <div className="nodrag" style={{ position: 'absolute', bottom: '6px', left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: '3px', zIndex: 20, width: 'calc(100% - 12px)', justifyContent: 'center' }}>
                {[{ tab: 'crop', label: '裁剪' }, { tab: 'mask', label: '遮罩' }, { tab: 'brush', label: '标注' }, { tab: 'grid', label: '宫格' }].map(item => (
                  <button key={item.tab} onClick={(e) => { e.stopPropagation(); handleOpenWorkroom(item.tab as any); }}
                    style={{ flex: 1, padding: '3px 0', borderRadius: '5px', background: 'rgba(255, 255, 255, 0.15)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255, 255, 255, 0.2)', color: '#fff', fontSize: '9px', fontWeight: 'bold', cursor: 'pointer', textAlign: 'center', transition: 'all 0.2s', boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)', textShadow: '0 1px 2px rgba(0,0,0,0.6)' }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(168, 85, 247, 0.4)'; e.currentTarget.style.borderColor = 'rgba(168, 85, 247, 0.6)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)'; e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)'; }}>
                    {item.label}
                  </button>
                ))}
              </div>
            </>
          )}

          {fileType === 'video' && (
            <div className="video-container-box">
              <ResolvedMedia videoRef={setVideoElement} url={fileUrl} type="video" style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: '15px' }} />
              <div className={`video-controls-overlay ${isPlayingVideo ? 'playing' : 'paused'}`} onClick={togglePlayVideo}>
                <button className="nodrag" style={{ width: '44px', height: '44px', borderRadius: '50%', background: 'rgba(168, 85, 247, 0.45)', backdropFilter: 'blur(8px)', border: '1.5px solid rgba(168, 85, 247, 0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '18px', cursor: 'pointer', boxShadow: '0 0 15px rgba(168, 85, 247, 0.55)', transform: isPlayingVideo ? 'scale(0.8)' : 'scale(1)', transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)' }}>
                  {isPlayingVideo ? '⏸' : '▶'}
                </button>
              </div>
              <div style={{ position: 'absolute', bottom: '0', left: '0', width: '100%', height: '4px', background: 'rgba(255,255,255,0.15)', zIndex: 5 }}>
                <div style={{ width: `${videoProgress}%`, height: '100%', background: 'rgba(168, 85, 247, 0.85)', boxShadow: '0 0 6px rgba(168, 85, 247, 0.8)', transition: 'width 0.1s linear' }} />
              </div>
            </div>
          )}

          {fileType === 'audio' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', width: '100%', padding: '12px', textAlign: 'center' }}>
              <ResolvedMedia videoRef={setAudioElement} url={fileUrl} type="audio" style={{ display: 'none' }} />
              <button onClick={togglePlayAudio} className="nodrag"
                style={{ width: '44px', height: '44px', borderRadius: '50%', background: 'rgba(168, 85, 247, 0.2)', border: '1.5px solid rgba(168, 85, 247, 0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '18px', cursor: 'pointer', boxShadow: '0 0 10px rgba(168, 85, 247, 0.3)' }}>
                {isPlayingAudio ? '⏸' : '▶'}
              </button>
              <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }} title={fileName}>{fileName || '音频资源'}</span>
              <div style={{ width: '100%', height: '3px', background: 'rgba(255,255,255,0.1)', borderRadius: '1.5px', overflow: 'hidden', marginTop: '4px' }}>
                <div style={{ width: `${audioProgress}%`, height: '100%', background: 'rgba(168, 85, 247, 0.85)' }} />
              </div>
            </div>
          )}
        </>
      ) : (
        <div onClick={() => fileInputRef.current?.click()} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer', width: '100%', height: '100%', padding: '16px', textAlign: 'center' }}>
          <span style={{ fontSize: '28px', opacity: 0.8, animation: 'floatPill 3s infinite ease-in-out' }}>📤</span>
          <span style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.55)', fontWeight: 500 }}>拖拽或点击上传</span>
          <span style={{ fontSize: '8px', color: 'rgba(255, 255, 255, 0.3)' }}>支持图片 / 视频 / 音频</span>
        </div>
      )}
    </div>
  );
};
