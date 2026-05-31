import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { RunningHubService } from '../../../services/runninghub.service';
import { useModelSelector } from '../../../hooks/useModelSelector';
import { useWorkflowSelector } from '../../../hooks/useWorkflowSelector';
import { mapParams } from '../../../hooks/useParamMapper';

interface UseTTSNodeLogicProps {
  id: string;
  data: any;
  setNodes: any;
  setEdges: any;
  connectedPrompt: string;
  connectedRefAudio: string;
  isRefAudioConnected: boolean;
  isTextConnected: boolean;
}

export function useTTSNodeLogic({
  id,
  data,
  setNodes,
  setEdges,
  connectedPrompt,
  connectedRefAudio,
  isRefAudioConnected,
  isTextConnected
}: UseTTSNodeLogicProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioPreviewRef = useRef<HTMLAudioElement>(null);

  // 1. 提取基础输入参数
  const mode = data.inputs?.mode || 'direct';
  const providerId = data.inputs?.providerId || 'ali';
  const characterName = data.inputs?.characterName || '剧本男主';
  const refAudio = data.inputs?.refAudio || '';
  const currentRefAudio = isRefAudioConnected ? connectedRefAudio : refAudio;
  const workflowIdOrJson = data.inputs?.workflowIdOrJson || '';

  // 2. 状态管理
  const [activeTab, setActiveTab] = useState<'standard' | 'aix'>(data.inputs?.activeTab || 'standard');
  const [runningHubTemplateId, setRunningHubTemplateId] = useState<string>(data.inputs?.runningHubTemplateId || 'rh_wf_voice_consistency');
  const [cloning, setCloning] = useState(false);
  const [clonedAudio, setClonedAudio] = useState('');
  const [settings, setSettings] = useState<any>(null);
  const [isEditingName, setIsEditingName] = useState(false);
  const [localName, setLocalName] = useState(data.label || '音频');
  const [isPlaying, setIsPlaying] = useState(false);

  // 3. 同步本地名称
  useEffect(() => {
    if (data.label) {
      setLocalName(data.label);
    }
  }, [data.label]);

  const wfSelector = useWorkflowSelector({
    capability: 'audio',
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

  // 5. 扫描本地 10588 物理资产端口并自动装载
  useEffect(() => {
    const fetchPhysicalAudioLock = async () => {
      try {
        const searchParams = new URLSearchParams(window.location.search);
        const projectId = searchParams.get('projectId') || 'default_project';
        const res = await fetch(`http://localhost:10588/api/cornerScape/getAllAssets?projectId=${projectId}`);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) {
            const audioAsset = data.find((asset: any) => 
              asset.type === 'audio' || 
              (asset.filePath && (asset.filePath.toLowerCase().endsWith('.mp3') || asset.filePath.toLowerCase().endsWith('.wav')))
            );
            if (audioAsset && audioAsset.filePath) {
              const lockedUrl = `http://localhost:10588/api/assets/download?path=${encodeURIComponent(audioAsset.filePath)}`;
              updateNodeData({ refAudio: lockedUrl });
            }
          }
        }
      } catch (e) {
        console.warn('[TTS] 本地 10588 端口 API 扫描跳过或未运行:', e);
      }
    };
    fetchPhysicalAudioLock();
  }, []);

  // 6. 加载全局配置大模型列表
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const res = await fetch('/api/v1/settings');
        if (res.ok) {
          const settingsData = await res.json();
          setSettings(settingsData);
        }
      } catch (e) {
        console.error('加载 TTSServiceNode 外部依赖失败:', e);
      }
    };
    loadSettings();
    window.addEventListener('canvas-settings-updated', loadSettings);
    return () => window.removeEventListener('canvas-settings-updated', loadSettings);
  }, []);

  // 使用统一的模型选择钩子
  const { providers: activeProviders, models: currentProviderModels, currentModel: validModel, setProviderId: handleProviderChange, setModel: handleModelChange } = useModelSelector({
    capability: 'tts',
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

  const model = validModel || currentProviderModels[0] || 'fish-speech-1.4';

  // 当服务商或可选模型列表变化时，自动校验并重置当前选中的模型
  useEffect(() => {
    if (currentProviderModels.length > 0 && model && !currentProviderModels.includes(model)) {
      handleModelChange(currentProviderModels[0]);
    }
  }, [providerId, currentProviderModels, model]);

  // 9. 更新节点 Data 的底层函数
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

  // 10. 保存修改后的节点名称
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

  // 11. 打开全局大型资产/模板选择弹窗
  const handleOpenAssetsModal = (type: 'image' | 'video' | 'audio' = 'audio') => {
    window.dispatchEvent(
      new CustomEvent('open-large-modal', {
        detail: { tab: 'assets', nodeTarget: id, type }
      })
    );
  };

  const handleTabChange = (tab: 'standard' | 'aix') => {
    setActiveTab(tab);
    handleInputChange('activeTab', tab);
  };

  const handleTemplateChange = (templateId: string) => {
    setRunningHubTemplateId(templateId);
    handleInputChange('runningHubTemplateId', templateId);
  };

  const handleDelete = () => {
    setNodes((nds: any[]) => nds.filter((n) => n.id !== id));
    setEdges((eds: any[]) => eds.filter((e) => e.source !== id && e.target !== id));
  };

  // 12. 文件上传与拖拽机制
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    readAudioAsBase64(file);
  };

  const readAudioAsBase64 = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        handleInputChange('refAudio', reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('audio/')) {
      readAudioAsBase64(file);
    }
  };

  // 13. 音频下载与试听播放机制
  const handleDownloadAudio = () => {
    const audUrl = clonedAudio || data.outputs?.audio;
    if (!audUrl) {
      alert('暂无可下载的音频结果！');
      return;
    }
    if (typeof (window as any).downloadFileDirectly === 'function') {
      (window as any).downloadFileDirectly(audUrl, `toonflow-audio-${id}.mp3`);
    } else {
      const a = document.createElement('a');
      a.href = audUrl;
      a.download = `toonflow-audio-${id}.mp3`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  const handleTogglePlay = () => {
    const audUrl = clonedAudio || data.outputs?.audio;
    if (!audUrl) return;
    if (isPlaying) {
      audioPreviewRef.current?.pause();
      setIsPlaying(false);
    } else {
      audioPreviewRef.current?.play();
      setIsPlaying(true);
    }
  };

  // 14. 核心：发起声色克隆/工作流合成任务
  const handleVoiceClone = async () => {
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
            console.warn(`[useTTSNodeLogic] Failed to resolve db://:`, err);
          }
        }
      }
      return url;
    };

    const finalText = isTextConnected ? connectedPrompt : (data.inputs?.text || '');
    const resolvedRefAudio = await resolveDbUrl(currentRefAudio);

    setCloning(true);
    setClonedAudio('');

    try {
      if (activeTab === 'aix') {
        if (!currentTemplate) {
          alert('请选择有效的 RunningHub 云端工作流模板！');
          setCloning(false);
          return;
        }

        const { aixInputs, dynamicMappings } = mapParams(unifiedParams, {
          inputs: data.inputs || {},
          resolvedText: finalText,
          resolvedAudio: resolvedRefAudio,
        });

        const wfSource = currentTemplate.source || 'runninghub';
        const wfIdOrJson = wfSource === 'local_comfyui'
          ? (currentTemplate.rawWorkflowJson ? JSON.stringify(currentTemplate.rawWorkflowJson) : '')
          : (currentTemplate.workflowRef || currentTemplate.appId);

        // 提交云端或本地 ComfyUI 工作流
        const outputUrl = await RunningHubService.executeCustomWorkflow(
          wfSource,
          wfIdOrJson,
          aixInputs,
          dynamicMappings
        );

        if (outputUrl) {
          const finalUrl = outputUrl.startsWith('http') ? outputUrl : `http://localhost:4000${outputUrl}`;
          setClonedAudio(finalUrl);

          setNodes((nodes: any[]) =>
            nodes.map((n) => {
              if (n.id === id) {
                return {
                  ...n,
                  data: {
                    ...n.data,
                    outputs: {
                      ...((n.data as any)?.outputs || {}),
                      audio: finalUrl,
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
                nodeName: data.label || data.title || 'TTS 语音克隆',
                model: currentTemplate.name,
                errorMsg: '云端 RunningHub 任务执行成功 ✅',
                outputUrl: finalUrl,
                type: 'audio'
              }
            })
          );
        } else {
          throw new Error('云端任务已完成，但未返回有效的音频成果 URL。');
        }

      } else {
        // Standard 直连克隆模式
        if (!finalText.trim()) {
          alert('请输入或连线提供配音台词文本！');
          setCloning(false);
          return;
        }

        const referenceId = data.inputs?.referenceId || '';
        if (providerId !== 'suno' && !currentRefAudio && !referenceId.trim()) {
          alert('请上传或拖入一段声音克隆参考音频，或者直接填写「声音ID (reference_id)」！');
          setCloning(false);
          return;
        }

        // 导入统一执行钩子以彻底修复 executeNode 被绕过的 P0 问题
        const { executeNode } = await import('../../../hooks/executeNode');

        const result = await executeNode({
          nodeId: id,
          nodeType: 'tts-service',
          mediaType: 'audio',
          actionType: 'tts',
          upstreamData: {
            text: finalText,
            texts: [finalText],
            image: '',
            images: [],
            video: '',
            videos: [],
            audio: resolvedRefAudio,
            audios: [resolvedRefAudio],
            all: []
          },
          modelConfig: {
            providerId: providerId,
            modelId: model,
          },
          nodeInputs: {
            ...data.inputs,
            audioBase64: resolvedRefAudio,
            characterName: characterName,
            text: finalText,
            referenceId: referenceId,
            mode: mode,
            workflowIdOrJson: workflowIdOrJson
          }
        });

        if (result.success && result.data?.url) {
          const audio = result.data.url.startsWith('http') 
            ? result.data.url 
            : `http://localhost:4000${result.data.url}`;
          
          setClonedAudio(audio);

          setNodes((nodes: any[]) =>
            nodes.map((n) => {
              if (n.id === id) {
                return {
                  ...n,
                  data: {
                    ...n.data,
                    outputs: {
                      ...((n.data as any)?.outputs || {}),
                      audio: audio,
                      output: audio,
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
                nodeName: data.label || data.title || 'TTS 语音克隆',
                model: model,
                errorMsg: `音频配音生成成功 ✅ 服务商: ${providerId}`,
                outputUrl: audio,
                type: 'audio'
              }
            })
          );
        } else {
          const errorReason = result.error?.message || '未生成音频链接';
          throw new Error(errorReason);
        }
      }
    } catch (e: any) {
      console.error(e);
      const errorMsg = e.message || '音频生成失败';
      setClonedAudio('');
      setNodes((nodes: any[]) =>
        nodes.map((n) => {
          if (n.id === id) {
            return {
              ...n,
              data: {
                ...n.data,
                outputs: {
                  ...((n.data as any)?.outputs || {}),
                  audio: '',
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
            nodeName: data.title || 'TTS 语音克隆',
            model: activeTab === 'aix' ? (currentTemplate?.name || 'aix') : model,
            errorMsg: errorMsg
          }
        })
      );
    } finally {
      setCloning(false);
    }
  };

  // 15. 连线派生器
  const handleSpawnPromptSource = () => {
    if ((window as any).spawnLinkedNode) {
      (window as any).spawnLinkedNode(id, 'prompt-source', 'left');
    } else {
      alert('未检测到智能连线引擎支持！');
    }
  };

  const handleSpawnAudioUpload = () => {
    if ((window as any).spawnLinkedNode) {
      (window as any).spawnLinkedNode(id, 'upload-node', 'left', { fileType: 'audio' });
      window.dispatchEvent(
        new CustomEvent('open-large-modal', {
          detail: { tab: 'assets', nodeTarget: id, type: 'audio' }
        })
      );
    } else {
      alert('未检测到智能连线引擎支持！');
    }
  };

  return {
    // 基础输入及配置状态
    mode,
    providerId,
    activeProviders,
    characterName,
    refAudio,
    currentRefAudio,
    workflowIdOrJson,
    activeTab,
    runningHubTemplateId: wfSelector.currentWorkflow?.id || '',
    cloning,
    clonedAudio,
    settings,
    isEditingName,
    localName,
    isPlaying,
    currentTemplate,
    unifiedParams,
    currentProviderModels,
    model,

    // 交互引用
    fileInputRef,
    audioPreviewRef,

    // 触发函数
    setLocalName,
    setIsEditingName,
    setIsPlaying,
    handleSaveName,
    handleTabChange,
    handleInputChange,
    handleTemplateChange,
    handleDelete,
    handleFileChange,
    handleDragOver,
    handleDrop,
    handleDownloadAudio,
    handleTogglePlay,
    handleVoiceClone,
    handleSpawnPromptSource,
    handleSpawnAudioUpload,
    handleOpenAssetsModal
  };
}
