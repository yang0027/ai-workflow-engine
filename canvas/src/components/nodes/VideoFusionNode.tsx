import { useState, useEffect, useRef, useMemo } from 'react';
import { Handle, Position, useReactFlow, useStore, useNodes } from '@xyflow/react';
import { RunningHubService } from '../../services/runninghub.service';
import { ResolvedMedia } from '../ResolvedMedia';

const DEFAULT_PROVIDER_VIDEO_MODELS: Record<string, string[]> = {
  vidu: ['vidu-high-speed', 'vidu-premium'],
  volcengine: ['seedance-v1', 'seedance-v2'],
  minimax: ['minimax-video-v1', 'minimax-video-v2'],
  ali: ['wanx-video-v1', 'wanx-video-v2']
};

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
      image?: string; // Fallback image compatibility
      audio?: string; // Fallback audio compatibility
      providerId?: string;
      model?: string;
      width?: number;
      height?: number;
      duration?: number;
      activeTab?: 'standard' | 'aix';
      runningHubTemplateId?: string;
      [key: string]: any; // 支持动态 aix 表单项
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

  // 智能管线导流舱菜单状态
  const [showLeftDerive, setShowLeftDerive] = useState(false);
  const [showRightDerive, setShowRightDerive] = useState(false);

  const upstreamTypes = [
    { type: 'image-service', label: '🎨 智能生图 Agent' },
    { type: 'tts-service', label: '🗣️ 声音克隆 Agent' }
  ];
  const downstreamTypes = [
    { type: 'grid-splitter', label: '⊞ 智能切片' }
  ];

  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 连线与智能多输入流入自愈提取
  const edges = useStore((state) => state.edges);
  const nodes = useNodes();

  // 动态扫描指向 input 手柄的所有上游连接并智能归类
  const { connectedPrompt, connectedRefImage, connectedRefVideo, connectedRefAudio, connectedImages } = useMemo(() => {
    const connectedEdges = edges.filter(e => e.target === id && e.targetHandle === 'input');
    const connectedPrompts: string[] = [];
    const connectedImgs: string[] = [];
    const connectedVids: string[] = [];
    const connectedAuds: string[] = [];

    connectedEdges.forEach(edge => {
      const srcNode = nodes.find(n => n.id === edge.source);
      if (!srcNode) return;
      const outputs = (srcNode.data?.outputs || {}) as any;
      const inputs = (srcNode.data?.inputs || {}) as any;
      
      const val = outputs.output || outputs.video || outputs.image || outputs.audio || outputs.prompt || outputs.text || outputs.storyboard || inputs.text || '';
      if (!val) return;

      if (typeof val === 'string') {
        const lowerVal = val.toLowerCase();
        if (srcNode.type === 'tts-service' || lowerVal.includes('audio') || val.endsWith('.mp3') || val.endsWith('.wav') || val.endsWith('.ogg') || val.endsWith('.m4a') || val.startsWith('data:audio/')) {
          connectedAuds.push(val);
        } else if (srcNode.type === 'image-service' || srcNode.type === 'upload-node' || (lowerVal.includes('image') || val.startsWith('data:image/') || val.endsWith('.png') || val.endsWith('.jpg') || val.endsWith('.jpeg') || val.endsWith('.webp'))) {
          connectedImgs.push(val);
        } else if (srcNode.type === 'video-fusion' || (srcNode.type === 'upload-node' && (lowerVal.includes('video') || val.endsWith('.mp4') || val.endsWith('.webm') || val.endsWith('.mov') || val.startsWith('data:video/')))) {
          connectedVids.push(val);
        } else {
          connectedPrompts.push(val);
        }
      }
    });

    return {
      connectedPrompt: connectedPrompts.join('\n'),
      connectedRefImage: connectedImgs[0] || '',
      connectedRefVideo: connectedVids[0] || '',
      connectedRefAudio: connectedAuds[0] || '',
      connectedImages: connectedImgs
    };
  }, [edges, nodes, id]);

  const isPromptConnected = !!connectedPrompt;
  const isRefImageConnected = !!connectedRefImage;
  const isRefVideoConnected = !!connectedRefVideo;
  const isRefAudioConnected = !!connectedRefAudio;

  const allConnectedAssets = useMemo(() => {
    const list: { type: 'image' | 'video' | 'audio', url: string, name: string, nodeId: string }[] = [];
    const connectedEdges = edges.filter(e => e.target === id && e.targetHandle === 'input');
    connectedEdges.forEach((edge, idx) => {
      const srcNode = nodes.find(n => n.id === edge.source);
      if (!srcNode) return;
      const outputs = (srcNode.data?.outputs || {}) as any;
      const inputs = (srcNode.data?.inputs || {}) as any;
      const val = outputs.output || outputs.video || outputs.image || outputs.audio || outputs.prompt || outputs.text || outputs.storyboard || inputs.text || '';
      if (!val) return;

      if (typeof val === 'string') {
        const lowerVal = val.toLowerCase();
        let type: 'image' | 'video' | 'audio' = 'image';
        if (srcNode.type === 'tts-service' || lowerVal.includes('audio') || val.endsWith('.mp3') || val.endsWith('.wav') || val.endsWith('.ogg') || val.endsWith('.m4a') || val.startsWith('data:audio/')) {
          type = 'audio';
        } else if (srcNode.type === 'video-fusion' || (srcNode.type === 'upload-node' && (lowerVal.includes('video') || val.endsWith('.mp4') || val.endsWith('.webm') || val.endsWith('.mov') || val.startsWith('data:video/')))) {
          type = 'video';
        }
        list.push({
          type,
          url: val,
          name: (srcNode.data?.label as string) || `${type === 'image' ? '参考图' : type === 'video' ? '参考视频' : '参考音频'}-${idx + 1}`,
          nodeId: srcNode.id
        });
      }
    });
    return list;
  }, [edges, nodes, id]);

  const handleRemoveRefAsset = (nodeId: string) => {
    setEdges(eds => eds.filter(e => !(e.target === id && e.source === nodeId)));
  };

  const handleAddRefAssetPhysicalNode = (url: string, fileName: string, fileMime: string) => {
    if ((window as any).spawnLinkedNode) {
      const currentNode = nodes.find(n => n.id === id);
      const posX = currentNode ? currentNode.position.x : 0;
      const posY = currentNode ? currentNode.position.y : 0;

      const connCount = edges.filter(e => e.target === id).length;
      const staggeredOffsetY = -120 + connCount * 80;

      let fileType: 'image' | 'video' | 'audio' = 'image';
      if (fileMime.startsWith('video/')) fileType = 'video';
      else if (fileMime.startsWith('audio/')) fileType = 'audio';

      (window as any).spawnLinkedNode(id, 'upload-node', 'left', {
        fileType,
        fileUrl: url,
        fileName: fileName,
        position: { x: posX - 420, y: posY + staggeredOffsetY }
      });
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    try {
      Array.from(files).forEach(file => {
        const reader = new FileReader();
        reader.onerror = (err) => {
          console.error('[VideoFusionNode] FileReader error:', err);
          alert('文件读取失败！');
        };
        reader.onload = async () => {
          try {
            if (typeof reader.result === 'string') {
              const base64 = reader.result;
              const saveMedia = (window as any).saveMediaToDB;
              let finalUrl = base64;
              if (typeof saveMedia === 'function') {
                const mediaId = `media-asset-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                await saveMedia(mediaId, base64);
                finalUrl = `db://${mediaId}`;
              }
              handleAddRefAssetPhysicalNode(finalUrl, file.name, file.type);
            }
          } catch (onloadErr) {
            console.error('[VideoFusionNode] FileReader onload error:', onloadErr);
          }
        };
        reader.readAsDataURL(file);
      });
    } catch (err) {
      console.error('[VideoFusionNode] handleFileChange error:', err);
    }
  };

  const handleOpenWorkflowsModal = () => {
    window.dispatchEvent(
      new CustomEvent('open-large-modal', {
        detail: { tab: 'workflows', nodeTarget: id, type: 'video' }
      })
    );
  };

  // 状态
  const [activeTab, setActiveTab] = useState<'standard' | 'aix'>(data.inputs?.activeTab || 'standard');
  const [videoModeTab, setVideoModeTab] = useState<'all' | 'edit' | 'ref' | 'extend'>(data.inputs?.videoModeTab || 'all');
  const [runningHubTemplateId, setRunningHubTemplateId] = useState<string>(data.inputs?.runningHubTemplateId || 'rh_wf_video_fusion');
  const [videoModels, setVideoModels] = useState<string[]>(['vidu-high-speed', 'seedance-v1', 'ali-video-premium']);
  const [fusing, setFusing] = useState(false);
  const [fusedVideo, setFusedVideo] = useState('');
  const [settings, setSettings] = useState<any>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [localName, setLocalName] = useState(data.label || '视频生成');
  const [showMentionList, setShowMentionList] = useState(false);

  // Popover 浮层状态管理
  const [activePopover, setActivePopover] = useState<'model' | 'mode' | 'specs' | 'gallery' | 'workflow' | 'count' | null>(null);
  const [activeVendor, setActiveVendor] = useState<'volcengine' | 'vidu' | 'minimax' | 'ali'>('vidu');

  const containerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setActivePopover(null);
      }
    };
    if (activePopover) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [activePopover]);



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

  // 获取 RunningHub 的模板工作流列表
  const [workflows, setWorkflows] = useState<any[]>(() => 
    RunningHubService.getWorkflows().filter(w => !w.capability || w.capability === 'video')
  );
  useEffect(() => {
    const handleUpdate = () => {
      setWorkflows(RunningHubService.getWorkflows().filter(w => !w.capability || w.capability === 'video'));
    };
    window.addEventListener('runninghub_workflows_updated', handleUpdate);
    return () => window.removeEventListener('runninghub_workflows_updated', handleUpdate);
  }, []);
  const currentTemplate = useMemo(() => {
    if (data.inputs?.customTemplate) {
      return data.inputs.customTemplate;
    }
    return workflows.find(w => w.id === runningHubTemplateId) || workflows[0];
  }, [workflows, runningHubTemplateId, data.inputs?.customTemplate]);

  const unifiedParams = useMemo(() => {
    if (!currentTemplate) return [];
    if (currentTemplate.paramsSchema) {
      // 本地ComfyUI/RunningHub自定义模板参数定义
      return currentTemplate.paramsSchema.map((p: any) => ({
        nodeId: p.nodeId,
        fieldName: p.fieldName,
        fieldType: p.type === 'number' ? 'number' : 'string',
        fieldValue: p.defaultValue,
        description: p.label || p.fieldName,
        exposed: p.exposed,
        portId: p.id,
        type: p.type
      }));
    } else if (currentTemplate.nodeInfoList) {
      // 官方云端预设模板参数定义
      return currentTemplate.nodeInfoList.map((info: any) => ({
        nodeId: info.nodeId,
        fieldName: info.fieldName,
        fieldType: info.fieldType,
        fieldValue: info.fieldValue,
        description: info.description,
        exposed: true,
        portId: `${info.nodeId}_${info.fieldName}`,
        type: 'text'
      }));
    }
    return [];
  }, [currentTemplate]);

  // 初始化获取全局配置视频模型
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const res = await fetch('http://localhost:3000/api/v1/settings');
        if (res.ok) {
          const settingsData = await res.json();
          setSettings(settingsData);
          if (settingsData.model_cache?.video) {
            setVideoModels(settingsData.model_cache.video);
          }
        }
      } catch (e) {
        console.error('加载 VideoFusionNode 外部依赖失败:', e);
      }
    };
    loadSettings();
  }, []);

  const providerId = data.inputs?.providerId || 'vidu';

  const currentProviderModels = useMemo(() => {
    const defaultModels = DEFAULT_PROVIDER_VIDEO_MODELS[providerId] || videoModels;
    if (!settings || !settings.providers || !settings.providers[providerId]) {
      return defaultModels;
    }
    const provider = settings.providers[providerId];
    if (!provider.models || !Array.isArray(provider.models)) {
      return defaultModels;
    }
    const videoKeywords = /video|vidu|seedance|wanx|sora|ray|svd|cogvideo|luma/i;
    const filtered = provider.models.filter((m: string) => videoKeywords.test(m));
    return filtered.length > 0 ? filtered : defaultModels;
  }, [settings, providerId, videoModels]);

  const model = data.inputs?.model || currentProviderModels[0] || 'vidu-high-speed';

  // 当服务商或可选模型列表变化时，自动校验并重置当前选中的模型
  useEffect(() => {
    if (currentProviderModels.length > 0) {
      if (!currentProviderModels.includes(model)) {
        handleInputChange('model', currentProviderModels[0]);
      }
    }
  }, [providerId, currentProviderModels, model]);

  const updateNodeData = (updates: any) => {
    setNodes((nodes) =>
      nodes.map((n) => {
        if (n.id === id) {
          return {
            ...n,
            data: {
              ...n.data,
              inputs: {
                ...((n.data as any)?.inputs || {}),
                ...updates
              }
            }
          };
        }
        return n;
      })
    );
  };

  const handleInputChange = (field: string, val: any) => {
    updateNodeData({ [field]: val });
  };

  const handleOpenAssetsModal = (type: 'image' | 'video' | 'audio' = 'image') => {
    window.dispatchEvent(
      new CustomEvent('open-large-modal', {
        detail: { tab: 'assets', nodeTarget: id, type }
      })
    );
  };

  const updateSizeFromSpecs = (ratio: string, clarity: string) => {
    let w = 1280;
    let h = 720;
    let scale = 1.0;
    
    if (clarity === '480p') scale = 0.625;
    else if (clarity === '720p') scale = 1.0;
    else if (clarity === '1080p') scale = 1.5;
    else if (clarity === '2K') scale = 2.0;
    else if (clarity === '4K') scale = 3.0;

    if (ratio === '自适应') {
      w = Math.round(1280 * scale);
      h = Math.round(720 * scale);
    } else if (ratio === '16:9') {
      w = Math.round(1280 * scale);
      h = Math.round(720 * scale);
    } else if (ratio === '9:16') {
      w = Math.round(720 * scale);
      h = Math.round(1280 * scale);
    } else if (ratio === '4:3') {
      w = Math.round(1024 * scale);
      h = Math.round(768 * scale);
    } else if (ratio === '1:1') {
      w = Math.round(1024 * scale);
      h = Math.round(1024 * scale);
    } else if (ratio === '3:4') {
      w = Math.round(768 * scale);
      h = Math.round(1024 * scale);
    } else if (ratio === '21:9') {
      w = Math.round(1680 * scale);
      h = Math.round(720 * scale);
    } else {
      w = Math.round(1024 * scale);
      h = Math.round(1024 * scale);
    }

    updateNodeData({
      aspectRatio: ratio,
      clarity: clarity,
      width: w,
      height: h
    });
  };

  const handleTabChange = (tab: 'standard' | 'aix') => {
    setActiveTab(tab);
    handleInputChange('activeTab', tab);
  };

  const handleDelete = () => {
    setNodes((nds) => nds.filter((n) => n.id !== id));
    setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
  };

  // 文件读取处理函数
  const readAsBase64 = (file: File, field: string) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        handleInputChange(field, reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) readAsBase64(file, 'refImage');
  };

  const handleVideoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) readAsBase64(file, 'refVideo');
  };

  const handleAudioFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) readAsBase64(file, 'refAudio');
  };

  // 视频合成与 RunningHub 执行适配
  const handleVideoFusion = async () => {
    const finalPrompt = isPromptConnected ? connectedPrompt : (data.inputs?.prompt || '');
    const finalImage = isRefImageConnected ? connectedRefImage : (data.inputs?.refImage || data.inputs?.image || '');
    const finalVideo = isRefVideoConnected ? connectedRefVideo : (data.inputs?.refVideo || '');
    const finalAudio = isRefAudioConnected ? connectedRefAudio : (data.inputs?.refAudio || data.inputs?.audio || '');

    setFusing(true);
    setFusedVideo('');

    try {
      if (activeTab === 'aix') {
        if (!currentTemplate) {
          alert('请选择有效的 RunningHub 云端工作流模板！');
          setFusing(false);
          return;
        }

        const aixInputs: Record<string, any> = {};
        let textParamIndex = 0;
        let imageParamIndex = 0;
        let videoParamIndex = 0;
        let audioParamIndex = 0;

        unifiedParams.forEach((p: any) => {
          const fieldLower = p.fieldName.toLowerCase();
          const displayLower = (p.description || '').toLowerCase();
          const inputKey = p.portId;
          const isNum = p.fieldType === 'number' || typeof p.fieldValue === 'number';

          const isText = fieldLower === 'text' || fieldLower === 'prompt' || fieldLower === 'instruction' || fieldLower === 'description' || displayLower.includes('提示词') || displayLower.includes('文本') || displayLower.includes('指令');
          const isImage = p.type === 'image' || fieldLower === 'image' || fieldLower === 'faceref' || fieldLower === 'img' || fieldLower === 'refimage' || fieldLower === 'ref_image' || displayLower.includes('图片') || displayLower.includes('图像');
          const isVideo = p.type === 'video' || fieldLower === 'video' || fieldLower === 'refvideo' || fieldLower === 'ref_video' || displayLower.includes('视频');
          const isAudio = p.type === 'audio' || fieldLower === 'audio' || fieldLower === 'refaudio' || fieldLower === 'ref_audio' || displayLower.includes('音频') || displayLower.includes('声音') || displayLower.includes('配音');

          if (isText) {
            if (textParamIndex === 0) {
              aixInputs[inputKey] = finalPrompt;
            } else {
              aixInputs[inputKey] = data.inputs?.[inputKey] !== undefined ? data.inputs[inputKey] : p.fieldValue;
            }
            textParamIndex++;
          } else if (isImage) {
            if (imageParamIndex === 0) {
              aixInputs[inputKey] = finalImage;
            } else {
              aixInputs[inputKey] = data.inputs?.[inputKey] !== undefined ? data.inputs[inputKey] : p.fieldValue;
            }
            imageParamIndex++;
          } else if (isVideo) {
            if (videoParamIndex === 0) {
              aixInputs[inputKey] = finalVideo;
            } else {
              aixInputs[inputKey] = data.inputs?.[inputKey] !== undefined ? data.inputs[inputKey] : p.fieldValue;
            }
            videoParamIndex++;
          } else if (isAudio) {
            if (audioParamIndex === 0) {
              aixInputs[inputKey] = finalAudio;
            } else {
              aixInputs[inputKey] = data.inputs?.[inputKey] !== undefined ? data.inputs[inputKey] : p.fieldValue;
            }
            audioParamIndex++;
          } else if (fieldLower === 'width' || fieldLower === 'w') {
            const wVal = data.inputs?.width || 1280;
            aixInputs[inputKey] = isNum ? wVal : String(wVal);
          } else if (fieldLower === 'height' || fieldLower === 'h') {
            const hVal = data.inputs?.height || 720;
            aixInputs[inputKey] = isNum ? hVal : String(hVal);
          } else if (fieldLower === 'batch_size' || fieldLower === 'batchsize' || fieldLower === 'count' || fieldLower === 'number') {
            aixInputs[inputKey] = isNum ? 1 : '1';
          } else {
            aixInputs[inputKey] = data.inputs?.[inputKey] !== undefined ? data.inputs[inputKey] : p.fieldValue;
          }
        });

        textParamIndex = 0;
        imageParamIndex = 0;
        videoParamIndex = 0;
        audioParamIndex = 0;

        const dynamicMappings = unifiedParams.map((p: any) => {
          const fieldLower = p.fieldName.toLowerCase();
          const displayLower = (p.description || '').toLowerCase();
          const inputKey = p.portId;
          const isNum = p.fieldType === 'number' || typeof p.fieldValue === 'number';

          const isText = fieldLower === 'text' || fieldLower === 'prompt' || fieldLower === 'instruction' || fieldLower === 'description' || displayLower.includes('提示词') || displayLower.includes('文本') || displayLower.includes('指令');
          const isImage = p.type === 'image' || fieldLower === 'image' || fieldLower === 'faceref' || fieldLower === 'img' || fieldLower === 'refimage' || fieldLower === 'ref_image' || displayLower.includes('图片') || displayLower.includes('图像');
          const isVideo = p.type === 'video' || fieldLower === 'video' || fieldLower === 'refvideo' || fieldLower === 'ref_video' || displayLower.includes('视频');
          const isAudio = p.type === 'audio' || fieldLower === 'audio' || fieldLower === 'refaudio' || fieldLower === 'ref_audio' || displayLower.includes('音频') || displayLower.includes('声音') || displayLower.includes('配音');

          let mappedVal = data.inputs?.[inputKey] !== undefined ? data.inputs[inputKey] : p.fieldValue;

          if (isText) {
            if (textParamIndex === 0) mappedVal = finalPrompt;
            textParamIndex++;
          } else if (isImage) {
            if (imageParamIndex === 0) mappedVal = finalImage;
            imageParamIndex++;
          } else if (isVideo) {
            if (videoParamIndex === 0) mappedVal = finalVideo;
            videoParamIndex++;
          } else if (isAudio) {
            if (audioParamIndex === 0) mappedVal = finalAudio;
            audioParamIndex++;
          } else if (fieldLower === 'width' || fieldLower === 'w') {
            mappedVal = data.inputs?.width || 1280;
          } else if (fieldLower === 'height' || fieldLower === 'h') {
            mappedVal = data.inputs?.height || 720;
          } else if (fieldLower === 'batch_size' || fieldLower === 'batchsize' || fieldLower === 'count' || fieldLower === 'number') {
            mappedVal = 1;
          }

          return {
            portId: inputKey,
            nodeId: p.nodeId,
            fieldName: p.fieldName,
            displayName: p.description || p.fieldName,
            value: mappedVal
          };
        });

        const wfSource = currentTemplate.source || 'runninghub';
        const wfIdOrJson = wfSource === 'local_comfyui'
          ? (currentTemplate.rawWorkflowJson ? JSON.stringify(currentTemplate.rawWorkflowJson) : '')
          : (currentTemplate.workflowRef || currentTemplate.appId);

        const outputUrl = await RunningHubService.executeCustomWorkflow(
          wfSource,
          wfIdOrJson,
          aixInputs,
          dynamicMappings
        );

        if (outputUrl) {
          const finalUrl = outputUrl.startsWith('http') ? outputUrl : `http://localhost:4000${outputUrl}`;
          setFusedVideo(finalUrl);

          setNodes((nodes) =>
            nodes.map((n) => {
              if (n.id === id) {
                return {
                  ...n,
                  data: {
                    ...n.data,
                    outputs: {
                      ...((n.data as any)?.outputs || {}),
                      video: finalUrl,
                      output: finalUrl,
                      errorMsg: ''
                    }
                  }
                };
              }
              return n;
            })
          );

          window.dispatchEvent(
            new CustomEvent('add-success-log', {
              detail: {
                nodeId: id,
                nodeName: data.title || '视频融合 (Video)',
                model: currentTemplate.name,
                errorMsg: '云端 RunningHub 任务执行成功 ✅',
                outputUrl: finalUrl,
                type: 'video'
              }
            })
          );
        } else {
          throw new Error('云端任务已完成，但未返回有效的视频成果 URL。');
        }

      } else {
        if (!finalImage.trim()) {
          alert('请输入图片 URL/Base64，或者将上游节点连接至图片参考输入！');
          setFusing(false);
          return;
        }
        if (!finalAudio.trim()) {
          alert('请输入音频 URL/Base64，或者将上游节点连接至声音参考输入！');
          setFusing(false);
          return;
        }

        const res = await fetch('http://localhost:3000/api/v1/workflow/video/fusion', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageBase64: finalImage,
            audioBase64: finalAudio,
            width: data.inputs?.width || 1024,
            height: data.inputs?.height || 1024,
            duration: data.inputs?.duration || 5,
            providerId: providerId,
            model: model,
            prompt: finalPrompt,
            refVideo: finalVideo
          })
        });

        const resData = await res.json();
        if (res.ok && resData.success && resData.videoUrl) {
          const video = resData.videoUrl.startsWith('http') 
            ? resData.videoUrl 
            : `http://localhost:4000${resData.videoUrl}`;
          
          setFusedVideo(video);

          setNodes((nodes) =>
            nodes.map((n) => {
              if (n.id === id) {
                return {
                  ...n,
                  data: {
                    ...n.data,
                    outputs: {
                      ...((n.data as any)?.outputs || {}),
                      video: video,
                      output: video,
                      errorMsg: ''
                    }
                  }
                };
              }
              return n;
            })
          );

          window.dispatchEvent(
            new CustomEvent('add-success-log', {
              detail: {
                nodeId: id,
                nodeName: data.title || '视频融合 (Video)',
                model: model,
                errorMsg: `视频生成成功 ✅ 已完成音视频融合合成`,
                outputUrl: video,
                type: 'video'
              }
            })
          );
        } else {
          const errorReason = resData.error || resData.message || '未生成视频链接';
          throw new Error(errorReason);
        }
      }
    } catch (e: any) {
      console.error(e);
      const errorMsg = e.message || '视频生成任务执行失败';
      setFusedVideo('');
      setNodes((nodes) =>
        nodes.map((n) => {
          if (n.id === id) {
            return {
              ...n,
              data: {
                ...n.data,
                outputs: {
                  ...((n.data as any)?.outputs || {}),
                  video: '',
                  output: '',
                  errorMsg: errorMsg
                }
              }
            };
          }
          return n;
        })
      );
      
      window.dispatchEvent(
        new CustomEvent('add-failure-log', {
          detail: {
            nodeId: id,
            nodeName: data.title || '视频融合 (Video)',
            model: activeTab === 'aix' ? (currentTemplate?.name || 'aix') : model,
            errorMsg: errorMsg
          }
        })
      );
    } finally {
      setFusing(false);
    }
  };

  const handleDownloadVideo = () => {
    const vidUrl = fusedVideo || data.outputs?.video;
    if (!vidUrl) {
      alert('暂无可下载的视频！');
      return;
    }
    const a = document.createElement('a');
    a.href = vidUrl;
    a.download = `toonflow-video-${id}.mp4`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleSpawnSingleUpload = () => {
    if ((window as any).spawnLinkedNode) {
      (window as any).spawnLinkedNode(id, 'upload-node', 'left', { fileType: 'image' });
      window.dispatchEvent(
        new CustomEvent('open-large-modal', {
          detail: { tab: 'assets', nodeTarget: id, type: 'image' }
        })
      );
    } else {
      alert('未检测到智能连线引擎支持！');
    }
  };

  const handleSpawnDoubleUpload = () => {
    if ((window as any).spawnLinkedNode) {
      const currentNode = nodes.find(n => n.id === id);
      const posX = currentNode ? currentNode.position.x : 0;
      const posY = currentNode ? currentNode.position.y : 0;

      (window as any).spawnLinkedNode(id, 'upload-node', 'left', { 
        fileType: 'image', 
        label: '🖼️ 图像首帧',
        position: { x: posX - 260, y: posY - 80 }
      });
      setTimeout(() => {
        (window as any).spawnLinkedNode(id, 'upload-node', 'left', { 
          fileType: 'image', 
          label: '🖼️ 图像尾帧',
          position: { x: posX - 260, y: posY + 80 }
        });
      }, 50);
    } else {
      alert('未检测到智能连线引擎支持！');
    }
  };

  const handleSpawnTripleUpload = () => {
    if ((window as any).spawnLinkedNode) {
      const currentNode = nodes.find(n => n.id === id);
      const posX = currentNode ? currentNode.position.x : 0;
      const posY = currentNode ? currentNode.position.y : 0;

      (window as any).spawnLinkedNode(id, 'upload-node', 'left', { 
        fileType: 'image', 
        label: '🖼️ 图像参考',
        position: { x: posX - 260, y: posY - 120 }
      });
      setTimeout(() => {
        (window as any).spawnLinkedNode(id, 'upload-node', 'left', { 
          fileType: 'video', 
          label: '📹 视频参考',
          position: { x: posX - 260, y: posY }
        });
      }, 50);
      setTimeout(() => {
        (window as any).spawnLinkedNode(id, 'upload-node', 'left', { 
          fileType: 'audio', 
          label: '🎵 音频参考',
          position: { x: posX - 260, y: posY + 120 }
        });
      }, 100);
    } else {
      alert('未检测到智能连线引擎支持！');
    }
  };

  const progressPercent = data.progress !== undefined ? data.progress : (fusing ? 45 : 0);
  const showVid = fusedVideo || data.outputs?.video;
  const currentPrompt = isPromptConnected ? connectedPrompt : (data.inputs?.prompt || '');
  const currentImage = isRefImageConnected ? connectedRefImage : (data.inputs?.refImage || data.inputs?.image || '');
  const currentVideo = isRefVideoConnected ? connectedRefVideo : (data.inputs?.refVideo || '');
  const currentAudio = isRefAudioConnected ? connectedRefAudio : (data.inputs?.refAudio || data.inputs?.audio || '');

  // 提示词文本框随文字数量自适应高度 (最小 42px，最大 140px 最佳实践，超出滚动)
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      const scrollHeight = textarea.scrollHeight;
      textarea.style.height = `${Math.min(Math.max(scrollHeight, 42), 140)}px`;
    }
  }, [currentPrompt]);

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
      ref={containerRef}
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
      {selected && (
        <button
          onClick={handleDelete}
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
        {showVid && selected && (
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
          <video 
            src={showVid} 
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

      {/* 10000px 物理遮罩已彻底剔除，升级为超轻量 containerRef 全局 document 监听，完美根治拖拽粘连 Bug */}

      {/* 选中态底部悬浮配置面板 - 580px 玻璃拟态控制面板 */}
      {selected && (
        <div
          className="nodrag"
          style={{
            position: 'absolute',
            top: 'calc(100% + 12px)', // 完美贴合节点正下方，绝无任何物理重合遮挡
            left: '50%',
            transform: 'translateX(-50%)',
            width: '580px',
            background: 'rgba(11, 15, 26, 0.95)',
            backdropFilter: 'blur(24px)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.65), 0 0 30px rgba(168, 85, 247, 0.1)',
            borderRadius: '16px',
            padding: '12px 14px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            zIndex: 2000,
            animation: 'slideUpVideoNode 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
          }}
        >
          <style>{`
            @keyframes slideUpVideoNode {
              from { transform: translate(-50%, 15px); opacity: 0; }
              to { transform: translate(-50%, 0); opacity: 1; }
            }
            .pill-capsule-button {
              background: rgba(255, 255, 255, 0.04);
              border: 1px solid rgba(255, 255, 255, 0.06);
              border-radius: 20px;
              color: rgba(255, 255, 255, 0.7);
              padding: 4px 10px;
              font-size: 10.5px;
              font-weight: 600;
              cursor: pointer;
              display: flex;
              align-items: center;
              justifyContent: center;
              gap: 4px;
              transition: all 0.2s;
              outline: none;
            }
            .pill-capsule-button:hover, .pill-capsule-button.active {
              background: rgba(168, 85, 247, 0.15);
              border-color: rgba(168, 85, 247, 0.45);
              color: #fff;
            }
            .popover-floating-card {
              position: absolute;
              bottom: calc(100% + 8px);
              left: 50%;
              transform: translateX(-50%);
              width: 300px;
              background: rgba(11, 15, 26, 0.98);
              backdrop-filter: blur(24px);
              border: 1px solid rgba(255, 255, 255, 0.1);
              border-radius: 12px;
              box-shadow: 0 15px 35px rgba(0,0,0,0.5), 0 0 20px rgba(168, 85, 247, 0.15);
              padding: 12px;
              display: flex;
              flex-direction: column;
              gap: 10px;
              z-index: 2005;
              animation: popoverFadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
            }
            @keyframes popoverFadeIn {
              from { transform: translate(-50%, 8px); opacity: 0; }
              to { transform: translate(-50%, 0); opacity: 1; }
            }
            .popover-floating-card::after {
              content: '';
              position: absolute;
              top: 100%;
              left: 50%;
              transform: translateX(-50%);
              border-width: 6px;
              border-style: solid;
              border-color: rgba(11, 15, 26, 0.98) transparent transparent transparent;
            }
            .hover-vendor-item {
              display: flex;
              justify-content: space-between;
              align-items: center;
              padding: 6px 8px;
              border-radius: 6px;
              cursor: pointer;
              font-size: 11px;
              color: rgba(255,255,255,0.7);
              transition: all 0.2s;
              position: relative;
            }
            .hover-vendor-item:hover, .hover-vendor-item.active {
              background: rgba(168, 85, 247, 0.15);
              color: #fff;
            }
            .sub-model-list-hover {
              position: absolute;
              left: calc(100% + 4px);
              top: 0;
              width: 170px;
              background: rgba(11, 15, 26, 0.98);
              border: 1px solid rgba(255, 255, 255, 0.1);
              border-radius: 8px;
              padding: 6px;
              display: none;
              flex-direction: column;
              gap: 4px;
              box-shadow: 0 10px 25px rgba(0,0,0,0.4);
              z-index: 2010;
            }
            .hover-vendor-item:hover .sub-model-list-hover {
              display: flex;
            }
          `}</style>

          {/* Row 1: 极简极窄生图控制行 (输入框 + 开始优化按钮) */}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', position: 'relative' }}>
            {/* 隐藏的本地上传文件 input */}
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileChange} 
              accept="image/*,video/*,audio/*" 
              multiple 
              style={{ display: 'none' }} 
            />

            {/* 虚线快捷添加/查看参考源按钮 */}
            <button
              onClick={() => {
                if (activeTab === 'aix') {
                  setActivePopover(activePopover === 'workflow' ? null : 'workflow');
                } else {
                  setActivePopover(activePopover === 'gallery' ? null : 'gallery');
                }
              }}
              title={
                activeTab === 'aix'
                  ? '配置云端工作流参数'
                  : allConnectedAssets.length > 0
                  ? '查看已装载的参考素材'
                  : '添加首尾帧或音视频参考素材'
              }
              style={{
                width: '30px',
                height: '30px',
                borderRadius: '8px',
                background:
                  activeTab === 'aix' || (activeTab === 'standard' && allConnectedAssets.length > 0)
                    ? 'rgba(168, 85, 247, 0.1)'
                    : 'rgba(255,255,255,0.03)',
                border:
                  activeTab === 'aix' || (activeTab === 'standard' && allConnectedAssets.length > 0)
                    ? '1.5px solid rgba(168, 85, 247, 0.7)'
                    : '1px dashed rgba(255,255,255,0.15)',
                color:
                  activeTab === 'aix' || (activeTab === 'standard' && allConnectedAssets.length > 0)
                    ? '#c084fc'
                    : 'rgba(255,255,255,0.4)',
                fontSize: '13px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                outline: 'none',
                flexShrink: 0,
                transition: 'all 0.2s'
              }}
            >
              {activeTab === 'aix' ? '🎯' : allConnectedAssets.length > 0 ? '🖼️' : '＋'}
            </button>

            {/* 极窄输入提示词文本框 */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <textarea
                ref={textareaRef}
                id={`textarea-${id}`}
                value={currentPrompt}
                disabled={isPromptConnected}
                className="nodrag custom-scrollbar"
                onMouseDown={(e) => e.stopPropagation()}
                onChange={(e) => {
                  const val = e.target.value;
                  handleInputChange('prompt', val);
                  const cursor = e.target.selectionStart;
                  const textBefore = val.substring(0, cursor);
                  const lastAt = textBefore.lastIndexOf('@');
                  if (lastAt !== -1 && lastAt >= textBefore.length - 2) {
                    setShowMentionList(true);
                  } else {
                    setShowMentionList(false);
                  }
                }}
                placeholder={
                  isPromptConnected
                    ? '🔗 已通过连线装载并接收上游动作提示词描述...'
                    : '在此编写动作提示词 Prompt (支持输入 @ 快捷绑定参考图，如 @图1)...'
                }
                style={{
                  width: '100%',
                  height: 'auto',
                  minHeight: '42px',
                  maxHeight: '140px',
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '8px',
                  outline: 'none',
                  resize: 'none',
                  color: isPromptConnected ? 'rgba(255, 255, 255, 0.45)' : '#fff',
                  fontSize: '11px',
                  lineHeight: '1.4',
                  padding: '10px 10px',
                  fontFamily: 'var(--font-sans)',
                  overflowY: 'auto',
                  transition: 'border-color 0.2s'
                }}
                onFocus={(e) => {
                  if (!isPromptConnected) e.currentTarget.style.borderColor = 'rgba(168, 85, 247, 0.4)';
                }}
                onBlur={(e) => {
                  if (!isPromptConnected) e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
                }}
              />
            </div>

            {/* 开始处理生成按钮 */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', flexShrink: 0 }}>
              <button
                onClick={handleVideoFusion}
                disabled={fusing}
                style={{
                  background: 'linear-gradient(135deg, hsl(262, 83%, 58%) 0%, hsl(316, 73%, 52%) 100%)',
                  border: 'none',
                  borderRadius: '20px',
                  color: '#fff',
                  padding: '5px 14px',
                  fontSize: '11px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(168, 85, 247, 0.3)',
                  whiteSpace: 'nowrap',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  outline: 'none',
                  flexShrink: 0
                }}
                onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 6px 16px rgba(168, 85, 247, 0.45)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.boxShadow = '0 4px 12px rgba(168, 85, 247, 0.3)'; }}
              >
                {fusing ? '正在生成...' : '开始生成'}
              </button>
              {data.inputs?.customTemplate && (
                <span style={{ fontSize: '8px', color: 'rgba(255,255,255,0.4)', fontWeight: 'bold', letterSpacing: '0.5px' }}>
                  {data.inputs.customTemplate.source === 'runninghub' ? '⚡ RH工作流' : '💻 CF工作流'}
                </span>
              )}
            </div>
          </div>

          {/* 快捷提及 Pills 栏 */}
          {connectedImages.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.01)', padding: '2px 4px', borderRadius: '4px', fontSize: '9px', marginTop: '-4px' }}>
              <span style={{ color: 'rgba(255,255,255,0.45)' }}>📎 快捷绑定参考图:</span>
              {connectedImages.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    const textarea = document.getElementById(`textarea-${id}`) as HTMLTextAreaElement;
                    const cursor = textarea ? textarea.selectionStart : currentPrompt.length;
                    const textBefore = currentPrompt.substring(0, cursor);
                    const textAfter = currentPrompt.substring(cursor);
                    const nextPrompt = textBefore + `@图${idx + 1} ` + textAfter;
                    handleInputChange('prompt', nextPrompt);
                    if (textarea) textarea.focus();
                  }}
                  style={{
                    background: 'rgba(168, 85, 247, 0.15)',
                    border: '1px solid rgba(168, 85, 247, 0.3)',
                    borderRadius: '4px',
                    color: '#e9d5ff',
                    padding: '1px 5px',
                    fontSize: '9px',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    transition: 'all 0.15s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(168, 85, 247, 0.3)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(168, 85, 247, 0.15)'}
                >
                  🖼️ 图 {idx + 1}
                </button>
              ))}
            </div>
          )}

          <hr style={{ border: 'none', borderTop: '1px solid rgba(255, 255, 255, 0.05)', margin: '2px 0' }} />

          {/* Row 2: 极简胶囊 Pill 按钮组 */}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {/* 1. 模型选择/自定义参数 */}
            {data.inputs?.customTemplate ? (
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button 
                  className={`pill-capsule-button ${activePopover === 'workflow' ? 'active' : ''}`}
                  onClick={() => setActivePopover(activePopover === 'workflow' ? null : 'workflow')}
                >
                  ⚙️ 自定义参数设置 ▼
                </button>
                {currentTemplate?.source === 'runninghub' && currentTemplate?.webLink && (
                  <button 
                    className="pill-capsule-button"
                    onClick={() => window.open(currentTemplate.webLink, '_blank')}
                    style={{
                      background: 'rgba(16, 185, 129, 0.1)',
                      borderColor: 'rgba(16, 185, 129, 0.3)',
                      color: '#34d399'
                    }}
                  >
                    🌐 工作流链接
                  </button>
                )}
              </div>
            ) : (
              <button 
                className={`pill-capsule-button ${activePopover === 'model' ? 'active' : ''}`}
                onClick={() => setActivePopover(activePopover === 'model' ? null : 'model')}
              >
                🌐 模型: {model} ▼
              </button>
            )}

            {/* 2. 规格尺寸参数胶囊 */}
            <button 
              className={`pill-capsule-button ${activePopover === 'specs' ? 'active' : ''}`}
              onClick={() => setActivePopover(activePopover === 'specs' ? null : 'specs')}
            >
              📐 规格尺寸 ▼
            </button>

            {/* 3. ComfyUI 工作流 - 点击直接打开大模态框工作流中心选择，去除繁琐二级菜单，实现无感直连 */}
            {!data.inputs?.customTemplate && (
              <button 
                className="pill-capsule-button"
                onClick={handleOpenWorkflowsModal}
              >
                ⚡ {data.inputs?.runningHubWorkflowName ? `ComfyUI: ${data.inputs.runningHubWorkflowName}` : 'comfyui工作流'} ▼
              </button>
            )}



            <div style={{ flex: 1 }} />
            
            <span style={{ fontSize: '9px', color: 'rgba(255, 255, 255, 0.35)', whiteSpace: 'nowrap' }}>
              输出: video (outputs.video)
            </span>
          </div>

          {/* ---------------- Popovers 浮窗 ---------------- */}

          {/* Popover 1: 模型选择 (级联) */}
          {activePopover === 'model' && (
            <div className="popover-floating-card" style={{ width: '220px', left: '15%' }}>
              {activeTab === 'aix' ? (
                <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', textAlign: 'center', padding: '6px' }}>
                  💡 云端工作流已由模版配置托管，无需在节点端设置物理视频大模型。
                </div>
              ) : (
                <>
                  <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.45)', fontWeight: 'bold', paddingBottom: '4px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    🤖 视频生成大模型服务商
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '4px' }}>
                    {[
                      { id: 'volcengine', label: '火山引擎 (Seedance)' },
                      { id: 'vidu', label: 'Vidu 视频' },
                      { id: 'minimax', label: '海螺视频' },
                      { id: 'ali', label: '通义万相' }
                    ].map(v => (
                      <div 
                        key={v.id}
                        className={`hover-vendor-item ${activeVendor === v.id ? 'active' : ''}`}
                        onClick={() => {
                          setActiveVendor(v.id as any);
                          handleInputChange('providerId', v.id);
                          const providerModels = DEFAULT_PROVIDER_VIDEO_MODELS[v.id] || [];
                          handleInputChange('model', providerModels[0]);
                        }}
                      >
                        <span>{v.label.replace(' (Seedance)', '')}</span>
                        <span style={{ fontSize: '8px', opacity: 0.5 }}>▶</span>

                        {/* 二级级联模型列表 */}
                        <div className="sub-model-list-hover">
                          <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.45)', padding: '2px 4px', borderBottom: '1px solid rgba(255,255,255,0.06)', marginBottom: '4px' }}>
                            选择具体视频模型：
                          </div>
                          {(DEFAULT_PROVIDER_VIDEO_MODELS[v.id] || []).map(m => (
                            <button
                              key={m}
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveVendor(v.id as any);
                                handleInputChange('providerId', v.id);
                                handleInputChange('model', m);
                                setActivePopover(null);
                              }}
                              style={{
                                background: model === m ? 'rgba(168, 85, 247, 0.25)' : 'transparent',
                                border: 'none',
                                borderRadius: '4px',
                                color: model === m ? '#fff' : 'rgba(255,255,255,0.7)',
                                fontSize: '9.5px',
                                padding: '4px 6px',
                                textAlign: 'left',
                                cursor: 'pointer',
                                width: '100%'
                              }}
                            >
                              {m}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Popover 2: 工作模式 */}
          {activePopover === 'mode' && (
            <div className="popover-floating-card" style={{ width: '200px', left: '25%' }}>
              <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.45)', fontWeight: 'bold', paddingBottom: '4px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                ⚙️ 切换视频创作模式
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px' }}>
                {[
                  { id: 'all', label: '🔮 全能参考参考源' },
                  { id: 'edit', label: '✂️ 视频编辑 (图/声/视)' },
                  { id: 'ref', label: '🎬 视频画面角色参考' },
                  { id: 'extend', label: '🔄 视频首尾帧续写' },
                  { id: 'aix', label: '⚡ ComfyUI 云端工作流' }
                ].map(m => {
                  const isSel = m.id === 'aix' ? activeTab === 'aix' : activeTab === 'standard' && videoModeTab === m.id;
                  return (
                    <button
                      key={m.id}
                      onClick={() => {
                        if (m.id === 'aix') {
                          handleTabChange('aix');
                        } else {
                          handleTabChange('standard');
                          setVideoModeTab(m.id as any);
                          handleInputChange('videoModeTab', m.id);
                        }
                        setActivePopover(null);
                      }}
                      style={{
                        background: isSel ? 'rgba(168, 85, 247, 0.25)' : 'rgba(255, 255, 255, 0.02)',
                        border: 'none',
                        borderRadius: '6px',
                        color: isSel ? '#fff' : 'rgba(255,255,255,0.7)',
                        fontSize: '10px',
                        padding: '6px 8px',
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'all 0.15s'
                      }}
                    >
                      {m.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Popover 3: 规格尺寸与生成参数 */}
          {activePopover === 'specs' && (
            <div className="popover-floating-card" style={{ width: '310px', left: '40%' }}>
              <div style={{ fontSize: '10.5px', fontWeight: 'bold', color: 'rgba(255,255,255,0.5)', paddingBottom: '4px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                📐 规格尺寸与生成参数
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
                {/* 1. 分辨率组 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '9.5px', color: 'rgba(255,255,255,0.4)', width: '60px', flexShrink: 0 }}>画面分辨率:</span>
                  <div style={{ display: 'flex', background: 'rgba(0,0,0,0.3)', padding: '2px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.06)', flex: 1, justifyContent: 'space-between' }}>
                    {['480p', '720p', '1080p', '2K', '4K'].map(c => {
                      const isSel = (data.inputs?.clarity || '720p') === c;
                      return (
                        <button
                          key={c}
                          onClick={() => {
                            const curRatio = data.inputs?.aspectRatio || '16:9';
                            updateSizeFromSpecs(curRatio, c);
                          }}
                          style={{
                            padding: '3px 8px',
                            border: 'none',
                            borderRadius: '4px',
                            background: isSel ? 'rgba(168, 85, 247, 0.25)' : 'transparent',
                            color: isSel ? '#fff' : 'rgba(255,255,255,0.4)',
                            fontSize: '9px',
                            fontWeight: 'bold',
                            cursor: 'pointer'
                          }}
                        >
                          {c}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 2. 画面比例组 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '9.5px', color: 'rgba(255,255,255,0.4)', width: '60px', flexShrink: 0 }}>画面比例:</span>
                  <div style={{ display: 'flex', background: 'rgba(0,0,0,0.3)', padding: '2px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.06)', flexWrap: 'wrap', gap: '2px', flex: 1 }}>
                    {['自适应', '16:9', '9:16', '4:3', '1:1', '3:4', '21:9'].map(r => {
                      const isSel = (data.inputs?.aspectRatio || '16:9') === r;
                      return (
                        <button
                          key={r}
                          onClick={() => {
                            const curClarity = data.inputs?.clarity || '720p';
                            updateSizeFromSpecs(r, curClarity);
                          }}
                          style={{
                            padding: '3px 6px',
                            border: 'none',
                            borderRadius: '4px',
                            background: isSel ? 'rgba(168, 85, 247, 0.25)' : 'transparent',
                            color: isSel ? '#fff' : 'rgba(255,255,255,0.4)',
                            fontSize: '9px',
                            fontWeight: 'bold',
                            cursor: 'pointer'
                          }}
                        >
                          {r}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 3. 是否生成音频 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '9.5px', color: 'rgba(255,255,255,0.4)', width: '60px', flexShrink: 0 }}>生成音频:</span>
                  <div style={{ display: 'flex', background: 'rgba(0,0,0,0.3)', padding: '2px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.06)' }}>
                    {['是', '否'].map(opt => {
                      const isSel = (data.inputs?.generateAudio || '否') === opt;
                      return (
                        <button
                          key={opt}
                          onClick={() => handleInputChange('generateAudio', opt)}
                          style={{
                            padding: '3px 12px',
                            border: 'none',
                            borderRadius: '4px',
                            background: isSel ? 'rgba(168, 85, 247, 0.25)' : 'transparent',
                            color: isSel ? '#fff' : 'rgba(255,255,255,0.4)',
                            fontSize: '9px',
                            fontWeight: 'bold',
                            cursor: 'pointer'
                          }}
                        >
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 4. 时长选择及滑块 */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '9.5px', color: 'rgba(255,255,255,0.4)', width: '60px', flexShrink: 0 }}>生成时长:</span>
                    <div style={{ display: 'flex', background: 'rgba(0,0,0,0.3)', padding: '2px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.06)', flex: 1, justifyContent: 'space-between' }}>
                      {[4, 8, 12, 15].map(d => {
                        const isSel = (data.inputs?.durationMode || 'preset') === 'preset' && (data.inputs?.duration || 4) === d;
                        return (
                          <button
                            key={d}
                            onClick={() => {
                              handleInputChange('durationMode', 'preset');
                              handleInputChange('duration', d);
                            }}
                            style={{
                              padding: '3px 8px',
                              border: 'none',
                              borderRadius: '4px',
                              background: isSel ? 'rgba(168, 85, 247, 0.25)' : 'transparent',
                              color: isSel ? '#fff' : 'rgba(255,255,255,0.4)',
                              fontSize: '9px',
                              fontWeight: 'bold',
                              cursor: 'pointer'
                            }}
                          >
                            {d}s
                          </button>
                        );
                      })}
                      <button
                        onClick={() => {
                          handleInputChange('durationMode', 'custom');
                          const curD = data.inputs?.duration || 4;
                          if (curD < 4 || curD > 60) {
                            handleInputChange('duration', 20);
                          }
                        }}
                        style={{
                          padding: '3px 8px',
                          border: 'none',
                          borderRadius: '4px',
                          background: (data.inputs?.durationMode === 'custom') ? 'rgba(168, 85, 247, 0.25)' : 'transparent',
                          color: (data.inputs?.durationMode === 'custom') ? '#fff' : 'rgba(255,255,255,0.4)',
                          fontSize: '9px',
                          fontWeight: 'bold',
                          cursor: 'pointer'
                        }}
                      >
                        自定义
                      </button>
                    </div>
                  </div>

                  {data.inputs?.durationMode === 'custom' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(0,0,0,0.2)', padding: '6px 10px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.03)', marginTop: '2px' }}>
                      <span style={{ fontSize: '8.5px', color: 'rgba(255,255,255,0.45)', flexShrink: 0 }}>微调时长:</span>
                      <input 
                        type="range"
                        className="nodrag"
                        onMouseDown={(e) => e.stopPropagation()}
                        min="4"
                        max="60"
                        value={data.inputs?.duration || 20}
                        onChange={(e) => handleInputChange('duration', parseInt(e.target.value))}
                        style={{ flex: 1, accentColor: '#a855f7', height: '3px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', cursor: 'pointer' }}
                      />
                      <div style={{ display: 'flex', alignItems: 'center', gap: '2px', flexShrink: 0 }}>
                        <input 
                          type="number"
                          className="nodrag"
                          onMouseDown={(e) => e.stopPropagation()}
                          min="4"
                          max="60"
                          value={data.inputs?.duration || 20}
                          onChange={(e) => {
                            let val = parseInt(e.target.value) || 4;
                            if (val < 4) val = 4;
                            if (val > 60) val = 60;
                            handleInputChange('duration', val);
                          }}
                          style={{ width: '32px', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '1px 3px', color: '#fff', fontSize: '9.5px', textAlign: 'center', outline: 'none' }}
                        />
                        <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.5)', fontWeight: 'bold' }}>秒</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Popover 4: standard 模式下的参考素材画廊 */}
          {activePopover === 'gallery' && activeTab === 'standard' && (
            <div className="popover-floating-card" style={{ width: '310px', left: '50%' }}>
              <div style={{ fontSize: '10.5px', color: 'rgba(255,255,255,0.5)', fontWeight: 'bold', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '4px' }}>
                <span>🖼️ 参考素材画廊 ({allConnectedAssets.length}/6)</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', maxHeight: '160px', overflowY: 'auto', marginTop: '6px' }}>
                {allConnectedAssets.map((asset, idx) => (
                  <div 
                    key={idx} 
                    style={{ 
                      position: 'relative', 
                      width: '100%', 
                      height: '75px', 
                      borderRadius: '6px', 
                      overflow: 'hidden', 
                      border: '1.5px solid rgba(255,255,255,0.05)',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
                    }}
                  >
                    <ResolvedMedia url={asset.url} type={asset.type} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveRefAsset(asset.nodeId);
                      }}
                      style={{
                        position: 'absolute', top: '2px', right: '2px', width: '14px', height: '14px', borderRadius: '50%',
                        background: 'rgba(239, 68, 68, 0.85)', border: 'none', color: '#fff', display: 'flex',
                        alignItems: 'center', justifyContent: 'center', fontSize: '9px', cursor: 'pointer', outline: 'none', fontWeight: 'bold'
                      }}
                    >
                      ×
                    </button>
                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.6)', color: 'rgba(255,255,255,0.7)', fontSize: '8px', textAlign: 'center', padding: '1px 0' }}>
                      {asset.type === 'image' ? '图' : asset.type === 'video' ? '视频' : '音频'}{idx + 1}
                    </div>
                  </div>
                ))}

                {allConnectedAssets.length < 6 && (
                  <div
                    onClick={() => handleOpenAssetsModal('image')}
                    style={{
                      width: '100%', height: '75px', borderRadius: '6px', border: '1.5px dashed rgba(255, 255, 255, 0.15)',
                      background: 'rgba(255,255,255,0.01)', display: 'flex', flexDirection: 'column', alignItems: 'center',
                      justifyContent: 'center', gap: '4px', cursor: 'pointer', transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'rgba(168, 85, 247, 0.6)';
                      e.currentTarget.style.background = 'rgba(168, 85, 247, 0.05)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)';
                      e.currentTarget.style.background = 'rgba(255,255,255,0.01)';
                    }}
                  >
                    <span style={{ fontSize: '14px', color: 'rgba(255,255,255,0.4)' }}>📂</span>
                    <span style={{ fontSize: '8.5px', color: 'rgba(255,255,255,0.3)' }}>资产库选入</span>
                  </div>
                )}

                {allConnectedAssets.length < 6 && (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      width: '100%', height: '75px', borderRadius: '6px', border: '1.5px dashed rgba(255, 255, 255, 0.15)',
                      background: 'rgba(255,255,255,0.01)', display: 'flex', flexDirection: 'column', alignItems: 'center',
                      justifyContent: 'center', gap: '4px', cursor: 'pointer', transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'rgba(168, 85, 247, 0.6)';
                      e.currentTarget.style.background = 'rgba(168, 85, 247, 0.05)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)';
                      e.currentTarget.style.background = 'rgba(255,255,255,0.01)';
                    }}
                  >
                    <span style={{ fontSize: '14px', color: 'rgba(255,255,255,0.4)' }}>📤</span>
                    <span style={{ fontSize: '8.5px', color: 'rgba(255,255,255,0.3)' }}>本地上传</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Popover 4: aix 模式下的云端工作流配置 */}
          {activePopover === 'workflow' && (
            <div className="popover-floating-card" style={{ width: '280px', left: '15%', maxHeight: '280px', overflowY: 'auto' }}>
              {data.inputs?.customTemplate ? (
                <>
                  <div style={{ fontSize: '10.5px', color: 'rgba(255,255,255,0.5)', fontWeight: 'bold', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '4px' }}>
                    ⚙️ 自定义参数设置
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
                    {(() => {
                      const filteredParams = unifiedParams.filter((p: any) => {
                        if (!p.exposed) return false;
                        const fieldLower = (p.fieldName || '').toLowerCase();
                        const displayLower = (p.description || '').toLowerCase();

                        const isText = fieldLower === 'text' || fieldLower === 'prompt' || fieldLower === 'instruction' || fieldLower === 'description' || displayLower.includes('提示词') || displayLower.includes('文本') || displayLower.includes('指令');
                        const isImage = p.type === 'image' || fieldLower === 'image' || fieldLower === 'faceref' || fieldLower === 'img' || fieldLower === 'refimage' || fieldLower === 'ref_image' || displayLower.includes('图片') || displayLower.includes('图像');
                        const isVideo = p.type === 'video' || fieldLower === 'video' || fieldLower === 'refvideo' || fieldLower === 'ref_video' || displayLower.includes('视频');
                        const isAudio = p.type === 'audio' || fieldLower === 'audio' || fieldLower === 'refaudio' || fieldLower === 'ref_audio' || displayLower.includes('音频') || displayLower.includes('声音') || displayLower.includes('配音');
                        const isSpecs = fieldLower === 'cfg' || fieldLower === 'steps' || fieldLower === 'denoise' || fieldLower === 'width' || fieldLower === 'height' || fieldLower === 'w' || fieldLower === 'h' || fieldLower === 'clarity' || fieldLower === 'duration';

                        return !isText && !isImage && !isVideo && !isAudio && !isSpecs;
                      });

                      if (filteredParams.length === 0) {
                        return (
                          <div style={{ fontSize: '9.5px', color: 'rgba(255,255,255,0.4)', textAlign: 'center', padding: '10px 0' }}>
                            本工作流无额外特有参数，已在主菜单完美对齐
                          </div>
                        );
                      }

                      return filteredParams.map((p: any) => {
                        const inputKey = p.portId;
                        const val = data.inputs?.[inputKey] !== undefined ? data.inputs[inputKey] : p.fieldValue;
                        return (
                          <div key={inputKey} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontSize: '9.5px', color: 'rgba(255,255,255,0.7)' }}>{p.description || p.fieldName}</span>
                              <span style={{ fontSize: '8.5px', color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace' }}>{val}</span>
                            </div>
                            <input
                              type="text"
                              className="nodrag"
                              onMouseDown={(e) => e.stopPropagation()}
                              value={val || ''}
                              onChange={(e) => handleInputChange(inputKey, e.target.value)}
                              placeholder="配置特有参数..."
                              style={{
                                width: '100%',
                                background: 'rgba(0,0,0,0.25)',
                                border: '1px solid rgba(255,255,255,0.08)',
                                borderRadius: '4px',
                                padding: '4px 8px',
                                color: '#fff',
                                fontSize: '9.5px',
                                outline: 'none',
                                fontFamily: 'monospace'
                              }}
                            />
                          </div>
                        );
                      });
                    })()}
                  </div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.45)', fontWeight: 'bold', paddingBottom: '4px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    🎯 云端工作流模板与参数配制
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
                    <button
                      onClick={() => {
                        window.dispatchEvent(
                          new CustomEvent('open-large-modal', {
                            detail: { tab: 'templates', nodeTarget: id, type: 'video' }
                          })
                        );
                        setActivePopover(null);
                      }}
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        background: 'rgba(168, 85, 247, 0.1)',
                        border: '1px dashed rgba(168, 85, 247, 0.4)',
                        borderRadius: '6px',
                        color: '#e9d5ff',
                        fontSize: '10.5px',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        textAlign: 'center'
                      }}
                    >
                      🎯 选择云端工作流模版
                    </button>

                    {data.inputs?.runningHubWorkflowName && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', background: 'rgba(255,255,255,0.02)', padding: '6px 8px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.04)' }}>
                        <span style={{ fontSize: '10px', color: '#c084fc', fontWeight: 'bold' }}>
                          模版: {data.inputs.runningHubWorkflowName}
                        </span>
                        {currentTemplate && (
                          <span style={{ fontSize: '8.5px', color: 'rgba(255,255,255,0.4)', lineHeight: '1.3' }}>
                            💡 说明: {currentTemplate.description}
                          </span>
                        )}
                      </div>
                    )}

                    {/* 动态渲染动态表单字段 */}
                    {currentTemplate && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '6px' }}>
                        {currentTemplate.nodeInfoList.map((info: any) => {
                          const lowerName = info.fieldName.toLowerCase();
                          const isText = lowerName === 'text' || lowerName === 'prompt';
                          const isImg = lowerName === 'image' || lowerName === 'faceref' || lowerName === 'img' || lowerName === 'refimage';
                          const isAudio = lowerName === 'audio' || lowerName === 'refaudio';
                          const isVideo = lowerName === 'video' || lowerName === 'refvideo';
                          const inputKey = `${info.nodeId}_${info.fieldName}`;
                          const currentVal = data.inputs?.[inputKey] !== undefined ? data.inputs[inputKey] : info.fieldValue;

                          return (
                            <div key={inputKey} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.55)' }}>
                                  {info.description || info.fieldName} (节点: {info.nodeId})
                                </span>
                                {isText && isPromptConnected && <span style={{ color: '#a855f7', fontSize: '8px' }}>🔗 连线驱动</span>}
                                {isImg && isRefImageConnected && <span style={{ color: '#a855f7', fontSize: '8px' }}>🔗 连线驱动</span>}
                                {isAudio && isRefAudioConnected && <span style={{ color: '#a855f7', fontSize: '8px' }}>🔗 连线驱动</span>}
                                {isVideo && isRefVideoConnected && <span style={{ color: '#a855f7', fontSize: '8px' }}>🔗 连线驱动</span>}
                              </div>

                              {isText ? (
                                <textarea
                                  disabled={isPromptConnected}
                                  value={isPromptConnected ? connectedPrompt : currentVal}
                                  className="nodrag"
                                  onMouseDown={(e) => e.stopPropagation()}
                                  onChange={(e) => handleInputChange(inputKey, e.target.value)}
                                  style={{
                                    width: '100%',
                                    height: '38px',
                                    background: 'rgba(0,0,0,0.3)',
                                    border: '1px solid rgba(255,255,255,0.08)',
                                    borderRadius: '4px',
                                    padding: '4px 6px',
                                    color: isPromptConnected ? 'rgba(255, 255, 255, 0.45)' : '#fff',
                                    fontSize: '9.5px',
                                    resize: 'none',
                                    outline: 'none',
                                    lineHeight: '1.3'
                                  }}
                                />
                              ) : isImg ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(0,0,0,0.15)', padding: '4px', borderRadius: '4px' }}>
                                  <span style={{ fontSize: '11px' }}>🖼️</span>
                                  <span style={{ fontSize: '8.5px', color: 'rgba(255,255,255,0.4)' }}>
                                    {connectedRefImage ? '参考图画面已就绪' : '等待连线或添加参考图'}
                                  </span>
                                </div>
                              ) : isVideo ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(0,0,0,0.15)', padding: '4px', borderRadius: '4px' }}>
                                  <span style={{ fontSize: '11px' }}>🎬</span>
                                  <span style={{ fontSize: '8.5px', color: 'rgba(255,255,255,0.4)' }}>
                                    {connectedRefVideo ? '参考视频已就绪' : '等待连线或添加视频'}
                                  </span>
                                </div>
                              ) : isAudio ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(0,0,0,0.15)', padding: '4px', borderRadius: '4px' }}>
                                  <span style={{ fontSize: '11px' }}>🎙️</span>
                                  <span style={{ fontSize: '8.5px', color: 'rgba(255,255,255,0.4)' }}>
                                    {connectedRefAudio ? '参考音频已就绪' : '等待连线或添加声音'}
                                  </span>
                                </div>
                              ) : (
                                <input
                                  type="text"
                                  value={currentVal}
                                  className="nodrag"
                                  onMouseDown={(e) => e.stopPropagation()}
                                  onChange={(e) => handleInputChange(inputKey, e.target.value)}
                                  style={{
                                    width: '100%',
                                    background: 'rgba(0,0,0,0.3)',
                                    border: '1px solid rgba(255,255,255,0.08)',
                                    borderRadius: '4px',
                                    padding: '4px 6px',
                                    color: '#fff',
                                    fontSize: '9.5px',
                                    outline: 'none'
                                  }}
                                />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}



        </div>
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
            <video 
              src={showVid}
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
            <div style={{ color: '#fff', fontSize: '13px', marginTop: '16px', fontWeight: 600, textShadow: '0 2px 4px #000', display: 'flex', gap: '20px', alignItems: 'center' }}>
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
          /* 当 Hover 节点容器时，浮现两侧导流翅膀 */
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
