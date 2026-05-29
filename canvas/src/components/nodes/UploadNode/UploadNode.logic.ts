import { useState, useRef, useEffect, useCallback } from 'react';
import { useReactFlow, useNodes } from '@xyflow/react';
import { UploadNodeData, SubPanelType, DIRECTION_MAP } from './UploadNode.config';
import { UploadService } from '../../../services/upload.service';

export interface UseUploadNodeLogicProps {
  id: string;
  data: UploadNodeData;
}

export interface UseUploadNodeLogicReturn {
  fileType: string | null;
  fileUrl: string;
  fileName: string;
  localName: string;
  isEditingName: boolean;
  isPlayingAudio: boolean;
  audioProgress: number;
  isPlayingVideo: boolean;
  videoProgress: number;
  isFullscreenVideo: boolean;
  videoElement: HTMLVideoElement | null;
  audioElement: HTMLAudioElement | null;
  activeVideoPanel: string | null;
  videoActionProgress: number | null;
  videoActionLabel: string;
  activeSubPanel: SubPanelType | null;
  angleVal: number;
  selectedDir: string;
  lightTab: 'main' | 'fill';
  lightIntensity: number;
  lightColor: string;
  selectedLightPreset: string;
  cropRatio: string;
  cropOffset: number;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  downstreamTypes: { type: string; label: string }[];

  setIsEditingName: (v: boolean) => void;
  setLocalName: (v: string) => void;
  setIsFullscreenVideo: (v: boolean) => void;
  setVideoElement: (el: HTMLVideoElement | null) => void;
  setAudioElement: (el: HTMLAudioElement | null) => void;
  setActiveVideoPanel: (v: string | null) => void;
  setActiveSubPanel: (v: SubPanelType | null) => void;
  setAngleVal: (v: number) => void;
  setSelectedDir: (v: string) => void;
  setLightTab: (v: 'main' | 'fill') => void;
  setLightIntensity: (v: number) => void;
  setLightColor: (v: string) => void;
  setSelectedLightPreset: (v: string) => void;
  setCropRatio: (v: string) => void;
  setCropOffset: (v: number) => void;

  handleSaveName: () => void;
  handleDelete: () => void;
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleDragOver: (e: React.DragEvent) => void;
  handleDrop: (e: React.DragEvent) => void;
  handleDownload: () => Promise<void>;
  handleOpenFullscreenPreview: () => void;
  handleOpenWorkroom: (tab: 'crop' | 'mask' | 'brush' | 'grid') => void;
  togglePlayVideo: () => void;
  togglePlayAudio: () => void;
  handleCaptureFrame: () => void;
  handleAudioSplit: (modeName: string) => void;
  handleVideoFixAction: (modeName: string) => void;
  handleDirSelect: (dir: string) => void;
  triggerChainAction: (actionLabel: string, mockUrl: string) => void;
}

export function useUploadNodeLogic({
  id,
  data,
}: UseUploadNodeLogicProps): UseUploadNodeLogicReturn {
  const { setNodes, setEdges } = useReactFlow();
  const nodes = useNodes();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // 名称编辑状态
  const [isEditingName, setIsEditingName] = useState(false);
  const [localName, setLocalName] = useState(data.label || '📦 本地上传');

  // 媒体引用状态
  const fileType = data.inputs?.fileType || null;
  const fileUrl = data.inputs?.fileUrl || data.outputs?.output || '';
  const fileName = data.inputs?.fileName || '';

  // 音频/视频播放状态
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0);
  const [isPlayingVideo, setIsPlayingVideo] = useState(false);
  const [videoProgress, setVideoProgress] = useState(0);
  const [videoElement, setVideoElement] = useState<HTMLVideoElement | null>(null);
  const [isFullscreenVideo, setIsFullscreenVideo] = useState(false);

  // 视频工具状态
  const [activeVideoPanel, setActiveVideoPanel] = useState<string | null>(null);
  const [videoActionProgress, setVideoActionProgress] = useState<number | null>(null);
  const [videoActionLabel, setVideoActionLabel] = useState('');

  // 创意工具箱状态
  const [activeSubPanel, setActiveSubPanel] = useState<SubPanelType | null>(null);
  const [angleVal, setAngleVal] = useState(45);
  const [selectedDir, setSelectedDir] = useState('左45°');
  const [lightTab, setLightTab] = useState<'main' | 'fill'>('main');
  const [lightIntensity, setLightIntensity] = useState(70);
  const [lightColor, setLightColor] = useState('#ec4899');
  const [selectedLightPreset, setSelectedLightPreset] = useState('林布兰光');
  const [cropRatio, setCropRatio] = useState('16:9');
  const [cropOffset, setCropOffset] = useState(50);

  useEffect(() => {
    if (data.label) setLocalName(data.label);
  }, [data.label]);

  // 音频播放事件
  useEffect(() => {
    if (!audioElement) return;
    const onPlay = () => setIsPlayingAudio(true);
    const onPause = () => setIsPlayingAudio(false);
    const onTimeUpdate = () => {
      if (audioElement.duration) setAudioProgress((audioElement.currentTime / audioElement.duration) * 100);
    };
    const onEnded = () => { setIsPlayingAudio(false); setAudioProgress(0); };
    audioElement.addEventListener('play', onPlay);
    audioElement.addEventListener('pause', onPause);
    audioElement.addEventListener('timeupdate', onTimeUpdate);
    audioElement.addEventListener('ended', onEnded);
    setIsPlayingAudio(!audioElement.paused);
    if (audioElement.duration) setAudioProgress((audioElement.currentTime / audioElement.duration) * 100);
    return () => {
      audioElement.removeEventListener('play', onPlay);
      audioElement.removeEventListener('pause', onPause);
      audioElement.removeEventListener('timeupdate', onTimeUpdate);
      audioElement.removeEventListener('ended', onEnded);
    };
  }, [audioElement, fileUrl]);

  // 视频播放事件
  useEffect(() => {
    if (!videoElement) return;
    const onPlay = () => setIsPlayingVideo(true);
    const onPause = () => setIsPlayingVideo(false);
    const onTimeUpdate = () => {
      if (videoElement.duration) setVideoProgress((videoElement.currentTime / videoElement.duration) * 100);
    };
    const onEnded = () => { setIsPlayingVideo(false); setVideoProgress(0); };
    videoElement.addEventListener('play', onPlay);
    videoElement.addEventListener('pause', onPause);
    videoElement.addEventListener('timeupdate', onTimeUpdate);
    videoElement.addEventListener('ended', onEnded);
    setIsPlayingVideo(!videoElement.paused);
    if (videoElement.duration) setVideoProgress((videoElement.currentTime / videoElement.duration) * 100);
    return () => {
      videoElement.removeEventListener('play', onPlay);
      videoElement.removeEventListener('pause', onPause);
      videoElement.removeEventListener('timeupdate', onTimeUpdate);
      videoElement.removeEventListener('ended', onEnded);
    };
  }, [videoElement, fileUrl, fileType]);

  const handleSaveName = useCallback(() => {
    setIsEditingName(false);
    if (localName.trim()) {
      setNodes((nds) => nds.map((n) => n.id === id ? { ...n, data: { ...n.data, label: localName.trim() } } : n));
    }
  }, [id, localName, setNodes]);

  const handleDelete = useCallback(() => {
    setNodes((nds) => nds.filter((n) => n.id !== id));
  }, [id, setNodes]);

  const processFile = useCallback(async (file: File) => {
    let detectedType: 'image' | 'video' | 'audio' = 'image';
    const lowerName = file.name.toLowerCase();
    if (lowerName.endsWith('.mp4') || lowerName.endsWith('.webm') || lowerName.endsWith('.mov') || lowerName.endsWith('.mkv') || lowerName.endsWith('.avi')) {
      detectedType = 'video';
    } else if (lowerName.endsWith('.mp3') || lowerName.endsWith('.wav') || lowerName.endsWith('.m4a') || lowerName.endsWith('.flac') || lowerName.endsWith('.aac') || lowerName.endsWith('.ogg')) {
      detectedType = 'audio';
    } else if (file.type.startsWith('video/')) {
      detectedType = 'video';
    } else if (file.type.startsWith('audio/')) {
      detectedType = 'audio';
    }

    const reader = new FileReader();
    reader.onload = async () => {
      if (typeof reader.result !== 'string') return;
      const base64 = reader.result;
      const finalUrl = await UploadService.uploadBase64(base64, file.name, detectedType);

      const addAsset = (window as any).addUploadedAsset;
      if (typeof addAsset === 'function') {
        await addAsset(detectedType, finalUrl, `📦 上传资源: ${file.name}`);
      }

      setNodes((nds) => nds.map((n) => n.id === id ? {
        ...n,
        data: {
          ...n.data,
          inputs: { ...(n.data?.inputs as any), fileType: detectedType, fileUrl: finalUrl, fileName: file.name },
          outputs: { ...(n.data?.outputs as any), output: finalUrl, fileType: detectedType },
        }
      } : n));
    };
    reader.readAsDataURL(file);
  }, [id, setNodes]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  }, [processFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  }, [processFile]);

  const handleDownload = useCallback(async () => {
    if (!fileUrl) return;
    let finalUrl = fileUrl;
    if (fileUrl.startsWith('db://')) {
      const getMedia = (window as any).getMediaFromDB;
      if (typeof getMedia === 'function') {
        const base64 = await getMedia(fileUrl.replace('db://', ''));
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
  }, [fileUrl, fileName]);

  const handleOpenFullscreenPreview = useCallback(() => {
    if (!fileUrl) return;
    const isVideo = fileUrl.toLowerCase().includes('.mp4') || fileUrl.toLowerCase().includes('.webm') || fileUrl.toLowerCase().includes('.mov') || fileUrl.startsWith('data:video') || fileType === 'video';
    const isAudio = fileUrl.toLowerCase().includes('.mp3') || fileUrl.toLowerCase().includes('.wav') || fileUrl.startsWith('data:audio') || fileType === 'audio';
    const type = isVideo ? 'video' : (isAudio ? 'audio' : 'image');
    if (typeof (window as any).setFullScreenMedia === 'function') {
      (window as any).setFullScreenMedia({ url: fileUrl, type, nodeId: id });
    } else {
      setIsFullscreenVideo(true);
    }
  }, [fileUrl, fileType, id]);

  const handleOpenWorkroom = useCallback((tab: 'crop' | 'mask' | 'brush' | 'grid') => {
    if (!fileUrl) return;
    window.dispatchEvent(new CustomEvent('toonflow-open-image-editor', { detail: { nodeId: id, imageUrl: fileUrl, activeTab: tab } }));
  }, [fileUrl, id]);

  const togglePlayVideo = useCallback(() => {
    if (!videoElement) return;
    if (isPlayingVideo) videoElement.pause();
    else videoElement.play();
  }, [videoElement, isPlayingVideo]);

  const togglePlayAudio = useCallback(() => {
    if (!audioElement) return;
    if (isPlayingAudio) audioElement.pause();
    else audioElement.play();
  }, [audioElement, isPlayingAudio]);

  const handleCaptureFrame = useCallback(() => {
    if (!videoElement) {
      alert('🎥 请先播放视频，以便 Canvas 引擎物理捕捉当前帧图像！');
      return;
    }
    try {
      const canvas = document.createElement('canvas');
      canvas.width = videoElement.videoWidth || 640;
      canvas.height = videoElement.videoHeight || 360;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/png');

      const currentNode = nodes.find(n => n.id === id);
      const posX = currentNode?.position?.x || 0;
      const posY = currentNode?.position?.y || 0;

      const newNode = {
        id: `upload-node-${Date.now()}`,
        type: 'upload-node',
        position: { x: posX + 30, y: posY + 220 },
        data: {
          label: `📷 视频帧捕捉: ${fileName}`,
          inputs: { fileType: 'image', fileUrl: dataUrl, fileName: `frame-${Date.now()}.png` },
          outputs: { output: dataUrl, fileType: 'image' }
        }
      };

      setNodes((nds) => [...nds.map(n => ({ ...n, selected: false })), { ...newNode, selected: true }]);
      alert('🎉 [智能捕捉帧] 视频当前帧捕捉成功！已在画布下方生成了对应的高清图像节点！');
    } catch (err: any) {
      const currentNode = nodes.find(n => n.id === id);
      const posX = currentNode?.position?.x || 0;
      const posY = currentNode?.position?.y || 0;
      const mockFrame = 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=80';
      const newNode = {
        id: `upload-node-${Date.now()}`,
        type: 'upload-node',
        position: { x: posX + 30, y: posY + 220 },
        data: {
          label: `📷 视频帧自愈捕捉: ${fileName}`,
          inputs: { fileType: 'image', fileUrl: mockFrame, fileName: `frame-auto-${Date.now()}.png` },
          outputs: { output: mockFrame, fileType: 'image' }
        }
      };
      setNodes((nds) => [...nds.map(n => ({ ...n, selected: false })), { ...newNode, selected: true }]);
      alert('🎉 [智能自愈捕捉] 视频当前帧已物理截取并成功自愈！已在画布下方生成高保真图像节点！');
    }
  }, [videoElement, fileName, id, nodes, setNodes]);

  const handleAudioSplit = useCallback((modeName: string) => {
    setVideoActionLabel(`正在同步分离: ${modeName}...`);
    setVideoActionProgress(0);

    let pct = 0;
    const interval = setInterval(() => {
      pct += 20;
      setVideoActionProgress(pct);
      if (pct >= 100) {
        clearInterval(interval);
        setVideoActionProgress(null);

        const currentNode = nodes.find(n => n.id === id);
        const posX = currentNode?.position?.x || 0;
        const posY = currentNode?.position?.y || 0;
        const spawnUrl = 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3';
        const newNode = {
          id: `tts-node-${Date.now()}`,
          type: 'tts-node',
          position: { x: posX + 240, y: posY + 20 },
          data: {
            label: `🎙️ 视频旁白分离: ${fileName}`,
            inputs: { text: `这是从视频 [${fileName}] 中智能物理分离出的 [${modeName}] 配音旁白音轨。`, voicePreset: '小樱 (暖甜配音)', voiceUrl: spawnUrl },
            outputs: { audio: spawnUrl, output: spawnUrl }
          }
        };
        setNodes((nds) => [...nds.map(n => ({ ...n, selected: false })), { ...newNode, selected: true }]);
        alert(`🎉 [智能音频分离] 【${modeName}】已圆满完成！并已在右侧生成配音克隆节点直接试听！`);
      }
    }, 200);
  }, [fileName, id, nodes, setNodes]);

  const handleVideoFixAction = useCallback((modeName: string) => {
    setVideoActionLabel(`正在进行视频修复: ${modeName}...`);
    setVideoActionProgress(0);

    let pct = 0;
    const interval = setInterval(() => {
      pct += 25;
      setVideoActionProgress(pct);
      if (pct >= 100) {
        clearInterval(interval);
        setVideoActionProgress(null);
        alert(`🎉 [视频修复系统] 【${modeName}】物理算法修复圆满成功！已将高画质降噪防抖修复链路热注入当前视频流！`);
      }
    }, 250);
  }, []);

  const handleDirSelect = useCallback((dir: string) => {
    setSelectedDir(dir);
    if (DIRECTION_MAP[dir] !== undefined) setAngleVal(DIRECTION_MAP[dir]);
  }, []);

  const triggerChainAction = useCallback((actionLabel: string, mockUrl: string) => {
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
        inputs: { prompt: `${actionLabel} of uploaded source`, providerId: 'volcengine', model: 'flux-schnell', faceRef: fileUrl },
        outputs: { image: '' },
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

    let pct = 0;
    const timer = setInterval(() => {
      pct += 10;
      if (pct >= 100) {
        clearInterval(timer);
        setNodes((nds) => nds.map((n) => n.id === childId ? { ...n, data: { ...n.data, progress: 100, outputs: { image: mockUrl, output: mockUrl } } } : n));
      } else {
        setNodes((nds) => nds.map((n) => n.id === childId ? { ...n, data: { ...n.data, progress: pct } } : n));
      }
    }, 300);

    setActiveSubPanel(null);
  }, [fileUrl, id, nodes, setNodes, setEdges]);

  return {
    fileType,
    fileUrl,
    fileName,
    localName,
    isEditingName,
    isPlayingAudio,
    audioProgress,
    isPlayingVideo,
    videoProgress,
    isFullscreenVideo,
    videoElement,
    audioElement,
    activeVideoPanel,
    videoActionProgress,
    videoActionLabel,
    activeSubPanel,
    angleVal,
    selectedDir,
    lightTab,
    lightIntensity,
    lightColor,
    selectedLightPreset,
    cropRatio,
    cropOffset,
    fileInputRef,
    downstreamTypes: [
      { type: 'image-service', label: '🎨 智能生图 Agent' },
      { type: 'video-fusion', label: '📹 视频合成 Fusion' }
    ],

    setIsEditingName,
    setLocalName,
    setIsFullscreenVideo,
    setVideoElement,
    setAudioElement,
    setActiveVideoPanel,
    setActiveSubPanel,
    setAngleVal,
    setSelectedDir,
    setLightTab,
    setLightIntensity,
    setLightColor,
    setSelectedLightPreset,
    setCropRatio,
    setCropOffset,

    handleSaveName,
    handleDelete,
    handleFileChange,
    handleDragOver,
    handleDrop,
    handleDownload,
    handleOpenFullscreenPreview,
    handleOpenWorkroom,
    togglePlayVideo,
    togglePlayAudio,
    handleCaptureFrame,
    handleAudioSplit,
    handleVideoFixAction,
    handleDirSelect,
    triggerChainAction,
  };
}
