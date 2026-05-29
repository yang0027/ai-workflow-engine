import React from 'react';

export interface VideoActionPanelProps {
  id: string;
  fileUrl: string;
  fileName: string;
  activeVideoPanel: string | null;
  setActiveVideoPanel: (panel: string | null) => void;
  videoActionProgress: number | null;
  videoActionLabel: string;
  handleCaptureFrame: () => void;
  handleAudioSplit: (mode: string) => void;
  handleVideoFixAction: (mode: string) => void;
  handleOpenFullscreenPreview: () => void;
  selected?: boolean;
}

export const VideoActionPanel: React.FC<VideoActionPanelProps> = ({
  fileUrl, fileName, activeVideoPanel, setActiveVideoPanel, videoActionProgress, videoActionLabel,
  handleCaptureFrame, handleAudioSplit, handleVideoFixAction, handleOpenFullscreenPreview
}) => {
  return (
    <div className="nodrag" onMouseDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()}
      style={{ position: 'absolute', bottom: '190px', left: '50%', transform: 'translateX(-50%)', width: '340px', background: 'rgba(11, 15, 26, 0.95)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255, 255, 255, 0.08)', boxShadow: '0 20px 50px rgba(0, 0, 0, 0.65), 0 0 30px rgba(168, 85, 247, 0.1)', borderRadius: '12px', padding: '5px 6px', display: 'flex', flexDirection: 'column', gap: '5px', zIndex: 1000, animation: 'slideUpSub 0.25s cubic-bezier(0.16, 1, 0.3, 1)' }}>
      <style>{`@keyframes slideUpSub { from { transform: translate(-50%, 15px); opacity: 0; } to { transform: translate(-50%, 0); opacity: 1; } }`}</style>

      {activeVideoPanel && !['download', 'fullscreen', 'capture'].includes(activeVideoPanel) && (
        <div style={{ background: 'rgba(0, 0, 0, 0.25)', borderRadius: '8px', padding: '6px 8px', display: 'flex', flexDirection: 'column', gap: '5px', width: '100%', border: '1px solid rgba(255, 255, 255, 0.04)', marginBottom: '2px' }}>
          {activeVideoPanel === 'hd' && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
              <span style={{ fontSize: '9px', color: 'rgba(255, 255, 255, 0.5)' }}>🔮 4K超画质及修复</span>
              <button onClick={() => handleVideoFixAction('4K 画质超分')} style={{ background: 'rgba(168, 85, 247, 0.25)', border: '1px solid rgba(168, 85, 247, 0.4)', borderRadius: '5px', color: '#fff', fontSize: '8.5px', padding: '2px 6px', cursor: 'pointer', transition: 'all 0.2s' }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(168, 85, 247, 0.4)'} onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(168, 85, 247, 0.25)'}>一键超分</button>
            </div>
          )}
          {activeVideoPanel === 'cut' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '100%', textAlign: 'left' }}>
              <span style={{ fontSize: '9px', color: 'rgba(255, 255, 255, 0.5)' }}>✂️ 视频时段选区裁剪</span>
              <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                <input type="text" defaultValue="00:00:00" style={{ flex: 1, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '4px', color: '#fff', fontSize: '8.5px', padding: '1px 3px', textAlign: 'center' }} />
                <span style={{ color: 'rgba(255, 255, 255, 0.4)', fontSize: '8.5px' }}>至</span>
                <input type="text" defaultValue="00:00:15" style={{ flex: 1, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '4px', color: '#fff', fontSize: '8.5px', padding: '1px 3px', textAlign: 'center' }} />
                <button onClick={() => handleVideoFixAction('段落切片裁剪')} style={{ background: 'rgba(168, 85, 247, 0.25)', border: '1px solid rgba(168, 85, 247, 0.4)', borderRadius: '5px', color: '#fff', fontSize: '8.5px', padding: '2px 6px', cursor: 'pointer', transition: 'all 0.2s' }}>确认</button>
              </div>
            </div>
          )}
          {activeVideoPanel === 'parse' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px', width: '100%', textAlign: 'left' }}>
              {[{ l: '格式', v: 'MP4 / H.264' }, { l: '分辨率', v: '3840x2160 (4K)' }, { l: '帧率', v: '60 fps' }, { l: '音轨', v: 'AAC Stereo' }, { l: '比特率', v: '18.5 Mbps' }, { l: '时长', v: '00:00:15' }].map((meta, index) => (
                <div key={index} style={{ display: 'flex', flexDirection: 'column', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', borderRadius: '4px', padding: '1px 3px' }}>
                  <span style={{ fontSize: '7px', color: 'rgba(255,255,255,0.3)' }}>{meta.l}</span>
                  <span style={{ fontSize: '9px', color: '#10b981', fontWeight: 'bold', marginTop: '0.5px' }}>{meta.v}</span>
                </div>
              ))}
            </div>
          )}
          {activeVideoPanel === 'audio-split' && (
            <div style={{ display: 'flex', gap: '4px', width: '100%' }}>
              {[{ m: '音频分离', l: '🔊 完整音频' }, { m: '人声分离', l: '🗣️ 人声分离' }, { m: '环境音分离', l: '🎵 环境音' }].map((btn) => (
                <button key={btn.m} onClick={() => handleAudioSplit(btn.m)} style={{ flex: 1, background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '5px', color: '#fff', fontSize: '8.5px', padding: '3px 1px', cursor: 'pointer', transition: 'all 0.2s' }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(168, 85, 247, 0.1)'} onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)'}>{btn.l}</button>
              ))}
            </div>
          )}
          {activeVideoPanel === 'video-fix' && (
            <div style={{ display: 'flex', gap: '4px', width: '100%' }}>
              {[{ m: '去水印', l: '🧼 去水印' }, { m: '去字幕', l: '📝 去字幕' }, { m: '去模糊', l: '✨ 去模糊' }].map((btn) => (
                <button key={btn.m} onClick={() => handleVideoFixAction(btn.m)} style={{ flex: 1, background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '5px', color: '#fff', fontSize: '8.5px', padding: '3px 1px', cursor: 'pointer', transition: 'all 0.2s' }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(168, 85, 247, 0.1)'} onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)'}>{btn.l}</button>
              ))}
            </div>
          )}
        </div>
      )}

      {videoActionProgress !== null && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', width: '100%', padding: '2px 4px', textAlign: 'left', marginBottom: '2px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '8.5px', color: '#c084fc', fontWeight: 'bold' }}>
            <span>{videoActionLabel}</span><span>{videoActionProgress}%</span>
          </div>
          <div style={{ width: '100%', height: '2.5px', background: 'rgba(255,255,255,0.06)', borderRadius: '1.5px', overflow: 'hidden' }}>
            <div style={{ width: `${videoActionProgress}%`, height: '100%', background: 'linear-gradient(90deg, #a855f7 0%, #ec4899 100%)', boxShadow: '0 0 10px #a855f7', transition: 'width 0.15s ease-out' }} />
          </div>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '3px', width: '100%' }}>
        {[
          { id: 'hd', label: '📹 高清' },
          { id: 'cut', label: '✂️ 剪辑' },
          { id: 'capture', label: '📷 捕捉', directAction: handleCaptureFrame },
          { id: 'parse', label: '📋 解析' },
          { id: 'audio-split', label: '🔊 音频' },
          { id: 'video-fix', label: '🎞️ 修复' },
          { id: 'download', label: '⬇️', directAction: () => {
            if (!fileUrl) return;
            const link = document.createElement('a');
            link.href = fileUrl;
            link.download = fileName || 'toonflow-video.mp4';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
          }},
          { id: 'fullscreen', label: '⤢', directAction: handleOpenFullscreenPreview }
        ].map((tool) => {
          const active = activeVideoPanel === tool.id;
          const isIcon = tool.id === 'download' || tool.id === 'fullscreen';
          return (
            <button key={tool.id} onClick={() => { if (tool.directAction) tool.directAction(); else setActiveVideoPanel(active ? null : tool.id); }}
              style={{ padding: isIcon ? '4px 5px' : '4px 4px', borderRadius: '5px', border: active ? '1px solid rgba(168, 85, 247, 0.5)' : '1px solid rgba(255, 255, 255, 0.05)', background: active ? 'rgba(168, 85, 247, 0.15)' : 'rgba(255, 255, 255, 0.02)', color: active ? '#fff' : 'rgba(255, 255, 255, 0.75)', fontSize: '9px', fontWeight: active ? 700 : 500, cursor: 'pointer', transition: 'all 0.2s', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '2px', flex: isIcon ? 'none' : '1' }}
              onMouseEnter={(e) => { if (!active) { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)'; e.currentTarget.style.color = '#fff'; } }}
              onMouseLeave={(e) => { if (!active) { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)'; e.currentTarget.style.color = 'rgba(255, 255, 255, 0.75)'; } }}>
              {tool.label}
            </button>
          );
        })}
      </div>
    </div>
  );
};
