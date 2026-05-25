import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Handle, Position, useReactFlow, useStore, useNodes } from '@xyflow/react';
import { ResolvedMedia } from '../ResolvedMedia';

interface UploadNodeProps {
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
  };
  selected?: boolean;
}

export default function UploadNode({ id, data, selected }: UploadNodeProps) {
  const { setNodes, setEdges, deleteElements } = useReactFlow();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isEditingName, setIsEditingName] = useState(false);
  const [localName, setLocalName] = useState(data.label || '📦 本地上传');

  useEffect(() => {
    if (data.label) {
      setLocalName(data.label);
    }
  }, [data.label]);

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
  
  // 使用 Stateful Ref (回调引用) 监听 DOM 元素挂载
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);
  const nodes = useNodes();

  const fileType = data.inputs?.fileType || null;
  const fileUrl = data.inputs?.fileUrl || data.outputs?.output || '';
  const fileName = data.inputs?.fileName || '';

  // 状态
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0);
  const [isFullscreenVideo, setIsFullscreenVideo] = useState(false);

  // 视频控制状态
  const [isPlayingVideo, setIsPlayingVideo] = useState(false);
  const [videoProgress, setVideoProgress] = useState(0);
  
  // 使用 Stateful Ref (回调引用) 监听 DOM 元素挂载
  const [videoElement, setVideoElement] = useState<HTMLVideoElement | null>(null);

  // 创意工具箱状态
  const [activeSubPanel, setActiveSubPanel] = useState<'angle' | 'light' | 'camera' | 'hd' | 'grid' | 'crop' | null>(null);
  
  // 智能管线导流舱菜单状态
  const [showLeftDerive, setShowLeftDerive] = useState(false);
  const [showRightDerive, setShowRightDerive] = useState(false);

  const upstreamTypes: any[] = [];
  const downstreamTypes = [
    { type: 'image-service', label: '🎨 智能生图 Agent' },
    { type: 'video-fusion', label: '📹 视频合成 Fusion' }
  ];
  const [angleVal, setAngleVal] = useState(45);
  const [selectedDir, setSelectedDir] = useState('左45°');
  const directions = ['正面', '侧面', '俯视', '仰视', '左45°', '右45°', '背面', '顶视'];

  const [lightTab, setLightTab] = useState<'main' | 'fill'>('main');
  const [lightIntensity, setLightIntensity] = useState(70);
  const [lightColor, setLightColor] = useState('#ec4899');
  const [selectedLightPreset, setSelectedLightPreset] = useState('林布兰光');
  const lightPresets = ['林布兰光', '蝴蝶光', '顶光', '侧逆光', '舞台光'];

  const [isCameraMenuOpen, setIsCameraMenuOpen] = useState(false);
  const cameraPans = ['横移 (Pan)', '推近 (Push In)', '拉远 (Pull Out)', '环绕 (Orbit)', '升降 (Crane)'];
  const moodRemakes = ['喜悦情绪', '恐惧笼罩', '忧郁深沉', '紧张狂躁', '赛博迷幻'];

  const hdOptions = ['高清重绘', '高清放大', '局部消除', '智能扩图', '人像抠图'];
  const gridOptions = ['4宫格 (2x2)', '9宫格 (3x3)', '16宫格 (4x4)', '25宫格 (5x5)', '自定义分镜'];

  const [cropRatio, setCropRatio] = useState('16:9');
  const [cropOffset, setCropOffset] = useState(50);
  const cropRatios = ['1:1', '4:3', '16:9', '9:16', '自定义'];

  // Handle uploading and setting node data
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const processFile = (file: File) => {
    try {
      const reader = new FileReader();
      reader.onerror = (err) => {
        console.error('[UploadNode] FileReader error:', err);
        alert('文件读取失败！');
      };
      reader.onload = () => {
        try {
          if (typeof reader.result === 'string') {
            const base64 = reader.result;
            let detectedType: 'image' | 'video' | 'audio' = 'image';
            if (file.type.startsWith('video/')) {
              detectedType = 'video';
            } else if (file.type.startsWith('audio/')) {
              detectedType = 'audio';
            }

            const saveAndSetNodeData = async (b64: string) => {
              try {
                const saveMedia = (window as any).saveMediaToDB;
                const addAsset = (window as any).addUploadedAsset;
                let finalUrl = b64;
                if (typeof saveMedia === 'function') {
                  const mediaId = `media-asset-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                  await saveMedia(mediaId, b64);
                  finalUrl = `db://${mediaId}`;
                }

                if (typeof addAsset === 'function') {
                  await addAsset(detectedType, finalUrl, `📦 上传资源: ${file.name}`);
                }

                setNodes((nds) =>
                  nds.map((n) => {
                    if (n.id === id) {
                      return {
                        ...n,
                        data: {
                          ...n.data,
                          inputs: {
                            ...(n.data?.inputs as any),
                            fileType: detectedType,
                            fileUrl: finalUrl,
                            fileName: file.name,
                          },
                          outputs: {
                            ...(n.data?.outputs as any),
                            output: finalUrl,
                            fileType: detectedType,
                          },
                        },
                      };
                    }
                    return n;
                  })
                );
              } catch (innerErr) {
                console.error('[UploadNode] saveAndSetNodeData async error:', innerErr);
                alert('本地上传文件保存失败，请重试！');
              }
            };
            saveAndSetNodeData(base64);
          }
        } catch (onloadErr) {
          console.error('[UploadNode] FileReader onload error:', onloadErr);
          alert('处理上传文件时发生错误！');
        }
      };
      reader.readAsDataURL(file);
    } catch (outerErr) {
      console.error('[UploadNode] processFile outer error:', outerErr);
      alert('选择文件读取出错！');
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const triggerChainAction = (actionLabel: string, mockUrl: string) => {
    const currentNode = nodes.find((n) => n.id === id);
    const posX = currentNode?.position?.x || 0;
    const posY = currentNode?.position?.y || 0;

    const childId = `image-service-${Date.now()}`;
    const childNode = {
      id: childId,
      type: 'image-service',
      position: { x: posX + 240, y: posY + 20 },
      data: {
        label: `${actionLabel} - 上传参考源`,
        progress: 0,
        inputs: {
          prompt: `${actionLabel} of uploaded source`,
          providerId: 'volcengine',
          model: 'flux-schnell',
          faceRef: fileUrl, // 自动回填上传的图作为参考图
        },
        outputs: {
          image: '',
        },
      },
    };

    const newEdge = {
      id: `e-${id}-${childId}`,
      source: id,
      sourceHandle: 'output',
      target: childId,
      targetHandle: 'input',
      type: 'button',
      animated: true,
      style: { stroke: 'rgba(168, 85, 247, 0.85)', strokeWidth: 2 },
    };

    setNodes((nds) => [...nds.map((n) => ({ ...n, selected: false })), { ...childNode, selected: true }]);
    setEdges((eds) => [...eds, newEdge]);

    // 进度条流转模拟
    let pct = 0;
    const timer = setInterval(() => {
      pct += 10;
      if (pct >= 100) {
        clearInterval(timer);
        setNodes((nds) =>
          nds.map((n) => {
            if (n.id === childId) {
              return {
                ...n,
                data: {
                  ...n.data,
                  progress: 100,
                  outputs: {
                    image: mockUrl,
                    output: mockUrl,
                  },
                },
              };
            }
            return n;
          })
        );
      } else {
        setNodes((nds) =>
          nds.map((n) => {
            if (n.id === childId) {
              return {
                ...n,
                data: {
                  ...n.data,
                  progress: pct,
                },
              };
            }
            return n;
          })
        );
      }
    }, 300);

    setActiveSubPanel(null);
  };

  const handleDownload = async () => {
    if (!fileUrl) return;
    let finalUrl = fileUrl;
    if (fileUrl.startsWith('db://')) {
      const mediaId = fileUrl.replace('db://', '');
      const getMedia = (window as any).getMediaFromDB;
      if (typeof getMedia === 'function') {
        const base64 = await getMedia(mediaId);
        if (base64) finalUrl = base64;
      }
    }
    if (typeof (window as any).downloadFileDirectly === 'function') {
      (window as any).downloadFileDirectly(finalUrl, fileName || 'toonflow-upload-media');
    } else {
      const a = document.createElement('a');
      a.href = finalUrl;
      a.download = fileName || 'toonflow-upload-media';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  const handleOpenFullscreenPreview = () => {
    if (!fileUrl) return;
    const isVideo = fileUrl.toLowerCase().includes('.mp4') || fileUrl.toLowerCase().includes('.webm') || fileUrl.toLowerCase().includes('.mov') || fileUrl.startsWith('data:video') || fileType === 'video';
    const isAudio = fileUrl.toLowerCase().includes('.mp3') || fileUrl.toLowerCase().includes('.wav') || fileUrl.startsWith('data:audio') || fileType === 'audio';
    const type = isVideo ? 'video' : (isAudio ? 'audio' : 'image');
    
    if (typeof (window as any).setFullScreenMedia === 'function') {
      (window as any).setFullScreenMedia({ url: fileUrl, type, nodeId: id });
    } else {
      setIsFullscreenVideo(true);
    }
  };

  const handleOpenWorkroom = (tab: 'crop' | 'mask' | 'brush' | 'grid') => {
    if (!fileUrl) return;
    const event = new CustomEvent('toonflow-open-image-editor', {
      detail: { nodeId: id, imageUrl: fileUrl, activeTab: tab }
    });
    window.dispatchEvent(event);
  };

  const togglePlayVideo = () => {
    if (!videoElement) return;
    if (isPlayingVideo) {
      videoElement.pause();
    } else {
      videoElement.play();
    }
  };

  const handleDelete = () => {
    setNodes((nds) => nds.filter((n) => n.id !== id));
    setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
  };

  // Audio Playback Helpers
  const togglePlayAudio = () => {
    if (!audioElement) return;
    if (isPlayingAudio) {
      audioElement.pause();
    } else {
      audioElement.play();
    }
  };

  useEffect(() => {
    if (!audioElement) return;

    const handlePlay = () => setIsPlayingAudio(true);
    const handlePause = () => setIsPlayingAudio(false);
    const handleTimeUpdate = () => {
      if (audioElement.duration) {
        setAudioProgress((audioElement.currentTime / audioElement.duration) * 100);
      }
    };
    const handleEnded = () => {
      setIsPlayingAudio(false);
      setAudioProgress(0);
    };

    audioElement.addEventListener('play', handlePlay);
    audioElement.addEventListener('pause', handlePause);
    audioElement.addEventListener('timeupdate', handleTimeUpdate);
    audioElement.addEventListener('ended', handleEnded);

    // 状态初始化同步
    setIsPlayingAudio(!audioElement.paused);
    if (audioElement.duration) {
      setAudioProgress((audioElement.currentTime / audioElement.duration) * 100);
    }

    return () => {
      audioElement.removeEventListener('play', handlePlay);
      audioElement.removeEventListener('pause', handlePause);
      audioElement.removeEventListener('timeupdate', handleTimeUpdate);
      audioElement.removeEventListener('ended', handleEnded);
    };
  }, [audioElement, fileUrl]);

  useEffect(() => {
    if (!videoElement) return;

    const handlePlay = () => setIsPlayingVideo(true);
    const handlePause = () => setIsPlayingVideo(false);
    const handleTimeUpdate = () => {
      if (videoElement.duration) {
        setVideoProgress((videoElement.currentTime / videoElement.duration) * 100);
      }
    };
    const handleEnded = () => {
      setIsPlayingVideo(false);
      setVideoProgress(0);
    };

    videoElement.addEventListener('play', handlePlay);
    videoElement.addEventListener('pause', handlePause);
    videoElement.addEventListener('timeupdate', handleTimeUpdate);
    videoElement.addEventListener('ended', handleEnded);

    // 状态初始化同步
    setIsPlayingVideo(!videoElement.paused);
    if (videoElement.duration) {
      setVideoProgress((videoElement.currentTime / videoElement.duration) * 100);
    }

    return () => {
      videoElement.removeEventListener('play', handlePlay);
      videoElement.removeEventListener('pause', handlePause);
      videoElement.removeEventListener('timeupdate', handleTimeUpdate);
      videoElement.removeEventListener('ended', handleEnded);
    };
  }, [videoElement, fileUrl, fileType]);

  // Styling
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

  const handleDirSelect = (dir: string) => {
    setSelectedDir(dir);
    const dirMap: Record<string, number> = {
      '正面': 0, '侧面': 90, '俯视': 30, '仰视': -30,
      '左45°': 45, '右45°': -45, '背面': 180, '顶视': 90
    };
    if (dirMap[dir] !== undefined) {
      setAngleVal(dirMap[dir]);
    }
  };

  return (
    <div
      className="relative"
      style={{
        position: 'relative',
        width: '300px',
        height: '260px',
        fontFamily: 'var(--font-sans)',
        userSelect: 'none',
      }}
    >
      {/* 嵌入微调样式：控制视频播放图标淡出/Hover浮现，以及新节点发光动画 */}
      <style>{`
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
        /* 播放时彻底隐藏遮罩和播放按钮，不阻挡画面 */
        .video-container-box .video-controls-overlay.playing {
          background: transparent !important;
        }
        .video-container-box .video-controls-overlay.playing button {
          opacity: 0 !important;
          transform: scale(0) !important;
          pointer-events: none;
        }
        /* 暂停时默认显示暗色遮罩和播放图标 */
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

        /* 新增节点呼吸闪烁发光动画 */
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
              onDoubleClick={() => setIsEditingName(true)}
              style={{ cursor: 'text', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '120px' }}
              title="双击以重命名"
            >
              {localName}
            </span>
            <span
              onClick={() => setIsEditingName(true)}
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
        onClick={handleDelete}
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
      {fileType === 'video' && fileUrl && (
        <button
          onClick={() => handleOpenFullscreenPreview()}
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

      {/* Main Glass Card */}
      <div
        className={`glass-card ${(data as any).isNew ? 'new-node-glow' : ''}`}
        onDoubleClick={() => {
          if (!fileUrl) return;
          if (fileType === 'image') {
            const event = new CustomEvent('toonflow-open-image-editor', {
              detail: { nodeId: id, imageUrl: fileUrl }
            });
            window.dispatchEvent(event);
          } else {
            handleOpenFullscreenPreview();
          }
        }}
        style={{
          width: '100%',
          height: '100%',
          background: fileUrl
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
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept="image/*,video/*,audio/*"
          style={{ display: 'none' }}
        />

        {fileUrl ? (
          <>
            {fileType === 'image' && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const event = new CustomEvent('toonflow-open-image-editor', {
                    detail: { nodeId: id, imageUrl: fileUrl }
                  });
                  window.dispatchEvent(event);
                }}
                style={{
                  position: 'absolute',
                  top: '12px',
                  right: '68px',
                  padding: '4px 10px',
                  borderRadius: '8px',
                  background: 'rgba(168, 85, 247, 0.25)',
                  border: '1px solid rgba(168, 85, 247, 0.5)',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '11px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  zIndex: 20,
                  backdropFilter: 'blur(4px)',
                  transition: 'all 0.2s',
                  boxShadow: '0 0 8px rgba(168, 85, 247, 0.45)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(168, 85, 247, 0.45)';
                  e.currentTarget.style.borderColor = 'rgba(168, 85, 247, 0.8)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(168, 85, 247, 0.25)';
                  e.currentTarget.style.borderColor = 'rgba(168, 85, 247, 0.5)';
                }}
              >
                ✏️ 编辑
              </button>
            )}
            {/* ↑ 替换按钮 (悬浮在节点框内的右上角) */}
            <button
              onClick={(e) => {
                e.stopPropagation(); // 阻止点击事件冒泡到外层触发全屏
                fileInputRef.current?.click();
              }}
              style={{
                position: 'absolute',
                top: '12px',
                right: '12px',
                padding: '4px 10px',
                borderRadius: '8px',
                background: 'rgba(11, 15, 25, 0.75)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '11px',
                fontWeight: 500,
                cursor: 'pointer',
                zIndex: 20,
                backdropFilter: 'blur(4px)',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(168, 85, 247, 0.35)';
                e.currentTarget.style.borderColor = 'rgba(168, 85, 247, 0.6)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(11, 15, 25, 0.75)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)';
              }}
            >
              <span style={{ transform: 'translateY(-1px)' }}>↑</span> 替换
            </button>
            {fileType === 'image' && (
              <ResolvedMedia
                url={fileUrl}
                type="image"
                style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: '15px' }}
              />
            )}

            {fileType === 'video' && (
              <div className="video-container-box">
                <ResolvedMedia
                  videoRef={setVideoElement}
                  url={fileUrl}
                  type="video"
                  style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: '15px' }}
                />
                {/* 磨砂紫色圆形播放控制按钮 (Play/Pause) */}
                <div
                  className={`video-controls-overlay ${isPlayingVideo ? 'playing' : 'paused'}`}
                  onClick={togglePlayVideo}
                >
                  <button
                    style={{
                      width: '44px',
                      height: '44px',
                      borderRadius: '50%',
                      background: 'rgba(168, 85, 247, 0.45)',
                      backdropFilter: 'blur(8px)',
                      border: '1.5px solid rgba(168, 85, 247, 0.85)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fff',
                      fontSize: '18px',
                      cursor: 'pointer',
                      boxShadow: '0 0 15px rgba(168, 85, 247, 0.55)',
                      transform: isPlayingVideo ? 'scale(0.8)' : 'scale(1)',
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    }}
                  >
                    {isPlayingVideo ? '⏸' : '▶'}
                  </button>
                </div>
                {/* 底部精美紫色进度条 */}
                <div
                  style={{
                    position: 'absolute',
                    bottom: '0',
                    left: '0',
                    width: '100%',
                    height: '4px',
                    background: 'rgba(255,255,255,0.15)',
                    zIndex: 5,
                  }}
                >
                  <div
                    style={{
                      width: `${videoProgress}%`,
                      height: '100%',
                      background: 'rgba(168, 85, 247, 0.85)',
                      boxShadow: '0 0 6px rgba(168, 85, 247, 0.8)',
                      transition: 'width 0.1s linear',
                    }}
                  />
                </div>
              </div>
            )}

            {fileType === 'audio' && (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '8px',
                  width: '100%',
                  padding: '12px',
                  textAlign: 'center',
                }}
              >
                <ResolvedMedia videoRef={setAudioElement} url={fileUrl} type="audio" style={{ display: 'none' }} />
                <button
                  onClick={togglePlayAudio}
                  style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '50%',
                    background: 'rgba(168, 85, 247, 0.2)',
                    border: '1.5px solid rgba(168, 85, 247, 0.8)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    fontSize: '18px',
                    cursor: 'pointer',
                    boxShadow: '0 0 10px rgba(168, 85, 247, 0.3)',
                  }}
                >
                  {isPlayingAudio ? '⏸' : '▶'}
                </button>
                <span
                  style={{
                    fontSize: '9px',
                    color: 'rgba(255,255,255,0.4)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    width: '100%',
                  }}
                  title={fileName}
                >
                  {fileName || '音频资源'}
                </span>
                {/* Sleek audio progress bar */}
                <div style={{ width: '100%', height: '3px', background: 'rgba(255,255,255,0.1)', borderRadius: '1.5px', overflow: 'hidden', marginTop: '4px' }}>
                  <div style={{ width: `${audioProgress}%`, height: '100%', background: 'rgba(168, 85, 247, 0.85)' }} />
                </div>
              </div>
            )}
          </>
        ) : (
          <div
            onClick={() => fileInputRef.current?.click()}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              cursor: 'pointer',
              width: '100%',
              height: '100%',
              padding: '16px',
              textAlign: 'center',
            }}
          >
            <span style={{ fontSize: '28px', opacity: 0.8, animation: 'floatPill 3s infinite ease-in-out' }}>📤</span>
            <span style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.55)', fontWeight: 500 }}>
              拖拽或点击上传
            </span>
            <span style={{ fontSize: '8px', color: 'rgba(255, 255, 255, 0.3)' }}>
              支持图片 / 视频 / 音频
            </span>
          </div>
        )}
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

      {/* 移植的创意工具箱: 选中 Image 类型且选中节点时, 在上方以悬浮工具栏呈现 */}
      {selected && fileType === 'image' && fileUrl && (
        <div
          className="nodrag"
          style={{
            position: 'absolute',
            bottom: '275px', // 在节点正上方展示，预留完美呼吸间距
            left: '50%',
            transform: 'translateX(-50%)',
            width: '580px',
            background: 'rgba(11, 15, 26, 0.95)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            boxShadow: '0 -20px 50px rgba(0, 0, 0, 0.65), 0 0 30px rgba(168, 85, 247, 0.1)',
            borderRadius: '16px',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            zIndex: 1000,
            animation: 'slideUpTop 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          <style>{`
            @keyframes slideUpTop {
              from { transform: translate(-50%, -15px); opacity: 0; }
              to { transform: translate(-50%, 0); opacity: 1; }
            }
          `}</style>

          {/* Title Row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#fff', display: 'flex', alignItems: 'center', gap: '4px' }}>
              🎨 创意工具箱 (上游参考原图)
            </span>
            <button
              onClick={handleDownload}
              style={{
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '6px',
                padding: '3px 8px',
                fontSize: '10px',
                color: 'rgba(255, 255, 255, 0.8)',
              }}
            >
              📥 缓存到本地
            </button>
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid rgba(255, 255, 255, 0.08)', margin: '2px 0' }} />

          {/* 工具栏按钮 Grid */}
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '4px' }}>
            {[
              { id: 'angle', label: '🔄 角度' },
              { id: 'light', label: '💡 打光' },
              { id: 'panorama', label: '🌐 全景', direct: true, mockUrl: 'https://images.unsplash.com/photo-1507679799987-c73779587ccf' },
              { id: 'camera', label: '🎬 导演' },
              { id: 'hd', label: 'HD 高清' },
              { id: 'crop_work', label: '✂️ 裁剪', directAction: () => handleOpenWorkroom('crop'), highlight: true },
              { id: 'mask_work', label: '🖌️ 遮罩', directAction: () => handleOpenWorkroom('mask'), highlight: true },
              { id: 'brush_work', label: '✏️ 标注', directAction: () => handleOpenWorkroom('brush'), highlight: true },
              { id: 'grid_work', label: '⊞ 宫格', directAction: () => handleOpenWorkroom('grid'), highlight: true },
              { id: 'download', label: '⬇️ 下载', directAction: handleDownload },
              { id: 'fullscreen', label: '⛶ 全屏', directAction: handleOpenFullscreenPreview }
            ].map((tool) => {
              const active = activeSubPanel === tool.id;
              const isHighlight = (tool as any).highlight;
              return (
                <button
                  key={tool.id}
                  onClick={() => {
                    if (tool.directAction) {
                      tool.directAction();
                    } else if (tool.direct) {
                      triggerChainAction('360全景', tool.mockUrl || '');
                    } else {
                      setActiveSubPanel(active ? null : tool.id as any);
                    }
                  }}
                  style={{
                    flex: 1,
                    padding: '8px 2px',
                    borderRadius: '8px',
                    border: isHighlight
                      ? '1px solid rgba(168, 85, 247, 0.45)'
                      : (active ? '1px solid rgba(168, 85, 247, 0.5)' : '1px solid rgba(255, 255, 255, 0.05)'),
                    background: isHighlight
                      ? 'rgba(168, 85, 247, 0.12)'
                      : (active ? 'rgba(168, 85, 247, 0.15)' : 'rgba(255, 255, 255, 0.02)'),
                    color: isHighlight ? '#e9d5ff' : (active ? '#fff' : 'rgba(255, 255, 255, 0.75)'),
                    fontSize: '11px',
                    fontWeight: (active || isHighlight) ? 700 : 500,
                    cursor: 'pointer',
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    textAlign: 'center',
                    whiteSpace: 'nowrap',
                    boxShadow: isHighlight ? '0 0 10px rgba(168, 85, 247, 0.15)' : 'none'
                  }}
                  onMouseEnter={(e) => {
                    if (isHighlight) {
                      e.currentTarget.style.background = 'rgba(168, 85, 247, 0.25)';
                      e.currentTarget.style.boxShadow = '0 0 15px rgba(168, 85, 247, 0.45)';
                      e.currentTarget.style.color = '#fff';
                    } else if (!active) {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
                      e.currentTarget.style.color = '#fff';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (isHighlight) {
                      e.currentTarget.style.background = 'rgba(168, 85, 247, 0.12)';
                      e.currentTarget.style.boxShadow = '0 0 10px rgba(168, 85, 247, 0.15)';
                      e.currentTarget.style.color = '#e9d5ff';
                    } else if (!active) {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)';
                      e.currentTarget.style.color = 'rgba(255, 255, 255, 0.75)';
                    }
                  }}
                >
                  {tool.label}
                </button>
              );
            })}
          </div>

          {/* Sub Panels Container */}
          {activeSubPanel && (
            <div
              style={{
                background: 'rgba(0, 0, 0, 0.3)',
                borderRadius: '10px',
                border: '1px solid rgba(255, 255, 255, 0.06)',
                padding: '12px',
                marginTop: '4px',
                animation: 'slideUpTopSub 0.2s ease-out',
                color: '#fff',
              }}
            >
              <style>{`
                @keyframes slideUpTopSub {
                  from { transform: translateY(-5px); opacity: 0; }
                  to { transform: translateY(0); opacity: 1; }
                }
              `}</style>

              {/* 1. 角度面板 */}
              {activeSubPanel === 'angle' && (
                <div style={{ display: 'flex', gap: '16px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                    <div
                      style={{
                        width: '74px',
                        height: '74px',
                        borderRadius: '50%',
                        background: `radial-gradient(circle at 30% 30%, #ffffff 0%, rgba(168, 85, 247, 0.4) 40%, rgba(15, 23, 42, 0.95) 100%)`,
                        boxShadow: '0 0 15px rgba(168, 85, 247, 0.35), inset 0 0 10px rgba(255,255,255,0.2)',
                        transform: `rotateY(${angleVal}deg)`,
                        transition: 'transform 0.1s ease-out',
                      }}
                    />
                    <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)' }}>3D 角度球</span>
                  </div>

                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                      <span style={{ color: 'rgba(255,255,255,0.5)' }}>旋转角度偏角</span>
                      <span style={{ color: 'rgba(168, 85, 247, 1)', fontWeight: 'bold' }}>{angleVal}°</span>
                    </div>
                    <input
                      type="range"
                      className="nodrag"
                      onMouseDown={(e) => e.stopPropagation()}
                      min="-180"
                      max="180"
                      value={angleVal}
                      onChange={(e) => setAngleVal(parseInt(e.target.value))}
                      style={{ width: '100%', accentColor: '#a855f7', height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px' }}
                    />

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', marginTop: '4px' }}>
                      {directions.map((dir) => (
                        <button
                          key={dir}
                          onClick={() => handleDirSelect(dir)}
                          style={{
                            padding: '4px',
                            borderRadius: '4px',
                            background: selectedDir === dir ? 'rgba(168, 85, 247, 0.2)' : 'rgba(255, 255, 255, 0.02)',
                            border: selectedDir === dir ? '1px solid rgba(168, 85, 247, 0.4)' : '1px solid rgba(255,255,255,0.05)',
                            color: selectedDir === dir ? '#fff' : 'rgba(255,255,255,0.6)',
                            fontSize: '10px',
                            cursor: 'pointer',
                          }}
                        >
                          {dir}
                        </button>
                      ))}
                    </div>

                    <button
                      onClick={() => triggerChainAction(`角度旋转 ${angleVal}° (${selectedDir})`, 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119')}
                      style={{
                        marginTop: '4px',
                        padding: '6px',
                        borderRadius: '6px',
                        background: 'rgba(168, 85, 247, 0.2)',
                        border: '1px solid rgba(168, 85, 247, 0.4)',
                        color: '#fff',
                        fontSize: '11px',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                      }}
                    >
                      🔄 确认生成新角度节点
                    </button>
                  </div>
                </div>
              )}

              {/* 2. 打光面板 */}
              {activeSubPanel === 'light' && (
                <div style={{ display: 'flex', gap: '16px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                    <div
                      style={{
                        width: '74px',
                        height: '74px',
                        borderRadius: '50%',
                        background: `radial-gradient(circle at 35% 35%, #fff 0%, ${lightColor} 45%, rgba(10, 10, 15, 0.95) 100%)`,
                        boxShadow: `0 0 20px ${lightColor}44, inset 0 0 10px rgba(255,255,255,0.15)`,
                      }}
                    />
                    <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)' }}>光源立体球</span>
                  </div>

                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ display: 'flex', background: 'rgba(0,0,0,0.2)', borderRadius: '6px', padding: '2px' }}>
                      {['main', 'fill'].map((t) => (
                        <button
                          key={t}
                          onClick={() => setLightTab(t as any)}
                          style={{
                            flex: 1,
                            padding: '3px',
                            border: 'none',
                            borderRadius: '4px',
                            background: lightTab === t ? 'rgba(168, 85, 247, 0.2)' : 'transparent',
                            color: '#fff',
                            fontSize: '10px',
                            fontWeight: 'bold',
                            cursor: 'pointer',
                          }}
                        >
                          {t === 'main' ? '☀️ 主光源' : '🌖 辅光源'}
                        </button>
                      ))}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', marginTop: '2px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)' }}>光色:</span>
                        <input
                          type="color"
                          className="nodrag"
                          onMouseDown={(e) => e.stopPropagation()}
                          value={lightColor}
                          onChange={(e) => setLightColor(e.target.value)}
                          style={{ width: '20px', height: '18px', border: 'none', background: 'none', cursor: 'pointer' }}
                        />
                      </div>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        {['#ec4899', '#3b82f6', '#10b981', '#f59e0b', '#ffffff'].map((c) => (
                          <div
                            key={c}
                            onClick={() => setLightColor(c)}
                            style={{ width: '12px', height: '12px', borderRadius: '50%', background: c, border: lightColor === c ? '1.5px solid #fff' : 'none', cursor: 'pointer' }}
                          />
                        ))}
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', marginTop: '2px' }}>
                      <span style={{ color: 'rgba(255,255,255,0.5)' }}>照度强度</span>
                      <span style={{ color: 'rgba(168, 85, 247, 1)' }}>{lightIntensity}%</span>
                    </div>
                    <input
                      type="range"
                      className="nodrag"
                      onMouseDown={(e) => e.stopPropagation()}
                      min="10"
                      max="100"
                      value={lightIntensity}
                      onChange={(e) => setLightIntensity(parseInt(e.target.value))}
                      style={{ width: '100%', accentColor: '#a855f7', height: '3px', background: 'rgba(255,255,255,0.1)' }}
                    />

                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '2px' }}>
                      {lightPresets.map((p) => (
                        <button
                          key={p}
                          onClick={() => {
                            setSelectedLightPreset(p);
                            if (p === '蓝冰逆光') { setLightColor('#3b82f6'); setLightIntensity(90); }
                            else if (p === '林布兰光') { setLightColor('#ec4899'); setLightIntensity(75); }
                            else if (p === '蝴蝶光') { setLightColor('#f59e0b'); setLightIntensity(80); }
                            else if (p === '舞台光') { setLightColor('#a855f7'); setLightIntensity(95); }
                          }}
                          style={{
                            padding: '3px 6px',
                            borderRadius: '4px',
                            background: selectedLightPreset === p ? 'rgba(168, 85, 247, 0.2)' : 'rgba(255,255,255,0.02)',
                            border: '1.5px solid ' + (selectedLightPreset === p ? 'rgba(168, 85, 247, 0.5)' : 'rgba(255,255,255,0.05)'),
                            color: '#fff',
                            fontSize: '9px',
                            cursor: 'pointer',
                          }}
                        >
                          {p}
                        </button>
                      ))}
                    </div>

                    <button
                      onClick={() => triggerChainAction(`智能打光 (${selectedLightPreset})`, 'https://images.unsplash.com/photo-1541701494587-cb58502866ab')}
                      style={{
                        marginTop: '4px',
                        padding: '6px',
                        borderRadius: '6px',
                        background: 'linear-gradient(135deg, #a855f7, #ec4899)',
                        border: 'none',
                        color: '#fff',
                        fontSize: '11px',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                      }}
                    >
                      💡 确认打光并输出新节点
                    </button>
                  </div>
                </div>
              )}

              {/* 3. 导演分镜面板 */}
              {activeSubPanel === 'camera' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', fontWeight: 'bold' }}>📽️ 导演多级控制面板:</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div style={{ background: 'rgba(0,0,0,0.2)', padding: '8px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
                      <span style={{ fontSize: '10px', color: '#a855f7', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>🎥 运镜控制二级</span>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {cameraPans.map((c) => (
                          <button
                            key={c}
                            onClick={() => triggerChainAction(`运镜-${c}`, 'https://images.unsplash.com/photo-1451187580459-43490279c0fa')}
                            style={{ padding: '4px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '4px', color: 'rgba(255,255,255,0.8)', fontSize: '9px', textAlign: 'left', cursor: 'pointer' }}
                          >
                            {c}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div style={{ background: 'rgba(0,0,0,0.2)', padding: '8px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
                      <span style={{ fontSize: '10px', color: '#ec4899', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>🎭 情绪重塑二级</span>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {moodRemakes.map((m) => (
                          <button
                            key={m}
                            onClick={() => triggerChainAction(`情绪-${m}`, 'https://images.unsplash.com/photo-1511447333015-45b65e60f6d5')}
                            style={{ padding: '4px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '4px', color: 'rgba(255,255,255,0.8)', fontSize: '9px', textAlign: 'left', cursor: 'pointer' }}
                          >
                            {m}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 4. HD高清面板 */}
              {activeSubPanel === 'hd' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', fontWeight: 'bold' }}>✨ HD 智能多级菜单:</span>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
                    {hdOptions.map((opt) => (
                      <button
                        key={opt}
                        onClick={() => triggerChainAction(`HD-${opt}`, 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe')}
                        style={{
                          padding: '6px',
                          background: 'rgba(255,255,255,0.02)',
                          border: '1px solid rgba(255,255,255,0.06)',
                          borderRadius: '6px',
                          color: '#fff',
                          fontSize: '10px',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#a855f7')}
                        onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)')}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* 5. 分镜裁剪网格面板 */}
              {activeSubPanel === 'grid' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', fontWeight: 'bold' }}>⊞ 分镜网格裁切:</span>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
                    {gridOptions.map((opt) => (
                      <button
                        key={opt}
                        onClick={() => triggerChainAction(`网格-${opt}`, 'https://images.unsplash.com/photo-1511447333015-45b65e60f6d5')}
                        style={{
                          padding: '6px',
                          background: 'rgba(255,255,255,0.02)',
                          border: '1px solid rgba(255,255,255,0.06)',
                          borderRadius: '6px',
                          color: '#fff',
                          fontSize: '10px',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#ec4899')}
                        onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)')}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* 6. 比例裁剪 */}
              {activeSubPanel === 'crop' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', fontWeight: 'bold' }}>✂️ 比例物理裁剪调节</span>
                  <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
                    <div
                      style={{
                        width: '80px',
                        height: '60px',
                        background: 'rgba(0,0,0,0.4)',
                        border: '1.5px dashed rgba(168, 85, 247, 0.6)',
                        borderRadius: '6px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        position: 'relative',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          position: 'absolute',
                          width: cropRatio === '1:1' ? '40px' : cropRatio === '4:3' ? '50px' : cropRatio === '16:9' ? '70px' : cropRatio === '9:16' ? '25px' : '60px',
                          height: cropRatio === '1:1' ? '40px' : cropRatio === '4:3' ? '38px' : cropRatio === '16:9' ? '40px' : cropRatio === '9:16' ? '45px' : '30px',
                          border: '2px solid rgba(168, 85, 247, 0.95)',
                          background: 'rgba(168, 85, 247, 0.15)',
                          left: `${cropOffset - (cropRatio === '16:9' ? 35 : 20)}%`,
                          top: '50%',
                          transform: 'translateY(-50%)',
                          transition: 'all 0.2s',
                        }}
                      />
                    </div>

                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        {cropRatios.map((r) => (
                          <button
                            key={r}
                            onClick={() => setCropRatio(r)}
                            style={{
                              padding: '2px 4px',
                              borderRadius: '4px',
                              background: cropRatio === r ? 'rgba(168, 85, 247, 0.2)' : 'rgba(255,255,255,0.02)',
                              border: '1px solid ' + (cropRatio === r ? 'rgba(168, 85, 247, 0.5)' : 'rgba(255,255,255,0.05)'),
                              color: '#fff',
                              fontSize: '8px',
                              cursor: 'pointer',
                            }}
                          >
                            {r}
                          </button>
                        ))}
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px' }}>
                        <span style={{ color: 'rgba(255,255,255,0.4)' }}>裁剪偏移</span>
                        <span>{cropOffset}%</span>
                      </div>
                      <input
                        type="range"
                        className="nodrag"
                        onMouseDown={(e) => e.stopPropagation()}
                        min="20"
                        max="80"
                        value={cropOffset}
                        onChange={(e) => setCropOffset(parseInt(e.target.value))}
                        style={{ width: '100%', accentColor: '#a855f7', height: '3px' }}
                      />
                    </div>
                  </div>

                  <button
                    onClick={() => triggerChainAction(`本地裁剪 (${cropRatio})`, 'https://images.unsplash.com/photo-1550684848-fac1c5b4e853')}
                    style={{
                      padding: '6px',
                      background: 'rgba(168, 85, 247, 0.2)',
                      border: '1px solid rgba(168, 85, 247, 0.4)',
                      borderRadius: '6px',
                      color: '#fff',
                      fontSize: '10px',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                    }}
                  >
                    ✂️ 确认裁剪并生成连线子节点
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Video Fullscreen Lightbox Player */}
      {isFullscreenVideo && fileUrl && (
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
            setIsFullscreenVideo(false);
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
            {fileType === 'video' ? (
              <ResolvedMedia
                url={fileUrl}
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
                url={fileUrl}
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
              <span>🎥 Toonflow Canvas {fileType === 'video' ? '视频' : '图像'} 4K Lightbox 全屏预览</span>
              <button
                onClick={handleDownload}
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
              onClick={() => setIsFullscreenVideo(false)}
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
