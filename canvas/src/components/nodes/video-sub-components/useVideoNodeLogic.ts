import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { RunningHubService } from '../../../services/runninghub.service';
import { useModelSelector } from '../../../hooks/useModelSelector';
import { useWorkflowSelector } from '../../../hooks/useWorkflowSelector';
import { mapParams } from '../../../hooks/useParamMapper';

interface UseVideoNodeLogicProps {
  id: string;
  data: any;
  setNodes: any;
  setEdges: any;
  edges: any[];
  nodes: any[];
}

export function useVideoNodeLogic({
  id,
  data,
  setNodes,
  setEdges,
  edges,
  nodes
}: UseVideoNodeLogicProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);

  // 性能特优：仅仅当节点图片或文本实质变化时才触发 Key 更新，彻底避开位置拖动时的 position 每一帧刷新
  const nodesDataKey = useMemo(() => {
    return nodes.map(n => {
      const outputVal = n.data?.outputs?.video || n.data?.outputs?.image || n.data?.outputs?.output || '';
      const inputVal = n.data?.inputs?.fileUrl || '';
      const labelVal = n.data?.label || n.data?.title || '';
      return `${n.id}_${outputVal}_${inputVal}_${labelVal}`;
    }).join('|');
  }, [nodes]);

  // 扫描所有指向当前输入端口的上游多媒体连接
  const allConnectedAssets = useMemo(() => {
    nodesRef.current = nodes;
    edgesRef.current = edges;

    const currentEdges = edgesRef.current;
    const currentNodes = nodesRef.current;

    const list: { type: 'image' | 'video' | 'audio', url: string, name: string, nodeId: string }[] = [];
    const connectedEdges = currentEdges.filter(e => e.target === id && e.targetHandle === 'input');
    
    connectedEdges.forEach((edge, idx) => {
      const srcNode = currentNodes.find(n => n.id === edge.source);
      if (!srcNode) return;
      const outputs = (srcNode.data?.outputs || {}) as any;
      const inputs = (srcNode.data?.inputs || {}) as any;
      const val = outputs.output || outputs.video || outputs.image || outputs.audio || outputs.prompt || outputs.text || outputs.storyboard || inputs.fileUrl || inputs.text || '';
      if (!val || typeof val !== 'string') return;

      const lowerVal = val.toLowerCase();
      let type: 'image' | 'video' | 'audio' = 'image';
      const uploadFileType = inputs?.fileType || outputs?.fileType;

      if (uploadFileType === 'audio' || srcNode.type === 'tts-service' || lowerVal.includes('audio') || val.endsWith('.mp3') || val.endsWith('.wav') || val.endsWith('.ogg') || val.endsWith('.m4a') || val.startsWith('data:audio/')) {
        type = 'audio';
      } else if (uploadFileType === 'video' || srcNode.type === 'video-fusion' || (srcNode.type === 'upload-node' && (lowerVal.includes('video') || val.endsWith('.mp4') || val.endsWith('.webm') || val.endsWith('.mov') || val.startsWith('data:video/')))) {
        type = 'video';
      }
      
      list.push({
        type,
        url: val,
        name: (srcNode.data?.label as string) || `${type === 'image' ? '参考图' : type === 'video' ? '参考视频' : '参考音频'}-${idx + 1}`,
        nodeId: srcNode.id
      });
    });

    // 物理去重，防止 `@` 列表展示重复资产
    const uniqueList: typeof list = [];
    const seenIds = new Set<string>();
    list.forEach(item => {
      if (!seenIds.has(item.nodeId)) {
        seenIds.add(item.nodeId);
        uniqueList.push(item);
      }
    });

    return uniqueList;
  }, [edges, nodesDataKey, id]);

  // 智能提取提示词 (Prompt) 文本连线数据
  const connectedPrompt = useMemo(() => {
    nodesRef.current = nodes;
    edgesRef.current = edges;

    const currentEdges = edgesRef.current;
    const currentNodes = nodesRef.current;

    const connectedEdges = currentEdges.filter(e => e.target === id && e.targetHandle === 'input');
    const prompts: string[] = [];

    connectedEdges.forEach(edge => {
      const srcNode = currentNodes.find(n => n.id === edge.source);
      if (!srcNode) return;
      const outputs = (srcNode.data?.outputs || {}) as any;
      const inputs = (srcNode.data?.inputs || {}) as any;
      
      const val = outputs.output || outputs.text || outputs.prompt || inputs.text || '';
      if (!val || typeof val !== 'string') return;

      const isResourceUrl =
        val.startsWith('data:') || val.startsWith('db://') || val.startsWith('http') ||
        val.endsWith('.mp3') || val.endsWith('.wav') || val.endsWith('.mp4') || val.endsWith('.png') || val.endsWith('.jpg');

      if (!isResourceUrl) {
        prompts.push(val);
      }
    });

    return prompts.join('\n');
  }, [edges, nodesDataKey, id]);

  const isPromptConnected = connectedPrompt.length > 0;

  // 上游独立连接提取，向下兼容 standard 模式
  const connectedRefImage = useMemo(() => {
    const item = allConnectedAssets.find(a => a.type === 'image');
    return item ? item.url : '';
  }, [allConnectedAssets]);

  const connectedRefVideo = useMemo(() => {
    const item = allConnectedAssets.find(a => a.type === 'video');
    return item ? item.url : '';
  }, [allConnectedAssets]);

  const connectedRefAudio = useMemo(() => {
    const item = allConnectedAssets.find(a => a.type === 'audio');
    return item ? item.url : '';
  }, [allConnectedAssets]);

  const connectedImages = useMemo(() => {
    return allConnectedAssets.filter(a => a.type === 'image').map(a => a.url);
  }, [allConnectedAssets]);

  const isRefImageConnected = connectedRefImage.length > 0;
  const isRefVideoConnected = connectedRefVideo.length > 0;
  const isRefAudioConnected = connectedRefAudio.length > 0;

  // 基础参数
  const providerId = data.inputs?.providerId || 'vidu';
  const activeTab = data.inputs?.activeTab || 'standard';
  const videoModeTab = data.inputs?.videoModeTab || 'all';
  const runningHubTemplateId = data.inputs?.runningHubTemplateId || 'rh_wf_video_fusion';

  // 状态管理
  const [fusing, setFusing] = useState(false);
  const [fusedVideo, setFusedVideo] = useState(data.outputs?.video || '');
  const [settings, setSettings] = useState<any>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [localName, setLocalName] = useState(data.label || '视频生成');
  const [showMentionList, setShowMentionList] = useState(false);
  const [mentionSearch, setMentionSearch] = useState('');
  const [cursorPos, setCursorPos] = useState(0);

  // Popover 浮层状态管理
  const [activePopover, setActivePopover] = useState<'model' | 'mode' | 'specs' | 'gallery' | 'workflow' | 'count' | null>(null);
  const [activeVendor, setActiveVendor] = useState<'volcengine' | 'vidu' | 'minimax' | 'ali'>('vidu');

  useEffect(() => {
    if (data.label) {
      setLocalName(data.label);
    }
  }, [data.label]);

  useEffect(() => {
    if (data.outputs?.video) {
      setFusedVideo(data.outputs.video);
    }
  }, [data.outputs?.video]);

  // 获取 RunningHub 与本地 ComfyUI 模板工作流列表（统一钩子）
  const wfSelector = useWorkflowSelector({
    capability: 'video',
    currentWorkflowId: data.inputs?.runningHubTemplateId,
    onChange: (wf) => {
      if (wf) handleInputChange('runningHubTemplateId', wf.id);
    },
  });

  const currentTemplate = useMemo(() => {
    if (data.inputs?.customTemplate) return data.inputs.customTemplate;
    return wfSelector.currentWorkflow;
  }, [wfSelector.currentWorkflow, data.inputs?.customTemplate]);

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
        const res = await fetch('/api/v1/settings');
        if (res.ok) {
          const settingsData = await res.json();
          setSettings(settingsData);
        }
      } catch (e) {
        console.error('加载 VideoFusionNode 外部依赖失败:', e);
      }
    };
    loadSettings();
    window.addEventListener('canvas-settings-updated', loadSettings);
    return () => window.removeEventListener('canvas-settings-updated', loadSettings);
  }, []);

  // 使用统一的模型选择钩子
  const { providers: activeProviders, models: currentProviderModels, currentModel: validModel, setProviderId: handleProviderChange, setModel: handleModelChange } = useModelSelector({
    capability: 'video',
    settings,
    currentProviderId: providerId,
    currentModel: data.inputs?.model || '',
    onProviderChange: (newProviderId) => {
      setNodes((nodes: any[]) => nodes.map((n) => {
        if (n.id === id) {
          return { ...n, data: { ...n.data, inputs: { ...n.data.inputs, providerId: newProviderId } } };
        }
        return n;
      }));
    },
    onModelChange: (newModel) => {
      setNodes((nodes: any[]) => nodes.map((n) => {
        if (n.id === id) {
          return { ...n, data: { ...n.data, inputs: { ...n.data.inputs, model: newModel } } };
        }
        return n;
      }));
    }
  });

  const model = validModel || currentProviderModels[0] || 'vidu-high-speed';

  // 当服务商或可选模型列表变化时，自动校验并重置当前选中的模型
  useEffect(() => {
    if (currentProviderModels.length > 0 && model && !currentProviderModels.includes(model)) {
      handleModelChange(currentProviderModels[0]);
    }
  }, [providerId, currentProviderModels, model]);

  const updateNodeData = (updates: any) => {
    setNodes((nodes: any[]) =>
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

  const handleSaveName = () => {
    setIsEditingName(false);
    if (localName.trim()) {
      setNodes((nds: any[]) =>
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

  const handleRemoveRefAsset = (nodeId: string) => {
    setEdges((eds: any[]) => eds.filter(e => !(e.target === id && e.source === nodeId)));
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

  const handleOpenAssetsModal = (type: 'image' | 'video' | 'audio' = 'image') => {
    window.dispatchEvent(
      new CustomEvent('open-large-modal', {
        detail: { tab: 'assets', nodeTarget: id, type }
      })
    );
  };

  // 监听资产库选入回调，自动防重叠派生 upload-node，确保 100% 自动连线
  useEffect(() => {
    const handleAssetsSelect = (e: any) => {
      const { nodeTarget, selectedUrl, type, name } = e.detail || {};
      if (nodeTarget === id && selectedUrl) {
        handleAddRefAssetPhysicalNode(selectedUrl, name || `素材库选入${type === 'image' ? '图片' : type === 'video' ? '视频' : '音频'}`, type === 'image' ? 'image/png' : type === 'video' ? 'video/mp4' : 'audio/mp3');
      }
    };
    window.addEventListener('assets-selected' as any, handleAssetsSelect);
    return () => {
      window.removeEventListener('assets-selected' as any, handleAssetsSelect);
    };
  }, [nodes, edges]);

  // @ 智能提及选择
  const handleSelectMention = (index: number, assetName: string, assetType: 'image' | 'video' | 'audio') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const val = data.inputs?.prompt || '';
    const cursor = textarea.selectionStart || val.length;
    const textBefore = val.substring(0, cursor);
    const textAfter = val.substring(cursor);

    const lastAt = textBefore.lastIndexOf('@');
    if (lastAt !== -1) {
      const typeLabel = assetType === 'image' ? '图' : assetType === 'video' ? '视频' : '音频';
      const mentionText = `@[${typeLabel}${index + 1}] `;
      const nextPrompt = val.substring(0, lastAt) + mentionText + textAfter;
      handleInputChange('prompt', nextPrompt);
      setShowMentionList(false);
      
      setTimeout(() => {
        textarea.focus();
        const newCursorPos = lastAt + mentionText.length;
        textarea.setSelectionRange(newCursorPos, newCursorPos);
      }, 50);
    }
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

  const handleVideoFusion = async () => {
    // 自动异步解析 db:// 引用为 Base64 真实数据
    const resolveDbUrl = async (url: string): Promise<string> => {
      if (typeof url === 'string' && url.startsWith('db://')) {
        const mediaId = url.replace('db://', '');
        const getMedia = (window as any).getMediaFromDB;
        if (typeof getMedia === 'function') {
          try {
            const base64 = await getMedia(mediaId);
            if (base64) return base64;
          } catch (err) {
            console.warn(`[useVideoNodeLogic] Failed to resolve db://:`, err);
          }
        }
      }
      return url;
    };

    const finalPrompt = isPromptConnected ? connectedPrompt : (data.inputs?.prompt || '');
    const finalImage = await resolveDbUrl(isRefImageConnected ? connectedRefImage : (data.inputs?.refImage || data.inputs?.image || ''));
    const finalVideo = await resolveDbUrl(isRefVideoConnected ? connectedRefVideo : (data.inputs?.refVideo || ''));
    const finalAudio = await resolveDbUrl(isRefAudioConnected ? connectedRefAudio : (data.inputs?.refAudio || data.inputs?.audio || ''));

    setFusing(true);
    setFusedVideo('');

    try {
      if (activeTab === 'aix') {
        if (!currentTemplate) {
          alert('请选择有效的 RunningHub 云端工作流模板！');
          setFusing(false);
          return;
        }

        const { aixInputs, dynamicMappings } = mapParams(unifiedParams, {
          inputs: data.inputs || {},
          defaultWidth: 1280,
          defaultHeight: 720,
          resolvedText: finalPrompt,
          resolvedImages: [finalImage],
          resolvedVideo: finalVideo,
          resolvedAudio: finalAudio,
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

          setNodes((nodes: any[]) =>
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

        // 导入统一执行钩子以彻底修复 executeNode 被绕过的 P0 问题
        const { executeNode } = await import('../../../hooks/executeNode');

        const result = await executeNode({
          nodeId: id,
          nodeType: 'video-fusion',
          mediaType: 'video',
          actionType: 'fusion',
          upstreamData: {
            text: finalPrompt,
            texts: [finalPrompt],
            image: finalImage,
            images: [finalImage],
            video: finalVideo,
            videos: [finalVideo],
            audio: finalAudio,
            audios: [finalAudio],
            all: []
          },
          modelConfig: {
            providerId: providerId,
            modelId: model,
          },
          nodeInputs: {
            ...data.inputs,
            prompt: finalPrompt,
            imageBase64: finalImage,
            audioBase64: finalAudio,
            refVideo: finalVideo,
            width: data.inputs?.width || 1024,
            height: data.inputs?.height || 1024,
            duration: data.inputs?.duration || 5
          }
        });

        if (result.success && result.data?.url) {
          const video = result.data.url.startsWith('http') 
            ? result.data.url 
            : `http://localhost:4000${result.data.url}`;
          
          setFusedVideo(video);

          setNodes((nodes: any[]) =>
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
          const errorReason = result.error?.message || '未生成视频链接';
          throw new Error(errorReason);
        }
      }
    } catch (e: any) {
      console.error(e);
      const errorMsg = e.message || '视频生成任务执行失败';
      setFusedVideo('');
      setNodes((nodes: any[]) =>
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

  const handleDeleteNode = () => {
    setNodes((nds: any[]) => nds.filter((n) => n.id !== id));
    setEdges((eds: any[]) => eds.filter((e) => e.source !== id && e.target !== id));
  };

  return {
    fileInputRef,
    textareaRef,
    allConnectedAssets,
    connectedPrompt,
    isPromptConnected,
    connectedImages,
    isRefImageConnected,
    isRefVideoConnected,
    isRefAudioConnected,
    providerId,
    activeProviders,
    settings,
    activeTab,
    videoModeTab,
    runningHubTemplateId: wfSelector.currentWorkflow?.id || '',
    fusing,
    fusedVideo,
    isFullscreen,
    setIsFullscreen,
    isEditingName,
    setIsEditingName,
    localName,
    setLocalName,
    showMentionList,
    setShowMentionList,
    activePopover,
    setActivePopover,
    activeVendor,
    setActiveVendor,
    currentTemplate,
    unifiedParams,
    model,
    currentProviderModels,
    handleInputChange,
    handleSaveName,
    handleRemoveRefAsset,
    handleFileChange,
    handleOpenAssetsModal,
    handleSelectMention,
    updateSizeFromSpecs,
    handleVideoFusion,
    handleDownloadVideo,
    handleSpawnSingleUpload,
    handleSpawnDoubleUpload,
    handleSpawnTripleUpload,
    handleDeleteNode
  };
}
