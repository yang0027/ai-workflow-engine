import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { RunningHubService } from '../../../services/runninghub.service';
import { useModelSelector } from '../../../hooks/useModelSelector';
import { useWorkflowSelector } from '../../../hooks/useWorkflowSelector';
import { mapParams } from '../../../hooks/useParamMapper';
import { getUpstreamData } from '../../../hooks/getUpstreamData';

interface UseImageNodeLogicProps {
  id: string;
  data: any;
  setNodes: any;
  setEdges: any;
  edges: any[];
  nodes: any[];
}

export function useImageNodeLogic({
  id,
  data,
  setNodes,
  setEdges,
  edges,
  nodes
}: UseImageNodeLogicProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 性能特优：仅仅当节点图片或文本实质变化时才触发 Key 更新，彻底避开位置拖动时的 position 每一帧刷新
  const nodesDataKey = useMemo(() => {
    return nodes.map(n => {
      const outputVal = n.data?.outputs?.image || n.data?.outputs?.output || '';
      const inputVal = n.data?.inputs?.fileUrl || '';
      const labelVal = n.data?.label || n.data?.title || '';
      return `${n.id}_${outputVal}_${inputVal}_${labelVal}`;
    }).join('|');
  }, [nodes]);

  // 1. 统一读取上游数据：文本 Prompt 与多媒体引用同源解析，避免各节点重复扫描 edges/nodes
  const upstreamData = useMemo(() => {
    return getUpstreamData(id, edges, nodes);
  }, [edges, nodesDataKey, id]);

  const connectedImages = useMemo(() => {
    return upstreamData.all
      .filter(item => item.type === 'image' || item.type === 'video' || item.type === 'audio')
      .map(item => ({
        url: item.value,
        type: item.type as 'image' | 'video' | 'audio',
        nodeName: item.nodeName,
        nodeId: item.nodeId
      }))
      .slice(0, 6);
  }, [upstreamData]);

  // 2. 智能提取文本 Prompt 连线数据
  const connectedPrompt = upstreamData.text;

  const isPromptConnected = connectedPrompt.length > 0;
  const isFaceRefConnected = connectedImages.length > 0;

  // 3. 基础参数
  const providerId = data.inputs?.providerId || 'ali';
  const size = data.inputs?.size || '1024x1024';
  const cfg = data.inputs?.cfg !== undefined ? data.inputs.cfg : 7.0;
  const steps = data.inputs?.steps !== undefined ? data.inputs.steps : 20;

  // 多参考图画廊融合
  const refImages = useMemo(() => {
    const list: { url: string, type: 'image' | 'video' | 'audio', nodeId?: string }[] = [];
    
    // 1. 连线资产
    connectedImages.forEach(img => {
      list.push({
        url: img.url,
        type: img.type,
        nodeId: img.nodeId
      });
    });

    // 2. 本地历史资产（排重）
    const localRefs = data.inputs?.refImages || (data.inputs?.faceRef ? [data.inputs.faceRef] : []);
    localRefs.forEach((refUrl: string) => {
      if (list.some(item => item.url === refUrl)) return;
      
      let type: 'image' | 'video' | 'audio' = 'image';
      const lower = refUrl.toLowerCase();
      if (lower.includes('audio') || refUrl.endsWith('.mp3') || refUrl.endsWith('.wav')) type = 'audio';
      else if (lower.includes('video') || refUrl.endsWith('.mp4') || refUrl.endsWith('.webm')) type = 'video';
      
      list.push({
        url: refUrl,
        type
      });
    });

    return list.slice(0, 6);
  }, [connectedImages, data.inputs?.refImages, data.inputs?.faceRef]);

  const currentFaceRef = refImages[0]?.url || '';
  
  // 4. 输入状态
  const [promptInput, setPromptInput] = useState(data.inputs?.prompt && data.inputs.prompt !== 'null' ? data.inputs.prompt : '');
  const [showMentionList, setShowMentionList] = useState(false);
  const [mentionSearch, setMentionSearch] = useState('');
  const [cursorPos, setCursorPos] = useState(0);

  useEffect(() => {
    if (data.inputs?.prompt !== undefined) {
      const val = data.inputs.prompt === null || data.inputs.prompt === 'null' ? '' : data.inputs.prompt;
      if (val !== promptInput) {
        setPromptInput(val);
      }
    }
  }, [data.inputs?.prompt]);

  const currentPrompt = isPromptConnected ? connectedPrompt : promptInput;

  // 5. 核心状态
  const [activeTab, setActiveTab] = useState<'standard' | 'aix'>(data.inputs?.activeTab || 'standard');
  const [runningHubTemplateId, setRunningHubTemplateId] = useState<string>(data.inputs?.runningHubTemplateId || 'rh_wf_face_consistency');

  useEffect(() => {
    if (data.inputs?.runningHubTemplateId && data.inputs.runningHubTemplateId !== runningHubTemplateId) {
      setRunningHubTemplateId(data.inputs.runningHubTemplateId);
    }
  }, [data.inputs?.runningHubTemplateId]);
  const [generating, setGenerating] = useState(false);
  const [generatedImg, setGeneratedImg] = useState(data.outputs?.image || '');
  const [settings, setSettings] = useState<any>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [localName, setLocalName] = useState(data.label || '图像');

  // Popover 状态
  const [activePopover, setActivePopover] = useState<'model' | 'specs' | 'gallery' | 'runninghub' | 'batchSize' | null>(null);

  useEffect(() => {
    if (data.label) {
      setLocalName(data.label);
    }
  }, [data.label]);

  const wfSelector = useWorkflowSelector({
    capability: 'image',
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


  useEffect(() => {
    const loadSettings = async () => {
      try {
        const res = await fetch('/api/v1/settings');
        if (res.ok) {
          const settingsData = await res.json();
          setSettings(settingsData);
        }
      } catch (e) {
        console.error('加载 ImageServiceNode 外部依赖失败:', e);
      }
    };
    loadSettings();
  }, []);

  // 使用统一的模型选择钩子
  const { providers: activeProviders, models: currentProviderModels, currentModel: validModel, setProviderId: handleProviderChange, setModel: handleModelChange } = useModelSelector({
    capability: 'image',
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

  const model = validModel || currentProviderModels[0] || 'image-01';

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

  const handleTabChange = (tab: 'standard' | 'aix') => {
    setActiveTab(tab);
    handleInputChange('activeTab', tab);
  };

  const handleDelete = () => {
    setNodes((nds: any[]) => nds.filter((n) => n.id !== id));
    setEdges((eds: any[]) => eds.filter((e) => e.source !== id && e.target !== id));
  };

  // 9. 添加物理 upload-node 左侧错落生成逻辑 (杜绝闭包旧值，动态绝对定位到 X: -420 安全避让)
  const handleAddRefImagePhysicalNode = (base64Data?: string, fileName?: string, mimeType?: string) => {
    if ((window as any).spawnLinkedNode) {
      const currentNode = nodes.find(n => n.id === id);
      const posX = currentNode ? currentNode.position.x : 0;
      const posY = currentNode ? currentNode.position.y : 0;

      const connCount = nodes.filter(n => 
        edges.some(e => e.target === id && e.source === n.id)
      ).length;
      
      const staggeredOffsetY = -120 + connCount * 80; 

      // 智能提取多媒体文件类型
      let fileType: 'image' | 'video' | 'audio' = 'image';
      const nameLower = (fileName || '').toLowerCase();
      const mimeLower = (mimeType || '').toLowerCase();
      const urlLower = (base64Data || '').toLowerCase();
      
      if (mimeLower.startsWith('audio/') || nameLower.endsWith('.mp3') || nameLower.endsWith('.wav') || urlLower.endsWith('.mp3') || urlLower.endsWith('.wav')) {
        fileType = 'audio';
      } else if (mimeLower.startsWith('video/') || nameLower.endsWith('.mp4') || nameLower.endsWith('.webm') || urlLower.endsWith('.mp4') || urlLower.endsWith('.webm')) {
        fileType = 'video';
      }

      (window as any).spawnLinkedNode(id, 'upload-node', 'left', {
        fileType,
        fileUrl: base64Data || '',
        fileName: fileName || `${fileType === 'video' ? '视频' : (fileType === 'audio' ? '音频' : '参考图')}-${connCount + 1}`,
        position: { x: posX - 420, y: posY + staggeredOffsetY } // 严格定位在左侧 420 像素远端，保持清爽连线
      });
    } else {
      alert('未检测到智能连线引擎支持！');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = async () => {
        if (typeof reader.result === 'string') {
          const base64 = reader.result;
          
          handleAddRefImagePhysicalNode(base64, file.name, file.type);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const handleRemoveRefImage = (index: number) => {
    const nextRef = refImages.filter((_, i) => i !== index);
    handleInputChange('refImages', nextRef);
  };

  const handleOpenAssetsModal = () => {
    window.dispatchEvent(
      new CustomEvent('open-large-modal', {
        detail: { tab: 'assets', nodeTarget: id, type: 'image' }
      })
    );
  };

  // 监听全局资产回调 (动态避让 X: -420)
  useEffect(() => {
    const handleAssetsSelect = (e: any) => {
      const { nodeTarget, selectedUrl } = e.detail || {};
      if (nodeTarget === id && selectedUrl) {
        handleAddRefImagePhysicalNode(selectedUrl, '素材库选入资产');
      }
    };
    window.addEventListener('assets-selected' as any, handleAssetsSelect);
    return () => {
      window.removeEventListener('assets-selected' as any, handleAssetsSelect);
    };
  }, []);

  // 10. @ Mention 输入处理
  const handlePromptChange = (val: string) => {
    setPromptInput(val);
    handleInputChange('prompt', val);

    const lastAtIdx = val.lastIndexOf('@');
    if (lastAtIdx !== -1 && lastAtIdx >= val.length - 5) {
      const query = val.substring(lastAtIdx + 1);
      setMentionSearch(query);
      setShowMentionList(true);
      setCursorPos(lastAtIdx);
    } else {
      setShowMentionList(false);
    }
  };

  const handleSelectMention = (imgIndex: number, imgName: string) => {
    const asset = connectedImages[imgIndex];
    const typeLabel = asset ? (asset.type === 'image' ? '图' : asset.type === 'video' ? '视频' : '音频') : '图';
    const textBefore = promptInput.substring(0, cursorPos);
    const replacement = `@[${typeLabel}${imgIndex + 1}] `; // 用 @[图/视频/音频X] 替代以实现清爽缩略图与避免重名冲突
    const textAfter = promptInput.substring(cursorPos + mentionSearch.length + 1);
    const nextText = textBefore + replacement + textAfter;
    setPromptInput(nextText);
    handleInputChange('prompt', nextText);
    setShowMentionList(false);
  };

  // 11. 升级后的 handleSpawnPromptSource (文生图派生坐标也定位在 X: -420 远端)
  const handleSpawnPromptSource = () => {
    if ((window as any).spawnLinkedNode) {
      setNodes((nds: any[]) => {
        const currentNode = nds.find(n => n.id === id);
        const posX = currentNode ? currentNode.position.x : 0;
        const posY = currentNode ? currentNode.position.y : 0;

        setTimeout(() => {
          (window as any).spawnLinkedNode(id, 'prompt-source', 'left', {
            position: { x: posX - 420, y: posY } // 绝对定位到 -420 处，杜绝连线堆叠与遮挡
          });
        }, 20);
        return nds;
      });
    } else {
      alert('未检测到智能连线引擎支持！');
    }
  };

  // 12. 图像生成逻辑
  const handleGenerateImage = async () => {
    let processedPrompt = currentPrompt;
    connectedImages.forEach((img, idx) => {
      const label = img.type === 'image' ? '图' : img.type === 'video' ? '视频' : '音频';
      const refLabel = img.type === 'image' ? '参考图' : img.type === 'video' ? '参考视频' : '参考音频';
      // 优先支持并替换新的 @[图X] 清爽标记格式
      processedPrompt = processedPrompt.replace(new RegExp(`@\\[${label}${idx + 1}\\]`, 'g'), `[${refLabel}${idx + 1}]`);
      // 兼容可能存在的旧标签模式
      processedPrompt = processedPrompt.replace(`[${img.nodeName}]`, `[${refLabel}${idx + 1}]`);
    });

    const batchSize = data.inputs?.batchSize || 1;
    setGenerating(true);

    try {
      const resolvedRefImages = refImages.map(item => item.url);
      const resolvedFaceRef = resolvedRefImages[0] || '';

      for (let i = 0; i < batchSize; i++) {
        // 当生成多张时，给用户清晰的日志体验
        if (batchSize > 1) {
          window.dispatchEvent(
            new CustomEvent('add-success-log', {
              detail: {
                nodeId: id,
                nodeName: data.label || 'AI 图像渲染',
                model: activeTab === 'aix' ? (currentTemplate?.name || 'aix') : model,
                errorMsg: `🎬 串行生图：正在自动为您排队生成第 ${i + 1}/${batchSize} 张... ⌛`,
                type: 'image'
              }
            })
          );
        }

        setGeneratedImg('');
        
        // 如果 inputs 中含有选中的 ComfyUI 工作流，则全自动升级为 ComfyUI (aix) 驱动模式
        const isAixMode = activeTab === 'aix' || !!data.inputs?.runningHubWorkflowName;

        if (isAixMode) {
          if (!currentTemplate) {
            alert('请选择有效的 ComfyUI 云端工作流模板！');
            setGenerating(false);
            return;
          }

          const { aixInputs, dynamicMappings } = mapParams(unifiedParams, {
            inputs: data.inputs || {},
            size,
            defaultCfg: 7.0,
            defaultSteps: 20,
            resolvedText: processedPrompt,
            resolvedImages: resolvedRefImages,
            resolvedFaceRef: resolvedFaceRef,
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
            setGeneratedImg(outputUrl);
            setNodes((nodes: any[]) =>
              nodes.map((n) => {
                if (n.id === id) {
                  return {
                    ...n,
                    data: {
                      ...n.data,
                      outputs: {
                        ...((n.data as any)?.outputs || {}),
                        image: outputUrl,
                        output: outputUrl,
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
                  nodeName: data.label || 'AI 图像渲染',
                  model: currentTemplate.name,
                  errorMsg: batchSize > 1 
                    ? `🎉 第 ${i + 1}/${batchSize} 张 ComfyUI 成果级联渲染完成！` 
                    : '云端 RunningHub 任务执行成功 ✅',
                  outputUrl: outputUrl,
                  type: 'image'
                }
              })
            );
          } else {
            throw new Error(`云端任务第 ${i + 1} 张已完成，但未返回有效的图像成果 URL。`);
          }
        } else {
          // Standard 直连生图模式
          if (!processedPrompt.trim()) {
            alert('请输入或连线提供生图的画面描述 Prompt！');
            setGenerating(false);
            return;
          }

          const res = await fetch('/api/v1/image/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              providerId: providerId,
              model: model,
              prompt: processedPrompt,
              size: size,
              faceRef: resolvedFaceRef,
              refImages: resolvedRefImages
            })
          });

          const resData = await res.json();
          if (resData.data?.[0]) {
            const img = resData.data[0].b64_json 
              ? `data:image/png;base64,${resData.data[0].b64_json}` 
              : resData.data[0].url;
            
            setGeneratedImg(img);
            setNodes((nodes: any[]) =>
              nodes.map((n) => {
                if (n.id === id) {
                  return {
                    ...n,
                    data: {
                      ...n.data,
                      outputs: {
                        ...((n.data as any)?.outputs || {}),
                        image: img,
                        output: img,
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
                  nodeName: data.label || 'AI 图像渲染',
                  model: model,
                  errorMsg: batchSize > 1 
                    ? `🎉 第 ${i + 1}/${batchSize} 张图片生成成功！尺寸: ${size}` 
                    : `图像生成成功 ✅ 尺寸: ${size}`,
                  outputUrl: img,
                  type: 'image'
                }
              })
            );
          } else {
            const errorReason = resData.error || '生图接口未返回有效图片成果。';
            throw new Error(errorReason);
          }
        }
      }
    } catch (e: any) {
      console.error(e);
      const errorReason = e.message || '底座生图服务连接失败';
      setNodes((nodes: any[]) =>
        nodes.map((n) => {
          if (n.id === id) {
            return {
              ...n,
              data: {
                ...n.data,
                outputs: {
                  ...((n.data as any)?.outputs || {}),
                  image: '',
                  errorMsg: errorReason
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
            nodeName: data.label || 'AI 图像渲染',
            model: model,
            errorMsg: errorReason
          }
        })
      );
    } finally {
      setGenerating(false);
    }
  };

  const handleDownloadImage = () => {
    const imgUrl = generatedImg || data.outputs?.image;
    if (!imgUrl) {
      alert('暂无可供下载的图片结果！');
      return;
    }
    if (typeof (window as any).downloadFileDirectly === 'function') {
      (window as any).downloadFileDirectly(imgUrl, `toonflow-canvas-${id}.png`);
    } else {
      const a = document.createElement('a');
      a.href = imgUrl;
      a.download = `toonflow-canvas-${id}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  const handleSpawnVideoFusion = () => {
    if ((window as any).spawnLinkedNode) {
      (window as any).spawnLinkedNode(id, 'video-fusion', 'right');
    } else {
      alert('未检测到智能连线引擎支持！');
    }
  };

  return {
    providerId,
    activeProviders,
    size,
    cfg,
    steps,
    refImages,
    currentFaceRef,
    promptInput,
    showMentionList,
    mentionSearch,
    connectedImages,
    activeTab,
    runningHubTemplateId: wfSelector.currentWorkflow?.id || '',
    generating,
    generatedImg,
    settings,
    isFullscreen,
    isEditingName,
    localName,
    activePopover,
    currentTemplate,
    currentProviderModels,
    model,
    currentPrompt,
    isPromptConnected,
    isFaceRefConnected,
    connectedPrompt,

    fileInputRef,

    setPromptInput,
    setShowMentionList,
    setIsFullscreen,
    setIsEditingName,
    setLocalName,
    handleSaveName,
    handleTabChange,
    handleInputChange,
    handleDelete,
    handleFileChange,
    handleRemoveRefImage,
    handleOpenAssetsModal,
    handleSelectMention,
    handlePromptChange,
    handleGenerateImage,
    handleDownloadImage,
    handleSpawnPromptSource,
    handleSpawnVideoFusion,
    handleAddRefImagePhysicalNode,
    setActivePopover
  };
}
