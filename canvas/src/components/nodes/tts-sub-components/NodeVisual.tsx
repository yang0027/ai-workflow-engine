import React from 'react';
import { ResolvedMedia } from '../../ResolvedMedia';

export interface NodeVisualProps {
  id: string;
  data: any;
  selected: boolean;
  localName: string;
  isEditingName: boolean;
  showAud: string;
  isPlaying: boolean;
  cloning: boolean;
  progressPercent: number;
  audioPreviewRef: React.RefObject<HTMLAudioElement | null>;
  setLocalName: (name: string) => void;
  setIsEditingName: (editing: boolean) => void;
  setIsPlaying: (playing: boolean) => void;
  handleSaveName: () => void;
  handleDelete: () => void;
  handleDownloadAudio: () => void;
  handleTogglePlay: () => void;
  handleSpawnPromptSource: () => void;
  handleSpawnAudioUpload: () => void;
}

export const NodeVisual: React.FC<NodeVisualProps> = ({
  id,
  data,
  selected,
  localName,
  isEditingName,
  showAud,
  isPlaying,
  cloning,
  progressPercent,
  audioPreviewRef,
  setLocalName,
  setIsEditingName,
  setIsPlaying,
  handleSaveName,
  handleDelete,
  handleDownloadAudio,
  handleTogglePlay,
  handleSpawnPromptSource,
  handleSpawnAudioUpload
}) => {
  return (
    <div 
      className="glass-card"
      style={{
        width: '100%',
        height: '100%',
        background: showAud 
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
      {/* 动画 CSS 声波 */}
      <style>{`
        @keyframes bounce-wave {
          0%, 100% { height: 8px; }
          50% { height: 38px; }
        }
        .wave-bar-element {
          width: 4px;
          background: linear-gradient(180deg, #a855f7, #ec4899);
          border-radius: 2px;
          animation: bounce-wave 0.8s ease-in-out infinite;
        }
      `}</style>

      {/* 悬浮下载/播放小圆纽 */}
      {showAud && selected && (
        <div style={{ position: 'absolute', top: '8px', right: '8px', display: 'flex', gap: '6px', zIndex: 20 }}>
          <button 
            onClick={(e) => { e.stopPropagation(); handleTogglePlay(); }}
            style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'rgba(15,23,42,0.85)', border: '1px solid rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '11px', cursor: 'pointer', outline: 'none' }}
            title={isPlaying ? '暂停' : '播放'}
          >
            {isPlaying ? '⏸️' : '▶️'}
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
      ) : showAud ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
          <div style={{ display: 'flex', gap: '5px', alignItems: 'center', height: '40px' }}>
            <span className="wave-bar-element" style={{ animationDelay: '0.1s', height: '12px' }} />
            <span className="wave-bar-element" style={{ animationDelay: '0.3s', height: '24px' }} />
            <span className="wave-bar-element" style={{ animationDelay: '0.5s', height: '32px' }} />
            <span className="wave-bar-element" style={{ animationDelay: '0.2s', height: '20px' }} />
            <span className="wave-bar-element" style={{ animationDelay: '0.4s', height: '16px' }} />
          </div>
          <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>音色配音已就绪</span>
          <ResolvedMedia 
            videoRef={audioPreviewRef}
            url={showAud} 
            type="audio"
            style={{ display: 'none' }}
            onEnded={() => setIsPlaying(false)}
          />
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', padding: '8px', width: '100%', justifyContent: 'center' }}>
          <span style={{ fontSize: '20px' }}>🔊</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '100%', alignItems: 'center' }}>
            <button
              onClick={(e) => { e.stopPropagation(); handleSpawnPromptSource(); }}
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
              🔊 文生音频
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); handleSpawnAudioUpload(); }}
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
              🎵 音频生音频
            </button>
          </div>
        </div>
      )}

      {/* 统一高保真进度条 */}
      {(cloning || (data.progress !== undefined && data.progress < 100)) && (
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
            🎙️ 正在声色克隆中... {progressPercent}%
          </span>
          <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', overflow: 'hidden' }}>
            <div style={{ width: `${progressPercent}%`, height: '100%', background: 'linear-gradient(90deg, #a855f7 0%, #ec4899 100%)', borderRadius: '2px', transition: 'width 0.2s' }} />
          </div>
        </div>
      )}
    </div>
  );
};
